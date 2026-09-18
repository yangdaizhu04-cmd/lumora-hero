import { useEffect, useRef, useState } from 'react';
import { SCENE_GRADIENT, SCENE_OVERLAY } from '../data/scenes';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  activeIndex: number;
  /** still = 省电模式：完全不加载视频，只用渐变 */
  mode: 'video' | 'still';
}

/**
 * 背景层，三层结构：
 * 1. 场景渐变（永远铺在底部，视频没就绪或加载失败时页面依然成立，不会出现黑屏）
 * 2. 视频（只在当前场景就绪后才淡入；切换时保留上一场景的最后一帧直到新场景可播）
 * 3. 可读性遮罩
 *
 * 另外：只播放当前场景的视频，页面不可见时全部暂停（省电）。
 */
export function SceneBackground({ scenes, activeIndex, mode }: Props) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [displayedIndex, setDisplayedIndex] = useState(activeIndex);
  const [readyIndexes, setReadyIndexes] = useState<number[]>([]);
  const [failedIndexes, setFailedIndexes] = useState<number[]>([]);

  const activeReady = readyIndexes.includes(activeIndex);
  const activeFailed = failedIndexes.includes(activeIndex);

  // 目标场景就绪（或不可用/省电模式）时才切换画面
  useEffect(() => {
    if (mode === 'still' || activeReady || activeFailed) {
      setDisplayedIndex(activeIndex);
    }
  }, [activeIndex, mode, activeReady, activeFailed]);

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
            background: SCENE_GRADIENT[scene.id],
            opacity: index === displayedIndex ? 1 : 0,
          }}
        />
      ))}

      {mode === 'video' &&
        scenes.map((scene, index) => {
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
        style={{ background: SCENE_OVERLAY[overlayScene.id] }}
      />
    </div>
  );
}
