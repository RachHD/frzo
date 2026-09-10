// FRZO Service Worker (v0.3.3+: network-first for HTML)
// index.html is fetched from network on every visit so app
// updates arrive on the first reload. Icons and manifest stay
// cache-first since they change rarely. Falls back to cache
// when offline. Receipt scanning still needs internet.

const url = new URL(self.location.href);
const VERSION = url.searchParams.get('v') || 'dev';
const CACHE = 'frzo-v' + VERSION;
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const isApi = u.hostname.includes('anthropic') ||
                u.hostname.includes('googleapis') ||
                u.hostname.includes('google');
  if (isApi) return;

  // Network-first for HTML navigations: updates land on first reload
  const isDoc = e.request.mode === 'navigate'
             || e.request.destination === 'document'
             || u.pathname.endsWith('/')
             || u.pathname.endsWith('/index.html');
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(e.request).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, static assets)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
