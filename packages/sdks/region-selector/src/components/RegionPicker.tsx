import { useMemo } from 'react';
import type { Region } from '@/api';
import { getHostAntd } from '@/shims/host-antd';
import { getHostIcons } from '@/shims/host-icons';

interface RegionPickerProps {
  regions?: Region[];
  currentRegion?: Region;
  onChange?: (region: Region) => void;
}

/**
 * 区域选择：宿主 antd `Select`，与 Shell 共用同一 UI 栈（window.__ANTD_SHARED__）。
 */
export function RegionPicker({ regions = [], currentRegion, onChange }: RegionPickerProps) {
  const { Empty, Select } = useMemo(() => getHostAntd(), []);
  const { GlobalOutlined } = useMemo(() => getHostIcons(), []);

  const options = useMemo(
    () => regions.map((r) => ({ label: r.name, value: r.id })),
    [regions],
  );

  const value = currentRegion?.id ?? regions[0]?.id;

  if (!regions.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用区域" />;
  }

  return (
    <Select
      value={value}
      placeholder="选择区域"
      style={{ minWidth: 160 }}
      options={options}
      suffixIcon={<GlobalOutlined />}
      onChange={(id) => {
        const r = regions.find((x) => x.id === id);
        if (r) onChange?.(r);
      }}
    />
  );
}
