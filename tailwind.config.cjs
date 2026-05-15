const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'packages', 'shell', 'src', '**', '*.{ts,tsx}'),
    path.join(__dirname, 'packages', 'apps', '*', 'src', '**', '*.{ts,tsx}'),
    path.join(__dirname, 'packages', 'sdks', '*', 'src', '**', '*.{ts,tsx}'),
  ],
  // 与 antd 5 并存时关闭 Tailwind preflight，减少全局样式冲突
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
