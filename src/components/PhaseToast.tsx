import { useEffect, useRef, useState } from 'react';
import { SANS } from '../lib/ui';
import type { ToastState } from '../types';

interface Props {
  /** 每次变化触发一次提示；id 用于重置计时 */
  toast: ToastState | null;
  onDismiss: () => void;
}

const VISIBLE_MS = 2600;
/** 带操作按钮的提示要给人留出反应时间（"撤销"这类操作通常需要几秒） */
const ACTION_VISIBLE_MS = 6000;

/**
 * 阶段切换时中央浮现的引导语（也可携带一个操作按钮，如「撤销」）。
 * 注意：effect 只依赖 toast.id —— 父组件每 200ms 会因倒计时重渲染，
 * 若依赖整个 toast 对象或 onDismiss 函数，计时器会被不断重置导致永不消失（详见 开发踩坑点.md）。
 */
export function PhaseToast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const toastId = toast?.id ?? null;
  const hasAction = toast?.action !== undefined;

  useEffect(() => {
    if (toastId === null) return;
    setVisible(true);
    const timer = window.setTimeout(
      () => {
        setVisible(false);
        dismissRef.current();
      },
      hasAction ? ACTION_VISIBLE_MS : VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [toastId, hasAction]);

  if (!toast) return null;

  return (
    // z-[100]：必须在抽屉（z-90）与它的遮罩（z-80）之上 ——
    // 否则"删除任务 → 撤销"这条链路里，撤销按钮会被遮罩挡住点不到（真机验证发现）。
    // 容器仍是 pointer-events-none，只有按钮自己接收点击。
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-3 rounded-full px-7 py-4 text-lg backdrop-blur-md sm:text-xl"
        style={{
          fontFamily: SANS,
          color: '#ffffff',
          background: 'rgba(0,0,0,0.32)',
          border: '1px solid rgba(255,255,255,0.16)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(0.75rem)',
          transitionProperty: 'opacity, transform',
          transitionDuration: '600ms',
          transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <span>{toast.text}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              setVisible(false);
              dismissRef.current();
            }}
            className="pointer-events-auto shrink-0 rounded-full bg-white/90 px-4 py-1.5 text-sm text-[#182C41] transition-opacity duration-300 hover:opacity-85"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
