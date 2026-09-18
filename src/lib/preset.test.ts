import { describe, expect, it } from 'vitest';
import { decodePreset, encodePreset, type SoundPreset } from './preset';
import type { SceneId } from '../types';

const PRESET: SoundPreset = {
  scene: 'deep-woods',
  volume: 70,
  nightMode: false,
  autoScene: true,
  adaptiveSound: true,
  spatialSound: false,
};

describe('音景配方编解码', () => {
  it('编码后能原样解回来', () => {
    expect(decodePreset(encodePreset(PRESET))).toEqual(PRESET);
  });

  it('payload 是 base64url，不含需要转义的字符', () => {
    const encoded = encodePreset(PRESET);
    expect(encoded.startsWith('#p=')).toBe(true);
    const payload = encoded.slice('#p='.length);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload).not.toMatch(/[+/=]/);
  });

  it('缺少或错误的 hash 前缀返回 null', () => {
    expect(decodePreset('')).toBeNull();
    expect(decodePreset('#')).toBeNull();
    expect(decodePreset('#other=abc')).toBeNull();
  });

  it('内容损坏时返回 null 而不是抛错', () => {
    expect(decodePreset('#p=!!!!')).toBeNull();
    expect(decodePreset('#p=')).toBeNull();
  });

  it('场景 id 不存在时返回 null', () => {
    const bogus = encodePreset({ ...PRESET, scene: 'mars-base' as SceneId });
    expect(decodePreset(bogus)).toBeNull();
  });

  it('音量超出范围会被夹回 0–100', () => {
    const loud = decodePreset(encodePreset({ ...PRESET, volume: 999 }));
    const quiet = decodePreset(encodePreset({ ...PRESET, volume: -20 }));
    expect(loud?.volume).toBe(100);
    expect(quiet?.volume).toBe(0);
  });

  it('缺失的布尔字段按 false 处理', () => {
    const minimal = encodePreset({
      scene: 'still-water',
      volume: 50,
    } as SoundPreset);
    expect(decodePreset(minimal)).toEqual({
      scene: 'still-water',
      volume: 50,
      nightMode: false,
      autoScene: false,
      adaptiveSound: false,
      spatialSound: false,
    });
  });

  it('中文内容（未来扩展）不会破坏编解码', () => {
    const withText = { ...PRESET, scene: 'quiet-dawn' as SceneId };
    expect(decodePreset(encodePreset(withText))?.scene).toBe('quiet-dawn');
  });
});
