# ChainPay 合约设计文档总览

> 当前版本：v1.0 | 最后更新：2026-04-08

---

## 文档结构

| 文档 | 内容 |
|---|---|
| [v1.0-Contract.md](./v1.0-Contract.md) | 完整合约设计：数据结构、核心函数、安全措施 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-04-03 | 初始版本 |
| v1.1 | — | 待更新 |

---

## 快速参考

**部署链**：Base Mainnet（Chain ID: 8453）

**关键地址**：
| 名称 | 地址 |
|---|---|
| USDC（Base）| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Li.Fi Diamond | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` |
| ChainPay 合约 | **待部署后填入** |

**核心函数**：
```solidity
registerEmployee(address employee)     // 雇主注册员工
setRules(Rule[] rules)               // 员工设置规则（仅一次）
executePayout(employer, employee,    // 执行者触发发薪
    totalAmount, bytes[] lifiCallData)
rescueTokens(token, to, amount)      // Owner 提取代币
updateExecutor(newExecutor)          // Owner 更换执行者
```

**安全措施**：ReentrancyGuard、SafeERC20、内置溢出保护、零地址检查、事件追溯。

**比例精度**：10000 为基数（40% = 4000），每员工最多 5 条规则。

> 完整审计报告见 [`../audit/ChainPay_Audit_Summary.md`](../audit/ChainPay_Audit_Summary.md)
