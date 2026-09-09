// FRZO Service Worker
// Cache is tied to VERSION passed via ?v= on registration.
// index.html bumps VERSION -> new SW URL -> new cache -> old
// cache deleted -> users get fresh build. Receipt scanning
// still needs internet (Claude API + Drive).

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

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
