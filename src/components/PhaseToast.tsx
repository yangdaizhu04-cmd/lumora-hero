import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 每次变化触发一次提示；id 用于重置计时 */
  toast: { id: number; text: string } | null;
  onDismiss: () => void;
}

const VISIBLE_MS = 2600;

/**
 * 阶段切换时中央浮现的引导语。
 * 注意：effect 只依赖 toast.id —— 父组件每 200ms 会因倒计时重渲染，
 * 若依赖整个 toast 对象或 onDismiss 函数，计时器会被不断重置导致永不消失（详见 开发踩坑点.md）。
 */
export function PhaseToast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const toastId = toast?.id ?? null;

  useEffect(() => {
    if (toastId === null) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      dismissRef.current();
    }, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  if (!toast) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-full px-7 py-4 text-lg backdrop-blur-md sm:text-xl"
        style={{
          fontFamily: 'system-ui, sans-serif',
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
        {toast.text}
      </div>
    </div>
  );
}
