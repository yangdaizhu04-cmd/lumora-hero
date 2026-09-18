export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export type PhaseStatus = 'idle' | 'running' | 'paused';

export type SceneId =
  | 'golden-hour'
  | 'still-water'
  | 'deep-woods'
  | 'quiet-dawn';

/** 一个可播放的音景层（P1 每场景一层，架构支持多层叠加） */
export interface AudioLayerConfig {
  /** public 目录下的音频路径 */
  src: string;
  /** 该层相对场景的基准音量 0–1 */
  gain: number;
}

export interface Scene {
  id: SceneId;
  label: string;
  videoUrl: string;
  /** 该场景下的 UI 文字颜色 */
  textColor: string;
  /** 音景层，可叠加 */
  layers: AudioLayerConfig[];
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** 每完成多少个番茄进入一次长休 */
  longBreakInterval: number;
  /** 阶段结束后是否自动开始下一段 */
  autoStartNext: boolean;
  /** 0–1 */
  volume: number;
  muted: boolean;
  /** 阶段结束的钟声 */
  chimeEnabled: boolean;
  /** 阶段结束的系统通知 */
  notificationsEnabled: boolean;
}

/** 今日意图（任务） */
export interface Task {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: number;
}

/** 一次完成的专注记录（跳过的不记） */
export interface FocusLogEntry {
  id: string;
  /** 完成时刻的时间戳 */
  finishedAt: number;
  /** 本地日期 YYYY-MM-DD */
  date: string;
  minutes: number;
  taskId: string | null;
  scene: SceneId;
}

export interface DayStat {
  date: string;
  /** YYYY-MM-DD */
  label: string;
  /** 星期几的中文简称，今天显示「今」 */
  weekday: string;
  count: number;
  minutes: number;
}

export interface FocusStats {
  todayCount: number;
  todayMinutes: number;
  /** 连续专注天数 */
  streak: number;
  last7: DayStat[];
}

export type ArchivedTaskStatus = 'done' | 'unfinished';

/** 归档里的任务快照 */
export interface ArchivedTask {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  status: ArchivedTaskStatus;
}

/** 一天的归档记录 */
export interface DayArchive {
  /** YYYY-MM-DD */
  date: string;
  tasks: ArchivedTask[];
  updatedAt: number;
}

/** 回顾面板里的一天（归档 + 日志 + 今日实时数据合成） */
export interface ReviewEntry {
  date: string;
  isToday: boolean;
  focusCount: number;
  focusMinutes: number;
  tasks: ArchivedTask[];
  doneCount: number;
}

export interface PhaseMeta {
  label: string;
  /** 阶段结束时展示的引导语 */
  hint: string;
}

export const PHASE_META: Record<Phase, PhaseMeta> = {
  focus: { label: 'Focus', hint: '该休息了，起身走走' },
  shortBreak: { label: 'Short Break', hint: '回到专注' },
  longBreak: { label: 'Long Break', hint: '回到专注' },
};
