# xingwu-cli

星坞脚手架：通过 `xingwu` 命令创建子应用（App）或 SDK。

## 安装

```bash
# monorepo 内联调
pnpm --filter xingwu-cli build
pnpm link --global --dir packages/xingwu-cli

# 或发布后
npm install -g xingwu-cli
```

## 用法

在星坞 monorepo **根目录**（含 `pnpm-workspace.yaml`）执行：

```bash
# 创建子应用 → packages/apps/<name>
xingwu create app order-center
xingwu create app order-center --port 5180 --label 订单中心 --route /order

# 创建纯逻辑 SDK → packages/sdks/<name>
xingwu create sdk my-guard

# 创建含 UI 的 SDK（antd 走 Shell 共享）
xingwu create sdk my-widget --ui

# 交互式
xingwu create
```

在任意目录可用 `--dir` 指定输出路径：

```bash
xingwu create app demo --dir ./packages/apps/demo
```

## 生成后

1. 在 monorepo 根目录执行 `pnpm install`
2. 进入新包执行 `pnpm dev`
3. 在 `packages/shell/src/main.tsx` 的 `devDescriptors` / `preloadSdks` 中注册 entry URL

含 UI 的 SDK 需在 Shell 的 `window.__ANTD_SHARED__` 中导出模板用到的 antd 组件（如 `Button`、`Typography`）。

## 开发 CLI 本身

```bash
cd packages/xingwu-cli
pnpm build
node dist/cli.js create app test-app --dir /tmp/test-app
```
