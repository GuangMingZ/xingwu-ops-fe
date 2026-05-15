import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Alert,
  Layout,
  Menu,
  Result,
  Spin,
  theme,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ComponentType } from 'react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type { AppContext, PluginDescriptor, ShellConfig } from '@xingwu/types';
import type { Shell } from '@/bootstrap';

const { Header, Sider, Content } = Layout;

interface AppProps {
  shell: Shell;
  config: ShellConfig;
}

function ShellHeader({ shell }: { shell: Shell }) {
  const { token } = theme.useToken();
  const [, forceUpdate] = useState(0);

  type RegionApi = {
    getAvailableRegions: () => Array<{ id: string; name: string }>;
    getCurrentRegion: () => { id: string; name: string };
    setCurrentRegion: (id: string) => void;
    onRegionsUpdated: (cb: () => void) => () => void;
  };

  // 从 SDK 注册表获取 RegionPicker 组件
  const RegionPicker = shell.sdkRegistry.getComponent<ComponentType<{
    regions?: Array<{ id: string; name: string }>;
    currentRegion?: { id: string; name: string };
    onChange?: (region: { id: string; name: string }) => void;
  }>>('region-selector', 'RegionPicker');

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
      <Typography.Text strong className="text-base">
        星坞 · OpsConsole
      </Typography.Text>
      <div className="flex items-center gap-3">
        {/* header-slot: RegionPicker */}
        {RegionPicker && api && (
          <RegionPicker
            regions={api.getAvailableRegions()}
            currentRegion={api.getCurrentRegion()}
            onChange={(region) => api.setCurrentRegion(region.id)}
          />
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              系统菜单
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={6}
              className="z-[3000] min-w-[160px] rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
            >
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm text-neutral-800 outline-none data-[highlighted]:bg-neutral-100">
                关于星坞
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-sm text-neutral-800 outline-none data-[highlighted]:bg-neutral-100">
                帮助文档
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </Header>
  );
}

function OpsSidebar({ descriptors }: { descriptors: PluginDescriptor[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appDescriptors = descriptors.filter((d) => d.type === 'app' && d.navItem && d.routePrefix);

  const items: MenuProps['items'] = useMemo(
    () =>
      appDescriptors.map((desc) => {
        const prefix = (desc.routePrefix || '').replace(/\/$/, '');
        const rawChildren = desc.navItem?.children;
        const childItems =
          rawChildren?.map((child) => {
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
        const paths: string[] =
          rawChildren?.map((child) => {
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

/** 根据当前 URL 解析子应用路由参数（示例：/product/detail/:id） */
function routeParamsFor(pathname: string, routePrefix: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!pathname.startsWith(routePrefix)) return params;
  const tail = pathname.slice(routePrefix.length).replace(/^\//, '');
  const parts = tail.split('/').filter(Boolean);
  if (parts[0] === 'detail' && parts[1]) {
    params.productId = parts[1];
  }
  return params;
}

/** 子应用挂载容器：固定 DOM + 覆盖层 loading，避免卸载挂载点 */
function AppOutlet({ shell }: { shell: Shell }) {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const descriptor = shell.registry.findByRoute(location.pathname);
    if (!descriptor) return;

    const el = mountRef.current;
    if (!el) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const ctx: AppContext = {
      descriptor,
      router: {
        params: routeParamsFor(location.pathname, descriptor.routePrefix || ''),
        query: Object.fromEntries(new URLSearchParams(location.search)),
        navigate: (to, options) => {
          navigate(to, { replace: options?.replace, state: options?.state });
        },
        beforeLeave: (guard) => {
          shell.lifecycle.registerRouteGuard(guard);
        },
      },
      config: shell.configCenter.forPlugin(descriptor.name),
      sharedState: shell.sharedState,
      sdk: shell.sdkRegistry,
      infra: {
        monitor: shell.monitor,
        i18n: shell.i18n,
        net: shell.net,
        permission: shell.permission,
      },
      container: el,
    };

    void (async () => {
      try {
        const perm = await shell.lifecycle.checkPermission(descriptor);
        if (!perm.granted) {
          throw new Error(perm.reason);
        }
        await shell.lifecycle.mountApp(descriptor.name, el, ctx);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      void shell.lifecycle.unmountApp(descriptor.name, ctx).catch(console.error);
    };
  }, [location.pathname, location.search, shell, navigate]);

  const containerId = shell.config.layout?.contentContainerId || 'app-area';

  return (
    <div className="relative min-h-60 flex-1">
      <div ref={mountRef} id={containerId} className="min-h-full" />
      {loading && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/75">
          <Spin tip="加载中…" />
        </div>
      )}
      {error && (
        <div className="p-6">
          <Alert type="error" message="加载失败" description={error.message} showIcon />
        </div>
      )}
    </div>
  );
}

function NotFound() {
  return <Result status="404" title="404" subTitle="页面不存在" />;
}

/** breadcrumb 插槽：渲染 RegionBreadcrumb */
function BreadcrumbSlot({ shell }: { shell: Shell }) {
  const [, bump] = useState(0);

  type RegionApi = {
    getAvailableRegions: () => Array<{ id: string; name: string }>;
    getCurrentRegion: () => { id: string; name: string };
    onRegionsUpdated: (cb: () => void) => () => void;
  };

  const RegionBreadcrumb = shell.sdkRegistry.getComponent<ComponentType<{
    regions?: Array<{ id: string; name: string }>;
    currentRegion?: { id: string; name: string };
  }>>('region-selector', 'RegionBreadcrumb');

  const api = shell.sdkRegistry.get<RegionApi>('region-selector');

  useEffect(() => {
    if (!api) return;
    return api.onRegionsUpdated(() => bump((n) => n + 1));
  }, [api]);

  if (!RegionBreadcrumb || !api) return null;

  return (
    <RegionBreadcrumb
      regions={api.getAvailableRegions()}
      currentRegion={api.getCurrentRegion()}
    />
  );
}

/** 壳层根组件 */
export function ShellApp({ shell, config }: AppProps) {
  const descriptors = shell.registry.getAll().map((i) => i.descriptor);

  return (
    <BrowserRouter basename={config.router.basename}>
      <Layout className="min-h-screen">
        <ShellHeader shell={shell} />
        <Layout hasSider>
          <OpsSidebar descriptors={descriptors} />
          <Content className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
            <BreadcrumbSlot shell={shell} />
            <Routes>
              {descriptors
                .filter((d) => d.type === 'app' && d.routePrefix)
                .map((d) => (
                  <Route
                    key={d.name}
                    path={`${d.routePrefix!.replace(/^\//, '')}/*`}
                    element={<AppOutlet shell={shell} />}
                  />
                ))}
              <Route
                path="/"
                element={
                  <Typography.Paragraph type="secondary" className="m-0">
                    欢迎使用星坞管理后台
                  </Typography.Paragraph>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}
