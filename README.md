# 星坞 Xingwu

> 万星入坞，一壳相承。

星坞是一个面向现代浏览器的**企业级插件化前端框架**，采用 **壳层 + 子应用 + SDK** 三层插件体系，解决大规模业务系统中多团队协作、独立部署与运行时动态扩展的核心矛盾。

---

## 为什么需要星坞

企业级前端应用在规模化演进中，普遍面临以下挑战：

| 痛点 | 星坞的解法 |
|------|-----------|
| **巨石应用难维护** — 单仓库数百万行代码，构建慢、冲突多 | 壳层只加载当前业务，其余按需拉取；子应用与 SDK 独立构建部署 |
| **跨团队协作难** — 共用仓库，发布互相阻塞 | 三层插件体系分层解耦，各团队独立开发、独立发版 |
| **运行时变更难** — 路由/重定向/灰度需要重新发版 | 配置驱动架构，运行时配置中心支持灰度、A/B、动态路由 |
| **共享状态失控** — `window` 全局变量满天飞，隐式依赖 | 受控 SharedStateBus，命名空间 key + 写入审计 |
| **React 多实例崩溃** — 各子系统各打包一份 React | Import Maps 统一模块映射，保证全局单实例 |
| **插件能力边界模糊** — 谁能做什么全靠约定 | AppContext / SdkContext 显式能力边界，最小权限原则 |

---

## 设计理念

### 插件即契约

插件与壳层之间通过 **`PluginDescriptor`（插件描述符）** 建立静态契约。描述符声明身份、能力与依赖，但不包含运行时逻辑。壳层在不加载模块的情况下即可完成路由分发、权限校验与菜单生成——**先读契约，再决定是否加载**。

### 显式优于隐式

子应用通过 `AppContext`、SDK 通过 `SdkContext` 与框架交互，这是唯一合法通道。不需要的能力（如 SDK 不持有路由能力）在类型层面即不可见，而非靠文档约定。上下文即能力边界。

### 配置驱动

插件入口地址、路由规则、灰度策略等均由运行时配置中心管理，而非编译时硬编码。这使得灰度发布、秒级回滚、独立部署成为配置中心的原生能力，无需重新构建。

### 受控共享

跨插件状态共享通过 `SharedStateBus` 实现，强制命名空间 key（`pluginName.stateKey`），写入操作自动审计。避免全局变量污染与隐式依赖，同时保留 EventBus 的灵活性。

### 权限前置

权限校验在模块加载之前执行（U-6）——壳层只读描述符中的权限声明即可决定是否 `import()`。敏感内容不进入浏览器内存，也不浪费网络带宽与 JS 解析开销。

---

## 三层插件体系

```
┌─────────────────────────────────────────────────────────────┐
│                        壳层 Shell                           │
│  路由分发 · 插件注册表 · 配置中心 · 共享状态 · 生命周期编排    │
│  基础设施（监控 / 国际化 / 网络 / 权限）                      │
├──────────────┬──────────────────────────────────────────────┤
│   子应用 App  │              SDK 轻量插件                     │
│              │                                              │
│ · 拥有路由段  │ · 无独立路由段                                │
│ · 完整页面树  │ · 可纯逻辑（鉴权守卫）                        │
│ · mount/unmount │ 也可含 UI 组件供宿主渲染（区域选择器）       │
│ · 可独立开发  │ · activate/deactivate                        │
│              │ · 按需或预加载                                │
└──────────────┴──────────────────────────────────────────────┘
```

| 维度 | 壳层 Shell | 子应用 App | SDK |
|------|-----------|-----------|-----|
| **职责** | 初始化、路由、注册表、配置 | 独立业务模块 | 轻量功能插件 |
| **路由** | 全局分发 | 拥有路由段 | 无 |
| **UI** | 布局框架 | 完整页面 | 可无 / 可提供组件 |
| **生命周期** | — | mount → update → unmount | activate → deactivate |
| **上下文** | — | AppContext | SdkContext（AppContext 子集） |
| **详细设计** | [主应用文档](./docs/Xingwu框架设计-主应用.md) | [子应用文档](./docs/Xingwu框架设计-子应用.md) | [SDK 文档](./docs/Xingwu框架设计-SDK轻量组件.md) |

### 壳层（Shell）

壳层是框架的运行时基础设施，提供插件注册表、配置中心、共享状态总线、生命周期管理器与基础设施（监控、国际化、网络、权限）。壳层不包含业务逻辑，只负责**编排与管控**。

核心模块：

| 模块 | 职责 |
|------|------|
| `PluginRegistry` | 统一插件注册表，App + SDK 的描述符与模块缓存均由其管理 |
| `ConfigCenter` | 类型安全的运行时配置管理，Zod Schema 校验 + 命名空间作用域隔离 |
| `SharedStateBus` | 受控跨插件状态共享，命名空间 key + 写入审计 |
| `LifecycleManager` | 插件挂载/更新/卸载流程编排，路由守卫 |
| `SdkRegistry` | PluginRegistry 门面，仅暴露 SDK 消费侧 API |

> 详见 [星坞框架设计 — 主应用](./docs/Xingwu框架设计-主应用.md)

### 子应用（App）

子应用是拥有独立路由段的完整业务模块。通过 `AppContext` 消费壳层能力（路由、配置、SDK、基础设施），在壳层分配的路由段内完全自治。支持独立开发服务器与联调模式。

> 详见 [星坞框架设计 — 子应用](./docs/Xingwu框架设计-子应用.md)

### SDK 轻量插件

SDK 是不占路由段的功能模块，支持纯逻辑（如鉴权守卫）和含 UI 组件（如区域选择器）两种形态。通过 `SdkContext` 消费壳层能力，遵循最小权限原则——无路由、无网络、无 SDK 嵌套引用。UI 组件通过 `uiComponents` 声明式契约 + `slot` 机制注入宿主。

> 详见 [星坞框架设计 — SDK 轻量组件](./docs/Xingwu框架设计-SDK轻量组件.md)

---

## 项目结构

```
xingwu-ops-fe/
├── packages/
│   ├── types/                     # @xingwu/types — 共享类型定义
│   ├── vite-plugin/               # @xingwu/vite-plugin — 构建插件
│   ├── xingwu-cli/                # xingwu-cli — 脚手架工具
│   ├── shell/                     # @xingwu/shell — 主应用壳层
│   ├── apps/                      # 子应用
│   │   └── product/               # 商品管理（示例）
│   └── sdks/                      # SDK 轻量插件
│       ├── auth-guard/            # 鉴权守卫（纯逻辑 SDK 示例）
│       └── region-selector/       # 区域选择器（含 UI SDK 示例）
├── styles/                        # 共享样式（Tailwind 基础）
├── docs/                          # 框架设计文档
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### 依赖方向

```
shell → types          apps/sdks → types（通过 Shell Context API 交互）
                                 子应用 ↔ SDK（通过 SharedStateBus / SdkRegistry 通信）
```

**单向依赖，禁止反向**。子应用与 SDK 不直接 import 对方模块。

---

## 快速开始

### 环境要求

- Node.js ≥ 18.0.0
- pnpm ≥ 9.0.0

### 安装与启动

```bash
# 安装依赖
pnpm install

# 构建前置依赖
pnpm build:types
pnpm build:vite-plugin

# 启动主应用开发服务器（端口 3000）
pnpm dev

# 启动子应用独立开发
cd packages/apps/product && pnpm dev    # 端口 5174

# 启动 SDK 独立开发
cd packages/sdks/auth-guard && pnpm dev       # 端口 5175
cd packages/sdks/region-selector && pnpm dev  # 端口 5176
```

### 构建命令

```bash
pnpm build              # 构建所有包
pnpm build:shell        # 仅构建壳层
pnpm build:product      # 仅构建商品子应用
pnpm build:auth-guard   # 仅构建鉴权 SDK
pnpm build:region-selector  # 仅构建区域选择器 SDK
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript 5 | UI 与类型系统 |
| Vite 5 | 构建（ESM 原生加载） |
| Import Maps | 浏览器级模块共享 |
| Zod | 运行时配置 Schema 校验 |
| pnpm Monorepo | 多包管理与依赖隔离 |
| Tailwind CSS | 共享样式基础 |

---

## 示例说明

### product — 子应用示例

完整的商品管理子应用，拥有独立路由段 `/product/*`：
- 商品列表页（表格、状态标签、刷新）
- 商品详情页（参数读取、信息展示）
- 与 SDK 的集成（消费 region-selector API）

### auth-guard — 纯逻辑 SDK 示例

鉴权守卫 SDK，无 UI，提供 Session 守卫、Owner 守卫与综合权限检查链。

### region-selector — 含 UI SDK 示例

区域选择器 SDK，包含 UI 组件：
- `RegionSelectorApi`：区域列表查询、当前区域设置
- `RegionPicker`：下拉选择器（slot: header-slot）
- `RegionBreadcrumb`：面包屑导航（slot: breadcrumb）

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [框架设计 — 主应用](./docs/Xingwu框架设计-主应用.md) | Shell 架构、核心模块、权限安全、构建体系 |
| [框架设计 — 子应用](./docs/Xingwu框架设计-子应用.md) | App 生命周期、AppContext、开发规范 |
| [框架设计 — SDK 轻量组件](./docs/Xingwu框架设计-SDK轻量组件.md) | SDK 形态、UI 组件机制、样式隔离 |
| [AI 编码规范](./AGENTS.md) | AI/自动化代码修改与 Code Review 硬性约束 |

---

## 许可

MIT
