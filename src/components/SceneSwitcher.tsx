import { memo, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  activeIndex: number;
  /** 环境音当前是否真的在发声（待机 / 暂停时为 false） */
  audible: boolean;
  muted: boolean;
  onSelect: (index: number) => void;
}

function SceneSwitcherComponent({
  scenes,
  activeIndex,
  audible,
  muted,
  onSelect,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const soundOff = muted || !audible;
  // 图标要能解释"为什么没声音"：静音是用户设置，待机是还没开始
  const soundHint = muted ? '已静音' : audible ? '音景播放中' : '开始专注后播放音景';

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
              title={soundHint}
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
