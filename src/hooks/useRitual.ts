import { useCallback, useEffect, useRef, useState } from 'react';

export interface RitualState {
  /** null 表示没有在进行准备倒计时 */
  count: number | null;
  isActive: boolean;
  start: (seconds: number) => void;
  cancel: () => void;
}

/**
 * 开始前的准备倒计时（3-2-1）。
 * 给大脑一个"要进入专注了"的开关信号，比直接开始更容易沉下去。
 */
export function useRitual(onComplete: () => void): RitualState {
  const [count, setCount] = useState<number | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) {
      completeRef.current();
      return;
    }
    setCount(seconds);
  }, []);

  const cancel = useCallback(() => setCount(null), []);

  useEffect(() => {
    if (count === null) return;

    if (count <= 0) {
      setCount(null);
      completeRef.current();
      return;
    }

    const timer = window.setTimeout(() => {
      setCount((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [count]);

  return { count, isActive: count !== null, start, cancel };
}
