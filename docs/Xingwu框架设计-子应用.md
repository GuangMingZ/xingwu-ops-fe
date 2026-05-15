# 星坞框架设计 — 子应用（App）

> 本文档聚焦 **子应用（App）** 的开发规范、生命周期、上下文与工程配置。
> 万星入坞，一壳相承。
>
> 配套文档：[主应用](./Xingwu框架设计-主应用.md) · [SDK 轻量组件](./Xingwu框架设计-SDK轻量组件.md)

---

## 一、子应用定位

子应用是星坞框架中的**完整业务模块**，拥有独立的路由段和 UI 树。

| 维度 | App（子应用） | SDK（轻量插件） |
|-----|-------------|---------------|
| **路由** | 拥有路由段（如 `/product/*`） | 无独立路由段，不参与路由分发 |
| **UI** | 渲染完整页面/视图 | 可纯逻辑（鉴权守卫），也可提供 UI 组件供宿主渲染（区域选择器、审计日志面板） |
| **生命周期** | 完整 `mount → update → unmount` | `activate → deactivate` |
| **状态** | 可拥有独立状态树 | 通常只消费/提供共享状态 |
| **加载时机** | 路由匹配时按需加载 | 按需加载或预加载 |
| **独立开发** | 可独立启动开发服务器 | 通常在主应用内调试 |
| **示例** | 商品管理台、订单管理 | 区域选择器（含 UI）、鉴权守卫（纯逻辑）、审计日志（含 UI） |

---

## 二、插件描述符（App 专有字段）

> 完整类型定义见 [`packages/types/src/plugin.ts`](../packages/types/src/plugin.ts)
>
> 示例配置见 [`packages/apps/product/plugin.config.ts`](../packages/apps/product/plugin.config.ts)

**设计原理 — 描述符即契约**：

`PluginDescriptor` 是子应用与壳层之间的**静态契约**。它声明了子应用的身份（`name`）、能力（`type`、`routePrefix`、`navItem`）和依赖（`dependencies`），但不包含任何运行时逻辑。这种分离使得：

- **壳层可在不加载模块的情况下做出决策**：路由分发、权限检查、菜单生成等操作只需读取描述符，无需 `import()` 子应用模块
- **描述符可远程管理**：CI 发布时将描述符写入配置中心，壳层从配置中心拉取后即可完成路由注册，无需重新构建
- **App 专有字段与 SDK 专有字段互斥**：`routePrefix` 和 `navItem` 仅对 `type: 'app'` 有意义，`exports` 和 `uiComponents` 仅对 `type: 'sdk'` 有意义——类型系统确保这种互斥

---

## 三、App 生命周期

### 生命周期时序

```
┌─────────────────────────────────────────────────────────────────────┐
│                     App 生命周期时序                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────┐                                                       │
│  │ register  │  ← 插件注册（描述符写入注册表，模块未加载）            │
│  └─────┬─────┘                                                       │
│        │                                                              │
│        ▼  [路由匹配 → 权限检查 → import() 加载模块]                   │
│  ┌────────────┐                                                      │
│  │ beforeMount│  ← 加载完成，准备挂载（权限检查、配置读取）           │
│  └─────┬──────┘                                                      │
│        │                                                              │
│        ▼                                                              │
│  ┌──────────┐                                                        │
│  │  mount   │  ← React 渲染到容器（ReactDOM.createRoot）             │
│  └─────┬────┘                                                        │
│        │                                                              │
│        ▼                                                              │
│  ┌───────────┐                                                       │
│  │ afterMount│  ← 活跃状态，可发送性能打点                            │
│  └─────┬─────┘                                                       │
│        │                                                              │
│        ▼  [URL 参数变化]                                              │
│  ┌──────────┐                                                        │
│  │  update  │  ← 路由更新（参数变化时）                               │
│  └─────┬────┘                                                        │
│        │                                                              │
│        ▼  [导航到其他子应用]                                          │
│  ┌──────────────┐                                                    │
│  │beforeUnmount │  ← 可返回 false 阻止离开（如表单未保存）            │
│  └─────┬────────┘                                                    │
│        │                                                              │
│        ▼                                                              │
│  ┌──────────┐                                                        │
│  │ unmount  │  ← React 卸载，清理副作用（定时器、事件监听等）         │
│  └──────────┘                                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**设计原理 — 生命周期钩子的分层语义**：

App 生命周期的设计遵循**渐进增强**原则：

- **必须实现**：`mount` 和 `unmount`——这是壳层驱动子应用渲染/卸载的最小契约
- **通知型钩子**：`beforeMount`、`afterMount`——壳层保证调用但不检查返回值，适用于初始化、性能打点等旁路逻辑
- **可中断钩子**：`beforeUnmount`——返回 `false` 可阻止卸载，用于「未保存表单」等用户交互场景
- **响应型钩子**：`update`——路由参数变化时触发，子应用可据此重新拉取数据

> **注意**：权限检查（`checkPermission`）在 `import()` 加载之前由壳层执行（U-6 已决）。若权限拒绝，不触发 `resolve`，直接渲染降级 UI。

> 生命周期类型定义见 [`packages/types/src/lifecycle.ts`](../packages/types/src/lifecycle.ts)
>
> 生命周期管理器实现见 [`packages/shell/src/lifecycle.ts`](../packages/shell/src/lifecycle.ts)
>
> 子应用入口示例见 [`packages/apps/product/src/index.tsx`](../packages/apps/product/src/index.tsx)

---

## 四、App 上下文（AppContext）

每个子应用获得一个上下文对象，是与框架交互的唯一入口。

> 完整类型定义见 [`packages/types/src/context.ts`](../packages/types/src/context.ts)

**设计原理 — 上下文即能力边界**：

`AppContext` 是子应用与框架交互的**唯一合法通道**。这种设计的核心意图是**将子应用的能力边界显式化**：

- **显式优于隐式**：子应用能做什么，完全由 `AppContext` 的字段决定。不需要的子应用（如 SDK）自然不会获得 `router`、`container` 等能力
- **沙箱基础**：`AppContext` / `SdkContext` 是受限上下文策略（U-1）的实现基础——框架控制上下文的构造，可以按需裁剪能力
- **测试友好**：子应用只依赖 `AppContext` 接口而非 Shell 实现细节，测试时只需构造 Mock 上下文即可

### 关键能力说明

| 能力 | API | 说明 |
|-----|-----|------|
| 路由导航 | `ctx.router.navigate(to)` | 子应用内导航（壳层路由下） |
| 路由守卫 | `ctx.router.beforeLeave(guard)` | 注册离开拦截（U-5：由壳层 `useBlocker` 统一处理） |
| 读取配置 | `ctx.config.get<T>(key)` | 类型安全配置读取（Zod 校验） |
| 共享状态 | `ctx.sharedState.getState/setState` | 跨插件状态共享（命名空间 key） |
| 加载 SDK | `ctx.sdk.load<T>(name)` | 按需加载 SDK，获取其导出 API |
| 使用 SDK UI | `ctx.sdk.getComponent(sdkName, componentName)` | 获取 SDK 提供的 UI 组件（U-8） |
| 权限检查 | `ctx.infra.permission.checkChain(nodes)` | 多级权限校验链 |
| 网络请求 | `ctx.infra.net` | 带拦截器的 Fetch 封装 |
| 监控上报 | `ctx.infra.monitor.mark(event, data)` | 结构化监控事件 |
| 国际化 | `ctx.infra.i18n.t(key)` | 翻译函数 |

---

## 五、子应用开发规范

### 5.1 子应用标准结构

```
packages/apps/product/
├── package.json              # 独立 package，声明 @xingwu/types 依赖
├── tsconfig.json
├── vite.config.ts            # Vite 配置（lib 模式构建）
├── src/
│   ├── index.tsx             # 入口：导出 AppLifecycle
│   ├── routes.tsx            # 子应用内部路由
│   ├── pages/
│   ├── components/
│   ├── models/
│   └── i18n/
│       ├── zh.json
│       └── en.json
└── plugin.config.ts          # 插件描述符配置
```

### 5.2 入口文件

子应用入口的核心职责是**导出 `AppLifecycle` 对象**，供壳层 `PluginRegistry` 在 `resolve` 阶段提取。

**设计原理 — WeakMap 管理挂载句柄**：

`ReactDOM.Root` 等非序列化句柄不应放入 `SharedStateBus`（违反「受控共享」约束），也不应挂到 `window` 上（违反沙箱约束）。使用 `WeakMap<HTMLElement, Root>` 以容器节点为 key 关联 Root 实例，既保证了 `mount → unmount` 的配对清理，又不会泄漏到全局作用域。

> 入口文件示例见 [`packages/apps/product/src/index.tsx`](../packages/apps/product/src/index.tsx)

### 5.3 插件配置

> 插件配置示例见 [`packages/apps/product/plugin.config.ts`](../packages/apps/product/plugin.config.ts)

### 5.4 子应用内部路由

子应用在壳层分配的路由段内完全自治，可以使用 React Router 的全部能力（嵌套路由、路由守卫、懒加载等）。壳层只关心路由段的顶层匹配，不介入子应用内部路由逻辑。

> 子应用路由示例见 [`packages/apps/product/src/App.tsx`](../packages/apps/product/src/App.tsx)

### 5.5 子应用中使用 SDK

子应用通过 `ctx.sdk` 消费 SDK 能力，包括纯逻辑 API 和 UI 组件。

**设计原理 — SDK 消费的延迟绑定**：

子应用不直接 `import` SDK 模块，而是通过 `ctx.sdk.load(name)` 按需加载。这种延迟绑定带来三个优势：

1. **解耦部署**：子应用和 SDK 可以独立部署，子应用不需要在构建时将 SDK 打包
2. **版本协商**：壳层统一管理 SDK 版本，子应用只声明依赖（`dependencies: ['region-selector']`），不锁定具体版本
3. **按需加载**：SDK 只在子应用首次需要时才加载，避免加载不使用的 SDK

> SDK 消费示例见 [`packages/apps/product/src/App.tsx`](../packages/apps/product/src/App.tsx)

---

## 六、子应用 Vite 构建配置

**设计原理 — External 化与模块共享**：

子应用构建的关键决策是将 `react`、`react-dom`、`react-router-dom`、`@xingwu/types` 标为 `external`。这不是为了减小包体积（虽然确实有此副作用），而是为了**运行时模块共享**：

- React 的 Hooks 要求同一实例，否则状态管理崩溃
- `@xingwu/types` 中的接口定义需要在壳层和子应用之间保持类型一致性
- 这些依赖由壳层通过 Import Maps（生产）或 Vite dev server 代理（开发）统一提供

> 子应用 Vite 配置示例见 [`packages/apps/product/vite.config.ts`](../packages/apps/product/vite.config.ts)

---

*文档版本：2.0.0*
*最后更新：2026-05-15*
