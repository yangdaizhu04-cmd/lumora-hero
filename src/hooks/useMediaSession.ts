import { useEffect } from 'react';

export interface MediaSessionOptions {
  title: string;
  artist: string;
  album: string;
  isPlaying: boolean;
  durationMs: number;
  /** 已过去的时长 */
  positionMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
}

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * 系统媒体控制：让耳机上的播放/暂停键、锁屏控件、车机都能控制番茄钟，
 * 并在锁屏界面显示剩余进度。
 *
 * 依赖页面上有正在播放的媒体元素（我们的环境音就是），否则部分平台不会显示控件。
 */
export function useMediaSession(options: MediaSessionOptions): void {
  const { title, artist, album, isPlaying, durationMs, positionMs } = options;

  useEffect(() => {
    if (!supported()) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album });
    } catch {
      /* 构造失败时忽略 */
    }
  }, [title, artist, album]);

  useEffect(() => {
    if (!supported()) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  const { onPlay, onPause, onStop, onNext } = options;

  useEffect(() => {
    if (!supported()) return;
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', onPlay],
      ['pause', onPause],
      ['stop', onStop],
      ['nexttrack', onNext],
    ];

    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* 平台不支持该 action */
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* 同上 */
        }
      });
    };
  }, [onPlay, onPause, onStop, onNext]);

  // 锁屏进度条（每秒更新一次，和倒计时同频）
  useEffect(() => {
    if (!supported() || !('setPositionState' in navigator.mediaSession)) return;
    const duration = Math.max(1, durationMs / 1000);
    const position = Math.min(duration, Math.max(0, positionMs / 1000));
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position,
        playbackRate: 1,
      });
    } catch {
      /* 参数非法时忽略 */
    }
  }, [durationMs, positionMs]);
}
