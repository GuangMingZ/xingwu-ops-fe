/** App 生命周期 */
export interface AppLifecycle {
  /** 子应用被注册时调用（此时还未加载模块） */
  register?(ctx: import('@/context').AppContext): void;

  /** 子应用模块加载完成，准备挂载 */
  beforeMount?(ctx: import('@/context').AppContext): void | Promise<void>;

  /** 挂载子应用到 DOM 容器 */
  mount(ctx: import('@/context').AppContext): void | Promise<void>;

  /** 子应用已挂载，进入活跃状态 */
  afterMount?(ctx: import('@/context').AppContext): void;

  /** 路由更新触发（URL 参数变化） */
  update?(ctx: import('@/context').AppContext): void | Promise<void>;

  /** 子应用即将被卸载（可返回 false 阻止） */
  beforeUnmount?(ctx: import('@/context').AppContext): boolean | Promise<boolean>;

  /** 卸载子应用，清理副作用 */
  unmount(ctx: import('@/context').AppContext): void | Promise<void>;

  /** 子应用出错时的降级渲染 */
  onError?(error: Error, ctx: import('@/context').AppContext): React.ReactNode;
}

/** SDK 生命周期 */
export interface SdkLifecycle {
  /** SDK 模块加载完成，初始化 */
  activate(ctx: import('@/context').SdkContext): void | Promise<void>;

  /** SDK 被停用/替换时清理 */
  deactivate(ctx: import('@/context').SdkContext): void | Promise<void>;

  /** SDK 出错时的降级策略 */
  onError?(error: Error, ctx: import('@/context').SdkContext): void;

  /** SDK 提供的 UI 组件映射表 */
  getComponents?(ctx: import('@/context').SdkContext): Record<string, React.ComponentType<any>>;
}
