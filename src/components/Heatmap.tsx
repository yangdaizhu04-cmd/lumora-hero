import { buildHeatmap } from '../lib/stats';
import type { FocusLogEntry } from '../types';

interface Props {
  log: FocusLogEntry[];
  /** 分钟级时钟（与统计保持同一时间基准） */
  now: number;
}

const WEEKS = 12;

/** 近 12 周的专注热力图：数据全在本地，纯计算，不需要任何后端 */
export function Heatmap({ log, now }: Props) {
  const { cells, max } = buildHeatmap(log, WEEKS, new Date(now));

  // cells 是行优先排列：每 7 个一列（周一 → 周日）
  const columns: (typeof cells)[number][][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    columns.push(cells.slice(index, index + 7));
  }

  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">专注热力图</span>
        <span className="shrink-0 text-[11px] text-white/40">
          {max > 0 ? `单日最多 ${max} 个` : '还没有数据'}
        </span>
      </div>

      <div className="no-scrollbar mt-2 flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-[3px]">
            {column.map((cell) => {
              const intensity = max > 0 ? cell.count / max : 0;
              return (
                <span
                  key={cell.date}
                  title={
                    cell.future
                      ? undefined
                      : `${cell.date} · ${cell.count} 个番茄 · ${cell.minutes} 分钟`
                  }
                  className="h-[9px] w-[9px] shrink-0 rounded-[2px]"
                  style={{
                    background: 'currentColor',
                    opacity: cell.future
                      ? 0.04
                      : cell.count === 0
                        ? 0.1
                        : 0.3 + Math.min(0.65, intensity * 0.65),
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-1 text-[10px] text-white/30">
        每列一周（周一 → 周日），越亮表示当天完成的番茄越多
      </p>
    </div>
  );
}
