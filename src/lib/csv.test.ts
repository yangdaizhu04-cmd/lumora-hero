import { describe, expect, it } from 'vitest';
import { buildLogCsv } from './csv';
import type { FocusLogEntry } from '../types';

const base: FocusLogEntry = {
  id: 'a',
  finishedAt: new Date(2026, 8, 16, 9, 5).getTime(),
  date: '2026-09-16',
  minutes: 25,
  taskId: null,
  scene: 'deep-woods',
  interruptions: 2,
};

describe('CSV 导出', () => {
  it('表头与字段顺序稳定', () => {
    const [header, row] = buildLogCsv([base]).split('\r\n');
    expect(header).toBe('日期,完成时间,专注分钟,场景,任务ID,离开次数');
    expect(row).toBe('2026-09-16,09:05,25,Deep Woods,,2');
  });

  it('含逗号 / 引号的字段被正确转义', () => {
    const csv = buildLogCsv([{ ...base, taskId: 'a,"b"' }]);
    expect(csv).toContain('"a,""b"""');
  });

  it('没有采集到分心次数时留空，而不是写 0', () => {
    const withoutInterruptions: FocusLogEntry = {
      id: base.id,
      finishedAt: base.finishedAt,
      date: base.date,
      minutes: base.minutes,
      taskId: base.taskId,
      scene: base.scene,
    };
    const [, row] = buildLogCsv([withoutInterruptions]).split('\r\n');
    expect(row.endsWith(',')).toBe(true);
  });

  it('空日志只输出表头', () => {
    expect(buildLogCsv([])).toBe('日期,完成时间,专注分钟,场景,任务ID,离开次数');
  });
});
