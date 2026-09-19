import { TIMER } from '../config';
import { minutesToMs } from './time';
import type { Phase, PhaseStatus, PomodoroSettings, TimerMode } from '../types';

/**
 * 番茄钟状态机（纯函数）。
 *
 * 抽出成纯函数的原因：转移规则原本散落在若干 useCallback 里，
 * 加一个"延长 5 分钟"之类的需求很容易漏掉某个分支。
 * 这里用一张显式的转移表覆盖全部事件，并由 pomodoroMachine.test.ts 全量验证。
 *
 * 计时基于**绝对时间戳 endAt**，不用自减计数：
 * 后台标签页的 setInterval 会被节流，只有时间戳重算才不漂移（见 开发踩坑点.md 记录 7）。
 */
export interface PomodoroState {
  phase: Phase;
  status: PhaseStatus;
  remainingMs: number;
  totalMs: number;
  /** 当前循环内已完成的专注次数（用于计算长休） */
  completedFocus: number;
  /** 运行中的结束时间戳；idle / paused 时为 null */
  endAt: number | null;
  /**
   * 当前计时模式。
   * Flowtime 下 `remainingMs` 表示"离安全上限还有多久"，
   * 界面上的正计时要用 `totalMs - remainingMs` 算，不能直接显示 remainingMs。
   */
  mode: TimerMode;
}

export type PomodoroEvent =
  | { type: 'START'; at: number }
  | { type: 'PAUSE'; at: number }
  | { type: 'RESET' }
  | { type: 'SKIP'; at: number }
  /** 主动结束当前专注并计入成绩（Flowtime 专用） */
  | { type: 'FINISH'; at: number }
  | { type: 'SELECT'; phase: Phase }
  | { type: 'TICK'; at: number }
  | { type: 'EXTEND'; minutes: number }
  | { type: 'SETTINGS_CHANGED'; settings: PomodoroSettings };

export interface CompletedPhase {
  finished: Phase;
  next: Phase;
  /** false 表示被跳过，不计入统计 */
  credited: boolean;
  /**
   * 这一段的**真实时长**。
   *
   * 番茄钟下等于 `totalMs`；Flowtime 下是用户实际专注的时间 ——
   * 写日志必须用它，否则一次 40 分钟的 Flowtime 会被记成四小时的安全上限。
   */
  actualMs: number;
}

export interface PomodoroTransition {
  state: PomodoroState;
  /** 非 null 时表示刚结束一个阶段，调用方需要执行副作用（钟声、写日志、通知） */
  completed: CompletedPhase | null;
}

export function durationMs(phase: Phase, settings: PomodoroSettings): number {
  // Flowtime 只改变专注阶段：休息仍然是固定的短休 / 长休
  if (phase === 'focus' && settings.flowtimeMode) return TIMER.flowtimeMaxMs;
  switch (phase) {
    case 'focus':
      return minutesToMs(settings.focusMinutes);
    case 'shortBreak':
      return minutesToMs(settings.shortBreakMinutes);
    case 'longBreak':
      return minutesToMs(settings.longBreakMinutes);
  }
}

export function initialState(settings: PomodoroSettings): PomodoroState {
  const total = durationMs('focus', settings);
  return {
    phase: 'focus',
    status: 'idle',
    remainingMs: total,
    totalMs: total,
    completedFocus: 0,
    endAt: null,
    mode: settings.flowtimeMode ? 'flowtime' : 'pomodoro',
  };
}

/** 状态未变化时返回同一个引用，让 React 跳过重渲染 */
function unchanged(state: PomodoroState): PomodoroTransition {
  return { state, completed: null };
}

function enter(
  state: PomodoroState,
  next: Phase,
  settings: PomodoroSettings,
  autoStartAt: number | null,
): PomodoroState {
  const total = durationMs(next, settings);
  return {
    ...state,
    phase: next,
    status: autoStartAt === null ? 'idle' : 'running',
    remainingMs: total,
    totalMs: total,
    endAt: autoStartAt === null ? null : autoStartAt + total,
  };
}

function complete(
  state: PomodoroState,
  settings: PomodoroSettings,
  credited: boolean,
  at: number,
): PomodoroTransition {
  const finished = state.phase;
  let next: Phase;
  let completedFocus = state.completedFocus;

  if (finished === 'focus') {
    if (credited) {
      completedFocus += 1;
      if (completedFocus >= settings.longBreakInterval) {
        next = 'longBreak';
        completedFocus = 0;
      } else {
        next = 'shortBreak';
      }
    } else {
      // 跳过的专注不计数，也就不会推进长休
      next = 'shortBreak';
    }
  } else {
    next = 'focus';
  }

  const autoStart = settings.autoStartNext && credited;

  // Flowtime 下 remainingMs 是"离安全上限还有多久"，真实时长要用总量减它；
  // 休息阶段不受 Flowtime 影响，照常取 totalMs
  const actualMs =
    state.mode === 'flowtime' && finished === 'focus'
      ? Math.max(0, state.totalMs - state.remainingMs)
      : state.totalMs;

  return {
    state: enter({ ...state, completedFocus }, next, settings, autoStart ? at : null),
    completed: { finished, next, credited, actualMs },
  };
}

export function transition(
  state: PomodoroState,
  event: PomodoroEvent,
  settings: PomodoroSettings,
): PomodoroTransition {
  switch (event.type) {
    case 'START': {
      if (state.status === 'running') return unchanged(state);
      const base =
        state.remainingMs > 0 ? state.remainingMs : durationMs(state.phase, settings);
      return {
        state: {
          ...state,
          status: 'running',
          remainingMs: base,
          endAt: event.at + base,
        },
        completed: null,
      };
    }

    case 'PAUSE': {
      if (state.status !== 'running' || state.endAt === null) {
        return unchanged(state);
      }
      return {
        state: {
          ...state,
          status: 'paused',
          remainingMs: Math.max(0, state.endAt - event.at),
          endAt: null,
        },
        completed: null,
      };
    }

    case 'RESET': {
      const total = durationMs(state.phase, settings);
      return {
        state: {
          ...state,
          status: 'idle',
          remainingMs: total,
          totalMs: total,
          endAt: null,
        },
        completed: null,
      };
    }

    case 'SKIP':
      return complete(state, settings, false, event.at);

    /**
     * 主动结束专注，**计入成绩**。
     *
     * 与 SKIP 的唯一区别就是这一点：Flowtime 的时长本来就由用户说了算，
     * 按下停止键意味着"这段时间我真的做进去了"，不该像跳过那样被丢掉。
     * 待机状态下按没有意义，直接忽略。
     */
    case 'FINISH': {
      if (state.phase !== 'focus' || state.status === 'idle') {
        return unchanged(state);
      }
      /*
       * 先用当前时刻重算一次剩余再结算。
       * 后台标签页的 TICK 会被浏览器节流，`state.remainingMs` 可能停在几十秒前 ——
       * 直接用它算实际时长，会把"切去别处工作了一小时"记成几分钟。
       * （番茄钟没这个问题：那边只看 remainingMs 是否为 0，本来就要等 TICK。）
       */
      const live =
        state.status === 'running' && state.endAt !== null
          ? { ...state, remainingMs: Math.max(0, state.endAt - event.at) }
          : state;
      return complete(live, settings, true, event.at);
    }

    case 'TICK': {
      if (state.status !== 'running' || state.endAt === null) {
        return unchanged(state);
      }
      const left = state.endAt - event.at;
      // 归零后再结算：Flowtime 要按 totalMs - remainingMs 算真实时长，
      // 带着"还剩一大截"的旧值进去会把它算成 0 分钟
      if (left <= 0) {
        return complete({ ...state, remainingMs: 0 }, settings, true, event.at);
      }
      // 只有"显示的秒数"变化时才产生新状态对象：
      // 200ms 轮询 → 每秒最多一次重渲染（见 开发踩坑点.md 性能章节）
      if (Math.ceil(left / 1000) === Math.ceil(state.remainingMs / 1000)) {
        return unchanged(state);
      }
      return { state: { ...state, remainingMs: left }, completed: null };
    }

    case 'SELECT': {
      if (state.phase === event.phase && state.status === 'idle') {
        return unchanged(state);
      }
      return { state: enter(state, event.phase, settings, null), completed: null };
    }

    /**
     * 延长当前阶段（"再来 5 分钟"）。
     * totalMs 与 remainingMs 同步加长，这样进度环的比例不会因为延长而跳变；
     * 只允许在 running / paused 下延长 —— idle 状态该直接去改时长设置。
     */
    case 'EXTEND': {
      if (state.status === 'idle') return unchanged(state);
      const delta = Math.max(0, Math.round(event.minutes)) * 60_000;
      if (delta === 0) return unchanged(state);
      return {
        state: {
          ...state,
          remainingMs: state.remainingMs + delta,
          totalMs: state.totalMs + delta,
          endAt: state.endAt === null ? null : state.endAt + delta,
        },
        completed: null,
      };
    }

    case 'SETTINGS_CHANGED': {
      // 运行中不打断当前阶段，只记录新设置
      if (state.status !== 'idle') return unchanged(state);
      const mode: TimerMode = event.settings.flowtimeMode ? 'flowtime' : 'pomodoro';
      const total = durationMs(state.phase, event.settings);
      if (
        total === state.totalMs &&
        total === state.remainingMs &&
        mode === state.mode
      ) {
        return unchanged(state);
      }
      return {
        state: { ...state, totalMs: total, remainingMs: total, mode },
        completed: null,
      };
    }
  }
}
