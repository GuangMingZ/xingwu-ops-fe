import { useMemo } from 'react';
import { getHostAntd } from '@/shims/host-antd';

/** 供 Shell 插槽渲染的示例 UI（使用宿主 antd） */
export function {{pascalName}}Panel() {
  const { Button, Typography } = useMemo(() => getHostAntd(), []);

  return (
    <span className="inline-flex items-center gap-2">
      <Typography.Text type="secondary">{{navLabel}}</Typography.Text>
      <Button size="small" type="default">
        操作
      </Button>
    </span>
  );
}
