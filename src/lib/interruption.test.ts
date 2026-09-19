import { describe, expect, it } from 'vitest';
import {
  formatHourRange,
  summarizeBreaks,
  summarizeInterruptions,
} from './interruption';
import type { FocusLogEntry } from '../types';

/** 固定"现在"为 2026-09-19 周六 22:00 */
const NOW = new Date(2026, 8, 19, 22, 0, 0);

function at(dateKey: string, hour: number): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour).getTime();
}

/** 不传 interruptions 表示"老记录，没有这个字段" */
function log(dateKey: string, interruptions?: number, hour = 10): FocusLogEntry {
  return {
    id: `log-${dateKey}-${interruptions ?? 'na'}-${hour}`,
    finishedAt: at(dateKey, hour),
    date: dateKey,
    minutes: 25,
    taskId: null,
    scene: 'golden-hour',
    ...(interruptions === undefined ? {} : { interruptions }),
  };
}

describe('中断分析', () => {
  it('心流率与平均中断次数', () => {
    const summary = summarizeInterruptions(
      [
        log('2026-09-18', 0),
        log('2026-09-18', 0),
        log('2026-09-18', 2),
        log('2026-09-18', 1),
      ],
      { days: 30, now: NOW },
    );

    expect(summary.tracked).toBe(4);
    expect(summary.clean).toBe(2);
    expect(summary.cleanRate).toBe(0.5);
    expect(summary.average).toBe(0.75);
  });

  // interruptions 是后加的字段：老记录无从知道当时是否被打断，
  // 当成 0 会把心流率算得虚高
  it('没有中断记录的旧数据被排除，而不是当成 0', () => {
    const summary = summarizeInterruptions([log('2026-09-18', 0), log('2026-09-18')], {
      days: 30,
      now: NOW,
    });

    expect(summary.tracked).toBe(1);
    expect(summary.cleanRate).toBe(1);
    // 总数仍要如实反映窗口内的全部专注，界面才能说明"有多少老记录没数据"
    expect(summary.total).toBe(2);
  });

  it('最近 7 天与更早分开统计', () => {
    const summary = summarizeInterruptions(
      [
        log('2026-09-18', 0), // 近 7 天
        log('2026-09-13', 3), // 近 7 天（含今天往前 7 天）
        log('2026-09-10', 2), // 更早
      ],
      { days: 30, now: NOW },
    );

    expect(summary.recent.tracked).toBe(2);
    expect(summary.recent.cleanRate).toBe(0.5);
    expect(summary.earlier.tracked).toBe(1);
    expect(summary.earlier.cleanRate).toBe(0);
  });

  it('时段样本不足时不点名', () => {
    const summary = summarizeInterruptions(
      Array.from({ length: 4 }, () => log('2026-09-18', 2, 15)),
      { days: 30, now: NOW },
    );

    expect(summary.worstHour).toBeNull();
  });

  it('时段样本足够时，给出平均中断最多的那个小时', () => {
    const summary = summarizeInterruptions(
      [
        ...Array.from({ length: 5 }, () => log('2026-09-18', 2, 15)),
        ...Array.from({ length: 5 }, () => log('2026-09-17', 0, 10)),
      ],
      { days: 30, now: NOW },
    );

    expect(summary.worstHour?.hour).toBe(15);
    expect(summary.worstHour?.average).toBe(2);
  });

  it('窗口外的记录不计入', () => {
    const summary = summarizeInterruptions(
      [log('2026-09-18', 1), log('2026-06-01', 9)],
      { days: 7, now: NOW },
    );

    expect(summary.tracked).toBe(1);
  });

  it('没有任何记录时返回零值', () => {
    const summary = summarizeInterruptions([], { days: 30, now: NOW });
    expect(summary.tracked).toBe(0);
    expect(summary.cleanRate).toBe(0);
    expect(summary.worstHour).toBeNull();
  });
});

describe('时段标签', () => {
  it('格式化成小时区间，跨零点回绕', () => {
    expect(formatHourRange(9)).toBe('09:00–10:00');
    expect(formatHourRange(23)).toBe('23:00–00:00');
  });
});

describe('打断归因', () => {
  it('按原因累计次数，并按次数降序', () => {
    const summary = summarizeBreaks(
      [
        { ...log('2026-09-18', 0, 10), breakReasons: ['external', 'drift'] },
        { ...log('2026-09-18', 0, 11), breakReasons: ['external'] },
      ],
      { days: 30, now: NOW },
    );

    expect(summary.total).toBe(3);
    expect(summary.entries[0]).toMatchObject({
      id: 'external',
      label: '外部打断',
      count: 2,
    });
    expect(summary.entries[1]).toMatchObject({ id: 'drift', label: '走神', count: 1 });
  });

  it('没有打点记录时返回零值', () => {
    const summary = summarizeBreaks([log('2026-09-18', 0)], { days: 30, now: NOW });
    expect(summary.total).toBe(0);
    expect(summary.entries).toEqual([]);
  });

  // 老数据里可能出现已经不存在的 id，原样显示比吞掉好排查
  it('未知原因 id 原样显示', () => {
    const summary = summarizeBreaks(
      [{ ...log('2026-09-18', 0), breakReasons: ['legacy-reason'] }],
      { days: 30, now: NOW },
    );
    expect(summary.entries[0].label).toBe('legacy-reason');
  });

  it('窗口外的记录不计入', () => {
    const summary = summarizeBreaks(
      [
        { ...log('2026-09-18', 0), breakReasons: ['external'] },
        { ...log('2026-06-01', 0), breakReasons: ['external', 'drift'] },
      ],
      { days: 7, now: NOW },
    );
    expect(summary.total).toBe(1);
  });
});
