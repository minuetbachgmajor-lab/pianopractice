/* Offline app shell.
 *
 * Bump CACHE when any shell file changes: the old cache is deleted on
 * activate, so an update lands on the next launch. Written in ES5-compatible
 * syntax because the iPad mini 3's service worker runtime is Safari 12's. */
var CACHE = 'piano-practice-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/criteria.js',
  './js/stickers.js',
  './js/badges.js',
  './js/store.js',
  './js/engine.js',
  './js/stats.js',
  './js/ui.js',
  './js/charts.js',
  './js/view-home.js',
  './js/view-practice.js',
  './js/view-collection.js',
  './js/view-parent.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Cache first: at the piano there may be no wifi, and the shell never
 * changes between releases. */
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) { return hit; }
      return fetch(event.request).then(function (res) {
        if (!res || res.status !== 200 || res.type !== 'basic') { return res; }
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
