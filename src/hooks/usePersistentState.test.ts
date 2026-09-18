// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStorage, usePersistentState } from '../lib/storage';

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('对象类型与默认值浅合并：旧数据缺字段时不报错', () => {
    window.localStorage.setItem('test.settings', JSON.stringify({ volume: 0.3 }));

    const { result, unmount } = renderHook(() =>
      usePersistentState('test.settings', { volume: 1, muted: false }),
    );

    expect(result.current[0]).toEqual({ volume: 0.3, muted: false });
    unmount();
  });

  it('连续变更只落盘一次（去抖），避免滑块每一帧都写 localStorage', () => {
    const { result, unmount } = renderHook(() => usePersistentState('test.count', 0));
    const setValue = result.current[1];

    act(() => setValue(1));
    act(() => setValue(2));
    expect(readStorage('test.count')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(readStorage('test.count')).toBe(2);
    unmount();
  });

  it('另一个标签页改动同一 key 时跟随更新', () => {
    const { result, unmount } = renderHook(() => usePersistentState('test.sync', 0));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'test.sync', newValue: '7' }),
      );
    });

    expect(result.current[0]).toBe(7);
    unmount();
  });

  it('数据损坏时回落到默认值，而不是把坏数据当状态用', () => {
    window.localStorage.setItem('test.broken', '{ not json');

    const { result, unmount } = renderHook(() => usePersistentState('test.broken', 42));
    expect(result.current[0]).toBe(42);
    unmount();
  });
});
