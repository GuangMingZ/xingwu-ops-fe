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
};

export default lifecycle;
export { {{apiClassName}} } from '@/api';
