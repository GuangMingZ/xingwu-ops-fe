import type { AppDescriptor, SdkDescriptor, RedirectRule } from '@/plugin';
import type { PermissionConfig } from '@/infra';

/** Shell 配置 */
export interface ShellConfig {
  /** 应用名称 */
  appName: string;
  /** 默认标题 */
  defaultTitle: string;

  /** 路由配置 */
  router: {
    mode: 'history' | 'hash';
    basename: string;
    beforeNavigate?: (to: string, from: string) => boolean | Promise<boolean>;
  };

  /** 配置中心 */
  configCenter: {
    remoteUrl: string;
    refreshInterval: number;
    cacheKey: string;
  };

  /** 插件配置 */
  plugins: {
    /** 子应用列表，或 apps.json 的 URL（如 /config/apps.json） */
    apps: AppDescriptor[] | string;
    /** SDK 列表，或 sdks.json 的 URL（如 /config/sdks.json） */
    sdks: SdkDescriptor[] | string;
    /** 预加载 SDK 名；未指定时取 sdks 中 preload: true 的项 */
    preloadSdks?: string[];
    /** 子应用卸载后驱逐 ESM 模块缓存，默认 true */
    evictOnUnmount?: boolean;
  };

  /** 布局配置 */
  layout: {
    header: React.ComponentType;
    sidebar: React.ComponentType;
    contentContainerId: string;
  };

  /** 监控配置 */
  monitor: {
    dsn: string;
    sampleRate: number;
    environment: string;
  };

  /** 国际化 */
  i18n: I18nConfig;

  /** 错误降级 */
  errorBoundary: {
    fallback: React.ComponentType<{ error: Error }>;
  };

  /** 权限初始配置（可选，未配置时采用 Deny-by-default 策略） */
  permission?: PermissionConfig;
}

/** 国际化配置 */
export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackMap?: Record<string, string>;
}

/** Shell 路由配置 */
export interface ShellRouterConfig {
  mode: 'history' | 'hash';
  beforeNavigate?: (to: string, from: string) => boolean | Promise<boolean>;
  redirects?: RedirectRule[];
}
