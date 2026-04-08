# ChainPay 数据库设计文档总览

> 当前版本：v1.0 | 最后更新：2026-04-08

---

## 文档结构

| 文档 | 内容 |
|---|---|
| [v1.0-DB.md](./v1.0-DB.md) | 完整表设计：employees + payroll_logs，含 SQL 和 GORM 模型 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-04-03 | 初始版本 |
| v1.1 | — | 待更新 |

---

## 快速参考

**两张核心表**：

| 表 | 职责 |
|---|---|
| `employees` | 员工档案（姓名、钱包、金额、频率）|
| `payroll_logs` | 发薪记录（金额、时间、tx hash、状态）|

**员工接收规则存储在链上合约，不存数据库。** `has_rules` 仅作链下缓存。

**关键字段**：
- `salary_amount`：`NUMERIC(18, 6)`，USDC 精度（6 位小数）
- `pay_frequency`：支持 `daily` / `weekly` / `monthly`
- `next_pay_date`：Cron 触发依据

**ORM**：Go GORM，AutoMigrate（开发阶段，生产建议用 sql-migrate）
