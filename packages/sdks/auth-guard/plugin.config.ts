import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: 'auth-guard',
  type: 'sdk',
  version: '1.2.0',
  entry: './src/index.ts',
  preload: true,
  exports: ['AuthGuardApi'],
  configSchema: {
    type: 'object',
    properties: {
      enableSessionGuard: { type: 'boolean', default: true },
      enableOwnerGuard: { type: 'boolean', default: true },
    },
  },
};

export default descriptor;
