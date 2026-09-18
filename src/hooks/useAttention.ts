import { useCallback, useEffect, useRef, useState } from 'react';

export interface AttentionState {
  /** 本轮专注期间切走标签页的次数 */
  count: number;
  reset: () => void;
}

/**
 * 分心自察：只在专注进行时统计"离开页面"的次数。
 *
 * 刻意不做任何评判（不弹警告、不打分）——
 * 番茄工作法的本意是觉察，而不是自责。数字会在回顾面板里呈现。
 */
export function useAttention(active: boolean): AttentionState {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      countRef.current += 1;
      setCount(countRef.current);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active]);

  const reset = useCallback(() => {
    countRef.current = 0;
    setCount(0);
  }, []);

  return { count, reset };
}
