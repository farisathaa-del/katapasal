// KataPasal PWA app — search + bookmark + export
// ponytail: data.json statis, bukan API — cukup host statis saja
const CACHE = 'katapasal-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/data/pasal.json'];

let PASAL = [], BOOKMARK = [];
const qs = q => document.querySelector(q);
const $ = (sel, all=false) => all ? document.querySelectorAll(sel) : document.querySelector(sel);

async function init() {
  // 1. load data
  try {
    const res = await fetch('/data/pasal.json');
    PASAL = await res.json();
  } catch(e){ console.error('data.json fail', e); qs('.empty').textContent='Gagal memuat data.'; return; }

  loadBookmarks();

  // 2. search
  const q = qs('#q');
  q.addEventListener('input', ()=>{
    const val = q.value.toLowerCase().trim();
    qs('#clear').hidden = !val;
    render(val);
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(()=>0);
  }
}
qs('#clear')?.addEventListener('click', ()=>{qs('#q').value=''; qs('#clear').hidden=true; render('');});

// filter btn
$$('.filter-btn').forEach(b=>{
  b.onclick = ()=>{
    $$('.filter-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    render(qs('#q').value.trim().toLowerCase(), b.dataset.filter);
  };
});

function render(keyword='', filter='all'){
  const src = filter;
  let out = PASAL.filter(e=>{
    if (src!=='all' && e.source !== src) return false;
    if (!keyword) return true;
    return e.txt.toLowerCase().includes(keyword) || String(e.pasal).includes(keyword);
  });

  const rc = qs('#results');
  if (!out.length) { rc.innerHTML='<p class="empty">Tidak ada pasal cocok.</p>'; return; }

  rc.innerHTML = out.map(e=>`
    <div class="card" data-id="${e.source}:${e.pasal}" onclick="toggle(this)">
      <h3>${e.source} — Pasal ${e.pasal} <span class="badge">${e.source.split(' ')[0].replace('.','')}</span></h3>
      <p>${escapeHtml(e.txt.slice(0,480))}…</p>
    </div>
  `).join('');
}

// toggle expand
window.toggle = (el)=>{
  el.classList.toggle('open');
};

// bookmark
window.toggleBook = (key, btn)=>{
  const i = BOOKMARK.indexOf(key);
  if (i>=0){ BOOKMARK.splice(i,1); btn.textContent='🔖'; }
  else    { BOOKMARK.push(key); btn.textContent='⭐'; }
  localStorage.setItem('b', JSON.stringify(BOOKMARK));
};

function loadBookmarks(){ /* load from ls */ }
function saveBookmarks(){ /* save to ls */ }

// export
qs('#export-btn')?.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(BOOKMARK.map(k=>PASAL.find(p=>p.source+':'+p.pasal===k)).filter(x=>x), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='katapasal-bookmark.json'; a.click();
};

function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}

document.addEventListener('DOMContentLoaded', init);
// ponytail: SSR/IndexedDB bila data>5MB atau perlu sync offline penuh — ini cukup fetch statis.
