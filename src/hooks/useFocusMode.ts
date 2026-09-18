import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

export interface FocusModeApi {
  /** 是否需要隐藏全部 UI */
  isFocusMode: boolean;
  /** 给快捷键等回调读最新值（避免把它们塞进依赖数组） */
  activeRef: MutableRefObject<boolean>;
  toggle: () => void;
}

/**
 * 专注模式：隐藏所有 UI，并尽量进入浏览器全屏。
 *
 * 全屏请求可能被拒绝（自动化环境 / 缺少用户激活）—— 此时"隐藏 UI"依然生效，
 * 所以 Promise 的拒绝必须静默吞掉；同时监听 fullscreenchange，
 * 用户按 Esc / F11 退出全屏时同步退出专注模式，状态不会错乱。
 */
export function useFocusMode(): FocusModeApi {
  const [isFocusMode, setFocusMode] = useState(false);
  const activeRef = useRef(false);

  const toggle = useCallback(() => {
    const next = !activeRef.current;
    activeRef.current = next;
    setFocusMode(next);

    if (next) {
      const request = document.documentElement.requestFullscreen?.();
      if (request) void request.catch(() => undefined);
    } else if (document.fullscreenElement) {
      const exit = document.exitFullscreen?.();
      if (exit) void exit.catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && activeRef.current) {
        activeRef.current = false;
        setFocusMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return { isFocusMode, activeRef, toggle };
}
