import type {
  AppDescriptor,
  SdkDescriptor,
  PluginDescriptor,
  PluginInstance,
  AppLifecycle,
  SdkLifecycle,
} from '@xingwu/types';
import { appDescriptorToPlugin, sdkDescriptorToPlugin } from '@xingwu/types';

/**
 * 使用浏览器原生 fetch + SubtleCrypto 对远程模块进行 SRI 校验，
 * 然后通过 Blob URL 安全导入，避免加载被篡改的代码。
 *
 * 触发条件：descriptor.integrity 字段存在（格式："{algo}-{base64hash}"，如 "sha384-abc..."）。
 * 与普通路径差异：不直接 import(entry)，而是先 fetch → 验哈希 → 创建 Blob URL → import(blobUrl)。
 * 选择该方式的原因：import() 本身不支持 integrity 选项，只能通过 fetch 手动校验字节内容。
 */
async function importWithSri(entry: string, integrity: string): Promise<unknown> {
  const [algo, expectedBase64] = integrity.split('-');
  if (!algo || !expectedBase64) {
    throw new Error(`[Xingwu] SRI integrity format invalid for "${entry}": expected "{algo}-{base64}"`);
  }

  const response = await fetch(entry);
  if (!response.ok) {
    throw new Error(`[Xingwu] Failed to fetch plugin entry "${entry}": HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();

  // SubtleCrypto 需要大写算法名，如 "SHA-384"
  const normalizedAlgo = algo.toUpperCase().replace(/^SHA(\d)/, 'SHA-$1');
  const hashBuffer = await crypto.subtle.digest(normalizedAlgo, buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const actualBase64 = btoa(String.fromCharCode(...hashArray));

  if (actualBase64 !== expectedBase64) {
    throw new Error(
      `[Xingwu] SRI check failed for "${entry}": expected "${expectedBase64}", got "${actualBase64}"`,
    );
  }

  // 校验通过后，用 Blob URL 导入，避免二次网络请求
  const blob = new Blob([buffer], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

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

  /** 批量注册 */
  registerAll(descriptors: PluginDescriptor[]): void {
    descriptors.forEach((d) => this.register(d));
  }

  /** 注册子应用描述符 */
  registerApps(apps: AppDescriptor[]): void {
    apps.forEach((app) => this.register(appDescriptorToPlugin(app)));
  }

  /** 注册 SDK 描述符 */
  registerSdks(sdks: SdkDescriptor[]): void {
    sdks.forEach((sdk) => this.register(sdkDescriptorToPlugin(sdk)));
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
    // 当 descriptor.integrity 存在时，先通过 SRI 校验再导入，防止加载被篡改的代码
    if (!this.moduleCache.has(name)) {
      const { entry, integrity } = existing.descriptor;
      const loadPromise = integrity
        ? importWithSri(entry, integrity)
        : import(/* @vite-ignore */ entry);
      this.moduleCache.set(name, loadPromise);
    }

    try {
      const mod: unknown = await this.moduleCache.get(name)!;
      const lifecycle = (mod as Record<string, unknown>).default
        ? ((mod as Record<string, unknown>).default as AppLifecycle | SdkLifecycle)
        : (mod as AppLifecycle | SdkLifecycle);
      const instance = this.plugins.get(name)!;

      instance.module = mod;
      instance.lifecycle = lifecycle;
      instance.exports = mod;
      instance.status = 'loaded';

      // 若是 SDK 且存在 getComponents，收集 UI 组件（延迟到 activate 阶段）
      // 使用 in 操作符检测，避免 as any 绕过类型检查
      if (
        existing.descriptor.type === 'sdk' &&
        typeof (lifecycle as Record<string, unknown>).getComponents === 'function'
      ) {
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

  /**
   * 驱逐子应用 ESM 模块缓存，使下次进入需重新 import。
   * 触发条件：子应用 unmount 且配置 evictOnUnmount
   */
  evictAppModule(name: string): void {
    const instance = this.plugins.get(name);
    if (!instance || instance.descriptor.type !== 'app') return;

    this.moduleCache.delete(name);
    instance.module = null;
    instance.exports = undefined;
    instance.lifecycle = {} as AppLifecycle | SdkLifecycle;
    instance.status = 'registered';
  }

  /** 卸载插件（需由 LifecycleManager 先完成 unmount/deactivate） */
  async unregister(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) return;

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
