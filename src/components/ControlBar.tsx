import { memo } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';

interface Props {
  isRunning: boolean;
  /** 开始前的准备倒计时进行中 */
  isPreparing: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
}

const SANS = 'system-ui, sans-serif';

function ControlBarComponent({
  isRunning,
  isPreparing,
  onToggle,
  onReset,
  onSkip,
}: Props) {
  return (
    <div className="mt-8 flex items-center justify-center gap-4 sm:gap-5">
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
        aria-label={isPreparing ? '取消准备' : isRunning ? '暂停' : '开始专注'}
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
        aria-label="跳到下一阶段"
        title="跳过 (S)"
        className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70 sm:h-12 sm:w-12"
        style={{ fontFamily: SANS }}
      >
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  );
}

export const ControlBar = memo(ControlBarComponent);
