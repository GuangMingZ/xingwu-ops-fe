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
- **含 UI SDK**：除 API 外提供 UI，支持两种互补能力：
  - **自主渲染**：可选实现 `render(container, ctx)` / `unrender(container, ctx)`，由壳层传入 DOM，SDK 自行 `createRoot` 挂载
  - **组件暴露**：通过 `getComponents()` 与具名导出暴露 React 组件，供子应用等宿主显式引用

> **U-8 已决**：SDK **可包含 UI 组件**。通过 `uiComponents` 声明组件列表与挂载 slot；`getComponents()` 暴露组件映射；可选 `render` / `unrender` 实现自主渲染；宿主通过 `SdkRegistry.renderTo()`（壳层插槽）、`getComponent()`（子应用显式引用）或模块具名导出消费。

**设计原理 — 为什么 SDK 需要 UI 能力**：

传统微前端方案中，插件只能是纯逻辑或纯页面，无法表达「提供可复用 UI 片段」的需求。实际业务中，区域选择器、审计日志面板等能力既不属于某个特定子应用，又需要渲染 UI。如果强制归入子应用，会引入不必要的路由和加载开销；如果复制到每个子应用，则违背 DRY 原则。

SDK 的 UI 能力解决了这一矛盾：SDK 声明自己提供哪些 UI 组件和期望的挂载位置（slot）。宿主负责**布局与 DOM 容器**（壳层 `SdkSlotHost` 预留插槽），SDK 负责**渲染逻辑**（`render` 内选择组件、绑定 API、管理 React Root）。这实现了 **布局权与渲染权的分离**——宿主决定「UI 出现在哪」，SDK 决定「插槽里画什么」。

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
| `name` | 组件唯一标识，需与 `getComponents()` 返回的 key 对应；`render` 内按 slot 映射到该组件 |
| `slot` | 声明组件期望的挂载位置；壳层 `SdkSlotHost` 注入 `data-xingwu-slot`，SDK 在 `render` 中读取 |
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
│        ├──────────────────────────────────────┐            │
│        ▼                                      ▼            │
│  ┌──────────────┐                    ┌──────────────┐    │
│  │ getComponents│  ← 缓存组件映射     │ render(dom)  │    │
│  │ (可选)       │    供 getComponent  │ (可选)       │    │
│  └─────┬────────┘                    └─────┬────────┘    │
│        │                                   │              │
│        ▼                                   ▼              │
│  ┌──────────────────────────────────────────────────┐    │
│  │  活跃使用中  ← API 调用 / UI 交互 / requestRerender │    │
│  └─────┬────────────────────────────────────────────┘    │
│        │                                                   │
│        ▼  [插槽卸载 / SDK 停用 / 版本替换]                  │
│  ┌───────────┐     ┌───────────┐                          │
│  │ unrender  │ ──▶ │ deactivate│  ← 清理 API、监听器等     │
│  │ (可选)    │     └───────────┘                          │
│  └───────────┘                                             │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

### SdkLifecycle 方法一览

| 方法 | 必填 | 说明 |
|------|------|------|
| `activate(ctx)` | ✅ | 初始化并发布 API 到 `SharedStateBus`（约定 key：`{name}.api`） |
| `deactivate(ctx)` | ✅ | 清理共享状态与副作用 |
| `onError(error, ctx)` | ❌ | 错误上报 |
| `getComponents(ctx)` | ❌ | 返回 UI 组件映射，供 `SdkRegistry.getComponent()` 与子应用显式引用 |
| `render(container, ctx)` | ❌ | SDK 自主将 UI 渲染到宿主提供的 DOM；容器带 `data-xingwu-slot` |
| `unrender(container, ctx)` | ❌ | 卸载该容器上的 React Root，与 `render` 成对实现 |

**设计原理 — SDK 与 App 生命周期的差异**：

SDK 生命周期比 App 简洁（`activate → deactivate` vs `mount → update → unmount`），这是由其定位决定的：

- **无路由 update 语义**：SDK 不参与路由分发，不会因 URL 变化而触发框架级 `update`
- **容器由宿主提供**：SDK 不声明全局布局，但可通过可选 `render(container)` 在宿主传入的 DOM 上自主挂载 UI（类似子应用 `mount`，但容器分配权在宿主）
- **activate 优先于 render**：`render` 执行时 `activate` 已完成，可安全读取 `{name}.api` 与配置
- **getComponents 与 render 互补**：前者供子应用「拿走组件自己画」；后者供壳层插槽「SDK 自己画进容器」

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
| 渲染容器 | ✅ `container`（子应用 mount） | ❌ 无 `ctx.container`；可选 `render(dom, ctx)` 由宿主传入 DOM |
| UI 能力 | ❌ | ✅ `ui`（`getSlot` / `requestRerender`，仅声明了 `uiComponents` 的 SDK） |

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
│   ├── index.tsx             # 入口：SdkLifecycle（含 render/unrender）+ 具名导出
│   ├── sdkRender.tsx         # 可选：render/unrender 实现（createRoot、插槽映射）
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

含 UI 的 SDK 在 `activate` / `deactivate` 之外，按需实现以下能力（可组合使用）：

| 能力 | 方法 / 导出 | 消费方 |
|------|------------|--------|
| 自主渲染 | `render(container, ctx)`、`unrender(container, ctx)` | 壳层 `SdkSlotHost` → `SdkRegistry.renderTo()` |
| 组件映射 | `getComponents(ctx)` | 子应用 `ctx.sdk.getComponent()` |
| 模块导出 | `export { RegionPicker }` | 其他包直接 import |

约定：

- `getComponents()` 返回的 key 与 `PluginDescriptor.uiComponents[].name` 一一对应
- `render` 内通过 `container.dataset.xingwuSlot` 识别插槽，映射到对应组件（见 [`sdkRender.tsx`](../packages/sdks/region-selector/src/sdkRender.tsx)）
- `render` / `unrender` 须成对实现：在 `unrender` 中 `root.unmount()` 并清理监听器

**入口示例（region-selector）**：

```tsx
const lifecycle: SdkLifecycle = {
  async activate(ctx) {
    const api = new RegionSelectorApi(regions, ctx);
    ctx.sharedState.setState('region-selector.api', api);
  },
  async deactivate(ctx) {
    ctx.sharedState.setState('region-selector.api', undefined);
  },
  getComponents() {
    return { RegionPicker, RegionBreadcrumb };
  },
  render(container, ctx) {
    return renderSdkUi(container, ctx); // 按 data-xingwu-slot 选择组件并 createRoot
  },
  unrender(container) {
    return unrenderSdkUi(container);
  },
};

export default lifecycle;
export { RegionPicker, RegionBreadcrumb, RegionSelectorApi };
```

**设计原理 — API 发布、自主渲染与组件暴露的三条路径**：

| 路径 | 时机 | 消费者 |
|------|------|--------|
| API | `activate` 内写入 `SharedStateBus` | `SdkRegistry.get()` / `SharedStateBus` |
| 自主渲染 | `activate` 后，宿主调用 `renderTo(dom)` | 壳层 `SdkSlotHost` |
| 组件映射 | `activate` 后，`getComponents()` 缓存 | `SdkRegistry.getComponent()`、子应用 JSX |

纯逻辑 SDK 无需实现 `getComponents` / `render`；含 UI 的 SDK 可同时实现 `render`（壳层插槽）与 `getComponents`（子应用复用），互不冲突。

> 含 UI SDK 入口见 [`packages/sdks/region-selector/src/index.tsx`](../packages/sdks/region-selector/src/index.tsx)
>
> 自主渲染实现见 [`packages/sdks/region-selector/src/sdkRender.tsx`](../packages/sdks/region-selector/src/sdkRender.tsx)

### 5.3 插件配置

> 纯逻辑 SDK 配置示例见 [`packages/sdks/auth-guard/plugin.config.ts`](../packages/sdks/auth-guard/plugin.config.ts)
>
> 含 UI SDK 配置示例见 [`packages/sdks/region-selector/plugin.config.ts`](../packages/sdks/region-selector/plugin.config.ts)

---

## 六、SDK UI 组件机制详解

### 6.1 组件声明 → 注册 → 渲染流程

```
┌──────────────────────────────────────────────────────────────────────┐
│  SDK 侧                                    宿主侧                     │
│                                                                       │
│  plugin.config.ts                          Shell 启动                 │
│  ├─ uiComponents[]  ────────────────────▶  PluginRegistry.register()  │
│  │  声明组件名 + slot                     ↓                          │
│  │                                        SdkRegistry.load()         │
│  │                                        resolve → activate         │
│  │  index.tsx                             ↓                          │
│  │  ├─ activate → 发布 {name}.api        SdkRegistry.get()          │
│  │  ├─ getComponents() ────────────────▶ getComponent()  ──▶ App   │
│  │  └─ render(dom) / unrender(dom) ◀───  renderTo() / unrenderFrom()│
│  │       ▲                                ▲                          │
│  │       │                                SdkSlotHost 提供 DOM       │
│  │       │                                + data-xingwu-slot         │
│  └─ styleStrategy                         ShellHeader / Breadcrumb   │
└──────────────────────────────────────────────────────────────────────┘
```

**设计原理 — 布局权与渲染权分离**：

1. **宿主分配 DOM**：壳层通过 `SdkSlotHost` 在布局中预留空容器，并设置 `data-xingwu-slot`，不直接拼装 SDK 的 props
2. **SDK 自主渲染**：`render(container, ctx)` 内读取 slot、绑定 API、`createRoot(container).render(...)`，封装组件选择与状态订阅
3. **可替换性**：同一 slot 可被多个 SDK 声明；宿主决定挂载哪些 `SdkSlotHost`，SDK 决定插槽内渲染哪个组件

### 6.2 宿主消费 SDK UI 的三种方式

| 方式 | 机制 | 适用场景 |
|------|------|---------|
| **一、壳层插槽自主渲染**（推荐） | `SdkSlotHost` → `SdkRegistry.renderTo(sdk, dom, { slot })` → SDK `render(dom, ctx)` | 全局 Header、面包屑等固定插槽 |
| **二、子应用显式引用** | `ctx.sdk.getComponent(sdk, name)` 或 `import { RegionPicker }` | 子应用需自定义位置、props、布局 |
| **三、仅消费 API** | `ctx.sdk.load()` / `SdkRegistry.get()` | 纯逻辑交互，无 UI |

**方式一：壳层插槽自主渲染（`render`）**

壳层布局中放置 `SdkSlotHost`，由 SDK 在传入的 DOM 内完成挂载：

```tsx
// Shell 侧
<SdkSlotHost shell={shell} sdkName="region-selector" slot="header-slot" />
```

```ts
// SdkSlotHost 内部（简化）
await shell.sdkRegistry.renderTo(sdkName, containerEl, { slot });
// → activate → lifecycle.render(container, ctx)
```

> 插槽宿主：[`packages/shell/src/layout/SdkSlotHost.tsx`](../packages/shell/src/layout/SdkSlotHost.tsx)
>
> Header 使用：[`packages/shell/src/layout/ShellHeader.tsx`](../packages/shell/src/layout/ShellHeader.tsx)（`header-slot`）
>
> 面包屑使用：[`packages/shell/src/layout/BreadcrumbSlot.tsx`](../packages/shell/src/layout/BreadcrumbSlot.tsx)（`breadcrumb`）

**方式二：子应用显式引用（`getComponents` / 具名导出）**

子应用通过 `ctx.sdk.getComponent('region-selector', 'RegionPicker')` 获取组件，或直接从 SDK 包 import，自行放入 JSX 树。适用于需要精细控制位置与 props 的场景。

**方式三：仅消费 API**

不渲染 UI，仅调用 `RegionSelectorApi` 等逻辑能力（如商品列表读取当前区域）。

### 6.3 样式隔离策略

| 策略 | 适用场景 | 优点 | 缺点 |
|-----|---------|------|------|
| `css-modules`（默认） | 大多数场景 | 零运行时开销、构建时哈希 | 全局选择器（如 body）需注意 |
| `css-in-js` | 需要主题变量注入的场景 | 运行时动态、与宿主主题集成 | 运行时开销 |
| `shadow-dom` | 需要严格样式隔离的场景 | 完全隔离、无冲突 | 事件冒泡需处理、表单组件兼容性 |

**设计原理 — 样式隔离的渐进策略**：

样式隔离不是一个技术问题，而是**信任与成本的权衡**。L1 受信的内部插件使用 CSS Modules 即可——构建时哈希足以避免无意冲突；L2 半信插件可能需要 CSS-in-JS 来确保与宿主主题的集成；L3 不信插件则必须 Shadow DOM 才能保证完全隔离。框架不强制所有 SDK 使用最严格的隔离策略，而是通过 `styleStrategy` 让 SDK 自行声明，宿主可以选择覆盖。

### 6.4 SDK 通知宿主重新渲染

当 SDK 内部状态变更需要刷新 UI 时，通过 `ctx.ui.requestRerender(componentName)` 通知宿主。

**宿主响应（`SdkSlotHost`）**：

1. `SdkRegistry.onRerender(sdkName, callback)` 收到通知
2. 触发 `renderVersion` 递增，effect 重新执行
3. 先 `unrenderFrom`，再 `renderTo`，由 SDK `render` 重新挂载最新状态

**设计原理**：

- 使用 `render` 的 SDK：通过 `requestRerender` 驱动宿主**整段重跑 render 流程**，SDK 在 `render` 内重新读取 API 并 `root.render(...)`，无需向宿主暴露 React 状态
- 使用 `getComponent` 的子应用：可自行订阅 API 变更后 `setState`，或同样监听共享状态

> `requestRerender` 由 [`packages/shell/src/sdk-registry.ts`](../packages/shell/src/sdk-registry.ts) 的 `buildSdkContext` 注入 `ctx.ui`
>
> 区域变更触发示例见 [`packages/sdks/region-selector/src/sdkRender.tsx`](../packages/sdks/region-selector/src/sdkRender.tsx)（`api.onRegionsUpdated` → `ctx.ui?.requestRerender(...)`）
>
> 组件实现见 [`RegionPicker.tsx`](../packages/sdks/region-selector/src/components/RegionPicker.tsx)、[`RegionBreadcrumb.tsx`](../packages/sdks/region-selector/src/components/RegionBreadcrumb.tsx)

---

## 七、SdkRegistry 消费侧 API

> `SdkRegistry` 是 `PluginRegistry` 的门面（U-2 已决），仅暴露 SDK 消费侧 API。

**设计原理 — 门面模式的消费侧裁剪**：

`SdkRegistry` 将 `PluginRegistry` 的全量 API 裁剪为 SDK 消费者需要的子集，隐藏了 `register`、`unregister`、`findByRoute` 等与 SDK 无关的方法。这使得 SDK 的消费接口保持简洁，同时防止消费者误用不属于 SDK 域的方法。

关键 API 的语义：

| 方法 | 语义 | 数据来源 / 委托 |
|------|------|----------------|
| `has(name)` | SDK 是否已注册 | `PluginRegistry` 描述符 |
| `get<T>(name)` | 获取已激活 SDK 的 API | `SharedStateBus` 的 `{name}.api` |
| `load<T>(name)` | 加载并激活 SDK | `resolve` + `activateSdk` |
| `preload(names)` | 批量预加载 | 循环 `load` |
| `reload(name)` | 重载 SDK（灰度切换） | `deactivate → activate`，重建组件缓存 |
| `getComponent(sdk, componentName)` | 获取 UI 组件（子应用显式引用） | `componentCache` / `getComponents()` |
| `renderTo(sdk, container, { slot? })` | SDK 自主渲染到 DOM | `load` + `LifecycleManager.renderSdk`；注入 `data-xingwu-slot` |
| `unrenderFrom(sdk, container)` | 卸载容器上的 SDK UI | `LifecycleManager.unrenderSdk` |
| `onRerender(sdk, callback, componentName?)` | 订阅 `requestRerender` | 内部 `rerenderListeners` |

> 完整实现见 [`packages/shell/src/sdk-registry.ts`](../packages/shell/src/sdk-registry.ts)
>
> 生命周期 `renderSdk` / `unrenderSdk` 见 [`packages/shell/src/lifecycle.ts`](../packages/shell/src/lifecycle.ts)

---

## 八、SDK Vite 构建配置

SDK 构建配置与子应用类似，核心决策是将 `react`/`react-dom` 标为 `external`，由壳层 Import Maps 提供。

**关键点**：

- SDK 构建同样将 `react`/`react-dom` 标为 `external`，由壳层 Import Maps 提供
- 含 UI 的 SDK 需要引入 `@vitejs/plugin-react`（JSX 转换）
- CSS Modules 默认支持，无需额外配置
- `@xingwu/vite-plugin` 自动处理 `plugin.config.ts` 的读取与注入

### 8.1 开发模式共享 React 实例

开发模式下，SDK 通过 Vite 插件 `createSharedReactPlugin` 将 react 系裸导入重定向到虚拟模块，从 `window.__REACT_SHARED__` 获取宿主 Shell 提供的 React 单实例，避免双 React 实例导致 hooks 崩溃。

**需拦截的裸导入清单**：

| 裸导入 | 虚拟模块 | 说明 |
|-------|---------|------|
| `react` | `virtual:shared-react` | React 核心包 |
| `react-dom` | `virtual:shared-react-dom` | ReactDOM（含 `createRoot`、`createPortal` 等） |
| `react-dom/client` | `virtual:shared-react-dom-client` | ReactDOM client 入口（`createRoot`、`hydrateRoot`） |
| `react/jsx-runtime` | `virtual:shared-react-jsx-runtime` | 生产态 automatic JSX 转换 |
| `react/jsx-dev-runtime` | `virtual:shared-react-jsx-dev-runtime` | 开发态 automatic JSX 转换 |

> **重要**：`react-dom/client` 必须单独拦截。当 Shell 通过 `import()` 动态加载 SDK 模块时，若 `react-dom/client` 未被拦截，会落到 Vite 的 CJS→ESM 预构建路径（`/@fs/...react-dom/client.js`），而预构建转换无法正确暴露 `createRoot` 命名导出，导致运行时报错：
> ```
> SyntaxError: The requested module '.../react-dom/client.js' does not provide an export named 'createRoot'
> ```

**`react-dom/client` 虚拟模块实现**：

```ts
if (id === virtualReactDOMClient) {
  return `
const RD = window.__REACT_SHARED__?.ReactDOM;
if (!RD) throw new Error('[SDK] Shared ReactDOM not found. Ensure shell loads first.');
export const createRoot = RD.createRoot;
export const hydrateRoot = RD.hydrateRoot;
`;
}
```

**`resolve.dedupe` 配置**：

```ts
resolve: {
  dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
},
```

将 `react-dom/client` 加入 `dedupe` 列表，确保 Vite 始终使用同一份模块实例，避免重复加载。

**`optimizeDeps.disabled`**：

SDK 开发服务器需完全禁用依赖预构建（`optimizeDeps.disabled: true`），让所有模块走 Vite 的正常 transform → resolve pipeline，这样 `createSharedReactPlugin` 才能拦截所有 react 系裸导入并重定向到共享实例。

> 纯逻辑 SDK 构建配置示例见 [`packages/sdks/auth-guard/vite.config.ts`](../packages/sdks/auth-guard/vite.config.ts)
>
> 含 UI SDK 构建配置示例见 [`packages/sdks/region-selector/vite.config.ts`](../packages/sdks/region-selector/vite.config.ts)

---

*文档版本：2.2.0*
*最后更新：2026-05-15*
