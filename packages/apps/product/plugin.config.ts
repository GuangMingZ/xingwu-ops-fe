import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: 'product',
  type: 'app',
  version: '1.0.0',
  entry: './src/index.tsx',
  routePrefix: '/product',
  dependencies: ['region-selector'],
  navItem: {
    key: 'product',
    label: '商品管理',
    icon: '📦',
    order: 100,
    children: [
      { key: 'product.list', label: '商品列表' },
      { key: 'product.detail', label: '商品详情' },
    ],
  },
  configSchema: {
    type: 'object',
    properties: {
      defaultRegion: { type: 'string' },
      maxProducts: { type: 'number' },
    },
  },
};

export default descriptor;
