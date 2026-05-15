# @xingwu/shell

星坞框架主应用壳层 — 提供插件注册、配置中心、共享状态、生命周期管理、SDK 门面等运行时基础设施。

## 目录结构

```
packages/shell/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx            # 入口：全局共享、ShellConfig 组装、bootstrap
    ├── App.tsx             # 根组件：BrowserRouter + Layout + Routes
    ├── bootstrap.ts        # Shell 类：聚合所有核心模块，提供 init / mount / destroy
    ├── registry.ts         # PluginRegistry — 插件注册表（App + SDK 统一管理）
    ├── sdk-registry.ts     # SdkRegistry — SDK 注册表门面（Facade）
    ├── config-center.ts    # ConfigCenter — 运行时配置中心（Zod 校验 + 远程刷新 + localStorage 缓存）
    ├── shared-state.ts     # SharedStateBus — 共享状态总线（命名空间 key + 订阅通知）
    ├── lifecycle.ts        # LifecycleManager — 生命周期管理器（mount / unmount / activate / deactivate）
    ├── infra/              # 基础设施实现
    │   ├── index.ts        #   统一导出
    │   ├── monitor.ts      #   MonitorImpl — 监控上报
    │   ├── i18n.ts         #   I18nImpl — 国际化
    │   ├── net.ts          #   NetClientImpl — 网络请求
    │   └── permission.ts   #   PermissionCheckerImpl — 权限校验
    ├── layout/             # 页面布局组件
    │   ├── index.ts        #   统一导出
    │   ├── ShellHeader.tsx #   顶部导航栏（标题 + RegionPicker + 系统菜单）
    │   ├── OpsSidebar.tsx  #   左侧侧边栏（根据插件描述符动态生成菜单）
    │   ├── AppOutlet.tsx   #   子应用挂载容器（生命周期 + loading / error 状态）
    │   └── BreadcrumbSlot.tsx # 面包屑插槽（渲染 SDK 提供的 RegionBreadcrumb）
    └── shims/              # 运行时兼容垫片
        └── react-jsx-dev-runtime.ts  # 避免 pnpm 下 ESM 命名导出缺失
```

## 核心模块

### Shell (`bootstrap.ts`)

框架核心类，聚合所有模块并提供统一的生命周期入口：

```ts
const shell = createShell(config);
await shell.mount('#root');     // 初始化 + 挂载
await shell.destroy();          // 销毁 + 卸载所有插件
```

### PluginRegistry (`registry.ts`)

插件注册的唯一来源（Source of Truth），统一管理 App 和 SDK 的注册、解析与模块缓存。

| 方法 | 说明 |
|------|------|
| `register(descriptor)` | 注册插件描述符 |
| `registerAll(descriptors)` | 批量注册 |
| `resolve(name)` | 按需加载模块并实例化 |
| `findByRoute(pathname)` | 按路由前缀查找 App |
| `getSdks()` | 获取所有 SDK 描述符 |
| `unregister(name)` | 卸载插件 |

### SdkRegistry (`sdk-registry.ts`)

`PluginRegistry` 的门面（Facade），仅暴露 SDK 消费侧 API：

| 方法 | 说明 |
|------|------|
| `has(name)` | 检查 SDK 是否已注册 |
| `get<T>(name)` | 获取已激活 SDK 发布到 SharedStateBus 的 API |
| `load<T>(name)` | 加载并激活 SDK，返回其 API |
| `preload(names)` | 预加载 SDK（resolve + activate） |
| `reload(name)` | 重载 SDK（deactivate → activate，用于灰度切换） |
| `getComponent(sdkName, componentName)` | 获取 SDK 提供的 UI 组件 |

### ConfigCenter (`config-center.ts`)

运行时配置管理，支持远程刷新、Zod Schema 校验、插件级作用域隔离、localStorage 缓存：

```ts
const scope = configCenter.forPlugin('product');
scope.get<string>('pageSize');
scope.set('pageSize', 20);
scope.watch('pageSize', (val, old) => { /* ... */ });
```

### SharedStateBus (`shared-state.ts`)

受控的跨插件状态共享，所有 key 遵循 `pluginName.stateKey` 命名空间：

```ts
sharedState.setState('region-selector.api', api);
sharedState.getState<RegionSelectorApi>('region-selector.api');
sharedState.subscribe('region-selector.api', (val, prev) => { /* ... */ });
sharedState.batchSet({ 'a.x': 1, 'b.y': 2 }); // 批量更新，仅触发一次通知
```

### LifecycleManager (`lifecycle.ts`)

编排插件的挂载、更新、卸载流程：

- **App 生命周期**：`beforeMount` → `mount` → `afterMount` → `update` → `beforeUnmount` → `unmount`
- **SDK 生命周期**：`activate`（含 `getComponents` 收集 UI 组件）→ `deactivate`
- 支持路由离开守卫（`registerRouteGuard`）和权限校验链（`checkPermission`）

## 布局组件 (`layout/`)

| 组件 | 说明 |
|------|------|
| `ShellHeader` | 顶部导航栏，包含应用标题、RegionPicker（SDK 注入的 `header-slot` 插槽）和系统菜单 |
| `OpsSidebar` | 左侧侧边栏，根据插件描述符的 `navItem` 动态生成菜单项 |
| `AppOutlet` | 子应用挂载容器，管理 mount / unmount 生命周期，展示 loading / error 状态 |
| `BreadcrumbSlot` | 面包屑插槽，渲染 SDK 注入的 `breadcrumb` 插槽组件 |

## 入口配置 (`main.tsx`)

1. **全局共享** — 将 `React` / `ReactDOM` 挂载到 `window.__REACT_SHARED__`，antd 子集挂载到 `window.__ANTD_SHARED__`，供远程 SDK 模块复用，避免双 React 实例
2. **插件描述符** — `devDescriptors` 定义开发态的本地插件配置（entry、routePrefix、navItem、uiComponents 等）
3. **ShellConfig** — 框架配置对象，包含 appName、router、configCenter、plugins、layout、monitor、i18n、errorBoundary 等
4. **bootstrap** — `createShell(config)` 创建实例，`shell.mount('#root')` 初始化，最后 `createRoot` 渲染 React 应用

## 开发命令

```bash
# 启动开发服务器（端口 3000）
pnpm dev

# 类型检查 + 构建
pnpm build

# 预览构建产物
pnpm preview
```

## 构建配置 (`vite.config.ts`)

- **路径别名**：`@` → `src/`，`@styles` → Monorepo 根 `styles/`
- **React dedupe**：确保子应用和 SDK 共用同一份 React 实例
- **PostCSS**：Tailwind CSS + Autoprefixer（配置文件复用 Monorepo 根目录）
- **Chunk 分割**：`vendor`（react / react-dom / react-router-dom）、`antd`（antd / @ant-design/icons / dayjs）
- **jsx-dev-runtime shim**：避免 pnpm 环境下 ESM 命名导出缺失

## 依赖关系

```
@xingwu/shell
  ├── @xingwu/types       (workspace:*)   — 共享类型定义
  ├── antd + @ant-design/icons            — UI 组件库
  ├── react + react-dom + react-router-dom — 核心框架
  ├── dayjs                               — 日期处理（antd 依赖）
  └── zod                                 — 配置 Schema 校验
```

> **约束**：Shell 禁止反向依赖子应用或 SDK 的具体实现，仅通过 `PluginRegistry` 和 `SdkRegistry` 的抽象接口交互。
