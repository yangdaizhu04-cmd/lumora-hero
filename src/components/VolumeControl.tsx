import { Volume1, Volume2, VolumeX } from 'lucide-react';

interface Props {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
}: Props) {
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? '取消静音' : '静音'}
        title="静音 (M)"
        className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-70"
      >
        <Icon className="h-4 w-4" />
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        aria-label="环境音音量"
        className="range-glass hidden w-24 sm:block"
      />
    </div>
  );
}
