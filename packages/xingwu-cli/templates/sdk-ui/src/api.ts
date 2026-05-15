import type { SdkContext } from '@xingwu/types';

export class {{apiClassName}} {
  constructor(private ctx: SdkContext) {}

  getLabel(): string {
    return '{{navLabel}}';
  }
}
