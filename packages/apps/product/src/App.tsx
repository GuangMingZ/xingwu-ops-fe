import { Space, Typography } from 'antd';
import { Link, Route, Routes } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';
import { ProductList } from '@pages/ProductList';
import { ProductDetail } from '@pages/ProductDetail';

interface AppProps {
  ctx: AppContext;
}

export function App({ ctx }: AppProps) {
  return (
    <div>
      <Space
        size="middle"
        split={<Typography.Text type="secondary">|</Typography.Text>}
        className="mb-4 pb-3 border-b border-neutral-200"
      >
        <Link to=".">商品列表</Link>
        <Link to="detail/demo-product-001">示例详情</Link>
      </Space>
      <Routes>
        <Route index element={<ProductList ctx={ctx} />} />
        <Route path="detail/:productId" element={<ProductDetail ctx={ctx} />} />
      </Routes>
    </div>
  );
}
