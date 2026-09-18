import { useCallback, useEffect, useRef, useState } from 'react';
import { minutesToMs } from '../lib/time';
import type { Phase, PhaseStatus, PomodoroSettings } from '../types';

export interface PomodoroController {
  phase: Phase;
  status: PhaseStatus;
  remainingMs: number;
  /** 当前阶段的总时长 */
  totalMs: number;
  /** 已经过的比例 0–1 */
  progress: number;
  /** 当前循环内已完成的专注次数（用于计算长休） */
  completedFocus: number;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
  /** 手动切换到指定阶段（会停止当前计时） */
  select: (phase: Phase) => void;
}

function durationMs(phase: Phase, settings: PomodoroSettings): number {
  switch (phase) {
    case 'focus':
      return minutesToMs(settings.focusMinutes);
    case 'shortBreak':
      return minutesToMs(settings.shortBreakMinutes);
    case 'longBreak':
      return minutesToMs(settings.longBreakMinutes);
  }
}

/**
 * 番茄钟状态机：idle -> focus -> shortBreak / longBreak -> focus ...
 *
 * 计时基于**绝对时间戳** endAt，而不是自减计数：
 * 后台标签页的 setInterval 会被浏览器节流到 1 次/分钟，
 * 只有用 endAt 重算才能保证切回来时时间准确（详见 开发踩坑点.md）。
 */
export function usePomodoro(
  settings: PomodoroSettings,
  /** credited=false 表示这一阶段是被「跳过」的，不应计入统计 */
  onPhaseComplete: (finished: Phase, next: Phase, credited: boolean) => void,
): PomodoroController {
  const [phase, setPhase] = useState<Phase>('focus');
  const [status, setStatus] = useState<PhaseStatus>('idle');
  const [remainingMs, setRemainingMs] = useState(() =>
    durationMs('focus', settings),
  );
  const [totalMs, setTotalMs] = useState(() => durationMs('focus', settings));
  const [completedFocus, setCompletedFocus] = useState(0);

  const endAtRef = useRef<number | null>(null);
  const completeRef = useRef(onPhaseComplete);
  completeRef.current = onPhaseComplete;

  /** 进入下一个阶段 */
  const enterPhase = useCallback(
    (next: Phase, autoStart: boolean) => {
      const duration = durationMs(next, settings);
      setPhase(next);
      setTotalMs(duration);
      setRemainingMs(duration);

      if (autoStart) {
        endAtRef.current = Date.now() + duration;
        setStatus('running');
      } else {
        endAtRef.current = null;
        setStatus('idle');
      }
    },
    [settings],
  );

  /** 结束当前阶段。credited=false 表示跳过（不计入番茄数） */
  const finishPhase = useCallback(
    (credited: boolean) => {
      const finished = phase;
      let next: Phase;
      let nextCompleted = completedFocus;

      if (finished === 'focus') {
        if (credited) {
          nextCompleted = completedFocus + 1;
          if (nextCompleted >= settings.longBreakInterval) {
            next = 'longBreak';
            nextCompleted = 0;
          } else {
            next = 'shortBreak';
          }
        } else {
          next = 'shortBreak';
        }
        setCompletedFocus(nextCompleted);
      } else {
        next = 'focus';
      }

      enterPhase(next, settings.autoStartNext && credited);
      completeRef.current(finished, next, credited);
    },
    [phase, completedFocus, settings, enterPhase],
  );

  // 计时循环：200ms 重绘一次，真实剩余时间始终由 endAt 推导
  useEffect(() => {
    if (status !== 'running') return;

    const tick = () => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const left = endAt - Date.now();
      if (left <= 0) {
        finishPhase(true);
      } else {
        setRemainingMs(left);
      }
    };

    const timer = window.setInterval(tick, 200);
    // 从后台切回时立即校正一次
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status, finishPhase]);

  // 空闲状态下修改时长设置后，立即刷新显示
  useEffect(() => {
    if (status !== 'idle') return;
    const duration = durationMs(phase, settings);
    setTotalMs(duration);
    setRemainingMs(duration);
  }, [
    status,
    phase,
    settings.focusMinutes,
    settings.shortBreakMinutes,
    settings.longBreakMinutes,
  ]);

  const start = useCallback(() => {
    if (status === 'running') return;
    const base =
      remainingMs > 0 ? remainingMs : durationMs(phase, settings);
    endAtRef.current = Date.now() + base;
    setStatus('running');
  }, [status, remainingMs, phase, settings]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    const endAt = endAtRef.current;
    if (endAt !== null) {
      setRemainingMs(Math.max(0, endAt - Date.now()));
    }
    endAtRef.current = null;
    setStatus('paused');
  }, [status]);

  const toggle = useCallback(() => {
    if (status === 'running') pause();
    else start();
  }, [status, start, pause]);

  const reset = useCallback(() => {
    const duration = durationMs(phase, settings);
    endAtRef.current = null;
    setStatus('idle');
    setTotalMs(duration);
    setRemainingMs(duration);
  }, [phase, settings]);

  const skip = useCallback(() => {
    finishPhase(false);
  }, [finishPhase]);

  const select = useCallback(
    (next: Phase) => {
      endAtRef.current = null;
      enterPhase(next, false);
    },
    [enterPhase],
  );

  const progress = totalMs > 0 ? 1 - remainingMs / totalMs : 0;

  return {
    phase,
    status,
    remainingMs,
    totalMs,
    progress,
    completedFocus,
    start,
    pause,
    toggle,
    reset,
    skip,
    select,
  };
}
