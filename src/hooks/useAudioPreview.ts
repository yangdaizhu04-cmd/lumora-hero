import { useCallback, useEffect, useRef, useState } from 'react';

/** 可被试听的音源 */
export type PreviewKind = 'bed' | 'mixer';

export interface PreviewApi {
  /** 垫层试听中 */
  bedPreview: boolean;
  /** 自定义混音试听中 */
  mixerPreview: boolean;
  /** 开始试听，seconds 秒后自动结束 */
  start: (kind: PreviewKind) => void;
}

/**
 * 试听窗口：临时让某个音源发声几秒，不开始计时也能判断强度是否合适。
 *
 * 垫层与自定义混音都需要它，而两者共用**同一扇窗口**——同时只允许一个试听。
 * 若各自维护一个定时器，后者会静默顶掉前者的清理逻辑，留下一个永不结束的试听，
 * 表现为"明明没在计时，环境音却一直响"。
 *
 * @param seconds 试听时长
 * @param onStart 发声前调用（用于解锁音频、唤醒屏幕）。用 ref 持有，
 *   所以调用方不必为了保持 start 的稳定而把它包进 useCallback。
 */
export function useAudioPreview(seconds: number, onStart: () => void): PreviewApi {
  const [kind, setKind] = useState<PreviewKind | null>(null);
  const timerRef = useRef<number | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const start = useCallback(
    (next: PreviewKind) => {
      onStartRef.current();
      setKind(next);
      // 连续点击要重置窗口，否则第二次点击只会得到"第一次剩下的时间"
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setKind(null);
      }, seconds * 1000);
    },
    [seconds],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    bedPreview: kind === 'bed',
    mixerPreview: kind === 'mixer',
    start,
  };
}
