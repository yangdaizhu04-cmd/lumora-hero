import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  toggleTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  toggleMute: () => void;
  toggleTasks: () => void;
  toggleFocusMode: () => void;
  /** Esc：优先退出专注模式，否则关闭面板 */
  escape: () => void;
  selectScene: (index: number) => void;
  sceneCount: number;
}

/**
 * 全局键盘快捷键。
 *
 * 处理函数放在 ref 里、监听器只挂一次：
 * 否则每次渲染都要重新绑定，而且依赖数组会牵进一堆高频变化的回调。
 * 抽屉打开时输入框 / 开关保持原生行为（空格仍激活按钮）。
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const current = ref.current;

      // 抽屉内部保留原生行为（开关/按钮用空格激活），全局空格只服务计时器
      if (event.code === 'Space' && target?.closest('aside')) return;

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          current.toggleTimer();
          break;
        case 'KeyR':
          current.resetTimer();
          break;
        case 'KeyS':
          current.skipPhase();
          break;
        case 'KeyM':
          current.toggleMute();
          break;
        case 'KeyT':
          current.toggleTasks();
          break;
        case 'KeyF':
          current.toggleFocusMode();
          break;
        case 'Escape':
          current.escape();
          break;
        default: {
          if (/^Digit[1-9]$/.test(event.code)) {
            const index = Number(event.code.slice(5)) - 1;
            if (index < current.sceneCount) current.selectScene(index);
          }
        }
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
