import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SdkContext } from '@xingwu/types';
import type { Region, RegionSelectorApi } from '@/api';
import { RegionPicker } from '@components/RegionPicker';
import { RegionBreadcrumb } from '@components/RegionBreadcrumb';

const roots = new WeakMap<HTMLElement, Root>();
const regionListeners = new WeakMap<HTMLElement, () => void>();

function getApi(ctx: SdkContext): RegionSelectorApi | undefined {
  return ctx.sharedState.getState<RegionSelectorApi>('region-selector.api');
}

function slotComponentName(slot: string): string {
  if (slot === 'header-slot') return 'RegionPicker';
  if (slot === 'breadcrumb') return 'RegionBreadcrumb';
  return slot;
}

function renderIntoContainer(container: HTMLElement, ctx: SdkContext): void {
  const slot = container.dataset.xingwuSlot ?? '';
  const api = getApi(ctx);
  if (!api) return;

  const regions = api.getAvailableRegions();
  const currentRegion = api.getCurrentRegion();

  let element: ReactNode = null;
  if (slot === 'header-slot') {
    element = (
      <RegionPicker
        regions={regions}
        currentRegion={currentRegion}
        onChange={(region: Region) => api.setCurrentRegion(region.id)}
      />
    );
  } else if (slot === 'breadcrumb') {
    element = <RegionBreadcrumb regions={regions} currentRegion={currentRegion} />;
  }

  if (!element) return;

  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(element);

  regionListeners.get(container)?.();
  const unsub = api.onRegionsUpdated(() => {
    ctx.ui?.requestRerender(slotComponentName(slot));
  });
  regionListeners.set(container, unsub);
}

export async function renderSdkUi(container: HTMLElement, ctx: SdkContext): Promise<void> {
  renderIntoContainer(container, ctx);
}

export function unrenderSdkUi(container: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      regionListeners.get(container)?.();
      regionListeners.delete(container);
      const root = roots.get(container);
      root?.unmount();
      roots.delete(container);
      resolve();
    });
  });
}
