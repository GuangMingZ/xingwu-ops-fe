import 'antd/dist/reset.css';
import '@styles/tailwind.css';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import React from 'react';
import ReactDOM from 'react-dom';
import {
  App as AntdApp,
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Result,
  Select,
  Space,
  Typography,
} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { GlobalOutlined } from '@ant-design/icons';
import { createRoot } from 'react-dom/client';
import { createShell } from '@/bootstrap';
import { ShellApp } from '@/App';
import type { ShellConfig, PluginDescriptor } from '@xingwu/types';

dayjs.locale('zh-cn');

/**
 * 将 React / ReactDOM 挂载到全局，供远程加载的 SDK 模块复用，
 * 避免双 React 实例导致 hooks 崩溃。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__REACT_SHARED__ = {
  React,
  ReactDOM,
};

/** 与远程 SDK 共用 antd 子集（region-selector shims 读取），避免 `import * as antd` 打进整库 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__ANTD_SHARED__ = {
  antd: { Breadcrumb, Button, Dropdown, Empty, Select, Space, Typography },
  icons: { GlobalOutlined },
};

/** 开发态走 Vite 源码入口；生产可改为 CDN 或同源的 `/assets/region-selector.mjs` */
const REGION_SELECTOR_SDK_ENTRY = import.meta.env.DEV
  ? 'http://localhost:5176/src/index.tsx'
  : `${typeof window !== 'undefined' ? window.location.origin : ''}/sdk/region-selector.mjs`;

/** 错误降级组件 */
function ErrorFallback({ error }: { error: Error }) {
  return <Result status="error" title="应用出错" subTitle={error.message} />;
}

/** 开发模式下的本地插件描述符 */
const devDescriptors: PluginDescriptor[] = [
  {
    name: 'product',
    type: 'app',
    version: '1.0.0',
    entry: 'http://localhost:5174/src/index.tsx',
    routePrefix: '/product',
    dependencies: ['region-selector'],
    navItem: {
      key: 'product',
      label: '商品管理',
      icon: '📦',
      order: 100,
      children: [{ key: '', label: '商品列表' }],
    },
  },
  // {
  //   name: 'auth-guard',
  //   type: 'sdk',
  //   version: '1.2.0',
  //   entry: 'http://localhost:5175/src/index.ts',
  //   preload: true,
  //   exports: ['AuthGuardApi'],
  // },
  {
    name: 'region-selector',
    type: 'sdk',
    version: '2.1.0',
    entry: REGION_SELECTOR_SDK_ENTRY,
    preload: true,
    exports: ['RegionSelectorApi'],
    uiComponents: [
      {
        name: 'RegionPicker',
        description: '区域选择器下拉组件',
        slot: 'header-slot',
      },
      {
        name: 'RegionBreadcrumb',
        description: '区域面包屑导航',
        slot: 'breadcrumb',
      },
    ],
    styleStrategy: 'css-modules',
  },
];

const config: ShellConfig = {
  appName: 'OpsConsole',
  defaultTitle: '管理后台',
  router: {
    mode: 'history',
    basename: '/',
    beforeNavigate: async () => true,
  },
  configCenter: {
    remoteUrl: '/api/v1/config',
    refreshInterval: 60000,
    cacheKey: '__xingwu_config',
  },
  plugins: {
    descriptors: devDescriptors,
    preloadSdks: ['region-selector'],
  },
  layout: {
    header: () => null,
    sidebar: () => null,
    contentContainerId: 'app-area',
  },
  monitor: {
    dsn: 'https://monitor.example.com',
    sampleRate: 0.1,
    environment: 'development',
  },
  i18n: {
    defaultLocale: 'zh',
    supportedLocales: ['zh', 'en'],
  },
  errorBoundary: {
    fallback: ErrorFallback,
  },
};

const shell = createShell(config);

async function bootstrap() {
  await shell.mount('#root');

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <ShellApp shell={shell} config={config} />
        </AntdApp>
      </ConfigProvider>
    </React.StrictMode>,
  );
}

bootstrap().catch((err) => {
  console.error('[Xingwu] Bootstrap failed:', err);
});

export { shell };
