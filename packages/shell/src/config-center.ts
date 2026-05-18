import type { PluginConfigScope } from '@xingwu/types';
import type { MonitorImpl } from '@/infra';

/** Zod-like Schema：只要实现 safeParse 方法即可（兼容 Zod v3 及任何同接口实现） */
interface ZodLikeSchema {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: { message: string } };
}

function isZodLike(schema: unknown): schema is ZodLikeSchema {
  return typeof schema === 'object' && schema !== null && typeof (schema as Record<string, unknown>).safeParse === 'function';
}

/**
 * 指数退避重试辅助
 *
 * 触发条件：远程配置拉取失败时，依次等待 baseDelayMs * 2^attempt 后重试。
 * 与原实现差异：原实现失败后直接 return，不做重试；
 *   现在最多重试 maxAttempts 次，全部失败后通过 monitor 上报。
 * 选择该修复方式的原因：网络抖动导致的一次性拉取失败不应直接使配置失效，
 *   指数退避可在不大幅增加并发压力的前提下显著提高成功率。
 */
async function fetchWithRetry(
  url: string,
  maxAttempts: number,
  baseDelayMs: number,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)),
        );
      }
    }
  }
  throw lastError;
}

/** 重试次数上限 */
const REFRESH_MAX_ATTEMPTS = 3;
/** 退避基础延迟（ms），实际延迟 1s / 2s */
const REFRESH_BASE_DELAY_MS = 1_000;

/**
 * ConfigCenter — 配置中心
 *
 * 提供类型安全的运行时配置管理，支持响应式更新、
 * 插件级作用域隔离与灰度发布。采用 Zod Schema 校验。
 */
export class ConfigCenter {
  private store: Map<string, unknown> = new Map();
  private watchers: Map<string, Set<(value: unknown, oldValue: unknown) => void>> = new Map();
  private schemas: Map<string, Record<string, unknown>> = new Map();
  private remoteUrl: string;
  private refreshInterval: number;
  private cacheKey: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private monitor: MonitorImpl | null;

  constructor(
    options: { remoteUrl: string; refreshInterval: number; cacheKey: string },
    monitor?: MonitorImpl,
  ) {
    this.remoteUrl = options.remoteUrl;
    this.refreshInterval = options.refreshInterval;
    this.cacheKey = options.cacheKey;
    this.monitor = monitor ?? null;

    // 从 localStorage 恢复缓存
    this.restoreFromCache();
  }

  /** 启动远程刷新定时器 */
  startRefresh(): void {
    if (this.timer) return;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), this.refreshInterval);
  }

  /** 停止远程刷新定时器 */
  stopRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 注册配置 Schema（支持 Zod Schema 或任意实现了 safeParse 的对象） */
  registerSchema(key: string, schema: Record<string, unknown>): void {
    this.schemas.set(key, schema);
  }

  /** 获取配置 */
  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  /** 设置配置（触发 watcher）
   *
   * 触发条件：该 key 已通过 registerSchema() 注册了 Zod-like Schema。
   * 与未注册 schema 路径的差异：会先执行 safeParse，失败则抛出类型错误而非静默写入。
   * 选择该修复方式的原因：编译期类型正确不等于运行时值合法（如远程配置下发），
   *   必须在写入点强制校验，防止脏数据扩散。
   */
  set<T>(key: string, value: T): void {
    const schema = this.schemas.get(key);
    if (isZodLike(schema)) {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new Error(
          `[Xingwu] ConfigCenter validation failed for key "${key}": ${result.error.message}`,
        );
      }
    }

    const oldValue = this.store.get(key);
    this.store.set(key, value);
    this.persistToCache();

    // 触发 watchers
    const watchers = this.watchers.get(key);
    if (watchers) {
      watchers.forEach((cb) => {
        try {
          cb(value, oldValue);
        } catch (err) {
          console.error(`[Xingwu] ConfigCenter watcher error for key "${key}":`, err);
        }
      });
    }
  }

  /** 批量更新（合并，仅触发一次 watcher） */
  batchUpdate(updates: Record<string, unknown>): void {
    const changedKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      this.store.set(key, value);
      changedKeys.push(key);
    }

    this.persistToCache();

    // 每个改变的 key 各触发一次 watcher
    for (const key of changedKeys) {
      const watchers = this.watchers.get(key);
      if (watchers) {
        watchers.forEach((cb) => {
          try {
            cb(this.store.get(key), undefined);
          } catch (err) {
            console.error(`[Xingwu] ConfigCenter watcher error for key "${key}":`, err);
          }
        });
      }
    }
  }

  /** 监听配置变更 */
  watch<T>(key: string, callback: (value: T, oldValue: T) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key)!.add(callback as (value: unknown, oldValue: unknown) => void);

    return () => {
      this.watchers.get(key)?.delete(callback as (value: unknown, oldValue: unknown) => void);
    };
  }

  /** 从远程拉取最新配置（失败时指数退避重试，全部失败后上报监控） */
  async refresh(): Promise<void> {
    try {
      const data = await fetchWithRetry(
        this.remoteUrl,
        REFRESH_MAX_ATTEMPTS,
        REFRESH_BASE_DELAY_MS,
      );
      this.batchUpdate(data);
    } catch (err) {
      // 重试耗尽，降级使用缓存并上报监控
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn('[Xingwu] ConfigCenter refresh failed after retries:', error);
      this.monitor?.reportError('ConfigCenter.refresh', error);
    }
  }

  /** 获取插件级配置作用域 */
  forPlugin(pluginName: string): PluginConfigScope {
    const prefix = `${pluginName}.`;
    return {
      get: <T>(key: string): T => this.get<T>(`${prefix}${key}`),
      set: <T>(key: string, value: T): void => this.set(`${prefix}${key}`, value),
      watch: <T>(key: string, callback: (value: T, oldValue: T) => void): (() => void) =>
        this.watch<T>(`${prefix}${key}`, callback),
    };
  }

  /** 从 localStorage 恢复缓存 */
  private restoreFromCache(): void {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        for (const [key, value] of Object.entries(data)) {
          this.store.set(key, value);
        }
      }
    } catch {
      // 忽略缓存恢复失败
    }
  }

  /** 持久化到 localStorage */
  private persistToCache(): void {
    try {
      const data: Record<string, unknown> = {};
      this.store.forEach((v, k) => {
        data[k] = v;
      });
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch {
      // 忽略持久化失败
    }
  }
}
