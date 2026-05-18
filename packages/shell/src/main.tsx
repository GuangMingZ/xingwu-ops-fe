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
import type { ShellConfig } from '@xingwu/types';

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

function ErrorFallback({ error }: { error: Error }) {
  return <Result status="error" title="应用出错" subTitle={error.message} />;
}

/** Shell 运行时配置（插件列表见 config/apps.json、config/sdks.json） */
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
    apps: '/config/apps.json',
    sdks: '/config/sdks.json',
  },
  layout: {
    header: () => null,
    sidebar: () => null,
    contentContainerId: 'app-area',
  },
  monitor: {
    dsn: 'https://monitor.example.com',
    sampleRate: 0.1,
    environment: import.meta.env.PROD ? 'production' : 'development',
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
