import { memo } from 'react';
import {
  describeAccuracy,
  type EstimateAccuracySummary,
} from '../lib/estimateAccuracy';

interface Props {
  summary: EstimateAccuracySummary;
}

/**
 * 预估准度：计划了几个番茄，实际用掉几个。
 *
 * 不给"准度评分"：一个把每件事都准确预测的人，往往只是因为只敢计划有把握的事。
 * 这里只呈现偏差方向（偏多 / 偏少），怎么调整交给用户自己判断。
 */
export const EstimateCard = memo(function EstimateCard({ summary }: Props) {
  if (summary.sample === 0) return null;

  const verdict = describeAccuracy(summary);
  const total = summary.over + summary.exact + summary.under;
  const width = (value: number) => `${(value / total) * 100}%`;

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">预估准度</span>
        <span className="shrink-0 text-[11px] text-white/45">
          近 {summary.days} 天 · {summary.sample} 个任务
        </span>
      </div>

      <p className="mt-2 text-[12px] text-white/80">
        {verdict ?? '多完成几个任务再来看整体偏差'}
      </p>

      {/* 高估 / 刚好 / 低估 的比例条 */}
      <div className="mt-2.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
        {summary.over > 0 && (
          <div className="bg-white/25" style={{ width: width(summary.over) }} />
        )}
        {summary.exact > 0 && (
          <div className="bg-white/65" style={{ width: width(summary.exact) }} />
        )}
        {summary.under > 0 && (
          <div className="bg-white/40" style={{ width: width(summary.under) }} />
        )}
      </div>
      <p className="mt-1 text-[11px] text-white/45">
        {summary.over} 高估 · {summary.exact} 刚好 · {summary.under} 低估
      </p>

      {summary.examples.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {summary.examples.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate text-white/85">
                {item.title}
              </span>
              <span className="shrink-0 tabular-nums text-white/50">
                预估 {item.estimated} → 实际 {item.completed}
              </span>
            </li>
          ))}
        </ul>
      )}

      {summary.skipped > 0 && (
        <p className="mt-2 text-[11px] text-white/30">
          另有 {summary.skipped} 个任务没用番茄钟，未计入
        </p>
      )}
    </div>
  );
});
