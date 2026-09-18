import { memo } from 'react';
import { ListTodo, Settings as SettingsIcon } from 'lucide-react';
import { VolumeControl } from './VolumeControl';

interface Props {
  remainingTasks: number;
  volume: number;
  muted: boolean;
  onOpenTasks: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

const SANS = 'system-ui, sans-serif';

/** 顶栏：品牌 + 今日意图 + 音量 + 设置 */
function TopBarComponent({
  remainingTasks,
  volume,
  muted,
  onOpenTasks,
  onVolumeChange,
  onToggleMute,
  onOpenSettings,
}: Props) {
  return (
    <header className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 md:px-10">
      <div className="flex items-baseline gap-3">
        <span
          className="text-xl italic sm:text-2xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Lumora
        </span>
        <span
          className="hidden text-[10px] uppercase tracking-[0.28em] opacity-55 sm:inline"
          style={{ fontFamily: SANS }}
        >
          Focus
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenTasks}
          aria-label="打开今日意图"
          title="今日意图 (T)"
          className="liquid-glass relative flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70"
        >
          <ListTodo className="h-4 w-4" />
          {remainingTasks > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-medium tabular-nums text-[#182C41]"
              aria-hidden="true"
            >
              {remainingTasks}
            </span>
          )}
        </button>

        <VolumeControl
          volume={volume}
          muted={muted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="打开设置"
          className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export const TopBar = memo(TopBarComponent);
