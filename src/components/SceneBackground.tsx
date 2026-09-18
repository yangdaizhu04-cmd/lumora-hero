import { useEffect, useRef, useState } from 'react';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  activeIndex: number;
  /** still = 省电模式：完全不加载视频，只用渐变 */
  mode: 'video' | 'still';
}

/**
 * 同时保留在 DOM 里的视频上限。
 * 4 个全留住会一次开 4 路请求（含 3 个用不到的场景）；只留当前的又会让
 * "专注于休息来回切换"反复重新下载。取 3：当前 + 正在显示 + 最近一个。
 */
const MAX_MOUNTED = 3;

/**
 * 背景层，三层结构：
 * 1. 场景渐变（永远铺在底部，视频没就绪或加载失败时页面依然成立，不会出现黑屏）
 * 2. 视频（只在当前场景就绪后才淡入；切换时保留上一场景的最后一帧直到新场景可播）
 * 3. 可读性遮罩
 *
 * 另外：只播放当前场景的视频，页面不可见时全部暂停（省电）；
 * 视频按需挂载（见 MAX_MOUNTED），首次进入不再为用不到的场景发请求。
 */
export function SceneBackground({ scenes, activeIndex, mode }: Props) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [displayedIndex, setDisplayedIndex] = useState(activeIndex);
  const [readyIndexes, setReadyIndexes] = useState<number[]>([]);
  const [failedIndexes, setFailedIndexes] = useState<number[]>([]);
  const [mountedIndexes, setMountedIndexes] = useState<number[]>([activeIndex]);

  const activeReady = readyIndexes.includes(activeIndex);
  const activeFailed = failedIndexes.includes(activeIndex);

  // 目标场景就绪（或不可用/省电模式）时才切换画面
  useEffect(() => {
    if (mode === 'still' || activeReady || activeFailed) {
      setDisplayedIndex(activeIndex);
    }
  }, [activeIndex, mode, activeReady, activeFailed]);

  // 最近用过的场景保留在 DOM 里（LRU），避免来回切换时反复下载
  useEffect(() => {
    setMountedIndexes((prev) => {
      // 先 Set 去重：activeIndex 与 displayedIndex 绝大多数时候是同一个值，
      // 直接拼接会得到重复项 —— 那会渲染出两个同 key 的 <video>（React 报 key 冲突，
      // 还白跑一路解码）。浏览器验证时发现的。
      const next = Array.from(new Set([activeIndex, displayedIndex, ...prev])).slice(
        0,
        MAX_MOUNTED,
      );
      return next.length === prev.length && next.every((value, i) => value === prev[i])
        ? prev
        : next;
    });
  }, [activeIndex, displayedIndex]);

  // 播放控制：只播放当前场景，且页面可见
  useEffect(() => {
    const sync = () => {
      const visible = document.visibilityState === 'visible';
      videoRefs.current.forEach((video, index) => {
        if (!video) return;
        const shouldPlay = mode === 'video' && visible && index === activeIndex;
        if (shouldPlay) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      });
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [activeIndex, mode]);

  const overlayScene = scenes[displayedIndex] ?? scenes[0];

  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      {scenes.map((scene, index) => (
        <div
          key={scene.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{
            background: scene.gradient,
            opacity: index === displayedIndex ? 1 : 0,
          }}
        />
      ))}

      {mode === 'video' &&
        scenes.map((scene, index) => {
          if (!mountedIndexes.includes(index)) return null;
          if (failedIndexes.includes(index)) return null;
          const visible = index === displayedIndex && readyIndexes.includes(index);

          return (
            <video
              key={scene.id}
              ref={(element) => {
                videoRefs.current[index] = element;
              }}
              src={scene.videoUrl}
              muted
              loop
              playsInline
              autoPlay={index === activeIndex}
              preload={index === activeIndex ? 'auto' : 'metadata'}
              onCanPlay={() =>
                setReadyIndexes((prev) =>
                  prev.includes(index) ? prev : [...prev, index],
                )
              }
              onError={() =>
                setFailedIndexes((prev) =>
                  prev.includes(index) ? prev : [...prev, index],
                )
              }
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                visible ? 'opacity-100' : 'opacity-0'
              }`}
            />
          );
        })}

      <div
        className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
        style={{ background: overlayScene.overlay }}
      />
    </div>
  );
}
