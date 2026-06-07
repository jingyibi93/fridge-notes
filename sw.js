const CACHE_NAME = 'fridge-v13';

// 安装：不阻塞，缓存尽力而为
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 逐个缓存，单个失败不影响整体
      return Promise.allSettled([
        cache.add('/'),
        cache.add('/manifest.json'),
        cache.add('/icons/icon-192x192.png'),
        cache.add('/icons/icon-512x512.png')
      ]);
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// 请求策略：API请求走网络，静态资源优先缓存
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  
  // API请求不走缓存
  if (url.pathname.indexOf('/api/') === 0) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify({ok: false, offline: true}), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // 其他请求：网络优先，失败用缓存
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});
