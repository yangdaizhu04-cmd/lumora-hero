import type { Scene } from '../types';

/**
 * 四个场景的唯一数据源：视频、音景、文字颜色。
 * 新增场景：在此追加一项 + 在 public/audio 放入音频 + 快捷键范围同步（见 App.tsx）。
 *
 * 音源均为 CC0（公共领域）录音，来源与剪辑信息见 README.md §音源署名。
 */
export const SCENES: Scene[] = [
  {
    id: 'golden-hour',
    label: 'Golden Hour',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/golden-hour.mp3', gain: 0.9 }],
  },
  {
    id: 'still-water',
    label: 'Still Water',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/still-water.mp3', gain: 1 }],
  },
  {
    id: 'deep-woods',
    label: 'Deep Woods',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4',
    textColor: '#182C41',
    layers: [{ src: '/audio/deep-woods.mp3', gain: 0.9 }],
  },
  {
    id: 'quiet-dawn',
    label: 'Quiet Dawn',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/quiet-dawn.mp3', gain: 0.9 }],
  },
];

export const DEFAULT_SCENE_INDEX = 2; // Deep Woods 作为默认场景

/** 每个场景需要极简的半透明遮罩，保证文字可读 */
export const SCENE_OVERLAY: Record<Scene['id'], string> = {
  'golden-hour': 'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
  'still-water': 'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
  'deep-woods': 'radial-gradient(ellipse at center, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.42) 100%)',
  'quiet-dawn': 'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
};
