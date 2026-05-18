import type { Shell } from '@/bootstrap';
import { SdkSlotHost } from './SdkSlotHost';

interface BreadcrumbSlotProps {
  shell: Shell;
}

/** breadcrumb 插槽：由 region-selector SDK 自主渲染 */
export function BreadcrumbSlot({ shell }: BreadcrumbSlotProps) {
  return (
    <SdkSlotHost shell={shell} sdkName="region-selector" slot="breadcrumb" className="mb-4" />
  );
}
