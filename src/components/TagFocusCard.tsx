import { memo } from 'react';
import { formatMinutes } from '../lib/stats';
import type { TagFocusSummary } from '../lib/tagFocus';

interface Props {
  summary: TagFocusSummary;
  days: number;
}

/**
 * 按标签看投入分布 —— 回答"哪类事花了多久"。
 *
 * 与「按任务投入」是同一个数据源的两种切法：那边看单件事，这边看类别。
 */
export const TagFocusCard = memo(function TagFocusCard({ summary, days }: Props) {
  if (summary.entries.length === 0) return null;

  const share = (minutes: number) =>
    summary.totalMinutes > 0 ? (minutes / summary.totalMinutes) * 100 : 0;

  const notes: string[] = [];
  if (summary.hiddenMinutes > 0) {
    notes.push(
      `其他 ${summary.hiddenCount} 个标签 ${formatMinutes(summary.hiddenMinutes)}`,
    );
  }
  if (summary.untaggedMinutes > 0) {
    notes.push(`未打标签 ${formatMinutes(summary.untaggedMinutes)}`);
  }
  if (summary.detachedMinutes > 0) {
    notes.push(`已删除的任务 ${formatMinutes(summary.detachedMinutes)}`);
  }

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">按标签投入</span>
        <span className="shrink-0 text-[11px] text-white/45">近 {days} 天</span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {summary.entries.map((item) => (
          <li key={item.tag}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-white/85">#{item.tag}</span>
              <span className="shrink-0 tabular-nums text-white/50">
                {formatMinutes(item.minutes)} · {item.tasks} 个任务
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/45"
                // 极小的占比也留一点可见宽度，否则条形会完全消失
                style={{ width: `${Math.max(share(item.minutes), 1.5)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* 这句必须说：多标签任务的时长会被每个标签各计一次，各项相加会超过总投入 */}
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        一个任务可以有多个标签，它的时长会分别计入每个标签
      </p>

      {notes.length > 0 && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
          另有 {notes.join(' · ')}
        </p>
      )}
    </div>
  );
});
