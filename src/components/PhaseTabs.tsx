import { memo } from 'react';
import { PHASE_META, PHASE_ORDER } from '../data/phases';
import type { Phase } from '../types';

interface Props {
  phase: Phase;
  completedFocus: number;
  longBreakInterval: number;
  onSelect: (phase: Phase) => void;
}

const SANS = 'system-ui, sans-serif';

/** 阶段切换胶囊 + 本轮番茄进度点 */
function PhaseTabsComponent({
  phase,
  completedFocus,
  longBreakInterval,
  onSelect,
}: Props) {
  return (
    <>
      <div className="liquid-glass flex items-center gap-1 rounded-full p-1.5">
        {PHASE_ORDER.map((item) => {
          const isActive = phase === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={isActive}
              className="rounded-full px-3 py-1.5 text-[11px] transition-colors duration-300 sm:px-4 sm:text-xs"
              style={{
                fontFamily: SANS,
                background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                color: isActive ? '#182C41' : 'inherit',
                opacity: isActive ? 1 : 0.7,
              }}
            >
              {PHASE_META[item].label}
            </button>
          );
        })}
      </div>

      <div
        className="mt-5 flex items-center justify-center gap-2"
        aria-label={`本轮已完成 ${completedFocus} 个番茄`}
      >
        {Array.from({ length: longBreakInterval }).map((_, index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full transition-opacity duration-500"
            style={{
              background: 'currentColor',
              opacity: index < completedFocus ? 0.9 : 0.25,
            }}
          />
        ))}
      </div>
    </>
  );
}

export const PhaseTabs = memo(PhaseTabsComponent);
