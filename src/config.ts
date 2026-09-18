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
  /** 计时开始时环境音的淡入时长（稍慢，让进入状态更柔和） */
  playFadeInSec: 1.6,
  /** 暂停 / 待机时环境音的淡出时长（略快，给操作一个即时回应） */
  playFadeOutSec: 0.8,
  /** 专注结束 / 休息结束的 duck 持续时长 */
  chimeFocusDuckMs: 3200,
  chimeBreakDuckMs: 2200,
  /** 空间化左右游移的频率与幅度 */
  spatialSweepHz: 0.02,
  spatialDepth: 0.18,
  /** 自适应音景：专注后期环境音的轻微收敛比例 */
  adaptiveDip: 0.88,
} as const;

/**
 * 自适应音景的「垫层」。
 *
 * 是**真实录音**（CC0 房间底噪）而不是合成振荡器：原先那版合成低频长音的频谱是
 * 三条静止的谱线、81% 能量压在 150Hz 以下、1kHz 以上为零 —— 小喇叭放不出来，
 * 放不出来的低频会变成互调失真，听感就是嗡鸣（详见 开发踩坑点.md 记录 20）。
 * 现在这版是无音高的宽带噪声：没有音高就不会被当作旋律持续占用注意力。
 *
 * 文件：`public/audio/focus-bed.mp3`（27.2s 无缝循环，单声道 96kbps，320KB）
 */
export const BED = {
  src: '/audio/focus-bed.mp3',
  /** 场景配置里的基准增益：与环境音同量级，实际响度由「垫层强度」乘出来 */
  gain: 0.9,
} as const;

export const UX = {
  /** 阶段提示停留时长 */
  toastMs: 2600,
  /** 抽屉滑动时长 */
  panelSlideMs: 500,
  /** 开始前的准备倒计时（秒），0 表示关闭 */
  ritualSeconds: 3,
  /** 垫层试听时长（秒） */
  previewSeconds: 8,
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
