import { clamp } from '../lib/time';
import type { AudioLayerConfig } from '../types';

/** 提示音响起时环境音压低到的比例 */
const DUCK_LEVEL = 0.28;
/** 场景切换默认交叉淡化时长（秒） */
const SCENE_FADE = 1.2;

interface Layer {
  audio: HTMLAudioElement;
  gain: GainNode;
  /** 该层的目标音量（0–1） */
  level: number;
  stopTimer: number | null;
}

/**
 * 环境音引擎。
 *
 * 链路：HTMLAudioElement(loop) -> MediaElementSource -> layerGain -> master -> destination
 * 音量为 0 时仍保持 master 连接，避免反复 connect/disconnect 产生爆音。
 */
export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers = new Map<string, Layer>();
  private desired: AudioLayerConfig[] = [];
  private desiredKey = '';
  private volume = 0.7;
  private muted = false;
  private ducked = false;
  private duckTimer: number | null = null;
  private disposed = false;

  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** 已解锁的 AudioContext（提示音等外部音源需要） */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** 必须在用户手势（click/keydown）中调用，否则浏览器会挂起 AudioContext */
  async unlock(): Promise<void> {
    if (this.disposed) return;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* 用户未授权时忽略 */
      }
    }

    // 解锁后重新应用当前场景与音量
    this.applyDesired({ force: true });
    this.applyMasterGain(0.4);
  }

  setScene(layers: AudioLayerConfig[], fadeSec = SCENE_FADE): void {
    const key = layers
      .map((layer) => layer.src)
      .sort()
      .join('|');

    const sameScene = key === this.desiredKey;
    this.desired = layers;
    this.desiredKey = key;
    this.applyDesired({ fadeSec, force: false, syncLevelsOnly: sameScene });
  }

  setVolume(volume: number): void {
    const next = clamp(volume, 0, 1);
    // 值未变化时直接返回，避免 React 重渲染反复调度 gain 自动化
    if (Math.abs(next - this.volume) < 0.001) return;
    this.volume = next;
    this.applyMasterGain(0.2);
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    this.applyMasterGain(0.35);
  }

  /** 临时压低环境音，用于提示音/阶段播报 */
  duck(holdMs = 2600): void {
    this.ducked = true;
    this.applyMasterGain(0.2);

    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.ducked = false;
      this.applyMasterGain(1.6);
      this.duckTimer = null;
    }, holdMs);
  }

  /** 暂停全部播放（页面隐藏时可选调用，P1 未启用） */
  stopAll(): void {
    this.layers.forEach((layer) => {
      if (layer.stopTimer !== null) window.clearTimeout(layer.stopTimer);
      layer.stopTimer = null;
      layer.audio.pause();
      layer.level = 0;
      if (this.ctx) layer.gain.gain.value = 0;
    });
    this.desired = [];
    this.desiredKey = '';
  }

  dispose(): void {
    this.stopAll();
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    this.layers.clear();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.disposed = true;
  }

  // ---------- 内部实现 ----------

  private applyDesired({
    fadeSec = SCENE_FADE,
    force = false,
    syncLevelsOnly = false,
  }: {
    fadeSec?: number;
    force?: boolean;
    syncLevelsOnly?: boolean;
  }): void {
    if (!this.ctx || !this.master) return;
    if (syncLevelsOnly && !force) {
      // 同一场景重复调用（如 StrictMode 双执行）：只同步音量，不重启播放
      this.desired.forEach((config) => {
        const layer = this.layers.get(config.src);
        if (layer) {
          layer.level = config.gain;
          this.applyLayerGain(layer, 0.3);
        }
      });
      return;
    }

    const desiredSrcs = new Set(this.desired.map((layer) => layer.src));

    // 淡出并停止不再需要的层
    this.layers.forEach((layer, src) => {
      if (desiredSrcs.has(src)) return;
      layer.level = 0;
      this.applyLayerGain(layer, fadeSec);
      if (layer.stopTimer !== null) window.clearTimeout(layer.stopTimer);
      layer.stopTimer = window.setTimeout(
        () => {
          layer.audio.pause();
          layer.stopTimer = null;
        },
        fadeSec * 1000 + 150,
      );
    });

    // 淡入目标层
    this.desired.forEach((config) => {
      const layer = this.ensureLayer(config.src, config.gain);
      if (!layer) return;

      if (layer.stopTimer !== null) {
        window.clearTimeout(layer.stopTimer);
        layer.stopTimer = null;
      }

      layer.level = config.gain;

      if (layer.audio.paused) {
        // 从 0 开始淡入
        const now = this.ctx!.currentTime;
        layer.gain.gain.cancelScheduledValues(now);
        layer.gain.gain.setValueAtTime(0, now);
        layer.audio.play().catch(() => undefined);
      }
      this.applyLayerGain(layer, fadeSec);
    });
  }

  private ensureLayer(src: string, level: number): Layer | null {
    if (!this.ctx || !this.master) return null;

    const existing = this.layers.get(src);
    if (existing) return existing;

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';

    const source = this.ctx.createMediaElementSource(audio);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.master);

    const layer: Layer = { audio, gain, level, stopTimer: null };
    this.layers.set(src, layer);
    return layer;
  }

  private applyLayerGain(layer: Layer, fadeSec: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const param = layer.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(layer.level, now + Math.max(0.05, fadeSec));
  }

  private applyMasterGain(fadeSec: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : this.volume * (this.ducked ? DUCK_LEVEL : 1);
    const param = this.master.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.05, fadeSec));
  }
}
