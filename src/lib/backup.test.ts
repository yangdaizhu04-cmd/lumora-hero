import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { STORAGE_KEYS } from './storage';

const wrap = (data: unknown) =>
  JSON.stringify({ app: 'lumora-focus', version: 1, exportedAt: '', data });

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
