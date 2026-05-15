# @xingwu/sdk-region-selector

星坞示例 SDK — 区域选择器（含 UI 组件），展示含 UI 的 SDK 如何与壳层集成。

## 概述

提供区域列表查询、当前区域获取/设置等纯逻辑能力，同时通过 `uiComponents` 向壳层注入两个 UI 组件，分别挂载到 Header 和 Breadcrumb 插槽。

## 目录结构

```
region-selector/
├── src/
│   ├── index.tsx                    # SdkLifecycle 入口（activate / deactivate / getComponents）
│   ├── api.ts                       # RegionSelectorApi — 纯逻辑 API
│   ├── components/
│   │   ├── RegionPicker.tsx         # 区域下拉选择器（slot: header-slot）
│   │   └── RegionBreadcrumb.tsx     # 区域面包屑导航（slot: breadcrumb）
│   └── shims/
│       ├── host-antd.ts             # 宿主 antd 组件 shim
│       └── host-icons.ts            # 宿主 @ant-design/icons shim
├── plugin.config.ts                 # PluginDescriptor 描述符
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## API

### RegionSelectorApi

通过 `ctx.sharedState.getState('region-selector.api')` 或 `shell.sdkRegistry.get('region-selector')` 获取。

| 方法 | 签名 | 说明 |
|------|------|------|
| `getAvailableRegions` | `(filter?: { product?: string }) => Region[]` | 获取所有可用区域 |
| `getCurrentRegion` | `() => Region` | 获取当前选中区域 |
| `setCurrentRegion` | `(regionId: string) => void` | 设置当前区域并通知监听者 |
| `onRegionsUpdated` | `(callback: () => void) => () => void` | 监听区域变更，返回取消函数 |

### Region 类型

```typescript
interface Region {
  id: string;
  name: string;
}
```

## UI 组件

### RegionPicker

区域下拉选择器，挂载到壳层 Header 的 `header-slot` 插槽。

**Props：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `regions` | `Region[]` | 可选区域列表 |
| `currentRegion` | `Region` | 当前选中区域 |
| `onChange` | `(region: Region) => void` | 区域切换回调 |

### RegionBreadcrumb

区域面包屑导航，挂载到壳层内容区的 `breadcrumb` 插槽。

**Props：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `regions` | `Region[]` | 可选区域列表 |
| `currentRegion` | `Region` | 当前选中区域 |

## 配置

SDK 通过 `ConfigCenter` 读取以下配置项：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `regions` | `Array<{ id: string; name: string }>` | 可用区域列表，未配置时使用内置默认值（华东/华南/华北/西南） |
| `defaultRegion` | `string` | 默认选中区域的 id |

## 生命周期

| 阶段 | 行为 |
|------|------|
| `activate` | 从 ConfigCenter 读取区域配置，创建 `RegionSelectorApi` 实例，发布到 `sharedState` 的 `region-selector.api` |
| `deactivate` | 清除 `region-selector.api`，移除 API 实例 |
| `getComponents` | 返回 `{ RegionPicker, RegionBreadcrumb }` 供壳层渲染 |

## 开发

```bash
# 独立开发（端口 5176）
cd packages/sdks/region-selector && pnpm dev

# 构建
pnpm build:region-selector
```

## 设计要点

- **宿主 UI 复用**：通过 `shims/host-antd.ts` 和 `shims/host-icons.ts` 从 `window.__ANTD_SHARED__` 读取宿主 antd 组件，避免 SDK 自带 antd 导致样式冲突和包体积膨胀。
- **响应式更新**：区域切换时通过 `onRegionsUpdated` 通知所有监听者，壳层组件可据此触发重渲染。
