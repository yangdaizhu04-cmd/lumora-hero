import { useEffect, useState } from 'react';
import { SANS } from '../lib/ui';

/** 4-7-8 呼吸法：吸气 4s → 屏息 7s → 呼气 8s，一个周期 19s */
const CYCLE_SECONDS = 19;
const INHALE_END = 4;
const HOLD_END = 11;

type Stage = 'inhale' | 'hold' | 'exhale';

const LABEL: Record<Stage, string> = {
  inhale: '吸气 4 秒',
  hold: '屏息 7 秒',
  exhale: '呼气 8 秒',
};

interface Props {
  /** 休息阶段进行中才启用 */
  active: boolean;
}

/**
 * 休息时的呼吸引导文案。
 * 圆环的缩放动画由 CSS（.breathe-478）负责，这里只负责同步文案，
 * 两者共用同一个 19 秒周期。
 */
export function BreathingGuide({ active }: Props) {
  const [stage, setStage] = useState<Stage>('inhale');

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();

    const tick = () => {
      const seconds = ((Date.now() - startedAt) / 1000) % CYCLE_SECONDS;
      setStage(
        seconds < INHALE_END ? 'inhale' : seconds < HOLD_END ? 'hold' : 'exhale',
      );
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return (
    <p
      className="mt-3 text-[10px] tracking-[0.28em] uppercase opacity-50 sm:text-[11px]"
      style={{ fontFamily: SANS }}
      aria-live="off"
    >
      {LABEL[stage]}
    </p>
  );
}
