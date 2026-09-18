import { LIMITS } from '../config';
import { SCENE_BY_ID } from '../data/scenes';
import { DEFAULT_SETTINGS } from './defaults';
import { STORAGE_KEYS, suspendPersistence, writeStorage } from './storage';
import type {
  ArchivedTask,
  DayArchive,
  FocusLogEntry,
  PomodoroSettings,
  SceneId,
  Task,
} from '../types';

/**
 * 数据导出 / 导入。
 * 目前数据只存在单台设备的 localStorage 里，导出成文件是最轻量的"备份 + 迁移"手段。
 *
 * 导入侧的校验比"键名白名单"更深一层：**每个键的值都会被逐字段 sanitize**。
 * 因为一份损坏或伪造的备份如果原样写回 localStorage，会让应用在下次启动时读到
 * 结构错误的数据（例如 settings 变成字符串）并直接崩掉 —— 这类问题很难排查，
 * 不如在导入这一刻就把非法字段拒掉、非法值回落到默认。
 */
export interface BackupFile {
  app: 'lumora-focus';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export type ParseResult =
  { ok: true; entries: [string, unknown][] } | { ok: false; reason: string };

const ALLOWED_KEYS = new Set<string>(Object.values(STORAGE_KEYS));
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const PHASES = new Set(['focus', 'shortBreak', 'longBreak']);
const STATUSES = new Set(['idle', 'running', 'paused']);
const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(value, fallback, min, max));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeSettings(value: unknown): PomodoroSettings | null {
  if (!isRecord(value)) return null;
  const fallback = DEFAULT_SETTINGS;
  return {
    focusMinutes: int(value.focusMinutes, fallback.focusMinutes, 5, 120),
    shortBreakMinutes: int(value.shortBreakMinutes, fallback.shortBreakMinutes, 1, 30),
    longBreakMinutes: int(value.longBreakMinutes, fallback.longBreakMinutes, 5, 60),
    longBreakInterval: int(value.longBreakInterval, fallback.longBreakInterval, 2, 8),
    autoStartNext: bool(value.autoStartNext, fallback.autoStartNext),
    volume: num(value.volume, fallback.volume, 0, 1),
    muted: bool(value.muted, fallback.muted),
    chimeEnabled: bool(value.chimeEnabled, fallback.chimeEnabled),
    notificationsEnabled: bool(
      value.notificationsEnabled,
      fallback.notificationsEnabled,
    ),
    ritualEnabled: bool(value.ritualEnabled, fallback.ritualEnabled),
    autoScene: bool(value.autoScene, fallback.autoScene),
    nightModeEnabled: bool(value.nightModeEnabled, fallback.nightModeEnabled),
    nightStartHour: int(value.nightStartHour, fallback.nightStartHour, 0, 23),
    lowPowerMode: bool(value.lowPowerMode, fallback.lowPowerMode),
    adaptiveSound: bool(value.adaptiveSound, fallback.adaptiveSound),
    bedLevel: num(value.bedLevel, fallback.bedLevel, 0, 1),
    spatialSound: bool(value.spatialSound, fallback.spatialSound),
    weeklyGoal: int(value.weeklyGoal, fallback.weeklyGoal, 0, 100),
  };
}

function sanitizeTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id === '') return null;
  if (typeof value.title !== 'string') return null;
  return {
    id: value.id,
    title: value.title.slice(0, 200),
    estimatedPomodoros: int(value.estimatedPomodoros, 1, 1, 99),
    completedPomodoros: int(value.completedPomodoros, 0, 0, 9999),
    done: bool(value.done, false),
    createdAt: num(value.createdAt, Date.now(), 0, MAX_TIMESTAMP),
  };
}

function sanitizeTaskList(value: unknown): Task[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map(sanitizeTask)
    .filter((task): task is Task => task !== null)
    .slice(0, 500);
}

function sanitizeArchivedTask(value: unknown): ArchivedTask | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null;
  if (value.status !== 'done' && value.status !== 'unfinished') return null;
  return {
    id: value.id,
    title: value.title.slice(0, 200),
    estimatedPomodoros: int(value.estimatedPomodoros, 1, 1, 99),
    completedPomodoros: int(value.completedPomodoros, 0, 0, 9999),
    status: value.status,
  };
}

function sanitizeArchive(value: unknown): DayArchive[] | null {
  if (!Array.isArray(value)) return null;
  const days: DayArchive[] = [];
  value.forEach((raw) => {
    if (!isRecord(raw)) return;
    if (typeof raw.date !== 'string' || !DATE_KEY.test(raw.date)) return;
    if (!Array.isArray(raw.tasks)) return;
    days.push({
      date: raw.date,
      tasks: raw.tasks
        .map(sanitizeArchivedTask)
        .filter((task): task is ArchivedTask => task !== null),
      updatedAt: num(raw.updatedAt, 0, 0, MAX_TIMESTAMP),
    });
  });
  return days.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, LIMITS.archiveDays);
}

function sanitizeLog(value: unknown): FocusLogEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: FocusLogEntry[] = [];
  value.forEach((raw) => {
    if (!isRecord(raw)) return;
    if (typeof raw.id !== 'string' || raw.id === '') return;
    if (typeof raw.date !== 'string' || !DATE_KEY.test(raw.date)) return;
    if (
      typeof raw.scene !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SCENE_BY_ID, raw.scene)
    ) {
      return;
    }
    const minutes = int(raw.minutes, 0, 0, 24 * 60);
    if (minutes <= 0) return;

    const entry: FocusLogEntry = {
      id: raw.id,
      finishedAt: num(raw.finishedAt, 0, 0, MAX_TIMESTAMP),
      date: raw.date,
      minutes,
      taskId: typeof raw.taskId === 'string' ? raw.taskId : null,
      scene: raw.scene as SceneId,
    };
    if (typeof raw.interruptions === 'number') {
      entry.interruptions = int(raw.interruptions, 0, 0, 9999);
    }
    entries.push(entry);
  });
  return entries.slice(-LIMITS.logEntries);
}

/** 单个键的 sanitize。返回 undefined 表示这条数据不可用，直接丢弃 */
function sanitizeValue(key: string, value: unknown): unknown {
  switch (key) {
    case STORAGE_KEYS.settings:
      return sanitizeSettings(value) ?? undefined;
    case STORAGE_KEYS.scene:
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.trunc(value))
        : undefined;
    case STORAGE_KEYS.tasks:
      return sanitizeTaskList(value) ?? undefined;
    case STORAGE_KEYS.activeTask:
      return value === null || typeof value === 'string' ? value : undefined;
    case STORAGE_KEYS.log:
      return sanitizeLog(value) ?? undefined;
    case STORAGE_KEYS.archive:
      return sanitizeArchive(value) ?? undefined;
    case STORAGE_KEYS.lastActiveDay:
      return typeof value === 'string' && DATE_KEY.test(value) ? value : undefined;
    // 会话的结构由 rehydrateSession 校验（非法数据会退回初始状态），这里只挡住非对象
    case STORAGE_KEYS.session:
      return isRecord(value) &&
        PHASES.has(String(value.phase)) &&
        STATUSES.has(String(value.status))
        ? value
        : undefined;
    default:
      return undefined;
  }
}

/** 校验并解析备份文本（纯函数，便于测试） */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: '不是合法的 JSON 文件' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: '文件内容为空' };
  }

  const backup = parsed as Partial<BackupFile>;
  if (backup.app !== 'lumora-focus') {
    return { ok: false, reason: '不是 Lumora 的备份文件' };
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return { ok: false, reason: '备份里没有数据段' };
  }

  const entries = Object.entries(backup.data).filter(([key]) =>
    ALLOWED_KEYS.has(key),
  ) as [string, unknown][];

  if (entries.length === 0) {
    return { ok: false, reason: '备份里没有可识别的数据' };
  }

  return { ok: true, entries };
}

export function collectBackup(): BackupFile {
  const data: Record<string, unknown> = {};
  ALLOWED_KEYS.forEach((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      /* 跳过损坏项，不让整个备份失败 */
    }
  });

  return {
    app: 'lumora-focus',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(): void {
  const backup = collectBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lumora-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ApplyResult {
  written: number;
  skipped: number;
}

export function applyBackup(entries: [string, unknown][]): ApplyResult {
  let written = 0;
  let skipped = 0;

  entries.forEach(([key, value]) => {
    const clean = sanitizeValue(key, value);
    if (clean === undefined) {
      skipped += 1;
      return;
    }
    if (writeStorage(key, clean)) written += 1;
    else skipped += 1;
  });

  return { written, skipped };
}

export function importBackup(text: string): { ok: boolean; message: string } {
  const parsed = parseBackup(text);
  if (!parsed.ok) return { ok: false, message: parsed.reason };

  const { written, skipped } = applyBackup(parsed.entries);
  if (written === 0) {
    return { ok: false, message: '没有可导入的有效数据' };
  }

  const skippedHint = skipped > 0 ? `，跳过 ${skipped} 项无法识别的数据` : '';
  return { ok: true, message: `已导入 ${written} 项数据${skippedHint}，刷新后生效` };
}

/** 清空全部 Lumora 数据（错误恢复兜底 / 用户主动删除） */
export function clearAllData(): void {
  // 先挂起写入：否则去抖中的待写值会在 pagehide 时把数据写回来
  suspendPersistence();
  ALLOWED_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* 忽略 */
    }
  });
}
