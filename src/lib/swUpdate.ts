/**
 * Service Worker 的"新版本就绪"检测与切换。
 *
 * 背景：sw.js 注册后如果直接 skipWaiting，新版本会静默接管，但**当前打开的页面**仍然是旧代码，
 * 用户可能几周都在用一个旧版本，也不知道可以刷新。这里改成标准的可感知更新：
 * 新版本安装完成 → 通知 UI → 用户点「刷新」→ 才 skipWaiting 并重载。
 */

let registration: ServiceWorkerRegistration | null = null;

/** 开始监听新版本；检测到「等待中」的新版本时回调。返回取消函数 */
export function watchServiceWorkerUpdate(onReady: () => void): () => void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return () => undefined;
  }

  let cancelled = false;
  let worker: ServiceWorker | null = null;

  const attach = (reg: ServiceWorkerRegistration) => {
    registration = reg;

    // 上次打开时已经装好但没刷新：直接提示
    if (reg.waiting && navigator.serviceWorker.controller) {
      onReady();
    }

    reg.addEventListener('updatefound', () => {
      worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (cancelled) return;
        if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
          onReady();
        }
      });
    });
  };

  void navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      if (!cancelled) attach(reg);
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
  };
}

/** 应用更新：让等待中的新 SW 接管，接管完成后重载页面 */
export function applyServiceWorkerUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
