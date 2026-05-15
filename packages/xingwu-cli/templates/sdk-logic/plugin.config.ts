import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: '{{name}}',
  type: 'sdk',
  version: '1.0.0',
  entry: './src/index.ts',
  preload: true,
  exports: ['{{apiClassName}}'],
};

export default descriptor;
