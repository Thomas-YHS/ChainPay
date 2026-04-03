// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev 仅用于测试的 ChainPay 版本
 * 与 ChainPay.sol 逻辑完全相同，但 USDC 和 Li.Fi 地址通过构造函数注入，
 * 便于在本地测试网中使用 Mock 合约。
 */
contract ChainPayTest is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant PERCENTAGE_BASE = 10000;
    uint256 public constant MAX_RULES = 5;

    address public immutable USDC_ADDRESS;
    address public immutable LIFI_DIAMOND;

    struct Rule {
        uint256 chainId;
        address tokenAddress;
        uint256 percentage;
    }

    address public executor;
    mapping(address => Rule[]) public employeeRules;
    mapping(address => bool) public hasRules;
    mapping(address => address[]) public employerEmployees;
    mapping(address => address) public employeeEmployer;

    event EmployeeRegistered(address indexed employer, address indexed employee, uint256 timestamp);
    event RulesSet(address indexed employee, Rule[] rules, uint256 timestamp);
    event PayoutExecuted(address indexed employer, address indexed employee, uint256 totalAmount, uint256 timestamp);
    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);

    modifier onlyExecutor() {
        require(msg.sender == executor, "ChainPay: not executor");
        _;
    }

    constructor(address _executor, address _usdc, address _lifi) Ownable(msg.sender) {
        require(_executor != address(0), "ChainPay: executor is zero address");
        executor = _executor;
        USDC_ADDRESS = _usdc;
        LIFI_DIAMOND = _lifi;
    }

    function registerEmployee(address employee) external {
        require(employee != address(0), "ChainPay: employee is zero address");
        require(employeeEmployer[employee] == address(0), "ChainPay: employee already registered");
        employeeEmployer[employee] = msg.sender;
        employerEmployees[msg.sender].push(employee);
        emit EmployeeRegistered(msg.sender, employee, block.timestamp);
    }

    function setRules(Rule[] calldata rules) external {
        require(employeeEmployer[msg.sender] != address(0), "ChainPay: not a registered employee");
        require(!hasRules[msg.sender], "ChainPay: rules already set");
        require(rules.length >= 1, "ChainPay: no rules provided");
        require(rules.length <= MAX_RULES, "ChainPay: too many rules");

        uint256 total = 0;
        for (uint256 i = 0; i < rules.length; i++) {
            require(rules[i].chainId != 0, "ChainPay: invalid chainId");
            require(rules[i].percentage > 0, "ChainPay: percentage must be > 0");
            total += rules[i].percentage;
        }
        require(total == PERCENTAGE_BASE, "ChainPay: percentages must sum to 10000");

        for (uint256 i = 0; i < rules.length; i++) {
            employeeRules[msg.sender].push(rules[i]);
        }
        hasRules[msg.sender] = true;
        emit RulesSet(msg.sender, rules, block.timestamp);
    }

    function executePayout(
        address employer,
        address employee,
        uint256 totalAmount,
        bytes[] calldata lifiCallData
    ) external onlyExecutor nonReentrant whenNotPaused {
        require(hasRules[employee], "ChainPay: employee has no rules");
        require(employeeEmployer[employee] == employer, "ChainPay: employer/employee mismatch");
        require(totalAmount > 0, "ChainPay: amount must be > 0");

        Rule[] storage rules = employeeRules[employee];
        require(lifiCallData.length == rules.length, "ChainPay: calldata length mismatch");

        IERC20 usdc = IERC20(USDC_ADDRESS);
        require(
            usdc.allowance(employer, address(this)) >= totalAmount,
            "ChainPay: insufficient allowance"
        );

        usdc.safeTransferFrom(employer, address(this), totalAmount);

        uint256 remaining = totalAmount;
        for (uint256 i = 0; i < rules.length; i++) {
            uint256 amount = (i == rules.length - 1)
                ? remaining
                : (totalAmount * rules[i].percentage) / PERCENTAGE_BASE;
            remaining -= amount;
            usdc.forceApprove(LIFI_DIAMOND, amount);
            (bool success, ) = LIFI_DIAMOND.call(lifiCallData[i]);
            require(success, "ChainPay: LiFi call failed");
        }

        emit PayoutExecuted(employer, employee, totalAmount, block.timestamp);
    }

    function getRules(address employee) external view returns (Rule[] memory) {
        return employeeRules[employee];
    }

    function getEmployees(address employer) external view returns (address[] memory) {
        return employerEmployees[employer];
    }

    function setExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "ChainPay: new executor is zero address");
        address old = executor;
        executor = newExecutor;
        emit ExecutorUpdated(old, newExecutor);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
