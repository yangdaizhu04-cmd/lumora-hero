import { BED } from '../config';
import type { AudioLayerConfig, Scene } from '../types';

/**
 * 四个场景的唯一数据源：视频、音景、文字颜色。
 * 新增场景：在此追加一项 + 在 public/audio 放入音频 + 补 SCENE_GRADIENT。
 *
 * 音源均为 CC0（公共领域）录音，来源与剪辑信息见 README.md §音源署名。
 */

/**
 * 自适应垫层：每个场景都挂上同一层，响度由专注进度单独驱动。
 *
 * 它挂在每个场景里（而不是作为独立音源）有个好处：切换场景时它同时属于新旧两边的
 * 期望音层，引擎不会把它当作"要淡出的旧层"，垫层在场景交叉淡化中保持连续、不被切断。
 */
const BED_LAYER: AudioLayerConfig = { src: BED.src, gain: BED.gain, pan: 0 };

export const SCENES: Scene[] = [
  {
    id: 'golden-hour',
    label: 'Golden Hour',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/golden-hour.mp3', gain: 0.9, pan: 0 }, BED_LAYER],
  },
  {
    id: 'still-water',
    label: 'Still Water',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/still-water.mp3', gain: 1, pan: -0.28 }, BED_LAYER],
  },
  {
    id: 'deep-woods',
    label: 'Deep Woods',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4',
    textColor: '#182C41',
    layers: [{ src: '/audio/deep-woods.mp3', gain: 0.9, pan: 0.22 }, BED_LAYER],
  },
  {
    id: 'quiet-dawn',
    label: 'Quiet Dawn',
    videoUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4',
    textColor: '#ffffff',
    layers: [{ src: '/audio/quiet-dawn.mp3', gain: 0.9, pan: -0.12 }, BED_LAYER],
  },
];

export const DEFAULT_SCENE_INDEX = 2; // Deep Woods 作为默认场景

/** 场景 id → 场景配置 */
export const SCENE_BY_ID = Object.fromEntries(
  SCENES.map((scene) => [scene.id, scene]),
) as Record<Scene['id'], Scene>;

/**
 * 阶段 → 场景的自动编排规则。
 * 专注时进深林，休息时靠水边；夜间休息换成黎明（更轻、更适合收尾）。
 */
export function sceneForPhase(
  phase: 'focus' | 'shortBreak' | 'longBreak',
  night: boolean,
): Scene['id'] {
  if (phase === 'focus') return 'deep-woods';
  return night ? 'quiet-dawn' : 'still-water';
}

export function sceneIndexById(id: Scene['id']): number {
  const index = SCENES.findIndex((scene) => scene.id === id);
  return index >= 0 ? index : 0;
}

/** 需要极简的半透明遮罩，保证文字可读 */
export const SCENE_OVERLAY: Record<Scene['id'], string> = {
  'golden-hour':
    'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
  'still-water':
    'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
  'deep-woods':
    'radial-gradient(ellipse at center, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.42) 100%)',
  'quiet-dawn':
    'radial-gradient(ellipse at center, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.34) 100%)',
};

/**
 * 视频不可用时的静态兜底（网络故障 / 省电模式）。
 * 每个场景一组渐变色，保证没有视频时页面依然成立。
 */
export const SCENE_GRADIENT: Record<Scene['id'], string> = {
  'golden-hour':
    'linear-gradient(160deg, #f6c99a 0%, #e39a6b 34%, #a85f57 68%, #3c2e40 100%)',
  'still-water':
    'linear-gradient(160deg, #cfe4ea 0%, #8fb6c4 38%, #4f7d92 70%, #22394a 100%)',
  'deep-woods':
    'linear-gradient(160deg, #d8e3d2 0%, #9ab393 36%, #5b7d63 68%, #22331f 100%)',
  'quiet-dawn':
    'linear-gradient(160deg, #f3e3d6 0%, #d8b6ad 34%, #8a7f9c 68%, #2c2c44 100%)',
};
