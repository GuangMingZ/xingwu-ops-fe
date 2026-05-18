/** 订阅者回调 */
export type Subscriber<T = unknown> = (value: T, prev: T) => void;

/** 共享状态总线 */
export interface SharedStateBus {
  /** 读取共享状态 */
  getState<T>(key: string): T | undefined;
  /** 写入共享状态（触发订阅者） */
  setState<T>(key: string, value: T | ((prev: T) => T)): void;
  /** 订阅状态变更 */
  subscribe<T>(key: string, callback: Subscriber<T>): () => void;
  /** 批量更新（仅触发一次通知） */
  batchSet(updates: Record<string, unknown>): void;
}

/** 配置中心 */
export interface ConfigCenter {
  /** 注册配置 Schema */
  registerSchema(key: string, schema: Record<string, unknown>): void;
  /** 获取配置 */
  get<T>(key: string): T;
  /** 设置配置 */
  set<T>(key: string, value: T): void;
  /** 批量更新 */
  batchUpdate(updates: Record<string, unknown>): void;
  /** 监听配置变更 */
  watch<T>(key: string, callback: (value: T, oldValue: T) => void): () => void;
  /** 从远程拉取最新配置 */
  refresh(): Promise<void>;
  /** 获取插件级配置作用域 */
  forPlugin(name: string): PluginConfigScope;
}

/** 插件级配置作用域 */
export interface PluginConfigScope {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  watch<T>(key: string, callback: (value: T, oldValue: T) => void): () => void;
}

/** 监控事件映射 */
export interface MonitorEvents {
  'plugin:register': { name: string; type: string };
  'plugin:mount': { name: string; duration: number };
  'plugin:unmount': { name: string };
  'plugin:error': { name: string; error: Error; phase: string };
  'route:change': { from: string; to: string; duration: number };
  'route:redirect': { from: string; to: string; reason: string };
  'sdk:load': { name: string; duration: number };
  'sdk:error': { name: string; error: Error };
  'perf:first-paint': { plugin: string; duration: number };
  'perf:api-call': { plugin: string; api: string; duration: number; status: number };
  'health:white-screen': { url: string; timeout: number };
  'config:change': { key: string; source: string };
}

/** 监控接口 */
export interface Monitor {
  mark<E extends keyof MonitorEvents>(event: E, data: MonitorEvents[E]): void;
  reportError(tag: string, error: Error): void;
}

/** 国际化接口 */
export interface I18n {
  t(key: string, params?: Record<string, unknown>): string;
  locale: string;
  setLocale(locale: string): void;
}

/** 网络请求客户端 */
export interface NetClient {
  request<T = unknown>(url: string, options?: RequestInit): Promise<T>;
  get<T = unknown>(url: string, params?: Record<string, string>): Promise<T>;
  post<T = unknown>(url: string, body?: unknown): Promise<T>;
}

/** 权限检查结果 */
export type PermissionResult =
  | { granted: true }
  | { granted: false; reason: string; node: PermissionNode };

/** 权限节点 */
export interface PermissionNode {
  type: 'admin' | 'identity' | 'rbac' | 'custom';
  config?: Record<string, unknown>;
  fallback?: React.ComponentType;
}

/**
 * 权限检查器配置
 *
 * 采用 Deny-by-default 策略：仅在 allowedActions 中显式声明的 RBAC
 * action 才被允许，未配置时所有检查默认拒绝。
 */
export interface PermissionConfig {
  /** 是否拥有管理员权限，默认 false */
  isAdmin?: boolean;
  /** 是否通过身份验证，默认 false */
  isAuthenticated?: boolean;
  /** 允许通过的 RBAC action 集合，默认空集合（全拒绝） */
  allowedActions?: string[];
}

/** 权限检查接口 */
export interface PermissionChecker {
  checkAdmin(): Promise<boolean>;
  checkIdentity(): Promise<boolean>;
  checkRbacAction(action: string): Promise<boolean>;
  checkChain(chain: PermissionNode[]): Promise<PermissionResult>;
  /** 动态更新权限配置（用于登录/权限刷新场景） */
  configure(config: PermissionConfig): void;
}

/** SdkRegistry 门面接口 */
export interface SdkRegistry {
  has(name: string): boolean;
  get<T = unknown>(name: string): T | undefined;
  load<T = unknown>(name: string): Promise<T>;
  preload(names: string[]): Promise<void>;
  reload(name: string): Promise<void>;
  getComponent<T extends React.ComponentType<unknown>>(
    sdkName: string,
    componentName: string,
  ): T | undefined;
  /** SDK 将 UI 渲染到宿主提供的 DOM（需已实现 SdkLifecycle.render） */
  renderTo(
    sdkName: string,
    container: HTMLElement,
    options?: { slot?: string },
  ): Promise<void>;
  /** 卸载指定容器上的 SDK UI */
  unrenderFrom(sdkName: string, container: HTMLElement): Promise<void>;
  /** 订阅 SDK 的 requestRerender 通知 */
  onRerender(sdkName: string, callback: () => void, componentName?: string): () => void;
}
