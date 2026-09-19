import { Check, Circle, Sparkles } from 'lucide-react';
import { EstimateCard } from './EstimateCard';
import { Heatmap } from './Heatmap';
import { InterruptionCard } from './InterruptionCard';
import { PeriodReviewCard } from './PeriodReviewCard';
import { TagFocusCard } from './TagFocusCard';
import { TaskFocusCard } from './TaskFocusCard';
import { LIMITS } from '../config';
import { summarizeEstimateAccuracy } from '../lib/estimateAccuracy';
import { summarizeBreaks, summarizeInterruptions } from '../lib/interruption';
import { formatDayLabel, sumReview } from '../lib/review';
import { formatMinutes } from '../lib/stats';
import { aggregateTagFocus } from '../lib/tagFocus';
import { aggregateTaskFocus } from '../lib/taskFocus';
import type { Insight } from '../lib/insights';
import type { FocusLogEntry, ReviewEntry, Task } from '../types';

interface Props {
  review: ReviewEntry[];
  insights: Insight[];
  log: FocusLogEntry[];
  /** 分钟级时钟，与统计保持同一时间基准 */
  now: number;
  /** 工作列表里的任务：投入统计优先用它来取标题（任务改名后显示新名字） */
  openTasks: Task[];
}

/**
 * 回顾页：热力图 → 周期复盘 → 洞察 → 按任务投入 → 专注质量 → 预估准度 → 按天明细。
 *
 * 单独成文件是因为这几个区块各自都要调一个聚合函数，
 * 留在 TaskPanel 里会把"任务列表"和"数据分析"两件事混在一处。
 *
 * 不做 memo：它的 `now` 每秒都在变，缓存留不住；
 * 而且只有「回顾」标签页打开时才会挂到这里。
 */
export function ReviewList({ review, insights, log, now, openTasks }: Props) {
  if (review.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-sm text-white/40">
        还没有记录。
        <br />
        完成第一个番茄后这里会出现每日回顾。
      </p>
    );
  }

  const totals = sumReview(review);
  const focus = aggregateTaskFocus(log, review, openTasks, {
    days: LIMITS.reviewDays,
    now: new Date(now),
  });
  const tags = aggregateTagFocus(log, review, openTasks, {
    days: LIMITS.reviewDays,
    now: new Date(now),
  });
  const quality = summarizeInterruptions(log, {
    days: LIMITS.reviewDays,
    now: new Date(now),
  });
  const breaks = summarizeBreaks(log, {
    days: LIMITS.reviewDays,
    now: new Date(now),
  });
  const accuracy = summarizeEstimateAccuracy(review, {
    days: LIMITS.reviewDays,
    now: new Date(now),
  });

  return (
    <div className="space-y-3">
      <Heatmap log={log} now={now} />

      <PeriodReviewCard log={log} now={now} />

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <p
              key={insight.id}
              className="flex gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-[12px] leading-relaxed text-white/75"
            >
              <Sparkles className="mt-[2px] h-3 w-3 shrink-0 opacity-50" />
              {insight.text}
            </p>
          ))}
        </div>
      )}

      <p className="px-1 text-[11px] text-white/45">
        近 {totals.days} 天累计 {totals.count} 个番茄 · {formatMinutes(totals.minutes)}
      </p>

      <TaskFocusCard summary={focus} days={LIMITS.reviewDays} />

      <TagFocusCard summary={tags} days={LIMITS.reviewDays} />

      <InterruptionCard summary={quality} breaks={breaks} />

      <EstimateCard summary={accuracy} />

      {review.map((day) => {
        const unfinished = day.tasks.filter((task) => task.status === 'unfinished');
        return (
          <div key={day.date} className="rounded-2xl bg-white/[0.05] px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{formatDayLabel(day.date)}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-white/50">
                {day.focusCount} 个番茄 · {formatMinutes(day.focusMinutes)}
              </span>
            </div>

            {day.interruptions > 0 && (
              <p className="mt-1 text-[11px] text-white/35">
                期间离开 {day.interruptions} 次
              </p>
            )}

            {day.tasks.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {day.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 text-[12px]">
                    {task.status === 'done' ? (
                      <Check className="mt-[2px] h-3 w-3 shrink-0 opacity-70" />
                    ) : (
                      <Circle className="mt-[2px] h-3 w-3 shrink-0 opacity-30" />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        task.status === 'done'
                          ? 'line-through opacity-45'
                          : 'opacity-85'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/40">
                      {task.completedPomodoros}/{task.estimatedPomodoros}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11px] text-white/35">当天没有任务记录</p>
            )}

            {!day.isToday && unfinished.length > 0 && (
              <p className="mt-2 text-[11px] text-white/35">
                {unfinished.length} 项未完成，已顺延到次日
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
