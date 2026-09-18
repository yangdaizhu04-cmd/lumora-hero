// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../lib/storage';
import { useTasks } from './useTasks';
import type { Task } from '../types';

/** 固定"现在"为 2026-09-18 09:00 本地时间，避免测试随真实时间漂移 */
const NOW = new Date(2026, 8, 18, 9, 0, 0);

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    title: partial.id,
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    done: false,
    createdAt: 1,
    ...partial,
  };
}

function seed(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

describe('useTasks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('跨天归档：未完成记为顺延、已完成移出工作列表', () => {
    seed(STORAGE_KEYS.tasks, [
      makeTask({ id: 'open' }),
      makeTask({ id: 'finished', done: true, completedPomodoros: 2 }),
    ]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-17');

    const { result, unmount } = renderHook(() => useTasks());

    expect(result.current.tasks.map((task) => task.id)).toEqual(['open']);

    const yesterday = result.current.archive.find((day) => day.date === '2026-09-17');
    expect(yesterday?.tasks).toHaveLength(1);
    expect(yesterday?.tasks[0]).toMatchObject({ id: 'open', status: 'unfinished' });

    // 今天没有跨天发生，不应重复归档
    expect(
      result.current.archive.filter((day) => day.date === '2026-09-18'),
    ).toHaveLength(0);
    unmount();
  });

  it('同一天不触发归档', () => {
    seed(STORAGE_KEYS.tasks, [makeTask({ id: 'open' })]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');

    const { result, unmount } = renderHook(() => useTasks());

    expect(result.current.archive).toHaveLength(0);
    expect(result.current.tasks).toHaveLength(1);
    unmount();
  });

  it('删除后可撤销：任务与当天归档一起恢复', () => {
    seed(STORAGE_KEYS.tasks, [makeTask({ id: 'a', done: true })]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    seed(STORAGE_KEYS.archive, [
      {
        date: '2026-09-18',
        tasks: [
          {
            id: 'a',
            title: 'a',
            estimatedPomodoros: 1,
            completedPomodoros: 0,
            status: 'done',
          },
        ],
        updatedAt: 1,
      },
    ]);

    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.removeTask('a'));
    expect(result.current.tasks).toHaveLength(0);
    expect(
      result.current.archive.find((day) => day.date === '2026-09-18')?.tasks,
    ).toHaveLength(0);

    act(() => result.current.undoRemove());
    expect(result.current.tasks.map((task) => task.id)).toEqual(['a']);
    expect(
      result.current.archive.find((day) => day.date === '2026-09-18')?.tasks,
    ).toHaveLength(1);

    // 撤销只能用一次：再次撤销不应重复插入
    act(() => result.current.undoRemove());
    expect(result.current.tasks).toHaveLength(1);
    unmount();
  });

  it('勾选完成即写入当天归档，清除已完成不会丢记录', () => {
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');

    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.addTask('写方案'));
    const id = result.current.tasks[0].id;

    act(() => result.current.toggleDone(id));
    act(() => result.current.clearCompleted());

    expect(result.current.tasks).toHaveLength(0);
    expect(
      result.current.archive.find((day) => day.date === '2026-09-18')?.tasks[0],
    ).toMatchObject({ id, status: 'done' });
    unmount();
  });
});
