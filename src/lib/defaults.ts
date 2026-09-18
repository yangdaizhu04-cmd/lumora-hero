import type { PomodoroSettings } from '../types';

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
  volume: 0.7,
  muted: false,
  chimeEnabled: true,
  notificationsEnabled: false,
  ritualEnabled: true,
  autoScene: false,
  nightModeEnabled: false,
  nightStartHour: 22,
  lowPowerMode: false,
  // 垫层默认关闭：它是"锦上添花"的氛围层，应该由用户主动选择，
  // 而不是没选就听到（上一版合成低频长音就是默认开着，听感上很打扰）
  adaptiveSound: false,
  // 默认强度偏保守（约 -13dB，相对环境音），要更厚可以在设置里调
  bedLevel: 0.18,
  spatialSound: true,
  // 每周目标：0 = 不设定（统计条上不显示），要追踪目标可以在设置里改成 5 的倍数
  weeklyGoal: 20,
};
