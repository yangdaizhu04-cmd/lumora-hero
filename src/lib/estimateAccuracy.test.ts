import { describe, expect, it } from 'vitest';
import {
  describeAccuracy,
  summarizeEstimateAccuracy,
  type EstimateAccuracySummary,
} from './estimateAccuracy';
import type { ArchivedTask, ReviewEntry } from '../types';

const NOW = new Date(2026, 8, 19, 22, 0, 0);

function archived(
  id: string,
  estimated: number,
  completed: number,
  status: ArchivedTask['status'] = 'done',
): ArchivedTask {
  return {
    id,
    title: id,
    estimatedPomodoros: estimated,
    completedPomodoros: completed,
    status,
  };
}

function day(date: string, tasks: ArchivedTask[]): ReviewEntry {
  return {
    date,
    isToday: false,
    focusCount: 0,
    focusMinutes: 0,
    interruptions: 0,
    tasks,
    doneCount: tasks.filter((task) => task.status === 'done').length,
  };
}

function stub(ratio: number | null): EstimateAccuracySummary {
  return {
    days: 30,
    sample: 5,
    estimatedTotal: 10,
    completedTotal: 10,
    over: 0,
    exact: 5,
    under: 0,
    ratio,
    examples: [],
    skipped: 0,
  };
}

describe('预估准度', () => {
  it('偏差分类：实际少于预估算高估', () => {
    const summary = summarizeEstimateAccuracy(
      [
        day('2026-09-18', [
          archived('a', 5, 3), // 高估
          archived('b', 2, 2), // 刚好
          archived('c', 1, 4), // 低估
        ]),
      ],
      { days: 30, now: NOW },
    );

    expect(summary.sample).toBe(3);
    expect([summary.over, summary.exact, summary.under]).toEqual([1, 1, 1]);
    expect(summary.ratio).toBeCloseTo(9 / 8);
  });

  // 未完成 = 还没做完，不是"高估"
  it('未完成的任务不计入准度', () => {
    const summary = summarizeEstimateAccuracy(
      [day('2026-09-18', [archived('a', 5, 0, 'unfinished'), archived('b', 2, 2)])],
      { days: 30, now: NOW },
    );

    expect(summary.sample).toBe(1);
    expect(summary.over).toBe(0);
  });

  // 「计划了 3 个番茄，一个没用就勾掉」多半是"没用番茄钟做这事"，
  // 混进准度统计会把整体偏差拉得很夸张
  it('一个番茄都没用就勾掉的，单独计数不进球', () => {
    const summary = summarizeEstimateAccuracy(
      [day('2026-09-18', [archived('a', 3, 0), archived('b', 2, 2)])],
      { days: 30, now: NOW },
    );

    expect(summary.sample).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  it('同一任务在多天归档里出现时只算一次，且以完成的那份为准', () => {
    const summary = summarizeEstimateAccuracy(
      [
        day('2026-09-18', [archived('a', 2, 3)]),
        day('2026-09-15', [archived('a', 2, 0, 'unfinished')]),
      ],
      { days: 30, now: NOW },
    );

    expect(summary.sample).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.completedTotal).toBe(3);
  });

  it('样本不足时不给整体倍率', () => {
    const summary = summarizeEstimateAccuracy(
      [day('2026-09-18', [archived('a', 2, 4)])],
      { days: 30, now: NOW },
    );

    expect(summary.sample).toBe(1);
    expect(summary.ratio).toBeNull();
  });

  it('偏差最大的排在前面', () => {
    const summary = summarizeEstimateAccuracy(
      [
        day('2026-09-18', [
          archived('a', 3, 4), // 偏差 1
          archived('b', 1, 6), // 偏差 5
          archived('c', 2, 3), // 偏差 1
        ]),
      ],
      { days: 30, now: NOW },
    );

    expect(summary.examples[0].id).toBe('b');
  });
});

describe('结论文案', () => {
  it('样本不足时不给结论', () => {
    expect(describeAccuracy(stub(null))).toBeNull();
  });

  it('偏差小于 10% 视为相当准', () => {
    expect(describeAccuracy(stub(1.05))).toBe('你的预估相当准');
    expect(describeAccuracy(stub(0.95))).toBe('你的预估相当准');
  });

  it('实际超过预估时说「偏少」', () => {
    expect(describeAccuracy(stub(1.5))).toBe('你的预估平均偏少 50%');
  });

  it('实际少于预估时说「偏多」', () => {
    expect(describeAccuracy(stub(0.6))).toBe('你的预估平均偏多 40%');
  });
});
