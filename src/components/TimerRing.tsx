import type { ReactNode } from 'react';

interface Props {
  /** 已经过的比例 0–1 */
  progress: number;
  /** 内部内容（倒计时数字） */
  children: ReactNode;
  /** 休息阶段用更柔和的环 */
  soft?: boolean;
}

const SIZE = 340;
const STROKE = 1.5;
const RADIUS = SIZE / 2 - STROKE;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** 细线进度环：随剩余时间从满圈收缩 */
export function TimerRing({ progress, children, soft = false }: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * clamped;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[260px] w-[260px] sm:h-[340px] sm:w-[340px]"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          opacity={0.18}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          opacity={soft ? 0.45 : 0.8}
          style={{ transition: 'stroke-dashoffset 240ms linear, opacity 600ms ease' }}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
