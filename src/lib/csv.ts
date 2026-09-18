import { SCENE_BY_ID } from '../data/scenes';
import { dayKey } from './stats';
import type { FocusLogEntry } from '../types';

/** CSV 字段转义：含引号 / 逗号 / 换行时用双引号包裹 */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 把专注日志导出成 CSV。
 * 与完整备份 JSON 的分工：备份用于"换设备还原"，CSV 用于"拿去 Excel / Notion 里继续分析"。
 */
export function buildLogCsv(log: FocusLogEntry[]): string {
  const header = ['日期', '完成时间', '专注分钟', '场景', '任务ID', '离开次数'];
  const rows = log.map((entry) => [
    entry.date,
    formatTime(entry.finishedAt),
    String(entry.minutes),
    SCENE_BY_ID[entry.scene]?.label ?? entry.scene,
    entry.taskId ?? '',
    entry.interruptions === undefined ? '' : String(entry.interruptions),
  ]);

  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadLogCsv(log: FocusLogEntry[]): boolean {
  if (log.length === 0) return false;
  // BOM：让 Excel 正确识别 UTF-8 中文表头
  const blob = new Blob(['\uFEFF', buildLogCsv(log)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lumora-focus-${dayKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
