import { memo, useState } from 'react';
import { changeRate, summarizePeriod, type PeriodKind } from '../lib/periodSummary';
import { formatMinutes } from '../lib/stats';
import type { FocusLogEntry } from '../types';

interface Props {
  log: FocusLogEntry[];
  /** 分钟级时钟，与统计保持同一时间基准 */
  now: number;
}

const BAR_AREA_PX = 48;

/**
 * 周期复盘：本周 / 本月做到现在，以及与上一周期同期的对比。
 *
 * 对比用的是**同期**而不是"上一整周 / 整月"：周一早上拿 1 天去比 7 天，
 * 只会得到一个恒为负的百分比。这里连涨跌都不上色，只用箭头 ——
 * 复盘不是成绩单，跌了也不必让整块界面变红来提醒你。
 */
export const PeriodReviewCard = memo(function PeriodReviewCard({ log, now }: Props) {
  const [kind, setKind] = useState<PeriodKind>('week');
  const summary = summarizePeriod(log, kind, new Date(now));

  const delta = changeRate(summary.count, summary.prevCount);
  const max = Math.max(...summary.days.map((day) => day.count), 1);
  const todayKey = summary.days[summary.elapsedDays - 1]?.date ?? '';

  /** 统一用像素：百分比和像素混用会让空档柱子不可见 */
  const barHeight = (count: number, future: boolean): number => {
    if (future) return 2;
    if (count === 0) return 3;
    return Math.max((count / max) * BAR_AREA_PX, 5);
  };

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">周期复盘</span>
        <div className="flex items-center gap-1">
          {(['week', 'month'] as PeriodKind[]).map((key) => {
            const active = kind === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setKind(key)}
                aria-pressed={active}
                className="rounded-full px-2.5 py-0.5 text-[11px] transition-colors duration-300"
                style={{
                  background: active ? 'rgba(255,255,255,0.85)' : 'transparent',
                  color: active ? '#182C41' : 'inherit',
                  opacity: active ? 1 : 0.55,
                }}
              >
                {key === 'week' ? '周' : '月'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl tabular-nums">{summary.count}</span>
        <span className="text-[11px] text-white/50">
          个番茄 · {formatMinutes(summary.minutes)}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-white/45">
        {kind === 'week' ? '上周同期' : '上月同期'} {summary.prevCount} 个
        {delta !== null ? ` · ${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}%` : ''}
      </p>

      {/* 每日分布：未来的日子留一个极矮的空档，让整周的框架保持可见 */}
      <div className="mt-3 flex items-end gap-[3px]" style={{ height: BAR_AREA_PX }}>
        {summary.days.map((day) => (
          <div key={day.date} className="flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-sm ${
                day.future
                  ? 'bg-white/[0.07]'
                  : day.date === todayKey
                    ? 'bg-white/70'
                    : 'bg-white/35'
              }`}
              style={{ height: barHeight(day.count, day.future) }}
            />
          </div>
        ))}
      </div>

      {/* 周视图标星期；月视图三十来根柱子，标了也挤不下 */}
      {kind === 'week' && (
        <div className="mt-1 flex gap-[3px]">
          {summary.days.map((day) => (
            <span
              key={day.date}
              className="flex-1 text-center text-[10px] text-white/35"
            >
              {day.weekday}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
