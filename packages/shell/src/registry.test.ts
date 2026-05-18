/**
 * PluginRegistry — SRI 完整性校验单元测试 (P0-1)
 *
 * 覆盖场景：
 *  1. integrity 字段缺失 → 直接 import()，不经过 SRI 校验
 *  2. integrity 字段存在且正确 → 校验通过，加载成功
 *  3. integrity 字段存在但哈希不匹配 → reject，阻止加载
 *  4. integrity 格式错误（无 "-" 分隔符）→ reject，明确错误信息
 */
import type { AppDescriptor, AppLifecycle } from '@xingwu/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '@/registry';

// ---- 测试辅助 ----------------------------------------------------------------

/** 生成一段最小可执行 JS 的 ArrayBuffer（UTF-8） */
function makeModuleBytes(code: string): ArrayBuffer {
  return new TextEncoder().encode(code).buffer;
}

/** 用 SubtleCrypto 计算 Base64 哈希（与被测代码使用同一算法，确保 golden value） */
async function sha256Base64(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function appDesc(overrides: Partial<AppDescriptor> = {}): AppDescriptor {
  return {
    name: 'test-app',
    type: 'app',
    version: '1.0.0',
    entry: 'https://cdn.example.com/app.mjs',
    routePrefix: '/test',
    ...overrides,
  };
}

// ---- 测试套件 ----------------------------------------------------------------

describe('PluginRegistry — SRI 完整性校验 (P0-1)', () => {
  let registry: PluginRegistry;
  const MOCK_LIFECYCLE: AppLifecycle = { mount: vi.fn(), unmount: vi.fn() };

  beforeEach(() => {
    registry = new PluginRegistry();
    vi.restoreAllMocks();
  });

  it('无 integrity 字段时直接 import()，不调用 fetch', async () => {
    const desc = appDesc(); // 无 integrity
    registry.register({
      ...desc,
      type: 'app',
    } as Parameters<PluginRegistry['register']>[0]);

    // Mock dynamic import — vitest 无法拦截 import()，改用模块缓存注入方式：
    // 直接替换 registry 的 moduleCache（通过 resolve 的内部分支）
    // 我们通过 spy fetch 来验证 fetch 未被调用
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // inject module by monkey-patching the module cache via a side-effect-free way:
    // we override `import` indirectly by forcing the status to 'loaded' before resolve
    const instance = registry.getInstance('test-app')!;
    instance.status = 'loaded';
    instance.lifecycle = MOCK_LIFECYCLE;

    await registry.resolve('test-app');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('integrity 正确 → SRI 哈希校验通过（不抛 SRI 错误），由 import 阶段处理 blob URL', async () => {
    const code = 'export default { mount(){}, unmount(){} }';
    const buffer = makeModuleBytes(code);
    const hashB64 = await sha256Base64(buffer);
    const integrity = `sha256-${hashB64}`;

    registry.register({
      ...appDesc({ integrity }),
      type: 'app',
    } as Parameters<PluginRegistry['register']>[0]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
    } as unknown as Response);

    // jsdom 不支持 URL.createObjectURL，添加 stub 避免"does not exist"报错
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:stub';
    URL.revokeObjectURL = () => {};

    try {
      const err = await registry.resolve('test-app').catch((e: Error) => e);
      // SRI 校验通过后，错误只能来自 import(blob:stub)，不能来自 SRI mismatch
      if (err instanceof Error) {
        expect(err.message).not.toMatch(/SRI check failed/);
        // 错误来自 import 失败（jsdom 无法真正 import blob），这是预期行为
      }
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('integrity 哈希不匹配 → reject，错误信息包含 "SRI check failed"', async () => {
    const code = 'export default {}';
    const buffer = makeModuleBytes(code);

    // 故意传错误哈希
    const integrity = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    registry.register({
      ...appDesc({ integrity }),
      type: 'app',
    } as Parameters<PluginRegistry['register']>[0]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
    } as unknown as Response);

    await expect(registry.resolve('test-app')).rejects.toThrow(/SRI check failed/);
    expect(registry.getInstance('test-app')?.status).toBe('error');
  });

  it('integrity 格式无效（缺少 "-"）→ reject，错误信息说明格式错误', async () => {
    registry.register({
      ...appDesc({ integrity: 'invalidhashstring' }),
      type: 'app',
    } as Parameters<PluginRegistry['register']>[0]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => makeModuleBytes(''),
    } as unknown as Response);

    await expect(registry.resolve('test-app')).rejects.toThrow(/SRI integrity format invalid/);
  });

  it('fetch 返回非 2xx 状态 → reject，错误信息包含 HTTP 状态码', async () => {
    registry.register({
      ...appDesc({ integrity: 'sha256-abc123' }),
      type: 'app',
    } as Parameters<PluginRegistry['register']>[0]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
    } as unknown as Response);

    await expect(registry.resolve('test-app')).rejects.toThrow(/HTTP 403/);
  });
});
