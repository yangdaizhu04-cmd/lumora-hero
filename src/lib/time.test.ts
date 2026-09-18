import { describe, expect, it } from 'vitest';
import { clamp, formatClock, minutesToMs } from './time';

describe('formatClock', () => {
  it('向上取整到整秒，避免 24:59 提前跳变', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(999)).toBe('00:01');
    expect(formatClock(1000)).toBe('00:01');
    expect(formatClock(59_999)).toBe('01:00');
    expect(formatClock(60_000)).toBe('01:00');
  });

  it('超过一小时显示 h:mm:ss', () => {
    expect(formatClock(3_599_999)).toBe('1:00:00');
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });

  it('负数按 0 处理（暂停在边界上不该出现 -00:01）', () => {
    expect(formatClock(-1)).toBe('00:00');
    expect(formatClock(-60_000)).toBe('00:00');
  });
});

describe('minutesToMs', () => {
  it('分钟转毫秒', () => {
    expect(minutesToMs(0)).toBe(0);
    expect(minutesToMs(1)).toBe(60_000);
    expect(minutesToMs(25)).toBe(1_500_000);
    expect(minutesToMs(0.5)).toBe(30_000);
  });
});

describe('clamp', () => {
  it('夹在区间内', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(99, 1, 10)).toBe(10);
    expect(clamp(-3, -5, 5)).toBe(-3);
  });
});
