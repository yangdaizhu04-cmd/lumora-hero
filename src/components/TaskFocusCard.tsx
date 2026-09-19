import { memo } from 'react';
import { formatMinutes } from '../lib/stats';
import type { TaskFocusSummary } from '../lib/taskFocus';

interface Props {
  summary: TaskFocusSummary;
  /** 统计窗口天数，显示在标题右侧 */
  days: number;
}

/**
 * 按任务的投入分布。
 *
 * 用横向条形而不是饼图：条形的长度可以直接比，饼图的角度不行；
 * 而且这里是 380px 的侧栏，饼图会挤成一团。
 *
 * 占比的分母是**窗口内的全部专注**（含未归类的部分），不是"已归类的那部分"——
 * 后者会让每一项看起来都比实际占比大。
 */
export const TaskFocusCard = memo(function TaskFocusCard({ summary, days }: Props) {
  if (summary.entries.length === 0) return null;

  const share = (minutes: number) =>
    summary.totalMinutes > 0 ? (minutes / summary.totalMinutes) * 100 : 0;

  const notes: string[] = [];
  if (summary.hiddenMinutes > 0) {
    notes.push(
      `其他 ${summary.hiddenCount} 项 ${formatMinutes(summary.hiddenMinutes)}`,
    );
  }
  if (summary.detachedMinutes > 0) {
    notes.push(`已删除的任务 ${formatMinutes(summary.detachedMinutes)}`);
  }
  if (summary.unassignedMinutes > 0) {
    notes.push(`未挂任务 ${formatMinutes(summary.unassignedMinutes)}`);
  }

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">按任务投入</span>
        <span className="shrink-0 text-[11px] text-white/45">近 {days} 天</span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {summary.entries.map((item) => (
          <li key={item.taskId}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-white/85">
                {item.title}
              </span>
              <span className="shrink-0 tabular-nums text-white/50">
                {formatMinutes(item.minutes)} · {item.count} 个
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/45"
                // 极小的占比也留一点可见宽度，否则条形会完全消失、看起来像没数据
                style={{ width: `${Math.max(share(item.minutes), 1.5)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {notes.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          另有 {notes.join(' · ')}
        </p>
      )}
    </div>
  );
});
