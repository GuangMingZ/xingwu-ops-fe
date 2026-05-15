import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: '{{name}}',
  type: 'sdk',
  version: '1.0.0',
  entry: './src/index.tsx',
  preload: true,
  exports: ['{{apiClassName}}'],
  uiComponents: [
    {
      name: '{{pascalName}}Panel',
      description: '{{navLabel}} 面板',
      slot: 'header-slot',
    },
  ],
};

export default descriptor;
