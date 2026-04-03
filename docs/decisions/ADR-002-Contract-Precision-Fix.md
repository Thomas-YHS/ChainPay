# ADR-002: 发薪比例精度修复 — 余量法

> 日期：2026-04-03
> 状态：**已采纳并实施**
> 关联文件：`contracts/contracts/ChainPay.sol`，`contracts/contracts/test/ChainPayTest.sol`

---

## 背景

`executePayout` 函数按员工设定的比例（基数 10000）将 `totalAmount` 拆分为多笔金额，依次调用 Li.Fi 合约路由。

原始实现对每条规则均独立计算：

```solidity
uint256 amount = (totalAmount * rules[i].percentage) / PERCENTAGE_BASE;
```

Solidity 整数除法向下截断，当规则条数 ≥ 2 且比例非整除时，**各条金额之和 < totalAmount**，差值（wei 级别）永久滞留在合约中。

---

## 问题场景

**示例：** 3 名员工，规则 33.33% / 33.33% / 33.34%（`percentage`: 3333 / 3333 / 3334）

```
totalAmount = 100_000_000（100 USDC，6 位小数）

计算：
  rule[0]: 100_000_000 × 3333 / 10000 = 33_330_000
  rule[1]: 100_000_000 × 3333 / 10000 = 33_330_000
  rule[2]: 100_000_000 × 3334 / 10000 = 33_340_000

实际分发：33_330_000 + 33_330_000 + 33_340_000 = 99_999_999
残留合约：100_000_000 − 99_999_999 = 1 wei
```

1 wei 看似微小，但：
1. 合约无任何提款函数（MVP 版本），该 wei 永久锁死
2. 规模化后（大量雇主 × 员工 × 发薪次数），累计残留可观
3. 黑客松评审时可被直接发现

---

## 决策

采用**余量法（Remainder Method）**：前 N-1 条规则按比例计算，最后一条规则直接使用剩余金额。

```solidity
uint256 remaining = totalAmount;
for (uint256 i = 0; i < rules.length; i++) {
    uint256 amount = (i == rules.length - 1)
        ? remaining                                            // 最后一条用余量
        : (totalAmount * rules[i].percentage) / PERCENTAGE_BASE;
    remaining -= amount;

    usdc.forceApprove(LIFI_DIAMOND, amount);
    (bool success, ) = LIFI_DIAMOND.call(lifiCallData[i]);
    require(success, "ChainPay: LiFi call failed");
}
```

---

## 权衡分析

### 余量法（已采用）

**优点：**
- 实现简单，只需 +3 行
- 零 wei 残留，资金 100% 分发
- Gas 开销与原方案完全相同

**缺点：**
- 最后一条规则的实际到账金额可能与 `percentage` 精确计算值相差 1~(N-1) wei
- 对员工而言差异可忽略不计（1 wei ≈ 0.000001 USDC）

### 备选方案 A：rescueERC20 紧急提款

在合约中添加 Owner 可调用的 `rescueERC20(token, amount)` 函数。

**问题：** Owner 可随时取走合约内的任何 ERC20，引入额外信任假设，不符合"合约不托管资金"的设计原则。黑客松阶段不采用。

### 备选方案 B：使用定点数库（如 PRBMath）

引入高精度运算库进行比例计算，消除截断误差。

**问题：** 依赖外部库，引入额外复杂度，对 1 wei 的精度问题来说过度设计。黑客松阶段不采用。

---

## 测试验证

新增专项测试用例（`test/ChainPay.test.js`）：

```
✔ 三条 33.33%/33.33%/33.34% 规则：合约无 USDC 残留
```

测试流程：
1. 注册员工，设置三条比例规则（总和 = 10000）
2. 执行发薪
3. 断言 `mockUSDC.balanceOf(chainPayAddress) === 0`

同时更新 `MockLiFi.sol`，使其真实模拟 Li.Fi 转账行为（`transferFrom` 消耗 USDC），确保测试场景真实可信。

---

## 影响范围

| 文件 | 改动 |
|---|---|
| `contracts/contracts/ChainPay.sol` | `executePayout` 循环改用余量法 |
| `contracts/contracts/test/ChainPayTest.sol` | 同步修改（测试用） |
| `contracts/contracts/test/MockLiFi.sol` | 新增 `transferFrom` 模拟行为 |
| `contracts/test/ChainPay.test.js` | 新增精度验证测试 |

---

## 结论

余量法以最小代价（3 行代码）彻底解决 wei 精度残留问题，是黑客松阶段的最优选择。对于生产版本，可在余量法基础上进一步添加 `assert(remaining == 0)` 验证，确保逻辑一致性。
