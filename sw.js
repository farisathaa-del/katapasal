// KataPasal SW — precache statis di subfolder GitHub Pages
const CACHE = 'katapasal-v1';
// Semua aset resolusi relatif — SW auto ikut base URL /katapasal/
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/katapasal-logo.png',
  './data/pasal.json',
  './sw.js'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
