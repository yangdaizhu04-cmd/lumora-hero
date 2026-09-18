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
