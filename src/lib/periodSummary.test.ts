import { describe, expect, it } from 'vitest';
import { changeRate, summarizePeriod } from './periodSummary';
import type { FocusLogEntry } from '../types';

/** 固定"现在"为 2026-09-19（周六）：本周一 = 09-14，已过去 6 天 */
const NOW = new Date(2026, 8, 19, 10, 0, 0);

function log(date: string, minutes = 25): FocusLogEntry {
  return {
    id: `log-${date}-${minutes}`,
    finishedAt: 0,
    date,
    minutes,
    taskId: null,
    scene: 'golden-hour',
  };
}

describe('周期复盘', () => {
  it('周视图：本周一到今天，未来几天标成空档而不是零投入', () => {
    const summary = summarizePeriod(
      [log('2026-09-14'), log('2026-09-14'), log('2026-09-19', 50)],
      'week',
      NOW,
    );

    expect(summary.days).toHaveLength(7);
    expect(summary.elapsedDays).toBe(6);
    expect(summary.startKey).toBe('2026-09-14');
    expect(summary.count).toBe(3);
    expect(summary.minutes).toBe(100);

    expect(summary.days[0]).toMatchObject({
      date: '2026-09-14',
      weekday: '一',
      count: 2,
      future: false,
    });
    expect(summary.days[5]).toMatchObject({ date: '2026-09-19', weekday: '六' });
    // 周日还没到
    expect(summary.days[6]).toMatchObject({
      date: '2026-09-20',
      future: true,
      count: 0,
    });
  });

  // 周一早上拿 1 天去比上周整周，只会得到一个恒为负的百分比
  it('同期对比：只比到相同的星期，不拿 6 天比 7 天', () => {
    const summary = summarizePeriod(
      [
        log('2026-09-15'), // 本周（周二）
        log('2026-09-08'), // 上周同期（周二）
        log('2026-09-13'), // 上周日 —— 超出同期范围，不该计入
      ],
      'week',
      NOW,
    );

    expect(summary.count).toBe(1);
    expect(summary.prevCount).toBe(1);
  });

  it('月视图：本月 1 日到今天', () => {
    const summary = summarizePeriod(
      [log('2026-09-01'), log('2026-09-19')],
      'month',
      NOW,
    );

    expect(summary.startKey).toBe('2026-09-01');
    expect(summary.days).toHaveLength(30);
    expect(summary.elapsedDays).toBe(19);
    expect(summary.count).toBe(2);
    expect(summary.days[18].date).toBe('2026-09-19');
    expect(summary.days[19].future).toBe(true);
  });

  // 3 月 31 日看"上月同期"只能覆盖到 2 月 28 日（2026 不是闰年）
  it('月视图：上个月更短时，同期只比到它的最后一天', () => {
    const march31 = new Date(2026, 2, 31, 10, 0, 0);
    const summary = summarizePeriod(
      [log('2026-03-31'), log('2026-02-28'), log('2026-02-01')],
      'month',
      march31,
    );

    expect(summary.elapsedDays).toBe(31);
    expect(summary.prevCount).toBe(2);
  });

  it('未来日期的记录不计入本期（时钟被改过也不能污染统计）', () => {
    const summary = summarizePeriod(
      [log('2026-09-18'), log('2026-09-25', 999)],
      'week',
      NOW,
    );
    expect(summary.count).toBe(1);
    expect(summary.minutes).toBe(25);
  });

  it('没有任何记录时返回零值而不是崩掉', () => {
    const summary = summarizePeriod([], 'week', NOW);
    expect(summary.count).toBe(0);
    expect(summary.minutes).toBe(0);
    expect(summary.prevCount).toBe(0);
    expect(summary.days).toHaveLength(7);
  });
});

describe('变化率', () => {
  it('正常计算涨跌', () => {
    expect(changeRate(10, 8)).toBe(25);
    expect(changeRate(4, 8)).toBe(-50);
    expect(changeRate(8, 8)).toBe(0);
  });

  // 没有基准时任何百分比都是编出来的
  it('上周期为 0 时返回 null，而不是无限大或 100%', () => {
    expect(changeRate(10, 0)).toBeNull();
    expect(changeRate(0, 0)).toBeNull();
  });
});
