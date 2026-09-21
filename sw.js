/* Offline app shell.
 *
 * Strategy: network first, cache as the fallback.
 *
 * This started out cache-first with a hand-bumped cache name, which is a
 * trap: forget the bump on one release and every installed device keeps
 * serving the old build forever, silently, with no way for the person
 * holding the iPad to tell. That happened. Network-first removes the
 * failure mode entirely — a device that can reach the network always gets
 * the current files, and the cache is what makes the app work at a piano
 * with no wifi, which is its actual job.
 *
 * The fetch races a short timeout so flaky wifi falls back to the cache
 * quickly instead of hanging on a blank screen.
 *
 * ES5 syntax throughout: the iPad mini 3 runs Safari 12's worker runtime.
 */
var VERSION = '2026-09-21.4';
var CACHE = 'piano-practice-' + VERSION;
var NET_TIMEOUT_MS = 3000;

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

/* Lets the page ask which build it is actually running. */
self.addEventListener('message', function (event) {
  if (event.data === 'version' && event.source) {
    event.source.postMessage({ type: 'version', version: VERSION });
  }
});

function timedFetch(request) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; reject(new Error('timeout')); }
    }, NET_TIMEOUT_MS);
    fetch(request).then(function (res) {
      if (settled) { return; }
      settled = true; clearTimeout(timer); resolve(res);
    }, function (err) {
      if (settled) { return; }
      settled = true; clearTimeout(timer); reject(err);
    });
  });
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }
  /* only our own files; anything else is none of this worker's business */
  if (event.request.url.indexOf(self.registration.scope) !== 0) { return; }

  event.respondWith(
    timedFetch(event.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
