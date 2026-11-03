// Service Worker – Offline-Betrieb. VERSION und DATEIEN setzt tools/generieren.py ein.
const VERSION = '__VERSION__';
const CACHE = 'rezeptbuch-' + VERSION;
const DATEIEN = __DATEIEN__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)));
  // Kein skipWaiting: die App zeigt „Neue Rezepte verfügbar – neu laden“ und der Nutzer entscheidet.
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('rezeptbuch-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((treffer) => treffer || fetch(req).then((antwort) => {
      if (antwort.ok) { const kopie = antwort.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); }
      return antwort;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
