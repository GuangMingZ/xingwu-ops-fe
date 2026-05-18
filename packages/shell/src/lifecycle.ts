import type {
  AppLifecycle,
  SdkLifecycle,
  AppContext,
  SdkContext,
  PluginDescriptor,
  PermissionResult,
} from '@xingwu/types';
import type { PluginRegistry } from '@/registry';

export interface LifecycleManagerOptions {
  /** 子应用卸载后是否驱逐 ESM 模块缓存（默认 true，利于切换 App 后回收内存） */
  evictOnUnmount?: boolean;
  /**
   * 单个生命周期钩子的最大允许执行时长（ms），默认 10000。
   * 触发条件：钩子 Promise 在指定时间内未 resolve/reject。
   * 超时后将 reject 并释放 appLifecycleLock，防止死锁。
   */
  hookTimeout?: number;
}

/** 默认钩子超时时长（10 秒） */
const DEFAULT_HOOK_TIMEOUT_MS = 10_000;

/**
 * 为任意 Promise 添加超时熔断。
 *
 * 触发条件：目标 Promise 在 ms 毫秒内未完成。
 * 与正常路径的差异：正常路径直接 await，超时路径通过 Promise.race 竞争，
 *   超时时 reject 而非永久挂起，从而释放 appLifecycleLock。
 * 选择该修复方式的原因：生命周期锁一旦挂死，所有后续路由跳转均无法执行，
 *   超时熔断是成本最低、影响面最小的防御手段。
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`[Xingwu] Lifecycle hook "${label}" timed out after ${ms}ms`)),
      ms,
    ),
  );
  return Promise.race([promise, timeout]);
}

type RouteGuard = () => boolean | Promise<boolean>;

/**
 * LifecycleManager — 生命周期管理器
 *
 * 编排插件的挂载、更新、卸载流程。
 * 保证任意时刻最多一个子应用处于 active，并通过串行锁避免 mount/unmount 竞态。
 */
export class LifecycleManager {
  private routeGuardsByApp = new Map<string, RouteGuard[]>();
  private appLifecycleLock: Promise<void> = Promise.resolve();

  /** 当前已挂载的子应用名（全局唯一） */
  private activeAppName: string | null = null;
  private activeAppContext: AppContext | null = null;

  constructor(
    private registry: PluginRegistry,
    private readonly options: LifecycleManagerOptions = {},
  ) {}

  private get evictOnUnmount(): boolean {
    return this.options.evictOnUnmount !== false;
  }

  private get hookTimeout(): number {
    return this.options.hookTimeout ?? DEFAULT_HOOK_TIMEOUT_MS;
  }

  /** 当前活跃子应用名 */
  getActiveApp(): string | null {
    return this.activeAppName;
  }

  private runAppLifecycleExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.appLifecycleLock.then(fn);
    this.appLifecycleLock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /** 挂载子应用（切换前会先卸载其它 active App） */
  mountApp(name: string, container: HTMLElement, ctx: AppContext): Promise<void> {
    return this.runAppLifecycleExclusive(() => this.mountAppCore(name, container, ctx));
  }

  private async mountAppCore(name: string, _container: HTMLElement, ctx: AppContext): Promise<void> {
    if (this.activeAppName && this.activeAppName !== name) {
      await this.unmountAppInternal(this.activeAppName, this.activeAppContext, {
        evict: this.evictOnUnmount,
      });
    }

    const instance = await this.registry.resolve(name);
    const lifecycle = instance.lifecycle as AppLifecycle;

    // 触发条件：同一 App 在 active 下再次 mount（竞态或重复调用）
    // 与正常路径差异：应先完整卸载再挂载，避免同容器双 React Root
    // 修复原因：保证 DOM 上仅存在一个 Root，防止内存泄漏
    if (this.activeAppName === name && instance.status === 'active') {
      await this.unmountAppInternal(name, this.activeAppContext ?? ctx, { evict: false });
    }

    if (lifecycle.beforeMount) {
      await withTimeout(
        lifecycle.beforeMount(ctx),
        this.hookTimeout,
        `${name}.beforeMount`,
      );
    }

    await withTimeout(lifecycle.mount(ctx), this.hookTimeout, `${name}.mount`);

    if (lifecycle.afterMount) {
      lifecycle.afterMount(ctx);
    }

    this.registry.setStatus(name, 'active');
    this.activeAppName = name;
    this.activeAppContext = ctx;
  }

  /** 更新子应用（路由参数 / query 变化，不卸载模块） */
  updateApp(name: string, ctx: AppContext): Promise<void> {
    return this.runAppLifecycleExclusive(async () => {
      if (this.activeAppName !== name) {
        await this.mountAppCore(name, ctx.container, ctx);
        return;
      }

      const instance = this.registry.getInstance(name);
      if (!instance) return;

      const lifecycle = instance.lifecycle as AppLifecycle;
      if (lifecycle.update) {
        await withTimeout(lifecycle.update(ctx), this.hookTimeout, `${name}.update`);
      }

      this.activeAppContext = ctx;
    });
  }

  /** 卸载子应用 */
  unmountApp(name: string, ctx: AppContext): Promise<void> {
    return this.runAppLifecycleExclusive(() =>
      this.unmountAppInternal(name, ctx, { evict: this.evictOnUnmount }),
    );
  }

  /** 卸载当前活跃子应用（Shell 销毁或兜底） */
  unmountActiveApp(): Promise<void> {
    return this.runAppLifecycleExclusive(async () => {
      if (!this.activeAppName) return;
      await this.unmountAppInternal(this.activeAppName, this.activeAppContext, {
        evict: this.evictOnUnmount,
      });
    });
  }

  private async unmountAppInternal(
    name: string,
    ctx: AppContext | null,
    options: { evict: boolean },
  ): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance || instance.descriptor.type !== 'app') {
      this.clearActiveIf(name);
      return;
    }

    if (instance.status !== 'active' && instance.status !== 'loaded') {
      this.clearActiveIf(name);
      return;
    }

    const lifecycle = instance.lifecycle as AppLifecycle;
    const unmountCtx = ctx ?? this.activeAppContext;

    if (unmountCtx && lifecycle.beforeUnmount) {
      const canUnmount = await withTimeout(
        lifecycle.beforeUnmount(unmountCtx),
        this.hookTimeout,
        `${name}.beforeUnmount`,
      );
      if (canUnmount === false) {
        return;
      }
    }

    if (unmountCtx && typeof lifecycle.unmount === 'function') {
      await withTimeout(lifecycle.unmount(unmountCtx), this.hookTimeout, `${name}.unmount`);
    }

    this.registry.setStatus(name, 'inactive');
    this.clearRouteGuards(name);
    this.clearActiveIf(name);

    if (options.evict) {
      this.registry.evictAppModule(name);
    }
  }

  private clearActiveIf(name: string): void {
    if (this.activeAppName === name) {
      this.activeAppName = null;
      this.activeAppContext = null;
    }
  }

  /** 激活 SDK */
  async activateSdk(name: string, ctx: SdkContext): Promise<void> {
    const instance = await this.registry.resolve(name);
    const lifecycle = instance.lifecycle as SdkLifecycle;

    if (instance.status === 'active') {
      if (lifecycle.getComponents && !instance.uiComponents) {
        instance.uiComponents = lifecycle.getComponents(ctx);
      }
      return;
    }

    await withTimeout(lifecycle.activate(ctx), this.hookTimeout, `${name}.activate`);

    if (lifecycle.getComponents) {
      const components = lifecycle.getComponents(ctx);
      instance.uiComponents = components;
    }

    this.registry.setStatus(name, 'active');
  }

  /** 停用 SDK */
  async deactivateSdk(name: string, ctx: SdkContext): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance) return;

    const lifecycle = instance.lifecycle as SdkLifecycle;
    await withTimeout(lifecycle.deactivate(ctx), this.hookTimeout, `${name}.deactivate`);
    this.registry.setStatus(name, 'inactive');
  }

  /** SDK 自主渲染 UI 到宿主 DOM */
  async renderSdk(name: string, container: HTMLElement, ctx: SdkContext): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance) {
      throw new Error(`[Xingwu] SDK "${name}" not loaded.`);
    }
    const lifecycle = instance.lifecycle as SdkLifecycle;
    if (!lifecycle.render) {
      return;
    }
    await lifecycle.render(container, ctx);
  }

  /** 卸载 SDK 在宿主 DOM 上的 UI */
  async unrenderSdk(name: string, container: HTMLElement, ctx: SdkContext): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance) return;
    const lifecycle = instance.lifecycle as SdkLifecycle;
    if (lifecycle.unrender) {
      await lifecycle.unrender(container, ctx);
    }
  }

  /** 执行权限校验链（简化实现） */
  async checkPermission(_descriptor: PluginDescriptor): Promise<PermissionResult> {
    return { granted: true };
  }

  /** 注册路由离开守卫（按子应用隔离，卸载时清理） */
  registerRouteGuard(appName: string, guard: RouteGuard): void {
    if (!this.routeGuardsByApp.has(appName)) {
      this.routeGuardsByApp.set(appName, []);
    }
    this.routeGuardsByApp.get(appName)!.push(guard);
  }

  clearRouteGuards(appName: string): void {
    this.routeGuardsByApp.delete(appName);
  }

  /** 执行指定子应用的路由离开守卫 */
  async checkRouteGuards(appName: string): Promise<boolean> {
    const guards = this.routeGuardsByApp.get(appName) ?? [];
    for (const guard of guards) {
      const result = await guard();
      if (!result) return false;
    }
    return true;
  }
}
