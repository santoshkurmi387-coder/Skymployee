/**
 * service-worker.js
 * PWA Service Worker — Caches app shell for offline use.
 * Strategy: Cache-first for static assets, Network-first for API calls.
 */

const CACHE_NAME    = 'courierops-v1';
const CACHE_URLS    = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  // External CDN resources
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ── Install: cache all shell assets ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())  // activate immediately
  );
});

// ── Activate: remove old caches ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-first for API ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls always go to network (never serve stale API data offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'You are offline. Please check your connection.' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // For everything else, try cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))  // offline fallback
  );
});
