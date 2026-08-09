// KataPasal PWA app — search + bookmark + export
const CACHE = 'katapasal-v1';
// ponytail: GitHub Pages subfolder = /katapasal/ — deteksi dari location.pathname
const SUB = location.pathname.split('/').filter(Boolean)[0] || '';
const BASE = location.origin + (SUB ? '/' + SUB + '/' : '/');
const A = (p) => new URL(p, BASE).href; // resolve full URL ke /katapasal/...
const ASSETS = [A('/'), A('/index.html'), A('/style.css'), A('/app.js'), A('/manifest.json'), A('/icons/icon-192.png'), A('/icons/icon-512.png'), A('/icons/katapasal-logo.png'), A('/data/pasal.json'), A('/sw.js')];

let PASAL = [], BOOKMARK = [];
const qs = q => document.querySelector(q);
const qsa = q => document.querySelectorAll(q);
const escapeHtml = s => (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

function bmKey(e){return `${e.source}:${e.pasal}`;}
const bStore = ()=>'localStorage' in window ? JSON.parse(localStorage.getItem('b')||'[]') : [];
const activeFilter = ()=> qsa('.filter-btn.active')[0]?.dataset.filter||'all';

function render(keyword='', filter='all'){
  let out = PASAL.filter(e=>{
    if (filter!=='all' && e.source!==filter) return false;
    if (!keyword) return true;
    return (e.txt||'').toLowerCase().includes(keyword) || String(e.pasal).includes(keyword);
  });
  const isBm = filter==='bookmarks';
  if (isBm) out = out.filter(e=>BOOKMARK.includes(bmKey(e)));

  const rc = qs('#results');
  if (!out.length){ rc.innerHTML = isBm ? '<p class="empty">🔖 Belum ada pasal disukai.</p>' : '<p class="empty">Tidak ada pasal cocok.</p>'; updateBmBadge(); return; }

  rc.innerHTML = out.map(e=>{
    const k = bmKey(e);
    const isFav = BOOKMARK.includes(k);
    return `<div class="card" data-id="${k}">
      <h3>${e.source} — Pasal ${e.pasal}</h3>
      <p class="${isFav?'':' truncated'}">${escapeHtml((e.txt||'').slice(0,600))}…</p>
      <button class="bm-btn ${isFav?'on':''}" onclick="toggleBm('${k}')">
        ${isFav?'⭐':'🔖'}
      </button>
    </div>`;
  }).join('');
  updateBmBadge();
}

function updateBmBadge(){
  qs('#bm-total').textContent = BOOKMARK.length;
  qs('#bm-count').innerHTML = BOOKMARK.length ? `<sup>${BOOKMARK.length}</sup>` : '';
}

// bookmark toggle
window.toggleBm = (key)=>{
  const i = BOOKMARK.indexOf(key);
  if (i>=0) BOOKMARK.splice(i,1); else BOOKMARK.push(key);
  localStorage.setItem('b', JSON.stringify(BOOKMARK));
  render(qs('#q').value.trim().toLowerCase(), activeFilter());
};

// load+persist bookmarks
function loadBookmarks(){ BOOKMARK = bStore(); }

// bottom nav
qs('#bookmarks-btn')?.addEventListener('click', ()=>{
  qs('#bookmark-panel').classList.add('open');
  render('', 'bookmarks');
});
qs('#close-bm')?.addEventListener('click', ()=>{ qs('#bookmark-panel').classList.remove('open'); render(qs('#q').value.trim().toLowerCase(), activeFilter()); });
qs('#export-btn')?.addEventListener('click', exportBm);

function exportBm(){
  const items = BOOKMARK.map(k=>PASAL.find(p=>bmKey(p)===k)).filter(x=>x);
  const blob = new Blob([JSON.stringify(items, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'katapasal-bookmark.json';
  a.click();
}

async function init(){
  try {
    const res = await fetch(A('/data/pasal.json'));
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    PASAL = await res.json();
    console.log('KataPasal: data loaded', PASAL.length, 'pasal');
  } catch(e){
    console.error('KataPasal init error:', e);
    qs('#results').innerHTML = '<p class="empty">Gagal memuat data: ' + e.message + '</p>'; return;
  }
  loadBookmarks();

  // search
  const q = qs('#q');
  q.addEventListener('input', ()=>{
    qs('#clear').hidden = !q.value;
    render(q.value.trim().toLowerCase(), activeFilter());
  });
  const cl = qs('#clear');
  cl?.addEventListener('click', ()=>{ q.value=''; cl.hidden=true; render('', activeFilter()); });

  // filter
  qsa('.filter-btn').forEach(b=>{
    if (b.dataset.filter==='all') b.classList.add('active');
    b.addEventListener('click', ()=>{
      qsa('.filter-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      render(q.value.trim().toLowerCase(), b.dataset.filter);
    });
  });

  // SW
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(A('/sw.js')).catch(()=>0);
  render();
  console.log('KataPasal: init complete');
}
document.addEventListener('DOMContentLoaded', init);
init();
window.KP = { init, PASAL: ()=>PASAL, BOOKMARK: ()=>BOOKMARK }; // debug helper
