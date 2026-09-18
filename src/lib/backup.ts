import { dayKey } from './stats';
import { STORAGE_KEYS } from './storage';

/**
 * 数据导出 / 导入。
 * 目前数据只存在单台设备的 localStorage 里，导出成文件是最轻量的"备份 + 迁移"手段。
 */
export interface BackupFile {
  app: 'lumora-focus';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export type ParseResult =
  | { ok: true; entries: [string, unknown][] }
  | { ok: false; reason: string };

const ALLOWED_KEYS = new Set<string>(Object.values(STORAGE_KEYS));

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
  link.download = `lumora-backup-${dayKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function applyBackup(entries: [string, unknown][]): number {
  let written = 0;
  entries.forEach(([key, value]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      written += 1;
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  });
  return written;
}

export function importBackup(text: string): { ok: boolean; message: string } {
  const parsed = parseBackup(text);
  if (!parsed.ok) return { ok: false, message: parsed.reason };

  const written = applyBackup(parsed.entries);
  return {
    ok: written > 0,
    message:
      written > 0 ? `已导入 ${written} 项数据，刷新后生效` : '没有写入任何数据',
  };
}
