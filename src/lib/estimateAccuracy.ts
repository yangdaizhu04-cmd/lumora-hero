import { dayKey } from './stats';
import type { ArchivedTask, ReviewEntry } from '../types';

/** 低于这个样本数就不给"整体偏差倍率"—— 两三个任务算出来的倍率没有参考价值 */
const MIN_SAMPLE_FOR_RATIO = 3;

export interface EstimateDeviation {
  id: string;
  title: string;
  estimated: number;
  completed: number;
}

export interface EstimateAccuracySummary {
  days: number;
  /** 纳入统计的已完成任务数（至少用掉 1 个番茄的） */
  sample: number;
  estimatedTotal: number;
  completedTotal: number;
  /** 预估偏高：实际比预估少 */
  over: number;
  /** 预估刚好 */
  exact: number;
  /** 预估偏低：实际比预估多 */
  under: number;
  /** 实际 / 预估。样本不足，或预估总和为 0 时为 null */
  ratio: number | null;
  /** 偏差最大的几条，按偏差绝对值降序 */
  examples: EstimateDeviation[];
  /** 勾掉了、但一个番茄都没用掉的任务数（不计入准度统计） */
  skipped: number;
}

/**
 * 预估准度：计划了几个番茄，实际用掉几个。
 *
 * 只统计**已完成**的任务——未完成的任务是"还没做完"，不是"高估了"，
 * 把它们算进来只会得到一个恒偏高的结论。
 *
 * 另外，"一个番茄都没用就勾掉"的任务单独计（`skipped`），不进球：
 * 那类任务多半是"没用番茄钟做这事"，不是预估失准，
 * 混在一起会把整体偏差拉得很夸张。
 */
export function summarizeEstimateAccuracy(
  review: ReviewEntry[],
  options: { days: number; now?: Date; limit?: number } = { days: 30 },
): EstimateAccuracySummary {
  const { days, limit = 3 } = options;
  const now = options.now ?? new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const startKey = dayKey(start);

  // 同一个任务可能出现在多天的归档里（先记为"未完成"顺延，之后才完成）。
  // 按 id 收敛，只认 status === 'done' 的那份；review 按日期倒序，先遇到的更新。
  const done = new Map<string, ArchivedTask>();
  review.forEach((day) => {
    if (day.date < startKey) return;
    day.tasks.forEach((task) => {
      if (task.status !== 'done' || done.has(task.id)) return;
      done.set(task.id, task);
    });
  });

  const all = Array.from(done.values());
  const counted = all.filter((task) => task.completedPomodoros > 0);

  const estimatedTotal = counted.reduce(
    (sum, task) => sum + task.estimatedPomodoros,
    0,
  );
  const completedTotal = counted.reduce(
    (sum, task) => sum + task.completedPomodoros,
    0,
  );

  let over = 0;
  let exact = 0;
  let under = 0;
  counted.forEach((task) => {
    if (task.completedPomodoros < task.estimatedPomodoros) over += 1;
    else if (task.completedPomodoros > task.estimatedPomodoros) under += 1;
    else exact += 1;
  });

  const examples: EstimateDeviation[] = counted
    .map((task) => ({
      id: task.id,
      title: task.title,
      estimated: task.estimatedPomodoros,
      completed: task.completedPomodoros,
    }))
    // 偏差一样大时，把"做得多"的排前面（更值得看）
    .sort((a, b) => {
      const diff =
        Math.abs(b.completed - b.estimated) - Math.abs(a.completed - a.estimated);
      return diff !== 0 ? diff : b.completed - a.completed;
    })
    .slice(0, limit);

  return {
    days,
    sample: counted.length,
    estimatedTotal,
    completedTotal,
    over,
    exact,
    under,
    ratio:
      counted.length >= MIN_SAMPLE_FOR_RATIO && estimatedTotal > 0
        ? completedTotal / estimatedTotal
        : null,
    examples,
    skipped: all.length - counted.length,
  };
}

/**
 * 把这组数字翻译成一句人话。
 * 只在样本足够时给结论 —— 说得像模像样但基于 2 个任务，比不说更误导。
 */
export function describeAccuracy(summary: EstimateAccuracySummary): string | null {
  if (summary.ratio === null) return null;

  const percent = Math.round(Math.abs(summary.ratio - 1) * 100);
  if (percent < 10) return '你的预估相当准';

  return summary.ratio > 1
    ? `你的预估平均偏少 ${percent}%`
    : `你的预估平均偏多 ${percent}%`;
}
