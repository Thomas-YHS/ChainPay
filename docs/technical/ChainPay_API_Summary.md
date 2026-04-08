# ChainPay API 文档总览

> 当前版本：v1.0 | 最后更新：2026-04-08

---

## 文档结构

| 文档 | 内容 |
|---|---|
| [v1.0-API.md](./v1.0-API.md) | 完整 API 端点、请求响应示例、认证说明 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-04-03 | 初始版本 |
| v1.1 | — | 待更新 |

---

## 快速参考

**Base URL**：`http://localhost:8080/api/v1`

**认证**（黑客松）：
```
X-Wallet-Address: 0x雇主钱包地址
```

**端点概览**：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/employees` | 添加员工 |
| GET | `/api/v1/employees` | 列出员工 |
| GET | `/api/v1/employees/:wallet` | 获取员工 |
| DELETE | `/api/v1/employees/:wallet` | 删除员工 |
| POST | `/api/v1/payroll/execute` | 手动触发发薪 |
| GET | `/api/v1/payroll/logs` | 查询发薪记录 |

**员工接收规则**存储在链上合约，不通过后端 API 管理。

> ⚠️ 当前认证仅格式校验，无签名验证（EIP-191），生产需加固。
