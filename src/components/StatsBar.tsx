import { memo } from 'react';
import { formatMinutes } from '../lib/stats';
import type { FocusStats } from '../types';

interface Props {
  stats: FocusStats;
}

const SANS = 'system-ui, sans-serif';

/** 今日专注数据 + 近 7 天迷你柱状图 */
function StatsBarComponent({ stats }: Props) {
  const max = Math.max(1, ...stats.last7.map((day) => day.count));
  const barHeight = (count: number) => 3 + Math.round((count / max) * 13);

  return (
    <div
      className="liquid-glass mx-auto flex w-fit items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] sm:gap-4 sm:px-5 sm:py-2 sm:text-xs"
      style={{ fontFamily: SANS }}
      aria-label={`今日完成 ${stats.todayCount} 个番茄，专注 ${formatMinutes(
        stats.todayMinutes,
      )}，连续 ${stats.streak} 天`}
    >
      <span className="whitespace-nowrap tabular-nums">
        今日 {stats.todayCount} 个番茄
      </span>
      <span className="opacity-30">|</span>
      <span className="whitespace-nowrap tabular-nums">
        {formatMinutes(stats.todayMinutes)}
      </span>
      <span className="opacity-30">|</span>
      <span className="whitespace-nowrap tabular-nums">连续 {stats.streak} 天</span>

      <div className="hidden items-end gap-[3px] pl-1 sm:flex" aria-hidden="true">
        {stats.last7.map((day) => (
          <span
            key={day.date}
            title={`${day.date} · ${day.count} 个番茄`}
            className="w-[6px] rounded-[2px] transition-all duration-500"
            style={{
              height: `${barHeight(day.count)}px`,
              background: 'currentColor',
              opacity: day.count > 0 ? 0.7 : 0.16,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const StatsBar = memo(StatsBarComponent);
