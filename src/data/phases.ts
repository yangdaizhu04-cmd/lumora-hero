import type { Phase, PhaseMeta } from '../types';

export const PHASE_META: Record<Phase, PhaseMeta> = {
  focus: { label: 'Focus', hint: '该休息了，起身走走' },
  shortBreak: { label: 'Short Break', hint: '回到专注' },
  longBreak: { label: 'Long Break', hint: '回到专注' },
};

/** 阶段顺序，供场景自动编排与调试面板使用 */
export const PHASE_ORDER: Phase[] = ['focus', 'shortBreak', 'longBreak'];
