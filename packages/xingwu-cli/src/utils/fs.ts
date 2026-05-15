import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getTemplatesRoot(): string {
  return path.resolve(__dirname, '../../templates');
}

export function findMonorepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function renderString(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function renderFileContent(content: string, vars: Record<string, string>): string {
  return renderString(content, vars);
}

export function copyTemplateDir(
  templateDir: string,
  targetDir: string,
  vars: Record<string, string>,
): void {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`模板目录不存在: ${templateDir}`);
  }
  if (fs.existsSync(targetDir)) {
    throw new Error(`目标目录已存在: ${targetDir}`);
  }

  const resolvePath = (p: string) => renderString(p, vars);

  const walk = (src: string, dest: string) => {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        walk(path.join(src, entry), path.join(dest, resolvePath(entry)));
      }
      return;
    }

    const raw = fs.readFileSync(src, 'utf8');
    const isBinary = raw.includes('\0');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (isBinary) {
      fs.copyFileSync(src, dest);
    } else {
      fs.writeFileSync(dest, renderFileContent(raw, vars), 'utf8');
    }
  };

  walk(templateDir, targetDir);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function dirExists(dir: string): boolean {
  return fs.existsSync(dir);
}
