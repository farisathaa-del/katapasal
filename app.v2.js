// KataPasal — Kamus Pasal Hukum Pidana Indonesia
// ponytail: semua path absolut /katapasal/, hash routing SPA
const SUB = '/katapasal';
const PASAL_URL = SUB + '/data/pasal.json';
const SW_URL = SUB + '/sw.js';
const CACHE = 'katapasal-v4';
const PAGE = 30;

let PASAL = [], BOOKMARK = [], FILTERED = [];
let shown = 0;
const qs = q => document.querySelector(q);
const qsa = q => document.querySelectorAll(q);
const esc = s => (s||'').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c]);
const fmt = t => esc(t||'').replace(/\n/g, '<br>');

function bmKey(e){ return e.source + '|' + e.pasal; }
function loadBm(){ try { return JSON.parse(localStorage.getItem('kb')||'[]'); } catch { return []; } }
function saveBm(){ localStorage.setItem('kb', JSON.stringify(BOOKMARK)); }
const activeF = () => qsa('.filter-btn.active')[0]?.dataset.filter || 'all';

// --- Detail View ---
function showDetail(id) {
  const [src, num] = id.split('|');
  const e = PASAL.find(p => p.source === src && String(p.pasal) === num);
  if (!e) { location.hash = '#/'; return; }

  qs('#list-view').hidden = true;
  qs('#detail-view').hidden = false;
  qs('.search-bar').hidden = true;
  qs('.filters').hidden = true;
  qs('#load-more').hidden = true;

  const k = bmKey(e);
  const isBm = BOOKMARK.includes(k);
  const ancaman = e.ancaman_pidana || '';
  const bab = e.bab || '';
  const bagian = e.bagian || '';

  let ancamanBadge = '';
  if (ancaman) {
    const isMati = ancaman.includes('mati');
    const isSeumur = ancaman.includes('seumur');
    const cls = isMati ? 'badge-mati' : isSeumur ? 'badge-seumur' : 'badge-pidana';
    ancamanBadge = '<span class="badge ' + cls + '">⚡ ' + esc(ancaman) + '</span>';
  }

  let hirarki = '';
  if (bab || bagian) {
    hirarki = '<div class="hirarki">' +
      (bab ? '<span class="hirarki-item">' + esc(bab) + '</span>' : '') +
      (bagian ? '<span class="hirarki-item">' + esc(bagian) + '</span>' : '') +
      '</div>';
  }

  const sourceColors = {
    'KUHP 2023': '#2563EB', 'KUHAP 2025': '#0D9488',
    'KUHP 1946': '#6B7280', 'KUHAP 1981': '#374151',
    'Penyesuaian 2026 Pasal VII': '#D97706', 'Kategori Denda': '#DC2626'
  };
  const badgeColor = sourceColors[e.source] || '#6B7280';

  document.title = e.source + ' — Pasal ' + e.pasal + ' | KataPasal';

  qs('#detail-view').innerHTML =
    '<div class="detail-card">' +
      '<a href="#/" class="back-btn">← Kembali</a>' +
      '<div class="detail-header">' +
        '<span class="source-badge" style="background:' + badgeColor + '">' + esc(e.source) + '</span>' +
        '<h2>Pasal ' + e.pasal + '</h2>' +
      '</div>' +
      hirarki +
      (ancamanBadge ? '<div class="ancaman-row">' + ancamanBadge + '</div>' : '') +
      '<div class="detail-text">' + fmt(e.txt) + '</div>' +
      '<div class="detail-actions">' +
        '<button class="bm-btn-detail ' + (isBm?'on':'') + '" data-key="' + esc(k) + '">' + (isBm?'⭐ Bookmark':'🔖 Bookmark') + '</button>' +
        '<button class="copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent(\'' + encodeURIComponent(e.txt) + '\')).then(()=>this.textContent=\'✓ Tersalin\')">📋 Salin Teks</button>' +
      '</div>' +
      (e.pasal_terkait_lama && e.pasal_terkait_lama.length ?
        '<div class="mapping-section"><h4>📍 Pemetaan dari KUHP Lama</h4><div class="mapping-list">' +
        e.pasal_terkait_lama.map(r => '<span class="mapping-badge">' + esc(r) + '</span>').join('') +
        (e.catatan_perubahan ? '<span class="mapping-cat">' + esc(e.catatan_perubahan) + '</span>' : '') +
        '</div></div>' : '') +
    '</div>';

  window.scrollTo(0, 0);
}

function showList() {
  qs('#list-view').hidden = false;
  qs('#detail-view').hidden = true;
  qs('.search-bar').hidden = false;
  qs('.filters').hidden = false;
  document.title = 'KataPasal — Bank Pasal Hukum Pidana';
}

// --- List View ---
function cardHTML(e) {
  const k = bmKey(e), fav = BOOKMARK.includes(k);
  const full = esc(e.txt||'');
  const short = full.length > 300 ? full.slice(0,300) + '…' : full;
  const needsExpand = full.length > 300;
  const ancaman = e.ancaman_pidana ? '<span class="card-ancaman">⚡ ' + esc(e.ancaman_pidana) + '</span>' : '';

  const sourceColors = {
    'KUHP 2023': '#2563EB', 'KUHAP 2025': '#0D9488',
    'KUHP 1946': '#6B7280', 'KUHAP 1981': '#374151',
    'Penyesuaian 2026 Pasal VII': '#D97706', 'Kategori Denda': '#DC2626'
  };
  const badgeColor = sourceColors[e.source] || '#6B7280';

  return '<div class="card" data-key="' + esc(k) + '">' +
    '<div class="card-top" onclick="location.hash=\'#/pasal/' + encodeURIComponent(k) + '\'">' +
      '<span class="source-badge-sm" style="background:' + badgeColor + '">' + esc(e.source) + '</span>' +
      '<h3>Pasal ' + e.pasal + '</h3>' +
      ancaman +
      '<p class="card-text">' + (needsExpand ? '<span class="trunc">' + short + '</span><span class="full" hidden>' + full + '</span>' : full) + '</p>' +
    '</div>' +
    (needsExpand ? '<button class="expand-btn" data-key="' + esc(k) + '">Selengkapnya ▾</button>' : '') +
    '<button class="bm-btn ' + (fav?'on':'') + '" data-key="' + esc(k) + '">' + (fav?'⭐':'🔖') + '</button></div>';
}

function render(kw='', filter='all') {
  let out = PASAL;
  if (filter !== 'all') out = out.filter(e => e.source === filter);
  if (filter === 'bookmarks') out = out.filter(e => BOOKMARK.includes(bmKey(e)));
  if (kw) out = out.filter(e => (e.txt||'').toLowerCase().includes(kw) || String(e.pasal).includes(kw));
  FILTERED = out;
  shown = 0;
  const rc = qs('#results');
  if (!out.length) {
    rc.innerHTML = '<p class="empty">' + (filter==='bookmarks'?'🔖 Belum ada bookmark.':'Tidak ditemukan.') + '</p>';
    qs('#load-more').hidden = true;
    updateBadge();
    return;
  }
  showMore();
  updateBadge();
}

function showMore() {
  const rc = qs('#results');
  const batch = FILTERED.slice(shown, shown + PAGE);
  if (shown === 0) rc.innerHTML = '';
  rc.insertAdjacentHTML('beforeend', batch.map(cardHTML).join(''));
  shown += batch.length;
  qs('#load-more').hidden = shown >= FILTERED.length;
  if (FILTERED.length > PAGE) {
    qs('#load-more').textContent = 'Muat lagi (' + shown + '/' + FILTERED.length + ')';
  }
}

function updateBadge() {
  const n = BOOKMARK.length;
  qs('#bm-total').textContent = n;
  qs('#bm-count').innerHTML = n ? '<sup>'+n+'</sup>' : '';
}

// --- Routing ---
function onRoute() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/pasal/')) {
    showDetail(decodeURIComponent(hash.slice(8)));
  } else {
    showList();
    render(qs('#q').value.trim().toLowerCase(), activeF());
  }
}

// --- Events ---
document.addEventListener('click', e => {
  // expand
  const exp = e.target.closest('.expand-btn');
  if (exp) {
    const card = exp.closest('.card');
    const trunc = card.querySelector('.trunc');
    const full = card.querySelector('.full');
    const isOpen = !full.hidden;
    trunc.hidden = !isOpen;
    full.hidden = isOpen;
    exp.textContent = isOpen ? 'Selengkapnya ▾' : 'Sembunyikan ▴';
    return;
  }
  // bookmark (list)
  const btn = e.target.closest('.bm-btn');
  if (btn) {
    const key = btn.dataset.key;
    const i = BOOKMARK.indexOf(key);
    if (i >= 0) BOOKMARK.splice(i, 1); else BOOKMARK.push(key);
    saveBm();
    render(qs('#q').value.trim().toLowerCase(), activeF());
    return;
  }
  // bookmark (detail)
  const dbtn = e.target.closest('.bm-btn-detail');
  if (dbtn) {
    const key = dbtn.dataset.key;
    const i = BOOKMARK.indexOf(key);
    if (i >= 0) BOOKMARK.splice(i, 1); else BOOKMARK.push(key);
    saveBm();
    dbtn.className = 'bm-btn-detail ' + (BOOKMARK.includes(key)?'on':'');
    dbtn.textContent = BOOKMARK.includes(key) ? '⭐ Bookmark' : '🔖 Bookmark';
    return;
  }
});

qs('#bookmarks-btn').addEventListener('click', () => {
  qs('#bookmark-panel').classList.add('open');
  render('', 'bookmarks');
});
qs('#close-bm').addEventListener('click', () => {
  qs('#bookmark-panel').classList.remove('open');
  render(qs('#q').value.trim().toLowerCase(), activeF());
});
qs('#export-btn').addEventListener('click', () => {
  const items = BOOKMARK.map(k => PASAL.find(p => bmKey(p) === k)).filter(Boolean);
  const blob = new Blob([JSON.stringify(items, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'katapasal-bookmark.json';
  a.click();
});
qs('#load-more').addEventListener('click', showMore);
qs('#q').addEventListener('input', function() {
  qs('#clear').hidden = !this.value;
  render(this.value.trim().toLowerCase(), activeF());
});
qs('#clear').addEventListener('click', () => {
  qs('#q').value = '';
  qs('#clear').hidden = true;
  render('', activeF());
});
qsa('.filter-btn').forEach(b => {
  if (b.dataset.filter === 'all') b.classList.add('active');
  b.addEventListener('click', () => {
    qsa('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render(qs('#q').value.trim().toLowerCase(), b.dataset.filter);
  });
});
window.addEventListener('hashchange', onRoute);

// Init
fetch(PASAL_URL)
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    PASAL = d;
    BOOKMARK = loadBm();
    onRoute();
    console.log('KataPasal: ' + PASAL.length + ' pasal');
  })
  .catch(e => {
    console.error('KataPasal error:', e);
    qs('#results').innerHTML = '<p class="empty">Gagal memuat data: ' + e.message + '</p>';
  });

// SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
  if ('caches' in window) caches.keys().then(k => k.forEach(c => caches.delete(c)));
  navigator.serviceWorker.register(SW_URL).catch(() => 0);
}
