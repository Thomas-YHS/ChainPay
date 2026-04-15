# ChainPay Frontend

ChainPay 前端是一个 Web3 跨链薪资管理界面，基于 React + Vite 构建，负责以下核心体验：
- 雇主管理员工、授权 USDC、预览并执行发薪路由
- 员工连接钱包、验证身份、写入接收规则
- 展示发薪记录与链上交易链接

## 技术栈
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4
- wagmi + RainbowKit
- Li.Fi SDK
- Zustand

## 启动与构建
```bash
npm install
npm run dev
npm run build
```

开发默认地址：`http://localhost:5173`

## 设计系统（已落地）

本项目已从旧版 Dark Web3 原型迁移为“浅色数据看板 + 深色模式预留”的统一设计体系。

### Token 单一来源
- 位置：[src/styles/tokens](src/styles/tokens)
- 覆盖：颜色、字体、间距、圆角、阴影、动效

核心文件：
- [src/styles/tokens/colors.ts](src/styles/tokens/colors.ts)
- [src/styles/tokens/typography.ts](src/styles/tokens/typography.ts)
- [src/styles/tokens/spacing.ts](src/styles/tokens/spacing.ts)
- [src/styles/tokens/radius.ts](src/styles/tokens/radius.ts)
- [src/styles/tokens/shadows.ts](src/styles/tokens/shadows.ts)
- [src/styles/tokens/motion.ts](src/styles/tokens/motion.ts)

### Tailwind 变量映射
- 配置文件：[tailwind.config.ts](tailwind.config.ts)
- 颜色采用 CSS 变量驱动，可直接响应主题切换

### 全局样式基线
- 文件：[src/index.css](src/index.css)
- 内容：
  - 全局字体（Outfit + JetBrains Mono）
  - Dot-grid 画布背景
  - 语义 CSS 变量（light/dark）
  - 卡片/壳层/焦点态通用规则

## 双主题机制（浅色/深色）

### 主题提供器
- 文件：[src/features/shared/components/ThemeProvider.tsx](src/features/shared/components/ThemeProvider.tsx)

行为规则：
- 首次进入：跟随系统主题
- 用户手动切换后：写入本地偏好并固定
- 用户未手动固定时：系统主题变化会自动同步

### 主题切换入口
- 顶部导航按钮在：[src/features/shared/components/TopNav.tsx](src/features/shared/components/TopNav.tsx)

### RainbowKit 主题联动
- 入口接线在：[src/main.tsx](src/main.tsx)
- RainbowKit 会随当前主题动态切换 light/dark 外观

## 目录说明
```text
src/
  features/
    employer/
    employee/
    shared/
      components/
      hooks/
  pages/
  styles/
    tokens/
  main.tsx
  routes.tsx
  store.ts
  theme.ts
```

## 开发约束（UI 相关）
- 新增样式优先使用 token 与 Tailwind 语义类
- 避免新增硬编码颜色字面量
- 组件内避免回退为大段内联样式
- 主流程页面至少保持以下语义一致：
  - `brand` 只用于主操作强调
  - `status` 仅用于状态表达
  - `surface` 与 `border` 负责结构层次

## 验收建议
每次 UI 改动后建议执行：
```bash
npm run build
```

并手动检查：
- 浅色/深色切换是否正确
- 钱包弹窗与站点主题是否一致
- 雇主端/员工端是否视觉统一
