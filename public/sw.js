const CACHE_NAME = 'ChuaiPoker-v1';
const ASSETS_TO_CACHE = [
  '/ChuaiPoker/',
  '/ChuaiPoker/index.html',
  '/ChuaiPoker/vite.svg',
  '/ChuaiPoker/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((error) => console.error('Cache failed:', error))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 检查是否是有效的响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 克隆响应
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            // 只缓存 HTML 文件和其他静态资源，不缓存 JS/CSS
            const url = new URL(event.request.url);
            if (event.request.url.endsWith('.html') || 
                event.request.url.includes('vite.svg') ||
                event.request.url.includes('manifest.json') ||
                event.request.url.endsWith('/')) {
              cache.put(event.request, responseToCache);
            }
          });

        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存获取
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  
  // 立即控制所有客户端
  return self.clients.claim();
});