# ChainPay 合约设计文档

> Solidity · 部署在 Base · 2026年4月

---

## 1. 合约职责

ChainPay 智能合约是整个系统的**规则执行层**，负责：

1. **存储员工接收规则**（链上透明，不可篡改）
2. **验证执行者身份**，防止任意地址触发发薪
3. **验证雇主 Approve 额度**，确保资金充足
4. **按规则拆分金额**，依次调用 Li.Fi 合约执行跨链路由

合约本身不托管资金，资金始终在雇主钱包中，执行时由合约从雇主钱包拉取。

---

## 2. 数据结构

### 接收规则（Rule）

```solidity
struct Rule {
    uint256 chainId;        // 目标链 ID（如 8453 = Base，42161 = Arbitrum）
    address tokenAddress;   // 目标 Token 合约地址（address(0) 表示原生代币）
    uint256 percentage;     // 分配比例（基于 10000，如 4000 = 40%）
}
```

> **比例精度说明**：使用 10000 为基数（而非 100），支持小数比例，如 33.33% = 3333。

### 员工规则映射

```solidity
// 员工钱包地址 => 接收规则数组
mapping(address => Rule[]) public employeeRules;

// 员工是否已设置规则
mapping(address => bool) public hasRules;
```

### 雇主 - 员工关系

```solidity
// 雇主钱包地址 => 员工钱包地址数组
mapping(address => address[]) public employerEmployees;

// 员工 => 雇主（一个员工只属于一个雇主）
mapping(address => address) public employeeEmployer;
```

---

## 3. 核心函数

### 3.1 注册员工（雇主调用）

```solidity
function registerEmployee(address employee) external

// 功能：雇主将员工地址注册到系统
// 权限：任何已连接钱包的雇主
// 约束：
//   - employee 地址不能为零地址
//   - 员工尚未被其他雇主注册
// 事件：EmployeeRegistered(employer, employee)
```

### 3.2 设置接收规则（员工调用）

```solidity
function setRules(Rule[] calldata rules) external

// 功能：员工设置跨链接收规则，写入链上
// 权限：已被雇主注册的员工地址
// 约束：
//   - 员工尚未设置过规则（只能设置一次）
//   - rules 数组长度 1~5 条
//   - 所有规则的 percentage 总和必须 = 10000
//   - 每条规则的 chainId 和 tokenAddress 不能为空
// 事件：RulesSet(employee, rules)
```

### 3.3 执行发薪（执行者调用）

```solidity
function executePayout(
    address employer,
    address employee,
    uint256 totalAmount,
    bytes[] calldata lifiCallData
) external onlyExecutor

// 功能：按员工规则拆分金额，调用 Li.Fi 合约执行跨链路由
// 权限：仅执行者钱包（onlyExecutor modifier）
// 约束：
//   - 员工已设置规则
//   - 雇主对本合约的 USDC Allowance >= totalAmount
//   - lifiCallData 长度与员工规则数量一致
// 执行步骤：
//   1. 从雇主钱包转入 USDC 到合约
//   2. 按比例拆分金额
//   3. 依次调用 Li.Fi 合约执行每条路由
//   4. 记录发薪完成
// 事件：PayoutExecuted(employer, employee, totalAmount, timestamp)
```

### 3.4 查询员工规则（任意地址可读）

```solidity
function getRules(address employee) external view returns (Rule[] memory)

// 功能：查询员工的接收规则
// 权限：任意地址（public 读取）
```

### 3.5 更新执行者地址（Owner 调用）

```solidity
function setExecutor(address newExecutor) external onlyOwner

// 功能：更新执行者钱包地址
// 权限：合约 Owner（部署者）
// 用途：执行者钱包需要轮换时使用
// 事件：ExecutorUpdated(oldExecutor, newExecutor)
```

---

## 4. 权限模型

```
Owner（合约部署者）
  └── 可以更新执行者地址（setExecutor）
  └── 可以暂停合约（紧急情况）

执行者钱包（Go 后端持有）
  └── 只能调用 executePayout
  └── 无法修改规则、无法转移 Owner

雇主（任意钱包）
  └── 可以注册员工（registerEmployee）
  └── 需要提前 Approve USDC 给本合约

员工（已注册钱包）
  └── 只能设置自己的规则（setRules）
  └── 只能设置一次，不可修改
```

---

## 5. 事件（Events）

```solidity
// 员工被注册
event EmployeeRegistered(
    address indexed employer,
    address indexed employee,
    uint256 timestamp
);

// 员工设置规则
event RulesSet(
    address indexed employee,
    Rule[] rules,
    uint256 timestamp
);

// 发薪执行完成
event PayoutExecuted(
    address indexed employer,
    address indexed employee,
    uint256 totalAmount,
    uint256 timestamp
);

// 执行者地址更新
event ExecutorUpdated(
    address indexed oldExecutor,
    address indexed newExecutor
);
```

---

## 6. 安全设计

### 6.1 执行者权限限制

```solidity
modifier onlyExecutor() {
    require(msg.sender == executor, "ChainPay: not executor");
    _;
}
```

执行者只能调用 `executePayout`，合约内部约束资金只能流向员工规则指定的地址，无法任意转账。

### 6.2 Approve 精确金额

雇主每次发薪前 Approve 精确金额（等于本次发薪总额），合约执行后 Allowance 清零。前端在触发发薪前自动检查 Allowance 是否充足。

```solidity
// 合约内部检查
require(
    IERC20(usdcAddress).allowance(employer, address(this)) >= totalAmount,
    "ChainPay: insufficient allowance"
);
```

### 6.3 规则总比例校验

```solidity
uint256 total = 0;
for (uint i = 0; i < rules.length; i++) {
    total += rules[i].percentage;
}
require(total == 10000, "ChainPay: percentages must sum to 10000");
```

### 6.4 防重入攻击

继承 OpenZeppelin `ReentrancyGuard`，在 `executePayout` 上添加 `nonReentrant` modifier。

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

function executePayout(...) external onlyExecutor nonReentrant {
    // ...
}
```

### 6.5 紧急暂停

继承 OpenZeppelin `Pausable`，Owner 可在紧急情况下暂停所有发薪操作。

```solidity
import "@openzeppelin/contracts/security/Pausable.sol";

function executePayout(...) external onlyExecutor nonReentrant whenNotPaused {
    // ...
}
```

---

## 7. Li.Fi 集成

合约调用 Li.Fi 的方式：通过 Li.Fi 的链上合约地址直接调用，传入由 **Go 后端实时生成**的 calldata。

### 什么是 callData

callData 是一笔以太坊交易的"指令内容"，包含：

```
函数选择器（4字节）  →  调用 Li.Fi 合约的哪个路由函数
参数（ABI 编码）    →  {
    bridge: "stargate",            // 使用哪个桥
    sendingAssetId: "0x833589...", // 源 Token（USDC）
    receiver: "0x员工钱包",         // 接收地址
    minAmount: 59700000,           // 最少收到多少（含滑点保护）
    destinationChainId: 42161,     // 目标链
    ...
}
```

**callData 有时效性**：其中的 `minAmount` 基于生成时的实时价格计算，若价格波动超过滑点容忍范围，合约执行会 revert。因此必须**即生成即执行**，时间差越小越好。

### lifiCallData 生成方式（后端负责）

**前端只负责展示路由预览**（用 Li.Fi SDK `getRoutes`）。
**实际 callData 由 Go 后端在触发发薪时实时调用 Li.Fi REST API 生成**，然后立即调用合约执行，时间差 < 1 秒。

```go
// Go 后端：为每条员工规则实时生成 callData
func getLifiCallData(rule Rule, amount int64, employeeAddr string) (string, error) {
    url := fmt.Sprintf(
        "https://li.quest/v1/quote?fromChain=8453&toChain=%d"+
        "&fromToken=%s&toToken=%s"+
        "&fromAmount=%d&fromAddress=%s&toAddress=%s"+
        "&integrator=ChainPay&slippage=0.005",
        rule.ChainId,
        USDC_BASE,
        rule.TokenAddress,
        amount,
        CHAINPAY_CONTRACT,
        employeeAddr,
    )

    resp, err := http.Get(url)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    var quote LifiQuoteResponse
    if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
        return "", err
    }

    // transactionRequest.data 就是 callData
    return quote.TransactionRequest.Data, nil
}

// 为所有规则生成 callData 数组，然后立即调用合约
func executePayout(employer, employee string, totalAmount int64) error {
    rules := getEmployeeRulesFromChain(employee)
    callDataArray := []string{}

    for _, rule := range rules {
        amount := totalAmount * int64(rule.Percentage) / 10000
        callData, err := getLifiCallData(rule, amount, employee)
        if err != nil {
            return err
        }
        callDataArray = append(callDataArray, callData)
    }

    // 立即调用合约，时间差 < 1秒
    return callContract(employer, employee, totalAmount, callDataArray)
}
```

### 合约内执行

```solidity
// Li.Fi 合约地址（Base 主网）
address constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

for (uint i = 0; i < rules.length; i++) {
    uint256 amount = (totalAmount * rules[i].percentage) / 10000;

    // 先清零再 approve（SafeERC20 要求）
    usdc.safeApprove(LIFI_DIAMOND, 0);
    usdc.safeApprove(LIFI_DIAMOND, amount);

    // 调用 Li.Fi 合约（callData 由后端实时生成，时间差极小）
    (bool success, ) = LIFI_DIAMOND.call(lifiCallData[i]);
    require(success, "ChainPay: LiFi call failed");
}
```

### 前端的职责（仅展示预览）

```typescript
// 前端只用 Li.Fi SDK 展示路由预览，不生成实际 callData
import { getRoutes } from '@lifi/sdk'

const routes = await getRoutes({
  fromChainId: 8453,
  toChainId: rule.chainId,
  fromTokenAddress: USDC_ADDRESS,
  toTokenAddress: rule.tokenAddress,
  fromAmount: amount.toString(),
  fromAddress: CHAINPAY_CONTRACT,
  toAddress: employeeAddress,
})

// 展示：经过哪个桥、预计到账金额、Gas 费
// 不提取 callData，不传给后端
```

---

## 8. 合约依赖

```
@openzeppelin/contracts
  ├── access/Ownable.sol          → Owner 权限管理
  ├── security/ReentrancyGuard.sol → 防重入攻击
  ├── security/Pausable.sol        → 紧急暂停
  └── token/ERC20/IERC20.sol       → USDC 接口
```

---

## 9. 部署信息

| 项目 | 内容 |
|---|---|
| 部署链 | Base Mainnet（Chain ID: 8453）|
| 备用链 | Gnosis Chain（Chain ID: 100）|
| 开发框架 | Hardhat |
| Solidity 版本 | ^0.8.20 |
| USDC 合约（Base）| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Li.Fi Diamond（Base）| `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` |

---

## 10. 开发 / 测试流程

```
1. 本地开发
   npx hardhat compile          → 编译合约
   npx hardhat test             → 运行单元测试
   npx hardhat node             → 启动本地测试链

2. 部署到 Base
   npx hardhat run scripts/deploy.js --network base

3. 验证合约（Basescan）
   npx hardhat verify --network base <合约地址>

4. 测试发薪流程
   - 使用小额 USDC（如 1 USDC）在 Base 主网测试
   - 验证 Li.Fi 路由是否正确执行
   - 检查员工钱包收款情况
```

---

## 11. 已知限制（黑客松版本）

| 限制 | 说明 | 未来改进方向 |
|---|---|---|
| 员工规则不可修改 | 设置后永久锁定 | 引入时间锁或雇主审批机制 |
| 不支持合约升级 | 部署后无法修改逻辑 | 使用 OpenZeppelin Proxy 模式 |
| 单一执行者 | 只有一个执行者钱包 | 多签执行者（Gnosis Safe）|
| 仅支持 USDC 发薪 | 雇主只能用 USDC 发薪 | 支持多种发薪 Token |
| 无链上发薪频率 | 发薪频率由链下 Cron 控制 | 未来可链上记录发薪时间戳 |

---

*本文档为黑客松 MVP 版本合约设计，部分安全机制已简化处理。生产版本需经过专业合约审计。*
