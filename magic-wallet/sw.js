const CACHE_NAME = 'magic-wallet-v2';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icon.svg',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://cdn.jsdelivr.net/npm/jsurl@0.1.5/lib/jsurl.js'
];

// Install event: Pre-cache core app shell and external dependencies
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[Service Worker] Pre-caching offline assets');
      await Promise.all(
        PRECACHE_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Service Worker] Failed to precache ${url}:`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Cache-first, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('index.html') || caches.match('./');
        }
      });
    })
  );
});
