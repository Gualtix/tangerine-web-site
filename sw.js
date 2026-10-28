/*
 * Service worker: installability plus one offline message, nothing more. The menu and prices must always
 * be live, so it caches no site content.
 *
 *   install   precaches offline.html (self-contained: inline CSS and SVG, system fonts, no other requests)
 *   navigate  network first (via navigation preload); if the page load fails, answers with offline.html
 *   anything else  not handled, so the browser fetches it as if there were no service worker
 *
 * Bump CACHE when offline.html changes; activate deletes every older cache.
 * Registered by js/app.js with a relative URL, so its scope is this folder wherever the site is hosted.
 */
const CACHE = 'date-gusto-offline-v2';
const OFFLINE_URL = './offline.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    // starts the page request in parallel with the worker's boot, so network first costs no extra latency
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith((async () => {
    try {
      return (await e.preloadResponse) || (await fetch(e.request));
    } catch {
      return caches.match(OFFLINE_URL);
    }
  })());
});
