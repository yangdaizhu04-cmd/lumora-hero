import { breakReasonLabel } from '../data/breakReasons';
import { dayKey } from './stats';
import type { FocusLogEntry } from '../types';

/** 一个时段至少要有这么多段专注，才会被点名"最容易被打断" */
const MIN_HOUR_SAMPLE = 5;

/** 最近这么多天算"近期"，用来和更早的时间对比 */
const RECENT_DAYS = 7;

export interface QualityBucket {
  /** 有中断记录的专注段数 */
  tracked: number;
  /** 其中完全没被打断的段数 */
  clean: number;
  /** 心流率 0–1 */
  cleanRate: number;
}

export interface InterruptionSummary {
  days: number;
  /** 窗口内的专注总数（含没有中断记录的旧数据） */
  total: number;
  /** 其中**有中断记录**、可用于统计的段数 */
  tracked: number;
  clean: number;
  cleanRate: number;
  /** 平均每段专注被打断几次 */
  average: number;
  /** 最近 7 天 */
  recent: QualityBucket;
  /** 更早（8 天前起） */
  earlier: QualityBucket;
  /** 最容易被打断的时段；样本不足时为 null */
  worstHour: { hour: number; average: number; tracked: number } | null;
}

function bucketOf(entries: FocusLogEntry[]): QualityBucket {
  const tracked = entries.length;
  const clean = entries.filter((entry) => (entry.interruptions ?? 0) === 0).length;
  return { tracked, clean, cleanRate: tracked > 0 ? clean / tracked : 0 };
}

/**
 * 专注质量：有多少比例是"完整不被打断"的，以及什么时段最容易被打断。
 *
 * `interruptions` 是后来才加的字段，老记录没有它。那些记录**直接排除**，
 * 而不是当成 0 —— 当成 0 会把心流率算得虚高，让人以为自己状态很好。
 * 代价是样本变小，所以界面上会标出"基于多少段专注"。
 */
export function summarizeInterruptions(
  log: FocusLogEntry[],
  options: { days: number; now?: Date } = { days: 30 },
): InterruptionSummary {
  const { days } = options;
  const now = options.now ?? new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const startKey = dayKey(start);

  const inWindow = log.filter((entry) => entry.date >= startKey);
  const tracked = inWindow.filter((entry) => entry.interruptions !== undefined);

  const recentStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (RECENT_DAYS - 1),
  );
  const recentKey = dayKey(recentStart);

  const recent = tracked.filter((entry) => entry.date >= recentKey);
  const earlier = tracked.filter((entry) => entry.date < recentKey);

  const interruptionsTotal = tracked.reduce(
    (sum, entry) => sum + (entry.interruptions ?? 0),
    0,
  );
  const overall = bucketOf(tracked);

  // 按**结束时刻**所在的小时聚合。专注跨小时时这不精确，
  // 但用来回答"哪个时段最容易被打断"足够了 —— 25 分钟的段很少跨两个时段。
  const byHour = new Map<number, { tracked: number; interruptions: number }>();
  tracked.forEach((entry) => {
    const hour = new Date(entry.finishedAt).getHours();
    const current = byHour.get(hour) ?? { tracked: 0, interruptions: 0 };
    current.tracked += 1;
    current.interruptions += entry.interruptions ?? 0;
    byHour.set(hour, current);
  });

  type HourStat = { hour: number; average: number; tracked: number };
  let worstHour: HourStat | null = null;

  for (const [hour, value] of byHour) {
    if (value.tracked < MIN_HOUR_SAMPLE) continue;
    const average = value.interruptions / value.tracked;
    // 平均 0 次的时段谈不上"最容易被打断"
    if (average <= 0) continue;
    if (!worstHour || average > worstHour.average) {
      worstHour = { hour, average, tracked: value.tracked };
    }
  }

  return {
    days,
    total: inWindow.length,
    tracked: tracked.length,
    clean: overall.clean,
    cleanRate: overall.cleanRate,
    average: tracked.length > 0 ? interruptionsTotal / tracked.length : 0,
    recent: bucketOf(recent),
    earlier: bucketOf(earlier),
    worstHour,
  };
}

/** 把小时数格式化成「15:00–16:00」这样的时段标签 */
export function formatHourRange(hour: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}

export interface BreakAttribution {
  /** 主动打点的总次数 */
  total: number;
  /** 按次数降序 */
  entries: { id: string; label: string; count: number }[];
}

/**
 * 打断归因：为什么被打断。
 *
 * 和上面的心流率互补 —— 那个说"有多少段被打断过"（被动检测切走标签页），
 * 这个说"都是因为什么"（用户自己按的）。两者的漏报方向相反：
 * 切走标签页会被自动记下，但"人走过来问你话"不会；打点则完全依赖用户记得按。
 */
export function summarizeBreaks(
  log: FocusLogEntry[],
  options: { days: number; now?: Date } = { days: 30 },
): BreakAttribution {
  const { days } = options;
  const now = options.now ?? new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const startKey = dayKey(start);

  const counts = new Map<string, number>();
  let total = 0;

  log.forEach((entry) => {
    if (entry.date < startKey) return;
    entry.breakReasons?.forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      total += 1;
    });
  });

  return {
    total,
    entries: Array.from(counts.entries())
      .map(([id, count]) => ({ id, label: breakReasonLabel(id), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh')),
  };
}
