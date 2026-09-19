import { LIMITS } from '../config';

/**
 * 收敛一组标签：去空白、去重、截断过长、限制数量。
 *
 * 界面上解析输入、写入前归一化、备份导入三条路径共用它，
 * 免得"输入框里限制了 5 个，导入却能塞进 50 个"。
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  tags.forEach((raw) => {
    const tag = raw.trim().slice(0, LIMITS.maxTagLength);
    if (tag) seen.add(tag);
  });
  return Array.from(seen).slice(0, LIMITS.maxTags);
}

/**
 * 解析标签输入。
 *
 * 逗号、顿号、分号、空格都当分隔符 —— 中文输入法下用户很自然会打出「，」和「、」，
 * 只认英文逗号会让人觉得"打了却没生效"。
 */
export function parseTags(input: string): string[] {
  return normalizeTags(input.split(/[,，、;；\s]+/));
}

/** 标签数组 → 输入框里的文本（空格分隔，与 parseTags 对称） */
export function formatTags(tags: string[] | undefined): string {
  return (tags ?? []).join(' ');
}

/** 取任务上的标签，兜住老数据里没有这个字段的情况 */
export function taskTags(tags: string[] | undefined): string[] {
  return tags ?? [];
}
