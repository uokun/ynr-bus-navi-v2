/**
 * Yokohama Municipal Bus Transit Navigator - Service Worker
 * Version: v1.0.0
 */

const CACHE_NAME = 'yokohama-bus-nav-v1.0.0';

// Core App Shell Assets for offline caching
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/responsive.css',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((error) => {
        console.warn('[SW] Pre-caching failed:', error);
      })
  );
});

/**
 * Service Worker Activation & Cache Cleanup
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/**
 * Fetch Strategy:
 * - ODPT API Requests (api.odpt.org): Network-First (with offline error fallback)
 * - App Shell / Static Assets: Cache-First with Stale-While-Revalidate
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 1. ODPT API dynamic requests -> Network-First (Do not stale-cache real-time bus locations)
  if (url.hostname.includes('api.odpt.org')) {
    event.respondWith(
      fetch(request)
        .catch((error) => {
          // When offline, let client app handle mock or storage fallback
          return new Response(JSON.stringify({ error: 'offline', message: 'ネットワークに接続されていません' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 2. App Shell & Static Assets -> Cache-First with Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache refresh (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch errors when offline
          });

        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Fallback to index.html for navigation requests if available
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline Asset Unavailable', { status: 503 });
        });
    })
  );
});

/**
 * Handle incoming postMessages (e.g. skipWaiting trigger or cache clear)
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
