import type { SdkLifecycle, SdkContext } from '@xingwu/types';
import { AuthGuardApi } from '@/api';

const lifecycle: SdkLifecycle = {
  async activate(ctx: SdkContext) {
    const api = new AuthGuardApi(ctx);
    ctx.sharedState.setState('auth-guard.api', api);
    ctx.sharedState.setState('auth-guard.ready', true);
    console.info('[SDK:auth-guard] Activated.');
  },

  async deactivate(ctx: SdkContext) {
    ctx.sharedState.setState('auth-guard.api', undefined);
    ctx.sharedState.setState('auth-guard.ready', undefined);
    console.info('[SDK:auth-guard] Deactivated.');
  },

  onError(error, ctx) {
    ctx.infra.monitor.reportError('sdk-auth-guard-error', error);
  },
};

export default lifecycle;
export { AuthGuardApi } from '@/api';
