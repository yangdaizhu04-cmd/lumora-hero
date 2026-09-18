import { SCENES } from '../data/scenes';
import { DEFAULT_SETTINGS } from './defaults';
import type { SceneId } from '../types';

/**
 * 音景配方：把"当前的声音与氛围偏好"编码进 URL hash，无需后端即可分享/收藏。
 * 例：https://…/#p=eyJzY2VuZSI6ImRlZXAtd29vZHMi…（base64url）
 */
export interface SoundPreset {
  scene: SceneId;
  /** 音量 0–100 */
  volume: number;
  /** 垫层强度 0–100 */
  bedLevel: number;
  nightMode: boolean;
  autoScene: boolean;
  adaptiveSound: boolean;
  spatialSound: boolean;
}

const HASH_PREFIX = '#p=';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodePreset(preset: SoundPreset): string {
  return HASH_PREFIX + toBase64Url(JSON.stringify(preset));
}

export function decodePreset(text: string): SoundPreset | null {
  const raw = text.startsWith('#') ? text.slice(1) : text;
  if (!raw.startsWith('p=')) return null;

  const json = fromBase64Url(raw.slice(2));
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const candidate = parsed as Partial<SoundPreset>;
  if (typeof candidate.scene !== 'string') return null;
  if (!SCENES.some((scene) => scene.id === candidate.scene)) return null;
  if (typeof candidate.volume !== 'number' || Number.isNaN(candidate.volume)) {
    return null;
  }

  return {
    scene: candidate.scene as SceneId,
    volume: Math.max(0, Math.min(100, Math.round(candidate.volume))),
    // 旧链接没有这个字段，回落到默认强度
    bedLevel: Math.max(
      0,
      Math.min(100, Math.round(candidate.bedLevel ?? DEFAULT_SETTINGS.bedLevel * 100)),
    ),
    nightMode: candidate.nightMode === true,
    autoScene: candidate.autoScene === true,
    adaptiveSound: candidate.adaptiveSound === true,
    spatialSound: candidate.spatialSound === true,
  };
}

export function readPresetFromLocation(): SoundPreset | null {
  if (typeof window === 'undefined') return null;
  return decodePreset(window.location.hash);
}

/** 应用后清掉 hash，避免刷新时反复覆盖用户的后续调整 */
export function clearPresetFromLocation(): void {
  if (typeof window === 'undefined') return;
  const clean = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', clean);
}

export function buildShareUrl(preset: SoundPreset): string {
  return `${window.location.origin}${window.location.pathname}${encodePreset(preset)}`;
}
