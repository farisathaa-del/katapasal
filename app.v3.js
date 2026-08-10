// KataPasal — Kamus Pasal Hukum Pidana Indonesia
// ponytail: semua path absolut /katapasal/, hash routing SPA, no frameworks
const SUB='/katapasal',PASAL_URL=SUB+'/data/pasal.json',SW_URL=SUB+'/sw.js',PAGE=30;
const SRC_COLORS={'KUHP 2023':'#2563EB','KUHAP 2025':'#0D9488','KUHP 1946':'#6B7280','KUHAP 1981':'#374151','Penyesuaian 2026 Pasal VII':'#D97706','Kategori Denda':'#DC2626'};
let PASAL=[],BOOKMARK=[],FILTERED=[],shown=0,curView='list';
const qs=q=>document.querySelector(q),qsa=q=>document.querySelectorAll(q);
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const fmt=t=>esc(t||'').replace(/\n/g,'<br>');
const bmKey=e=>e.source+'|'+e.pasal;
const loadBm=()=>{try{return JSON.parse(localStorage.getItem('kb')||'[]')}catch{return[]}};
const saveBm=()=>localStorage.setItem('kb',JSON.stringify(BOOKMARK));
const activeF=()=>qsa('.filter-btn.active')[0]?.dataset.filter||'all';

// ponytail: roman numeral parser — covers I-M range only, good enough for KUHP babs
const RV={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
function toRN(s){let r=0;for(let i=0;i<s.length;i++){const v=RV[s[i]],n=i+1<s.length?RV[s[i+1]]:0;r+=v<n?-v:v}return r}

// ponytail: buku mapping by roman numeral threshold
function bukuName(bab){
  const m=bab.match(/Bab\s+(\w+)/);if(!m)return null;
  const v=toRN(m[1]);
  if(v<=16)return 'BUKU PERTAMA — Ketentuan Umum';
  if(v<=32)return 'BUKU KEDUA — Tindak Pidana';
  return 'BUKU KETIGA — Ketentuan Pidana';
}

// --- Source badge color ---
function srcBadge(e,cls='source-badge-sm'){
  const c=SRC_COLORS[e.source]||'#6B7280';
  return `<span class="${cls}" style="background:${c}">${esc(e.source)}</span>`;
}

// --- Detail View ---
function showDetail(id){
  const [src,num]=id.split('|');
  const e=PASAL.find(p=>p.source===src&&String(p.pasal)===num);
  if(!e){location.hash='#/';return}
  qs('#list-view').hidden=qs('#bab-view').hidden=qs('.search-bar').hidden=qs('.filters').hidden=qs('#direct-hit').hidden=qs('#load-more').hidden=true;
  qs('#detail-view').hidden=false;
  const k=bmKey(e),isBm=BOOKMARK.includes(k);
  const ancaman=e.ancaman_pidana||'';
  // Hierarchy: buku + bab + bagian
  let hirarki='';
  const parts=[];
  if(e.source==='KUHP 2023'){
    const bk=bukuName(e.bab||'');
    if(bk)parts.push(bk);
  }
  if(e.bab)parts.push(e.bab);
  if(e.bagian)parts.push(e.bagian);
  if(parts.length)hirarki='<div class="hirarki">'+parts.map(p=>'<span class="hirarki-item">'+esc(p)+'</span>').join('')+'</div>';
  // Ancaman badge
  let ancamanHTML='';
  if(ancaman){
    const cls=ancaman.includes('mati')?'badge-mati':ancaman.includes('seumur')?'badge-seumur':'badge-pidana';
    ancamanHTML=`<div class="ancaman-row"><span class="badge ${cls}">⚡ ${esc(ancaman)}</span></div>`;
  }
  // Lama mapping badge
  let lamaHTML='';
  if(e.pasal_terkait_lama&&e.pasal_terkait_lama.length){
    lamaHTML=`<div style="margin:8px 0"><span class="lama-badge">📍 Pemetaan dari KUHP Lama: ${e.pasal_terkait_lama.map(r=>esc(r)).join(', ')}</span>`+
      (e.catatan_perubahan?` <span style="font-size:12px;color:var(--muted)">${esc(e.catatan_perubahan)}</span>`:'')+'</div>';
  }
  document.title=e.source+' — Pasal '+e.pasal+' | KataPasal';
  qs('#detail-view').innerHTML=
    `<div class="detail-card">
      <a href="#/" class="back-btn">← Kembali</a>
      <div class="detail-header">${srcBadge(e,'source-badge')}<h2>Pasal ${e.pasal}</h2></div>
      ${hirarki}${ancamanHTML}
      <div class="detail-text">${fmt(e.txt)}</div>
      <div class="detail-actions">
        <button class="bm-btn-detail ${isBm?'on':''}" data-key="${esc(k)}">${isBm?'⭐ Bookmark':'🔖 Bookmark'}</button>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(e.txt)}')).then(()=>this.textContent='✓ Tersalin')">📋 Salin Teks</button>
      </div>
      ${lamaHTML}
    </div>`;
  window.scrollTo(0,0);
}

function showList(){
  qs('#list-view').hidden=false;qs('#detail-view').hidden=true;
  qs('#bab-view').hidden=true;
  qs('.search-bar').hidden=qs('.filters').hidden=false;
  qs('#direct-hit').hidden=true;
  document.title='KataPasal — Bank Pasal Hukum Pidana';
}

// --- Card HTML ---
function cardHTML(e){
  const k=bmKey(e),fav=BOOKMARK.includes(k);
  const full=esc(e.txt||'');
  const short=full.length>300?full.slice(0,300)+'…':full;
  const needsExpand=full.length>300;
  const ancaman=e.ancaman_pidana?`<span class="card-ancaman">⚡ ${esc(e.ancaman_pidana)}</span>`:'';
  return `<div class="card" data-key="${esc(k)}">
    <div class="card-top" onclick="location.hash='#/pasal/${encodeURIComponent(k)}'">
      ${srcBadge(e)}<h3>Pasal ${e.pasal}</h3>${ancaman}
      <p class="card-text">${needsExpand?`<span class="trunc">${short}</span><span class="full" hidden>${full}</span>`:full}</p>
    </div>
    ${needsExpand?`<button class="expand-btn" data-key="${esc(k)}">Selengkapnya ▾</button>`:''}
    <button class="bm-btn ${fav?'on':''}" data-key="${esc(k)}">${fav?'⭐':'🔖'}</button></div>`;
}

let RENDER_TARGET='#results';
function render(kw='',filter='all'){
  let out=PASAL;
  if(filter!=='all'&&filter!=='bookmarks')out=out.filter(e=>e.source===filter);
  if(filter==='bookmarks')out=out.filter(e=>BOOKMARK.includes(bmKey(e)));
  if(kw)out=out.filter(e=>(e.txt||'').toLowerCase().includes(kw)||String(e.pasal).includes(kw));
  FILTERED=out;shown=0;
  RENDER_TARGET=filter==='bookmarks'?'#bm-results':'#results';
  const rc=qs(RENDER_TARGET);
  if(!out.length){rc.innerHTML=`<p class="empty">${filter==='bookmarks'?'🔖 Belum ada bookmark.':'Tidak ditemukan.'}</p>`;
    if(RENDER_TARGET==='results')qs('#load-more').hidden=true;updateBadge();return}
  showMore();updateBadge();
}

function showMore(){
  const rc=qs(RENDER_TARGET),batch=FILTERED.slice(shown,shown+PAGE);
  if(shown===0)rc.innerHTML='';
  rc.insertAdjacentHTML('beforeend',batch.map(cardHTML).join(''));
  shown+=batch.length;
  if(RENDER_TARGET==='results'){
    qs('#load-more').hidden=shown>=FILTERED.length;
    if(FILTERED.length>PAGE)qs('#load-more').textContent=`Muat lagi (${shown}/${FILTERED.length})`;
  }
}

function updateBadge(){
  const n=BOOKMARK.length;
  qs('#bm-total').textContent=n;
}

// --- Direct search by number ---
function checkDirectHit(kw){
  const el=qs('#direct-hit');
  if(/^\d+$/.test(kw)){
    const matches=PASAL.filter(e=>String(e.pasal)===kw);
    if(matches.length){
      // ponytail: pick KUHP 2023 first, then first match
      const best=matches.find(e=>e.source==='KUHP 2023')||matches[0];
      el.innerHTML=`→ <strong>Langsung ke Pasal ${kw}</strong> ${esc(best.source)}`;
      el.hidden=false;
      el.onclick=()=>location.hash=`#/pasal/${encodeURIComponent(bmKey(best))}`;
      return;
    }
  }
  el.hidden=true;
}

// --- BAB Accordion View ---
function renderBAB(){
  const el=qs('#bab-view');el.hidden=false;
  // ponytail: group source→bab (or source-only if no bab)
  const bySource={};
  PASAL.forEach(e=>{
    if(!bySource[e.source])bySource[e.source]=[];
    bySource[e.source].push(e);
  });
  let html='';
  const order=['KUHP 2023','KUHAP 2025','KUHP 1946','KUHAP 1981','Penyesuaian 2026 Pasal VII','Kategori Denda'];
  order.forEach(src=>{
    const entries=bySource[src];if(!entries)return;
    const hasBab=entries.some(e=>e.bab);
    html+=`<div class="bab-src-title" style="border-left:3px solid ${SRC_COLORS[src]};padding-left:12px">${esc(src)} (${entries.length} pasal)</div>`;
    if(!hasBab){
      // Sources without bab: flat list under source name
      html+=`<div style="padding:4px 0">${entries.map(e=>
        `<div class="pasal-link" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'">Pasal ${e.pasal}</div>`
      ).join('')}</div>`;
    } else {
      // KUHP 2023: Buku → Bab → Pasal
      const byBab={};
      entries.forEach(e=>{const b=e.bab||'(Tanpa Bab)';if(!byBab[b])byBab[b]=[];byBab[b].push(e)});
      // Group by buku
      const byBuku={};
      Object.keys(byBab).forEach(bab=>{
        const bk=bukuName(bab)||'(Lainnya)';
        if(!byBuku[bk])byBuku[bk]=[];
        byBuku[bk].push({bab,pasal:byBab[bab]});
      });
      // ponytail: sort buku by roman numeral order
      const BK_ORDER={'BUKU PERTAMA':1,'BUKU KEDUA':2,'BUKU KETIGA':3};
      Object.keys(byBuku).sort((a,b)=>{
        const ka=Object.keys(BK_ORDER).find(k=>a.startsWith(k))||a;
        const kb=Object.keys(BK_ORDER).find(k=>b.startsWith(k))||b;
        return (BK_ORDER[ka]||99)-(BK_ORDER[kb]||99);
      }).forEach(bk=>{
        const totalP=byBuku[bk].reduce((s,b)=>s+b.pasal.length,0);
        html+=`<div class="buku-group">
          <div class="buku-title" onclick="this.parentElement.classList.toggle('open')">${esc(bk)} <span style="font-size:11px;color:var(--muted);font-weight:400">(${totalP} pasal)</span></div>
          <div class="bab-list" style="display:none">`;
        byBuku[bk].forEach(({bab,pasal})=>{
          html+=`<div class="bab-item">
            <div class="bab-head" onclick="this.parentElement.classList.toggle('open');this.nextElementSibling.style.display=this.parentElement.classList.contains('open')?'block':'none'">
              <span>${esc(bab)}</span><span class="cnt">${pasal.length} pasal</span>
            </div>
            <div class="bab-list" style="display:none">
              ${pasal.map(e=>`<div class="pasal-link" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'">Pasal ${e.pasal}${e.bagian?' — '+esc(e.bagian):''}</div>`).join('')}
            </div></div>`;
        });
        html+=`</div></div>`;
      });
    }
  });
  el.innerHTML=html;
}

// --- Routing ---
function onRoute(){
  const hash=location.hash||'#/';
  if(hash.startsWith('#/pasal/')){
    showDetail(decodeURIComponent(hash.slice(8)));
  } else {
    showList();
    render(qs('#q').value.trim().toLowerCase(),activeF());
  }
}

// --- Tab switching ---
function setView(v){
  curView=v;
  qsa('.vt').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  qsa('.nav-btn').forEach(t=>t.classList.toggle('active',t.dataset.tab===v||(v==='list'&&t.dataset.tab==='list')));
  qs('#list-view').hidden=v!=='list';
  qs('#bab-view').hidden=v!=='bab';
  qs('.search-bar').hidden=v!=='list';
  qs('.filters').hidden=v!=='list';
  qs('#direct-hit').hidden=true;
  qs('#detail-view').hidden=true;
  if(v==='bab')renderBAB();
  if(v==='bm'){
    qs('#bookmark-panel').classList.add('open');
    render('','bookmarks');
  } else {
    qs('#bookmark-panel').classList.remove('open');
  }
  document.title='KataPasal — Bank Pasal Hukum Pidana';
}

// --- Events ---
document.addEventListener('click',e=>{
  // expand
  const exp=e.target.closest('.expand-btn');
  if(exp){const c=exp.closest('.card'),t=c.querySelector('.trunc'),f=c.querySelector('.full'),open=!f.hidden;
    t.hidden=!open;f.hidden=open;exp.textContent=open?'Selengkapnya ▾':'Sembunyikan ▴';return;}
  // bookmark list
  const btn=e.target.closest('.bm-btn');
  if(btn&&!btn.classList.contains('bm-btn-detail')){const key=btn.dataset.key,i=BOOKMARK.indexOf(key);
    i>=0?BOOKMARK.splice(i,1):BOOKMARK.push(key);saveBm();render(qs('#q').value.trim().toLowerCase(),activeF());return;}
  // bookmark detail
  const dbtn=e.target.closest('.bm-btn-detail');
  if(dbtn){const key=dbtn.dataset.key,i=BOOKMARK.indexOf(key);
    i>=0?BOOKMARK.splice(i,1):BOOKMARK.push(key);saveBm();
    dbtn.className='bm-btn-detail '+(BOOKMARK.includes(key)?'on':'');
    dbtn.textContent=BOOKMARK.includes(key)?'⭐ Bookmark':'🔖 Bookmark';return;}
  // bookmark panel item click
  const bItem=e.target.closest('.bookmark-item');
  if(bItem){location.hash='#/pasal/'+encodeURIComponent(bItem.dataset.key);
    qs('#bookmark-panel').classList.remove('open');return;}
});

// View tabs
qsa('.vt').forEach(t=>t.addEventListener('click',()=>setView(t.dataset.view)));
// Bottom nav
qsa('.nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tab)));
// Close bookmark panel
qs('#close-bm').addEventListener('click',()=>{qs('#bookmark-panel').classList.remove('open');setView('list')});
// Load more
qs('#load-more').addEventListener('click',showMore);
// Search input
qs('#q').addEventListener('input',function(){
  qs('#clear').hidden=!this.value;
  const kw=this.value.trim().toLowerCase();
  render(kw,activeF());
  checkDirectHit(kw);
});
// Clear search
qs('#clear').addEventListener('click',()=>{qs('#q').value='';qs('#clear').hidden=true;qs('#direct-hit').hidden=true;render('',activeF())});
// Filter buttons
qsa('.filter-btn').forEach(b=>b.addEventListener('click',()=>{
  qsa('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  const kw=qs('#q').value.trim().toLowerCase();render(kw,b.dataset.filter);checkDirectHit(kw);
}));
// Hash routing
window.addEventListener('hashchange',onRoute);

// Init
fetch(PASAL_URL)
  .then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  .then(d=>{PASAL=d;BOOKMARK=loadBm();onRoute();console.log('KataPasal: '+PASAL.length+' pasal')})
  .catch(e=>{console.error('KataPasal error:',e);
    qs('#results').innerHTML='<p class="empty">Gagal memuat data: '+e.message+'</p>'});

// SW
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));
  if('caches' in window)caches.keys().then(k=>k.forEach(c=>caches.delete(c)));
  navigator.serviceWorker.register(SW_URL).catch(()=>0);
}
