import { LIMITS } from '../config';
import { dayKey } from './stats';
import type { DayArchive, FocusLogEntry, ReviewEntry, Task } from '../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 「今天 / 昨天 / 9 月 18 日 周五」 */
export function formatDayLabel(dateKey: string, now = new Date()): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  if (dateKey === today) return '今天';
  if (dateKey === yesterday) return '昨天';

  const weekday = WEEKDAYS[date.getDay()];
  const prefix = year === now.getFullYear() ? '' : `${year} 年 `;
  return `${prefix}${month} 月 ${day} 日 周${weekday}`;
}

/**
 * 把「归档 + 专注日志 + 今天仍在进行中的任务」合成一份可渲染的回顾列表。
 *
 * - 归档提供每天的任务快照（完成 / 未完成）
 * - 日志提供每天的番茄数与专注时长
 * - 今天的未完成任务还没进归档，实时补上
 */
export function buildReview(
  archive: DayArchive[],
  log: FocusLogEntry[],
  openTasks: Task[],
  now = new Date(),
): ReviewEntry[] {
  const today = dayKey(now);
  const map = new Map<string, ReviewEntry>();

  const ensure = (date: string): ReviewEntry => {
    const existing = map.get(date);
    if (existing) return existing;
    const entry: ReviewEntry = {
      date,
      isToday: date === today,
      focusCount: 0,
      focusMinutes: 0,
      interruptions: 0,
      tasks: [],
      doneCount: 0,
    };
    map.set(date, entry);
    return entry;
  };

  archive.forEach((day) => {
    ensure(day.date).tasks.push(...day.tasks);
  });

  log.forEach((entry) => {
    const day = ensure(entry.date);
    day.focusCount += 1;
    day.focusMinutes += entry.minutes;
    day.interruptions += entry.interruptions ?? 0;
  });

  const todayEntry = ensure(today);
  openTasks.forEach((task) => {
    todayEntry.tasks.push({
      id: task.id,
      title: task.title,
      estimatedPomodoros: task.estimatedPomodoros,
      completedPomodoros: task.completedPomodoros,
      status: 'unfinished',
    });
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      // 已完成排前面，未完成（顺延的）排后面
      tasks: [...entry.tasks].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'done' ? -1 : 1,
      ),
      doneCount: entry.tasks.filter((task) => task.status === 'done').length,
    }))
    .filter((entry) => entry.tasks.length > 0 || entry.focusCount > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, LIMITS.reviewDays);
}

export interface ArchiveTotals {
  days: number;
  count: number;
  minutes: number;
}

export function sumReview(review: ReviewEntry[]): ArchiveTotals {
  return review.reduce<ArchiveTotals>(
    (acc, day) => ({
      days: acc.days + 1,
      count: acc.count + day.focusCount,
      minutes: acc.minutes + day.focusMinutes,
    }),
    { days: 0, count: 0, minutes: 0 },
  );
}
