import { dayKey } from './stats';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

/** 一条任务的投入汇总 */
export interface TaskFocusEntry {
  taskId: string;
  title: string;
  /** 番茄数 */
  count: number;
  minutes: number;
}

export interface TaskFocusSummary {
  /** 按投入降序，最多 limit 条 */
  entries: TaskFocusEntry[];
  /** 被截断、合并进"其他 N 项"的条数与时长 */
  hiddenCount: number;
  hiddenMinutes: number;
  /** 窗口内的全部专注 */
  totalCount: number;
  totalMinutes: number;
  /** 曾经挂了任务、但任务已被删除的部分 */
  detachedCount: number;
  detachedMinutes: number;
  /** 没挂任何任务的部分（专注时没有「进行中」的任务） */
  unassignedCount: number;
  unassignedMinutes: number;
}

/**
 * 按任务汇总投入。
 *
 * 数据源只用专注日志 —— 它是唯一同时带 `taskId` 和 `minutes` 的记录。
 * （归档里的 `ArchivedTask.completedPomodoros` 是任务自己的计数器，
 * 跨天顺延后仍然连续，拿它算窗口内的投入会一直是历史累计值。）
 *
 * 三类"归不到具体任务"的时间要分辨清楚，否则总时长会对不上：
 * - `unassigned`：专注时没设进行中的任务
 * - `detached`：挂过任务，但任务已被删除
 * - 截断进 `hidden`：还有投入，只是没进前 limit 条
 */
export function aggregateTaskFocus(
  log: FocusLogEntry[],
  review: ReviewEntry[],
  openTasks: Task[],
  options: { days: number; limit?: number; now?: Date },
): TaskFocusSummary {
  const { days, limit = 6 } = options;
  const now = options.now ?? new Date();

  // 窗口起点含今天在内往前数 days 天；YYYY-MM-DD 可以直接按字符串比大小
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const startKey = dayKey(start);

  const titles = new Map<string, string>();
  // 归档快照先垫底，工作列表再覆盖：任务改过名时，历史投入也该显示新名字
  review.forEach((day) => {
    day.tasks.forEach((task) => {
      if (!titles.has(task.id)) titles.set(task.id, task.title);
    });
  });
  openTasks.forEach((task) => titles.set(task.id, task.title));

  const buckets = new Map<string, { count: number; minutes: number }>();
  let totalCount = 0;
  let totalMinutes = 0;
  let detachedCount = 0;
  let detachedMinutes = 0;
  let unassignedCount = 0;
  let unassignedMinutes = 0;

  log.forEach((entry) => {
    if (entry.date < startKey) return;

    totalCount += 1;
    totalMinutes += entry.minutes;

    if (!entry.taskId) {
      unassignedCount += 1;
      unassignedMinutes += entry.minutes;
      return;
    }
    if (!titles.has(entry.taskId)) {
      detachedCount += 1;
      detachedMinutes += entry.minutes;
      return;
    }

    const bucket = buckets.get(entry.taskId) ?? { count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += entry.minutes;
    buckets.set(entry.taskId, bucket);
  });

  const all: TaskFocusEntry[] = Array.from(buckets.entries())
    .map(([taskId, bucket]) => ({
      taskId,
      title: titles.get(taskId) ?? taskId,
      count: bucket.count,
      minutes: bucket.minutes,
    }))
    // 同分钟数时用番茄数与标题兜底，保证顺序稳定（否则每次渲染可能跳动）
    .sort(
      (a, b) =>
        b.minutes - a.minutes ||
        b.count - a.count ||
        a.title.localeCompare(b.title, 'zh'),
    );

  const entries = all.slice(0, limit);
  const hidden = all.slice(limit);

  return {
    entries,
    hiddenCount: hidden.length,
    hiddenMinutes: hidden.reduce((sum, item) => sum + item.minutes, 0),
    totalCount,
    totalMinutes,
    detachedCount,
    detachedMinutes,
    unassignedCount,
    unassignedMinutes,
  };
}
