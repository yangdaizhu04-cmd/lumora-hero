interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface BatteryLike {
  level: number;
  charging: boolean;
}

export function detectSaveData(): boolean {
  const connection = (navigator as unknown as { connection?: NetworkInformation })
    .connection;
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

/** describeDeviceState 的输入：三种省电来源分开传，才能给出不误导的文案 */
export interface PowerHintInput {
  /** 用户在设置里手动开启 */
  manual: boolean;
  /** 电量偏低自动开启 */
  battery: boolean;
  /** 省流 / 2G 自动开启 */
  saveData: boolean;
}

/**
 * 供 UI 展示的一句话摘要。
 * 顺序有意义：用户**手动**打开省电模式时不能说成"电量偏低" —— 那是在给用户编造一个不存在的原因。
 */
export function describeDeviceState(options: PowerHintInput): string | null {
  if (options.manual) return '省电模式已开启：用静态渐变代替背景视频';
  if (options.battery) return '电量偏低，已自动改用静态背景省电';
  if (options.saveData) return '省流模式，背景视频未加载';
  return null;
}
