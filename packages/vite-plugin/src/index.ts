import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 星坞框架 Vite 构建插件
 *
 * 功能：
 * 1. 自动读取 plugin.config.ts 并注入为虚拟模块
 * 2. 处理子应用/SDK 生命周期导出
 * 3. 生成构建元信息
 */
export function pluginConfig(): Plugin {
  const virtualModuleId = 'virtual:xingwu-plugin-config';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: '@xingwu/vite-plugin',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        try {
          const configPath = resolve(process.cwd(), 'plugin.config.ts');
          const content = readFileSync(configPath, 'utf-8');
          return `
// Auto-generated from plugin.config.ts
${content.replace(/export\s+default/, 'const __pluginDescriptor =')}
export { __pluginDescriptor as default };
`;
        } catch {
          return `
// No plugin.config.ts found
export default null;
`;
        }
      }
    },

    config(_config, { command }) {
      if (command === 'build') {
        return {
          build: {
            target: 'es2020',
            minify: 'esbuild' as const,
          },
        };
      }
    },
  };
}

/**
 * 生成 Import Map JSON（供 Shell 构建时使用）
 */
export function generateImportMap(
  deps: Record<string, { version: string; cdnBase?: string }>,
): Record<string, string> {
  const cdnBase = 'https://static.example.com';
  const imports: Record<string, string> = {};

  for (const [name, info] of Object.entries(deps)) {
    const base = info.cdnBase || cdnBase;
    imports[name] = `${base}/${name}@${info.version}/index.js`;
  }

  return imports;
}
