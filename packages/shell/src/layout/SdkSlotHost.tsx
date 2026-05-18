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
      // 触发条件：SDK 在 render 阶段调用 requestRerender
      // 与正常路径差异：同步 setState 会导致 effect cleanup 在 React 渲染中 unmount Root
      // 修复原因：推迟到微任务，刷新走独立 effect，不触发卸载 cleanup
      queueMicrotask(() => {
        setRenderVersion((v) => v + 1);
      });
    });
  }, [shell, sdkName]);

  /** 挂载 / 卸载（仅随插槽或 SDK 变化，不含 renderVersion） */
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
      const container = containerRef.current;
      if (!container) return;
      // 推迟卸载，避免在 React commit 阶段同步 unmount 嵌套 Root
      queueMicrotask(() => {
        void shell.sdkRegistry.unrenderFrom(sdkName, container).catch(console.error);
      });
    };
  }, [shell, sdkName, slot]);

  /** requestRerender：原地刷新，不 unmount */
  useEffect(() => {
    if (renderVersion === 0) return;

    const el = containerRef.current;
    if (!el) return;

    void shell.sdkRegistry.renderTo(sdkName, el, { slot }).catch((err) => {
      console.error(`[Xingwu] SdkSlotHost refresh failed (${sdkName}@${slot}):`, err);
    });
  }, [renderVersion, shell, sdkName, slot]);

  return <div ref={containerRef} className={className} data-xingwu-slot={slot} />;
}
