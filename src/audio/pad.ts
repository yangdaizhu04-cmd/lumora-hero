import { AUDIO } from '../config';

/**
 * 合成 pad：一段极简的低频长音，用来实现"自适应音景"。
 *
 * 为什么需要合成而不是再加一个音频文件：
 * 1. 体积为 0，且没有任何循环接缝
 * 2. 可以平滑地随专注进度渐入（mp3 做不到"随进度缓慢变形"）
 * 3. 复音与频率可以按场景切换，音色自由
 *
 * 结构：3 个振荡器（根音 / 五度 / 八度，轻微失谐）→ 低通 → 输出增益（带缓慢呼吸）
 */
export class SynthPad {
  private ctx: AudioContext;
  private output: GainNode;
  private filter: BiquadFilterNode;
  private voices: OscillatorNode[] = [];
  private breath: OscillatorNode;
  private breathDepth: GainNode;
  private level = 0;
  private started = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.output = ctx.createGain();
    this.output.gain.value = 0;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 460;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.output);
    this.output.connect(destination);

    // 缓慢的音量呼吸（0.05Hz ≈ 20 秒一次），避免长音听起来"死掉"
    this.breath = ctx.createOscillator();
    this.breath.type = 'sine';
    this.breath.frequency.value = 0.05;
    this.breathDepth = ctx.createGain();
    this.breathDepth.gain.value = 0;
    this.breath.connect(this.breathDepth).connect(this.output.gain);
  }

  /** 设定基频（取场景的 padRootHz），并按五度 + 八度叠出温暖的和声 */
  setRoot(rootHz: number): void {
    const ratios = [1, 1.5, 2];
    const detune = [-4, 3, -7];

    if (!this.started) {
      ratios.forEach((ratio, index) => {
        const osc = this.ctx.createOscillator();
        osc.type = index === 1 ? 'triangle' : 'sine';
        osc.frequency.value = rootHz * ratio;
        osc.detune.value = detune[index];
        osc.connect(this.filter);
        osc.start();
        this.voices.push(osc);
      });
      this.breath.start();
      this.started = true;
      return;
    }

    this.voices.forEach((osc, index) => {
      const target = rootHz * ratios[index];
      const now = this.ctx.currentTime;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      // 换场景时滑过去，不要瞬跳（会有"咔"的一声）
      osc.frequency.linearRampToValueAtTime(target, now + 2.5);
    });
  }

  /** 目标音量（0–1），内部会乘到 AUDIO.padMaxLevel */
  setLevel(level: number, fadeSec = 4): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.level = clamped;
    const target = clamped * AUDIO.padMaxLevel;

    const now = this.ctx.currentTime;
    const gain = this.output.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + fadeSec);

    // 呼吸幅度按当前音量等比缩放，避免音量小的时候被调制到负数
    const depth = this.breathDepth.gain;
    depth.cancelScheduledValues(now);
    depth.setValueAtTime(depth.value, now);
    depth.linearRampToValueAtTime(target * 0.35, now + fadeSec);

    // 音量越高，低通开得越亮一点点
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.linearRampToValueAtTime(420 + clamped * 260, now + fadeSec);
  }

  get currentLevel(): number {
    return this.level;
  }

  dispose(): void {
    this.voices.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* 已停止 */
      }
    });
    this.voices = [];
    try {
      this.breath.stop();
      this.breath.disconnect();
    } catch {
      /* 同上 */
    }
    this.output.disconnect();
    this.started = false;
  }
}
