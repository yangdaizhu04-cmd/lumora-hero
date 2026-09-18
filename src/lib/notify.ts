export type NotifyPermission = NotificationPermission | 'unsupported';

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotifyPermission {
  if (!notificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * 申请通知权限。
 * 只应该在用户显式打开开关时调用 —— 页面加载就弹权限框会被用户反感，
 * 而且 Chrome 会惩罚"用户未交互就请求权限"的站点。
 */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!notificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** 发送系统通知。silent=true，因为提示音由我们自己合成播放 */
export function showNotification(title: string, body: string): boolean {
  if (!notificationSupported() || Notification.permission !== 'granted') {
    return false;
  }
  try {
    new Notification(title, { body, silent: true, tag: 'lumora-phase' });
    return true;
  } catch {
    // 移动端 Chrome 等环境不支持构造函数，静默降级到页面内 toast
    return false;
  }
}
