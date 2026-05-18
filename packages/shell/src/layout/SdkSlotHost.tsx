import { useEffect, useRef, useState } from 'react';
import type { Shell } from '@/bootstrap';

interface SdkSlotHostProps {
  shell: Shell;
  /** SDK 插件名 */
  sdkName: string;
  /** 与 PluginDescriptor.uiComponents[].slot 对应 */
  slot: string;
  className?: string;
}

/**
 * SDK 插槽宿主：提供 DOM 容器并调用 SdkLifecycle.render(container)。
 * SDK 通过 data-xingwu-slot 识别应渲染的组件。
 */
export function SdkSlotHost({ shell, sdkName, slot, className }: SdkSlotHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    return shell.sdkRegistry.onRerender(sdkName, () => {
      setRenderVersion((v) => v + 1);
    });
  }, [shell, sdkName]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    void (async () => {
      try {
        await shell.sdkRegistry.renderTo(sdkName, el, { slot });
      } catch (err) {
        if (!cancelled) {
          console.error(`[Xingwu] SdkSlotHost render failed (${sdkName}@${slot}):`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
      void shell.sdkRegistry.unrenderFrom(sdkName, el).catch(console.error);
    };
  }, [shell, sdkName, slot, renderVersion]);

  return <div ref={containerRef} className={className} data-xingwu-slot={slot} />;
}
