import { Layout, Result, Typography } from 'antd';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ShellConfig } from '@xingwu/types';
import type { Shell } from '@/bootstrap';
import { ShellHeader, OpsSidebar, AppOutlet, BreadcrumbSlot } from '@/layout';

const { Content } = Layout;

interface AppProps {
  shell: Shell;
  config: ShellConfig;
}

function NotFound() {
  return <Result status="404" title="404" subTitle="页面不存在" />;
}

/** 壳层根组件 */
export function ShellApp({ shell, config }: AppProps) {
  const descriptors = shell.registry.getAll().map((i) => i.descriptor);

  return (
    <BrowserRouter basename={config.router.basename}>
      <Layout className="min-h-screen">
        {/* antd Layout 会遍历 children 克隆节点，必须为直接子节点提供稳定 key */}
        <ShellHeader key="shell-header" shell={shell} />
        <Layout key="shell-body" hasSider>
          <OpsSidebar key="shell-sider" descriptors={descriptors} />
          <Content key="shell-content" className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
            <BreadcrumbSlot shell={shell} />
            <Routes>
              {descriptors
                .filter((d) => d.type === 'app' && d.routePrefix)
                .map((d) => (
                  <Route
                    key={d.name}
                    path={`${d.routePrefix!.replace(/^\//, '')}/*`}
                    element={<AppOutlet shell={shell} />}
                  />
                ))}
              <Route
                path="/"
                element={
                  <Typography.Paragraph type="secondary" className="m-0">
                    欢迎使用星坞管理后台
                  </Typography.Paragraph>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}
