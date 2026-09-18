/** 把毫秒格式化为 mm:ss（超过一小时则 h:mm:ss），向上取整到秒 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60 * 1000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 夜间时段：从 nightStartHour 到次日 6 点 */
export function isNightTime(nightStartHour: number, date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= nightStartHour || hour < 6;
}

/** 把分钟数说成人话，用于睡眠定时的剩余提示 */
export function formatRemainingMinutes(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return `${Math.max(0, minutes)} 分钟`;
}
