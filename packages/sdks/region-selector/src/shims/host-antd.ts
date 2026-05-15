/** Shell 注入的 antd 子集（见 `packages/shell/src/main.tsx`） */
export interface HostAntdSubset {
  Breadcrumb: typeof import('antd').Breadcrumb;
  Button: typeof import('antd').Button;
  Dropdown: typeof import('antd').Dropdown;
  Empty: typeof import('antd').Empty;
  Select: typeof import('antd').Select;
  Space: typeof import('antd').Space;
  Typography: typeof import('antd').Typography;
}

export function getHostAntd(): HostAntdSubset {
  const w = window as Window & { __ANTD_SHARED__?: { antd: HostAntdSubset } };
  const mod = w.__ANTD_SHARED__?.antd;
  if (!mod) {
    throw new Error(
      '[region-selector] 未找到 window.__ANTD_SHARED__.antd。请由 Shell 先注入后再加载本 SDK。',
    );
  }
  return mod;
}
