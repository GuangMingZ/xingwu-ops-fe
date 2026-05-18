/**
 * ConfigCenter — Zod 校验 + 指数退避重试单元测试 (P0-3, P1-6)
 *
 * 覆盖场景：
 *  P0-3:
 *   1. set() 未注册 schema → 直接写入，不抛错
 *   2. set() 注册了 Zod-like schema，值合法 → 写入成功
 *   3. set() 注册了 Zod-like schema，值非法 → throw，含 key 信息
 *   4. batchUpdate() 不走 schema 校验路径（批量无校验，符合现有设计）
 *  P1-6:
 *   5. refresh() 一次成功 → batchUpdate 调用，no monitor report
 *   6. refresh() 全部失败（3 次重试）→ monitor.reportError 被调用
 *   7. refresh() 第 2 次成功（首次失败、退避后成功）→ monitor.reportError 不调用
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigCenter } from '@/config-center';

// ---- 辅助 -------------------------------------------------------------------

function makeMonitor() {
  return {
    mark: vi.fn(),
    reportError: vi.fn(),
  };
}

type FakeMonitor = ReturnType<typeof makeMonitor>;

function makeCenter(monitor?: FakeMonitor) {
  return new ConfigCenter(
    { remoteUrl: 'https://config.example.com/api', refreshInterval: 60_000, cacheKey: 'test-cache' },
    monitor as never,
  );
}

/** 最简 Zod-like schema */
function stringSchema() {
  return {
    safeParse(value: unknown) {
      if (typeof value === 'string') return { success: true as const, data: value };
      return { success: false as const, error: { message: 'expected string' } };
    },
  };
}

// ---- 测试 -------------------------------------------------------------------

describe('ConfigCenter — Zod 运行时校验 (P0-3)', () => {
  let center: ConfigCenter;

  beforeEach(() => {
    center = makeCenter();
    // 隔离 localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('未注册 schema 时 set() 直接写入，不抛错', () => {
    expect(() => center.set('any.key', 42)).not.toThrow();
    expect(center.get('any.key')).toBe(42);
  });

  it('注册了 schema 且值合法 → 写入成功', () => {
    center.registerSchema('user.name', stringSchema() as never);
    expect(() => center.set('user.name', 'Alice')).not.toThrow();
    expect(center.get('user.name')).toBe('Alice');
  });

  it('注册了 schema 且值非法 → throw，错误信息含 key', () => {
    center.registerSchema('user.age', {
      safeParse(value: unknown) {
        if (typeof value === 'number') return { success: true as const, data: value };
        return { success: false as const, error: { message: 'expected number' } };
      },
    } as never);

    expect(() => center.set('user.age', 'not-a-number')).toThrow(/user\.age/);
    expect(() => center.set('user.age', 'not-a-number')).toThrow(/expected number/);
  });

  it('schema 校验失败后 value 不写入 store', () => {
    center.registerSchema('flag', {
      safeParse(v: unknown) {
        if (typeof v === 'boolean') return { success: true as const, data: v };
        return { success: false as const, error: { message: 'boolean only' } };
      },
    } as never);

    center.set('flag', true); // 先写入合法值
    expect(() => center.set('flag', 'oops')).toThrow();
    // store 中仍是上一次的合法值
    expect(center.get('flag')).toBe(true);
  });

  it('watcher 在 set() 合法写入后被触发', () => {
    const cb = vi.fn();
    center.watch('counter', cb);
    center.set('counter', 1);
    expect(cb).toHaveBeenCalledWith(1, undefined);
  });

  it('watcher 在 set() 非法时不被触发', () => {
    center.registerSchema('x', stringSchema() as never);
    const cb = vi.fn();
    center.watch('x', cb);
    expect(() => center.set('x', 999)).toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('ConfigCenter — 指数退避重试与监控上报 (P1-6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetch 一次成功 → 更新 store，monitor.reportError 未调用', async () => {
    const monitor = makeMonitor();
    const center = makeCenter(monitor);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ 'feature.dark': true }),
    } as unknown as Response);

    await center.refresh();

    expect(center.get('feature.dark')).toBe(true);
    expect(monitor.reportError).not.toHaveBeenCalled();
  });

  it('全部 3 次均失败 → monitor.reportError 被调用一次', async () => {
    const monitor = makeMonitor();
    const center = makeCenter(monitor);

    let fetchCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      fetchCount++;
      throw new Error('network error');
    });

    const refreshPromise = center.refresh();

    // 每次退避后推进时间（1s, 2s）
    await vi.runAllTimersAsync();

    await refreshPromise;

    expect(fetchCount).toBe(3);
    expect(monitor.reportError).toHaveBeenCalledOnce();
    expect(monitor.reportError).toHaveBeenCalledWith(
      'ConfigCenter.refresh',
      expect.objectContaining({ message: 'network error' }),
    );
  });

  it('第 2 次成功（首次网络抖动）→ monitor 不上报', async () => {
    const monitor = makeMonitor();
    const center = makeCenter(monitor);

    let attempt = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempt++;
      if (attempt === 1) throw new Error('transient error');
      return { ok: true, json: async () => ({ recovered: true }) } as unknown as Response;
    });

    const refreshPromise = center.refresh();
    await vi.runAllTimersAsync();
    await refreshPromise;

    expect(attempt).toBe(2);
    expect(center.get('recovered')).toBe(true);
    expect(monitor.reportError).not.toHaveBeenCalled();
  });

  it('fetch 返回非 2xx → 视为失败，最终上报 monitor', async () => {
    const monitor = makeMonitor();
    const center = makeCenter(monitor);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    const refreshPromise = center.refresh();
    await vi.runAllTimersAsync();
    await refreshPromise;

    expect(monitor.reportError).toHaveBeenCalledOnce();
  });
});
