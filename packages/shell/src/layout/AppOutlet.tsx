import { Alert, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';
import type { Shell } from '@/bootstrap';

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

interface AppOutletProps {
  shell: Shell;
}

/** 子应用挂载容器：固定 DOM + 覆盖层 loading，避免卸载挂载点 */
export function AppOutlet({ shell }: AppOutletProps) {
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
