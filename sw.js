/* Prayer Times WebApp service worker. No build step: bump CACHE_VERSION manually. */
const CACHE_VERSION = 'pt-web-v4';
const TILE_CACHE = 'pt-tiles-v1';
const PRECACHE = [
  './',
  './index.html',
  './compass.html',
  './names.html',
  './dhikr.html',
  './calendar.html',
  './missed.html',
  './settings.html',
  './about.html',
  './city.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/vendor-leaflet.css',
  './css/images/layers.png',
  './css/images/layers-2x.png',
  './js/app.js',
  './js/boot.js',
  './js/core/config.js',
  './js/core/format.js',
  './js/core/http.js',
  './js/core/i18n.js',
  './js/core/icons.js',
  './js/core/settings.js',
  './js/core/storage.js',
  './js/core/theme.js',
  './js/services/api.js',
  './js/services/cities.js',
  './js/services/dhikr.js',
  './js/services/hijri.js',
  './js/services/qibla.js',
  './js/services/times.js',
  './js/components/app-shell.js',
  './js/components/city-card.js',
  './js/components/city-list.js',
  './js/components/city-search.js',
  './js/components/month-view.js',
  './js/components/ui.js',
  './js/pages/about.js',
  './js/pages/calendar.js',
  './js/pages/missed.js',
  './js/pages/city.js',
  './js/pages/compass.js',
  './js/pages/dhikr.js',
  './js/pages/names.js',
  './js/pages/settings.js',
  './js/pages/times.js',
  './js/vendor/adhan.js',
  './js/vendor/htmx.min.js',
  './js/vendor/leaflet.js',
  './js/vendor/images/marker-icon.png',
  './js/vendor/images/marker-icon-2x.png',
  './js/vendor/images/marker-shadow.png',
  './js/vendor/images/layers.png',
  './js/vendor/images/layers-2x.png',
  './data/i18n/de.json',
  './data/i18n/en.json',
  './data/i18n/tr.json',
  './data/names.json',
  './data/hijri.json',
  './assets/icons/menu/times.png',
  './assets/icons/menu/compass.png',
  './assets/icons/menu/names.png',
  './assets/icons/menu/calendar.png',
  './assets/icons/menu/missed.png',
  './assets/icons/menu/dhikr.png',
  './assets/icons/menu/settings.png',
  './assets/icons/menu/about.png',
  './assets/img/appicon.png',
  './assets/img/allah.png',
  './assets/img/kaaba.png',
  './assets/img/source-diyanet.png',
  './assets/img/source-igmg.png',
  './assets/img/source-nvc.png',
  './assets/img/source-semerkand.png',
  './assets/img/icon-32.png',
  './assets/img/icon-64.png',
  './assets/img/icon-180.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/fonts/roboto-latin.woff2',
  './assets/fonts/roboto-latin-ext.woff2',
  './assets/fonts/naskh-arabic.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION && key !== TILE_CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

function isTileRequest(url) {
  return url.hostname.endsWith('tiles.maps.eox.at')
    || url.hostname.endsWith('tile.openstreetmap.org')
    || url.hostname.endsWith('tile.openstreetmap.fr');
}

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= 300) return;
  await Promise.all(keys.slice(0, keys.length - 300).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok || response.type === 'opaque') {
            cache.put(request, response.clone()).then(trimTileCache);
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./index.html');
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
    }),
  );
});
