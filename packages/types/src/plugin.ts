/** 插件类型 */
export type PluginType = 'app' | 'sdk';

/** 子应用描述符（Shell config/apps.json，不含 type 字段） */
export interface AppDescriptor {
  name: string;
  version: string;
  entry: string;
  routePrefix: string;
  dependencies?: string[];
  navItem?: NavItem;
  configSchema?: Record<string, unknown>;
  integrity?: string;
  dependencyRanges?: Record<string, string>;
}

/** SDK 描述符（Shell config/sdks.json，不含 type 字段） */
export interface SdkDescriptor {
  name: string;
  version: string;
  entry: string;
  dependencies?: string[];
  exports?: string[];
  preload?: boolean;
  uiComponents?: UiComponentDecl[];
  styleStrategy?: 'css-modules' | 'css-in-js' | 'shadow-dom';
  configSchema?: Record<string, unknown>;
  integrity?: string;
  dependencyRanges?: Record<string, string>;
}

/** 将子应用配置转为注册表使用的 PluginDescriptor */
export function appDescriptorToPlugin(app: AppDescriptor): PluginDescriptor {
  return { ...app, type: 'app' };
}

/** 将 SDK 配置转为注册表使用的 PluginDescriptor */
export function sdkDescriptorToPlugin(sdk: SdkDescriptor): PluginDescriptor {
  return { ...sdk, type: 'sdk' };
}

/** 插件描述符 */
export interface PluginDescriptor {
  /** 插件唯一标识 */
  name: string;
  /** 插件类型 */
  type: PluginType;
  /** 版本号 (semver) */
  version: string;
  /** 入口模块路径 (ESM) */
  entry: string;
  /** 依赖的其他插件 */
  dependencies?: string[];
  /** 配置 Schema（Zod Schema 或 JSON Schema 对象） */
  configSchema?: Record<string, unknown>;

  // --- App 专有 ---
  /** 路由前缀 (仅 App 类型) */
  routePrefix?: string;
  /** 菜单/导航配置 (仅 App 类型) */
  navItem?: NavItem;

  // --- SDK 专有 ---
  /** 导出的 API 声明 (仅 SDK 类型) */
  exports?: string[];
  /** 是否预加载 (仅 SDK 类型) */
  preload?: boolean;
  /** SDK 提供的 UI 组件声明 (仅 SDK 类型) */
  uiComponents?: UiComponentDecl[];
  /** SDK UI 组件的样式隔离策略 */
  styleStrategy?: 'css-modules' | 'css-in-js' | 'shadow-dom';

  // --- 远程/发布相关 ---
  /** SRI 完整性校验哈希 */
  integrity?: string;
  /** 依赖的 semver range */
  dependencyRanges?: Record<string, string>;
}

/** 导航项 */
export interface NavItem {
  key: string;
  label: string;
  icon?: string;
  order?: number;
  children?: NavItem[];
}

/** SDK UI 组件声明 */
export interface UiComponentDecl {
  /** 组件唯一标识 */
  name: string;
  /** 组件用途描述 */
  description?: string;
  /** 挂载位置约束 (如 'header-slot', 'sidebar-panel', 'modal', 'inline') */
  slot: string;
  /** 组件 props 的 JSON Schema */
  propsSchema?: Record<string, unknown>;
}

/** 插件实例 */
export interface PluginInstance {
  descriptor: PluginDescriptor;
  lifecycle: import('@/lifecycle').AppLifecycle | import('@/lifecycle').SdkLifecycle;
  module: unknown;
  exports?: unknown;
  uiComponents?: Record<string, React.ComponentType<Record<string, unknown>>>;
  status: 'registered' | 'loaded' | 'active' | 'inactive' | 'error';
}

/** 重定向规则 */
export interface RedirectRule {
  from: string | RegExp;
  to: string | ((params: Record<string, string>) => string);
  condition?: RedirectCondition;
  validUntil?: string;
}

/** 重定向条件 */
export interface RedirectCondition {
  percentage?: number;
  whitelist?: string[];
  region?: string[];
}
