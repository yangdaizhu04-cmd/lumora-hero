import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LIMITS } from '../config';
import { createId } from '../lib/id';
import { dayKey } from '../lib/stats';
import { STORAGE_KEYS, usePersistentState } from '../lib/storage';
import { normalizeTags } from '../lib/tags';
import { clamp } from '../lib/time';
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
  /** 编辑任务。字段都可选，只改传进来的部分 */
  updateTask: (
    id: string,
    patch: { title?: string; estimatedPomodoros?: number; tags?: string[] },
  ) => void;
  /**
   * 在**同一分组内**移动任务（未完成组内排序）。
   * `toIndex` 是移动后的目标位置，用组内索引（0 起），越界会被夹到边界。
   */
  moveTask: (id: string, toIndex: number) => void;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  /** 撤销"最近一次删除"（恢复任务与它当天的归档记录） */
  undoRemove: () => void;
  setActiveTask: (id: string | null) => void;
  /** 一个专注完成：给进行中的任务 +1 */
  completePomodoro: () => void;
  clearCompleted: () => void;
}

interface Options {
  /** 跨天归档发生时回调（用于提示用户） */
  onRollover?: (info: RolloverInfo) => void;
}

/**
 * 预估番茄数归一化：夹到 `[1, LIMITS.taskEstimate]` 并取整。
 *
 * 返回 `null` 表示"这个值不可用"，由调用方决定退回默认值（新建）还是忽略（编辑）——
 * 不在这里悄悄替换成 1：把 NaN 变成"1 个番茄"会得到一个**看起来正常**的坏数据，
 * 比明显的错误更难发现。
 */
function normalizeEstimate(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return clamp(Math.round(value), 1, LIMITS.taskEstimate);
}

function toArchived(task: Task, status: ArchivedTaskStatus): ArchivedTask {
  return {
    id: task.id,
    title: task.title,
    estimatedPomodoros: task.estimatedPomodoros,
    completedPomodoros: task.completedPomodoros,
    status,
    // 归档快照要带上标签：按标签统计时历史任务也要能归到类别里
    tags: task.tags ?? [],
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
        // 脏输入退回默认值：新建总得有一个数，这里没有"忽略"的余地
        estimatedPomodoros: normalizeEstimate(estimatedPomodoros) ?? 1,
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

  const updateTask = useCallback(
    (
      id: string,
      patch: { title?: string; estimatedPomodoros?: number; tags?: string[] },
    ) => {
      const task = tasksRef.current.find((item) => item.id === id);
      if (!task) return;

      const title = patch.title?.trim();
      // 脏输入按"没提供"处理：局部更新的语义下，无效字段就等于没传这个字段
      const estimate =
        patch.estimatedPomodoros === undefined
          ? null
          : normalizeEstimate(patch.estimatedPomodoros);
      // 空标题不作为"清空标题"处理 —— 那会让列表里出现点不到的行
      if (!title && estimate === null && patch.tags === undefined) return;

      const next: Task = {
        ...task,
        ...(title ? { title } : {}),
        ...(estimate !== null ? { estimatedPomodoros: estimate } : {}),
        // 空数组是合法值（清空标签），所以这里只判断 undefined
        ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
      };

      setTasks((prev) => prev.map((item) => (item.id === id ? next : item)));

      // 已完成的任务在归档里也有一份快照，必须一起改 ——
      // 否则「回顾」里显示的还是旧标题，同一个任务在两处不一致。
      //
      // 日期取它**实际归档的那一天**，而不是"今天"：跨天瞬间（比如 23:59 完成、
      // 00:00 编辑）写"今天"会凭空多出一条新日期的记录，同一个任务在两天的回顾里各出现一次。
      // 找不到归档记录就什么都不做 —— 已完成却不在归档里，本身就该由跨天归档去补，不该在这里造。
      if (next.done) {
        setArchive((prev) => {
          const date = prev.find((day) =>
            day.tasks.some((item) => item.id === id),
          )?.date;
          if (!date) return prev;
          return upsertArchiveTasks(prev, date, [toArchived(next, 'done')]);
        });
      }
    },
    [setTasks, setArchive],
  );

  /**
   * 组内排序。
   *
   * 直接重排数组而不是给任务加 `order` 字段：数组顺序本来就是显示顺序，
   * 多一个字段就多一处要同步的地方（归档、导入、跨天顺延都会碰到它）。
   * 排序只在同一分组内进行 —— 未完成与已完成之间没有"顺序"可言，
   * 让它们互窜只会让列表看起来跳错了位置（勾选 / 取消勾选才是跨组的唯一方式）。
   */
  const moveTask = useCallback(
    (id: string, toIndex: number) => {
      setTasks((prev) => {
        const anchor = prev.find((item) => item.id === id);
        if (!anchor) return prev;

        // 脏坐标（NaN / Infinity / 非数字）直接放弃这次移动。
        // 放它进 clamp 会被当成 0 —— 也就是把任务悄悄挪到最前，
        // 那比"什么都没发生"更像是界面出了问题。
        if (!Number.isFinite(toIndex)) return prev;

        const group = prev.filter((item) => item.done === anchor.done);
        const from = group.findIndex((item) => item.id === id);
        const to = clamp(Math.trunc(toIndex), 0, group.length - 1);
        if (from === to) return prev;

        const reordered = [...group];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);

        // 按位置把重排后的同组序列写回，另一组原样保留
        let cursor = 0;
        return prev.map((item) =>
          item.done === anchor.done ? reordered[cursor++] : item,
        );
      });
    },
    [setTasks],
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

  /**
   * 最近一次删除的快照。
   * 删除任务是不可逆的破坏性操作，但它通常发生在"列表里顺手清理"时 ——
   * 记下快照就能给一个撤销窗口，比弹确认框打断操作更合适。
   */
  const lastRemovedRef = useRef<{ task: Task; date: string } | null>(null);

  const removeTask = useCallback(
    (id: string) => {
      const task = tasksRef.current.find((item) => item.id === id);
      if (!task) return;

      const today = dayKey(new Date());
      lastRemovedRef.current = { task, date: today };

      setTasks((prev) => prev.filter((item) => item.id !== id));
      setArchive((prev) => removeArchiveTask(prev, today, id));
      setActiveTaskId((prev) => (prev === id ? null : prev));
    },
    [setTasks, setArchive, setActiveTaskId],
  );

  const undoRemove = useCallback(() => {
    const snapshot = lastRemovedRef.current;
    if (!snapshot) return;
    lastRemovedRef.current = null;

    const { task, date } = snapshot;
    setTasks((prev) =>
      prev.some((item) => item.id === task.id) ? prev : [...prev, task],
    );
    // 已完成的任务在勾选时入过档，删除时被一并移除 —— 撤销要把它放回去
    if (task.done) {
      setArchive((prev) => upsertArchiveTasks(prev, date, [toArchived(task, 'done')]));
    }
  }, [setTasks, setArchive]);

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
    updateTask,
    moveTask,
    toggleDone,
    removeTask,
    undoRemove,
    setActiveTask,
    completePomodoro,
    clearCompleted,
  };
}
