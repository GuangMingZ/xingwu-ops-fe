import type { Monitor, MonitorEvents } from '@xingwu/types';

/**
 * Monitor — 监控接口实现
 */
export class MonitorImpl implements Monitor {
  private dsn: string;
  private sampleRate: number;
  private environment: string;
  private events: Array<{ event: string; data: unknown; timestamp: number }> = [];

  constructor(options: { dsn: string; sampleRate: number; environment: string }) {
    this.dsn = options.dsn;
    this.sampleRate = options.sampleRate;
    this.environment = options.environment;
  }

  mark<E extends keyof MonitorEvents>(event: E, data: MonitorEvents[E]): void {
    this.events.push({ event, data, timestamp: Date.now() });
    // 采样上报
    if (Math.random() < this.sampleRate) {
      this.send(event, data);
    }
  }

  reportError(tag: string, error: Error): void {
    this.events.push({
      event: 'sdk:error',
      data: { name: tag, error },
      timestamp: Date.now(),
    });
    // 错误始终上报
    this.send('error', { tag, message: error.message, stack: error.stack });
  }

  private send(event: string, data: unknown): void {
    // 简化实现：使用 navigator.sendBeacon
    try {
      const payload = JSON.stringify({ event, data, env: this.environment });
      navigator.sendBeacon(this.dsn, payload);
    } catch {
      // 发送失败静默处理
    }
  }
}
