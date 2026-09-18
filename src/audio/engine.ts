import { AUDIO } from '../config';
import { clamp } from '../lib/time';
import type { AudioLayerConfig } from '../types';
import { SynthPad } from './pad';

interface Layer {
  audio: HTMLAudioElement;
  gain: GainNode;
  panner: StereoPannerNode;
  /** 场景目标音量 0–1 */
  level: number;
  /** 自适应倍率 0–1（随专注进度） */
  adaptive: number;
  /** 空间化基准位置 -1..1 */
  pan: number;
  stopTimer: number | null;
}

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * 环境音引擎。
 *
 * 链路：HTMLAudioElement(loop) → layerGain → stereoPanner → master → destination
 *                                        ↑
 *                              合成 pad ──┘（自适应音景）
 *
 * 三个关键设计：
 * 1. **预热**：解锁时把全部场景的音层都建好（音量 0、暂停），切场景只改增益，切换是瞬时的；
 *    省流模式或 2G 网络下只预热当前场景。
 * 2. **不是直接改 gain.value 而是线性斜坡**：所有音量变化都走 ramp，避免爆音。
 * 3. **duck / 睡眠定时作用在 master 上**：不干扰各层自己的目标音量。
 */
export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pad: SynthPad | null = null;

  private layers = new Map<string, Layer>();
  /** src → 该层的场景配置（用于预热与基准音量） */
  private registry = new Map<string, AudioLayerConfig>();

  private desired: AudioLayerConfig[] = [];
  private desiredKey = '';

  private volume = 0.7;
  private muted = false;
  private ducked = false;
  private duckTimer: number | null = null;

  private sleeping = false;
  private sleepTimer: number | null = null;

  private spatialEnabled = false;
  private spatialLfo: OscillatorNode | null = null;
  private spatialDepth: GainNode | null = null;

  private padRootHz = 98;
  private padLevel = 0;

  private disposed = false;

  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** 已解锁的 AudioContext（提示音等外部音源需要） */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get isSleeping(): boolean {
    return this.sleeping;
  }

  // ---------- 生命周期 ----------

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

      this.pad = new SynthPad(this.ctx, this.master);
      this.pad.setRoot(this.padRootHz);
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* 用户未授权时忽略 */
      }
    }

    this.ensureRegistryLayers();
    this.applySceneLayers(AUDIO.sceneFadeSec);
    this.applySpatial();
    this.pad?.setRoot(this.padRootHz);
    this.pad?.setLevel(this.padLevel, 3);
    this.applyMasterGain(AUDIO.unlockFadeSec);
  }

  dispose(): void {
    this.stopAll();
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
    this.pad?.dispose();
    this.pad = null;
    this.layers.clear();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.disposed = true;
  }

  // ---------- 场景 ----------

  /** 注册全部场景的音层，解锁后会被预热 */
  setRegistry(configs: AudioLayerConfig[]): void {
    configs.forEach((config) => this.registry.set(config.src, config));
    if (this.ctx) this.ensureRegistryLayers();
  }

  setScene(layers: AudioLayerConfig[], fadeSec = AUDIO.sceneFadeSec): void {
    const key = layers
      .map((layer) => layer.src)
      .sort()
      .join('|');
    const sameScene = key === this.desiredKey;

    this.desired = layers;
    this.desiredKey = key;
    layers.forEach((config) => this.registry.set(config.src, config));

    if (!this.ctx) return;

    if (sameScene) {
      // 同一场景重复调用（例如 StrictMode 双执行）：只同步数值，不重启播放
      layers.forEach((config) => {
        const layer = this.layers.get(config.src);
        if (!layer) return;
        layer.level = config.gain;
        layer.pan = config.pan ?? 0;
      });
      this.applySpatialBase();
      this.applyLayerGains(0.3);
      return;
    }

    this.applySceneLayers(fadeSec);
  }

  /** 自适应音景：按专注进度缩放某个音层 */
  setAdaptive(src: string, factor: number): void {
    const layer = this.layers.get(src);
    if (!layer) return;
    const next = clamp(factor, 0, 1);
    if (Math.abs(next - layer.adaptive) < 0.005) return;
    layer.adaptive = next;
    this.applyLayerGains(6);
  }

  /** 合成 pad 的目标音量与基频 */
  setPadLevel(level: number, fadeSec = 4): void {
    this.padLevel = clamp(level, 0, 1);
    if (this.sleeping) return;
    this.pad?.setLevel(this.padLevel, fadeSec);
  }

  setPadRoot(rootHz: number): void {
    this.padRootHz = rootHz;
    this.pad?.setRoot(rootHz);
  }

  // ---------- 音量 ----------

  setVolume(volume: number): void {
    const next = clamp(volume, 0, 1);
    if (Math.abs(next - this.volume) < 0.001) return;
    this.volume = next;
    this.applyMasterGain(AUDIO.volumeFadeSec);
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    this.applyMasterGain(0.35);
  }

  setSpatial(enabled: boolean): void {
    if (enabled === this.spatialEnabled) return;
    this.spatialEnabled = enabled;
    this.applySpatial();
  }

  /** 临时压低环境音，用于提示音/阶段播报 */
  duck(holdMs: number = AUDIO.chimeBreakDuckMs): void {
    this.ducked = true;
    this.applyMasterGain(0.2);

    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.ducked = false;
      this.applyMasterGain(1.6);
      this.duckTimer = null;
    }, holdMs);
  }

  // ---------- 睡眠定时 ----------

  /** 在 seconds 秒内把整体音量淡到静音并停止播放 */
  startSleepFade(seconds: number): void {
    if (!this.ctx || !this.master) return;
    this.clearSleepTimer();

    const now = this.ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.0001, now + seconds);

    this.sleepTimer = window.setTimeout(
      () => {
        this.sleepTimer = null;
        this.sleeping = true;
        this.layers.forEach((layer) => layer.audio.pause());
        this.pad?.setLevel(0, 1);
      },
      seconds * 1000,
    );
  }

  /** 任何用户操作都应取消睡眠定时并恢复正常播放 */
  cancelSleep(): void {
    const wasSleeping = this.sleeping;
    this.clearSleepTimer();
    this.sleeping = false;
    if (wasSleeping) {
      this.applySceneLayers(AUDIO.sceneFadeSec);
      this.pad?.setLevel(this.padLevel, 3);
    }
    this.applyMasterGain(AUDIO.sceneFadeSec);
  }

  stopAll(): void {
    this.layers.forEach((layer) => {
      if (layer.stopTimer !== null) window.clearTimeout(layer.stopTimer);
      layer.stopTimer = null;
      layer.audio.pause();
      layer.level = 0;
      layer.adaptive = 1;
      if (this.ctx) layer.gain.gain.value = 0;
    });
    this.desired = [];
    this.desiredKey = '';
  }

  // ---------- 内部实现 ----------

  private clearSleepTimer(): void {
    if (this.sleepTimer !== null) {
      window.clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  /** 是否值得把所有场景的音频都下下来（省流/2G 时只预热当前场景） */
  private shouldPreloadAll(): boolean {
    const connection = (
      navigator as unknown as { connection?: NetworkInformation }
    ).connection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return connection.effectiveType !== '2g' && connection.effectiveType !== 'slow-2g';
  }

  private ensureRegistryLayers(): void {
    if (!this.ctx || !this.master) return;

    if (this.shouldPreloadAll()) {
      this.registry.forEach((config) => {
        this.ensureLayer(config.src, config.gain, config.pan ?? 0);
      });
      return;
    }

    this.desired.forEach((config) => {
      this.ensureLayer(config.src, config.gain, config.pan ?? 0);
    });
  }

  private ensureLayer(src: string, level: number, pan: number): Layer | null {
    if (!this.ctx || !this.master) return null;

    const existing = this.layers.get(src);
    if (existing) return existing;

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';

    const source = this.ctx.createMediaElementSource(audio);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = this.spatialEnabled ? pan : 0;
    if (this.spatialEnabled && this.spatialDepth) {
      this.spatialDepth.connect(panner.pan);
    }

    source.connect(gain).connect(panner).connect(this.master);

    const layer: Layer = {
      audio,
      gain,
      panner,
      level,
      adaptive: 1,
      pan,
      stopTimer: null,
    };
    this.layers.set(src, layer);
    return layer;
  }

  private applySceneLayers(fadeSec: number): void {
    if (!this.ctx) return;

    const desiredSrcs = new Set(this.desired.map((layer) => layer.src));

    this.desired.forEach((config) => {
      const layer = this.ensureLayer(config.src, config.gain, config.pan ?? 0);
      if (!layer) return;
      layer.level = config.gain;
      layer.pan = config.pan ?? 0;
    });

    this.layers.forEach((layer, src) => {
      if (desiredSrcs.has(src)) return;
      layer.level = 0;
      layer.adaptive = 1;
    });

    this.applySpatialBase();
    this.applyLayerGains(fadeSec);
  }

  private applyLayerGains(fadeSec: number): void {
    if (!this.ctx) return;

    this.layers.forEach((layer) => {
      const target = this.sleeping ? 0 : layer.level * layer.adaptive;

      this.rampGain(layer.gain.gain, target, fadeSec);

      if (this.sleeping) return;

      if (target > 0.001) {
        if (layer.stopTimer !== null) {
          window.clearTimeout(layer.stopTimer);
          layer.stopTimer = null;
        }
        if (layer.audio.paused) {
          layer.audio.play().catch(() => undefined);
        }
      } else if (!layer.audio.paused && layer.stopTimer === null) {
        // 淡出之后再暂停，避免把声音截断
        layer.stopTimer = window.setTimeout(
          () => {
            layer.audio.pause();
            layer.stopTimer = null;
          },
          fadeSec * 1000 + 150,
        );
      }
    });
  }

  private applySpatialBase(): void {
    this.layers.forEach((layer) => {
      layer.panner.pan.value = this.spatialEnabled ? layer.pan : 0;
    });
  }

  private applySpatial(): void {
    if (!this.ctx) return;

    if (this.spatialEnabled) {
      if (!this.spatialLfo) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = AUDIO.spatialSweepHz;

        const depth = this.ctx.createGain();
        depth.gain.value = AUDIO.spatialDepth;

        osc.connect(depth);
        osc.start();

        this.spatialLfo = osc;
        this.spatialDepth = depth;
      }

      this.layers.forEach((layer) => {
        layer.panner.pan.value = layer.pan;
        this.spatialDepth?.connect(layer.panner.pan);
      });
      return;
    }

    this.spatialDepth?.disconnect();
    try {
      this.spatialLfo?.stop();
    } catch {
      /* 已经停止 */
    }
    this.spatialLfo?.disconnect();
    this.spatialLfo = null;
    this.spatialDepth = null;
    this.applySpatialBase();
  }

  private rampGain(param: AudioParam, target: number, fadeSec: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.05, fadeSec));
  }

  private applyMasterGain(fadeSec: number): void {
    if (!this.ctx || !this.master) return;
    const target = this.sleeping
      ? 0
      : this.muted
        ? 0
        : this.volume * (this.ducked ? AUDIO.duckLevel : 1);
    this.rampGain(this.master.gain, target, fadeSec);
  }
}
