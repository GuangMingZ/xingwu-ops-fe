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

function buildAppContext(
  shell: Shell,
  descriptor: AppContext['descriptor'],
  el: HTMLElement,
  location: ReturnType<typeof useLocation>,
  navigate: ReturnType<typeof useNavigate>,
): AppContext {
  return {
    descriptor,
    router: {
      params: routeParamsFor(location.pathname, descriptor.routePrefix || ''),
      query: Object.fromEntries(new URLSearchParams(location.search)),
      navigate: (to, options) => {
        navigate(to, { replace: options?.replace, state: options?.state });
      },
      beforeLeave: (guard) => {
        shell.lifecycle.registerRouteGuard(descriptor.name, guard);
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

  const mountedAppRef = useRef<string | null>(null);
  const lastCtxRef = useRef<AppContext | null>(null);
  const loadGenerationRef = useRef(0);

  /** Outlet 组件销毁时卸载子应用（跨 App 切换、离开业务路由） */
  useEffect(() => {
    return () => {
      const name = mountedAppRef.current;
      const ctx = lastCtxRef.current;
      if (name && ctx) {
        void shell.lifecycle.unmountApp(name, ctx).catch(console.error);
      }
      mountedAppRef.current = null;
      lastCtxRef.current = null;
    };
  }, [shell]);

  /** 路由变化：同 App 走 update，切换 App 由 LifecycleManager 先卸旧再挂新 */
  useEffect(() => {
    const descriptor = shell.registry.findByRoute(location.pathname);
    if (!descriptor) return;

    const el = mountRef.current;
    if (!el) return;

    const generation = ++loadGenerationRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const ctx = buildAppContext(shell, descriptor, el, location, navigate);
    lastCtxRef.current = ctx;

    void (async () => {
      try {
        const perm = await shell.lifecycle.checkPermission(descriptor);
        if (cancelled || generation !== loadGenerationRef.current) return;
        if (!perm.granted) {
          throw new Error(perm.reason);
        }

        const isSameAppMounted =
          mountedAppRef.current === descriptor.name &&
          shell.lifecycle.getActiveApp() === descriptor.name;

        if (isSameAppMounted) {
          await shell.lifecycle.updateApp(descriptor.name, ctx);
        } else {
          await shell.lifecycle.mountApp(descriptor.name, el, ctx);
          mountedAppRef.current = descriptor.name;
        }

        if (!cancelled && generation === loadGenerationRef.current) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled && generation === loadGenerationRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
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
