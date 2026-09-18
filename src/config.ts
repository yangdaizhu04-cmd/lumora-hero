/**
 * 集中管理"魔法数字"。
 * 调整体验手感时优先改这里，不要把具体数值散落回业务代码。
 */

export const TIMER = {
  /**
   * 计时循环间隔。状态只在"显示的秒数"变化时才更新，
   * 所以这个值只影响边界精度，不代表渲染频率（见 lib/pomodoroMachine.ts）。
   */
  tickMs: 200,
  /** 进度环补间时长，略小于 1 秒以免追不上下一帧 */
  ringTransitionMs: 950,
} as const;

export const AUDIO = {
  /** 提示音响起时环境音压低到的比例 */
  duckLevel: 0.28,
  /** 场景切换交叉淡化时长（秒） */
  sceneFadeSec: 1.2,
  /** 音量/静音的整体淡入淡出 */
  volumeFadeSec: 0.2,
  /** 解锁时的一次性淡入 */
  unlockFadeSec: 0.4,
  /** 专注结束 / 休息结束的 duck 持续时长 */
  chimeFocusDuckMs: 3200,
  chimeBreakDuckMs: 2200,
  /** 合成 pad 的最大音量（自适应音景用） */
  padMaxLevel: 0.16,
  /** pad 随专注进度爬升到 maxLevel 的比例 */
  padFocusRamp: 1,
  /** 空间化左右游移的频率与幅度 */
  spatialSweepHz: 0.02,
  spatialDepth: 0.18,
  /** 自适应音景：专注后期环境音的轻微收敛比例 */
  adaptiveDip: 0.88,
} as const;

export const UX = {
  /** 阶段提示停留时长 */
  toastMs: 2600,
  /** 抽屉滑动时长 */
  panelSlideMs: 500,
  /** 开始前的准备倒计时（秒），0 表示关闭 */
  ritualSeconds: 3,
  /** 睡眠定时的淡出时长（分钟） */
  sleepFadeMinutes: 10,
  /**
   * 会话恢复窗口：页面关闭/刷新后再次打开，
   * 若阶段结束时间已过去超过这个时长，视为放弃（不补记成绩）
   */
  sessionRestoreWindowMs: 6 * 60 * 60 * 1000,
} as const;

export const LIMITS = {
  /** 专注日志上限 */
  logEntries: 500,
  /** 归档保留天数 */
  archiveDays: 180,
  /** 回顾面板展示天数 */
  reviewDays: 30,
  /** 洞察功能所需的最少记录条数 */
  insightMinEntries: 6,
} as const;
