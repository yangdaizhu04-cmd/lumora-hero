import { useMemo, useRef } from 'react';
import { AmbienceEngine } from '../audio/engine';
import { playChime, playTick, type ChimeKind } from '../audio/chime';

export interface AudioApi {
  /** 在用户手势中调用，解锁音频 */
  unlock: () => Promise<void>;
  setScene: (layers: { src: string; gain: number }[]) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  /** 播放阶段转场钟声，并顺便压低环境音 */
  chime: (kind: ChimeKind) => void;
  /** 播放点击反馈音（未解锁时静默忽略） */
  tick: (up: boolean) => void;
}

/**
 * 桥接音频引擎与 React。
 * 注意两点：
 * 1. 引擎实例保存在 ref 中且**不在卸载时销毁** —— StrictMode 会模拟卸载，
 *    若在此处 dispose 会导致开发环境下音频彻底失效（详见 开发踩坑点.md）。
 * 2. 返回值必须稳定（useMemo），否则依赖它的 useEffect 会在每次重渲染时触发。
 */
export function useAudioEngine(): AudioApi {
  const engineRef = useRef<AmbienceEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new AmbienceEngine();
  }
  const engine = engineRef.current;

  // 仅开发环境：把引擎挂到 window，便于调试与自动化验证（生产构建会被 tree-shake 掉）
  if (import.meta.env.DEV) {
    (window as unknown as { __lumoraAudio?: AmbienceEngine }).__lumoraAudio =
      engine;
  }

  return useMemo<AudioApi>(
    () => ({
      unlock: () => engine.unlock(),
      setScene: (layers) => engine.setScene(layers),
      setVolume: (volume) => engine.setVolume(volume),
      setMuted: (muted) => engine.setMuted(muted),
      chime: (kind) => {
        engine.duck(kind === 'focusEnd' ? 3200 : 2200);
        const ctx = engine.context;
        if (!ctx) return;
        try {
          playChime(ctx, kind);
        } catch {
          /* 忽略音频异常，不阻断计时 */
        }
      },
      tick: (up) => {
        const ctx = engine.context;
        if (!ctx) return;
        try {
          playTick(ctx, up);
        } catch {
          /* 同上 */
        }
      },
    }),
    [engine],
  );
}
