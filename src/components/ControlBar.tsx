import { memo } from 'react';
import { Check, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';

interface Props {
  isRunning: boolean;
  /** 开始前的准备倒计时进行中 */
  isPreparing: boolean;
  /** 已暂停（主按钮应该说「继续」而不是「开始专注」） */
  isPaused: boolean;
  /** 空闲时主按钮的说法：开始专注 / 开始休息 */
  startLabel: string;
  /**
   * Flowtime 模式：跳过键变成「结束专注」。
   * 两者语义完全不同 —— 跳过是这段不算，结束是这段算数（见 pomodoroMachine 的 FINISH）。
   */
  finishMode?: boolean;
  /** 运行中 / 暂停中才允许延长 */
  canExtend: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onExtend: () => void;
}

const SANS = 'system-ui, sans-serif';

function ControlBarComponent({
  isRunning,
  isPreparing,
  isPaused,
  startLabel,
  finishMode = false,
  canExtend,
  onToggle,
  onReset,
  onSkip,
  onExtend,
}: Props) {
  const toggleLabel = isPreparing
    ? '取消准备'
    : isRunning
      ? '暂停'
      : isPaused
        ? '继续'
        : startLabel;

  return (
    <div className="mt-8 flex items-center justify-center gap-3 sm:gap-5">
      <button
        type="button"
        onClick={onReset}
        aria-label="重置当前阶段"
        title="重置 (R)"
        className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70 sm:h-12 sm:w-12"
        style={{ fontFamily: SANS }}
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title="开始 / 暂停 (Space)"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#182C41] shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98] sm:h-[72px] sm:w-[72px]"
      >
        {isPreparing ? (
          <Square className="h-5 w-5" fill="currentColor" />
        ) : isRunning ? (
          <Pause className="h-6 w-6" fill="currentColor" />
        ) : (
          <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
        )}
      </button>

      <button
        type="button"
        onClick={onSkip}
        aria-label={finishMode ? '结束专注' : '跳到下一阶段'}
        title={finishMode ? '结束并记录这段专注' : '跳过 (S)'}
        className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70 sm:h-12 sm:w-12"
        style={{ fontFamily: SANS }}
      >
        {finishMode ? (
          <Check className="h-4 w-4" />
        ) : (
          <SkipForward className="h-4 w-4" />
        )}
      </button>

      {/*
        延长：番茄钟最常见的诉求（"这题快做完了，再来 5 分钟"）。
        Flowtime 本来就没有终点，延长没有意义，所以那里不显示。
      */}
      {canExtend && !finishMode && (
        <button
          type="button"
          onClick={onExtend}
          aria-label="延长 5 分钟"
          title="延长 5 分钟"
          className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full text-[11px] tabular-nums transition-opacity duration-300 hover:opacity-70 sm:h-12 sm:w-12 sm:text-xs"
          style={{ fontFamily: SANS }}
        >
          +5
        </button>
      )}
    </div>
  );
}

export const ControlBar = memo(ControlBarComponent);
