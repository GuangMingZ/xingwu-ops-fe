# xingwu-ops-fe

本仓库是 **星坞（Xingwu）在 Ops 管理后台场景下的示例 Monorepo**：包含可运行的 Shell 壳层、示例子应用 / SDK，以及配套的类型、构建与脚手架。用于本地联调、扩展新插件和阅读实现细节。

框架概念与协议说明见 `docs/` 目录，本文只描述**本仓库里有什么、怎么跑、改哪里**。

---

## 仓库结构

```
xingwu-ops-fe/
├── packages/
│   ├── types/              @xingwu/types — 插件描述符、生命周期、上下文等 TS 类型
│   ├── vite-plugin/        @xingwu/vite-plugin — 子应用 / SDK 的 Vite 构建辅助
│   ├── xingwu-cli/         脚手架：xingwu create app|sdk
│   ├── shell/              @xingwu/shell — 管理后台壳层（入口、布局、插件加载）
│   ├── apps/               子应用目录
│   │   └── product/        商品管理示例（路由 /product/*）
│   └── sdks/               SDK 目录
│       ├── auth-guard/     鉴权守卫（纯逻辑，无 UI）
│       └── region-selector/ 区域选择（API + Header/Breadcrumb UI）
├── styles/                 共享 Tailwind 入口（各包通过 @styles 引用）
├── docs/                   设计与开发规范（主应用 / 子应用 / SDK）
├── tailwind.config.cjs     全仓 Tailwind（preflight 关闭，与 antd 并存）
├── pnpm-workspace.yaml
└── package.json
```

---

## 功能分区（运行时）

访问 Shell（默认 `http://localhost:3000`）时，页面由以下几块组成：

| 区域 | 代码位置 | 当前示例行为 |
|------|----------|----------------|
| 顶栏 | `packages/shell/src/layout/ShellHeader.tsx` | 标题、**RegionPicker**（来自 region-selector SDK）、系统菜单 |
| 侧栏 | `packages/shell/src/layout/OpsSidebar.tsx` | 根据已注册 App 的 `navItem` 生成菜单，跳转 `/product` 等 |
| 面包屑 | `packages/shell/src/layout/BreadcrumbSlot.tsx` | 渲染 **RegionBreadcrumb**（region-selector SDK） |
| 内容区 | `packages/shell/src/layout/AppOutlet.tsx` | 按路由动态 `import()` 子应用并挂载到固定 DOM 节点 |
| 插件运行时 | `packages/shell/src/bootstrap.ts` 等 | 注册表、配置中心、共享状态、SDK 预加载与激活 |

子应用 **product** 在内容区内渲染自己的路由与页面（列表 / 详情），并可通过 `ctx.sdk.load('region-selector')` 使用区域 API。

---

## Shell 核心文件（改插件注册看这里）

| 文件 | 作用 |
|------|------|
| `packages/shell/src/main.tsx` | 入口：`__REACT_SHARED__` / `__ANTD_SHARED__` 注入；**`devDescriptors`** 开发态插件列表；`preloadSdks` |
| `packages/shell/src/App.tsx` | 路由 + Layout 骨架，组合 layout 子组件 |
| `packages/shell/src/registry.ts` | 描述符注册、`import(entry)` 解析远程模块 |
| `packages/shell/src/sdk-registry.ts` | SDK 的 `load` / `preload` / `getComponent` |
| `packages/shell/src/lifecycle.ts` | App 挂载卸载、SDK activate/deactivate |

新增子应用或 SDK 后，需在 `main.tsx` 的 `devDescriptors` 中增加 `entry`（开发一般为 `http://localhost:<port>/src/index.tsx`），SDK 若需首屏可用则加入 `preloadSdks`。

---

## 示例包说明

### `packages/apps/product` — 子应用

- **路由**：`/product/*`（Shell 侧栏进入）
- **独立开发**：`pnpm dev`，固定端口 **5174**（`vite.config.ts` 中 `strictPort`）
- **入口**：`src/index.tsx` 导出 `AppLifecycle`；`src/dev-main.tsx` + 根目录 `index.html` 用于不启 Shell 时单独调试
- **页面**：`src/pages/ProductList.tsx`、`ProductDetail.tsx`；`plugin.config.ts` 为描述符示例

### `packages/sdks/region-selector` — 含 UI 的 SDK

- **API**：`RegionSelectorApi`，状态写入 `sharedState` 键 `region-selector.api`
- **UI**：`RegionPicker`（顶栏）、`RegionBreadcrumb`（内容区上方）；组件通过宿主 `window.__ANTD_SHARED__` 使用 antd
- **独立开发**：端口 **5176**；Vite 开发态通过 `vite.shared-react` 复用 Shell 的 React，避免双实例

### `packages/sdks/auth-guard` — 纯逻辑 SDK

- **API**：`AuthGuardApi`（Session / Owner 检查示例）
- **无 UI**；独立开发端口 **5175**
- 默认在 `main.tsx` 中注释掉，可按需取消注释并加入 `preloadSdks`

### `packages/xingwu-cli` — 脚手架

```bash
pnpm build:cli
pnpm link --global --dir packages/xingwu-cli

xingwu create app <name>      # → packages/apps/<name>
xingwu create sdk <name>      # → packages/sdks/<name>
xingwu create sdk <name> --ui # 含 UI + 共享 React 模板
```

详见 [packages/xingwu-cli/README.md](packages/xingwu-cli/README.md)。

---

## 本地开发与端口

| 服务 | 目录 | 命令 | 端口 |
|------|------|------|------|
| Shell | 仓库根 | `pnpm dev` | **3000** |
| product | `packages/apps/product` | `pnpm dev` | **5174** |
| auth-guard | `packages/sdks/auth-guard` | `pnpm dev` | **5175** |
| region-selector | `packages/sdks/region-selector` | `pnpm dev` | **5176** |

**联调顺序建议**：先启动各远程包 dev 服务（至少 product + region-selector），再启动 Shell。若 5174 / 5176 被占用，Shell 动态加载会失败。

```bash
pnpm install
pnpm build:types          # 首次或 types 变更后
pnpm build:vite-plugin    # 按需

pnpm dev                  # Shell

# 另开终端
cd packages/apps/product && pnpm dev
cd packages/sdks/region-selector && pnpm dev
```

构建全仓：`pnpm build`。单包：`pnpm build:shell`、`pnpm build:product` 等。

代码质量：`pnpm lint`、`pnpm format`。

---

## 技术栈（本仓库）

- React 18、TypeScript 5、Vite 5、pnpm workspace
- UI：**antd 5** + **Tailwind**（工具类；`corePlugins.preflight: false`）
- 远程插件：开发态通过 URL `import()` 加载 ESM 源码/产物

---

## 延伸阅读

| 文档 | 内容 |
|------|------|
| [docs/Xingwu框架设计-主应用.md](docs/Xingwu框架设计-主应用.md) | Shell、注册表、配置与生命周期 |
| [docs/Xingwu框架设计-子应用.md](docs/Xingwu框架设计-子应用.md) | 子应用描述符、生命周期、工程约定 |
| [docs/Xingwu框架设计-SDK轻量组件.md](docs/Xingwu框架设计-SDK轻量组件.md) | SDK API、UI 插槽、共享 React/antd |

---

## 许可

MIT
