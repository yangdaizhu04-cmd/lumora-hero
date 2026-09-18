import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import {
  durationMs,
  initialState,
  transition,
  type PomodoroEvent,
  type PomodoroState,
} from './pomodoroMachine';
import type { PomodoroSettings } from '../types';

const S: PomodoroSettings = DEFAULT_SETTINGS;
const MIN = 60_000;
/** 固定时间戳，避免测试依赖真实时间 */
const T0 = 1_700_000_000_000;

const apply = (
  state: PomodoroState,
  event: PomodoroEvent,
  settings: PomodoroSettings = S,
) => transition(state, event, settings);

/** 造一个"正在运行、还剩 remainingMs"的状态 */
function running(remainingMs: number, from: PomodoroState = initialState(S)): PomodoroState {
  return apply({ ...from, remainingMs }, { type: 'START', at: T0 }).state;
}

describe('durationMs', () => {
  it('按阶段取对应时长', () => {
    expect(durationMs('focus', S)).toBe(25 * MIN);
    expect(durationMs('shortBreak', S)).toBe(5 * MIN);
    expect(durationMs('longBreak', S)).toBe(15 * MIN);
  });
});

describe('初始状态', () => {
  it('从专注、空闲、满时长开始', () => {
    const state = initialState(S);
    expect(state).toMatchObject({
      phase: 'focus',
      status: 'idle',
      remainingMs: 25 * MIN,
      totalMs: 25 * MIN,
      completedFocus: 0,
      endAt: null,
    });
  });
});

describe('START / PAUSE', () => {
  it('开始后写入 endAt', () => {
    const { state, completed } = apply(initialState(S), { type: 'START', at: T0 });
    expect(state.status).toBe('running');
    expect(state.endAt).toBe(T0 + 25 * MIN);
    expect(completed).toBeNull();
  });

  it('重复 START 不改变状态引用', () => {
    const runningState = running(10 * MIN);
    expect(apply(runningState, { type: 'START', at: T0 + 1000 }).state).toBe(runningState);
  });

  it('暂停时按时间戳结算剩余时间', () => {
    const state = running(10 * MIN);
    const { state: paused } = apply(state, { type: 'PAUSE', at: T0 + 90_000 });
    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(10 * MIN - 90_000);
    expect(paused.endAt).toBeNull();
  });

  it('空闲时 PAUSE 是空操作', () => {
    const idle = initialState(S);
    expect(apply(idle, { type: 'PAUSE', at: T0 }).state).toBe(idle);
  });

  it('暂停后可以继续，剩余时间不丢', () => {
    const paused = apply(running(10 * MIN), { type: 'PAUSE', at: T0 + 90_000 }).state;
    const resumed = apply(paused, { type: 'START', at: T0 + 600_000 }).state;
    expect(resumed.status).toBe('running');
    expect(resumed.remainingMs).toBe(10 * MIN - 90_000);
    expect(resumed.endAt).toBe(T0 + 600_000 + 10 * MIN - 90_000);
  });
});

describe('TICK', () => {
  it('同一个显示秒内的多次 TICK 不产生新状态（减少重渲染）', () => {
    const state = running(10 * MIN);
    const after200ms = apply(state, { type: 'TICK', at: T0 + 200 }).state;
    expect(after200ms).toBe(state);
    expect(apply(state, { type: 'TICK', at: T0 + 999 }).state).toBe(state);
  });

  it('跨过显示秒边界时更新剩余时间', () => {
    const state = running(10 * MIN);
    const ticked = apply(state, { type: 'TICK', at: T0 + 1000 }).state;
    expect(ticked).not.toBe(state);
    expect(ticked.remainingMs).toBe(10 * MIN - 1000);
  });

  it('空闲或暂停时 TICK 无效', () => {
    const idle = initialState(S);
    expect(apply(idle, { type: 'TICK', at: T0 + 1000 }).state).toBe(idle);
    const paused = apply(running(5 * MIN), { type: 'PAUSE', at: T0 }).state;
    expect(apply(paused, { type: 'TICK', at: T0 + 1000 }).state).toBe(paused);
  });

  it('时间到完成阶段：计入一次番茄并进入短休', () => {
    const state = running(1000);
    const { state: next, completed } = apply(state, { type: 'TICK', at: T0 + 1000 });
    expect(completed).toEqual({ finished: 'focus', next: 'shortBreak', credited: true });
    expect(next).toMatchObject({
      phase: 'shortBreak',
      status: 'idle',
      remainingMs: 5 * MIN,
      completedFocus: 1,
      endAt: null,
    });
  });

  it('模拟标签页被冻结十分钟：回来时直接完成阶段而不是慢慢倒数', () => {
    const state = running(25 * MIN);
    const { state: next, completed } = apply(state, {
      type: 'TICK',
      at: T0 + 25 * MIN + 10 * MIN,
    });
    expect(completed?.credited).toBe(true);
    expect(next.phase).toBe('shortBreak');
  });

  it('自动开始开启时，下一阶段直接进入运行', () => {
    const settings = { ...S, autoStartNext: true };
    const state = apply(initialState(settings), { type: 'START', at: T0 }, settings).state;
    const { state: next } = apply(
      state,
      { type: 'TICK', at: state.endAt! },
      settings,
    );
    expect(next.status).toBe('running');
    expect(next.endAt).toBe(state.endAt! + 5 * MIN);
  });
});

describe('长休循环', () => {
  it('完成 4 个番茄后进入长休并重置计数', () => {
    let state = initialState(S);
    for (let round = 1; round <= 4; round += 1) {
      state = apply(state, { type: 'START', at: T0 }).state;
      state = apply(state, { type: 'TICK', at: state.endAt! }).state;

      if (round < 4) {
        expect(state.phase).toBe('shortBreak');
        expect(state.completedFocus).toBe(round);
        state = apply(state, { type: 'SKIP', at: T0 }).state;
        expect(state.phase).toBe('focus');
      } else {
        expect(state.phase).toBe('longBreak');
        expect(state.completedFocus).toBe(0);
      }
    }
  });

  it('长休间隔可按设置调整', () => {
    const settings = { ...S, longBreakInterval: 2 };
    let state = initialState(settings);
    for (let round = 1; round <= 2; round += 1) {
      state = apply(state, { type: 'START', at: T0 }, settings).state;
      state = apply(state, { type: 'TICK', at: state.endAt! }, settings).state;
      if (round === 1) state = apply(state, { type: 'SKIP', at: T0 }, settings).state;
    }
    expect(state.phase).toBe('longBreak');
  });

  it('休息结束后回到专注', () => {
    const breakState: PomodoroState = {
      ...initialState(S),
      phase: 'shortBreak',
      remainingMs: 5 * MIN,
      totalMs: 5 * MIN,
    };
    const started = apply(breakState, { type: 'START', at: T0 }).state;
    const { state: next, completed } = apply(started, { type: 'TICK', at: started.endAt! });
    expect(completed).toEqual({ finished: 'shortBreak', next: 'focus', credited: true });
    expect(next).toMatchObject({ phase: 'focus', status: 'idle', remainingMs: 25 * MIN });
  });
});

describe('SKIP', () => {
  it('跳过专注：不计番茄、不推进长休、即使开了自动开始也不自动开始', () => {
    const settings = { ...S, autoStartNext: true };
    const state = apply(initialState(settings), { type: 'START', at: T0 }, settings).state;
    const { state: next, completed } = apply(state, { type: 'SKIP', at: T0 + 1000 }, settings);

    expect(completed).toEqual({ finished: 'focus', next: 'shortBreak', credited: false });
    expect(next.completedFocus).toBe(0);
    expect(next.phase).toBe('shortBreak');
    expect(next.status).toBe('idle');
    expect(next.endAt).toBeNull();
  });

  it('连续跳过专注不会误入长休', () => {
    let state = initialState(S);
    for (let i = 0; i < 6; i += 1) {
      state = apply(state, { type: 'SKIP', at: T0 }).state;
      if (state.phase === 'shortBreak') state = apply(state, { type: 'SKIP', at: T0 }).state;
    }
    expect(state.completedFocus).toBe(0);
    expect(state.phase).toBe('focus');
  });
});

describe('RESET / SELECT / SETTINGS_CHANGED', () => {
  it('RESET 回到当前阶段的满时长', () => {
    const state = running(3 * MIN);
    const reset = apply(state, { type: 'RESET' }).state;
    expect(reset).toMatchObject({ status: 'idle', remainingMs: 25 * MIN, endAt: null });
  });

  it('SELECT 切换阶段并保持空闲', () => {
    const state = running(3 * MIN);
    const selected = apply(state, { type: 'SELECT', phase: 'longBreak' }).state;
    expect(selected).toMatchObject({
      phase: 'longBreak',
      status: 'idle',
      remainingMs: 15 * MIN,
      totalMs: 15 * MIN,
      endAt: null,
    });
  });

  it('重复 SELECT 当前阶段是空操作', () => {
    const idle = initialState(S);
    expect(apply(idle, { type: 'SELECT', phase: 'focus' }).state).toBe(idle);
  });

  it('空闲时改时长会立刻刷新显示', () => {
    const idle = initialState(S);
    const changed = apply(idle, {
      type: 'SETTINGS_CHANGED',
      settings: { ...S, focusMinutes: 45 },
    }).state;
    expect(changed.remainingMs).toBe(45 * MIN);
    expect(changed.totalMs).toBe(45 * MIN);
  });

  it('运行中改时长不打断当前阶段', () => {
    const state = running(10 * MIN);
    const changed = apply(state, {
      type: 'SETTINGS_CHANGED',
      settings: { ...S, focusMinutes: 45 },
    }).state;
    expect(changed).toBe(state);
  });
});
