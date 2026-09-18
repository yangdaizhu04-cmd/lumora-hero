import { useEffect, useState } from 'react';

/**
 * 分钟级的时间刷新。
 * 用于夜间模式判定、睡眠定时倒计时这类"不需要秒级精度"的 UI，
 * 避免为了一个日期判断引入高频重渲染。
 */
export function useClockTick(intervalMs = 30_000): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return tick;
}
