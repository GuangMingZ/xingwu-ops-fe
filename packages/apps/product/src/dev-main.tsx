/**
 * 独立开发入口：不经过 Shell，仅在本地验证子应用 UI 与路由。
 * 生产 / 联调仍由 Shell 通过 entry URL 加载 `src/index.tsx` 导出生命周期。
 */
import 'antd/dist/reset.css';
import '@styles/tailwind.css';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { App as AntdApp, Alert, ConfigProvider, Spin, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import type {
  AppContext,
  SdkRegistry,
  TypedConfig,
  SharedStateBus,
  Monitor,
  I18n,
  NetClient,
  PermissionChecker,
  Subscriber,
} from '@xingwu/types';
import { App } from '@/App';

dayjs.locale('zh-cn');

class DevSharedState implements SharedStateBus {
  private map = new Map<string, unknown>();
  getState<T>(key: string): T | undefined {
    return this.map.get(key) as T | undefined;
  }
  setState<T>(key: string, value: T | ((prev: T) => T)): void {
    const next =
      typeof value === 'function' ? (value as (prev: T) => T)(this.getState(key) as T) : value;
    this.map.set(key, next);
  }
  subscribe<T>(_key: string, _cb: Subscriber<T>): () => void {
    return () => {};
  }
  batchSet(): void {}
}

const devSharedState = new DevSharedState();

const devSdk: SdkRegistry = {
  has: (name) => name === 'region-selector',
  get: () => undefined,
  load: async <T = unknown,>(name: string): Promise<T> => {
    if (name === 'region-selector') {
      return {
        getAvailableRegions: () => [
          { id: 'cn-east', name: '华东' },
          { id: 'cn-south', name: '华南' },
        ],
        getCurrentRegion: () => ({ id: 'cn-east', name: '华东（独立开发）' }),
        setCurrentRegion: () => {},
        onRegionsUpdated: () => () => {},
      } as T;
    }
    throw new Error(`[dev] SDK "${String(name)}" 未在独立开发模式 mock`);
  },
  preload: async () => {},
  reload: async () => {},
  getComponent: () => undefined,
};

const devConfig: TypedConfig = {
  get: () => undefined as never,
  set: () => {},
  watch: () => () => {},
};

const noopMonitor: Monitor = {
  mark: () => {},
  reportError: () => {},
};

const noopI18n: I18n = {
  t: (k) => k,
  locale: 'zh',
  setLocale: () => {},
};

const noopNet = {} as NetClient;
const noopPerm = {} as PermissionChecker;

function buildDevContext(navigate: NavigateFunction, container: HTMLElement): AppContext {
  return {
    descriptor: {
      name: 'product',
      type: 'app',
      version: '1.0.0',
      entry: '',
      routePrefix: '/product',
      navItem: {
        key: 'product',
        label: '商品管理（独立开发）',
        icon: '📦',
      },
    },
    router: {
      params: {},
      query: {},
      navigate: (to, options) => navigate(to, { replace: options?.replace, state: options?.state }),
      beforeLeave: () => {},
    },
    config: devConfig,
    sharedState: devSharedState,
    sdk: devSdk,
    infra: {
      monitor: noopMonitor,
      i18n: noopI18n,
      net: noopNet,
      permission: noopPerm,
    },
    container,
  };
}

function DevApp() {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<AppContext | null>(null);

  useLayoutEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    setCtx(buildDevContext(navigate, el));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Alert
        banner
        type="warning"
        showIcon
        className="rounded-none border-x-0 border-t-0"
        message={
          <span className="text-[13px]">
            独立开发模式：路由 basename 为 <Typography.Text code>/product</Typography.Text>
            。联调请同时启动 Shell（端口 3000）并保留本服务在{' '}
            <Typography.Text strong>5174</Typography.Text>
            （勿占用该端口）。
          </span>
        }
      />
      <div ref={mountRef} className="p-4">
        {ctx ? (
          <App ctx={ctx} />
        ) : (
          <div className="flex justify-center py-8">
            <Spin tip="正在初始化…" />
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <AntdApp>
        <BrowserRouter basename="/product">
          <DevApp />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
