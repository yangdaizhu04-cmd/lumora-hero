/**
 * Lumora Focus 的 Service Worker。
 *
 * 策略：
 * - 导航请求：网络优先，离线回退到缓存的 index.html（可离线打开）
 * - 同源静态资源（音频 / 字体 / 构建产物 / 图片）：缓存优先（体积大、内容不变）
 * - 跨域请求（背景视频 CDN）：完全交给浏览器 HTTP 缓存，避免把几十 MB 的视频塞进 Cache Storage
 *
 * 更新：**不再自动 skipWaiting**。自动接管会让正在使用的页面继续跑旧代码（用户毫无感知，
 * 可能几周不刷新）；现在由页面提示"新版本已就绪"，用户点击后才 skipWaiting 并重载
 * （见 src/lib/swUpdate.ts）。
 *
 * 注意：换版本时要同时改 CACHE 名称，activate 阶段会清理旧缓存。
 */
const CACHE = 'lumora-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/overlay.webp',
  '/fonts/instrument-serif-latin-400-normal.woff2',
  '/fonts/instrument-serif-latin-400-italic.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// 页面确认后才接管，避免"旧页面 + 新 SW"的资源错配
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? (await cache.match('/index.html')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 跨域（背景视频）不接管
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  const isStatic =
    url.pathname.startsWith('/audio/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png');

  if (isStatic) {
    event.respondWith(cacheFirst(request));
  }
});
