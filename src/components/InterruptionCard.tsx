import { memo } from 'react';
import {
  formatHourRange,
  type BreakAttribution,
  type InterruptionSummary,
} from '../lib/interruption';

interface Props {
  summary: InterruptionSummary;
  /** 主动打点的归因；一次都没有时不显示这一段 */
  breaks: BreakAttribution;
}

/** 最近 7 天与更早各至少这么多段，才值得比较趋势 */
const MIN_TREND_SAMPLE = 3;

/**
 * 专注质量：有多少比例的专注是「完整没被打断」的。
 *
 * 主指标用心流率而不是平均中断次数：后者会被极端值拉偏 ——
 * 一段被打断十次就能把平均拉得很难看。而"多少段是完整的"
 * 更接近"我这段专注有没有被打断"的直觉，也不容易被单个异常左右。
 */
export const InterruptionCard = memo(function InterruptionCard({
  summary,
  breaks,
}: Props) {
  // 一段可统计的专注都没有时不出这个卡片：显示 0% 比什么都不说更糟
  if (summary.tracked === 0) return null;

  const percent = Math.round(summary.cleanRate * 100);
  const untracked = summary.total - summary.tracked;

  const trend =
    summary.recent.tracked >= MIN_TREND_SAMPLE &&
    summary.earlier.tracked >= MIN_TREND_SAMPLE
      ? Math.round((summary.recent.cleanRate - summary.earlier.cleanRate) * 100)
      : null;

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">专注质量</span>
        <span className="shrink-0 text-[11px] text-white/45">
          近 {summary.days} 天 · {summary.tracked} 段
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl tabular-nums">{percent}%</span>
        <span className="text-[11px] text-white/50">完整没有被打断</span>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/50"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-white/45">
        平均每段 {summary.average.toFixed(1)} 次中断
      </p>

      {trend !== null && (
        <p className="mt-1 text-[11px] text-white/45">
          近 7 天 {Math.round(summary.recent.cleanRate * 100)}%
          {` · ${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}%`}
        </p>
      )}

      {summary.worstHour && (
        <p className="mt-1 text-[11px] text-white/45">
          最容易被打断：{formatHourRange(summary.worstHour.hour)}（
          {summary.worstHour.average.toFixed(1)} 次/段）
        </p>
      )}

      {breaks.total > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/45">
          主动打点 {breaks.total} 次：
          {breaks.entries.map((item) => `${item.label} ${item.count}`).join(' · ')}
        </p>
      )}

      {untracked > 0 && (
        <p className="mt-2 text-[11px] text-white/30">
          另有 {untracked} 段是早期记录，没有中断数据
        </p>
      )}
    </div>
  );
});
