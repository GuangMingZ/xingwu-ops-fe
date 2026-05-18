import type { ComponentType } from 'react';
import type { SdkRegistry as ISdkRegistry, SdkContext, UiComponentDecl } from '@xingwu/types';
import type { PluginRegistry } from '@/registry';
import type { LifecycleManager } from '@/lifecycle';
import type { ConfigCenter } from '@/config-center';
import type { SharedStateBus } from '@/shared-state';
import type { MonitorImpl, I18nImpl } from '@/infra';

export interface SdkRegistryDeps {
  lifecycle: LifecycleManager;
  configCenter: ConfigCenter;
  sharedState: SharedStateBus;
  monitor: MonitorImpl;
  i18n: I18nImpl;
}

/**
 * SdkRegistry — SDK 注册表门面
 *
 * 作为 PluginRegistry 的门面（Facade），仅暴露 SDK 消费侧 API。
 * 内部委托 PluginRegistry 完成 resolve，并通过 LifecycleManager 调用 activate。
 */
export class SdkRegistry implements ISdkRegistry {
  private componentCache: Map<string, Record<string, ComponentType<unknown>>> = new Map();
  private rerenderListeners = new Map<string, Set<() => void>>();

  constructor(
    private registry: PluginRegistry,
    private deps: SdkRegistryDeps,
  ) {}

  private rerenderKey(sdkName: string, componentName?: string): string {
    return componentName ? `${sdkName}:${componentName}` : sdkName;
  }

  private emitRerender(sdkName: string, componentName?: string): void {
    const keys = componentName
      ? [this.rerenderKey(sdkName, componentName), this.rerenderKey(sdkName)]
      : [this.rerenderKey(sdkName)];
    for (const key of keys) {
      this.rerenderListeners.get(key)?.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error(`[Xingwu] SdkRegistry rerender listener error (${key}):`, err);
        }
      });
    }
  }

  onRerender(sdkName: string, callback: () => void, componentName?: string): () => void {
    const key = this.rerenderKey(sdkName, componentName);
    if (!this.rerenderListeners.has(key)) {
      this.rerenderListeners.set(key, new Set());
    }
    this.rerenderListeners.get(key)!.add(callback);
    return () => {
      this.rerenderListeners.get(key)?.delete(callback);
    };
  }

  private buildSdkContext(name: string): SdkContext {
    const descriptor = this.registry.getDescriptor(name);
    if (!descriptor) {
      throw new Error(`[Xingwu] SDK "${name}" not registered.`);
    }
    const hasUi = (descriptor.uiComponents?.length ?? 0) > 0;
    return {
      descriptor,
      config: this.deps.configCenter.forPlugin(name) as SdkContext['config'],
      sharedState: this.deps.sharedState,
      infra: {
        monitor: this.deps.monitor,
        i18n: this.deps.i18n,
      },
      ui: hasUi
        ? {
            getSlot(slotName: string) {
              const decl = descriptor.uiComponents?.find((c) => c.slot === slotName);
              return decl ? { name: slotName, type: 'slot' } : undefined;
            },
            requestRerender: (componentName: string) => {
              this.emitRerender(name, componentName);
            },
          }
        : undefined,
    };
  }

  /** 检查 SDK 是否已注册 */
  has(name: string): boolean {
    const desc = this.registry.getDescriptor(name);
    return desc != null && desc.type === 'sdk';
  }

  /** 获取已激活 SDK 发布到 sharedState 的 API（约定 key：`{name}.api`） */
  get<T = unknown>(name: string): T | undefined {
    return this.deps.sharedState.getState<T>(`${name}.api`);
  }

  /** 加载并激活 SDK（返回约定发布到 sharedState 的 API） */
  async load<T = unknown>(name: string): Promise<T> {
    const desc = this.registry.getDescriptor(name);
    if (!desc || desc.type !== 'sdk') {
      throw new Error(`[Xingwu] "${name}" is not a registered SDK.`);
    }

    await this.registry.resolve(name);
    const instance = this.registry.getInstance(name)!;

    if (instance.status !== 'active') {
      const ctx = this.buildSdkContext(name);
      await this.deps.lifecycle.activateSdk(name, ctx);
      this.cacheComponentsFromInstance(name);
    }

    const api = this.deps.sharedState.getState<T>(`${name}.api`);
    if (api == null) {
      throw new Error(
        `[Xingwu] SDK "${name}" did not publish an API at sharedState key "${name}.api".`,
      );
    }
    return api;
  }

  /** 预加载：resolve + activate，使 SDK 在首屏即可用 */
  async preload(names: string[]): Promise<void> {
    for (const name of names) {
      try {
        const desc = this.registry.getDescriptor(name);
        if (!desc || desc.type !== 'sdk') continue;
        await this.registry.resolve(name);
        const instance = this.registry.getInstance(name);
        if (instance?.status === 'active') continue;
        await this.deps.lifecycle.activateSdk(name, this.buildSdkContext(name));
        // activate 后收集并缓存 UI 组件
        this.cacheComponentsFromInstance(name);
      } catch (err) {
        console.warn(`[Xingwu] Preload SDK "${name}" failed:`, err);
      }
    }
  }

  /** 通知 SDK 配置变更（版本灰度切换） */
  async reload(name: string): Promise<void> {
    const ctx = this.buildSdkContext(name);
    await this.deps.lifecycle.deactivateSdk(name, ctx);
    this.componentCache.delete(name);
    this.registry.setStatus(name, 'loaded');
    await this.deps.lifecycle.activateSdk(name, ctx);
    this.cacheComponentsFromInstance(name);
  }

  /** 获取 SDK 提供的 UI 组件 */
  getComponent<T extends ComponentType<any>>(
    sdkName: string,
    componentName: string,
  ): T | undefined {
    const cached = this.componentCache.get(sdkName);
    if (cached && cached[componentName]) {
      return cached[componentName] as T;
    }

    const instance = this.registry.getInstance(sdkName);
    if (!instance || instance.descriptor.type !== 'sdk') return undefined;

    if (instance.uiComponents && instance.uiComponents[componentName]) {
      return instance.uiComponents[componentName] as T;
    }

    return undefined;
  }

  /** 缓存 SDK 的 UI 组件（在 activate 后调用） */
  cacheComponents(sdkName: string, components: Record<string, ComponentType<unknown>>): void {
    this.componentCache.set(sdkName, components);
  }

  /** 从 PluginInstance 中提取并缓存 UI 组件 */
  private cacheComponentsFromInstance(sdkName: string): void {
    const instance = this.registry.getInstance(sdkName);
    if (instance?.uiComponents) {
      this.cacheComponents(sdkName, instance.uiComponents);
    }
  }

  /** 获取 SDK 描述符中声明的 uiComponent 列表 */
  getUiComponentDecls(sdkName: string): UiComponentDecl[] {
    const desc = this.registry.getDescriptor(sdkName);
    return desc?.uiComponents ?? [];
  }

  /** SDK 将 UI 渲染到宿主 DOM */
  async renderTo(
    sdkName: string,
    container: HTMLElement,
    options?: { slot?: string },
  ): Promise<void> {
    if (options?.slot) {
      container.dataset.xingwuSlot = options.slot;
    }
    await this.load(sdkName);
    const ctx = this.buildSdkContext(sdkName);
    await this.deps.lifecycle.renderSdk(sdkName, container, ctx);
  }

  /** 卸载宿主 DOM 上的 SDK UI */
  async unrenderFrom(sdkName: string, container: HTMLElement): Promise<void> {
    const instance = this.registry.getInstance(sdkName);
    if (!instance) return;
    const ctx = this.buildSdkContext(sdkName);
    await this.deps.lifecycle.unrenderSdk(sdkName, container, ctx);
  }
}
