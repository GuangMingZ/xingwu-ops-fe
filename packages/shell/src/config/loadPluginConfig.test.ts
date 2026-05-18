import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadPluginConfig } from '@/config/loadPluginConfig';

const VALID_APPS = [
  {
    name: 'product',
    version: '1.0.0',
    entry: '/apps/product.mjs',
    routePrefix: '/product',
  },
];

const VALID_SDKS = [
  {
    name: 'region-selector',
    version: '1.0.0',
    entry: '/sdk/region-selector.mjs',
    preload: true,
  },
  {
    name: 'auth-guard',
    version: '1.2.0',
    entry: '/sdk/auth-guard.mjs',
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadPluginConfig', () => {
  it('从内联 apps / sdks 加载并推导 preloadSdkNames', async () => {
    const result = await loadPluginConfig({
      apps: VALID_APPS,
      sdks: VALID_SDKS,
    });

    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].name).toBe('product');
    expect(result.sdks).toHaveLength(2);
    expect(result.preloadSdkNames).toEqual(['region-selector']);
  });

  it('显式 preloadSdks 优先于 sdks 中 preload 字段推导', async () => {
    const result = await loadPluginConfig({
      apps: VALID_APPS,
      sdks: VALID_SDKS,
      preloadSdks: ['auth-guard'],
    });

    expect(result.preloadSdkNames).toEqual(['auth-guard']);
  });

  it('从 URL fetch 加载配置', async () => {
    const appsJson = JSON.stringify(VALID_APPS);
    const sdksJson = JSON.stringify(VALID_SDKS);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/config/apps.json') {
        return Promise.resolve(new Response(appsJson, { status: 200 }));
      }
      if (url === '/config/sdks.json') {
        return Promise.resolve(new Response(sdksJson, { status: 200 }));
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });

    const result = await loadPluginConfig({
      apps: '/config/apps.json',
      sdks: '/config/sdks.json',
    });

    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].name).toBe('product');
    expect(result.sdks).toHaveLength(2);
  });

  it('fetch 返回非 200 时抛出错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Internal Error', { status: 500 }));

    await expect(
      loadPluginConfig({
        apps: '/config/apps.json',
        sdks: VALID_SDKS,
      }),
    ).rejects.toThrow('[Xingwu] Failed to load apps from /config/apps.json: 500');
  });

  it('内联数组缺少必填字段时 Zod 校验失败', async () => {
    const invalidApps = [{ name: 'product' }] as unknown as typeof VALID_APPS;

    await expect(
      loadPluginConfig({
        apps: invalidApps,
        sdks: VALID_SDKS,
      }),
    ).rejects.toThrow('[Xingwu] Invalid apps config');
  });

  it('fetch 返回的 JSON 结构不合法时 Zod 校验失败', async () => {
    const badJson = JSON.stringify([{ name: 'product' }]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(badJson, { status: 200 }));

    await expect(
      loadPluginConfig({
        apps: '/config/apps.json',
        sdks: VALID_SDKS,
      }),
    ).rejects.toThrow('[Xingwu] Invalid apps config from /config/apps.json');
  });

  it('sdks.json 中 styleStrategy 非法值时 Zod 校验失败', async () => {
    const invalidSdks = [{ name: 'x', version: '1.0.0', entry: '/x.mjs', styleStrategy: 'invalid' }];

    await expect(
      loadPluginConfig({
        apps: VALID_APPS,
        sdks: invalidSdks as unknown as typeof VALID_SDKS,
      }),
    ).rejects.toThrow('[Xingwu] Invalid sdks config');
  });
});
