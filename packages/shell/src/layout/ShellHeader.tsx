import { Button, Dropdown, Layout, theme, Typography } from 'antd';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import type { Shell } from '@/bootstrap';

const { Header } = Layout;

interface ShellHeaderProps {
  shell: Shell;
}

export function ShellHeader({ shell }: ShellHeaderProps) {
  const { token } = theme.useToken();
  const [, forceUpdate] = useState(0);

  type RegionApi = {
    getAvailableRegions: () => Array<{ id: string; name: string }>;
    getCurrentRegion: () => { id: string; name: string };
    setCurrentRegion: (id: string) => void;
    onRegionsUpdated: (cb: () => void) => () => void;
  };

  // 从 SDK 注册表获取 RegionPicker 组件
  const RegionPicker = shell.sdkRegistry.getComponent<
    ComponentType<{
      regions?: Array<{ id: string; name: string }>;
      currentRegion?: { id: string; name: string };
      onChange?: (region: { id: string; name: string }) => void;
    }>
  >('region-selector', 'RegionPicker');

  const api = shell.sdkRegistry.get<RegionApi>('region-selector');

  useEffect(() => {
    if (!api) return;
    return api.onRegionsUpdated(() => forceUpdate((n) => n + 1));
  }, [api]);

  return (
    <Header
      className="flex items-center justify-between px-6"
      style={{
        height: 48,
        lineHeight: '48px',
        paddingInline: 24,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Typography.Text key="title" strong className="text-base">
        星坞 · OpsConsole
      </Typography.Text>
      <div key="actions" className="flex items-center gap-3">
        {/* header-slot: RegionPicker */}
        {RegionPicker && api ? (
          <RegionPicker
            key="region-picker"
            regions={api.getAvailableRegions()}
            currentRegion={api.getCurrentRegion()}
            onChange={(region) => api.setCurrentRegion(region.id)}
          />
        ) : null}
        <Dropdown
          key="system-menu"
          menu={{
            items: [
              { key: 'about', label: '关于星坞' },
              { key: 'docs', label: '帮助文档' },
            ],
          }}
        >
          <Button>系统菜单</Button>
        </Dropdown>
      </div>
    </Header>
  );
}
