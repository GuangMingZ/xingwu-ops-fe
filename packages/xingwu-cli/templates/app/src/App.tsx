import { Typography } from 'antd';
import { Route, Routes } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';
import { HomePage } from '@pages/HomePage';

interface AppProps {
  ctx: AppContext;
}

export function App({ ctx }: AppProps) {
  return (
    <div>
      <Typography.Title level={4} className="!mb-4">
        {{navLabel}}
      </Typography.Title>
      <Routes>
        <Route index element={<HomePage ctx={ctx} />} />
      </Routes>
    </div>
  );
}
