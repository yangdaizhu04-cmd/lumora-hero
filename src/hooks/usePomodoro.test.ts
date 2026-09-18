// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import { STORAGE_KEYS } from '../lib/storage';
import { usePomodoro } from './usePomodoro';

const MIN = 60_000;
/** 固定"现在"，让会话恢复的断言可算 */
const NOW = new Date(2026, 8, 18, 10, 0, 0).getTime();

const noop = () => undefined;

describe('usePomodoro', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('恢复运行中的会话：按 endAt 算真实剩余，离开的时间不会白送', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({
        phase: 'focus',
        status: 'running',
        remainingMs: 25 * MIN,
        totalMs: 25 * MIN,
        completedFocus: 2,
        endAt: NOW + 8 * MIN,
        savedAt: NOW - MIN,
        interruptions: 3,
      }),
    );

    const { result, unmount } = renderHook(() => usePomodoro(DEFAULT_SETTINGS, noop));

    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(8 * MIN);
    expect(result.current.completedFocus).toBe(2);
    // 分心次数随会话恢复，刷新不会归零
    expect(result.current.restoredAttention).toBe(3);
    unmount();
  });

  it('离开期间刚好结束的专注会被补记一次', () => {
    const onSessionRestored = vi.fn();
    window.localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({
        phase: 'focus',
        status: 'running',
        remainingMs: 0,
        totalMs: 25 * MIN,
        completedFocus: 0,
        endAt: NOW - 2 * MIN,
        savedAt: NOW - 3 * MIN,
        interruptions: 0,
      }),
    );

    const { result, unmount } = renderHook(() =>
      usePomodoro(DEFAULT_SETTINGS, noop, { onSessionRestored }),
    );

    expect(onSessionRestored).toHaveBeenCalledTimes(1);
    expect(onSessionRestored.mock.calls[0][0]).toMatchObject({
      phase: 'focus',
      minutes: 25,
    });
    // 恢复的是"下一段"，不会白送已经流逝的时间
    expect(result.current.status).toBe('idle');
    unmount();
  });

  it('延长 5 分钟：剩余与总时长同步加长，进度比例不跳', () => {
    const { result, unmount } = renderHook(() => usePomodoro(DEFAULT_SETTINGS, noop));

    act(() => {
      result.current.start();
    });
    expect(result.current.totalMs).toBe(25 * MIN);
    expect(result.current.progress).toBe(0);

    act(() => {
      result.current.extend(5);
    });

    expect(result.current.totalMs).toBe(30 * MIN);
    expect(result.current.remainingMs).toBe(30 * MIN);
    // 关键：延长不会让进度环凭空跳一段
    expect(result.current.progress).toBe(0);
    unmount();
  });
});
