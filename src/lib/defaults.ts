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
  adaptiveSound: true,
  spatialSound: true,
};
