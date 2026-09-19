import { describe, expect, it } from 'vitest';
import { aggregateTaskFocus } from './taskFocus';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

/** 固定"现在"，避免测试随真实日期漂移 */
const NOW = new Date(2026, 8, 18, 9, 0, 0);

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

function task(id: string, title: string): Task {
  return {
    id,
    title,
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    done: false,
    createdAt: 0,
  };
}

function daySnapshot(
  date: string,
  tasks: { id: string; title: string }[],
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

describe('按任务汇总投入', () => {
  it('按投入降序，番茄数与时长各自累加', () => {
    const summary = aggregateTaskFocus(
      [
        log('2026-09-18', 'a', 25),
        log('2026-09-18', 'b', 25),
        log('2026-09-17', 'b', 25),
        log('2026-09-17', 'b', 10),
      ],
      [],
      [task('a', '写方案'), task('b', '回邮件')],
      { days: 30, now: NOW },
    );

    expect(
      summary.entries.map((item) => [item.title, item.count, item.minutes]),
    ).toEqual([
      ['回邮件', 3, 60],
      ['写方案', 1, 25],
    ]);
  });

  // 任务改过名之后，历史投入也该跟着显示新名字，而不是日志产生时的旧名字
  it('工作列表里的标题优先于归档快照', () => {
    const summary = aggregateTaskFocus(
      [log('2026-09-10', 'a', 25)],
      [daySnapshot('2026-09-10', [{ id: 'a', title: '旧名' }])],
      [task('a', '新名')],
      { days: 30, now: NOW },
    );

    expect(summary.entries[0].title).toBe('新名');
  });

  it('已移出工作列表、但归档里有快照的任务仍能显示标题', () => {
    const summary = aggregateTaskFocus(
      [log('2026-09-10', 'a', 25)],
      [daySnapshot('2026-09-10', [{ id: 'a', title: '归档里的任务' }])],
      [],
      { days: 30, now: NOW },
    );

    expect(summary.entries[0].title).toBe('归档里的任务');
  });

  it('归不到任务的时间分三类统计，且总时长守恒', () => {
    const summary = aggregateTaskFocus(
      [
        log('2026-09-18', 'a', 25),
        log('2026-09-18', null, 25), // 专注时没设进行中的任务
        log('2026-09-18', 'gone', 50), // 挂过任务，但任务已被删除
      ],
      [],
      [task('a', '写方案')],
      { days: 30, now: NOW },
    );

    expect(summary.entries).toHaveLength(1);
    expect(summary.unassignedMinutes).toBe(25);
    expect(summary.detachedMinutes).toBe(50);

    // 守恒：明细 + 未挂 + 已删除 === 窗口内总计（否则界面上会"少了一块时间"）
    expect(
      summary.entries[0].minutes + summary.unassignedMinutes + summary.detachedMinutes,
    ).toBe(summary.totalMinutes);
  });

  it('窗口外的记录不计入', () => {
    const summary = aggregateTaskFocus(
      [log('2026-09-18', 'a', 25), log('2026-07-01', 'a', 100)],
      [],
      [task('a', '写方案')],
      // 含今天往前 7 天 → 起点 2026-09-12
      { days: 7, now: NOW },
    );

    expect(summary.totalCount).toBe(1);
    expect(summary.entries[0].minutes).toBe(25);
  });

  it('超出 limit 的合并进 hidden，时长不丢', () => {
    const summary = aggregateTaskFocus(
      [
        log('2026-09-18', 'a', 30),
        log('2026-09-18', 'b', 20),
        log('2026-09-18', 'c', 10),
      ],
      [],
      [task('a', 'A'), task('b', 'B'), task('c', 'C')],
      { days: 30, limit: 1, now: NOW },
    );

    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0].title).toBe('A');
    expect(summary.hiddenCount).toBe(2);
    expect(summary.hiddenMinutes).toBe(30);
  });

  it('没有任何记录时返回空摘要而不是崩掉', () => {
    const summary = aggregateTaskFocus([], [], [], { days: 30, now: NOW });
    expect(summary.entries).toEqual([]);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.hiddenCount).toBe(0);
  });
});
