import type { SdkLifecycle, SdkContext } from '@xingwu/types';
import { RegionSelectorApi } from '@/api';
import { RegionPicker } from '@components/RegionPicker';
import { RegionBreadcrumb } from '@components/RegionBreadcrumb';

const lifecycle: SdkLifecycle = {
  async activate(ctx: SdkContext) {
    const regions = ctx.config.get<Array<{ id: string; name: string }>>('regions') || [
      { id: 'cn-east', name: '华东' },
      { id: 'cn-south', name: '华南' },
      { id: 'cn-north', name: '华北' },
      { id: 'cn-west', name: '西南' },
    ];
    const api = new RegionSelectorApi(regions, ctx);
    ctx.sharedState.setState('region-selector.api', api);
    console.info('[SDK:region-selector] Activated with regions:', regions.map((r) => r.name));
  },

  async deactivate(ctx: SdkContext) {
    ctx.sharedState.setState('region-selector.api', undefined);
    console.info('[SDK:region-selector] Deactivated.');
  },

  onError(error, ctx) {
    ctx.infra.monitor.reportError('sdk-region-selector-error', error);
  },

  /** 暴露 UI 组件供宿主渲染 */
  getComponents(_ctx: SdkContext) {
    return {
      RegionPicker,
      RegionBreadcrumb,
    };
  },
};

export default lifecycle;
export { RegionSelectorApi } from '@/api';
