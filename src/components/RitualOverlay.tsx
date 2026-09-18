import { SANS } from '../lib/ui';

interface Props {
  count: number | null;
}

/** 开始前的准备倒计时：一次深呼吸的时间，让注意力落回当下 */
export function RitualOverlay({ count }: Props) {
  if (count === null) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5"
      style={{ background: 'rgba(6,10,14,0.42)', backdropFilter: 'blur(3px)' }}
      role="status"
      aria-live="polite"
    >
      <span
        key={count}
        className="ritual-count text-[7rem] leading-none text-white sm:text-[9rem]"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        {count}
      </span>
      <span
        className="text-[11px] uppercase tracking-[0.32em] text-white/70"
        style={{ fontFamily: SANS }}
      >
        准备开始
      </span>
    </div>
  );
}
