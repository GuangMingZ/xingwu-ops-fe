import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tailwindConfigPath = path.resolve(__dirname, '../../../tailwind.config.cjs');

/**
 * use-shared-react 插件
 *
 * 在开发模式下，将 react / react-dom / react/jsx-runtime 的裸导入
 * 重定向到虚拟模块，从 window.__REACT_SHARED__ 获取宿主 shell 提供的
 * React 实例，从而避免双 React 实例导致 hooks 崩溃：
 *   "Cannot read properties of null (reading 'useMemo')"
 *
 * 生产构建（lib 模式）中由 rollupOptions.external 排除 react/react-dom，
 * 不受此插件影响。
 */
function createSharedReactPlugin(): Plugin {
  const virtualReact = '\0virtual:shared-react';
  const virtualReactDOM = '\0virtual:shared-react-dom';
  const virtualReactDOMClient = '\0virtual:shared-react-dom-client';
  const virtualJsxRuntime = '\0virtual:shared-react-jsx-runtime';
  const virtualJsxDevRuntime = '\0virtual:shared-react-jsx-dev-runtime';

  return {
    name: 'use-shared-react',
    enforce: 'pre',

    resolveId(source) {
      if (!this.meta.watchMode) return null;
      if (source === 'react') return virtualReact;
      if (source === 'react-dom') return virtualReactDOM;
      /** react-dom/client 必须单独拦截，否则会落到 Vite 预构建路径，
       * CJS→ESM 转换无法正确暴露 createRoot 命名导出 */
      if (source === 'react-dom/client') return virtualReactDOMClient;
      if (source === 'react/jsx-runtime') return virtualJsxRuntime;
      /** 开发态 automatic JSX 走 jsx-dev-runtime，需一并虚拟化，否则会落到裸模块与宿主预构建冲突 */
      if (source === 'react/jsx-dev-runtime') return virtualJsxDevRuntime;
      return null;
    },

    load(id) {
      if (id === virtualReact) {
        return `
const R = window.__REACT_SHARED__?.React;
if (!R) throw new Error('[SDK] Shared React not found. Ensure shell loads first.');
export default R;
export const Children = R.Children;
export const Component = R.Component;
export const Fragment = R.Fragment;
export const PureComponent = R.PureComponent;
export const StrictMode = R.StrictMode;
export const Suspense = R.Suspense;
export const createElement = R.createElement;
export const cloneElement = R.cloneElement;
export const createContext = R.createContext;
export const createRef = R.createRef;
export const forwardRef = R.forwardRef;
export const useCallback = R.useCallback;
export const useContext = R.useContext;
export const useDebugValue = R.useDebugValue;
export const useEffect = R.useEffect;
export const useImperativeHandle = R.useImperativeHandle;
export const useLayoutEffect = R.useLayoutEffect;
export const useMemo = R.useMemo;
export const useReducer = R.useReducer;
export const useRef = R.useRef;
export const useState = R.useState;
export const useSyncExternalStore = R.useSyncExternalStore;
export const isValidElement = R.isValidElement;
export const lazy = R.lazy;
export const memo = R.memo;
export const version = R.version;
`;
      }
      if (id === virtualReactDOM) {
        return `
const RD = window.__REACT_SHARED__?.ReactDOM;
if (!RD) throw new Error('[SDK] Shared ReactDOM not found. Ensure shell loads first.');
export default RD;
export const createPortal = RD.createPortal;
export const flushSync = RD.flushSync;
export const createRoot = RD.createRoot;
export const hydrateRoot = RD.hydrateRoot;
`;
      }
      if (id === virtualReactDOMClient) {
        return `
const RD = window.__REACT_SHARED__?.ReactDOM;
if (!RD) throw new Error('[SDK] Shared ReactDOM not found. Ensure shell loads first.');
export const createRoot = RD.createRoot;
export const hydrateRoot = RD.hydrateRoot;
`;
      }
      if (id === virtualJsxRuntime) {
        return `
import R from 'react';
// React 18 的 jsx-runtime 通过 react 包的 jsx-runtime 入口暴露
// 从共享的 React 实例中获取 jsx/jsxs 函数
const _jsx = R.jsx || (R.__esModule ? R.default?.jsx : null);
const _jsxs = R.jsxs || (R.__esModule ? R.default?.jsxs : null);
// 兜底：直接使用 React.createElement（JSX transform 会优先使用 jsx/jsxs）
export const jsx = _jsx || ((type, props, key) => R.createElement(type, { ...props, key }, props?.children));
export const jsxs = _jsxs || jsx;
export const Fragment = R.Fragment;
`;
      }
      if (id === virtualJsxDevRuntime) {
        return `
import R from 'react';
export function jsxDEV(type, props, key, _isStaticChildren, _source, _self) {
  const p = key != null && props != null ? { ...props, key } : key != null ? { ...(props || {}), key } : props;
  return R.createElement(type, p);
}
export const Fragment = R.Fragment;
`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [createSharedReactPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@styles': path.resolve(__dirname, '../../../styles'),
    },
    dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  /**
   * 完全禁用依赖预构建，让所有模块走 Vite 的正常 transform → resolve pipeline。
   * 这样 createSharedReactPlugin 插件才能拦截所有 react / react-dom / react/jsx-runtime
   * 的裸导入，重定向到共享实例。
   */
  optimizeDeps: {
    disabled: true,
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: tailwindConfigPath }), autoprefixer()],
    },
  },
  server: {
    port: 5176,
    strictPort: true,
    host: true,
    cors: true,
  },
  build: {
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: 'region-selector',
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@xingwu/types'],
    },
  },
});
