import type { DayStat, FocusLogEntry, FocusStats } from '../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 本地日期键 YYYY-MM-DD */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeStats(log: FocusLogEntry[], now = new Date()): FocusStats {
  const today = dayKey(now);
  const byDate = new Map<string, { count: number; minutes: number }>();

  let todayCount = 0;
  let todayMinutes = 0;

  for (const entry of log) {
    const bucket = byDate.get(entry.date) ?? { count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += entry.minutes;
    byDate.set(entry.date, bucket);

    if (entry.date === today) {
      todayCount += 1;
      todayMinutes += entry.minutes;
    }
  }

  // 近 7 天（含今天）
  const last7: DayStat[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    const bucket = byDate.get(key);
    last7.push({
      date: key,
      label: key.slice(5),
      weekday: offset === 0 ? '今' : `周${WEEKDAYS[date.getDay()]}`,
      count: bucket?.count ?? 0,
      minutes: bucket?.minutes ?? 0,
    });
  }

  // 连续天数：今天还没有记录时从昨天起算，避免"今天还没开始"就断签
  let streak = 0;
  const cursor = new Date(now);
  if (!byDate.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (byDate.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { todayCount, todayMinutes, streak, last7 };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}

/** 本周（周一为一周起点）完成的番茄数 */
export function countThisWeek(log: FocusLogEntry[], now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay(): 0=周日，换算成"周一=0"
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const startKey = dayKey(start);
  const todayKey = dayKey(now);
  return log.filter(
    (entry) => entry.date >= startKey && entry.date <= todayKey,
  ).length;
}

export interface HeatCell {
  date: string;
  count: number;
  minutes: number;
  /** 还没到来的日期：UI 画成空格而不是"零"，避免最后一周看起来像数据缺失 */
  future: boolean;
}

export interface HeatmapData {
  /** 按行优先排列（每周一列 7 个），长度 = weeks × 7 */
  cells: HeatCell[];
  max: number;
  weeks: number;
}

/**
 * 热力图数据：以周一为一列起点，生成连续 weeks 周（含本周）的格子。
 * 与 computeStats 不同，这里不设"最少记录"门槛 —— 它只是把已有数据画出来，不做结论。
 */
export function buildHeatmap(
  log: FocusLogEntry[],
  weeks = 12,
  now = new Date(),
): HeatmapData {
  const byDate = new Map<string, { count: number; minutes: number }>();
  log.forEach((entry) => {
    const bucket = byDate.get(entry.date) ?? { count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += entry.minutes;
    byDate.set(entry.date, bucket);
  });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);

  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);

  const cells: HeatCell[] = [];
  let max = 0;
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + offset);
    const key = dayKey(date);
    const future = key > todayKey;
    const bucket = byDate.get(key);
    const count = future ? 0 : (bucket?.count ?? 0);
    if (count > max) max = count;
    cells.push({ date: key, count, minutes: bucket?.minutes ?? 0, future });
  }

  return { cells, max, weeks };
}
