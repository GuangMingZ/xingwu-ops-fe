import type { ShellConfig } from '@xingwu/types';
import { loadPluginConfig } from '@/config/loadPluginConfig';
import { PluginRegistry } from '@/registry';
import { ConfigCenter } from '@/config-center';
import { SharedStateBus } from '@/shared-state';
import { SdkRegistry } from '@/sdk-registry';
import { LifecycleManager } from '@/lifecycle';
import { MonitorImpl, I18nImpl, NetClientImpl, PermissionCheckerImpl } from '@/infra';

/**
 * Shell — 星坞框架壳层核心
 *
 * 聚合所有核心模块，提供统一的框架初始化与运行时能力。
 */
export class Shell {
  readonly registry: PluginRegistry;
  readonly configCenter: ConfigCenter;
  readonly sharedState: SharedStateBus;
  readonly sdkRegistry: SdkRegistry;
  readonly lifecycle: LifecycleManager;
  readonly monitor: MonitorImpl;
  readonly i18n: I18nImpl;
  readonly net: NetClientImpl;
  readonly permission: PermissionCheckerImpl;

  readonly config: ShellConfig;
  private container: HTMLElement | null = null;

  constructor(config: ShellConfig) {
    this.config = config;

    // 初始化基础设施
    this.monitor = new MonitorImpl(config.monitor);
    this.i18n = new I18nImpl(config.i18n);
    this.net = new NetClientImpl();
    this.permission = new PermissionCheckerImpl();

    // 初始化核心模块
    this.registry = new PluginRegistry();
    this.configCenter = new ConfigCenter(config.configCenter);
    this.sharedState = new SharedStateBus();
    this.lifecycle = new LifecycleManager(this.registry, {
      evictOnUnmount: config.plugins.evictOnUnmount !== false,
    });
    this.sdkRegistry = new SdkRegistry(this.registry, {
      lifecycle: this.lifecycle,
      configCenter: this.configCenter,
      sharedState: this.sharedState,
      monitor: this.monitor,
      i18n: this.i18n,
    });
  }

  /** 初始化框架 */
  async init(): Promise<void> {
    const { plugins } = this.config;

    const { apps, sdks, preloadSdkNames } = await loadPluginConfig(plugins);
    this.registry.registerApps(apps);
    this.registry.registerSdks(sdks);

    if (preloadSdkNames.length > 0) {
      await this.sdkRegistry.preload(preloadSdkNames);
    }

    // 启动配置中心远程刷新
    this.configCenter.startRefresh();

    console.info(`[Xingwu] Shell "${this.config.appName}" initialized.`);
  }

  /** 挂载应用到 DOM */
  async mount(selector: string | HTMLElement): Promise<void> {
    this.container =
      typeof selector === 'string' ? document.querySelector<HTMLElement>(selector)! : selector;

    if (!this.container) {
      throw new Error(`[Xingwu] Mount container not found: ${selector}`);
    }

    await this.init();
  }

  /** 销毁框架 */
  async destroy(): Promise<void> {
    this.configCenter.stopRefresh();
    await this.lifecycle.unmountActiveApp();
    console.info(`[Xingwu] Shell "${this.config.appName}" destroyed.`);
  }
}

/**
 * createShell — 创建 Shell 实例
 */
export function createShell(config: ShellConfig): Shell {
  return new Shell(config);
}
