// Kamus Pasal v5 — neumorphic UI, hash routing, no frameworks
const SUB='/katapasal',PASAL_URL=SUB+'/data/pasal.json',SW_URL=SUB+'/sw.js',PAGE=30;
const SRC_ORDER=['KUHP 2023','KUHAP 2025','KUHAP 1981','KUHP 1946','Penyesuaian 2026 Pasal VII','Kategori Denda'];
const SRC_SHORT={'KUHP 2023':'KUHP Baru','KUHAP 2025':'KUHAP Baru','KUHAP 1981':'KUHAP Lama','KUHP 1946':'KUHP Lama','Penyesuaian 2026 Pasal VII':'Penyesuaian 2026','Kategori Denda':'Kategori Denda'};
const SRC_COLORS={'KUHP 2023':'#6366f1','KUHAP 2025':'#0d9488','KUHAP 1981':'#6b7280','KUHP 1946':'#8b5cf6','Penyesuaian 2026 Pasal VII':'#d97706','Kategori Denda':'#dc2626'};
// ponytail: dynamic popular — entries with mapping from lama, prioritized
function getPopular(){
  const mapped=PASAL.filter(e=>e.pasal_terkait_lama&&e.pasal_terkait_lama.length&&e.source==='KUHP 2023').slice(0,6);
  if(mapped.length>=6)return mapped;
  const withAncaman=PASAL.filter(e=>e.ancaman_pidana&&e.source==='KUHP 2023'&&!mapped.includes(e)).slice(0,6-mapped.length);
  return[...mapped,...withAncaman];
}
let PASAL=[],BM=[],FILTERED=[],shown=0,selBagian=null,selBuku='BUKU PERTAMA',dark=false;
const $=q=>document.querySelector(q),$$=q=>document.querySelectorAll(q);
const esc=s=>(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const bmKey=e=>e.source+'|'+e.pasal;
const loadBM=()=>{try{return JSON.parse(localStorage.getItem('kb')||'[]')}catch{return[]}};
const saveBM=()=>localStorage.setItem('kb',JSON.stringify(BM));
const RV={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
const toRN=s=>{let r=0;for(let i=0;i<s.length;i++){const v=RV[s[i]],n=i+1<s.length?RV[s[i+1]]:0;r+=v<n?-v:v}return r};
const bukuName=bab=>{const m=(bab||'').match(/Bab\s+(\w+)/);if(!m)return null;const v=toRN(m[1]);
  return v<=16?'BUKU PERTAMA':v<=32?'BUKU KEDUA':'BUKU KETIGA'};
const BUKU_LABEL={'BUKU PERTAMA':'Ketentuan Umum','BUKU KEDUA':'Tindak Pidana','BUKU KETIGA':'Ketentuan Pidana'};
const getPasal=(src,num)=>PASAL.find(p=>p.source===src&&String(p.pasal)===String(num));
const srcBadge=(e,cls)=>`<span class="source-badge ${cls||''}" style="background:${SRC_COLORS[e.source]||'#6b7280'}">${esc(SRC_SHORT[e.source]||e.source)}</span>`;
const textShort=(t,n)=>esc(t).length>n?esc(t).slice(0,n)+'…':esc(t);

function renderHome(){
  const pop=getPopular();
  $('#app').innerHTML=`
  <section class="hero"><h2>Cari Pasal atau Kata Kunci</h2>
    <div class="hero-search"><input id="hq" type="search" placeholder="Cari pasal, kata kunci..." autocomplete="off"/>
    <button id="hero-btn">Cari</button></div></section>
  <div class="kat-grid">
    ${[['menu_book','KUHP Baru','KUHP 2023 — 589 pasal','#/bab|KUHP 2023'],['gavel','KUHAP','KUHAP 2025 & 1981','#/bab|KUHAP 2025'],['auto_stories','KUHP Lama','KUHP 1946 — kitab asli','#/bab|KUHP 1946']].map(k=>
      `<div class="kat-card neu" onclick="location.hash='${k[3]}'"><span class="material-symbols-outlined">${k[0]}</span><h3>${k[1]}</h3><p>${k[2]}</p></div>`).join('')}
  </div>
  <h3 class="section-title">Pasal Populer</h3>
  <div class="pop-grid">${pop.map(e=>`
    <div class="pop-card neu" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'">
      ${srcBadge(e)}<h3>Pasal ${e.pasal}${e.catatan_perubahan?' — '+esc(e.catatan_perubahan):''}</h3>
      <p>${textShort(e.txt,140)}</p></div>`).join('')}
  </div>`;
  $('#hq').addEventListener('input',e=>{if(e.target.value.trim())goSearch(e.target.value)});
  $('#hero-btn').addEventListener('click',()=>goSearch($('#hq').value));
  $('#hq').addEventListener('keydown',e=>{if(e.key==='Enter')goSearch($('#hq').value)});
}

function goSearch(kw,src){
  if(!kw&&!src)return;
  if(src)selSrc=src;
  if(kw)$('#q').value=kw;
  location.hash='#/search';
  $('#q').focus();
}

function renderSearch(){
  const kw=($('#q').value||'').trim().toLowerCase();
  const srcs=[['all','Semua'],['KUHP 2023','KUHP Baru'],['KUHAP 2025','KUHAP Baru'],['KUHAP 1981','KUHAP Lama'],['KUHP 1946','KUHP Lama'],['Penyesuaian 2026 Pasal VII','Penyesuaian'],['Kategori Denda','Denda']];
  const curSrc=selSrc||'all';
  $('#app').innerHTML=`<div class="filter-bar">${srcs.map(([k,v])=>`<button class="filter-btn${curSrc===k?' active':''}" data-src="${k}">${v}</button>`).join('')}</div><div class="results-wrap" id="rw"></div>`;
  $$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{selSrc=b.dataset.src;$$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));doSearch(kw)}));
  doSearch(kw);
}

function doSearch(kw){
  const rw=$('#rw');if(!rw)return;
  let out=PASAL;
  if(selSrc&&selSrc!=='all')out=out.filter(e=>e.source===selSrc);
  if(kw)out=PASAL.filter(e=>(e.txt||'').toLowerCase().includes(kw)||String(e.pasal).includes(kw));
  const numHit=kw&&/^\d+$/.test(kw)?PASAL.filter(e=>String(e.pasal)===kw):[];
  let html='';
  if(numHit.length){
    const best=numHit.find(e=>e.source==='KUHP 2023')||numHit[0];
    html+=`<div class="direct-hit neu" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(best))}'">
      <h3>Langsung ke Pasal ${esc(kw)} — ${esc(best.source)}</h3>
      <p>${textShort(best.txt,120)}</p></div>`;
  }
  if(!out.length){rw.innerHTML=html+'<p class="empty" style="text-align:center;color:var(--muted);padding:2rem">Tidak ditemukan.</p>';return}
  FILTERED=out;shown=0;
  rw.innerHTML=html+`<div id="cards"></div><div class="load-more"><button class="neu-btn" id="lm" hidden>Muat lagi</button></div>`;
  showMore();
}

function showMore(){
  const cards=$('#cards'),batch=FILTERED.slice(shown,shown+PAGE);
  cards.insertAdjacentHTML('beforeend',batch.map(cardHTML).join(''));
  shown+=batch.length;
  const lm=$('#lm');
  if(lm){lm.hidden=shown>=FILTERED.length;lm.textContent=`Muat lagi (${shown}/${FILTERED.length})`}
}

function cardHTML(e){
  const k=bmKey(e),fav=BM.includes(k);
  const full=esc(e.txt||''),needsExpand=full.length>300;
  return `<div class="result-card neu" data-key="${k}">
    <button class="bm-toggle ${fav?'on':''}" data-key="${k}">${fav?'★':'☆'}</button>
    ${srcBadge(e)}
    <h3 onclick="location.hash='#/pasal/${encodeURIComponent(k)}'">Pasal ${e.pasal}${e.catatan_perubahan?' — '+esc(e.catatan_perubahan):''}</h3>
    <p class="card-text" onclick="location.hash='#/pasal/${encodeURIComponent(k)}'">${needsExpand?`<span class="trunc">${full.slice(0,300)}…</span><span class="full" hidden>${full}</span>`:full}</p>
    ${needsExpand?`<button class="expand-btn" data-key="${k}">Selengkapnya ▾</button>`:''}</div>`;
}

function renderBAB(initSrc){
  let src=initSrc||selSrc||'KUHP 2023';
  const entries=PASAL.filter(e=>e.source===src);
  $('#app').innerHTML=`
  <div class="bab-layout">
    <aside class="bab-sidebar neu">
      <h3>Buku</h3>
      ${['BUKU PERTAMA','BUKU KEDUA','BUKU KETIGA'].map(b=>`<div class="buku-link ${selBuku===b?'active':''}" data-buku="${b}">${b.replace('BUKU ','Buku ')}</div>`).join('')}
      <button class="neu-btn" id="cek-status">Cek Status Pasal</button>
    </aside>
    <div class="bab-mid">
      <div class="breadcrumb"><a href="#/">Beranda</a><span>${esc(src)}</span></div>
      <div class="neu-pressed" style="border-radius:var(--radius-pill);padding:.35rem .75rem;display:flex;align-items:center;gap:.5rem;margin-bottom:1rem">
        <span class="material-symbols-outlined" style="font-size:1.1rem;color:var(--muted)">search</span>
        <input id="bab-q" type="search" placeholder="Cari dalam ${esc(src)}..." style="flex:1;border:none;background:none;outline:none;font:400 .8rem/1.4 'Plus Jakarta Sans',sans-serif;color:var(--text)" autocomplete="off"/>
      </div>
      <div id="bab-tree"></div>
    </div>
    <div class="bab-right" id="bab-right"><div class="breadcrumb"><span>Pasal</span></div></div>
  </div>`;
  selSrc=src;
  buildTree(src);
  $('#bab-q').addEventListener('input',e=>buildTree(src,e.target.value.trim().toLowerCase()));
  $$('.buku-link').forEach(b=>b.addEventListener('click',()=>{selBuku=b.dataset.buku;$$('.buku-link').forEach(x=>x.classList.toggle('active',x===b));buildTree(src)}));
  $('#cek-status').addEventListener('click',()=>{
    const num=prompt('Nomor pasal (contoh: 362):');
    if(num&&/^\d+$/.test(num)){
      const m=PASAL.filter(e=>String(e.pasal)===num);
      const hits=m.map(e=>`<div class="bm-item neu" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'"><h4>${esc(e.source)} — Pasal ${num}</h4><p>${textShort(e.txt,100)}</p></div>`).join('');
      const r=$('#bab-right');
      r.innerHTML=`<div class="breadcrumb"><span>Status Pasal ${esc(num)}</span></div>${hits||'<p style="color:var(--muted);font-size:.8rem">Tidak ditemukan.</p>'}`;
    }
  });
}

function buildTree(src,kw){
  const entries=PASAL.filter(e=>e.source===src&&(!kw||(e.txt||'').toLowerCase().includes(kw)||String(e.pasal).includes(kw)));
  const hasBab=entries.some(e=>e.bab);
  const tree=$('#bab-tree');if(!tree)return;
  if(!hasBab){
    tree.innerHTML=`<div class="neu" style="padding:1rem">${entries.map(e=>`<div class="pasal-link" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'">Pasal ${e.pasal}</div>`).join('')}</div>`;
    return;
  }
  const byBuku={};
  entries.forEach(e=>{
    const bk=bukuName(e.bab)||'(Lainnya)';
    if(!byBuku[bk])byBuku[bk]={};
    const bb=e.bab||'(Tanpa Bab)';
    if(!byBuku[bk][bb])byBuku[bk][bb]=[];
    byBuku[bk][bb].push(e);
  });
  let html='';
  Object.keys(byBuku).sort((a,b)=>({'BUKU PERTAMA':1,'BUKU KEDUA':2,'BUKU KETIGA':3}[a]||9)-({'BUKU PERTAMA':1,'BUKU KEDUA':2,'BUKU KETIGA':3}[b]||9)).forEach(bk=>{
    if(selBuku!==bk)return;
    const babs=byBuku[bk];
    html+=`<div class="bab-accd" style="margin-bottom:.75rem"><h3 style="font-size:.8rem;font-weight:700;color:var(--muted);margin-bottom:.5rem">${bk.replace('BUKU ','Buku ')} — ${BUKU_LABEL[bk]}</h3>`;
    Object.keys(babs).sort((a,b)=>toRN((a.match(/Bab\s+(\w+)/)||[])[1]||'')-toRN((b.match(/Bab\s+(\w+)/)||[])[1]||'')).forEach(bab=>{
      const ps=babs[bab];
      html+=`<div class="bab-accd" data-bab="${esc(bab)}"><div class="bab-accd-head neu" onclick="toggleBab(this)">${esc(bab)}<span class="cnt">${ps.length} pasal</span></div>
      <div class="bab-accd-body">${ps.map(e=>{
        const bag=e.bagian?' — '+esc(e.bagian):'';
        return `<div class="pasal-link" data-key="${esc(bmKey(e))}" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(e))}'">Pasal ${e.pasal}${bag}</div>`;
      }).join('')}</div></div>`;
    });
    html+='</div>';
  });
  tree.innerHTML=html;
}

function toggleBab(head){
  const acc=head.parentElement;
  acc.classList.toggle('open');
  const ps=acc.querySelectorAll('.pasal-link');
  if(ps.length)showBagian(ps[0].dataset.key);
}

function showBagian(key){
  const [src,num]=key.split('|');
  const e=getPasal(src,num);
  const r=$('#bab-right');if(!r)return;
  r.innerHTML=`<div class="breadcrumb"><a href="#/">Beranda</a><span>${esc(src)}</span><span>${e.bab?esc(e.bab):''}</span></div>`;
  if(e.bagian)r.innerHTML+=`<h3 style="font-size:.85rem;font-weight:700;margin-bottom:.75rem">${esc(e.bagian)}</h3>`;
  const ps=PASAL.filter(p=>p.source===src&&p.bab===e.bab&&(!e.bagian||p.bagian===e.bagian));
  r.innerHTML+=ps.map(p=>`<div class="pasal-card neu" onclick="location.hash='#/pasal/${encodeURIComponent(bmKey(p))}'">
    ${srcBadge(p)}<h4>Pasal ${p.pasal}</h4><p>${textShort(p.txt,120)}</p></div>`).join('');
}

function renderDetail(id){
  const [src,num]=id.split('|');
  const e=getPasal(src,num);
  if(!e){location.hash='#/';return}
  const k=bmKey(e),fav=BM.includes(k);
  const crumbs=['Beranda',SRC_SHORT[src]||src,e.bab,e.bagian];
  let anc='';
  if(e.ancaman_pidana){
    const cls=e.ancaman_pidana.toLowerCase().includes('mati')?'badge-mati':e.ancaman_pidana.toLowerCase().includes('seumur')?'badge-seumur':'badge-default';
    anc=`<div class="card-label">Ancaman Pidana</div><span class="badge ${cls}">${esc(e.ancaman_pidana)}</span>`;
  }
  let korel='';
  if(e.pasal_terkait_lama&&e.pasal_terkait_lama.length){
    korel=`<div class="card-label">Korelasi Historis</div>
      <div class="korelasi-box"><p style="margin-bottom:.5rem">Pemetaan dari pasal KUHP lama:</p>
      ${e.pasal_terkait_lama.map(r=>`<span class="lama-tag">${esc(r)}</span>`).join('')}
      ${e.catatan_perubahan?`<p style="margin-top:.75rem;font-size:.75rem;color:var(--muted)">${esc(e.catatan_perubahan)}</p>`:''}</div>`;
  }
  $('#app').innerHTML=`
  <div class="detail-wrap">
    <div class="breadcrumb">${crumbs.filter(Boolean).map((c,i)=>i===0?`<a href="#/">${esc(c)}</a>`:`<span>${esc(c)}</span>`).join('')}</div>
    <div class="detail-head">
      ${srcBadge(e,'source-badge-lg')}
      <h1>Pasal ${e.pasal}</h1>
      ${e.catatan_perubahan?`<p class="subtitle">${esc(e.catatan_perubahan)}</p>`:''}
    </div>
    <div class="detail-actions">
      <button class="neu-btn" id="d-bm">${fav?'★ Ter-bookmark':'☆ Bookmark'}</button>
      <button class="neu-btn" id="d-share">Share</button>
      <button class="neu-btn" id="d-copy">Salin Teks</button>
    </div>
    <div class="detail-grid">
      <div>
        <div class="neu" style="margin-bottom:1rem"><div class="card-label">Teks Resmi</div><div class="teks-box">${esc(e.txt)}</div></div>
        ${korel?`<div class="neu">${korel}</div>`:''}
      </div>
      <div>
        ${anc?`<div class="neu ancaman-box" style="margin-bottom:1rem">${anc}</div>`:''}
        <div class="neu"><div class="card-label">Tentang Pasal Ini</div>
          <p style="font-size:.8rem;color:var(--muted)">Pasal ${e.pasal} dari ${esc(e.source)}. Gunakan fitur Cari untuk menemukan pasal lain, atau navigasi BAB untuk menjelajah berdasarkan struktur undang-undang.</p></div>
      </div>
    </div>
  </div>`;
  $('#d-bm').addEventListener('click',()=>{
    const i=BM.indexOf(k);i>=0?BM.splice(i,1):BM.push(k);saveBM();
    $('#d-bm').textContent=BM.includes(k)?'★ Ter-bookmark':'☆ Bookmark';
  });
  $('#d-share').addEventListener('click',()=>{
    if(navigator.share)navigator.share({title:'Pasal '+e.pasal+' — '+e.source,text:e.txt,url:location.href}).catch(()=>0);
    else navigator.clipboard.writeText(location.href).then(()=>$('#d-share').textContent='Link tersalin');
  });
  $('#d-copy').addEventListener('click',()=>navigator.clipboard.writeText(e.txt).then(()=>$('#d-copy').textContent='✓ Tersalin'));
  document.title='Pasal '+e.pasal+' — '+(SRC_SHORT[src]||src)+' | Kamus Pasal';
  window.scrollTo(0,0);
}

function openBM(){
  $('#bm-list').innerHTML=BM.length?BM.map(k=>{
    const [src,num]=k.split('|'),e=getPasal(src,num);
    return e?`<div class="bm-item neu" onclick="location.hash='#/pasal/${encodeURIComponent(k)}';closeBM()"><h4>${esc(SRC_SHORT[src]||src)} — Pasal ${e.pasal}</h4><p>${textShort(e.txt,100)}</p></div>`:'';
  }).join(''):'<p style="text-align:center;color:var(--muted);font-size:.8rem;padding:1rem">Belum ada bookmark.</p>';
  $('#bm-count').textContent=BM.length;
  $('#bm-panel').classList.add('open');
}
const closeBM=()=>$('#bm-panel').classList.remove('open');

function onRoute(){
  const h=location.hash||'#/';
  if(h.startsWith('#/pasal/')){renderDetail(decodeURIComponent(h.slice(8)));return}
  if(h.startsWith('#/bab|')){const src=decodeURIComponent(h.slice(6));renderBAB(src);return}
  if(h==='#/bab'){renderBAB();return}
  if(h==='#/search'){renderSearch();return}
  renderHome();
  document.title='Kamus Pasal — Hukum Pidana Indonesia';
  window.scrollTo(0,0);
}

function setTab(tab){
  $$('.bn-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='bab'){location.hash='#/bab'}
  else if(tab==='bm')openBM();
  else if(tab==='home')location.hash='#/';
}

// Events
document.addEventListener('click',e=>{
  const exp=e.target.closest('.expand-btn');
  if(exp){const c=exp.closest('.result-card'),t=c.querySelector('.trunc'),f=c.querySelector('.full'),open=!f.hidden;
    t.hidden=!open;f.hidden=open;exp.textContent=open?'Selengkapnya ▾':'Sembunyikan ▴';return}
  const bm=e.target.closest('.bm-toggle');
  if(bm){const k=bm.dataset.key,i=BM.indexOf(k);i>=0?BM.splice(i,1):BM.push(k);saveBM();
    bm.classList.toggle('on',BM.includes(k));bm.textContent=BM.includes(k)?'★':'☆';return}
});
$('#q').addEventListener('input',()=>{
  $('#clear').hidden=!$('#q').value;
  if(location.hash==='#/search')doSearch($('#q').value.trim().toLowerCase());
});
$('#clear').addEventListener('click',()=>{const q=$('#q');q.value='';$('#clear').hidden=true;if(location.hash==='#/search')doSearch('')});
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'&&$('#q').value.trim())goSearch($('#q').value)});
$('#dark-toggle').addEventListener('click',()=>{
  dark=!dark;document.body.classList.toggle('dark',dark);
  $('#dark-toggle').innerHTML=`<span class="material-symbols-outlined">${dark?'light_mode':'dark_mode'}</span>`;
});
$$('.bn-btn').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#close-bm').addEventListener('click',closeBM);
$('#bm-panel').addEventListener('click',e=>{if(e.target===$('#bm-panel'))closeBM()});
window.addEventListener('hashchange',onRoute);

// Init
fetch(PASAL_URL).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  .then(d=>{PASAL=d;BM=loadBM();onRoute();console.log('Kamus Pasal: '+PASAL.length+' pasal')})
  .catch(e=>{$('#app').innerHTML='<p style="text-align:center;color:var(--muted);padding:2rem">Gagal memuat data: '+esc(e.message)+'</p>'});
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));
  if('caches' in window)caches.keys().then(ks=>ks.forEach(c=>caches.delete(c)));
  navigator.serviceWorker.register(SW_URL).catch(()=>0);
}
