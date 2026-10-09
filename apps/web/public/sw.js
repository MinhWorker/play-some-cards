const CACHE_NAME = 'xomdao-offline-v1';
// Caches from before the rename to Xóm Đảo are removed too.
const CACHE_PREFIXES = ['xomdao-offline-', 'psc-offline-'];
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const offlinePage = await (await caches.open(CACHE_NAME)).match(OFFLINE_URL);
      return offlinePage ?? Response.error();
    }),
  );
});
