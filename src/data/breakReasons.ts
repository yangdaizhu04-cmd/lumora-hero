/**
 * 打断原因。
 *
 * 刻意只有五个、且互不重叠：打点发生在专注被破坏的那一刻，
 * 多一层选择就多一次分神。分不清具体是哪一类时，"其他"永远能用。
 */
export interface BreakReason {
  id: string;
  label: string;
  /** 补一句判断依据，避免用户在两个相近选项之间犹豫 */
  hint: string;
}

export const BREAK_REASONS: BreakReason[] = [
  {
    id: 'external',
    label: '外部打断',
    hint: '别人找你、电话、必须立刻回的消息',
  },
  {
    id: 'drift',
    label: '走神',
    hint: '注意力自己跑了，想起别的事',
  },
  {
    id: 'body',
    label: '身体需要',
    hint: '喝水、起身、去洗手间',
  },
  {
    id: 'switch',
    label: '主动切换',
    hint: '你要去查资料、回消息或换件事做',
  },
  {
    id: 'other',
    label: '其他',
    hint: '说不清是哪一类',
  },
];

/** 原因 id → 展示用的名称；遇到未知 id（老数据）原样显示，不吞掉 */
export function breakReasonLabel(id: string): string {
  return BREAK_REASONS.find((reason) => reason.id === id)?.label ?? id;
}
