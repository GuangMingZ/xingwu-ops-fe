import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createSharedReactPlugin } from './vite.shared-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [createSharedReactPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: { disabled: true },
  server: {
    port: {{port}},
    strictPort: true,
    host: true,
    cors: true,
  },
  build: {
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: '{{fileName}}',
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@xingwu/types'],
    },
  },
});
