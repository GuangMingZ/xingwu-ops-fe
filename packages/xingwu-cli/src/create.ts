import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { copyTemplateDir, dirExists, findMonorepoRoot, getTemplatesRoot } from './utils/fs.js';
import { isValidPluginName, toCamelCase, toKebabCase, toPascalCase } from './utils/naming.js';

export interface CreateVars {
  name: string;
  packageName: string;
  pascalName: string;
  camelName: string;
  routePrefix: string;
  navLabel: string;
  port: string;
  fileName: string;
  apiClassName: string;
  description: string;
}

export interface CreateAppOptions {
  name?: string;
  dir?: string;
  port?: number;
  label?: string;
  route?: string;
  cwd?: string;
}

export interface CreateSdkOptions {
  name?: string;
  dir?: string;
  port?: number;
  ui?: boolean;
  cwd?: string;
}

function buildVars(
  name: string,
  type: 'app' | 'sdk',
  opts: { port: number; label?: string; route?: string },
): CreateVars {
  const pascalName = toPascalCase(name);
  return {
    name,
    packageName: type === 'app' ? `xingwu-app-${name}` : `xingwu-sdk-${name}`,
    pascalName,
    camelName: toCamelCase(name),
    routePrefix: opts.route ?? `/${name}`,
    navLabel: opts.label ?? pascalName,
    port: String(opts.port),
    fileName: name,
    apiClassName: `${pascalName}Api`,
    description: type === 'app' ? `星坞子应用 — ${opts.label ?? name}` : `星坞 SDK — ${opts.label ?? name}`,
  };
}

function resolveOutputDir(
  cwd: string,
  type: 'app' | 'sdk',
  name: string,
  explicitDir?: string,
): string {
  if (explicitDir) {
    return path.isAbsolute(explicitDir) ? explicitDir : path.resolve(cwd, explicitDir);
  }
  const root = findMonorepoRoot(cwd);
  if (root) {
    return path.join(root, 'packages', type === 'app' ? 'apps' : 'sdks', name);
  }
  return path.resolve(cwd, name);
}

function suggestPort(type: 'app' | 'sdk', cwd: string): number {
  const root = findMonorepoRoot(cwd);
  const base = type === 'app' ? 5174 : 5175;
  if (!root) return base;

  const parent = path.join(root, 'packages', type === 'app' ? 'apps' : 'sdks');
  if (!fs.existsSync(parent)) return base;

  const used = new Set<number>();
  for (const entry of fs.readdirSync(parent)) {
    const pkgPath = path.join(parent, entry, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: { dev?: string } };
      const m = pkg.scripts?.dev?.match(/--port\s+(\d+)/);
      if (m) used.add(Number(m[1]));
    } catch {
      /* ignore */
    }
  }

  let port = base;
  while (used.has(port)) port += 1;
  return port;
}

async function promptName(message: string): Promise<string> {
  const { value } = await prompts({
    type: 'text',
    name: 'value',
    message,
    validate: (v: string) =>
      isValidPluginName(toKebabCase(v)) ? true : '名称需为 kebab-case，如 my-feature',
  });
  if (!value) {
    throw new Error('已取消');
  }
  return toKebabCase(value);
}

export async function createApp(options: CreateAppOptions = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const name = options.name ? toKebabCase(options.name) : await promptName('子应用名称 (kebab-case)');
  if (!isValidPluginName(name)) {
    throw new Error(`无效名称 "${name}"，请使用 kebab-case，例如 order-center`);
  }

  const targetDir = resolveOutputDir(cwd, 'app', name, options.dir);
  if (dirExists(targetDir)) {
    throw new Error(`目录已存在: ${targetDir}`);
  }

  const port = options.port ?? suggestPort('app', cwd);
  const vars = buildVars(name, 'app', {
    port,
    label: options.label,
    route: options.route,
  });

  copyTemplateDir(path.join(getTemplatesRoot(), 'app'), targetDir, vars as unknown as Record<string, string>);

  return targetDir;
}

export async function createSdk(options: CreateSdkOptions = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const name = options.name ? toKebabCase(options.name) : await promptName('SDK 名称 (kebab-case)');
  if (!isValidPluginName(name)) {
    throw new Error(`无效名称 "${name}"，请使用 kebab-case`);
  }

  const targetDir = resolveOutputDir(cwd, 'sdk', name, options.dir);
  if (dirExists(targetDir)) {
    throw new Error(`目录已存在: ${targetDir}`);
  }

  let withUi = options.ui;
  if (withUi === undefined) {
    const { ui } = await prompts({
      type: 'confirm',
      name: 'ui',
      message: '是否包含 UI 组件（供 Shell 插槽渲染）？',
      initial: false,
    });
    withUi = ui ?? false;
  }

  const port = options.port ?? suggestPort('sdk', cwd);
  const vars = buildVars(name, 'sdk', { port });
  const template = withUi ? 'sdk-ui' : 'sdk-logic';

  copyTemplateDir(
    path.join(getTemplatesRoot(), template),
    targetDir,
    vars as unknown as Record<string, string>,
  );

  return targetDir;
}
