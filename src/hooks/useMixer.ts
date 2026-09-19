import { useEffect, useMemo } from 'react';
import { buildMixerLayers, MIXER_SOURCES } from '../data/mixer';
import { BED_LAYER, SCENES } from '../data/scenes';
import type { AudioLayerConfig, PomodoroSettings } from '../types';
import type { AudioApi } from './useAudioEngine';

/**
 * 自定义混音的接线：把设置里的配方交给引擎，并按需注册音源。
 *
 * 单独成 hook 是为了让 App 只负责"把 settings 传进来"——
 * 混音器往后加音源、加预设都不该再让 App.tsx 变长。
 *
 * 两件事在这里一起做，因为它们共享"混音器是否开启"这个前提：
 * 1. setMixer：开着就把配方交给引擎接管发声，关着（null）交还给场景；
 * 2. setRegistry：开着才把六个文件纳入预热，关着时省流模式不该为此白下载 3MB。
 */
export function useMixer(audio: AudioApi, settings: PomodoroSettings): void {
  const layers: AudioLayerConfig[] | null = useMemo(
    () =>
      settings.mixerEnabled
        ? // 末尾接上垫层 —— 自适应音景应该在任何音源组合下都还能用
          [...buildMixerLayers(settings.mixerLevels), BED_LAYER]
        : null,
    [settings.mixerEnabled, settings.mixerLevels],
  );

  useEffect(() => {
    audio.setMixer(layers);
  }, [audio, layers]);

  useEffect(() => {
    const mixerConfigs = settings.mixerEnabled
      ? MIXER_SOURCES.map((source) => ({
          src: source.src,
          gain: source.gain,
          pan: source.pan,
        }))
      : [];
    audio.setRegistry([...SCENES.flatMap((item) => item.layers), ...mixerConfigs]);
  }, [audio, settings.mixerEnabled]);
}
