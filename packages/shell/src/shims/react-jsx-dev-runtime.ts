/**
 * 为「远程动态 import 的 SDK」提供与 Vite+pnpm 兼容的 jsx-dev-runtime。
 *
 * 宿主对 `http://localhost:5176/...` 做依赖预构建时，会落到本仓库的
 * `react/jsx-dev-runtime.js`（CJS 桥接），浏览器 ESM 下常出现
 * “does not provide an export named 'jsxDEV'”。统一走本 shim + vite alias。
 */
import * as React from 'react';

export function jsxDEV(
  type: React.ElementType,
  props: Record<string, unknown> | null,
  key: React.Key | undefined,
  _isStaticChildren: boolean,
  _source: unknown,
  _self: unknown,
): React.ReactElement {
  const p =
    key != null && props != null
      ? { ...props, key }
      : key != null
        ? { ...(props ?? {}), key }
        : props;
  return React.createElement(type, p as never);
}

export const Fragment = React.Fragment;
