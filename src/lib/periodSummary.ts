import { WEEKDAYS } from './review';
import { dayKey } from './stats';
import type { FocusLogEntry } from '../types';

export type PeriodKind = 'week' | 'month';

/** 周期内的一天 */
export interface PeriodDay {
  date: string;
  /** 星期几的中文简称 */
  weekday: string;
  count: number;
  minutes: number;
  /** 还没到来的日子：画成空档，而不是"这天投入为 0" */
  future: boolean;
}

export interface PeriodSummary {
  kind: PeriodKind;
  /** 本周期到现在为止 */
  count: number;
  minutes: number;
  /**
   * 上一周期的**同期**（相同天数）。
   * 用同期而不是"上一整周/整月"：周一早上拿 1 天去比 7 天，
   * 只会得到一个恒为负的百分比，没有任何参考价值。
   */
  prevCount: number;
  prevMinutes: number;
  /** 本周期已过去的天数（含今天） */
  elapsedDays: number;
  /** 周期总天数（周 7、月 28–31） */
  totalDays: number;
  /** 周期内的每一天，含未来的空档 */
  days: PeriodDay[];
  startKey: string;
}

function daysInMonth(date: Date): number {
  // 下个月的第 0 天 = 这个月的最后一天
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** 本周一 00:00 */
function startOfWeek(now: Date): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay() 是 0=周日，换算成"周一=0"
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * 周期复盘：本周 / 本月做到现在，以及与上一周期同期的对比。
 *
 * 只读日志，不碰归档 —— 与「按任务投入」同一个口径，
 * 两处数字才对得上（否则用户会发现同一个回顾页里两个总数不一样）。
 */
export function summarizePeriod(
  log: FocusLogEntry[],
  kind: PeriodKind,
  now = new Date(),
): PeriodSummary {
  const start = kind === 'week' ? startOfWeek(now) : startOfMonth(now);
  const totalDays = kind === 'week' ? 7 : daysInMonth(start);

  // 今天零点，用来算"已经过去了几天"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;

  const byDate = new Map<string, { count: number; minutes: number }>();
  log.forEach((entry) => {
    const bucket = byDate.get(entry.date) ?? { count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += entry.minutes;
    byDate.set(entry.date, bucket);
  });

  const days: PeriodDay[] = [];
  let count = 0;
  let minutes = 0;

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    const key = dayKey(date);
    // 未来的日子即使有记录（时钟被改过）也不算进本期
    const future = index >= elapsedDays;
    const bucket = byDate.get(key);

    days.push({
      date: key,
      weekday: WEEKDAYS[date.getDay()],
      count: future ? 0 : (bucket?.count ?? 0),
      minutes: future ? 0 : (bucket?.minutes ?? 0),
      future,
    });

    if (!future) {
      count += bucket?.count ?? 0;
      minutes += bucket?.minutes ?? 0;
    }
  }

  const prevStart =
    kind === 'week'
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)
      : new Date(start.getFullYear(), start.getMonth() - 1, 1);
  // 上月可能比本月短（3 月 31 日看"上月同期"只到 2 月 28 日），按实际天数截断
  const prevDays = Math.min(elapsedDays, kind === 'week' ? 7 : daysInMonth(prevStart));

  let prevCount = 0;
  let prevMinutes = 0;
  for (let index = 0; index < prevDays; index += 1) {
    const date = new Date(
      prevStart.getFullYear(),
      prevStart.getMonth(),
      prevStart.getDate() + index,
    );
    const bucket = byDate.get(dayKey(date));
    if (!bucket) continue;
    prevCount += bucket.count;
    prevMinutes += bucket.minutes;
  }

  return {
    kind,
    count,
    minutes,
    prevCount,
    prevMinutes,
    elapsedDays,
    totalDays,
    days,
    startKey: dayKey(start),
  };
}

/**
 * 与上周期的变化率（百分比，四舍五入）。
 * 上周期为 0 时返回 null —— 没有基准，任何百分比都是编出来的。
 */
export function changeRate(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
