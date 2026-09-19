import { AUDIO } from '../config';
import { clamp } from '../lib/time';
import type { AudioLayerConfig } from '../types';

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
 * 链路：HTMLAudioElement(loop) → layerGain → stereoPanner → master → sleepGain → destination
 *
 * 所有音层（含自适应垫层）走的是同一条链路：它们是 `HTMLAudioElement` + 增益，
 * 靠 `setAdaptive(src, factor)` 缩放，没有额外的合成音源。
 *
 * 三个关键设计：
 * 1. **预热**：解锁时把全部场景的音层都建好（音量 0、暂停），切场景只改增益，切换是瞬时的；
 *    省流模式或 2G 网络下只预热当前场景。
 * 2. **不是直接改 gain.value 而是线性斜坡**：所有音量变化都走 ramp，避免爆音。
 * 3. **睡眠淡出用独立的 sleepGain 节点**：它和"音量/静音/duck"是两套互不相干的比例。
 *    早先两者共用 master.gain，任一方 cancelScheduledValues 都会把另一方的斜坡打断
 *    （表现为"开了睡眠定时反而完全没声音"，详见 开发踩坑点.md）。
 */
export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** 睡眠定时的独立音量比例（1 → 0），与主音量自动化互不干扰 */
  private sleepGain: GainNode | null = null;

  private layers = new Map<string, Layer>();
  /** src → 该层的场景配置（用于预热与基准音量） */
  private registry = new Map<string, AudioLayerConfig>();

  /**
   * 每个音源的"目标倍率"（自适应/垫层）。
   *
   * 为什么要单独记住：音层是**解锁时**才创建的，比 `setAdaptive` 的第一次调用晚。
   * 不记住的话会有两个后果：
   * 1. 音层还没建时的那次调用直接丢失，之后不会补上；
   * 2. `ensureLayer` 新建音层时默认倍率是 1（对场景层是对的），垫层的正确倍率却可能是 0 ——
   *    实测会让垫层在专注刚开始的 1 秒里冒出 0.53 增益的声音。
   */
  private adaptiveTargets = new Map<string, number>();

  private desired: AudioLayerConfig[] = [];
  private desiredKey = '';

  /**
   * 自定义混音的音层。非 null 时它**取代**场景音景。
   * 与 desired 分开存：切场景只改画面，混音配方不会被冲掉。
   */
  private mixer: AudioLayerConfig[] | null = null;
  private mixerKey = '';

  private volume = 0.7;
  private muted = false;
  private ducked = false;
  private duckTimer: number | null = null;

  private sleeping = false;
  private sleepTimer: number | null = null;
  /** 睡眠淡出的起点与总时长：取消时用它按时间推算"此刻的比例"，避免读 .value 的歧义 */
  private sleepStartedAt = 0;
  private sleepSeconds = 0;

  /**
   * 是否应该发声。由计时状态驱动（见 App 里的同步 effect）：
   * 待机、暂停时为 false —— 此时音层悄悄淡出并暂停，不再占用解码与电量。
   */
  private playing = false;

  private spatialEnabled = false;
  private spatialLfo: OscillatorNode | null = null;
  private spatialDepth: GainNode | null = null;

  /** 空闲预热其余场景音层的句柄（见 scheduleWarmup） */
  private warmHandle: number | null = null;
  private warmScheduled = false;

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

  get isPlaying(): boolean {
    return this.playing;
  }

  // ---------- 生命周期 ----------

  /**
   * 必须在用户手势（click/keydown）中调用，否则浏览器会挂起 AudioContext。
   *
   * 注意这里**只做准备、不出声**：创建上下文、建好音层、把场景配好，
   * 主音量保持 0。真正发声由 setPlaying(true) 决定 ——
   * 早先版本在 unlock 里直接淡入音量，导致"点一下场景切换器就会出声"。
   */
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

      this.sleepGain = this.ctx.createGain();
      this.master.connect(this.sleepGain);
      this.sleepGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* 用户未授权时忽略 */
      }
    }

    // 先保证当前音层可用（开始 / 切场景是即时的），其余等浏览器空闲再预热
    this.ensureLayers(this.activeLayers);
    this.applySceneLayers(AUDIO.sceneFadeSec);
    this.applySpatial();
    this.applyMasterGain(AUDIO.playFadeInSec);
    this.scheduleWarmup();
  }

  dispose(): void {
    this.stopAll();
    this.cancelWarmup();
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
    this.layers.clear();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.sleepGain = null;
    this.disposed = true;
  }

  // ---------- 场景 ----------

  /** 注册全部场景的音层，解锁后按"当前优先、其余空闲预热"加载 */
  setRegistry(configs: AudioLayerConfig[]): void {
    configs.forEach((config) => this.registry.set(config.src, config));
    // 解锁后又新增了场景：同样交给空闲预热，不在注册这一刻就去下载
    if (this.ctx) this.scheduleWarmup();
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

    // 混音器接管了发声时，切场景只换画面。
    // 否则"自动切换场景"会在用户刚配好方子后把它冲掉。
    if (this.mixer) return;

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

  /**
   * 自定义混音：传音层数组则用它们**取代**场景音景，传 null 则交还给场景。
   *
   * 和 setScene 共用同一条 applySceneLayers —— 两者本质都是"决定哪些层该响"。
   * 分开维护两条链路会让"谁在抢这个 gain"变得无法推理（见开发踩坑点记录 19）。
   */
  setMixer(layers: AudioLayerConfig[] | null, fadeSec = AUDIO.sceneFadeSec): void {
    const next = layers && layers.length > 0 ? layers : null;
    const key = next
      ? next
          .map((layer) => layer.src)
          .sort()
          .join('|')
      : '';
    const sameMixer = key === this.mixerKey;

    this.mixer = next;
    this.mixerKey = key;
    if (next) next.forEach((config) => this.registry.set(config.src, config));

    if (!this.ctx) return;

    if (sameMixer) {
      // 只是某个音源音量变了（拖动滑块）：不要重启播放，只同步数值
      if (next) {
        next.forEach((config) => {
          const layer = this.layers.get(config.src);
          if (!layer) return;
          layer.level = config.gain;
          layer.pan = config.pan ?? 0;
        });
        this.applySpatialBase();
        this.applyLayerGains(0.3);
      }
      return;
    }

    this.applySceneLayers(fadeSec);
  }

  /**
   * 自适应音景：按倍率缩放某个音层。
   * `fadeSec` 默认 6 秒 —— 随专注进度漂移本来就该慢；试听这类"我现在就要听"的场景
   * 需要传更短的淡入，否则 6 秒的斜坡会把只有几秒的试听整个吃掉。
   */
  setAdaptive(src: string, factor: number, fadeSec = 6): void {
    const next = clamp(factor, 0, 1);
    this.adaptiveTargets.set(src, next);

    const layer = this.layers.get(src);
    if (!layer) return; // 还没解锁：值已记下，建音层时会用它作为初始倍率
    if (Math.abs(next - layer.adaptive) < 0.005) return;
    layer.adaptive = next;
    this.applyLayerGains(fadeSec);
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

  /**
   * 环境音跟随计时状态发声：开始（含准备倒计时）后淡入，暂停 / 待机淡出。
   *
   * 引擎本身在用户手势里就解锁完毕了，所以暂停只是把音量淡到 0 并暂停媒体元素，
   * 音层、已加载的音频都留在内存里，再次开始是瞬时的、不需要重新下载。
   */
  setPlaying(playing: boolean): void {
    if (playing === this.playing) return;
    this.playing = playing;

    // 还没解锁：先把状态记下，unlock 时会按它决定要不要发声
    if (!this.ctx) return;

    const fade = playing ? AUDIO.playFadeInSec : AUDIO.playFadeOutSec;
    this.applyLayerGains(fade);
    this.applyMasterGain(fade);
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

  /** 在 seconds 秒内把整体音量淡到静音并停止播放（走独立的 sleepGain，不碰主音量） */
  startSleepFade(seconds: number): void {
    if (!this.ctx || !this.sleepGain) return;
    this.clearSleepTimer();

    const now = this.ctx.currentTime;
    const gain = this.sleepGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(1, now);
    gain.linearRampToValueAtTime(0.0001, now + seconds);

    this.sleepStartedAt = now;
    this.sleepSeconds = seconds;

    this.sleepTimer = window.setTimeout(() => {
      this.sleepTimer = null;
      this.sleeping = true;
      this.layers.forEach((layer) => layer.audio.pause());
    }, seconds * 1000);
  }

  /** 任何用户操作都应取消睡眠定时并恢复正常播放 */
  cancelSleep(): void {
    const wasSleeping = this.sleeping;
    const wasFading = this.sleepTimer !== null;
    this.clearSleepTimer();
    this.sleeping = false;

    if (this.ctx && this.sleepGain) {
      const now = this.ctx.currentTime;
      const gain = this.sleepGain.gain;
      // 淡出进行中：按时间推算当前比例（不能依赖斜坡中的 .value 读值）；
      // 已经淡完或本来就没开：.value 是可靠的
      const current = wasFading
        ? clamp(1 - (now - this.sleepStartedAt) / this.sleepSeconds, 0.0001, 1)
        : gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
      gain.linearRampToValueAtTime(1, now + AUDIO.sceneFadeSec);
    }

    if (wasSleeping) {
      this.applySceneLayers(AUDIO.sceneFadeSec);
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

  /** 当前真正该响的音层：混音器开着就听它的，否则听场景的 */
  private get activeLayers(): AudioLayerConfig[] {
    return this.mixer ?? this.desired;
  }

  /** 需要静音的全部原因：睡眠定时已生效，或计时并未进行 */
  private get shouldSilence(): boolean {
    return this.sleeping || !this.playing;
  }

  private clearSleepTimer(): void {
    if (this.sleepTimer !== null) {
      window.clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  /** 是否值得把所有场景的音频都下下来（省流/2G 时只预热当前场景） */
  private shouldPreloadAll(): boolean {
    const connection = (navigator as unknown as { connection?: NetworkInformation })
      .connection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return connection.effectiveType !== '2g' && connection.effectiveType !== 'slow-2g';
  }

  /** 立刻为这些音层做准备（只建节点、不发声，音量保持 0） */
  private ensureLayers(configs: AudioLayerConfig[]): void {
    if (!this.ctx || !this.master) return;
    configs.forEach((config) => {
      this.ensureLayer(config.src, config.gain, config.pan ?? 0);
    });
  }

  /**
   * 空闲时预热"其余场景"的音层。
   *
   * 早先是解锁就把 4 个场景一起建好（共 11.5MB 音频），4G 下首屏就吃掉一大块流量。
   * 现在先保证当前场景即时可用，剩下的等浏览器空闲再默默加载 —— 用户切场景时依然是瞬时的。
   * 省流 / 2G 环境不预热（只留当前场景）。
   */
  private scheduleWarmup(): void {
    if (!this.ctx || !this.shouldPreloadAll() || this.warmScheduled) return;
    this.warmScheduled = true;

    const run = () => {
      this.warmHandle = null;
      this.warmScheduled = false;
      if (this.disposed) return;

      const activeSrcs = new Set(this.activeLayers.map((layer) => layer.src));
      this.registry.forEach((config) => {
        if (this.layers.has(config.src)) return;
        const layer = this.ensureLayer(config.src, config.gain, config.pan ?? 0);
        // 预热出来的层绝不能发声：非当前音层的基准音量一律按 0 起步
        if (layer && !activeSrcs.has(config.src)) layer.level = 0;
      });
    };

    const idle = (
      window as unknown as {
        requestIdleCallback?: (
          callback: () => void,
          options?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;

    this.warmHandle =
      typeof idle === 'function'
        ? idle(run, { timeout: 4000 })
        : window.setTimeout(run, 2500);
  }

  private cancelWarmup(): void {
    if (this.warmHandle === null) return;
    const cancelIdle = (
      window as unknown as { cancelIdleCallback?: (handle: number) => void }
    ).cancelIdleCallback;
    if (typeof cancelIdle === 'function') cancelIdle(this.warmHandle);
    else window.clearTimeout(this.warmHandle);
    this.warmHandle = null;
    this.warmScheduled = false;
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
      // 用已记录的目标倍率起步；从未被设置过的（场景层）是 1
      adaptive: this.adaptiveTargets.get(src) ?? 1,
      pan,
      stopTimer: null,
    };
    this.layers.set(src, layer);
    return layer;
  }

  private applySceneLayers(fadeSec: number): void {
    if (!this.ctx) return;

    const active = this.activeLayers;
    const activeSrcs = new Set(active.map((layer) => layer.src));

    active.forEach((config) => {
      const layer = this.ensureLayer(config.src, config.gain, config.pan ?? 0);
      if (!layer) return;
      layer.level = config.gain;
      layer.pan = config.pan ?? 0;
    });

    this.layers.forEach((layer, src) => {
      if (activeSrcs.has(src)) return;
      layer.level = 0;
      layer.adaptive = 1;
    });

    this.applySpatialBase();
    this.applyLayerGains(fadeSec);
  }

  private applyLayerGains(fadeSec: number): void {
    if (!this.ctx) return;

    this.layers.forEach((layer) => {
      const target = this.shouldSilence ? 0 : layer.level * layer.adaptive;

      this.rampGain(layer.gain.gain, target, fadeSec);

      // 睡眠过程中由 startSleepFade 统一收尾（它自己有更长的淡出时间），这里不插手。
      // 注意不能因为"静音"就 return —— 待机/暂停时正是要靠下面的分支把元素真正 pause 掉。
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
    const target = this.shouldSilence
      ? 0
      : this.muted
        ? 0
        : this.volume * (this.ducked ? AUDIO.duckLevel : 1);
    this.rampGain(this.master.gain, target, fadeSec);
  }
}
