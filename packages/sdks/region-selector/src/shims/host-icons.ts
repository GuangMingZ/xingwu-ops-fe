export interface HostIconsSubset {
  GlobalOutlined: typeof import('@ant-design/icons').GlobalOutlined;
}

export function getHostIcons(): HostIconsSubset {
  const w = window as Window & { __ANTD_SHARED__?: { icons: HostIconsSubset } };
  const mod = w.__ANTD_SHARED__?.icons;
  if (!mod) {
    throw new Error(
      '[region-selector] 未找到 window.__ANTD_SHARED__.icons。请由 Shell 先注入后再加载本 SDK。',
    );
  }
  return mod;
}
