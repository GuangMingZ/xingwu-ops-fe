import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tailwindConfigPath = path.resolve(__dirname, '../../tailwind.config.cjs');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@styles': path.resolve(__dirname, '../../styles'),
      /** 远程 SDK 经宿主预构建时，避免 pnpm 下 react/jsx-dev-runtime 的 ESM 命名导出缺失 */
      'react/jsx-dev-runtime': path.resolve(__dirname, 'src/shims/react-jsx-dev-runtime.ts'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: tailwindConfigPath }), autoprefixer()],
    },
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      input: {
        shell: 'src/main.tsx',
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons', 'dayjs'],
        },
      },
    },
  },
});
