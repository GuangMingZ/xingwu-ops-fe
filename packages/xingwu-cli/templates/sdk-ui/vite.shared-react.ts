import type { Plugin } from 'vite';

/** 开发态复用 Shell 注入的 window.__REACT_SHARED__，避免双 React 实例 */
export function createSharedReactPlugin(): Plugin {
  const virtualReact = '\0virtual:shared-react';
  const virtualReactDOM = '\0virtual:shared-react-dom';
  const virtualJsxRuntime = '\0virtual:shared-react-jsx-runtime';
  const virtualJsxDevRuntime = '\0virtual:shared-react-jsx-dev-runtime';

  return {
    name: 'use-shared-react',
    enforce: 'pre',
    resolveId(source) {
      if (!this.meta.watchMode) return null;
      if (source === 'react') return virtualReact;
      if (source === 'react-dom') return virtualReactDOM;
      if (source === 'react/jsx-runtime') return virtualJsxRuntime;
      if (source === 'react/jsx-dev-runtime') return virtualJsxDevRuntime;
      return null;
    },
    load(id) {
      if (id === virtualReact) {
        return `
const R = window.__REACT_SHARED__?.React;
if (!R) throw new Error('[SDK] Shared React not found. Ensure shell loads first.');
export default R;
export const useMemo = R.useMemo;
export const useState = R.useState;
export const useEffect = R.useEffect;
export const Fragment = R.Fragment;
export const createElement = R.createElement;
`;
      }
      if (id === virtualReactDOM) {
        return `
const RD = window.__REACT_SHARED__?.ReactDOM;
if (!RD) throw new Error('[SDK] Shared ReactDOM not found.');
export default RD;
`;
      }
      if (id === virtualJsxRuntime || id === virtualJsxDevRuntime) {
        return `
import R from 'react';
export const jsx = (type, props, key) => R.createElement(type, key != null ? { ...props, key } : props);
export const jsxs = jsx;
export function jsxDEV(type, props, key) {
  return R.createElement(type, key != null ? { ...(props || {}), key } : props);
}
export const Fragment = R.Fragment;
`;
      }
      return null;
    },
  };
}
