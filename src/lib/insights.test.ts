import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import type { FocusLogEntry, SceneId } from '../types';

const NOW = new Date(2026, 8, 18, 21, 0);

function entry(options: {
  date: string;
  hour: number;
  scene?: SceneId;
  minutes?: number;
  interruptions?: number;
}): FocusLogEntry {
  const [year, month, day] = options.date.split('-').map(Number);
  return {
    id: `${options.date}-${options.hour}`,
    finishedAt: new Date(year, month - 1, day, options.hour, 30).getTime(),
    date: options.date,
    minutes: options.minutes ?? 25,
    taskId: null,
    scene: options.scene ?? 'deep-woods',
    ...(options.interruptions === undefined
      ? {}
      : { interruptions: options.interruptions }),
  };
}

describe('本地洞察', () => {
  it('数据太少时不给结论', () => {
    const log = [
      entry({ date: '2026-09-18', hour: 9 }),
      entry({ date: '2026-09-18', hour: 10 }),
    ];
    expect(buildInsights(log, NOW)).toEqual([]);
  });

  it('找出高效时段', () => {
    const log = [
      entry({ date: '2026-09-18', hour: 9 }),
      entry({ date: '2026-09-18', hour: 10 }),
      entry({ date: '2026-09-17', hour: 9 }),
      entry({ date: '2026-09-17', hour: 10 }),
      entry({ date: '2026-09-16', hour: 15 }),
      entry({ date: '2026-09-16', hour: 16 }),
    ];
    const peak = buildInsights(log, NOW).find((item) => item.id === 'peak-hours');
    expect(peak?.text).toContain('9:00–11:00');
  });

  it('报告平均专注时长', () => {
    const log = [
      entry({ date: '2026-09-18', hour: 9, minutes: 20 }),
      entry({ date: '2026-09-18', hour: 10, minutes: 40 }),
      entry({ date: '2026-09-17', hour: 9, minutes: 30 }),
      entry({ date: '2026-09-17', hour: 10, minutes: 30 }),
      entry({ date: '2026-09-16', hour: 9, minutes: 30 }),
      entry({ date: '2026-09-16', hour: 10, minutes: 30 }),
    ];
    const avg = buildInsights(log, NOW).find((item) => item.id === 'avg-length');
    expect(avg?.text).toContain('30 分钟');
  });

  it('识别主力场景', () => {
    const log = [
      entry({ date: '2026-09-18', hour: 9, scene: 'still-water' }),
      entry({ date: '2026-09-18', hour: 10, scene: 'still-water' }),
      entry({ date: '2026-09-18', hour: 11, scene: 'still-water' }),
      entry({ date: '2026-09-17', hour: 9, scene: 'deep-woods' }),
      entry({ date: '2026-09-17', hour: 10, scene: 'deep-woods' }),
      entry({ date: '2026-09-16', hour: 9, scene: 'deep-woods' }),
    ];
    const favorite = buildInsights(log, NOW).find(
      (item) => item.id === 'favorite-scene',
    );
    expect(favorite?.text).toContain('Still Water');
  });

  it('只有在采集到足够分心数据时才提分心', () => {
    const withoutData = Array.from({ length: 6 }, (_, index) =>
      entry({ date: '2026-09-18', hour: 9 + index }),
    );
    expect(
      buildInsights(withoutData, NOW).some((item) => item.id === 'interruptions'),
    ).toBe(false);

    const withData = Array.from({ length: 6 }, (_, index) =>
      entry({ date: '2026-09-18', hour: 9 + index, interruptions: 2 }),
    );
    expect(
      buildInsights(withData, NOW).some((item) => item.id === 'interruptions'),
    ).toBe(true);
  });

  it('最多只给三条结论', () => {
    const log = [
      entry({ date: '2026-09-18', hour: 9, scene: 'still-water', interruptions: 3 }),
      entry({ date: '2026-09-18', hour: 10, scene: 'still-water', interruptions: 3 }),
      entry({ date: '2026-09-17', hour: 9, scene: 'still-water', interruptions: 3 }),
      entry({ date: '2026-09-17', hour: 10, scene: 'deep-woods', interruptions: 3 }),
      entry({ date: '2026-09-16', hour: 9, scene: 'deep-woods', interruptions: 3 }),
      entry({ date: '2026-09-16', hour: 10, scene: 'deep-woods', interruptions: 3 }),
      entry({ date: '2026-09-15', hour: 9, scene: 'deep-woods', interruptions: 3 }),
      entry({ date: '2026-09-15', hour: 10, scene: 'deep-woods', interruptions: 3 }),
    ];
    const insights = buildInsights(log, NOW);
    expect(insights.length).toBeLessThanOrEqual(3);
    expect(insights.length).toBeGreaterThan(0);
  });
});
