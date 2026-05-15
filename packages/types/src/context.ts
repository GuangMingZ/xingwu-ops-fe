import type { PluginDescriptor } from '@/plugin';
import type { SharedStateBus, Monitor, I18n, NetClient, PermissionChecker, SdkRegistry } from '@/infra';

/** 导航选项 */
export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

/** App 上下文 */
export interface AppContext {
  /** 插件描述符 */
  descriptor: PluginDescriptor;
  /** 路由信息 */
  router: {
    params: Record<string, string>;
    query: Record<string, string>;
    navigate: (to: string, options?: NavigateOptions) => void;
    beforeLeave: (guard: () => boolean | Promise<boolean>) => void;
  };
  /** 配置中心（类型安全） */
  config: TypedConfig;
  /** 共享状态 */
  sharedState: SharedStateBus;
  /** SDK 引用 */
  sdk: SdkRegistry;
  /** 基础设施 */
  infra: {
    monitor: Monitor;
    i18n: I18n;
    net: NetClient;
    permission: PermissionChecker;
  };
  /** 渲染容器 */
  container: HTMLElement;
}

/** SDK 上下文 */
export interface SdkContext {
  descriptor: PluginDescriptor;
  config: TypedConfig;
  sharedState: SharedStateBus;
  infra: {
    monitor: Monitor;
    i18n: I18n;
  };
  /** UI 组件渲染能力（仅声明了 uiComponents 的 SDK 可用） */
  ui?: {
    /** 获取当前 SDK 可用的挂载插槽信息 */
    getSlot(name: string): SlotInfo | undefined;
    /** 通知宿主重新渲染指定组件 */
    requestRerender(componentName: string): void;
  };
}

/** 插槽信息 */
export interface SlotInfo {
  name: string;
  type: string;
  container?: HTMLElement;
}

/** 类型安全的配置接口 */
export interface TypedConfig {
  get<T = unknown>(key: string): T;
  set<T = unknown>(key: string, value: T): void;
  watch<T = unknown>(key: string, callback: (value: T, oldValue: T) => void): () => void;
}
