# 员工规则存储策略模式 — 设计文档

> 日期：2026-04-11
> 状态：待实现

---

## 背景

当前员工发薪规则强依赖链上合约（`setRules`），合约未部署时无法完整走通流程。本设计引入可切换的规则存储策略，支持"链上"和"后端数据库"两种模式，通过 `config.yaml` 系统级切换。

---

## 架构

### RulesProvider 接口

```go
// backend/services/rules_provider.go（新文件）
type RulesProvider interface {
    GetRules(employeeAddress string) ([]Rule, error)
    SaveRules(employeeAddress string, rules []Rule) error
}
```

### 两个实现

**ChainRulesProvider**
- `GetRules`：现有 `GetRulesFromChain` 逻辑迁移过来
- `SaveRules`：空实现（返回 nil），链上写入由前端 `setRules` 负责

**DBRulesProvider**
- `GetRules`：从 `employee_rules` 表读取
- `SaveRules`：先删除员工旧规则，再批量插入新规则，并更新 `employees.has_rules = true`

### 注入方式

`main.go` 启动时读取 `config.yaml` 的 `rules_mode`，构造对应实现并注入 `PayrollService` 和 `EmployeeService`（类似 Java 构造器注入）。

---

## 配置

```yaml
blockchain:
  rules_mode: "chain"   # "chain" 或 "backend"
```

默认值：`"chain"`（向后兼容）。

---

## 数据层

### 新增表 `employee_rules`

```go
type EmployeeRule struct {
    ID              uint64 `gorm:"primaryKey;autoIncrement"`
    EmployeeAddress string `gorm:"index;not null"`
    ChainID         int64  `gorm:"not null"`
    TokenAddress    string `gorm:"not null"`
    Percentage      int64  `gorm:"not null"` // 基数 10000，40% = 4000
    CreatedAt       int64
    UpdatedAt       int64
}
```

仅 `DBRulesProvider` 使用，`chain` 模式下此表始终为空。

---

## API 变更

### 新增端点

```
POST /api/v1/employees/:wallet_address/rules
Header: X-Wallet-Address（员工自己的钱包）
Body:
[
  { "chain_id": 8453, "token_address": "0x...", "percentage": 6000 },
  { "chain_id": 8453, "token_address": "0x...", "percentage": 4000 }
]
```

**校验规则**（与合约对齐）：
- 比例之和必须等于 10000，否则 400
- 最多 5 条规则，否则 400
- 员工不存在 → 404
- 重复提交幂等（先删后插）

仅在 `rules_mode: "backend"` 时有效，`chain` 模式下返回 405。

### 新增端点

```
GET /api/v1/config/rules-mode
Response: { "code": 200, "data": { "mode": "chain" } }
```

无需鉴权，前端启动时调用一次。

---

## 前端变更

### RulesForm.tsx

页面加载时调 `GET /api/v1/config/rules-mode`，按模式分支：

| | 链上模式（chain）| 后端模式（backend）|
|---|---|---|
| 提交动作 | `setRules` 签名上链 | `POST /employees/:wallet/rules` |
| 按钮文案 | **"写入链上 →"** | **"保存规则 →"** |
| 需要钱包签名 | 是 | 否 |

### RulesDone.tsx

- 链上模式：显示"已在链上配置 ✓"（现有）
- 后端模式：显示"已在后端配置 ✓"

### useBackend.ts 新增

```ts
getRulesMode(): Promise<'chain' | 'backend'>
saveRules(wallet: string, rules: RuleInput[]): Promise<void>
```

---

## 边界情况

### 模式切换时的存量数据

两种模式切换**不自动迁移数据**，员工需重新提交规则：

- `chain → backend`：链上已有规则被忽略，发薪回退为 100% USDC 直转，员工须在新模式下重新提交
- `backend → chain`：DB 规则被忽略，员工须重新签名上链

这对 MVP 是合理的，生产环境如需迁移可后续单独处理。

### PayrollService 中的规则读取

`ExecutePayout` 里的 `GetRulesFromChain` 替换为 `RulesProvider.GetRules`，回退逻辑（无规则时 100% USDC）保持不变。

---

## 文件改动一览

```
backend/
├── services/rules_provider.go     ← 新建：接口 + 两个实现
├── services/payroll.go            ← GetRulesFromChain 替换为 RulesProvider.GetRules
├── services/employee.go           ← SaveRules 调用注入的 Provider
├── handlers/employee.go           ← 新增 SaveRules handler
├── handlers/config.go             ← 新增 GetRulesMode handler
├── config/config.go               ← 新增 RulesMode 字段
├── db/models.go                   ← 新增 EmployeeRule 模型
└── router/router.go               ← 注册新路由

frontend/
├── src/features/shared/hooks/useBackend.ts   ← 新增 getRulesMode / saveRules
└── src/features/employee/components/RulesForm.tsx  ← 双模式逻辑
    src/features/employee/components/RulesDone.tsx  ← 文案按模式切换
```
