interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface BatteryLike {
  level: number;
  charging: boolean;
}

export function detectSaveData(): boolean {
  const connection = (
    navigator as unknown as { connection?: NetworkInformation }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g';
}

/**
 * 低电量检测：背景视频是主要的耗电来源，
 * 电量低于 20% 且未充电时自动改用静态渐变。
 * 浏览器不支持 Battery API（Safari / Firefox）时返回 false，不影响主流程。
 */
export async function detectLowPower(): Promise<boolean> {
  const nav = navigator as unknown as {
    getBattery?: () => Promise<BatteryLike>;
  };
  if (!nav.getBattery) return false;
  try {
    const battery = await nav.getBattery();
    return battery.level <= 0.2 && !battery.charging;
  } catch {
    return false;
  }
}

/** 供 UI 展示的一句话摘要 */
export function describeDeviceState(options: {
  lowPower: boolean;
  saveData: boolean;
}): string | null {
  if (options.lowPower) return '电量偏低，已改用静态背景省电';
  if (options.saveData) return '省流模式，背景视频未加载';
  return null;
}
