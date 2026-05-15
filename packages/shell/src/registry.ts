import type {
  PluginDescriptor,
  PluginInstance,
  AppLifecycle,
  SdkLifecycle,
} from '@xingwu/types';

/**
 * PluginRegistry — 插件注册表
 *
 * 统一管理所有插件（App + SDK）的注册、解析与模块缓存。
 * 是注册事实的唯一来源（U-2 已决）。
 */
export class PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map();
  private moduleCache: Map<string, Promise<unknown>> = new Map();

  /** 注册插件描述符 */
  register(descriptor: PluginDescriptor): void {
    if (this.plugins.has(descriptor.name)) {
      console.warn(`[Xingwu] Plugin "${descriptor.name}" already registered, overwriting.`);
    }

    this.plugins.set(descriptor.name, {
      descriptor,
      lifecycle: {} as AppLifecycle | SdkLifecycle,
      module: null,
      status: 'registered',
    });
  }

  /** 批量注册（从配置中心拉取） */
  registerAll(descriptors: PluginDescriptor[]): void {
    descriptors.forEach((d) => this.register(d));
  }

  /** 解析插件：按需加载模块并实例化 */
  async resolve(name: string): Promise<PluginInstance> {
    const existing = this.plugins.get(name);
    if (!existing) {
      throw new Error(`[Xingwu] Plugin "${name}" not registered.`);
    }

    if (existing.status === 'active' || existing.status === 'loaded') {
      return existing;
    }

    // 从 moduleCache 获取或动态加载
    if (!this.moduleCache.has(name)) {
      const entry = existing.descriptor.entry;
      const loadPromise = import(/* @vite-ignore */ entry);
      this.moduleCache.set(name, loadPromise);
    }

    try {
      const mod: any = await this.moduleCache.get(name)!;
      const lifecycle = (mod.default || mod) as AppLifecycle | SdkLifecycle;
      const instance = this.plugins.get(name)!;

      instance.module = mod;
      instance.lifecycle = lifecycle;
      instance.exports = mod;
      instance.status = 'loaded';

      // 若是 SDK，收集 UI 组件（延迟到 activate 阶段）
      if (existing.descriptor.type === 'sdk' && typeof (lifecycle as any).getComponents === 'function') {
        // getComponents 需要 SdkContext，延迟到 activate 阶段处理
      }

      return instance;
    } catch (err) {
      const instance = this.plugins.get(name)!;
      instance.status = 'error';
      throw new Error(`[Xingwu] Failed to resolve plugin "${name}": ${err}`);
    }
  }

  /** 获取已注册的插件描述符（未加载模块） */
  getDescriptor(name: string): PluginDescriptor | undefined {
    return this.plugins.get(name)?.descriptor;
  }

  /** 获取已加载的插件实例 */
  getInstance(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  /** 卸载插件 */
  async unregister(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) return;

    if (instance.status === 'active') {
      // 先执行生命周期卸载
      const lifecycle = instance.lifecycle;
      if (typeof (lifecycle as any).unmount === 'function') {
        // 需要上下文，此处简化处理
      }
      if (typeof (lifecycle as any).deactivate === 'function') {
        // 需要上下文，此处简化处理
      }
    }

    this.moduleCache.delete(name);
    this.plugins.delete(name);
  }

  /** 按路由前缀查找 App */
  findByRoute(pathname: string): PluginDescriptor | undefined {
    for (const instance of this.plugins.values()) {
      const { descriptor } = instance;
      if (
        descriptor.type === 'app' &&
        descriptor.routePrefix &&
        pathname.startsWith(descriptor.routePrefix)
      ) {
        return descriptor;
      }
    }
    return undefined;
  }

  /** 获取所有 SDK 类型的插件 */
  getSdks(): PluginDescriptor[] {
    const result: PluginDescriptor[] = [];
    for (const instance of this.plugins.values()) {
      if (instance.descriptor.type === 'sdk') {
        result.push(instance.descriptor);
      }
    }
    return result;
  }

  /** 预加载插件（不激活） */
  async preload(name: string): Promise<void> {
    try {
      await this.resolve(name);
    } catch (err) {
      console.warn(`[Xingwu] Preload plugin "${name}" failed:`, err);
    }
  }

  /** 更新插件实例状态 */
  setStatus(name: string, status: PluginInstance['status']): void {
    const instance = this.plugins.get(name);
    if (instance) {
      instance.status = status;
    }
  }

  /** 获取所有已注册插件 */
  getAll(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }
}
