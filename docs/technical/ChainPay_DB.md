# ChainPay 数据库设计文档

> PostgreSQL · Go GORM · 2026年4月

---

## 概述

ChainPay 使用 PostgreSQL 存储**链下数据**，共两张核心表：

| 表名 | 职责 |
|---|---|
| `employees` | 员工档案（姓名、钱包地址、合约金额、发薪频率等）|
| `payroll_logs` | 发薪记录（金额、时间、tx hash、状态）|

> **员工接收规则存储在链上合约，不存数据库。**
> `has_rules` 字段仅作为链下缓存状态，方便前端快速判断。

---

## 表设计

### 1. employees — 员工档案表

```sql
CREATE TABLE employees (
    id                BIGSERIAL PRIMARY KEY,
    employer_address  VARCHAR(42)     NOT NULL,
    name              VARCHAR(100)    NOT NULL,
    nickname          VARCHAR(100),
    wallet_address    VARCHAR(42)     NOT NULL UNIQUE,
    salary_amount     NUMERIC(18, 6)  NOT NULL,
    pay_frequency     VARCHAR(10)     NOT NULL,
    has_rules         BOOLEAN         NOT NULL DEFAULT FALSE,
    next_pay_date     TIMESTAMPTZ     NOT NULL,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_employees_employer ON employees(employer_address);
CREATE UNIQUE INDEX idx_employees_wallet ON employees(wallet_address);
```

**字段说明**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL | 自增主键 |
| employer_address | VARCHAR(42) | 雇主钱包地址（0x 开头，42位）|
| name | VARCHAR(100) | 员工姓名 |
| nickname | VARCHAR(100) | 昵称（可为空）|
| wallet_address | VARCHAR(42) | 员工钱包地址（唯一）|
| salary_amount | NUMERIC(18,6) | 合约月薪金额（USDC）|
| pay_frequency | VARCHAR(10) | 发薪频率：`daily` / `weekly` / `monthly` |
| has_rules | BOOLEAN | 员工是否已在链上设置接收规则（链下缓存）|
| next_pay_date | TIMESTAMPTZ | 下次发薪日期（Cron 任务根据此字段触发）|
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 最后更新时间 |

**GORM 模型定义（Go）**

```go
type Employee struct {
    ID              uint64          `gorm:"primaryKey;autoIncrement" json:"id"`
    EmployerAddress string          `gorm:"type:varchar(42);not null;index" json:"employer_address"`
    Name            string          `gorm:"type:varchar(100);not null" json:"name"`
    Nickname        string          `gorm:"type:varchar(100)" json:"nickname"`
    WalletAddress   string          `gorm:"type:varchar(42);not null;uniqueIndex" json:"wallet_address"`
    SalaryAmount    decimal.Decimal `gorm:"type:numeric(18,6);not null" json:"salary_amount"`
    PayFrequency    string          `gorm:"type:varchar(10);not null" json:"pay_frequency"`
    HasRules        bool            `gorm:"not null;default:false" json:"has_rules"`
    NextPayDate     time.Time       `gorm:"not null" json:"next_pay_date"`
    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}
```

**next_pay_date 计算规则**

```go
// 创建员工时计算首次发薪日期
func calcNextPayDate(frequency string) time.Time {
    now := time.Now().UTC()
    switch frequency {
    case "daily":
        return now.Add(24 * time.Hour)
    case "weekly":
        return now.Add(7 * 24 * time.Hour)
    case "monthly":
        return now.AddDate(0, 1, 0)
    }
}

// 发薪完成后更新下次发薪日期
func updateNextPayDate(current time.Time, frequency string) time.Time {
    switch frequency {
    case "daily":
        return current.Add(24 * time.Hour)
    case "weekly":
        return current.Add(7 * 24 * time.Hour)
    case "monthly":
        return current.AddDate(0, 1, 0)
    }
}
```

---

### 2. payroll_logs — 发薪记录表

```sql
CREATE TABLE payroll_logs (
    id                BIGSERIAL PRIMARY KEY,
    employer_address  VARCHAR(42)     NOT NULL,
    employee_address  VARCHAR(42)     NOT NULL,
    amount            NUMERIC(18, 6)  NOT NULL,
    tx_hash           VARCHAR(66),
    status            VARCHAR(10)     NOT NULL DEFAULT 'pending',
    trigger_type      VARCHAR(10)     NOT NULL DEFAULT 'manual',
    error_message     TEXT,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_payroll_employer   ON payroll_logs(employer_address);
CREATE INDEX idx_payroll_employee   ON payroll_logs(employee_address);
CREATE INDEX idx_payroll_status     ON payroll_logs(status);
CREATE INDEX idx_payroll_created_at ON payroll_logs(created_at DESC);
```

**字段说明**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGSERIAL | 自增主键 |
| employer_address | VARCHAR(42) | 雇主钱包地址 |
| employee_address | VARCHAR(42) | 员工钱包地址 |
| amount | NUMERIC(18,6) | 本次发薪金额（USDC）|
| tx_hash | VARCHAR(66) | 链上交易哈希（0x + 64位，可为空，失败时无 hash）|
| status | VARCHAR(10) | 发薪状态：`pending` / `success` / `failed` |
| trigger_type | VARCHAR(10) | 触发方式：`manual`（手动）/ `cron`（定时）|
| error_message | TEXT | 失败原因（status = failed 时记录）|
| created_at | TIMESTAMPTZ | 发薪触发时间 |
| updated_at | TIMESTAMPTZ | 状态最后更新时间 |

**GORM 模型定义（Go）**

```go
type PayrollLog struct {
    ID              uint64          `gorm:"primaryKey;autoIncrement" json:"id"`
    EmployerAddress string          `gorm:"type:varchar(42);not null;index" json:"employer_address"`
    EmployeeAddress string          `gorm:"type:varchar(42);not null;index" json:"employee_address"`
    Amount          decimal.Decimal `gorm:"type:numeric(18,6);not null" json:"amount"`
    TxHash          string          `gorm:"type:varchar(66)" json:"tx_hash"`
    Status          string          `gorm:"type:varchar(10);not null;default:pending" json:"status"`
    TriggerType     string          `gorm:"type:varchar(10);not null;default:manual" json:"trigger_type"`
    ErrorMessage    string          `gorm:"type:text" json:"error_message,omitempty"`
    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}
```

**status 状态流转**

```
pending → success   发薪交易上链确认
pending → failed    合约调用失败 / Gas 不足 / Allowance 不足
```

---

## 数据库初始化

### GORM AutoMigrate（Go）

```go
func InitDB(db *gorm.DB) error {
    return db.AutoMigrate(
        &Employee{},
        &PayrollLog{},
    )
}
```

### 环境变量配置

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=chainpay
DB_PASSWORD=your_password
DB_NAME=chainpay_db
DB_SSLMODE=disable
```

### 连接代码（Go）

```go
import (
    "fmt"
    "os"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

func NewDB() (*gorm.DB, error) {
    dsn := fmt.Sprintf(
        "host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
        os.Getenv("DB_HOST"),
        os.Getenv("DB_PORT"),
        os.Getenv("DB_USER"),
        os.Getenv("DB_PASSWORD"),
        os.Getenv("DB_NAME"),
        os.Getenv("DB_SSLMODE"),
    )
    return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}
```

---

## ER 图

```
employees
  ├── id              PK
  ├── employer_address
  ├── wallet_address  UNIQUE
  ├── name
  ├── nickname
  ├── salary_amount
  ├── pay_frequency
  ├── has_rules
  ├── next_pay_date
  ├── created_at
  └── updated_at

payroll_logs
  ├── id              PK
  ├── employer_address  → (逻辑关联 employees.employer_address)
  ├── employee_address  → (逻辑关联 employees.wallet_address)
  ├── amount
  ├── tx_hash
  ├── status
  ├── trigger_type
  ├── error_message
  ├── created_at
  └── updated_at
```

> 两表之间为逻辑关联，不设外键约束，避免删除员工时级联影响历史发薪记录。

---

## 常用查询

### 查询所有待发薪员工（Cron 使用）

```go
var employees []Employee
db.Where(
    "next_pay_date <= ? AND has_rules = ?",
    time.Now().UTC(), true,
).Find(&employees)
```

### 查询雇主的员工列表

```go
var employees []Employee
db.Where("employer_address = ?", employerAddress).
    Order("created_at DESC").
    Find(&employees)
```

### 创建发薪记录

```go
log := PayrollLog{
    EmployerAddress: employerAddress,
    EmployeeAddress: employeeAddress,
    Amount:          amount,
    Status:          "pending",
    TriggerType:     "cron",
}
db.Create(&log)
```

### 更新发薪状态

```go
// 成功
db.Model(&PayrollLog{}).
    Where("id = ?", logID).
    Updates(map[string]interface{}{
        "status":  "success",
        "tx_hash": txHash,
    })

// 失败
db.Model(&PayrollLog{}).
    Where("id = ?", logID).
    Updates(map[string]interface{}{
        "status":        "failed",
        "error_message": errMsg,
    })
```

---

## 安装依赖

```bash
go get gorm.io/gorm
go get gorm.io/driver/postgres
go get github.com/shopspring/decimal  # USDC 金额精度处理
```

---

*本文档为黑客松 MVP 版本，仅包含核心表结构。生产版本需增加数据备份、审计日志等机制。*
