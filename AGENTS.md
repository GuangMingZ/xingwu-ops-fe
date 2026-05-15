# AGENTS.md

AI/自动化代码修改与 Code Review 必须遵守的硬性约束。项目基本信息见 [README.md](./README.md)。

## 1. 项目概述

星坞是一个面向现代浏览器的企业级插件化前端框架，采用 **壳层 + 子应用 + SDK** 三层插件体系。

## 2. 分层边界

项目采用 pnpm Monorepo，按 **壳层 (Shell) → 子应用 (App) → SDK** 三层插件体系组织：

| 包 | 职责 | 约束 |
|------|------|------|
| `packages/types/` | `@xingwu/types` — 共享类型定义 | 纯类型文件，不含运行时代码；所有其他包均可依赖 |
| `packages/vite-plugin/` | `@xingwu/vite-plugin` — 构建插件 | 仅处理构建时逻辑（模块联邦、Import Maps 生成），不含运行时代码 |
| `packages/shell/` | `@xingwu/shell` — 主应用壳层 | 提供插件注册、配置中心、共享状态、生命周期、SDK 门面等运行时基础设施；**禁止**反向依赖子应用或 SDK 的具体实现 |
| `packages/apps/*` | 子应用（如 product） | 通过 `AppContext` 消费 Shell 提供的能力（路由、配置、SDK、基础设施）；独立路由段，**禁止**直接访问 Shell 内部模块 |
| `packages/sdks/*` | SDK 轻量插件（如 auth-guard、region-selector） | 通过 `SdkContext` 消费 Shell 能力；纯逻辑 SDK 无 UI，含 UI 的 SDK 通过 `uiComponents` + `slot` 注入壳层；**禁止**直接访问子应用 |

**依赖方向**：`shell → types`，`apps/sdks → types`（通过 Shell 暴露的 Context API 交互，而非直接 import），单向，**禁止反向依赖**。

**交互方式**：子应用与 SDK 之间通过 `SharedStateBus`（命名空间 key）和 `SdkRegistry`（API 消费）通信，**禁止**直接 import 对方模块。

## 3. 编码红线

- **禁止 `any`**：不得用 `any` / `as any` 绕过类型问题。应使用泛型约束、`satisfies`、`unknown` + 类型守卫等方式。第三方库已有 `any` 除外。

## 4. Bugfix 注释

修复 bug 时必须在修复代码旁注释：触发条件、与正常路径的差异、选择该修复方式的原因。

## 5. 编码规范

- **Import 排序**（`eslint-plugin-simple-import-sort`）：副作用导入 → 第三方包 → 相对路径（`..` 然后 `.`）。
- **命名**：文件 camelCase、类 PascalCase、函数 camelCase、常量 UPPER_SNAKE_CASE、接口 `I` + PascalCase。
- **文件夹结构**：按功能分组，如 `src/components/`、`src/config/`、`src/routes/`、`src/utils/`、`src/constants/`。
- **文件名**：`index.ts` 为入口文件，`*.ts` 为普通文件，`*.tsx` 为 React 组件。
- **单文件控制在 400 行以内**，超过时拆分子模块或抽取辅助函数。
- **纯函数优先**：`utils/` 下必须是无状态无副作用的纯函数；`helpers/` 可有上下文依赖但应保持单一职责。

## 6. 提交前自检

```bash
pnpm run build          # TypeScript 编译检查
npx eslint src/        # Lint 检查
```

## 7. Code Review 检查清单

- [ ] 依赖方向是否正确（无反向依赖，子应用/SDK 不直接 import Shell 内部模块）
- [ ] 子应用与 SDK 是否通过 SharedStateBus / SdkRegistry 通信（而非直接 import）
- [ ] 是否有 `any` / `as any` 绕过类型
- [ ] 单文件是否超过 400 行
