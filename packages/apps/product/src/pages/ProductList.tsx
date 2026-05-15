import { ReloadOutlined } from '@ant-design/icons';
import { Button, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';

interface ProductListProps {
  ctx: AppContext;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  status: 'active' | 'inactive';
}

const mockProducts: Product[] = [
  { id: 'P001', name: '智能手表 Pro', price: 1299, category: '数码', status: 'active' },
  { id: 'P002', name: '无线降噪耳机', price: 599, category: '数码', status: 'active' },
  { id: 'P003', name: '运动跑鞋 X3', price: 399, category: '运动', status: 'active' },
  { id: 'P004', name: '有机绿茶礼盒', price: 188, category: '食品', status: 'inactive' },
  { id: 'P005', name: '便携蓝牙音箱', price: 299, category: '数码', status: 'active' },
];

export function ProductList({ ctx }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRegion = async () => {
      try {
        const regionApi = await ctx.sdk.load<{ getCurrentRegion: () => { id: string; name: string } }>(
          'region-selector',
        );
        const region = regionApi.getCurrentRegion();
        console.info(`[Product] Current region: ${region.name} (${region.id})`);
      } catch (e) {
        console.warn('[Product] region-selector SDK not available:', e);
      }
    };
    void loadRegion();
  }, [ctx]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setProducts([...mockProducts]);
      setLoading(false);
    }, 500);
  };

  const columns: ColumnsType<Product> = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `¥${price}`,
    },
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: Product['status']) =>
        status === 'active' ? <Tag color="success">在售</Tag> : <Tag>下架</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Link to={`detail/${record.id}`}>查看</Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Typography.Title level={4} className="!mb-0">
          商品列表
        </Typography.Title>
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={handleRefresh}>
          刷新
        </Button>
      </div>

      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
        pagination={false}
        bordered
        size="middle"
      />
    </div>
  );
}
