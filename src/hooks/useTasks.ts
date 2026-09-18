import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LIMITS } from '../config';
import { createId } from '../lib/id';
import { dayKey } from '../lib/stats';
import { STORAGE_KEYS, usePersistentState } from '../lib/storage';
import type { ArchivedTask, ArchivedTaskStatus, DayArchive, Task } from '../types';

export interface RolloverInfo {
  /** 刚刚结束的那一天 */
  endedDay: string;
  /** 顺延到新一天的任务数 */
  carried: number;
}

export interface TasksApi {
  tasks: Task[];
  archive: DayArchive[];
  activeTaskId: string | null;
  activeTask: Task | null;
  /** 未完成的任务数 */
  remainingCount: number;
  addTask: (title: string, estimatedPomodoros?: number) => void;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  /** 一个专注完成：给进行中的任务 +1 */
  completePomodoro: () => void;
  clearCompleted: () => void;
}

interface Options {
  /** 跨天归档发生时回调（用于提示用户） */
  onRollover?: (info: RolloverInfo) => void;
}

function toArchived(task: Task, status: ArchivedTaskStatus): ArchivedTask {
  return {
    id: task.id,
    title: task.title,
    estimatedPomodoros: task.estimatedPomodoros,
    completedPomodoros: task.completedPomodoros,
    status,
  };
}

/** 写入某天的归档，按 id 覆盖合并 */
function upsertArchiveTasks(
  archive: DayArchive[],
  date: string,
  tasks: ArchivedTask[],
): DayArchive[] {
  if (tasks.length === 0) return archive;

  const index = archive.findIndex((day) => day.date === date);
  const base: DayArchive =
    index >= 0 ? archive[index] : { date, tasks: [], updatedAt: 0 };

  const incoming = new Map(tasks.map((task) => [task.id, task]));
  const merged = base.tasks.map((task) => incoming.get(task.id) ?? task);
  const known = new Set(base.tasks.map((task) => task.id));
  tasks.forEach((task) => {
    if (!known.has(task.id)) merged.push(task);
  });

  const nextEntry: DayArchive = { ...base, tasks: merged, updatedAt: Date.now() };
  const next =
    index >= 0
      ? archive.map((day, i) => (i === index ? nextEntry : day))
      : [...archive, nextEntry];

  return pruneArchive(next);
}

function removeArchiveTask(
  archive: DayArchive[],
  date: string,
  id: string,
): DayArchive[] {
  const index = archive.findIndex((day) => day.date === date);
  if (index < 0) return archive;
  const day = archive[index];
  if (!day.tasks.some((task) => task.id === id)) return archive;

  const next = [...archive];
  next[index] = {
    ...day,
    tasks: day.tasks.filter((task) => task.id !== id),
    updatedAt: Date.now(),
  };
  return next;
}

function pruneArchive(archive: DayArchive[]): DayArchive[] {
  if (archive.length <= LIMITS.archiveDays) return archive;
  return [...archive]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, LIMITS.archiveDays);
}

/**
 * 今日意图 + 按天归档。
 *
 * 归档策略：
 * - 任务被勾选完成的当下就写入「当天」归档（所以「清除已完成」不会丢失记录）
 * - 跨天时把仍未完成的任务记为「未完成」，并把已完成的任务从工作列表移除
 * - 未完成的任务自动顺延到新的一天
 */
export function useTasks(options: Options = {}): TasksApi {
  const [tasks, setTasks] = usePersistentState<Task[]>(STORAGE_KEYS.tasks, []);
  const [archive, setArchive] = usePersistentState<DayArchive[]>(
    STORAGE_KEYS.archive,
    [],
  );
  const [activeTaskId, setActiveTaskId] = usePersistentState<string | null>(
    STORAGE_KEYS.activeTask,
    null,
  );
  const [lastActiveDay, setLastActiveDay] = usePersistentState<string>(
    STORAGE_KEYS.lastActiveDay,
    dayKey(new Date()),
  );

  // 供回调读取最新值，避免把它们放进依赖里反复重建
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const onRolloverRef = useRef(options.onRollover);
  onRolloverRef.current = options.onRollover;

  const activeTask = useMemo(() => {
    const found = tasks.find((task) => task.id === activeTaskId);
    return found && !found.done ? found : null;
  }, [tasks, activeTaskId]);

  const remainingCount = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks],
  );

  const addTask = useCallback(
    (title: string, estimatedPomodoros = 1) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      const task: Task = {
        id: createId(),
        title: trimmed,
        estimatedPomodoros: Math.max(1, Math.round(estimatedPomodoros)),
        completedPomodoros: 0,
        done: false,
        createdAt: Date.now(),
      };

      setTasks((prev) => [...prev, task]);
      // 没有进行中的任务时，新任务自动成为进行中
      setActiveTaskId((prev) => prev ?? task.id);
    },
    [setTasks, setActiveTaskId],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const task = tasksRef.current.find((item) => item.id === id);
      if (!task) return;

      const willBeDone = !task.done;
      const today = dayKey(new Date());

      setTasks((prev) =>
        prev.map((item) => (item.id === id ? { ...item, done: willBeDone } : item)),
      );

      if (willBeDone) {
        setArchive((prev) =>
          upsertArchiveTasks(prev, today, [toArchived(task, 'done')]),
        );
        // 完成的任务不再接收番茄计数
        setActiveTaskId((prev) => (prev === id ? null : prev));
      } else {
        setArchive((prev) => removeArchiveTask(prev, today, id));
      }
    },
    [setTasks, setArchive, setActiveTaskId],
  );

  const removeTask = useCallback(
    (id: string) => {
      const today = dayKey(new Date());
      setTasks((prev) => prev.filter((task) => task.id !== id));
      setArchive((prev) => removeArchiveTask(prev, today, id));
      setActiveTaskId((prev) => (prev === id ? null : prev));
    },
    [setTasks, setArchive, setActiveTaskId],
  );

  const setActiveTask = useCallback(
    (id: string | null) => setActiveTaskId(id),
    [setActiveTaskId],
  );

  const completePomodoro = useCallback(() => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === activeTaskId && !task.done
          ? { ...task, completedPomodoros: task.completedPomodoros + 1 }
          : task,
      ),
    );
  }, [activeTaskId, setTasks]);

  const clearCompleted = useCallback(() => {
    // 已完成的任务在勾选时就已归档，这里只清理工作列表
    setTasks((prev) => prev.filter((task) => !task.done));
  }, [setTasks]);

  /** 跨天归档：未完成的顺延，已完成的移出工作列表 */
  const rollover = useCallback(
    (endedDay: string) => {
      const snapshot = tasksRef.current;
      const open = snapshot.filter((task) => !task.done);
      const finished = snapshot.filter((task) => task.done);

      if (open.length > 0) {
        setArchive((prev) =>
          upsertArchiveTasks(
            prev,
            endedDay,
            open.map((task) => toArchived(task, 'unfinished')),
          ),
        );
      }

      if (finished.length > 0) {
        setTasks((prev) => prev.filter((task) => !task.done));
      }

      return open.length;
    },
    [setArchive, setTasks],
  );

  const lastActiveDayRef = useRef(lastActiveDay);

  useEffect(() => {
    const checkDay = () => {
      const today = dayKey(new Date());
      const previous = lastActiveDayRef.current;
      if (today === previous) return;

      lastActiveDayRef.current = today;
      setLastActiveDay(today);

      const carried = rollover(previous);
      onRolloverRef.current?.({ endedDay: previous, carried });
    };

    // 挂载时立即检查一次：应用关了几天再打开也能正确归档
    checkDay();
    const timer = window.setInterval(checkDay, 30_000);
    document.addEventListener('visibilitychange', checkDay);
    window.addEventListener('focus', checkDay);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkDay);
      window.removeEventListener('focus', checkDay);
    };
  }, [rollover, setLastActiveDay]);

  return {
    tasks,
    archive,
    activeTaskId,
    activeTask,
    remainingCount,
    addTask,
    toggleDone,
    removeTask,
    setActiveTask,
    completePomodoro,
    clearCompleted,
  };
}
