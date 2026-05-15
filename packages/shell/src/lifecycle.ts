import type {
  AppLifecycle,
  SdkLifecycle,
  AppContext,
  SdkContext,
  PluginDescriptor,
  PermissionResult,
} from '@xingwu/types';
import type { PluginRegistry } from '@/registry';

/**
 * LifecycleManager — 生命周期管理器
 *
 * 编排插件的挂载、更新、卸载流程。
 */
export class LifecycleManager {
  private routeGuards: Array<() => boolean | Promise<boolean>> = [];

  constructor(private registry: PluginRegistry) {}

  /** 挂载子应用 */
  async mountApp(name: string, _container: HTMLElement, ctx: AppContext): Promise<void> {
    const instance = await this.registry.resolve(name);
    const lifecycle = instance.lifecycle as AppLifecycle;

    if (lifecycle.beforeMount) {
      await lifecycle.beforeMount(ctx);
    }

    await lifecycle.mount(ctx);

    if (lifecycle.afterMount) {
      lifecycle.afterMount(ctx);
    }

    this.registry.setStatus(name, 'active');
  }

  /** 更新子应用（路由参数变化） */
  async updateApp(name: string, ctx: AppContext): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance) return;

    const lifecycle = instance.lifecycle as AppLifecycle;
    if (lifecycle.update) {
      await lifecycle.update(ctx);
    }
  }

  /** 卸载子应用 */
  async unmountApp(name: string, ctx: AppContext): Promise<void> {
    const instance = this.registry.getInstance(name);
    if (!instance) return;

    const lifecycle = instance.lifecycle as AppLifecycle;

    if (lifecycle.beforeUnmount) {
      const canUnmount = await lifecycle.beforeUnmount(ctx);
      if (canUnmount === false) {
        return; // 阻止卸载
      }
    }

    await lifecycle.unmount(ctx);
    this.registry.setStatus(name, 'inactive');
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

    await lifecycle.activate(ctx);

    // 收集 UI 组件
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
    await lifecycle.deactivate(ctx);
    this.registry.setStatus(name, 'inactive');
  }

  /** 执行权限校验链（简化实现） */
  async checkPermission(_descriptor: PluginDescriptor): Promise<PermissionResult> {
    // 简化实现：默认全部通过
    // 生产环境需对接权限检查服务
    return { granted: true };
  }

  /** 注册路由离开守卫 */
  registerRouteGuard(guard: () => boolean | Promise<boolean>): void {
    this.routeGuards.push(guard);
  }

  /** 执行所有路由离开守卫 */
  async checkRouteGuards(): Promise<boolean> {
    for (const guard of this.routeGuards) {
      const result = await guard();
      if (!result) return false;
    }
    return true;
  }
}
