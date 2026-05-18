/**
 * SharedStateBus — writeLog 滚动窗口单元测试 (P1-5)
 *
 * 覆盖场景：
 *  1. setState 正常写入并触发 subscriber
 *  2. batchSet 批量写入并触发各 subscriber
 *  3. writeLog 在写入数量 ≤ MAX 时完整记录
 *  4. setState 写入超过 MAX 条后，writeLog 截断为最新 MAX 条
 *  5. batchSet 写入超过 MAX 条后，writeLog 同样截断
 *  6. 截断后 getWriteLog() 返回副本，外部修改不影响内部状态
 *  7. clearWriteLog() 清空日志
 */
import { describe, expect, it } from 'vitest';
import { SharedStateBus } from '@/shared-state';

/** MAX_WRITE_LOG 常量值（与源码一致） */
const MAX_WRITE_LOG = 5_000;

describe('SharedStateBus — writeLog 滚动窗口 (P1-5)', () => {
  it('setState 写入并触发 subscriber', () => {
    const bus = new SharedStateBus();
    const calls: [unknown, unknown][] = [];
    bus.subscribe<number>('count', (v, prev) => calls.push([v, prev]));

    bus.setState('count', 1);
    bus.setState('count', (n: number) => n + 1);

    expect(bus.getState('count')).toBe(2);
    expect(calls).toEqual([
      [1, undefined],
      [2, 1],
    ]);
  });

  it('batchSet 批量更新并触发各 subscriber', () => {
    const bus = new SharedStateBus();
    const aVals: unknown[] = [];
    const bVals: unknown[] = [];
    bus.subscribe('a', (v) => aVals.push(v));
    bus.subscribe('b', (v) => bVals.push(v));

    bus.batchSet({ a: 10, b: 20 });

    expect(bus.getState('a')).toBe(10);
    expect(bus.getState('b')).toBe(20);
    expect(aVals).toEqual([10]);
    expect(bVals).toEqual([20]);
  });

  it('写入数量 ≤ MAX 时 writeLog 完整记录', () => {
    const bus = new SharedStateBus();
    for (let i = 0; i < 100; i++) {
      bus.setState('k', i);
    }
    expect(bus.getWriteLog()).toHaveLength(100);
  });

  it('setState 超过 MAX 条后 writeLog 截断为最新 MAX 条', () => {
    const bus = new SharedStateBus();
    const total = MAX_WRITE_LOG + 200;
    for (let i = 0; i < total; i++) {
      bus.setState('k', i);
    }
    const log = bus.getWriteLog();
    expect(log).toHaveLength(MAX_WRITE_LOG);
    // 最后一条记录的 value 应为最新写入值
    expect(log[log.length - 1].value).toBe(total - 1);
    // 最旧的记录应为截断后第一条（即 total - MAX_WRITE_LOG）
    expect(log[0].value).toBe(total - MAX_WRITE_LOG);
  });

  it('batchSet 超过 MAX 条后 writeLog 同样截断', () => {
    const bus = new SharedStateBus();
    // 先写 MAX - 10 条
    for (let i = 0; i < MAX_WRITE_LOG - 10; i++) {
      bus.setState('pre', i);
    }
    // 再 batchSet 20 条（总计超出 MAX）
    const updates: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      updates[`key-${i}`] = i;
    }
    bus.batchSet(updates);

    const log = bus.getWriteLog();
    expect(log.length).toBeLessThanOrEqual(MAX_WRITE_LOG);
  });

  it('getWriteLog 返回副本，外部修改不影响内部日志', () => {
    const bus = new SharedStateBus();
    bus.setState('x', 1);
    const copy = bus.getWriteLog();
    copy.push({ key: 'injected', value: 999, timestamp: 0 });
    expect(bus.getWriteLog()).toHaveLength(1);
  });

  it('clearWriteLog 后 getWriteLog 返回空数组', () => {
    const bus = new SharedStateBus();
    bus.setState('x', 1);
    bus.clearWriteLog();
    expect(bus.getWriteLog()).toHaveLength(0);
  });
});
