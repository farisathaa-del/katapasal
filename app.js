// KataPasal — bank pasal hukum pidana
// ponytail: semua path absolut /katapasal/ — GitHub Pages subfolder, no <base> dependency
const SUB = '/katapasal';
const PASAL_URL = SUB + '/data/pasal.json';
const SW_URL = SUB + '/sw.js';
const CACHE = 'katapasal-v2';

let PASAL = [], BOOKMARK = [];
const qs = q => document.querySelector(q);
const qsa = q => document.querySelectorAll(q);
const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

function bmKey(e){ return e.source + '|' + e.pasal; }
function loadBm(){ try { return JSON.parse(localStorage.getItem('kb')||'[]'); } catch { return []; } }
function saveBm(){ localStorage.setItem('kb', JSON.stringify(BOOKMARK)); }
const activeF = () => qsa('.filter-btn.active')[0]?.dataset.filter || 'all';

function render(kw='', filter='all'){
  let out = PASAL;
  if (filter !== 'all') out = out.filter(e => e.source === filter);
  if (filter === 'bookmarks') out = out.filter(e => BOOKMARK.includes(bmKey(e)));
  if (kw) out = out.filter(e => (e.txt||'').toLowerCase().includes(kw) || String(e.pasal).includes(kw));

  const rc = qs('#results');
  if (!out.length){
    rc.innerHTML = '<p class="empty">' + (filter==='bookmarks'?'🔖 Belum ada bookmark.':'Tidak ditemukan.') + '</p>';
    updateBadge();
    return;
  }
  rc.innerHTML = out.map(e => {
    const k = bmKey(e), fav = BOOKMARK.includes(k);
    return '<div class="card"><h3>' + e.source + ' — Pasal ' + e.pasal + '</h3>' +
      '<p>' + esc((e.txt||'').slice(0,500)) + '</p>' +
      '<button class="bm-btn ' + (fav?'on':'') + '" data-key="' + esc(k) + '">' + (fav?'⭐':'🔖') + '</button></div>';
  }).join('');
  updateBadge();
}

function updateBadge(){
  const n = BOOKMARK.length;
  qs('#bm-total').textContent = n;
  const bc = qs('#bm-count');
  bc.innerHTML = n ? '<sup>'+n+'</sup>' : '';
}

// event delegation for bookmark buttons
document.addEventListener('click', e => {
  const btn = e.target.closest('.bm-btn');
  if (!btn) return;
  const key = btn.dataset.key;
  const i = BOOKMARK.indexOf(key);
  if (i >= 0) BOOKMARK.splice(i, 1); else BOOKMARK.push(key);
  saveBm();
  render(qs('#q').value.trim().toLowerCase(), activeF());
});

// bookmark panel
qs('#bookmarks-btn').addEventListener('click', () => {
  qs('#bookmark-panel').classList.add('open');
  render('', 'bookmarks');
});
qs('#close-bm').addEventListener('click', () => {
  qs('#bookmark-panel').classList.remove('open');
  render(qs('#q').value.trim().toLowerCase(), activeF());
});

// export
qs('#export-btn').addEventListener('click', () => {
  const items = BOOKMARK.map(k => PASAL.find(p => bmKey(p) === k)).filter(Boolean);
  const blob = new Blob([JSON.stringify(items, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'katapasal-bookmark.json';
  a.click();
});

// search
qs('#q').addEventListener('input', function(){
  qs('#clear').hidden = !this.value;
  render(this.value.trim().toLowerCase(), activeF());
});
qs('#clear').addEventListener('click', () => {
  qs('#q').value = '';
  qs('#clear').hidden = true;
  render('', activeF());
});

// filter
qsa('.filter-btn').forEach(b => {
  if (b.dataset.filter === 'all') b.classList.add('active');
  b.addEventListener('click', () => {
    qsa('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render(qs('#q').value.trim().toLowerCase(), b.dataset.filter);
  });
});

// init: load data
fetch(PASAL_URL)
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    PASAL = d;
    BOOKMARK = loadBm();
    render();
    console.log('KataPasal: ' + PASAL.length + ' pasal loaded');
  })
  .catch(e => {
    console.error('KataPasal error:', e);
    qs('#results').innerHTML = '<p class="empty">Gagal memuat data: ' + e.message + '</p>';
  });

// register SW
if ('serviceWorker' in navigator) navigator.serviceWorker.register(SW_URL).catch(() => 0);
