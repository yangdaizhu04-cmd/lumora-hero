import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export const STORAGE_KEYS = {
  settings: 'lumora.settings.v1',
  scene: 'lumora.scene.v1',
  tasks: 'lumora.tasks.v1',
  activeTask: 'lumora.activeTask.v1',
  log: 'lumora.log.v1',
  archive: 'lumora.archive.v1',
  lastActiveDay: 'lumora.lastActiveDay.v1',
} as const;

export function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式等场景下静默失败，不影响主流程 */
  }
}

/** 与 localStorage 同步的状态 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = readStorage<T>(key);
    if (stored === null) return initial;
    // 对象类型做一次浅合并，避免新增字段后旧数据缺字段
    if (
      typeof initial === 'object' &&
      initial !== null &&
      !Array.isArray(initial) &&
      typeof stored === 'object' &&
      stored !== null
    ) {
      return { ...initial, ...stored } as T;
    }
    return stored;
  });

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
