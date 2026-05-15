import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PluginDescriptor } from '@xingwu/types';

const { Sider } = Layout;

interface OpsSidebarProps {
  descriptors: PluginDescriptor[];
}

export function OpsSidebar({ descriptors }: OpsSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const appDescriptors = descriptors.filter((d) => d.type === 'app' && d.navItem && d.routePrefix);

  const items: MenuProps['items'] = useMemo(
    () =>
      appDescriptors.map((desc) => {
        const prefix = (desc.routePrefix || '').replace(/\/$/, '');
        const rawChildren = desc.navItem?.children;
        const childItems = rawChildren?.map((child) => {
          const tail = child.key.split('.').pop() ?? '';
          const path = tail ? `${prefix}/${tail}` : prefix;
          return { key: path, label: child.label };
        }) ?? [{ key: prefix, label: desc.navItem?.label || '首页' }];

        return {
          key: `sub-${desc.name}`,
          label: desc.navItem?.label,
          icon: desc.navItem?.icon ? <span>{desc.navItem.icon}</span> : undefined,
          children: childItems,
        };
      }),
    [appDescriptors],
  );

  const selectedKey = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '') || '/';
    for (const d of appDescriptors) {
      const p = (d.routePrefix || '').replace(/\/$/, '');
      if (path === p || path.startsWith(`${p}/`)) {
        const rawChildren = d.navItem?.children;
        const paths: string[] = rawChildren?.map((child) => {
          const tail = child.key.split('.').pop() ?? '';
          return tail ? `${p}/${tail}` : p;
        }) ?? [p];
        const hit =
          paths
            .filter((k) => path === k || path.startsWith(`${k}/`))
            .sort((a, b) => b.length - a.length)[0] ?? p;
        return hit;
      }
    }
    return path;
  }, [appDescriptors, location.pathname]);

  return (
    <Sider width={220} theme="dark" className="min-h-[calc(100vh-48px)]">
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={appDescriptors.map((d) => `sub-${d.name}`)}
        items={items}
        onClick={({ key }) => {
          if (!key.startsWith('sub-')) {
            navigate(key);
          }
        }}
      />
    </Sider>
  );
}
