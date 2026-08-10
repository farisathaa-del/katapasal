// KataPasal SW — offline cache
const CACHE = 'katapasal-v2';
const BASE = '/katapasal';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/style.css',
  BASE + '/app.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/icons/katapasal-logo.png',
  BASE + '/data/pasal.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
