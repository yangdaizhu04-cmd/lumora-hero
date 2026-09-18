import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export const STORAGE_KEYS = {
  settings: 'lumora.settings.v1',
  scene: 'lumora.scene.v1',
  tasks: 'lumora.tasks.v1',
  activeTask: 'lumora.activeTask.v1',
  log: 'lumora.log.v1',
  archive: 'lumora.archive.v1',
  lastActiveDay: 'lumora.lastActiveDay.v1',
  session: 'lumora.session.v1',
} as const;

/**
 * 写入失败（配额耗尽 / 隐私模式 / IndexedDB 受限）时派发的事件。
 * 静默丢数据比报个错更糟：订阅方（App）会提示用户导出备份。
 */
export const STORAGE_ERROR_EVENT = 'lumora:storage-error';

/**
 * 暂停持久化。
 *
 * 用于"清空数据"这类操作：清空之后如果还有去抖中的待写值，它们会在 pagehide / 卸载时
 * 被 flush 写回，把刚清掉的数据又装回来。所以清空前先挂起写入。
 */
let persistenceSuspended = false;

export function suspendPersistence(): void {
  persistenceSuspended = true;
}

export function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** @returns 是否写入成功 */
export function writeStorage<T>(key: string, value: T): boolean {
  if (persistenceSuspended) return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    window.dispatchEvent(new Event(STORAGE_ERROR_EVENT));
    return false;
  }
}

/**
 * 落盘去抖时长。
 * 音量 / 垫层强度滑块的每一次 change 都会改 settings，如果每次都 JSON.stringify + setItem，
 * 一次拖动就是上百次同步写盘（主线程 IO）。300ms 足够让一次拖动只写 1 次，
 * 且页面隐藏 / 卸载时会立即 flush，不会丢数据。
 */
const WRITE_DEBOUNCE_MS = 300;

/** 对象类型与默认值浅合并：新增设置项后老数据不会缺字段 */
function hydrate<T>(stored: unknown, initial: T): T {
  if (stored === null || stored === undefined) return initial;
  if (
    typeof initial === 'object' &&
    initial !== null &&
    !Array.isArray(initial) &&
    typeof stored === 'object' &&
    stored !== null &&
    !Array.isArray(stored)
  ) {
    return { ...initial, ...(stored as Record<string, unknown>) } as T;
  }
  return stored as T;
}

/** 与 localStorage 同步的状态 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => hydrate(readStorage<T>(key), initial));

  const valueRef = useRef(value);
  valueRef.current = value;
  const initialRef = useRef(initial);

  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  /** 立即把尚未落盘的值写下去 */
  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    writeStorage(key, valueRef.current);
  }, [key]);

  useEffect(() => {
    dirtyRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      flush();
    }, WRITE_DEBOUNCE_MS);
  }, [value, flush]);

  // 页面隐藏 / 关闭 / 组件卸载：立刻落盘，避免"刚拖完音量就关页面"丢设置
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  /**
   * 多标签页同步：同一份数据在另一个标签页被改动时跟随更新。
   * 没有这一层的话，两个标签会各自 Hold 一份旧副本并在下次写入时互相覆盖，且用户毫无感知。
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      try {
        const incoming = JSON.parse(event.newValue) as unknown;
        setValue((prev) => {
          const current = JSON.stringify(prev);
          if (current === event.newValue) return prev;
          return hydrate(incoming, initialRef.current);
        });
      } catch {
        /* 另一个标签写入的数据损坏时忽略，不打断当前会话 */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, setValue];
}
