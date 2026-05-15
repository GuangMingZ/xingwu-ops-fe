import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import type { Shell } from '@/bootstrap';

interface BreadcrumbSlotProps {
  shell: Shell;
}

/** breadcrumb 插槽：渲染 RegionBreadcrumb */
export function BreadcrumbSlot({ shell }: BreadcrumbSlotProps) {
  const [, bump] = useState(0);

  type RegionApi = {
    getAvailableRegions: () => Array<{ id: string; name: string }>;
    getCurrentRegion: () => { id: string; name: string };
    onRegionsUpdated: (cb: () => void) => () => void;
  };

  const RegionBreadcrumb = shell.sdkRegistry.getComponent<
    ComponentType<{
      regions?: Array<{ id: string; name: string }>;
      currentRegion?: { id: string; name: string };
    }>
  >('region-selector', 'RegionBreadcrumb');

  const api = shell.sdkRegistry.get<RegionApi>('region-selector');

  useEffect(() => {
    if (!api) return;
    return api.onRegionsUpdated(() => bump((n) => n + 1));
  }, [api]);

  if (!RegionBreadcrumb || !api) return null;

  return (
    <RegionBreadcrumb regions={api.getAvailableRegions()} currentRegion={api.getCurrentRegion()} />
  );
}
