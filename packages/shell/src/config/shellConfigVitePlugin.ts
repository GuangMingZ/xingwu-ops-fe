import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_CONFIG_DIR = path.resolve(__dirname, '../../config');
const ALLOWED_FILES = new Set(['apps.json', 'sdks.json']);

/**
 * 开发态将 packages/shell/config 挂载到 /config/*；
 * 构建时复制到 dist/config，供生产 ConfigMap 挂载同路径。
 */
export function shellConfigVitePlugin(): Plugin {
  return {
    name: 'xingwu-shell-config',

    configureServer(server) {
      server.middlewares.use('/config', (req, res, next) => {
        const raw = req.url?.split('?')[0] ?? '';
        const fileName = raw.replace(/^\//, '');
        if (!ALLOWED_FILES.has(fileName)) {
          next();
          return;
        }
        const filePath = path.join(SHELL_CONFIG_DIR, fileName);
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(fs.readFileSync(filePath, 'utf-8'));
      });
    },

    closeBundle() {
      const outDir = path.resolve(__dirname, '../../dist/config');
      fs.mkdirSync(outDir, { recursive: true });
      for (const file of ALLOWED_FILES) {
        const src = path.join(SHELL_CONFIG_DIR, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(outDir, file));
        }
      }
    },
  };
}
