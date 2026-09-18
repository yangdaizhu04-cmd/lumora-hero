import { describe, expect, it } from 'vitest';
import { buildReview, formatDayLabel, sumReview } from './review';
import type { ArchivedTask, DayArchive, FocusLogEntry, Task } from '../types';

const NOW = new Date(2026, 8, 18, 12, 0, 0); // 2026-09-18 周五

function archived(
  id: string,
  title: string,
  status: ArchivedTask['status'],
  completed = 0,
  estimated = 1,
): ArchivedTask {
  return {
    id,
    title,
    status,
    completedPomodoros: completed,
    estimatedPomodoros: estimated,
  };
}

function day(date: string, tasks: ArchivedTask[]): DayArchive {
  return { date, tasks, updatedAt: 0 };
}

function logEntry(date: string, minutes = 25): FocusLogEntry {
  return { id: date, finishedAt: 0, date, minutes, taskId: null, scene: 'deep-woods' };
}

function openTask(id: string, title: string): Task {
  return {
    id,
    title,
    estimatedPomodoros: 2,
    completedPomodoros: 1,
    done: false,
    createdAt: 0,
  };
}

describe('formatDayLabel', () => {
  it('今天 / 昨天 使用相对说法', () => {
    expect(formatDayLabel('2026-09-18', NOW)).toBe('今天');
    expect(formatDayLabel('2026-09-17', NOW)).toBe('昨天');
  });

  it('更早的日期显示月日与星期', () => {
    expect(formatDayLabel('2026-09-15', NOW)).toBe('9 月 15 日 周二');
    expect(formatDayLabel('2026-09-14', NOW)).toBe('9 月 14 日 周一');
  });

  it('跨年时补上年份', () => {
    expect(formatDayLabel('2025-12-31', NOW)).toBe('2025 年 12 月 31 日 周三');
  });
});

describe('buildReview', () => {
  it('没有任何数据时返回空数组', () => {
    expect(buildReview([], [], [], NOW)).toEqual([]);
  });

  it('合并归档任务与专注日志，并按日期倒序', () => {
    const review = buildReview(
      [day('2026-09-17', [archived('a', '写方案', 'done', 2, 2)])],
      [logEntry('2026-09-18', 25), logEntry('2026-09-17', 25)],
      [],
      NOW,
    );

    expect(review.map((item) => item.date)).toEqual(['2026-09-18', '2026-09-17']);
    expect(review[0]).toMatchObject({ isToday: true, focusCount: 1, focusMinutes: 25 });
    expect(review[0].tasks).toEqual([]);
    expect(review[1].tasks[0]).toMatchObject({ title: '写方案', status: 'done' });
    expect(review[1].doneCount).toBe(1);
  });

  it('今天的未完成任务会实时补充进来，已完成排在前面', () => {
    const review = buildReview(
      [day('2026-09-18', [archived('done-1', '已完成的事', 'done', 2, 2)])],
      [],
      [openTask('open-1', '还没做的事')],
      NOW,
    );

    expect(review).toHaveLength(1);
    expect(review[0].isToday).toBe(true);
    expect(review[0].tasks.map((task) => task.status)).toEqual(['done', 'unfinished']);
    expect(review[0].doneCount).toBe(1);
  });

  it('只有专注记录、没有任务的天也会保留', () => {
    const review = buildReview([], [logEntry('2026-09-10', 50)], [], NOW);
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({
      date: '2026-09-10',
      focusCount: 1,
      focusMinutes: 50,
    });
  });

  it('既没有任务也没有专注的天被过滤掉', () => {
    const review = buildReview([day('2026-09-10', [])], [], [], NOW);
    expect(review).toEqual([]);
  });

  it('累计值正确（近 N 天 / 番茄数 / 分钟）', () => {
    const review = buildReview(
      [day('2026-09-17', [archived('a', '任务 A', 'unfinished')])],
      [logEntry('2026-09-18', 25), logEntry('2026-09-17', 30)],
      [openTask('open-1', '进行中的事')],
      NOW,
    );
    expect(sumReview(review)).toEqual({ days: 2, count: 2, minutes: 55 });
  });
});
