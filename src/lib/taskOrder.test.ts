import { describe, expect, it } from 'vitest';
import { resolveMoveTarget } from './taskOrder';

describe('拖拽落点换算', () => {
  it('往上拖：插入位置就是最终索引', () => {
    // [A, B, C] 把 C 拖到 A 的上方
    expect(resolveMoveTarget(2, 0)).toBe(0);
    // 把 B 拖到 A 的上方
    expect(resolveMoveTarget(1, 0)).toBe(0);
  });

  it('往下拖：要减 1（自己先被抽走，后面的位置整体前移）', () => {
    // [A, B, C] 把 A 拖到 C 的下方（插入位置是末尾 3）
    expect(resolveMoveTarget(0, 3)).toBe(2);
    // 把 A 拖到 B 的下方（插入位置 2）
    expect(resolveMoveTarget(0, 2)).toBe(1);
  });

  it('拖到自己的位置：最终索引不变，调用方据此跳过写入', () => {
    expect(resolveMoveTarget(1, 1)).toBe(1);
    // 插到自己紧后面也等于没动
    expect(resolveMoveTarget(0, 1)).toBe(0);
    expect(resolveMoveTarget(2, 3)).toBe(2);
  });
});
