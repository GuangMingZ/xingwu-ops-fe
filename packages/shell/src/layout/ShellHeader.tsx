import { Button, Dropdown, Layout, theme, Typography } from 'antd';
import type { Shell } from '@/bootstrap';
import { SdkSlotHost } from './SdkSlotHost';

const { Header } = Layout;

interface ShellHeaderProps {
  shell: Shell;
}

export function ShellHeader({ shell }: ShellHeaderProps) {
  const { token } = theme.useToken();

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
      <div className="flex items-center gap-3" key="actions">
        <SdkSlotHost
          key="region-picker-slot"
          shell={shell}
          sdkName="region-selector"
          slot="header-slot"
          className="inline-flex items-center"
        />
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
