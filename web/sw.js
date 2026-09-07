// Melix Teacher Service Worker — v2
// 设计原则：
//  - 页面 HTML（/、/index.html）走「网络优先」，绝不缓存旧版（避免登录后卡在旧页面/登录页）
//  - 真正的静态资源（vendor 解析库、logo、manifest）走「缓存优先」加速
//  - /api/ 一律走网络，不缓存
const CACHE_NAME = 'melix-static-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png',
  '/lib/vendor/xlsx.full.min.js',
  '/lib/vendor/mammoth.browser.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: always network
  if (url.pathname.startsWith('/api/')) return;

  // 页面导航 / HTML：网络优先，失败才回退缓存（保证永远拿到最新版）
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/__app_shell__', clone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/__app_shell__')))
    );
    return;
  }

  // 其它静态资源：缓存优先 + 后台更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
