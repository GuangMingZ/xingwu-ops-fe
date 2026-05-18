import type { SdkLifecycle, SdkContext } from '@xingwu/types';
import { {{apiClassName}} } from '@/api';
import { {{pascalName}}Panel } from '@components/{{pascalName}}Panel';

const lifecycle: SdkLifecycle = {
  async activate(ctx: SdkContext) {
    const api = new {{apiClassName}}(ctx);
    ctx.sharedState.setState('{{name}}.api', api);
    console.info('[SDK:{{name}}] Activated.');
  },

  async deactivate(ctx: SdkContext) {
    ctx.sharedState.setState('{{name}}.api', undefined);
    console.info('[SDK:{{name}}] Deactivated.');
  },

  onError(error, ctx) {
    ctx.infra.monitor.reportError('sdk-{{name}}-error', error);
  },

  getComponents() {
    return {
      {{pascalName}}Panel,
    };
  },

  render(container, ctx) {
    // 可选：由壳层 SdkSlotHost 传入 DOM，SDK 自主挂载 UI
    void container;
    void ctx;
  },

  unrender(container) {
    void container;
  },
};

export default lifecycle;
export { {{apiClassName}} } from '@/api';
