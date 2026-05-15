# 星坞框架设计 — SDK 轻量组件

> 本文档聚焦 **SDK（轻量插件）** 的设计、开发规范与 UI 组件能力。
> 万星入坞，一壳相承。
>
> 配套文档：[主应用](./Xingwu框架设计-主应用.md) · [子应用](./Xingwu框架设计-子应用.md)

---

## 一、SDK 定位

SDK 是星坞框架中的**轻量插件形态**，不占独立路由段，可纯逻辑，也可提供 UI 组件供宿主渲染。

### 1.1 App vs SDK 对比

| 维度 | App（子应用） | SDK（轻量插件） |
|-----|-------------|---------------|
| **路由** | 拥有路由段（如 `/product/*`） | 无独立路由段，不参与路由分发 |
| **UI** | 渲染完整页面/视图 | 可纯逻辑（鉴权守卫），也可提供 UI 组件供宿主渲染（区域选择器、审计日志面板） |
| **生命周期** | 完整 `mount → update → unmount` | `activate → deactivate` |
| **状态** | 可拥有独立状态树 | 通常只消费/提供共享状态 |
| **加载时机** | 路由匹配时按需加载 | 按需加载或预加载 |
| **独立开发** | 可独立启动开发服务器 | 通常在主应用内调试 |
| **示例** | 商品管理台、订单管理 | 区域选择器（含 UI）、鉴权守卫（纯逻辑）、审计日志（含 UI） |

### 1.2 SDK 的两种形态

```
┌───────────────────────────────────────────────────────────────┐
│                     SDK 形态光谱                               │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  纯逻辑                       含 UI 组件                       │
│  ◄──────────────────────────────────────────────────────►      │
│                                                                │
│  auth-guard     i18n-provider    region-selector    audit-log  │
│  鉴权拦截       翻译包           区域选择器+下拉     审计日志面板 │
│  (无 UI)        (无 UI)         (逻辑+UI)          (逻辑+UI)   │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

- **纯逻辑 SDK**：仅提供 API/拦截器/数据转换，不渲染任何 UI
- **含 UI SDK**：除 API 外还通过 `getComponents()` 暴露 React 组件，由宿主决定渲染位置

> **U-8 已决**：SDK **可包含 UI 组件**。通过 `uiComponents` 声明组件列表与挂载 slot；`getComponents()` 暴露组件；宿主通过 `SdkRegistry.getComponent()` 或插槽渲染消费。

**设计原理 — 为什么 SDK 需要 UI 能力**：

传统微前端方案中，插件只能是纯逻辑或纯页面，无法表达「提供可复用 UI 片段」的需求。实际业务中，区域选择器、审计日志面板等能力既不属于某个特定子应用，又需要渲染 UI。如果强制归入子应用，会引入不必要的路由和加载开销；如果复制到每个子应用，则违背 DRY 原则。

SDK 的 UI 能力解决了这一矛盾：SDK 声明自己提供哪些 UI 组件和期望的挂载位置（slot），宿主（壳层或子应用）决定在哪里渲染。这实现了 **UI 的提供与消费分离**——SDK 知道「我能提供什么」，宿主知道「我需要在哪里放什么」。

---

## 二、插件描述符（SDK 专有字段）

> 完整类型定义见 [`packages/types/src/plugin.ts`](../packages/types/src/plugin.ts)
>
> 纯逻辑 SDK 配置示例见 [`packages/sdks/auth-guard/plugin.config.ts`](../packages/sdks/auth-guard/plugin.config.ts)
>
> 含 UI SDK 配置示例见 [`packages/sdks/region-selector/plugin.config.ts`](../packages/sdks/region-selector/plugin.config.ts)

**设计原理 — uiComponents 声明式契约**：

`uiComponents` 数组是 SDK 与宿主之间的**静态 UI 契约**，作用类似 React 的 `propTypes`：

- **声明时绑定**：SDK 在描述符中声明组件名、用途、挂载 slot，壳层据此决定渲染位置——无需运行时协商
- **类型安全桥接**：`propsSchema` 为组件 props 提供 JSON Schema 约束，宿主侧可据此生成 TypeScript 类型和文档
- **样式隔离前置声明**：`styleStrategy` 让壳层在渲染前就知道 SDK 使用哪种样式策略，可以提前准备对应的隔离机制

### `uiComponents` 设计要点

| 字段 | 说明 |
|-----|------|
| `name` | 组件唯一标识，需与 `getComponents()` 返回的 key 对应 |
| `slot` | 声明组件期望的挂载位置，壳层/子应用据此决定渲染位置 |
| `propsSchema` | 组件 props 的约束，便于宿主侧做类型检查与文档生成 |
| `styleStrategy` | 样式隔离策略：`css-modules`（默认零运行时）、`css-in-js`、`shadow-dom`（严格隔离） |

---

## 三、SDK 生命周期

### 生命周期时序

```
┌───────────────────────────────────────────────────────────┐
│                  SDK 生命周期时序                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌───────────┐                                             │
│  │ 注册描述符 │  ← PluginRegistry.register(descriptor)     │
│  └─────┬─────┘                                             │
│        │                                                   │
│        ▼  [预加载 或 按需加载]                              │
│  ┌──────────┐                                              │
│  │ import() │  ← ESM 动态加载 SDK 模块                     │
│  └─────┬────┘                                              │
│        │                                                   │
│        ▼                                                   │
│  ┌──────────┐                                              │
│  │ activate │  ← 初始化：读取配置、注册 API、写入共享状态   │
│  └─────┬────┘                                              │
│        │                                                   │
│        ▼  [宿主调用 getComponents()]                        │
│  ┌──────────────┐                                          │
│  │ getComponents│  ← 返回 UI 组件映射（仅含 UI 的 SDK）    │
│  └─────┬────────┘                                          │
│        │                                                   │
│        ▼  [宿主渲染 UI 组件 / 消费 API]                     │
│  ┌──────────────┐                                          │
│  │  活跃使用中   │  ← API 调用 / UI 组件交互                │
│  └─────┬────────┘                                          │
│        │                                                   │
│        ▼  [SDK 被停用 / 版本替换]                           │
│  ┌───────────┐                                             │
│  │ deactivate│  ← 清理：清除共享状态、移除拦截器             │
│  └───────────┘                                             │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

**设计原理 — SDK 与 App 生命周期的差异**：

SDK 生命周期比 App 简洁（`activate → deactivate` vs `mount → update → unmount`），这是由其定位决定的：

- **无 mount/unmount 语义**：SDK 不拥有 DOM 容器，它的 UI 组件由宿主渲染，因此不需要「挂载到容器」的步骤
- **无 update 语义**：SDK 不参与路由分发，不会因 URL 变化而需要更新
- **activate 包含双重职责**：既初始化 SDK 状态，又发布 API 到 SharedStateBus。这是因为 SDK 的「就绪」定义就是「API 可被消费」

> 生命周期类型定义见 [`packages/types/src/lifecycle.ts`](../packages/types/src/lifecycle.ts)
>
> 生命周期管理器实现见 [`packages/shell/src/lifecycle.ts`](../packages/shell/src/lifecycle.ts)
>
> 含 UI SDK 入口示例见 [`packages/sdks/region-selector/src/index.tsx`](../packages/sdks/region-selector/src/index.tsx)

---

## 四、SDK 上下文（SdkContext）

> 完整类型定义见 [`packages/types/src/context.ts`](../packages/types/src/context.ts)

**设计原理 — SdkContext 的能力裁剪**：

`SdkContext` 是 `AppContext` 的**受约束子集**，有意缺失了路由、SDK 引用、网络请求和权限检查等能力。这种裁剪基于最小权限原则：

- **无路由能力**：SDK 不参与路由分发，不应干预导航行为
- **无 SDK 嵌套引用**：`ctx.sdk` 不存在于 `SdkContext`，避免 SDK 之间形成任意依赖图（SDK A 引用 SDK B，B 又引用 A），导致循环加载
- **无网络请求**：SDK 的数据获取应通过 API 封装或由宿主注入，而非直接使用 `ctx.infra.net`，避免 SDK 产生不可控的网络行为
- **无权限检查**：权限是 App 层面的关注点，SDK 不应自行决定访问控制

### SdkContext vs AppContext 对比

| 能力 | AppContext | SdkContext |
|-----|-----------|-----------|
| 描述符 | ✅ | ✅ |
| 配置中心 | ✅ | ✅ |
| 共享状态 | ✅ | ✅ |
| 路由 | ✅ `router` | ❌ 无路由 |
| SDK 引用 | ✅ `sdk` | ❌ 避免循环依赖 |
| 网络请求 | ✅ `infra.net` | ❌ 需通过 API 封装 |
| 权限检查 | ✅ `infra.permission` | ❌ |
| 监控 | ✅ `infra.monitor` | ✅ `infra.monitor` |
| 国际化 | ✅ `infra.i18n` | ✅ `infra.i18n` |
| 渲染容器 | ✅ `container` | ❌ 无独立容器 |
| UI 能力 | ❌ | ✅ `ui`（仅含 UI 的 SDK） |

---

## 五、SDK 开发规范

### 5.1 SDK 标准结构

#### 纯逻辑 SDK

```
packages/sdks/auth-guard/
├── package.json
├── tsconfig.json
├── vite.config.ts            # lib 模式构建
├── src/
│   ├── index.ts              # 入口：导出 SdkLifecycle
│   ├── api.ts                # 对外暴露的 API
│   └── i18n/
│       ├── zh.json
│       └── en.json
└── plugin.config.ts
```

#### 含 UI 组件的 SDK

```
packages/sdks/region-selector/
├── package.json
├── tsconfig.json
├── vite.config.ts            # lib 模式构建
├── src/
│   ├── index.tsx             # 入口：导出 SdkLifecycle + 公共 API + UI 组件
│   ├── api.ts                # 对外暴露的 API
│   ├── components/           # UI 组件
│   │   ├── RegionPicker.tsx
│   │   ├── RegionPicker.module.css
│   │   ├── RegionBreadcrumb.tsx
│   │   └── RegionBreadcrumb.module.css
│   └── i18n/
│       ├── zh.json
│       └── en.json
└── plugin.config.ts
```

### 5.2 入口文件

#### 纯逻辑 SDK（无 UI）

纯逻辑 SDK 的入口只需实现 `activate` 和 `deactivate`。`activate` 负责初始化并发布 API 到 SharedStateBus，`deactivate` 负责清理。

> 纯逻辑 SDK 入口示例见 [`packages/sdks/auth-guard/src/index.ts`](../packages/sdks/auth-guard/src/index.ts)

#### 含 UI 组件的 SDK

含 UI 的 SDK 额外实现 `getComponents(ctx)`，返回组件映射表。key 需与 `PluginDescriptor.uiComponents[].name` 一一对应。

**设计原理 — API 发布与 UI 暴露的分离**：

SDK 的 API 通过 `SharedStateBus.setState('{name}.api', api)` 发布，UI 组件通过 `getComponents()` 暴露。这两条路径的时序是不同的：

- **API 发布**在 `activate` 内完成，消费者通过 `SdkRegistry.get()` 或 `SharedStateBus.subscribe()` 获取
- **UI 组件暴露**在 `activate` 之后由 `LifecycleManager` 调用 `getComponents()` 完成，消费者通过 `SdkRegistry.getComponent()` 获取

这种分离使得纯逻辑 SDK 不需要实现 `getComponents()`，而含 UI 的 SDK 可以在 `getComponents()` 中安全地使用已初始化的状态（因为 `activate` 已完成）。

> 含 UI SDK 入口示例见 [`packages/sdks/region-selector/src/index.tsx`](../packages/sdks/region-selector/src/index.tsx)

### 5.3 插件配置

> 纯逻辑 SDK 配置示例见 [`packages/sdks/auth-guard/plugin.config.ts`](../packages/sdks/auth-guard/plugin.config.ts)
>
> 含 UI SDK 配置示例见 [`packages/sdks/region-selector/plugin.config.ts`](../packages/sdks/region-selector/plugin.config.ts)

---

## 六、SDK UI 组件机制详解

### 6.1 组件声明 → 注册 → 渲染流程

```
┌──────────────────────────────────────────────────────────────────┐
│  SDK 侧                               宿主侧                    │
│                                                                    │
│  plugin.config.ts                     Shell 启动                  │
│  ├─ uiComponents[]  ──────────────▶  PluginRegistry.register()   │
│  │  声明组件名+slot                  ↓                            │
│  │                                   SdkRegistry.has() 检查       │
│  │                                   ↓                            │
│  │  index.tsx                         SdkRegistry.load()          │
│  │  ├─ getComponents()  ──────────▶  resolve → activate          │
│  │  │  返回 React 组件              ↓                            │
│  │  │                                SdkRegistry.getComponent()  │
│  │  │                                ↓                            │
│  │  │                                宿主渲染：                   │
│  │  │                                ├─ App: <RegionPicker />    │
│  │  │                                └─ Shell: slot 自动渲染     │
│  └─ styleStrategy                    ↓                            │
│     指定样式隔离方式                   CSS Modules / Shadow DOM   │
└──────────────────────────────────────────────────────────────────┘
```

**设计原理 — 声明式 slot 与显式消费**：

SDK UI 组件的挂载采用「声明 slot → 宿主消费」的二级模式，而非「SDK 自行挂载」。这是基于两个考量：

1. **宿主控制权**：SDK 不应决定自己的 UI 出现在页面的哪个位置，这是宿主（壳层或子应用）的布局职责。`slot` 字段只是 SDK 的「建议」，宿主可以选择忽略或重新映射
2. **可替换性**：同一个 slot 可以被多个 SDK 声明（如 `header-slot` 可同时放置 RegionPicker 和通知铃铛），宿主决定渲染顺序和条件

### 6.2 宿主消费 SDK UI 组件的两种方式

**方式一：子应用显式引用**

子应用通过 `ctx.sdk.getComponent(sdkName, componentName)` 获取 SDK 组件，按需渲染在子应用自己的 UI 树中。这种方式适用于子应用需要精细控制 SDK 组件位置和 props 的场景。

**方式二：Shell 插槽自动渲染**

壳层在布局组件中预留 slot 位置（如 `header-slot`、`breadcrumb`），自动渲染所有声明了该 slot 的 SDK 组件。这种方式适用于全局性 UI 片段（如 Header 中的区域选择器），不需要子应用主动消费。

> Shell 插槽实现见 [`packages/shell/src/layout/ShellHeader.tsx`](../packages/shell/src/layout/ShellHeader.tsx)（header-slot）
>
> 面包屑插槽实现见 [`packages/shell/src/layout/BreadcrumbSlot.tsx`](../packages/shell/src/layout/BreadcrumbSlot.tsx)（breadcrumb）

### 6.3 样式隔离策略

| 策略 | 适用场景 | 优点 | 缺点 |
|-----|---------|------|------|
| `css-modules`（默认） | 大多数场景 | 零运行时开销、构建时哈希 | 全局选择器（如 body）需注意 |
| `css-in-js` | 需要主题变量注入的场景 | 运行时动态、与宿主主题集成 | 运行时开销 |
| `shadow-dom` | 需要严格样式隔离的场景 | 完全隔离、无冲突 | 事件冒泡需处理、表单组件兼容性 |

**设计原理 — 样式隔离的渐进策略**：

样式隔离不是一个技术问题，而是**信任与成本的权衡**。L1 受信的内部插件使用 CSS Modules 即可——构建时哈希足以避免无意冲突；L2 半信插件可能需要 CSS-in-JS 来确保与宿主主题的集成；L3 不信插件则必须 Shadow DOM 才能保证完全隔离。框架不强制所有 SDK 使用最严格的隔离策略，而是通过 `styleStrategy` 让 SDK 自行声明，宿主可以选择覆盖。

### 6.4 SDK 通知宿主重新渲染

当 SDK 内部状态变更需要刷新 UI 时，通过 `ctx.ui.requestRerender()` 通知宿主重新渲染指定组件。

**设计原理 — 被动渲染 vs 主动推送**：

SDK 组件的渲染权在宿主，SDK 不能自行更新 DOM。但 SDK 内部状态变化（如区域列表从远程刷新后）需要触发 UI 更新。`requestRerender` 是一个**轻量通知机制**：

- SDK 不直接操作 React state，而是通知宿主「某个组件需要重新渲染」
- 宿主决定如何响应（重新调用 `getComponent()`、触发 state 更新、或忽略）
- 这种模式避免了 SDK 需要持有 React 上下文（如 `setState`）的问题

> SDK UI 组件实现示例见 [`packages/sdks/region-selector/src/components/RegionPicker.tsx`](../packages/sdks/region-selector/src/components/RegionPicker.tsx) 和 [`packages/sdks/region-selector/src/components/RegionBreadcrumb.tsx`](../packages/sdks/region-selector/src/components/RegionBreadcrumb.tsx)

---

## 七、SdkRegistry 消费侧 API

> `SdkRegistry` 是 `PluginRegistry` 的门面（U-2 已决），仅暴露 SDK 消费侧 API。

**设计原理 — 门面模式的消费侧裁剪**：

`SdkRegistry` 将 `PluginRegistry` 的全量 API 裁剪为 SDK 消费者需要的子集，隐藏了 `register`、`unregister`、`findByRoute` 等与 SDK 无关的方法。这使得 SDK 的消费接口保持简洁，同时防止消费者误用不属于 SDK 域的方法。

关键 API 的语义：

| 方法 | 语义 | 数据来源 |
|------|------|---------|
| `has(name)` | SDK 是否已注册 | 读取 `PluginRegistry` 描述符 |
| `get<T>(name)` | 获取已激活 SDK 的 API | 读取 `SharedStateBus` 的 `{name}.api` |
| `load<T>(name)` | 加载并激活 SDK | 委托 `PluginRegistry.resolve` + `LifecycleManager.activateSdk` |
| `preload(names)` | 批量预加载 | 循环调用 `load` |
| `reload(name)` | 重载 SDK（灰度切换） | `deactivate → activate`，重建组件缓存 |
| `getComponent(sdkName, componentName)` | 获取 SDK UI 组件 | 从 `componentCache` 或 `PluginInstance.uiComponents` 读取 |

> 完整实现见 [`packages/shell/src/sdk-registry.ts`](../packages/shell/src/sdk-registry.ts)

---

## 八、SDK Vite 构建配置

SDK 构建配置与子应用类似，核心决策是将 `react`/`react-dom` 标为 `external`，由壳层 Import Maps 提供。

**关键点**：

- SDK 构建同样将 `react`/`react-dom` 标为 `external`，由壳层 Import Maps 提供
- 含 UI 的 SDK 需要引入 `@vitejs/plugin-react`（JSX 转换）
- CSS Modules 默认支持，无需额外配置
- `@xingwu/vite-plugin` 自动处理 `plugin.config.ts` 的读取与注入

> 纯逻辑 SDK 构建配置示例见 [`packages/sdks/auth-guard/vite.config.ts`](../packages/sdks/auth-guard/vite.config.ts)
>
> 含 UI SDK 构建配置示例见 [`packages/sdks/region-selector/vite.config.ts`](../packages/sdks/region-selector/vite.config.ts)

---

*文档版本：2.0.0*
*最后更新：2026-05-15*
