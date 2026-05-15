import type { SdkContext } from '@xingwu/types';

/**
 * {{apiClassName}} — {{navLabel}} SDK API
 */
export class {{apiClassName}} {
  constructor(private ctx: SdkContext) {}

  /** 示例：读取 SDK 配置 */
  getEnabled(): boolean {
    return this.ctx.config.get<boolean>('enabled') ?? true;
  }

  /** 示例：执行业务逻辑 */
  async run(): Promise<{ ok: boolean }> {
    console.info('[{{apiClassName}}] run');
    return { ok: true };
  }
}
