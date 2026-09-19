import { describe, expect, it } from 'vitest';
import {
  buildMixerLayers,
  hasAnyLevel,
  MIXER_PRESETS,
  MIXER_SOURCE_IDS,
  MIXER_SOURCES,
  normalizeLevels,
} from './mixer';
import { DEFAULT_SETTINGS } from '../lib/defaults';

describe('混音音量表', () => {
  it('缺省时六个键齐全且为 0', () => {
    expect(normalizeLevels(undefined)).toEqual({
      rain: 0,
      waves: 0,
      wind: 0,
      stream: 0,
      crickets: 0,
      birds: 0,
    });
  });

  // 设置是**浅合并**的（见 lib/storage.ts），老存档里整个 mixerLevels 都可能不存在。
  // 少一个键就会让对应滑块读到 undefined 而崩，所以必须补成完整对象。
  it('只写了一个音源时其余补 0，不留 undefined', () => {
    const levels = normalizeLevels({ rain: 0.8 });
    expect(levels.rain).toBe(0.8);
    expect(levels.waves).toBe(0);
    expect(levels.birds).toBe(0);
  });

  it('越界与非数字都收敛到合法范围', () => {
    expect(normalizeLevels({ rain: 5 }).rain).toBe(1);
    expect(normalizeLevels({ rain: -1 }).rain).toBe(0);
    expect(normalizeLevels({ rain: Number.NaN }).rain).toBe(0);
    expect(normalizeLevels({ rain: undefined }).rain).toBe(0);
  });
});

describe('混音音层', () => {
  it('音量为 0 的音源不产生音层（不创建、不加载）', () => {
    const layers = buildMixerLayers({ rain: 0.5 });
    expect(layers).toHaveLength(1);
    expect(layers[0].src).toBe('/audio/mix-rain.mp3');
  });

  it('音量按音源的基准增益缩放', () => {
    const [layer] = buildMixerLayers({ rain: 0.5 });
    const rain = MIXER_SOURCES.find((source) => source.id === 'rain');
    expect(rain).toBeDefined();
    expect(layer.gain).toBeCloseTo((rain?.gain ?? 0) * 0.5);
  });

  it('保留音源的空间化基准位置', () => {
    const [layer] = buildMixerLayers({ waves: 1 });
    const waves = MIXER_SOURCES.find((source) => source.id === 'waves');
    expect(layer.pan).toBe(waves?.pan);
  });

  it('全空时返回空数组', () => {
    expect(buildMixerLayers(undefined)).toEqual([]);
    expect(buildMixerLayers({})).toEqual([]);
  });
});

describe('混音预设', () => {
  it('每个预设至少开一个音源', () => {
    MIXER_PRESETS.forEach((preset) => {
      expect(hasAnyLevel(preset.levels)).toBe(true);
    });
  });

  // 预设里写错 id 不会报错，只会让那个音源永远沉默 —— 这种手滑只能靠断言发现
  it('预设只引用真实存在的音源 id', () => {
    MIXER_PRESETS.forEach((preset) => {
      Object.keys(preset.levels).forEach((id) => {
        expect(MIXER_SOURCE_IDS).toContain(id);
      });
    });
  });
});

describe('音源表', () => {
  it('id 与路径都不重复', () => {
    const ids = MIXER_SOURCES.map((source) => source.id);
    const srcs = MIXER_SOURCES.map((source) => source.src);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('默认音量表可直接发声（开关一开就有声音）', () => {
    expect(hasAnyLevel(DEFAULT_SETTINGS.mixerLevels)).toBe(true);
    expect(buildMixerLayers(DEFAULT_SETTINGS.mixerLevels).length).toBeGreaterThan(0);
  });
});
