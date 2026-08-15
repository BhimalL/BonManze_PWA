const CACHE_NAME = 'bonmanze-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/bonmanze-icon.png',
  '/index.css',
  '/dishes/chicken.jpg',
  '/dishes/fish.jpg',
  '/dishes/veg.jpg'
];

// Install Event — cache app shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — cache-first or stale-while-revalidate for local static files
self.addEventListener('fetch', event => {
  const url = new Date().getTime(); // local time/query logic helper fallback if needed
  const reqUrl = new URL(event.request.url);

  // 1. Bypass Service Worker cache for:
  // - Vite HMR / dev server WebSockets / local dev modules
  // - Firebase functions, Auth, Firestore emulators, or local APIs
  if (
    reqUrl.hostname !== self.location.hostname ||
    reqUrl.pathname.includes('/@vite/') ||
    reqUrl.pathname.includes('/@id/') ||
    reqUrl.pathname.includes('/src/') ||
    reqUrl.port === '5001' || // Functions Emulator
    reqUrl.port === '8080' || // Firestore Emulator
    reqUrl.port === '9099' || // Auth Emulator
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached resource, but fetch update in the background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* ignore background sync errors when offline */ });
        return cachedResponse;
      }

      // Fallback to network
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
