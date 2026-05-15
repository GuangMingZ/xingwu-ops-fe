import type { SdkContext } from '@xingwu/types';

export interface Region {
  id: string;
  name: string;
}

/**
 * RegionSelectorApi — 区域选择器 API
 *
 * 提供区域列表查询、当前区域获取/设置等纯逻辑能力。
 */
export class RegionSelectorApi {
  private regions: Region[];
  private currentRegion: Region;
  private ctx: SdkContext;
  private listeners: Array<() => void> = [];

  constructor(regions: Region[], ctx: SdkContext) {
    this.regions = regions;
    this.ctx = ctx;
    const defaultRegionId = ctx.config.get<string>('defaultRegion');
    this.currentRegion =
      regions.find((r) => r.id === defaultRegionId) || regions[0] || { id: 'default', name: '默认' };
  }

  /** 获取所有可用区域 */
  getAvailableRegions(filter?: { product?: string }): Region[] {
    // 简化实现：返回全部区域
    void filter;
    return this.regions;
  }

  /** 获取当前选中区域 */
  getCurrentRegion(): Region {
    return this.currentRegion;
  }

  /** 设置当前区域 */
  setCurrentRegion(regionId: string): void {
    const region = this.regions.find((r) => r.id === regionId);
    if (region) {
      this.currentRegion = region;
      this.ctx.sharedState.setState('region-selector.current', region);
      this.notifyListeners();
    }
  }

  /** 监听区域变更 */
  onRegionsUpdated(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }
}
