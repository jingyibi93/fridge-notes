const CACHE_NAME = "fridge-memo-pwa-v20260614-global-var-fix";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./runtime-config.js",
  "./css/styles.css",
  "./js/app.js",
  "./js/store.js",
  "./js/render.js",
  "./js/drag.js",
  "./js/supabase-config.js",
  "./js/cloud-sync.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/magnets/beer.png",
  "./assets/magnets/yangjiaobao.png",
  "./assets/magnets/pain.png",
  "./assets/magnets/milk.png",
  "./assets/magnets/coffee.png",
  "./assets/magnets/kersong.png",
  "./assets/magnets/strawberry.png",
  "./assets/magnets/bread.png",
  "./assets/magnets/egg.png",
  "./assets/magnets/bread2.png",
  "./assets/magnets/kiwi-fruit.png",
  "./assets/magnets/tanghulu.png",
  "./assets/magnets/cookie.png",
  "./assets/magnets/donut.png",
  "./assets/magnets/basket.png",
  "./assets/magnets/croissant.png",
  "./assets/magnets/espresso.png",
  "./assets/magnets/pain-bag.png",
  "./assets/magnets/tart.png",
  "./assets/magnets/toaster.png",
  "./assets/magnets/tomato-bag.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
