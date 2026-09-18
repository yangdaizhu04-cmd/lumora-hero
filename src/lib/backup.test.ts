// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, parseBackup } from './backup';
import { DEFAULT_SETTINGS } from './defaults';
import { STORAGE_KEYS } from './storage';

const wrap = (data: unknown) =>
  JSON.stringify({ app: 'lumora-focus', version: 1, exportedAt: '', data });

const read = <T>(key: string): T | null => {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
};

describe('备份解析', () => {
  it('拒绝非 JSON 文本', () => {
    const result = parseBackup('这不是 json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('JSON');
  });

  it('拒绝其他应用的文件', () => {
    const result = parseBackup(JSON.stringify({ app: 'other', data: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Lumora');
  });

  it('没有数据段时拒绝', () => {
    const result = parseBackup(JSON.stringify({ app: 'lumora-focus' }));
    expect(result.ok).toBe(false);
  });

  it('只接受已知的存储键，忽略陌生字段', () => {
    const result = parseBackup(
      wrap({
        [STORAGE_KEYS.tasks]: [{ id: 'a', title: '写方案', done: false }],
        'evil.key': 'should be ignored',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0][0]).toBe(STORAGE_KEYS.tasks);
    }
  });

  it('全是陌生字段时视为无有效数据', () => {
    const result = parseBackup(wrap({ 'evil.key': 1, 'another.key': 2 }));
    expect(result.ok).toBe(false);
  });
});

/**
 * 这些用例防的是同一类事故：一份损坏 / 伪造的备份被原样写回 localStorage，
 * 下次启动读到结构错误的数据直接崩掉。校验必须落在"值"上，而不只是"键名"。
 */
describe('导入时的逐字段校验', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('settings 不是对象时整体丢弃，不写坏数据', () => {
    const result = applyBackup([[STORAGE_KEYS.settings, 'not-an-object']]);
    expect(result).toEqual({ written: 0, skipped: 1 });
    expect(read(STORAGE_KEYS.settings)).toBeNull();
  });

  it('settings 缺字段按默认值补齐，越界数值收敛到合法区间', () => {
    const result = applyBackup([
      [STORAGE_KEYS.settings, { volume: 99, focusMinutes: 999, muted: 'yes' }],
    ]);
    expect(result.written).toBe(1);

    const stored = read<typeof DEFAULT_SETTINGS>(STORAGE_KEYS.settings)!;
    expect(stored.volume).toBe(1);
    expect(stored.focusMinutes).toBe(120);
    expect(stored.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(stored.weeklyGoal).toBe(DEFAULT_SETTINGS.weeklyGoal);
  });

  it('任务数组里的非法项被过滤，合法项保留', () => {
    const result = applyBackup([
      [STORAGE_KEYS.tasks, [{ id: 'ok', title: '写方案' }, { title: '缺 id' }, '垃圾']],
    ]);
    expect(result.written).toBe(1);

    const stored = read<{ id: string }[]>(STORAGE_KEYS.tasks)!;
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('ok');
  });

  it('日志里未知场景 / 非正时长的记录被丢弃', () => {
    const valid = {
      id: 'a',
      finishedAt: 1,
      date: '2026-09-18',
      minutes: 25,
      taskId: null,
      scene: 'deep-woods',
    };
    const result = applyBackup([
      [
        STORAGE_KEYS.log,
        [
          valid,
          { ...valid, id: 'b', scene: 'not-a-scene' },
          { ...valid, id: 'c', minutes: 0 },
        ],
      ],
    ]);
    expect(result.written).toBe(1);

    const stored = read<{ id: string }[]>(STORAGE_KEYS.log)!;
    expect(stored.map((entry) => entry.id)).toEqual(['a']);
  });

  it('日期格式非法时丢弃该键', () => {
    const result = applyBackup([[STORAGE_KEYS.lastActiveDay, '2026/09/18']]);
    expect(result).toEqual({ written: 0, skipped: 1 });
  });

  it('场景索引不是数字时丢弃', () => {
    expect(applyBackup([[STORAGE_KEYS.scene, 'third']]).written).toBe(0);
    expect(applyBackup([[STORAGE_KEYS.scene, 2]]).written).toBe(1);
    expect(read(STORAGE_KEYS.scene)).toBe(2);
  });
});
