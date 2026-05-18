import type { SdkLifecycle, SdkContext } from '@xingwu/types';
import { RegionSelectorApi } from '@/api';
import { RegionPicker } from '@components/RegionPicker';
import { RegionBreadcrumb } from '@components/RegionBreadcrumb';
import { renderSdkUi, unrenderSdkUi } from '@/sdkRender';

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

  /** 供子应用等宿主通过 SdkRegistry.getComponent 显式引用 */
  getComponents(_ctx: SdkContext) {
    return {
      RegionPicker,
      RegionBreadcrumb,
    };
  },

  /** 壳层 SdkSlotHost 调用：SDK 自主渲染到宿主 DOM */
  render(container, ctx) {
    return renderSdkUi(container, ctx);
  },

  unrender(container) {
    return unrenderSdkUi(container);
  },
};

export default lifecycle;
export { RegionSelectorApi } from '@/api';
export { RegionPicker } from '@components/RegionPicker';
export { RegionBreadcrumb } from '@components/RegionBreadcrumb';
