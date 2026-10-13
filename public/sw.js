/*
 * DoItLocal service worker: makes the site work offline after the first visit.
 *
 * At build time, the placeholders below are replaced with the list of every file in the build
 * (see build/doitlocal-plugin.ts), and the whole site is cached on install so even the lazily
 * loaded tool code works offline. The worker only handles the site's own static files; it
 * never sees the files you process.
 *
 * Pages come from the network first, so a new deploy shows up on the next visit; their cached
 * copies are only used offline. Build assets have a content hash in their names and never
 * change, so they come from the cache first.
 */
/* global __PRECACHE__ */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'doitlocal-' + VERSION;
const SCOPE = self.registration.scope;
const HASHED_ASSETS = new URL('assets/', SCOPE).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).href)))
      // Take over now instead of waiting for every tab of the site to close, which on a phone
      // can take weeks. Open pages pick up the new version on their next navigation.
      .then(() => self.skipWaiting()),
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    url.pathname.startsWith(HASHED_ASSETS) ? cacheFirst(request) : networkFirst(request),
  );
});

async function cacheFirst(request) {
  return (await caches.match(request)) ?? fetch(request);
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ??
      (request.mode === 'navigate' ? await offlinePage(request.url) : undefined);
    if (cached) return cached;
    throw error;
  }
}

/** The cached copy of a page ("/pdfold" and "/pdfold/" are pdfold/index.html), else the app. */
async function offlinePage(href) {
  const url = new URL(href);
  const folder = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  return (
    (await caches.match(new URL(folder + 'index.html', url.origin).href)) ??
    caches.match(new URL('index.html', SCOPE).href)
  );
}
