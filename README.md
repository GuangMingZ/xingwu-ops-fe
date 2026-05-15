# 星坞 (Xingwu) System

> 万星入坞，一壳相承。

星坞是一个面向现代浏览器的企业级插件化前端框架，采用 **壳层 + 子应用 + SDK** 三层插件体系。

## 架构

```
xingwu-ops-fe/
├── packages/
│   ├── types/                     # @xingwu/types — 共享类型定义
│   ├── vite-plugin/               # @xingwu/vite-plugin — 构建插件
│   ├── shell/                     # @xingwu/shell — 主应用壳层
│   │   ├── src/
│   │   │   ├── bootstrap.ts       # Shell 核心初始化
│   │   │   ├── registry.ts        # PluginRegistry 插件注册表
│   │   │   ├── config-center.ts   # ConfigCenter 配置中心
│   │   │   ├── shared-state.ts    # SharedStateBus 共享状态
│   │   │   ├── lifecycle.ts       # LifecycleManager 生命周期
│   │   │   ├── sdk-registry.ts    # SdkRegistry SDK 门面
│   │   │   ├── infra/             # 基础设施（Monitor/I18n/Net/Permission）
│   │   │   ├── App.tsx            # 壳层根组件
│   │   │   └── main.tsx           # 入口
│   │   └── vite.config.ts
│   │
│   ├── apps/                      # 子应用
│   │   └── product/               # 商品管理（示例子应用）
│   │
│   └── sdks/                      # SDK 轻量插件
│       ├── auth-guard/            # 鉴权守卫（纯逻辑 SDK 示例）
│       └── region-selector/       # 区域选择器（含 UI SDK 示例）
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建 @xingwu/types（其他包依赖它）
pnpm build:types

# 构建 @xingwu/vite-plugin
pnpm build:vite-plugin

# 启动主应用开发服务器（端口 3000）
pnpm dev

# 启动子应用独立开发（需占用固定端口 5174，勿与其他进程冲突）
cd packages/apps/product && pnpm dev
# 浏览器打开 http://localhost:5174/ （根目录已提供 index.html + dev 入口）
# 若启动报错 “Port 5174 is in use”，请结束占用进程后再启，否则 Shell 联调的 entry 地址会失效

# 启动 SDK 独立开发
cd packages/sdks/auth-guard && pnpm dev       # 端口 5175
cd packages/sdks/region-selector && pnpm dev  # 端口 5176
```

## 核心模块

| 模块 | 说明 |
|------|------|
| `PluginRegistry` | 统一插件注册表，App + SDK 的描述符与模块缓存均由其管理 |
| `ConfigCenter` | 类型安全的运行时配置管理，Zod Schema 校验 + 响应式更新 |
| `SharedStateBus` | 受控的跨插件状态共享，命名空间 key + 写入审计 |
| `LifecycleManager` | 插件挂载/更新/卸载流程编排，路由守卫 |
| `SdkRegistry` | PluginRegistry 门面，仅暴露 SDK 消费侧 API |

## 示例说明

### product — 子应用示例

完整的商品管理子应用，拥有独立路由段 `/product/*`，包含：
- 商品列表页（含表格、状态标签、刷新）
- 商品详情页（含参数读取、信息展示）
- 与 SDK 的集成（消费 region-selector API）

### auth-guard — 纯逻辑 SDK 示例

鉴权守卫 SDK，无 UI，提供：
- Session 守卫检查
- Owner 守卫检查
- 综合权限检查链

### region-selector — 含 UI SDK 示例

区域选择器 SDK，包含 UI 组件，提供：
- `RegionSelectorApi`：区域列表查询、当前区域设置
- `RegionPicker`：下拉选择器组件（slot: header-slot）
- `RegionBreadcrumb`：面包屑导航组件（slot: breadcrumb）

## 技术栈

- **React 18** + **TypeScript 5**
- **Vite 5** 构建
- **ESM** 原生加载 + Import Maps
- **Zod** Schema 校验
- **pnpm** Monorepo

## 许可

MIT
