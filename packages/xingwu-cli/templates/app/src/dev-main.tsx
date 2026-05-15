/**
 * 独立开发入口：不经过 Shell，仅在本地验证子应用 UI。
 */
import 'antd/dist/reset.css';
import '@styles/tailwind.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';
import { App } from '@/App';

const devCtx = {
  descriptor: {
    name: '{{name}}',
    type: 'app' as const,
    version: '1.0.0',
    entry: '',
    routePrefix: '{{routePrefix}}',
    navItem: { key: '{{name}}', label: '{{navLabel}}（独立开发）', icon: '📦' },
  },
  router: {
    params: {},
    query: {},
    navigate: () => {},
    beforeLeave: () => {},
  },
  config: { get: () => undefined as never, set: () => {}, watch: () => () => {} },
  sharedState: {
    getState: () => undefined,
    setState: () => {},
    subscribe: () => () => {},
    batchSet: () => {},
  },
  sdk: {
    has: () => false,
    get: () => undefined,
    load: async () => {
      throw new Error('[dev] SDK 未 mock');
    },
    preload: async () => {},
    reload: async () => {},
    getComponent: () => undefined,
  },
  infra: {
    monitor: { mark: () => {}, reportError: () => {} },
    i18n: { t: (k: string) => k, locale: 'zh', setLocale: () => {} },
    net: {} as AppContext['infra']['net'],
    permission: {} as AppContext['infra']['permission'],
  },
  container: document.getElementById('root')!,
} satisfies AppContext;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="{{routePrefix}}">
      <App ctx={devCtx} />
    </BrowserRouter>
  </StrictMode>,
);
