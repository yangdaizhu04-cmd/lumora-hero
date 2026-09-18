import { useCallback, useMemo } from 'react';
import { createId } from '../lib/id';
import { computeStats, dayKey, MAX_LOG_ENTRIES } from '../lib/stats';
import { STORAGE_KEYS, usePersistentState } from '../lib/storage';
import type { FocusLogEntry, FocusStats, SceneId } from '../types';

export interface FocusLogApi {
  log: FocusLogEntry[];
  stats: FocusStats;
  /** 记录一次完成的专注（跳过的不记） */
  addEntry: (minutes: number, taskId: string | null, scene: SceneId) => void;
  clearLog: () => void;
}

export function useFocusLog(): FocusLogApi {
  const [log, setLog] = usePersistentState<FocusLogEntry[]>(
    STORAGE_KEYS.log,
    [],
  );

  const addEntry = useCallback(
    (minutes: number, taskId: string | null, scene: SceneId) => {
      if (minutes <= 0) return;
      const now = new Date();
      const entry: FocusLogEntry = {
        id: createId(),
        finishedAt: now.getTime(),
        date: dayKey(now),
        minutes,
        taskId,
        scene,
      };
      setLog((prev) => [...prev, entry].slice(-MAX_LOG_ENTRIES));
    },
    [setLog],
  );

  const clearLog = useCallback(() => setLog([]), [setLog]);

  const stats = useMemo(() => computeStats(log), [log]);

  return { log, stats, addEntry, clearLog };
}
