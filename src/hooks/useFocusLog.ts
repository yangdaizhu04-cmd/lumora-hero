import { useCallback, useMemo } from 'react';
import { LIMITS } from '../config';
import { createId } from '../lib/id';
import { computeStats, dayKey } from '../lib/stats';
import { STORAGE_KEYS, usePersistentState } from '../lib/storage';
import type { FocusLogEntry, FocusStats, SceneId } from '../types';

export interface FocusLogApi {
  log: FocusLogEntry[];
  stats: FocusStats;
  /** 记录一次完成的专注（跳过的不记）。interruptions 缺省表示这段没有采集到 */
  addEntry: (
    minutes: number,
    taskId: string | null,
    scene: SceneId,
    interruptions?: number,
    /** 主动打点的打断原因；空数组会被省略，不往日志里塞空字段 */
    breakReasons?: string[],
  ) => void;
  clearLog: () => void;
}

/**
 * @param now 由调用方传入"当前的分钟级时钟"（App 里的 useClockTick）。
 *   统计与"今日"强相关，如果只依赖渲染时刻的时间，页面跨零点常开时数据不会滚到新的一天。
 */
export function useFocusLog(now: number): FocusLogApi {
  const [log, setLog] = usePersistentState<FocusLogEntry[]>(STORAGE_KEYS.log, []);

  const addEntry = useCallback(
    (
      minutes: number,
      taskId: string | null,
      scene: SceneId,
      interruptions?: number,
      breakReasons?: string[],
    ) => {
      if (minutes <= 0) return;
      const now = new Date();
      const entry: FocusLogEntry = {
        id: createId(),
        finishedAt: now.getTime(),
        date: dayKey(now),
        minutes,
        taskId,
        scene,
        ...(interruptions === undefined ? {} : { interruptions }),
        // 没打点就不写这个字段：空数组会让"这段没采集"和"采集了但一次都没有"分不清
        ...(breakReasons && breakReasons.length > 0 ? { breakReasons } : {}),
      };
      setLog((prev) => [...prev, entry].slice(-LIMITS.logEntries));
    },
    [setLog],
  );

  const clearLog = useCallback(() => setLog([]), [setLog]);

  const stats = useMemo(() => computeStats(log, new Date(now)), [log, now]);

  return { log, stats, addEntry, clearLog };
}
