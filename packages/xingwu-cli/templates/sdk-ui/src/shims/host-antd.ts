export interface HostAntdSubset {
  Button: typeof import('antd').Button;
  Typography: typeof import('antd').Typography;
}

export function getHostAntd(): HostAntdSubset {
  const w = window as Window & { __ANTD_SHARED__?: { antd: HostAntdSubset } };
  const mod = w.__ANTD_SHARED__?.antd;
  if (!mod) {
    throw new Error('[{{name}}] 未找到 window.__ANTD_SHARED__.antd，请由 Shell 注入后再加载 SDK。');
  }
  return mod;
}
