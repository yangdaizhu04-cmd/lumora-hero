import { useEffect, useRef } from 'react';
import { SCENE_OVERLAY } from '../data/scenes';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  activeIndex: number;
}

/**
 * 背景视频层。
 * 只播放当前场景的视频 —— 四个 <video> 同时解码会明显浪费 GPU/CPU（详见 开发踩坑点.md）。
 */
export function SceneBackground({ scenes, activeIndex }: Props) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [activeIndex]);

  const activeScene = scenes[activeIndex] ?? scenes[0];

  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      {scenes.map((scene, index) => (
        <video
          key={scene.id}
          ref={(element) => {
            videoRefs.current[index] = element;
          }}
          src={scene.videoUrl}
          autoPlay={index === activeIndex}
          muted
          loop
          playsInline
          preload={index === activeIndex ? 'auto' : 'metadata'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{ background: SCENE_OVERLAY[activeScene.id] }}
      />
    </div>
  );
}
