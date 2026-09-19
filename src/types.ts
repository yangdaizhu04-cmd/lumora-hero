export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export type PhaseStatus = 'idle' | 'running' | 'paused';

/** 计时模式：番茄钟是倒计时，Flowtime 是往上累计 */
export type TimerMode = 'pomodoro' | 'flowtime';

export type SceneId = 'golden-hour' | 'still-water' | 'deep-woods' | 'quiet-dawn';

/** 一个可播放的音景层（架构支持多层叠加） */
export interface AudioLayerConfig {
  /** public 目录下的音频路径 */
  src: string;
  /** 该层相对场景的基准音量 0–1 */
  gain: number;
  /** 空间化基准位置 -1（左）..1（右），不填为居中 */
  pan?: number;
}

/** 混音器里可独立调节的音源 */
export type MixerSourceId = 'rain' | 'waves' | 'wind' | 'stream' | 'crickets' | 'birds';

export interface MixerSource {
  id: MixerSourceId;
  label: string;
  /** public 目录下的音频路径 */
  src: string;
  /**
   * 素材之间的微调增益。
   * 六个文件都做过响度归一化（loudnorm I=-20 LUFS），所以默认都是 1；
   * 留这个字段是为了"哪一层听着偏轻"时能单独补，而不必改素材。
   */
  gain: number;
  /** 空间化基准位置 -1..1 */
  pan: number;
}

export interface Scene {
  id: SceneId;
  label: string;
  videoUrl: string;
  /** 该场景下的 UI 文字颜色 */
  textColor: string;
  /** 音景层，可叠加（含自适应垫层 `BED`，其响度由专注进度单独驱动） */
  layers: AudioLayerConfig[];
  /**
   * 视频不可用时的静态兜底渐变（网络故障 / 省电模式 / 视频加载失败）。
   * 与 overlay 一起收进 Scene：新增场景只改这一处，不会再漏。
   */
  gradient: string;
  /** 保证文字可读的半透明遮罩 */
  overlay: string;
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** 每完成多少个番茄进入一次长休 */
  longBreakInterval: number;
  /** 阶段结束后是否自动开始下一段 */
  autoStartNext: boolean;
  /**
   * Flowtime：不做倒计时，只往上累计实际专注时长，由用户决定何时结束。
   * 适合"进入状态了就不想被打断"的场景；结束时按真实时长记一笔。
   */
  flowtimeMode: boolean;
  /** 0–1 */
  volume: number;
  muted: boolean;
  /** 阶段结束的钟声 */
  chimeEnabled: boolean;
  /** 阶段结束的系统通知 */
  notificationsEnabled: boolean;
  /** 开始前的准备倒计时（3-2-1），给大脑一个"要开始了"的信号 */
  ritualEnabled: boolean;
  /** 阶段变化时自动切换场景：专注→Deep Woods，休息→Still Water */
  autoScene: boolean;
  /** 夜间模式：降低亮度、抑制提示音、偏向 Quiet Dawn */
  nightModeEnabled: boolean;
  /** 夜间模式起始小时 0–23 */
  nightStartHour: number;
  /** 省电模式：用静态渐变代替背景视频 */
  lowPowerMode: boolean;
  /** 自适应音景：无音高的房间底噪垫层随专注进度缓慢渐入 */
  adaptiveSound: boolean;
  /** 垫层强度 0–1（只在自适应音景开启时生效） */
  bedLevel: number;
  /** 空间化：环境音左右缓慢游移 */
  spatialSound: boolean;
  /** 每周目标番茄数（0 表示不设定目标，界面上不显示） */
  weeklyGoal: number;
  /** 自定义混音：开启后用自己搭配的音源取代场景音景 */
  mixerEnabled: boolean;
  /** 各音源音量 0–1（0 = 关闭）。始终存完整对象，读取时按 id 兜底 */
  mixerLevels: Record<MixerSourceId, number>;
}

/** 今日意图（任务） */
export interface Task {
  id: string;
  title: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: number;
  /**
   * 标签，用于按类别统计投入。
   * 声明成可选是因为它是后加的字段 —— 老数据里没有，
   * 这样所有读取处都会被类型系统逼着兜底，而不是拿到 undefined 才崩。
   */
  tags?: string[];
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
  /** 这段专注期间切走标签页的次数（分心自察，被动检测） */
  interruptions?: number;
  /**
   * 专注中**主动打点**的打断原因 id（可重复，一次打断一个）。
   *
   * 与 `interruptions` 是两回事：那个是"切走标签页"的自动计数，
   * 这个回答的是"为什么被打断"。两者都保留，因为它们的漏报/误报方向相反。
   */
  breakReasons?: string[];
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
  /** 同 Task.tags：可选，老归档没有这个字段 */
  tags?: string[];
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
  /** 当天累计离开标签页次数（分心自察） */
  interruptions: number;
  tasks: ArchivedTask[];
  doneCount: number;
}

export interface PhaseMeta {
  label: string;
  /** 阶段结束时展示的引导语 */
  hint: string;
}

/** 中央提示上的可选操作（例如「撤销」删除任务） */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** 中央提示。id 变化即视为一条新提示 */
export interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
}
