import type { Subscriber } from '@xingwu/types';

/**
 * SharedStateBus — 共享状态总线
 *
 * 提供受控的跨插件状态共享，避免全局变量污染与隐式依赖。
 * 所有 key 遵循 pluginName.stateKey 命名空间。
 * 写入操作自动记录来源插件。
 */
export class SharedStateBus {
  private state: Map<string, unknown> = new Map();
  private subscribers: Map<string, Set<Subscriber>> = new Map();
  private writeLog: Array<{ key: string; value: unknown; timestamp: number }> = [];

  /** 读取共享状态 */
  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /** 写入共享状态（触发订阅者） */
  setState<T>(key: string, value: T | ((prev: T) => T)): void {
    const prevValue = this.state.get(key) as T | undefined;
    const resolvedValue =
      typeof value === 'function' ? (value as (prev: T) => T)(prevValue as T) : value;

    this.state.set(key, resolvedValue);

    // 记录写入日志
    this.writeLog.push({
      key,
      value: resolvedValue,
      timestamp: Date.now(),
    });

    // 触发订阅者
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(resolvedValue, prevValue);
        } catch (err) {
          console.error(`[Xingwu] SharedState subscriber error for key "${key}":`, err);
        }
      });
    }
  }

  /** 订阅状态变更 */
  subscribe<T>(key: string, callback: Subscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback as Subscriber);

    return () => {
      this.subscribers.get(key)?.delete(callback as Subscriber);
    };
  }

  /** 批量更新（仅触发一次通知） */
  batchSet(updates: Record<string, unknown>): void {
    const changedKeys: Array<{ key: string; prev: unknown; next: unknown }> = [];

    for (const [key, value] of Object.entries(updates)) {
      const prev = this.state.get(key);
      this.state.set(key, value);
      changedKeys.push({ key, prev, next: value });

      this.writeLog.push({
        key,
        value,
        timestamp: Date.now(),
      });
    }

    // 通知所有受影响的订阅者
    for (const { key, prev, next } of changedKeys) {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.forEach((cb) => {
          try {
            cb(next, prev);
          } catch (err) {
            console.error(`[Xingwu] SharedState subscriber error for key "${key}":`, err);
          }
        });
      }
    }
  }

  /** 获取写入日志（用于审计） */
  getWriteLog(): Array<{ key: string; value: unknown; timestamp: number }> {
    return [...this.writeLog];
  }

  /** 清除写入日志 */
  clearWriteLog(): void {
    this.writeLog = [];
  }
}
