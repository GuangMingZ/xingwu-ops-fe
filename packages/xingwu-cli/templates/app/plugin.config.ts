import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: '{{name}}',
  type: 'app',
  version: '1.0.0',
  entry: './src/index.tsx',
  routePrefix: '{{routePrefix}}',
  navItem: {
    key: '{{name}}',
    label: '{{navLabel}}',
    icon: '📦',
    order: 100,
    children: [{ key: '{{name}}.list', label: '列表' }],
  },
};

export default descriptor;
