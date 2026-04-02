# ADR-001: 合约开发框架选择 — Hardhat vs Foundry

**Status:** Accepted
**Date:** 2026-04-02
**Deciders:** 独立开发者（Java 背景，Go 初学者，Vibe Coding）

---

## Context

ChainPay 需要开发一个 Solidity 智能合约，部署在 Base Mainnet。开发者：
- 有 Java 背景，无 Solidity 经验
- 使用 Vibe Coding（AI 辅助）独立开发
- 时间约 1 周，Day 2 需要完成合约开发并部署
- 合约逻辑相对简单（约 150 行 Solidity）

---

## Options Considered

### Option A: Hardhat

| 维度 | 评估 |
|---|---|
| 语言 | JavaScript / TypeScript |
| 上手难度 | 低 |
| AI 辅助质量 | 高（资料最多，Claude/GPT 熟悉）|
| 文档和教程 | 极丰富 |
| 测试语言 | JS/TS（Mocha/Chai）|
| 编译速度 | 中等 |
| Base 部署支持 | ✅ 完善 |

**优点：**
- 教程最多，Stack Overflow / GitHub 覆盖最广
- AI 辅助代码质量最好（训练数据多）
- 测试用 JavaScript 写，无需学新语言
- OpenZeppelin 官方示例都用 Hardhat
- 插件生态丰富（hardhat-verify、hardhat-deploy）

**缺点：**
- 编译速度比 Foundry 慢
- 测试需要写 JS，和主项目语言不统一

---

### Option B: Foundry

| 维度 | 评估 |
|---|---|
| 语言 | Rust 工具链 |
| 上手难度 | 中等 |
| AI 辅助质量 | 中等（资料较少）|
| 文档和教程 | 较少，且多为英文进阶内容 |
| 测试语言 | Solidity（forge test）|
| 编译速度 | 极快 |
| Base 部署支持 | ✅ 完善 |

**优点：**
- 编译和测试速度极快
- 测试用 Solidity 写，和合约语言一致
- 更现代，专业合约开发者偏好

**缺点：**
- 教程相对少，中文资料更少
- AI 对 Foundry 的代码生成质量不如 Hardhat
- 需要安装 Rust 工具链，环境搭建稍复杂
- 对 Vibe Coding 不友好（遇到问题更难 Google 到答案）

---

## Trade-off 分析

```
核心矛盾：开发速度 vs 工具现代性

Foundry 更快更现代，但学习曲线 + AI 辅助质量下降
会抵消它的速度优势。

Hardhat 资料更多，AI 代码质量更好，
对于 1 周黑客松 + 新手来说是更安全的选择。

合约逻辑简单（~150行），不存在"Hardhat 性能瓶颈"的场景。
```

---

## 决定

**选择 Hardhat。**

理由：
1. **Vibe Coding 友好**：AI 对 Hardhat 生成的代码质量更高，遇到问题更容易找到答案
2. **时间约束**：1 周内交付，不能花时间踩 Foundry 的坑
3. **合约体量小**：编译速度差异对 ~150 行合约无实际影响
4. **OpenZeppelin 集成**：官方示例和文档都以 Hardhat 为主

---

## Consequences

- ✅ 合约开发更顺畅，AI 辅助质量有保证
- ✅ 部署脚本、验证脚本参考资料丰富
- ✅ hardhat-verify 一键在 Basescan 验证合约
- ⚠️ 测试用 JavaScript 写，需要同时维护 JS 和 Solidity
- ⚠️ 未来如果合约规模扩大，可考虑迁移到 Foundry

---

## Action Items

- [x] 决策确定：使用 Hardhat
- [ ] Day 2：初始化 Hardhat 项目
- [ ] Day 2：安装 OpenZeppelin 依赖
- [ ] Day 2：编写 ChainPay 合约并部署到 Base
