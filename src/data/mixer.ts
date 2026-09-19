import type { AudioLayerConfig, MixerSource, MixerSourceId } from '../types';

/**
 * 自定义混音的音源表。
 *
 * 六个文件都是 CC0 自然录音，来源与处理方式见 README §音源署名。
 * 每个都裁成 47 秒的**无缝循环**（3 秒等功率交叉淡化），单声道 96kbps：
 * 接缝处若用线性淡化，交叉区中点会掉 3dB，循环时每 47 秒起伏一次（见开发踩坑点记录 28）。
 *
 * 选曲原则：六者互不重叠（都是不同质感的环境声），
 * 这样"雨声 + 风声""海浪 + 鸟鸣"这类组合才有意义，而不是两团相似的水声叠在一起。
 */
export const MIXER_SOURCES: MixerSource[] = [
  { id: 'rain', label: '雨声', src: '/audio/mix-rain.mp3', gain: 1, pan: 0 },
  { id: 'waves', label: '海浪', src: '/audio/mix-waves.mp3', gain: 1, pan: -0.16 },
  { id: 'wind', label: '风声', src: '/audio/mix-wind.mp3', gain: 1, pan: 0.2 },
  { id: 'stream', label: '溪流', src: '/audio/mix-stream.mp3', gain: 1, pan: 0.1 },
  {
    id: 'crickets',
    label: '虫鸣',
    src: '/audio/mix-crickets.mp3',
    gain: 1,
    pan: -0.22,
  },
  { id: 'birds', label: '鸟鸣', src: '/audio/mix-birds.mp3', gain: 1, pan: 0.26 },
];

export const MIXER_SOURCE_IDS: MixerSourceId[] = MIXER_SOURCES.map((s) => s.id);

/** 预设：把"从零开始调六个滑块"变成"一键起步" */
export const MIXER_PRESETS: {
  id: string;
  label: string;
  levels: Partial<Record<MixerSourceId, number>>;
}[] = [
  { id: 'rainy-night', label: '雨夜', levels: { rain: 0.8, wind: 0.25 } },
  { id: 'shore', label: '海边', levels: { waves: 0.75, wind: 0.2 } },
  { id: 'forest', label: '林间', levels: { birds: 0.5, wind: 0.3, stream: 0.25 } },
  { id: 'summer-night', label: '夏夜', levels: { crickets: 0.55, wind: 0.2 } },
];

const EMPTY_LEVELS = (): Record<MixerSourceId, number> => {
  const out = {} as Record<MixerSourceId, number>;
  MIXER_SOURCE_IDS.forEach((id) => {
    out[id] = 0;
  });
  return out;
};

/**
 * 补全成完整的音量表。
 *
 * 必须始终是完整对象：`usePersistentState` 对设置做的是**浅合并**（见 lib/storage.ts），
 * 一旦某个音源的键缺失，读到的就是 undefined，滑块会直接崩。
 * 所以预设、导入、默认值都经过这里，保证六个键齐全。
 */
export function normalizeLevels(
  levels: Partial<Record<MixerSourceId, number>> | undefined | null,
): Record<MixerSourceId, number> {
  const out = EMPTY_LEVELS();
  if (!levels) return out;
  MIXER_SOURCE_IDS.forEach((id) => {
    const value = levels[id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[id] = Math.min(1, Math.max(0, value));
    }
  });
  return out;
}

/** 音量表 → 音层配置。音量为 0 的音源不出现（不创建、不加载） */
export function buildMixerLayers(
  levels: Partial<Record<MixerSourceId, number>> | undefined | null,
): AudioLayerConfig[] {
  const normalized = normalizeLevels(levels);
  const out: AudioLayerConfig[] = [];
  MIXER_SOURCES.forEach((source) => {
    const level = normalized[source.id];
    if (level <= 0.001) return;
    out.push({ src: source.src, gain: source.gain * level, pan: source.pan });
  });
  return out;
}

/** 混音器里是否一个音源都没开（用于提示用户去选预设） */
export function hasAnyLevel(
  levels: Partial<Record<MixerSourceId, number>> | undefined | null,
): boolean {
  return MIXER_SOURCE_IDS.some((id) => (levels?.[id] ?? 0) > 0.001);
}
