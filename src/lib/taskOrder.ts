/**
 * 把拖拽的「插入位置」换算成「移动后的最终索引」。
 *
 * 往下拖时被拖的那一项会先被抽走，它后面的位置整体前移一格，
 * 所以插入位置总比最终索引大 1。不处理这一位的话，拖到相邻位置会看起来"没反应"。
 *
 * 抽出来单独放是因为它是纯计算：DOM 没法在 jsdom 里量（矩形恒为 0），
 * 但这一步是拖拽里最容易写错的地方，必须能被测到。
 *
 * @param fromIndex 被拖项当前所在索引（组内）
 * @param insertAt 指针指向的插入位置（组内，0..组长度）
 * @returns 移动后的目标索引；等于 fromIndex 表示位置没变
 */
export function resolveMoveTarget(fromIndex: number, insertAt: number): number {
  return insertAt > fromIndex ? insertAt - 1 : insertAt;
}
