import type { PomodoroSettings } from '../types';

/**
 * 专注法预设：把四个时长参数打包成"一键切换的工作节奏"。
 *
 * 只打包时长与长休间隔 —— 音量、场景、垫层那些是"环境偏好"，
 * 换节奏时不该被动过。同一个用户在不同场景下用不同节奏，
 * 但环境设置应该保持不变。
 */
export interface FocusMethod {
  id: string;
  label: string;
  /** 一句话说明适用场景，而不是复述数字 */
  hint: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
}

export const FOCUS_METHODS: FocusMethod[] = [
  {
    id: 'classic',
    label: '经典番茄',
    hint: '最常见的节奏，适合大多数任务',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
  },
  {
    id: 'deep',
    label: '深度工作',
    hint: '大块时间处理需要沉浸的事',
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    longBreakInterval: 3,
  },
  {
    id: 'sprint',
    label: '短冲刺',
    hint: '状态不好时，先让自己启动起来',
    focusMinutes: 15,
    shortBreakMinutes: 3,
    longBreakMinutes: 10,
    longBreakInterval: 4,
  },
  {
    id: 'cycle',
    label: '完整周期',
    hint: '一个接近自然注意力的长时段',
    focusMinutes: 90,
    shortBreakMinutes: 20,
    longBreakMinutes: 30,
    longBreakInterval: 2,
  },
];

/** 预设只管这四个字段，其余设置原样保留 */
export function methodPatch(method: FocusMethod): Partial<PomodoroSettings> {
  return {
    focusMinutes: method.focusMinutes,
    shortBreakMinutes: method.shortBreakMinutes,
    longBreakMinutes: method.longBreakMinutes,
    longBreakInterval: method.longBreakInterval,
  };
}

/**
 * 当前设置对应哪个预设。
 *
 * 四个字段全中才算匹配 —— 用户手调过任意一个就不再算"在用这个预设"，
 * 此时界面上不该继续高亮它，否则会让人以为改动没生效。
 */
export function matchFocusMethod(
  settings: Pick<
    PomodoroSettings,
    'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval'
  >,
): FocusMethod | null {
  return (
    FOCUS_METHODS.find(
      (method) =>
        method.focusMinutes === settings.focusMinutes &&
        method.shortBreakMinutes === settings.shortBreakMinutes &&
        method.longBreakMinutes === settings.longBreakMinutes &&
        method.longBreakInterval === settings.longBreakInterval,
    ) ?? null
  );
}
