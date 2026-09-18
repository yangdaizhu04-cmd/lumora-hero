import { memo, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  activeIndex: number;
  /** 音频是否已解锁（未解锁时不给声音暗示） */
  audioReady: boolean;
  muted: boolean;
  onSelect: (index: number) => void;
}

function SceneSwitcherComponent({
  scenes,
  activeIndex,
  audioReady,
  muted,
  onSelect,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const soundOff = muted || !audioReady;

  return (
    <div className="flex justify-center">
      <div className="no-scrollbar flex max-w-full items-center gap-5 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:gap-8 sm:overflow-x-visible sm:pb-0">
        {scenes.map((scene, index) => {
          const isActive = index === activeIndex;
          const opacity = isActive ? 1 : hovered === index ? 0.8 : 0.5;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(index)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              aria-pressed={isActive}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b pb-1 text-xs tracking-wide sm:text-sm"
              style={{
                fontFamily: 'system-ui, sans-serif',
                color: 'inherit',
                opacity,
                borderColor: isActive ? 'currentColor' : 'transparent',
                transitionProperty: 'opacity, border-color',
                transitionDuration: '300ms',
                transitionTimingFunction: 'ease-in-out',
              }}
            >
              {soundOff ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              {scene.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const SceneSwitcher = memo(SceneSwitcherComponent);
