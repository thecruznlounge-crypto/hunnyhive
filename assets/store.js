/* Hunnyhive shared helpers (formerly mypwa.store) */
(function(w,d){
  'use strict';
  var S=w.Store={};
  S.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  S.load=function(){
    if(S._p) return S._p;
    S._p=fetch('/apps.json',{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error(r.status);return r.json()}).catch(function(){return fetch('/apps.json').then(function(r){return r.json()})}).then(function(j){
      var seen={}; j.apps=(j.apps||[]).filter(function(a){if(!a.slug||seen[a.slug]) return false; seen[a.slug]=1; return a.status!=='hidden'});
      S.data=j; return j;
    });
    return S._p;
  };
  S.card=function(a){
    var tag=a.status==='preview'?'<span class="tag preview">Preview</span>':a.status==='beta'?'<span class="tag beta">Beta</span>':'';
    return '<a class="card" href="/apps/'+S.esc(a.slug)+'" data-slug="'+S.esc(a.slug)+'"><img class="ico" loading="lazy" width="84" height="84" src="'+S.esc(a.icon)+'" alt="">'+
      '<h3>'+S.esc(a.name)+'</h3><p>'+S.esc(a.tagline)+'</p><div class="meta"><span class="tag">'+S.esc(a.collection?S.collName(a.collection):a.category)+'</span>'+tag+'</div></a>';
  };
  S.collName=function(id){var c=((S.data||{}).collections||[]).filter(function(x){return x.id===id})[0];return c?c.name:id};
  S.theme=function(){
    var t=null; try{t=localStorage.getItem('hunnyhive:theme')}catch(e){}
    if(t) d.documentElement.setAttribute('data-theme',t);
    var b=d.getElementById('themeBtn'); if(!b) return;
    function cur(){return d.documentElement.getAttribute('data-theme')||(w.matchMedia&&w.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
    function paint(){b.textContent=cur()==='dark'?'☀️':'🌙'} paint();
    b.onclick=function(){var n=cur()==='dark'?'light':'dark';d.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('hunnyhive:theme',n)}catch(e){}paint()};
  };
  S.nav=function(cur){
    var i={apps:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
      search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
      submit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
      dev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/></svg>'};
    var el=d.createElement('nav');el.className='bar';
    el.innerHTML='<div class="in"><a href="/" '+(cur==='apps'?'aria-current="page"':'')+'>'+i.apps+'Apps</a><a href="/#search" id="navSearch">'+i.search+'Search</a><a href="/submit/" '+(cur==='submit'?'aria-current="page"':'')+'>'+i.submit+'Submit</a><a href="/developers/" '+(cur==='dev'?'aria-current="page"':'')+'>'+i.dev+'Developers</a></div>';
    d.body.appendChild(el);
  };
  S.footer=function(){return '<footer class="foot">© Hunnyhive · <a href="/developers/">For developers</a> · <a href="/submit/">Submit your PWA</a></footer>'};
  if('serviceWorker' in navigator) w.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})});
  /* store's own install handled by /sdk/install.js */
  S.installStore=function(){ if(w.MyPWA) return w.MyPWA.install().then(function(r){if(r==='unavailable') w.MyPWA.showInstall()}); };
})(window,document);

/* ---- expandable previews (lightbox) ---- */
(function(){
  var box,imgs=[],idx=0,sx=0;
  function build(){
    if(box)return;
    box=document.createElement('div');box.className='lb';box.hidden=true;
    box.innerHTML='<button class="lb-x" aria-label="Close">✕</button><button class="lb-p" aria-label="Previous">‹</button><img class="lb-i" alt=""><button class="lb-n" aria-label="Next">›</button><div class="lb-c"></div>';
    document.body.appendChild(box);
    box.addEventListener('click',function(e){var t=e.target;
      if(t.classList.contains('lb-p'))go(-1);else if(t.classList.contains('lb-n'))go(1);else if(t.tagName!=='IMG')close();});
    box.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
    box.addEventListener('touchend',function(e){var d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>50)go(d<0?1:-1)},{passive:true});
    document.addEventListener('keydown',function(e){if(box.hidden)return;
      if(e.key==='Escape')close();else if(e.key==='ArrowLeft')go(-1);else if(e.key==='ArrowRight')go(1)});
  }
  function show(){var i=box.querySelector('.lb-i');i.src=imgs[idx].currentSrc||imgs[idx].src;i.alt=imgs[idx].alt;
    box.querySelector('.lb-c').textContent=(idx+1)+' / '+imgs.length;
    box.classList.toggle('single',imgs.length<2)}
  function go(d){idx=(idx+d+imgs.length)%imgs.length;show()}
  function close(){box.hidden=true;document.documentElement.style.overflow=''}
  document.addEventListener('click',function(e){
    var im=e.target.closest&&e.target.closest('.shots img');if(!im)return;
    e.preventDefault();build();
    imgs=[].slice.call(im.parentNode.querySelectorAll('img'));idx=imgs.indexOf(im);
    show();box.hidden=false;document.documentElement.style.overflow='hidden';
  });
})();

/* ---- hidden shortcut: tap the small version number in the footer 7 times (or Ctrl+Shift+M) to open MasterDash. It still needs the owner token. ---- */
(function(){
  function foot(){
    if(document.getElementById('sfoot'))return;
    var f=document.createElement('p');f.id='sfoot';f.className='sfoot';
    f.innerHTML='Hunnyhive · <span id="sver">v57</span>';
    document.body.appendChild(f);
    var n=0,t0=0;document.getElementById('sver').addEventListener('click',function(){
      var now=Date.now();if(now-t0>2000)n=0;t0=now;n++;
      if(n>=7){n=0;location.href='/_manage/'}
    });
  }
  if(document.readyState!=='loading')foot();else document.addEventListener('DOMContentLoaded',foot);
  document.addEventListener('keydown',function(e){if(e.ctrlKey&&e.shiftKey&&(e.key==='M'||e.key==='m')){e.preventDefault();location.href='/_manage/'}});
})();
