import { describe, expect, it } from 'vitest';
import { computeStats, dayKey, formatMinutes } from './stats';
import type { FocusLogEntry } from '../types';

/** 固定"现在"为 2026-09-18 12:00 本地时间，避免测试随真实时间漂移 */
const NOW = new Date(2026, 8, 18, 12, 0, 0);

function entry(date: string, minutes: number): FocusLogEntry {
  return {
    id: `${date}-${minutes}`,
    finishedAt: 0,
    date,
    minutes,
    taskId: null,
    scene: 'deep-woods',
  };
}

describe('dayKey', () => {
  it('输出本地日期 YYYY-MM-DD 并补零', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('computeStats', () => {
  it('空日志返回全零，但仍给出 7 天刻度', () => {
    const stats = computeStats([], NOW);
    expect(stats.todayCount).toBe(0);
    expect(stats.todayMinutes).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.last7).toHaveLength(7);
    expect(stats.last7[6].date).toBe('2026-09-18');
    expect(stats.last7[6].weekday).toBe('今');
    expect(stats.last7[0].date).toBe('2026-09-12');
  });

  it('只统计今天的番茄与时长', () => {
    const stats = computeStats(
      [entry('2026-09-18', 25), entry('2026-09-18', 5), entry('2026-09-17', 25)],
      NOW,
    );
    expect(stats.todayCount).toBe(2);
    expect(stats.todayMinutes).toBe(30);
  });

  it('连续天数：今天有记录时从今天往回数', () => {
    const stats = computeStats(
      [
        entry('2026-09-18', 25),
        entry('2026-09-17', 25),
        entry('2026-09-16', 25),
        entry('2026-09-14', 25), // 09-15 缺失，断在这里
      ],
      NOW,
    );
    expect(stats.streak).toBe(3);
  });

  it('连续天数：今天还没开始时不清零', () => {
    const stats = computeStats(
      [entry('2026-09-17', 25), entry('2026-09-16', 25)],
      NOW,
    );
    expect(stats.streak).toBe(2);
  });

  it('昨天和今天都没有记录时连续天数为 0', () => {
    const stats = computeStats([entry('2026-09-15', 25)], NOW);
    expect(stats.streak).toBe(0);
  });

  it('同一天多条记录会累加到 7 天刻度里', () => {
    const stats = computeStats(
      [entry('2026-09-18', 25), entry('2026-09-18', 25), entry('2026-09-16', 10)],
      NOW,
    );
    const today = stats.last7.find((day) => day.date === '2026-09-18');
    const older = stats.last7.find((day) => day.date === '2026-09-16');
    expect(today).toMatchObject({ count: 2, minutes: 50 });
    expect(older).toMatchObject({ count: 1, minutes: 10 });
    expect(stats.last7.find((d) => d.date === '2026-09-17')).toMatchObject({
      count: 0,
      minutes: 0,
    });
  });

  it('跨月边界仍能正确回溯', () => {
    const now = new Date(2026, 9, 1, 9, 0); // 10-01
    const stats = computeStats(
      [entry('2026-10-01', 25), entry('2026-09-30', 25), entry('2026-09-29', 25)],
      now,
    );
    expect(stats.streak).toBe(3);
    expect(stats.last7[6].date).toBe('2026-10-01');
    expect(stats.last7[0].date).toBe('2026-09-25');
  });
});

describe('formatMinutes', () => {
  it('不足一小时显示分钟', () => {
    expect(formatMinutes(0)).toBe('0 分钟');
    expect(formatMinutes(45)).toBe('45 分钟');
    expect(formatMinutes(59)).toBe('59 分钟');
  });

  it('整小时不显示"0 分"', () => {
    expect(formatMinutes(60)).toBe('1 小时');
    expect(formatMinutes(120)).toBe('2 小时');
  });

  it('超过一小时显示小时+分钟', () => {
    expect(formatMinutes(61)).toBe('1 小时 1 分');
    expect(formatMinutes(150)).toBe('2 小时 30 分');
  });
});
