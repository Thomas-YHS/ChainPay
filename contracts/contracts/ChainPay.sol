// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ChainPay
 * @notice 跨链薪资路由合约：雇主单链发 USDC，通过 Li.Fi 路由到员工多链多 Token
 * @dev 合约本身不托管资金，资金在执行时从雇主钱包直接拉取
 */
contract ChainPay is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ===================== 常量 =====================

    /// @dev USDC 合约地址（Base 主网）
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @dev Li.Fi Diamond 合约地址（Base 主网）
    address public constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    /// @dev 比例基数（10000 = 100%）
    uint256 public constant PERCENTAGE_BASE = 10000;

    /// @dev 每个员工最多 5 条规则
    uint256 public constant MAX_RULES = 5;

    // ===================== 数据结构 =====================

    /**
     * @notice 员工接收规则
     * @param chainId     目标链 ID（如 8453 = Base，42161 = Arbitrum）
     * @param tokenAddress 目标 Token 合约地址（address(0) 表示原生代币）
     * @param percentage  分配比例（基于 10000，如 4000 = 40%）
     */
    struct Rule {
        uint256 chainId;
        address tokenAddress;
        uint256 percentage;
    }

    // ===================== 状态变量 =====================

    /// @notice 执行者钱包地址（Go 后端持有）
    address public executor;

    /// @notice 员工钱包地址 => 接收规则数组
    mapping(address => Rule[]) public employeeRules;

    /// @notice 员工是否已设置规则
    mapping(address => bool) public hasRules;

    /// @notice 雇主 => 员工列表
    mapping(address => address[]) public employerEmployees;

    /// @notice 员工 => 所属雇主
    mapping(address => address) public employeeEmployer;

    // ===================== 事件 =====================

    event EmployeeRegistered(
        address indexed employer,
        address indexed employee,
        uint256 timestamp
    );

    event RulesSet(
        address indexed employee,
        Rule[] rules,
        uint256 timestamp
    );

    event PayoutExecuted(
        address indexed employer,
        address indexed employee,
        uint256 totalAmount,
        uint256 timestamp
    );

    event ExecutorUpdated(
        address indexed oldExecutor,
        address indexed newExecutor
    );

    // ===================== 修饰符 =====================

    modifier onlyExecutor() {
        require(msg.sender == executor, "ChainPay: not executor");
        _;
    }

    // ===================== 构造函数 =====================

    /**
     * @param _executor 执行者钱包地址（Go 后端）
     */
    constructor(address _executor) Ownable(msg.sender) {
        require(_executor != address(0), "ChainPay: executor is zero address");
        executor = _executor;
    }

    // ===================== 雇主函数 =====================

    /**
     * @notice 雇主注册员工
     * @param employee 员工钱包地址
     */
    function registerEmployee(address employee) external {
        require(employee != address(0), "ChainPay: employee is zero address");
        require(
            employeeEmployer[employee] == address(0),
            "ChainPay: employee already registered"
        );

        employeeEmployer[employee] = msg.sender;
        employerEmployees[msg.sender].push(employee);

        emit EmployeeRegistered(msg.sender, employee, block.timestamp);
    }

    // ===================== 员工函数 =====================

    /**
     * @notice 员工设置跨链接收规则（只能设置一次）
     * @param rules 规则数组，percentage 总和必须等于 10000
     */
    function setRules(Rule[] calldata rules) external {
        require(
            employeeEmployer[msg.sender] != address(0),
            "ChainPay: not a registered employee"
        );
        require(!hasRules[msg.sender], "ChainPay: rules already set");
        require(rules.length >= 1, "ChainPay: no rules provided");
        require(rules.length <= MAX_RULES, "ChainPay: too many rules");

        // 校验总比例
        uint256 total = 0;
        for (uint256 i = 0; i < rules.length; i++) {
            require(rules[i].chainId != 0, "ChainPay: invalid chainId");
            require(rules[i].percentage > 0, "ChainPay: percentage must be > 0");
            total += rules[i].percentage;
        }
        require(total == PERCENTAGE_BASE, "ChainPay: percentages must sum to 10000");

        // 写入链上
        for (uint256 i = 0; i < rules.length; i++) {
            employeeRules[msg.sender].push(rules[i]);
        }
        hasRules[msg.sender] = true;

        emit RulesSet(msg.sender, rules, block.timestamp);
    }

    // ===================== 执行者函数 =====================

    /**
     * @notice 执行发薪：按员工规则拆分金额，调用 Li.Fi 合约执行跨链路由
     * @param employer      雇主钱包地址
     * @param employee      员工钱包地址
     * @param totalAmount   本次发薪总额（USDC，6 位小数）
     * @param lifiCallData  Li.Fi calldata 数组，与员工规则一一对应
     */
    function executePayout(
        address employer,
        address employee,
        uint256 totalAmount,
        bytes[] calldata lifiCallData
    ) external onlyExecutor nonReentrant whenNotPaused {
        require(hasRules[employee], "ChainPay: employee has no rules");
        require(
            employeeEmployer[employee] == employer,
            "ChainPay: employer/employee mismatch"
        );
        require(totalAmount > 0, "ChainPay: amount must be > 0");

        Rule[] storage rules = employeeRules[employee];
        require(
            lifiCallData.length == rules.length,
            "ChainPay: calldata length mismatch"
        );

        IERC20 usdc = IERC20(USDC_ADDRESS);

        // 校验雇主已 Approve 足够额度
        require(
            usdc.allowance(employer, address(this)) >= totalAmount,
            "ChainPay: insufficient allowance"
        );

        // 从雇主钱包拉取 USDC 到本合约
        usdc.safeTransferFrom(employer, address(this), totalAmount);

        // 按比例拆分，依次调用 Li.Fi
        // 用 remaining 追踪剩余金额，最后一条规则直接用余量，
        // 避免整除截断导致 wei 级别的 USDC 永久锁死在合约中。
        uint256 remaining = totalAmount;
        for (uint256 i = 0; i < rules.length; i++) {
            uint256 amount = (i == rules.length - 1)
                ? remaining  // 最后一条用剩余，消除精度损失
                : (totalAmount * rules[i].percentage) / PERCENTAGE_BASE;
            remaining -= amount;

            // forceApprove 先重置为 0 再设置新值（SafeERC20 v5 推荐做法）
            usdc.forceApprove(LIFI_DIAMOND, amount);

            // 调用 Li.Fi Diamond 合约
            (bool success, ) = LIFI_DIAMOND.call(lifiCallData[i]);
            require(success, "ChainPay: LiFi call failed");
        }

        emit PayoutExecuted(employer, employee, totalAmount, block.timestamp);
    }

    // ===================== 查询函数 =====================

    /**
     * @notice 查询员工的接收规则
     * @param employee 员工钱包地址
     */
    function getRules(address employee) external view returns (Rule[] memory) {
        return employeeRules[employee];
    }

    /**
     * @notice 查询雇主的所有员工地址
     * @param employer 雇主钱包地址
     */
    function getEmployees(address employer) external view returns (address[] memory) {
        return employerEmployees[employer];
    }

    // ===================== Owner 管理函数 =====================

    /**
     * @notice 更新执行者钱包地址
     * @param newExecutor 新的执行者地址
     */
    function setExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "ChainPay: new executor is zero address");
        address old = executor;
        executor = newExecutor;
        emit ExecutorUpdated(old, newExecutor);
    }

    /**
     * @notice 暂停合约（紧急情况）
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice 紧急提款：将合约内滞留的 Token 转回 Owner（仅暂停状态可用）
     * @param token  Token 合约地址
     * @param to     接收地址
     * @param amount 提取数量
     */
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner whenPaused {
        require(to != address(0), "ChainPay: rescue to zero address");
        IERC20(token).safeTransfer(to, amount);
    }
}
