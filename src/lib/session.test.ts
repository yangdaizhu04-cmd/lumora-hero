import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { initialState } from './pomodoroMachine';
import { rehydrateSession, serializeSession, type PersistedSession } from './session';
import type { PomodoroSettings } from '../types';

const S: PomodoroSettings = DEFAULT_SETTINGS;
const MIN = 60_000;
const T0 = 1_700_000_000_000;

const running = (): PersistedSession =>
  serializeSession(
    {
      phase: 'focus',
      status: 'running',
      remainingMs: 25 * MIN,
      totalMs: 25 * MIN,
      completedFocus: 0,
      endAt: T0 + 25 * MIN,
      mode: 'pomodoro',
    },
    T0,
  );

describe('序列化', () => {
  it('保留阶段、状态、结束时间戳与完成计数', () => {
    const saved = serializeSession(initialState(S), T0);
    expect(saved).toEqual({
      phase: 'focus',
      status: 'idle',
      remainingMs: 25 * MIN,
      totalMs: 25 * MIN,
      completedFocus: 0,
      endAt: null,
      savedAt: T0,
      interruptions: 0,
      breakReasons: [],
    });
  });

  it('打断打点随会话一起保存', () => {
    const saved = serializeSession(initialState(S), T0, 0, ['external', 'drift']);
    expect(saved.breakReasons).toEqual(['external', 'drift']);
  });

  // 打断打点是后加的字段：老存档里没有它，读回来必须是空数组而不是 undefined
  it('老存档没有 breakReasons 时读回空数组', () => {
    const result = rehydrateSession(
      {
        phase: 'focus',
        status: 'idle',
        remainingMs: MIN,
        totalMs: 25 * MIN,
        completedFocus: 0,
        endAt: null,
        savedAt: T0,
      },
      T0,
      S,
    );
    expect(result.breakReasons).toEqual([]);
  });

  // 模式不进存档：它由设置决定，用户改了设置，恢复时就应该跟着变
  it('恢复出来的模式跟随当前设置，而不是存档时的模式', () => {
    const saved = serializeSession(
      {
        phase: 'focus',
        status: 'idle',
        remainingMs: MIN,
        totalMs: 25 * MIN,
        completedFocus: 0,
        endAt: null,
        mode: 'pomodoro',
      },
      T0,
    );
    const result = rehydrateSession(saved, T0, { ...S, flowtimeMode: true });
    expect(result.state.mode).toBe('flowtime');
  });
});

describe('分心次数随会话保存', () => {
  it('写入并读回', () => {
    const saved = serializeSession(
      {
        phase: 'focus',
        status: 'running',
        remainingMs: 25 * MIN,
        totalMs: 25 * MIN,
        completedFocus: 0,
        endAt: T0 + 25 * MIN,
        mode: 'pomodoro',
      },
      T0,
      3,
    );
    expect(saved.interruptions).toBe(3);
    expect(rehydrateSession(saved, T0 + MIN, S).interruptions).toBe(3);
  });

  it('旧存档没有该字段时按 0 处理', () => {
    const legacy = { ...running() };
    delete (legacy as Partial<PersistedSession>).interruptions;
    expect(rehydrateSession(legacy, T0 + MIN, S).interruptions).toBe(0);
  });

  it('会话过期被放弃时，分心次数一并清零', () => {
    const result = rehydrateSession(
      { ...running(), interruptions: 5 },
      T0 + 25 * MIN + 7 * 60 * MIN,
      S,
    );
    expect(result.interruptions).toBe(0);
  });
});

describe('恢复', () => {
  it('没有存档时回到初始状态', () => {
    const result = rehydrateSession(null, T0, S);
    expect(result.state).toEqual(initialState(S));
    expect(result.completedWhileAway).toBeNull();
  });

  it('存档损坏时回到初始状态', () => {
    const result = rehydrateSession({ phase: 'nonsense', status: 'running' }, T0, S);
    expect(result.state).toEqual(initialState(S));
  });

  it('刷新瞬间恢复运行中会话，剩余时间按时间戳重算', () => {
    const result = rehydrateSession(running(), T0 + 3 * MIN, S);
    expect(result.state.status).toBe('running');
    expect(result.state.phase).toBe('focus');
    expect(result.state.remainingMs).toBe(22 * MIN);
    expect(result.state.endAt).toBe(T0 + 25 * MIN);
    expect(result.completedWhileAway).toBeNull();
  });

  it('离开期间刚好结束的专注会被补记', () => {
    const result = rehydrateSession(running(), T0 + 26 * MIN, S);
    expect(result.completedWhileAway).toEqual({ phase: 'focus', minutes: 25 });
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.status).toBe('idle');
    expect(result.state.completedFocus).toBe(1);
  });

  it('即使开了自动开始，也不会把离开的时间白送给下一段', () => {
    const settings: PomodoroSettings = { ...S, autoStartNext: true };
    const result = rehydrateSession(running(), T0 + 26 * MIN, settings);
    expect(result.state.status).toBe('idle');
    expect(result.state.endAt).toBeNull();
  });

  it('太久以前的会话视为放弃（不补记成绩）', () => {
    const result = rehydrateSession(running(), T0 + 25 * MIN + 7 * 60 * MIN, S);
    expect(result.completedWhileAway).toBeNull();
    expect(result.state).toEqual(initialState(S));
  });

  it('休息阶段结束在离开期间：直接回到专注，不产生补记', () => {
    const saved: PersistedSession = {
      phase: 'shortBreak',
      status: 'running',
      remainingMs: 5 * MIN,
      totalMs: 5 * MIN,
      completedFocus: 2,
      endAt: T0 + 5 * MIN,
      savedAt: T0,
    };
    const result = rehydrateSession(saved, T0 + 6 * MIN, S);
    expect(result.completedWhileAway).toBeNull();
    expect(result.state).toMatchObject({
      phase: 'focus',
      status: 'idle',
      completedFocus: 2,
    });
  });

  it('暂停中的会话原样恢复，剩余时间不变', () => {
    const saved: PersistedSession = {
      phase: 'focus',
      status: 'paused',
      remainingMs: 7 * MIN,
      totalMs: 25 * MIN,
      completedFocus: 1,
      endAt: null,
      savedAt: T0,
    };
    const result = rehydrateSession(saved, T0 + 90 * MIN, S);
    expect(result.state).toMatchObject({
      phase: 'focus',
      status: 'paused',
      remainingMs: 7 * MIN,
      completedFocus: 1,
      endAt: null,
    });
  });

  it('空闲状态恢复时不受离开时长影响', () => {
    const saved: PersistedSession = {
      phase: 'longBreak',
      status: 'idle',
      remainingMs: 15 * MIN,
      totalMs: 15 * MIN,
      completedFocus: 0,
      endAt: null,
      savedAt: T0,
    };
    const result = rehydrateSession(saved, T0 + 100 * 60 * MIN, S);
    expect(result.state).toMatchObject({ phase: 'longBreak', status: 'idle' });
  });
});
