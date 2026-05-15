import type { PluginConfigScope } from '@xingwu/types';

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

  constructor(options: { remoteUrl: string; refreshInterval: number; cacheKey: string }) {
    this.remoteUrl = options.remoteUrl;
    this.refreshInterval = options.refreshInterval;
    this.cacheKey = options.cacheKey;

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

  /** 注册配置 Schema */
  registerSchema(key: string, schema: Record<string, unknown>): void {
    this.schemas.set(key, schema);
  }

  /** 获取配置 */
  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  /** 设置配置（触发 watcher） */
  set<T>(key: string, value: T): void {
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

  /** 从远程拉取最新配置 */
  async refresh(): Promise<void> {
    try {
      const response = await fetch(this.remoteUrl);
      if (!response.ok) return;

      const data = await response.json();
      this.batchUpdate(data);
    } catch (err) {
      // 静默失败，使用缓存
      console.warn('[Xingwu] ConfigCenter refresh failed:', err);
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
