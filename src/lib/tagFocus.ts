import { dayKey } from './stats';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

export interface TagFocusEntry {
  tag: string;
  count: number;
  minutes: number;
  /** 这个标签涉及多少个任务 */
  tasks: number;
}

export interface TagFocusSummary {
  /** 按投入降序，最多 limit 条 */
  entries: TagFocusEntry[];
  hiddenCount: number;
  hiddenMinutes: number;
  /** 窗口内的全部专注 */
  totalCount: number;
  totalMinutes: number;
  /** 任务没打标签、或专注时没设进行中任务的部分 */
  untaggedCount: number;
  untaggedMinutes: number;
  /** 挂了任务但任务已被删除的部分 */
  detachedCount: number;
  detachedMinutes: number;
  /** 有过专注、且带至少一个标签的任务数 */
  taggedTasks: number;
}

/**
 * 按标签汇总投入。
 *
 * **一个任务可以有多个标签，它的时长会被每个标签各计一次**，
 * 所以各项相加会大于 `totalMinutes`。这是刻意的：想知道"工作"和"紧急"
 * 各占多少时间，就不能把时长劈成两半。界面上会把这句说清楚。
 *
 * 与「按任务投入」同源（都走日志的 taskId），但归类的维度不同：
 * 那边回答"哪件事花了多久"，这边回答"哪类事花了多久"。
 */
export function aggregateTagFocus(
  log: FocusLogEntry[],
  review: ReviewEntry[],
  openTasks: Task[],
  options: { days: number; limit?: number; now?: Date },
): TagFocusSummary {
  const { days, limit = 6 } = options;
  const now = options.now ?? new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const startKey = dayKey(start);

  const tagsById = new Map<string, string[]>();
  // 归档快照先垫底，工作列表再覆盖 —— 与「按任务投入」一致：改过标签以最新的为准
  review.forEach((day) => {
    day.tasks.forEach((task) => {
      if (!tagsById.has(task.id)) tagsById.set(task.id, task.tags ?? []);
    });
  });
  openTasks.forEach((task) => tagsById.set(task.id, task.tags ?? []));

  const buckets = new Map<
    string,
    { count: number; minutes: number; taskIds: Set<string> }
  >();
  const taggedTaskIds = new Set<string>();

  let totalCount = 0;
  let totalMinutes = 0;
  let untaggedCount = 0;
  let untaggedMinutes = 0;
  let detachedCount = 0;
  let detachedMinutes = 0;

  log.forEach((entry) => {
    if (entry.date < startKey) return;

    totalCount += 1;
    totalMinutes += entry.minutes;

    const taskId = entry.taskId;
    if (!taskId) {
      untaggedCount += 1;
      untaggedMinutes += entry.minutes;
      return;
    }

    const tags = tagsById.get(taskId);
    if (!tags) {
      detachedCount += 1;
      detachedMinutes += entry.minutes;
      return;
    }
    if (tags.length === 0) {
      untaggedCount += 1;
      untaggedMinutes += entry.minutes;
      return;
    }

    taggedTaskIds.add(taskId);
    tags.forEach((tag) => {
      const bucket = buckets.get(tag) ?? {
        count: 0,
        minutes: 0,
        taskIds: new Set<string>(),
      };
      bucket.count += 1;
      bucket.minutes += entry.minutes;
      bucket.taskIds.add(taskId);
      buckets.set(tag, bucket);
    });
  });

  const all: TagFocusEntry[] = Array.from(buckets.entries())
    .map(([tag, bucket]) => ({
      tag,
      count: bucket.count,
      minutes: bucket.minutes,
      tasks: bucket.taskIds.size,
    }))
    .sort(
      (a, b) =>
        b.minutes - a.minutes || b.count - a.count || a.tag.localeCompare(b.tag, 'zh'),
    );

  const entries = all.slice(0, limit);
  const hidden = all.slice(limit);

  return {
    entries,
    hiddenCount: hidden.length,
    hiddenMinutes: hidden.reduce((sum, item) => sum + item.minutes, 0),
    totalCount,
    totalMinutes,
    untaggedCount,
    untaggedMinutes,
    detachedCount,
    detachedMinutes,
    taggedTasks: taggedTaskIds.size,
  };
}
