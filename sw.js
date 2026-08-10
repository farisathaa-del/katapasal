// KataPasal SW — offline cache (no index.html caching — always fresh)
const CACHE = 'katapasal-v5';
const BASE = '/katapasal';
const ASSETS = [
  BASE + '/style.css',
  BASE + '/app.v2.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/icons/katapasal-logo.png',
  BASE + '/data/pasal.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache navigation requests (HTML) — always fetch fresh
  if (e.request.mode === 'navigate') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
