import { UX } from '../config';
import { initialState, transition, type PomodoroState } from './pomodoroMachine';
import type { Phase, PhaseStatus, PomodoroSettings } from '../types';

/**
 * 运行中会话的持久化。
 *
 * 没有它的时候，刷新页面（或手滑 F5）会让正在跑的 25 分钟直接归零。
 * 因为计时是时间戳驱动的，恢复时只要拿 endAt 和当前时间相减就能算出真实剩余，
 * 应用离线的那段时间也不会被"白送"。
 */
export interface PersistedSession {
  phase: Phase;
  status: PhaseStatus;
  remainingMs: number;
  totalMs: number;
  completedFocus: number;
  endAt: number | null;
  savedAt: number;
}

export interface RestoredPhase {
  phase: Phase;
  minutes: number;
}

export interface RehydrateResult {
  state: PomodoroState;
  /**
   * 页面不在的那段时间里恰好结束的**专注**（需要补记统计，但不播钟声）。
   * 只有专注阶段会返回它 —— 休息阶段结束没有成绩可记，直接进入下一段状态即可。
   */
  completedWhileAway: RestoredPhase | null;
}

const PHASES: Phase[] = ['focus', 'shortBreak', 'longBreak'];

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<PersistedSession>;
  return (
    typeof session.phase === 'string' &&
    PHASES.includes(session.phase as Phase) &&
    typeof session.status === 'string' &&
    typeof session.totalMs === 'number' &&
    typeof session.completedFocus === 'number'
  );
}

export function serializeSession(state: PomodoroState, savedAt: number): PersistedSession {
  return {
    phase: state.phase,
    status: state.status,
    // 运行中的剩余时间由 endAt 推导，这里只是为了暂停/空闲态能原样恢复
    remainingMs: state.remainingMs,
    totalMs: state.totalMs,
    completedFocus: state.completedFocus,
    endAt: state.endAt,
    savedAt,
  };
}

export function rehydrateSession(
  saved: unknown,
  now: number,
  settings: PomodoroSettings,
): RehydrateResult {
  if (!isPersistedSession(saved)) {
    return { state: initialState(settings), completedWhileAway: null };
  }

  const base: PomodoroState = {
    phase: saved.phase,
    status: saved.status,
    remainingMs: saved.remainingMs,
    totalMs: saved.totalMs,
    completedFocus: saved.completedFocus,
    endAt: saved.endAt,
  };

  if (saved.status === 'running' && saved.endAt !== null) {
    // 还没结束：按时间戳算出真实剩余
    if (saved.endAt > now) {
      return {
        state: { ...base, remainingMs: saved.endAt - now },
        completedWhileAway: null,
      };
    }

    // 已经结束且在合理窗口内：复用状态机的完成规则结算
    if (now - saved.endAt >= UX.sessionRestoreWindowMs) {
      return { state: initialState(settings), completedWhileAway: null };
    }

    const live: PomodoroState = { ...base, status: 'running', remainingMs: 0 };
    // 关键：强制关闭 autoStartNext，否则"回来后"会白送一段已经流逝的时间
    const result = transition(live, { type: 'TICK', at: now }, {
      ...settings,
      autoStartNext: false,
    });

    const credited = result.completed?.finished === 'focus';

    return {
      state: result.state,
      completedWhileAway: credited
        ? { phase: 'focus', minutes: Math.round(saved.totalMs / 60_000) }
        : null,
    };
  }

  // idle / paused：原样恢复，endAt 一律清空
  return { state: { ...base, endAt: null }, completedWhileAway: null };
}
