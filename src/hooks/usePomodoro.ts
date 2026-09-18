import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMER } from '../config';
import {
  transition,
  type PomodoroEvent,
  type PomodoroState,
} from '../lib/pomodoroMachine';
import {
  rehydrateSession,
  serializeSession,
  type RestoredPhase,
} from '../lib/session';
import { readStorage, STORAGE_KEYS, writeStorage } from '../lib/storage';
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
  /** 恢复会话时带回的分心次数，作为计数起点 */
  restoredAttention: number;
  /** 把当前的分心次数同步进会话存档（页面刷新后不丢） */
  syncInterruptions: (count: number) => void;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
  /** 手动切换到指定阶段（会停止当前计时） */
  select: (phase: Phase) => void;
}

export interface UsePomodoroOptions {
  /** 页面刷新/关闭期间恰好结束的专注，需要补记统计与提示 */
  onSessionRestored?: (restored: RestoredPhase) => void;
}

/**
 * 番茄钟的 React 绑定层。
 * 转移规则都在 lib/pomodoroMachine.ts 的纯函数里，这里只负责：
 * 1. 状态持有与重渲染
 * 2. 计时循环与 visibilitychange 校正
 * 3. 运行中会话的持久化与恢复（刷新不丢番茄钟）
 * 4. 把"阶段完成"这一效果抛给调用方（钟声、写日志、通知）
 */
export function usePomodoro(
  settings: PomodoroSettings,
  /** credited=false 表示这一阶段是被「跳过」的，不应计入统计 */
  onPhaseComplete: (finished: Phase, next: Phase, credited: boolean) => void,
  options: UsePomodoroOptions = {},
): PomodoroController {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const completeRef = useRef(onPhaseComplete);
  completeRef.current = onPhaseComplete;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 启动时恢复上次会话（幂等的纯计算，可以安全地在渲染中 memo 一次）
  const bootRef = useRef<ReturnType<typeof rehydrateSession> | null>(null);
  if (bootRef.current === null) {
    bootRef.current = rehydrateSession(
      readStorage(STORAGE_KEYS.session),
      Date.now(),
      settings,
    );
  }

  const [state, setState] = useState<PomodoroState>(bootRef.current.state);
  const stateRef = useRef(state);
  stateRef.current = state;

  /** 分心次数随会话一起落盘，刷新后接着算 */
  const interruptionsRef = useRef(bootRef.current.interruptions);

  const dispatch = useCallback((event: PomodoroEvent) => {
    const result = transition(stateRef.current, event, settingsRef.current);

    if (result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
    }

    if (result.completed) {
      completeRef.current(
        result.completed.finished,
        result.completed.next,
        result.completed.credited,
      );
    }
  }, []);

  // 上报"离开期间完成的专注"，只做一次
  const reportedRef = useRef(false);
  useEffect(() => {
    const restored = bootRef.current?.completedWhileAway;
    if (!restored || reportedRef.current) return;
    reportedRef.current = true;
    optionsRef.current.onSessionRestored?.(restored);
  }, []);

  // 持久化：只在阶段/状态/结束时间/完成计数变化时写，不跟着每秒的剩余时间写
  const signatureRef = useRef('');
  useEffect(() => {
    const signature = `${state.phase}|${state.status}|${state.endAt ?? ''}|${state.completedFocus}`;
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    writeStorage(
      STORAGE_KEYS.session,
      serializeSession(stateRef.current, Date.now(), interruptionsRef.current),
    );
  }, [state]);

  /** 分心次数变化时立刻更新存档 */
  const syncInterruptions = useCallback((count: number) => {
    if (count === interruptionsRef.current) return;
    interruptionsRef.current = count;
    writeStorage(
      STORAGE_KEYS.session,
      serializeSession(stateRef.current, Date.now(), count),
    );
  }, []);

  // 计时循环：200ms 轮询保证边界精度，但状态只在"显示的秒数"变化时更新
  useEffect(() => {
    if (state.status !== 'running') return;

    const tick = () => dispatch({ type: 'TICK', at: Date.now() });
    const timer = window.setInterval(tick, TIMER.tickMs);
    // 从后台切回时立即校正一次
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.status, dispatch]);

  // 时长设置变化时同步显示（运行中不打断当前阶段）
  useEffect(() => {
    dispatch({ type: 'SETTINGS_CHANGED', settings: settingsRef.current });
  }, [
    dispatch,
    settings.focusMinutes,
    settings.shortBreakMinutes,
    settings.longBreakMinutes,
  ]);

  const start = useCallback(() => {
    dispatch({ type: 'START', at: Date.now() });
  }, [dispatch]);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE', at: Date.now() });
  }, [dispatch]);

  const toggle = useCallback(() => {
    if (stateRef.current.status === 'running') {
      dispatch({ type: 'PAUSE', at: Date.now() });
    } else {
      dispatch({ type: 'START', at: Date.now() });
    }
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const skip = useCallback(() => {
    dispatch({ type: 'SKIP', at: Date.now() });
  }, [dispatch]);

  const select = useCallback(
    (phase: Phase) => {
      dispatch({ type: 'SELECT', phase });
    },
    [dispatch],
  );

  const progress = state.totalMs > 0 ? 1 - state.remainingMs / state.totalMs : 0;

  return {
    phase: state.phase,
    status: state.status,
    remainingMs: state.remainingMs,
    totalMs: state.totalMs,
    progress,
    completedFocus: state.completedFocus,
    restoredAttention: bootRef.current.interruptions,
    syncInterruptions,
    start,
    pause,
    toggle,
    reset,
    skip,
    select,
  };
}
