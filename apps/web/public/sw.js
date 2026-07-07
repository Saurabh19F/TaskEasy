/**
 * TaskEasy Service Worker
 *
 * Strategy:
 * - Static assets (JS, CSS, fonts, images): Cache-first with network fallback
 * - API requests (/api/**): Network-first with cache fallback (stale-while-revalidate)
 * - Navigation (HTML pages): Network-first, fallback to /offline
 *
 * Install: cache the app shell + offline page.
 * Activate: clean up old caches.
 * Fetch: route by request type.
 */

const CACHE_NAME = 'taskeasy-v2';
const STATIC_CACHE = 'taskeasy-static-v2';
const API_CACHE = 'taskeasy-api-v2';

const APP_SHELL = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch {
            // Ignore shell assets that are temporarily unavailable so the SW
            // can still install and update other cached entries.
          }
        }),
      );
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_NAME, STATIC_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) return;

  // API: network-first
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets: cache-first
  if (request.destination === 'script' || request.destination === 'style' ||
      request.destination === 'font' || request.destination === 'image') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match('/offline');
        if (offline) return offline;
        const root = await caches.match('/');
        if (root) return root;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'TaskEasy', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'TaskEasy', {
      body: payload.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: payload.data ?? {},
      tag: payload.tag ?? 'taskeasy-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      const existing = cls.find((c) => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); return existing.navigate(url); }
      return clients.openWindow(url);
    })
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
