/*
 * DoItLocal service worker: makes the site work offline after the first visit.
 *
 * At build time, the placeholders below are replaced with the list of every file in
 * the build (see build/doitlocal-plugin.ts). On install the whole site is cached, so
 * even the lazily loaded PDF code is available offline. The worker only ever handles
 * the site's own static files; it never sees the files you process.
 */
/* global __PRECACHE__ */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'doitlocal-' + VERSION;
const SCOPE = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).href))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions.
      for (const key of await caches.keys()) {
        if (key.startsWith('doitlocal-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** Look up a request in the cache, trying the directory-index form for page URLs. */
async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  const direct = await cache.match(url.href);
  if (direct) return direct;
  if (request.mode === 'navigate') {
    const withSlash = url.pathname.endsWith('/') ? url.href : url.href + '/';
    return (await cache.match(withSlash)) || (await cache.match(new URL('index.html', SCOPE).href));
  }
  return undefined;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await fromCache(request);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (error) {
        if (request.mode === 'navigate') {
          const fallback = await caches.match(new URL('index.html', SCOPE).href);
          if (fallback) return fallback;
        }
        throw error;
      }
    })(),
  );
});
