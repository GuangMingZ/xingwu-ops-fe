import { Button, Card, Typography } from 'antd';
import type { AppContext } from '@xingwu/types';

interface HomePageProps {
  ctx: AppContext;
}

export function HomePage({ ctx: _ctx }: HomePageProps) {
  return (
    <Card>
      <Typography.Paragraph>欢迎使用星坞子应用「{{navLabel}}」。</Typography.Paragraph>
      <Button type="primary">开始开发</Button>
    </Card>
  );
}
