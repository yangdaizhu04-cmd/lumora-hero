import { RefreshCw, X } from 'lucide-react';
import { SANS } from '../lib/ui';

interface Props {
  visible: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

/**
 * 新版本提示。
 *
 * 没有它的时候，Service Worker 更新是"静默"的：用户可能几周都在跑旧代码，
 * 既不知道有新版本，也不知道刷新一下就能拿到。
 */
export function UpdateBanner({ visible, onReload, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-xs shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      style={{
        fontFamily: SANS,
        color: '#ffffff',
        background: 'rgba(13,22,32,0.82)',
        border: '1px solid rgba(255,255,255,0.16)',
      }}
      role="status"
    >
      <span className="whitespace-nowrap">新版本已就绪</span>
      <button
        type="button"
        onClick={onReload}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[#182C41] transition-opacity duration-300 hover:opacity-85"
      >
        <RefreshCw className="h-3 w-3" />
        刷新
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="稍后再说"
        className="shrink-0 opacity-60 transition-opacity duration-300 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
