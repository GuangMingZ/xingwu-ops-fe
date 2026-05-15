import { useMemo } from 'react';
import type { Region } from '@/api';
import { getHostAntd } from '@/shims/host-antd';
import { getHostIcons } from '@/shims/host-icons';

interface RegionBreadcrumbProps {
  regions?: Region[];
  currentRegion?: Region;
}

export function RegionBreadcrumb({ regions = [], currentRegion }: RegionBreadcrumbProps) {
  const { Breadcrumb, Space, Typography } = useMemo(() => getHostAntd(), []);
  const { GlobalOutlined } = useMemo(() => getHostIcons(), []);

  if (!currentRegion) return null;

  const others = regions.filter((r) => r.id !== currentRegion.id);

  return (
    <Breadcrumb
      style={{ marginBottom: 16 }}
      items={[
        {
          title: (
            <Space size={6}>
              <Typography.Text type="secondary">
                <GlobalOutlined />
              </Typography.Text>
              <Typography.Text strong>{currentRegion.name}</Typography.Text>
            </Space>
          ),
        },
        ...others.map((r) => ({
          title: <Typography.Text type="secondary">{r.name}</Typography.Text>,
        })),
      ]}
    />
  );
}
