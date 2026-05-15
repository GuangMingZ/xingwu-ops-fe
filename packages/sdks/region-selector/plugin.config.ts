import type { PluginDescriptor } from '@xingwu/types';

const descriptor: PluginDescriptor = {
  name: 'region-selector',
  type: 'sdk',
  version: '2.1.0',
  entry: './src/index.tsx',
  preload: true,
  exports: ['RegionSelectorApi'],
  uiComponents: [
    {
      name: 'RegionPicker',
      description: '区域选择器下拉组件',
      slot: 'header-slot',
      propsSchema: {
        type: 'object',
        properties: {
          regions: { type: 'array' },
          onChange: { typeof: 'function' },
        },
      },
    },
    {
      name: 'RegionBreadcrumb',
      description: '区域面包屑导航',
      slot: 'breadcrumb',
    },
  ],
  styleStrategy: 'css-modules',
  configSchema: {
    type: 'object',
    properties: {
      defaultRegion: { type: 'string' },
    },
  },
};

export default descriptor;
