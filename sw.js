// --- CACHE UPDATE VERSION CONTROL ---
// Zorg dat deze v3 (of hoger) ALTIJD meestijgt als je de APP_VERSION in index.html ophoogt!
const CACHE_NAME = 'mexicanen-cache-v4';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. Cache installatie
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // We gebruiken een milde fouttolerantie bij het installeren van externe CDNs
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Forceer de nieuwe SW om direct actief te worden
  );
});

// 2. Cache activatie & opruimen oude caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Oude cache opgeruimd:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Neem direct alle openstaande tabbladen over
  );
});

// 3. Network-First Strategie met extra vangnetten (Gedebugged)
self.addEventListener('fetch', (event) => {
  // BUGFIX 1: Negeer niet-HTTP(S) verzoeken (voorkomt crashes door Chrome/Edge extensies)
  if (!event.request.url.startsWith('http')) return;

  // BUGFIX 2: Alleen GET-requests mogen gecached worden
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Als het een geldig antwoord is, sla een kopie op in de cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Geen internet? Pak hem direct uit de cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Ultiem vangnet als een extern script/bron écht niet in de cache zit en je bent offline
          return new Response('Offline content niet beschikbaar', { status: 503 });
        });
      })
  );
});