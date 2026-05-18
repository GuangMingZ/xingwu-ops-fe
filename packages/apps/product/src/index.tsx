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

/** 用容器节点关联 Root，不写入 SharedState */
const rootByContainer = new WeakMap<HTMLElement, Root>();

const lifecycle: AppLifecycle = {
  async mount(ctx: AppContext) {
    // 触发条件：壳层在竞态窗口内重复 mount 同一容器
    // 与正常路径差异：应先卸载已有 Root 再 createRoot
    // 修复原因：避免同容器双 React Root 导致内存泄漏
    const existing = rootByContainer.get(ctx.container);
    if (existing) {
      existing.unmount();
      rootByContainer.delete(ctx.container);
    }
    const root = createRoot(ctx.container);
    rootByContainer.set(ctx.container, root);
    /** Shell 与子应用是不同 React Root，Router Context 不共享；此处必须自带 Router，Link 才能工作 */
    const basename = ctx.descriptor.routePrefix || '/product';
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
    return <Result status="error" title="商品管理模块出错" subTitle={error.message} />;
  },
};

export default lifecycle;
