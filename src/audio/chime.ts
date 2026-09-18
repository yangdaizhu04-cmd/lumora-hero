/**
 * 阶段转场钟声：纯 Web Audio 合成，不占用音频文件体积。
 * 音色 = 正弦基频 + 不谐和泛音（2.756x，类似管钟），指数衰减。
 */

const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
} as const;

/** 专注结束：下行，舒缓 */
const FOCUS_END = [NOTE.G5, NOTE.E5, NOTE.C5];
/** 休息结束：上行，唤起 */
const BREAK_END = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];

export type ChimeKind = 'focusEnd' | 'breakEnd';

export function playChime(ctx: AudioContext, kind: ChimeKind): void {
  const notes = kind === 'focusEnd' ? FOCUS_END : BREAK_END;
  const startAt = ctx.currentTime + 0.04;

  // 钟声整体响度（相对 destination，不经过环境音 bus）
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  bus.connect(ctx.destination);

  notes.forEach((freq, index) => {
    bell(ctx, bus, freq, startAt + index * 0.17, 2.4, 0.2);
  });
}

/** 单次点击反馈（开始/暂停）用的极短轻音 */
export function playTick(ctx: AudioContext, up: boolean): void {
  const bus = ctx.createGain();
  bus.gain.value = 0.35;
  bus.connect(ctx.destination);
  bell(ctx, bus, up ? NOTE.E5 : NOTE.C5, ctx.currentTime + 0.01, 0.5, 0.12);
}

const MOTIF_NOTES = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E5 * 2, NOTE.G5 * 2];

/**
 * 声化日报：把昨天完成的番茄数变成一小段上行音阶。
 * 完成得越多，音越多、音区越高 —— 数据也可以用听的。
 */
export function playDayMotif(ctx: AudioContext, count: number): void {
  const notes = MOTIF_NOTES.slice(0, Math.max(1, Math.min(MOTIF_NOTES.length, count)));
  const startAt = ctx.currentTime + 0.05;

  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(ctx.destination);

  notes.forEach((freq, index) => {
    bell(ctx, bus, freq, startAt + index * 0.16, 1.8, 0.15);
  });
}

function bell(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  startAt: number,
  duration: number,
  level: number,
): void {
  const fundamental = ctx.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.value = freq;

  const partial = ctx.createOscillator();
  partial.type = 'sine';
  partial.frequency.value = freq * 2.756;

  const partialGain = ctx.createGain();
  partialGain.gain.value = 0.16;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(level, startAt + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  fundamental.connect(envelope);
  partial.connect(partialGain).connect(envelope);
  envelope.connect(destination);

  const stopAt = startAt + duration + 0.05;
  fundamental.start(startAt);
  fundamental.stop(stopAt);
  partial.start(startAt);
  partial.stop(stopAt);
}
