import { describe, expect, it } from 'vitest';
import { aggregateTagFocus } from './tagFocus';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

const NOW = new Date(2026, 8, 19, 10, 0, 0);

function log(date: string, taskId: string | null, minutes = 25): FocusLogEntry {
  return {
    id: `log-${date}-${taskId ?? 'none'}-${minutes}`,
    finishedAt: 0,
    date,
    minutes,
    taskId,
    scene: 'golden-hour',
  };
}

function task(id: string, title: string, tags: string[]): Task {
  return {
    id,
    title,
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    done: false,
    createdAt: 0,
    tags,
  };
}

function snapshot(
  date: string,
  tasks: { id: string; title: string; tags?: string[] }[],
): ReviewEntry {
  return {
    date,
    isToday: false,
    focusCount: 0,
    focusMinutes: 0,
    interruptions: 0,
    tasks: tasks.map((item) => ({
      ...item,
      estimatedPomodoros: 1,
      completedPomodoros: 0,
      status: 'done' as const,
    })),
    doneCount: tasks.length,
  };
}

describe('按标签汇总投入', () => {
  it('按标签累计时长与番茄数，并记下涉及的任务数', () => {
    const summary = aggregateTagFocus(
      [
        log('2026-09-18', 'a', 25),
        log('2026-09-18', 'b', 50),
        log('2026-09-17', 'b', 25),
      ],
      [],
      [task('a', '写方案', ['工作']), task('b', '读论文', ['工作', '学习'])],
      { days: 30, now: NOW },
    );

    const byTag = new Map(summary.entries.map((item) => [item.tag, item]));
    expect(byTag.get('工作')?.minutes).toBe(100);
    expect(byTag.get('工作')?.count).toBe(3);
    expect(byTag.get('工作')?.tasks).toBe(2);
    expect(byTag.get('学习')?.minutes).toBe(75);
    expect(byTag.get('学习')?.tasks).toBe(1);
  });

  // 想知道"工作"和"紧急"各占多少时间，就不能把时长劈成两半
  it('多标签任务的时长会被每个标签各计一次', () => {
    const summary = aggregateTagFocus(
      [log('2026-09-18', 'a', 60)],
      [],
      [task('a', '写方案', ['工作', '紧急'])],
      { days: 30, now: NOW },
    );

    const sum = summary.entries.reduce((acc, item) => acc + item.minutes, 0);
    expect(sum).toBe(120); // 大于 totalMinutes 的 60 —— 这是刻意的
    expect(summary.totalMinutes).toBe(60);
  });

  it('没打标签的任务与没挂任务的时间都算作未归类', () => {
    const summary = aggregateTagFocus(
      [
        log('2026-09-18', 'a', 25), // 有标签
        log('2026-09-18', 'b', 25), // 任务没打标签
        log('2026-09-18', null, 25), // 没挂任务
        log('2026-09-18', 'gone', 50), // 任务已删除
      ],
      [],
      [task('a', '写方案', ['工作']), task('b', '杂事', [])],
      { days: 30, now: NOW },
    );

    expect(summary.entries).toHaveLength(1);
    expect(summary.untaggedMinutes).toBe(50); // 未打标签 + 未挂任务
    expect(summary.detachedMinutes).toBe(50);
  });

  it('标签以工作列表为准（归档里是旧标签时显示新的）', () => {
    const summary = aggregateTagFocus(
      [log('2026-09-10', 'a', 25)],
      [snapshot('2026-09-10', [{ id: 'a', title: '写方案', tags: ['旧标签'] }])],
      [task('a', '写方案', ['新标签'])],
      { days: 30, now: NOW },
    );

    expect(summary.entries[0].tag).toBe('新标签');
  });

  it('窗口外的记录不计入', () => {
    const summary = aggregateTagFocus(
      [log('2026-09-18', 'a', 25), log('2026-06-01', 'a', 100)],
      [],
      [task('a', '写方案', ['工作'])],
      { days: 7, now: NOW },
    );

    expect(summary.totalCount).toBe(1);
    expect(summary.entries[0].minutes).toBe(25);
  });

  it('超出 limit 的合并进 hidden，时长不丢', () => {
    const summary = aggregateTagFocus(
      [
        log('2026-09-18', 'a', 30),
        log('2026-09-18', 'b', 20),
        log('2026-09-18', 'c', 10),
      ],
      [],
      [task('a', 'A', ['甲']), task('b', 'B', ['乙']), task('c', 'C', ['丙'])],
      { days: 30, limit: 1, now: NOW },
    );

    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0].tag).toBe('甲');
    expect(summary.hiddenCount).toBe(2);
    expect(summary.hiddenMinutes).toBe(30);
  });

  it('没有任何标签时返回空列表而不是崩掉', () => {
    const summary = aggregateTagFocus([], [], [], { days: 30, now: NOW });
    expect(summary.entries).toEqual([]);
    expect(summary.totalMinutes).toBe(0);
  });
});
