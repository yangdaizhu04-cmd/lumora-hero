// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../config';
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

  it('编辑任务：只改传进来的字段，越界值夹到合法范围', () => {
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.addTask('写方案', 2));
    const id = result.current.tasks[0].id;
    const current = () => result.current.tasks[0];

    act(() => result.current.updateTask(id, { title: '  写方案 v2  ' }));
    expect(current().title).toBe('写方案 v2');
    // 局部更新不能把没传的字段顺手清掉
    expect(current().estimatedPomodoros).toBe(2);

    act(() => result.current.updateTask(id, { estimatedPomodoros: 99 }));
    expect(current().estimatedPomodoros).toBe(LIMITS.taskEstimate);
    expect(current().title).toBe('写方案 v2');

    act(() => result.current.updateTask(id, { estimatedPomodoros: 0 }));
    expect(current().estimatedPomodoros).toBe(1);

    // 空标题不作为"清空"处理，否则列表里会出现点不到的行
    act(() => result.current.updateTask(id, { title: '   ' }));
    expect(current().title).toBe('写方案 v2');

    unmount();
  });

  it('编辑已完成的任务会同步更新当天归档里的快照', () => {
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.addTask('旧标题'));
    const id = result.current.tasks[0].id;
    act(() => result.current.toggleDone(id));
    act(() => result.current.updateTask(id, { title: '新标题' }));

    expect(result.current.tasks[0].title).toBe('新标题');
    expect(
      result.current.archive.find((day) => day.date === '2026-09-18')?.tasks[0]?.title,
    ).toBe('新标题');

    unmount();
  });

  // 锁住不变量：归档快照只能改它**实际所在的那一天**。
  // 若按"今天"写，跨天瞬间（23:59 完成、00:00 编辑）会把同一个任务复制到两天里各出现一次。
  it('编辑已完成的任务时，只改它实际归档的那一天，不凭空造新记录', () => {
    seed(STORAGE_KEYS.tasks, [makeTask({ id: 'a', done: true })]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    seed(STORAGE_KEYS.archive, [
      {
        date: '2026-09-17',
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

    act(() => result.current.updateTask('a', { title: '改了' }));

    expect(
      result.current.archive.find((day) => day.date === '2026-09-17')?.tasks[0]?.title,
    ).toBe('改了');
    expect(
      result.current.archive.find((day) => day.date === '2026-09-18'),
    ).toBeUndefined();

    unmount();
  });

  it('排序：未完成组内移动，已完成组顺序不受影响', () => {
    seed(STORAGE_KEYS.tasks, [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b' }),
      makeTask({ id: 'c' }),
      makeTask({ id: 'x', done: true }),
      makeTask({ id: 'y', done: true }),
    ]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');

    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.moveTask('c', 0));
    expect(result.current.tasks.map((task) => task.id)).toEqual([
      'c',
      'a',
      'b',
      'x',
      'y',
    ]);

    unmount();
  });

  it('排序：组内越界夹到边界，已完成任务不会窜进未完成组', () => {
    seed(STORAGE_KEYS.tasks, [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b' }),
      makeTask({ id: 'x', done: true }),
      makeTask({ id: 'y', done: true }),
    ]);
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');

    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.moveTask('a', 99));
    expect(result.current.tasks.map((task) => task.id)).toEqual(['b', 'a', 'x', 'y']);

    // x 移到已完成组最前：只影响已完成组，未完成组（b, a）原样
    act(() => result.current.moveTask('x', 0));
    expect(result.current.tasks.map((task) => task.id)).toEqual(['b', 'a', 'x', 'y']);

    unmount();
  });

  // 脏输入不能变成"看起来正常"的坏数据：
  // clamp 会把 NaN 原样透出去，落到任务上就是 `0/NaN 番茄`，
  // 落到 splice 上就是"悄悄挪到最前" —— 两种都比直接不动更糟。
  it('脏输入：预估数不写坏数据，排序坐标无效时列表不动', () => {
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    const { result, unmount } = renderHook(() => useTasks());

    // 新建时脏输入退回默认值（新建总得有一个数）
    act(() => result.current.addTask('甲', Number.NaN));
    expect(result.current.tasks[0].estimatedPomodoros).toBe(1);

    act(() => result.current.addTask('乙', 2));
    const id = result.current.tasks[1].id;

    // 编辑时脏输入按"没传这个字段"处理，原值保留
    act(() => result.current.updateTask(id, { estimatedPomodoros: Number.NaN }));
    expect(result.current.tasks[1].estimatedPomodoros).toBe(2);

    // 同一个 patch 里另一字段合法时，它照常生效
    act(() =>
      result.current.updateTask(id, {
        title: '乙改',
        estimatedPomodoros: Number.POSITIVE_INFINITY,
      }),
    );
    expect(result.current.tasks[1].title).toBe('乙改');
    expect(result.current.tasks[1].estimatedPomodoros).toBe(2);

    // 坐标无效：宁可不动，也不要把它当成 0 移到最前
    act(() => result.current.moveTask(id, Number.NaN));
    expect(result.current.tasks[1].id).toBe(id);

    // 合法坐标照常生效 —— 确认上一条断言不是因为"排序彻底坏了"才通过的
    act(() => result.current.moveTask(id, 0));
    expect(result.current.tasks[0].id).toBe(id);

    unmount();
  });

  it('新建任务：预估数上限与 LIMITS 一致，且取整', () => {
    seed(STORAGE_KEYS.lastActiveDay, '2026-09-18');
    const { result, unmount } = renderHook(() => useTasks());

    act(() => result.current.addTask('甲', 999));
    expect(result.current.tasks[0].estimatedPomodoros).toBe(LIMITS.taskEstimate);

    act(() => result.current.addTask('乙', 2.6));
    expect(result.current.tasks[1].estimatedPomodoros).toBe(3);

    unmount();
  });
});
