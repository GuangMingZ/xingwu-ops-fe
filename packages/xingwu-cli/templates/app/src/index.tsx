import 'antd/dist/reset.css';
import '@styles/tailwind.css';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import type { AppLifecycle, AppContext } from '@xingwu/types';
import { App as AntdApp, ConfigProvider, Result } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';

dayjs.locale('zh-cn');

const rootByContainer = new WeakMap<HTMLElement, Root>();

const lifecycle: AppLifecycle = {
  async mount(ctx: AppContext) {
    const root = createRoot(ctx.container);
    rootByContainer.set(ctx.container, root);
    const basename = ctx.descriptor.routePrefix || '{{routePrefix}}';
    root.render(
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <BrowserRouter basename={basename}>
            <App ctx={ctx} />
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>,
    );
  },

  async unmount(ctx: AppContext) {
    const root = rootByContainer.get(ctx.container);
    root?.unmount();
    rootByContainer.delete(ctx.container);
  },

  onError(error) {
    return <Result status="error" title="{{navLabel}}模块出错" subTitle={error.message} />;
  },
};

export default lifecycle;
