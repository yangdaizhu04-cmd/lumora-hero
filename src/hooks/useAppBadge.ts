import { useEffect } from 'react';

interface BadgeNavigator {
  setAppBadge?: (value?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/**
 * 应用图标角标（安装为 PWA 后可见）：显示未完成任务数。
 * 不支持的浏览器直接跳过，不做任何降级提示。
 */
export function useAppBadge(count: number): void {
  useEffect(() => {
    const nav = navigator as Navigator & BadgeNavigator;
    if (!nav.setAppBadge) return;

    if (count > 0) void nav.setAppBadge(count).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [count]);
}
