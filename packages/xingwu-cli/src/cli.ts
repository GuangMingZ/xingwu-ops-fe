#!/usr/bin/env node
import { Command } from 'commander';
import { createApp, createSdk } from './create.js';

const program = new Command();

program
  .name('xingwu')
  .description('星坞脚手架 — 创建子应用（App）与轻量 SDK')
  .version('0.1.0');

const createCmd = program.command('create').description('创建插件工程');

createCmd
  .command('app <name>')
  .description('创建子应用（挂载到 Shell 的业务模块）')
  .option('-d, --dir <path>', '输出目录（默认 monorepo 内 packages/apps/<name>）')
  .option('-p, --port <number>', '独立开发端口', (v) => parseInt(v, 10))
  .option('-l, --label <text>', '侧栏菜单文案')
  .option('-r, --route <path>', '路由前缀，如 /order')
  .action(async (name: string, opts) => {
    try {
      const dir = await createApp({
        name,
        dir: opts.dir,
        port: opts.port,
        label: opts.label,
        route: opts.route,
      });
      console.log(`\n✓ 子应用已创建: ${dir}`);
      console.log('\n下一步:');
      console.log(`  cd ${dir}`);
      console.log('  pnpm install   # 在 monorepo 根目录执行 pnpm install');
      console.log(`  pnpm dev       # 独立开发，默认端口见 vite.config.ts`);
      console.log('\n在 Shell 的 devDescriptors 中注册 entry URL 后即可联调。');
    } catch (err) {
      console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

createCmd
  .command('sdk <name>')
  .description('创建 SDK（纯逻辑或含 UI 组件）')
  .option('-d, --dir <path>', '输出目录（默认 monorepo 内 packages/sdks/<name>）')
  .option('-p, --port <number>', '独立开发端口', (v) => parseInt(v, 10))
  .option('--ui', '包含 UI 组件模板（antd + 宿主共享）')
  .action(async (name: string, opts: { dir?: string; port?: number; ui?: boolean }) => {
    try {
      const ui = opts.ui === true ? true : undefined;
      const dir = await createSdk({
        name,
        dir: opts.dir,
        port: opts.port,
        ui,
      });
      console.log(`\n✓ SDK 已创建: ${dir}`);
      console.log('\n下一步:');
      console.log(`  cd ${dir}`);
      console.log('  pnpm install   # 在 monorepo 根目录执行 pnpm install');
      console.log(`  pnpm dev`);
      console.log('\n在 Shell 的 devDescriptors / preloadSdks 中注册后即可使用。');
    } catch (err) {
      console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

/** 无子命令时：xingwu create → 交互选择类型 */
createCmd.action(async () => {
  const prompts = (await import('prompts')).default;
  const { type } = await prompts({
    type: 'select',
    name: 'type',
    message: '要创建什么？',
    choices: [
      { title: '子应用 (app)', value: 'app' },
      { title: 'SDK', value: 'sdk' },
    ],
  });
  if (!type) {
    console.log('已取消');
    return;
  }
  try {
    if (type === 'app') {
      const dir = await createApp();
      console.log(`\n✓ 子应用已创建: ${dir}`);
    } else {
      const dir = await createSdk();
      console.log(`\n✓ SDK 已创建: ${dir}`);
    }
  } catch (err) {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
});

program.parse();
