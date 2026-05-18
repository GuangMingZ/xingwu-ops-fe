import type { AppContext, AppLifecycle, PluginDescriptor, PluginInstance } from '@xingwu/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleManager } from '@/lifecycle';
import type { PluginRegistry } from '@/registry';

function appDescriptor(name: string): PluginDescriptor {
  return {
    name,
    type: 'app',
    version: '1.0.0',
    entry: `https://example.com/${name}.mjs`,
    routePrefix: `/${name}`,
  };
}

function makeCtx(name: string, container?: HTMLElement): AppContext {
  return {
    descriptor: appDescriptor(name),
    router: {
      params: {},
      query: {},
      navigate: vi.fn(),
      beforeLeave: vi.fn(),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
      watch: vi.fn(() => () => {}),
    },
    sharedState: {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      batchSet: vi.fn(),
    },
    sdk: {
      has: vi.fn(),
      get: vi.fn(),
      load: vi.fn(),
      preload: vi.fn(),
      reload: vi.fn(),
      getComponent: vi.fn(),
      renderTo: vi.fn(),
      unrenderFrom: vi.fn(),
      onRerender: vi.fn(() => () => {}),
    },
    infra: {
      monitor: { mark: vi.fn(), reportError: vi.fn() },
      i18n: { t: vi.fn(), locale: 'zh', setLocale: vi.fn() },
      net: { request: vi.fn(), get: vi.fn(), post: vi.fn() },
      permission: {
        checkAdmin: vi.fn(),
        checkIdentity: vi.fn(),
        checkRbacAction: vi.fn(),
        checkChain: vi.fn(),
      },
    },
    container: container ?? document.createElement('div'),
  };
}

/** 测试用 PluginRegistry 替身 */
class MockPluginRegistry {
  private plugins = new Map<string, PluginInstance>();
  evicted: string[] = [];

  register(descriptor: PluginDescriptor): void {
    this.plugins.set(descriptor.name, {
      descriptor,
      lifecycle: {} as AppLifecycle,
      module: null,
      status: 'registered',
    });
  }

  setLifecycle(name: string, lifecycle: AppLifecycle): void {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`missing ${name}`);
    instance.lifecycle = lifecycle;
    instance.status = 'loaded';
  }

  async resolve(name: string): Promise<PluginInstance> {
    const instance = this.plugins.get(name);
    if (!instance) throw new Error(`[mock] ${name} not registered`);
    if (instance.status === 'active' || instance.status === 'loaded') {
      return instance;
    }
    instance.status = 'loaded';
    return instance;
  }

  getInstance(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  setStatus(name: string, status: PluginInstance['status']): void {
    const instance = this.plugins.get(name);
    if (instance) instance.status = status;
  }

  evictAppModule(name: string): void {
    this.evicted.push(name);
    const instance = this.plugins.get(name);
    if (!instance) return;
    instance.module = null;
    instance.status = 'registered';
    instance.lifecycle = {} as AppLifecycle;
  }
}

function createLifecycle(
  registry: MockPluginRegistry,
  options?: { evictOnUnmount?: boolean },
): LifecycleManager {
  return new LifecycleManager(registry as unknown as PluginRegistry, options);
}

describe('LifecycleManager — 子应用内存与切换', () => {
  let registry: MockPluginRegistry;
  let lifecycle: LifecycleManager;
  const events: string[] = [];

  beforeEach(() => {
    events.length = 0;
    registry = new MockPluginRegistry();
    registry.register(appDescriptor('app-a'));
    registry.register(appDescriptor('app-b'));

    registry.setLifecycle('app-a', {
      mount: async () => {
        events.push('mount:app-a');
      },
      unmount: async () => {
        events.push('unmount:app-a');
      },
    });

    registry.setLifecycle('app-b', {
      mount: async () => {
        events.push('mount:app-b');
      },
      unmount: async () => {
        events.push('unmount:app-b');
      },
    });

    lifecycle = createLifecycle(registry, { evictOnUnmount: true });
  });

  it('切换 App 时先卸载旧 App 再挂载新 App', async () => {
    const container = document.createElement('div');
    await lifecycle.mountApp('app-a', container, makeCtx('app-a', container));
    await lifecycle.mountApp('app-b', container, makeCtx('app-b', container));

    expect(events).toEqual(['mount:app-a', 'unmount:app-a', 'mount:app-b']);
    expect(lifecycle.getActiveApp()).toBe('app-b');
    expect(registry.evicted).toContain('app-a');
    expect(registry.getInstance('app-a')?.status).toBe('registered');
  });

  it('任意时刻仅一个 active 子应用', async () => {
    const container = document.createElement('div');
    await lifecycle.mountApp('app-a', container, makeCtx('app-a', container));
    expect(lifecycle.getActiveApp()).toBe('app-a');

    await lifecycle.mountApp('app-b', container, makeCtx('app-b', container));
    expect(lifecycle.getActiveApp()).toBe('app-b');
    expect(registry.getInstance('app-b')?.status).toBe('active');
  });

  it('unmount 后驱逐模块缓存（evictOnUnmount 默认开启）', async () => {
    const container = document.createElement('div');
    const ctx = makeCtx('app-a', container);
    await lifecycle.mountApp('app-a', container, ctx);
    await lifecycle.unmountApp('app-a', ctx);

    expect(registry.evicted).toContain('app-a');
    expect(lifecycle.getActiveApp()).toBeNull();
  });

  it('evictOnUnmount: false 时不驱逐模块', async () => {
    const noEvict = createLifecycle(registry, { evictOnUnmount: false });
    const container = document.createElement('div');
    const ctx = makeCtx('app-a', container);
    await noEvict.mountApp('app-a', container, ctx);
    await noEvict.unmountApp('app-a', ctx);

    expect(registry.evicted).toHaveLength(0);
  });

  it('卸载时清理该 App 的路由守卫', async () => {
    const container = document.createElement('div');
    const ctx = makeCtx('app-a', container);
    await lifecycle.mountApp('app-a', container, ctx);

    lifecycle.registerRouteGuard('app-a', () => true);
    lifecycle.registerRouteGuard('app-a', () => false);
    await expect(lifecycle.checkRouteGuards('app-a')).resolves.toBe(false);

    await lifecycle.unmountApp('app-a', ctx);
    await expect(lifecycle.checkRouteGuards('app-a')).resolves.toBe(true);
  });

  it('并发 mount 串行化，最终仅一个 active', async () => {
    const container = document.createElement('div');
    await Promise.all([
      lifecycle.mountApp('app-a', container, makeCtx('app-a', container)),
      lifecycle.mountApp('app-b', container, makeCtx('app-b', container)),
    ]);

    const active = lifecycle.getActiveApp();
    expect(active === 'app-a' || active === 'app-b').toBe(true);
    const inactive = active === 'app-a' ? 'app-b' : 'app-a';
    expect(registry.evicted).toContain(inactive);
    expect(registry.getInstance(inactive)?.status).toBe('registered');
  });

  it('同 App 路由变化走 update 不重复 mount', async () => {
    const updateEvents: string[] = [];
    registry.setLifecycle('app-a', {
      mount: async () => {
        updateEvents.push('mount');
      },
      unmount: async () => {
        updateEvents.push('unmount');
      },
      update: async () => {
        updateEvents.push('update');
      },
    });

    const container = document.createElement('div');
    const ctx1 = makeCtx('app-a', container);
    await lifecycle.mountApp('app-a', container, ctx1);
    await lifecycle.updateApp('app-a', { ...ctx1, router: { ...ctx1.router, query: { tab: '1' } } });

    expect(updateEvents).toEqual(['mount', 'update']);
    expect(lifecycle.getActiveApp()).toBe('app-a');
  });

  it('unmountActiveApp 卸载当前活跃子应用', async () => {
    const container = document.createElement('div');
    await lifecycle.mountApp('app-a', container, makeCtx('app-a', container));
    await lifecycle.unmountActiveApp();

    expect(events).toContain('unmount:app-a');
    expect(lifecycle.getActiveApp()).toBeNull();
    expect(registry.evicted).toContain('app-a');
  });
});
