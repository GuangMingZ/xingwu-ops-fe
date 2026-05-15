import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Descriptions, Result, Typography } from 'antd';
import { Link, useParams } from 'react-router-dom';
import type { AppContext } from '@xingwu/types';

interface ProductDetailProps {
  ctx: AppContext;
}

const mockDetail: Record<
  string,
  { name: string; price: number; category: string; desc: string; stock: number }
> = {
  P001: {
    name: '智能手表 Pro',
    price: 1299,
    category: '数码',
    desc: '新一代智能手表，支持血氧检测、睡眠监测、50米防水。',
    stock: 256,
  },
  P002: {
    name: '无线降噪耳机',
    price: 599,
    category: '数码',
    desc: '主动降噪，40小时续航，Hi-Res认证。',
    stock: 128,
  },
  P003: {
    name: '运动跑鞋 X3',
    price: 399,
    category: '运动',
    desc: '轻量缓震，透气网面，适合长距离跑步。',
    stock: 512,
  },
  P004: {
    name: '有机绿茶礼盒',
    price: 188,
    category: '食品',
    desc: '精选高山有机绿茶，礼盒装。',
    stock: 0,
  },
  P005: {
    name: '便携蓝牙音箱',
    price: 299,
    category: '数码',
    desc: 'IPX7防水，12小时续航，360°环绕音效。',
    stock: 89,
  },
};

export function ProductDetail({ ctx: _ctx }: ProductDetailProps) {
  const { productId } = useParams<{ productId: string }>();
  const product = mockDetail[productId || ''];

  if (!product) {
    return (
      <Result
        status="404"
        title="商品不存在"
        extra={
          <Link to="..">
            <Button type="primary">返回列表</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Link to="..">
        <Button type="link" icon={<ArrowLeftOutlined />} className="px-0">
          返回列表
        </Button>
      </Link>
      <Typography.Title level={3} className="mt-2">
        {product.name}
      </Typography.Title>

      <Descriptions bordered column={2} className="mt-4">
        <Descriptions.Item label="价格">
          <Typography.Text type="danger" className="text-2xl">
            ¥{product.price}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="分类">{product.category}</Descriptions.Item>
        <Descriptions.Item label="库存">
          <Typography.Text type={product.stock > 0 ? 'success' : 'danger'}>
            {product.stock > 0 ? `${product.stock} 件` : '已售罄'}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="商品 ID">
          <Typography.Text code>{productId}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {product.desc}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
