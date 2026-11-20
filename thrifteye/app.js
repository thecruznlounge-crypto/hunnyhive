const KEY = 'thrifteyes_data_v2';
let data = loadData();
let map = null;
let markerLayer = null;
let stream = null;
let activeSaleFilter = 'all';
let verifiedOnlyState = localStorage.getItem('thrifteyes_verified_only') === 'true';
let deferredPrompt = null;

function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function $(id){ return document.getElementById(id); }
function loadData(){ try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function saveData(){ localStorage.setItem(KEY, JSON.stringify(data)); renderStats(); }
function toast(message){ const t=$('toast'); if(!t) return; t.textContent=message; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2400); navigator.vibrate?.(12); }

if(!data){
  data = {
    sales: [
      {id:uid(), name:'Maple Drive ThriftEyes Sale', type:'In-person', cat:'Furniture', desc:'Sofa, dining set, lamps', lat:25.7617, lng:-80.1918, ver:true, date:'Sat 9–2'},
      {id:uid(), name:'Kiera’s Closet', type:'Virtual', cat:'Clothing', desc:'Dresses, shoes, bags', lat:25.78, lng:-80.19, ver:true, date:'Sun 10–4'},
      {id:uid(), name:'Garage on Oak', type:'Hosted', cat:'Tools', desc:'Power tools and garden gear', lat:25.73, lng:-80.23, ver:true, date:'Fri 8–1'},
      {id:uid(), name:'Estate Finds Weekend', type:'Estate', cat:'Collectibles', desc:'Records, decor, art', lat:25.77, lng:-80.185, ver:true, date:'Sat/Sun'},
      {id:uid(), name:'Retro Electronics', type:'Thrift Store', cat:'Electronics', desc:'Consoles, cameras, cables', lat:25.75, lng:-80.205, ver:false, date:'Daily'}
    ],
    items: [],
    hosts: [{id:uid(), name:'Verified Miami Host', type:'In-Yard Host', cap:80, verified:true}],
    apps: []
  };
  saveData();
}

function renderStats(){
  if($('sSales')) $('sSales').textContent = data.sales.length;
  if($('sItems')) $('sItems').textContent = data.items.length;
  if($('sHosts')) $('sHosts').textContent = data.hosts.length;
}

function showPage(pageName){
  document.querySelectorAll('.page').forEach(page => page.classList.remove('on'));
  const target = pageName === 'map' ? $('mapPage') : $(pageName);
  if(target) target.classList.add('on');
  document.querySelectorAll('[data-page]').forEach(btn => btn.classList.toggle('on', btn.dataset.page === pageName));
  if(pageName === 'map' && map) setTimeout(() => map.invalidateSize(), 150);
  window.scrollTo({top:0, behavior:'smooth'});
}

function openModal(id){ $(id)?.classList.add('on'); }
function closeModals(){ document.querySelectorAll('.modal').forEach(m => m.classList.remove('on')); stopCamera(); }

function verifiedBadge(sale){ return sale.ver ? '<span class="badge">✓ ThriftEyes Verified <span class="tip">ⓘ</span></span>' : ''; }
function saleMatches(sale){
  const query = ($('q')?.value || '').toLowerCase();
  const filterOk = activeSaleFilter === 'all' || sale.type === activeSaleFilter;
  const verifiedOk = !verifiedOnlyState || sale.ver;
  const queryOk = !query || [sale.name, sale.type, sale.cat, sale.desc].join(' ').toLowerCase().includes(query);
  return filterOk && verifiedOk && queryOk;
}
function makeIcon(sale){
  const color = sale.ver ? '#4fd68d' : '#86c5ff';
  const ring = sale.ver ? '0.24' : '0';
  return L.divIcon({
    className: '',
    html: `<div style="width:23px;height:23px;background:${color};border:2px solid #07100b;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);box-shadow:0 0 0 4px rgba(79,214,141,${ring}),0 8px 18px #0008"></div>`,
    iconSize:[28,28],
    iconAnchor:[14,28]
  });
}

function initMap(){
  if(!window.L || !$('map')) return;
  map = L.map('map').setView([25.7617,-80.1918], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  $('verified')?.classList.toggle('on', verifiedOnlyState);
  renderSales();
}

function renderSales(){
  if(!markerLayer || !$('sales')) return;
  markerLayer.clearLayers();
  $('sales').innerHTML = '';
  const filtered = data.sales.filter(saleMatches);
  filtered.forEach(sale => {
    L.marker([sale.lat, sale.lng], {icon: makeIcon(sale)})
      .addTo(markerLayer)
      .bindPopup(`<b>${sale.name}</b><br>${verifiedBadge(sale)}<br>${sale.type} • ${sale.cat}<br>${sale.date}<br>${sale.desc}`);

    const card = document.createElement('div');
    card.className = 'sale';
    card.innerHTML = `<b>${sale.name}</b><br>${verifiedBadge(sale)}<p>${sale.type} • ${sale.cat} • ${sale.date}</p><small>${sale.desc}</small><div class="row"><button data-center="${sale.id}">View</button><button data-route="${sale.lat},${sale.lng}">Route</button></div>`;
    $('sales').appendChild(card);
  });
  $('sales').querySelectorAll('[data-center]').forEach(btn => btn.addEventListener('click', () => {
    const sale = data.sales.find(s => s.id === btn.dataset.center);
    if(sale) map.setView([sale.lat, sale.lng], 14);
  }));
  $('sales').querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => {
    const [lat,lng] = btn.dataset.route.split(',');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }));
}

async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    $('vid').srcObject = stream;
    $('vid').style.display = 'block';
    $('prev').style.display = 'none';
  } catch(err){ toast('Camera unavailable. Try Upload.'); }
}
function stopCamera(){
  if(stream){ stream.getTracks().forEach(track => track.stop()); stream = null; }
  if($('vid')) $('vid').style.display = 'none';
}
function simulateAI(){
  const samples = [
    ['Zara Floral Dress','Clothing','Good',28,'Lightweight floral dress in good condition.'],
    ['Makita Drill Set','Tools','Good',55,'Cordless drill set with charger.'],
    ['Vintage Lamp','Collectibles','Fair',35,'Mid-century lamp with resale appeal.'],
    ['Bluetooth Speaker','Electronics','Good',22,'Portable speaker, tested.']
  ];
  const sample = samples[Math.floor(Math.random() * samples.length)];
  $('iTitle').value = sample[0];
  $('iCat').value = sample[1];
  $('iCond').value = sample[2];
  $('iPrice').value = sample[3];
  $('iDesc').value = sample[4];
  $('ov').innerHTML = `${sample[0]} • ${sample[2]} Condition • <strong>$${sample[3]}</strong><br><small>Powered by ThriftEyes AI</small>`;
  $('ov').style.display = 'block';
  navigator.vibrate?.(15);
}
function capturePhoto(){
  if(!stream) return toast('Open camera first.');
  const canvas = $('canvas');
  canvas.width = $('vid').videoWidth;
  canvas.height = $('vid').videoHeight;
  canvas.getContext('2d').drawImage($('vid'), 0, 0);
  $('prev').src = canvas.toDataURL('image/png');
  $('prev').style.display = 'block';
  stopCamera();
  simulateAI();
}

function renderItems(){
  const grid = $('itemGrid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!data.items.length){ grid.innerHTML = '<article><h2>No listings yet</h2><p>Use AI List to create one.</p></article>'; return; }
  data.items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'item';
    card.innerHTML = `${item.img ? `<img src="${item.img}" alt="">` : ''}<h3>${item.title}</h3><p>${item.cat} • ${item.cond}</p><b>$${item.price}</b><p>${item.desc}</p><button data-del="${item.id}">Delete</button>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
    data.items = data.items.filter(item => item.id !== btn.dataset.del);
    saveData();
    renderItems();
  }));
}

function renderCalculator(){
  if(!$('calc')) return;
  const sold = Math.round(+$('cItems').value * (+$('cTurn').value / 100));
  const earn = Math.round(sold * +$('cPrice').value * (+$('cComm').value / 100));
  $('calc').innerHTML = `$${earn}/month <small>(${sold} sales × $${$('cPrice').value} × ${$('cComm').value}%)</small>`;
}

function bindEvents(){
  document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
  document.addEventListener('click', e => {
    if(e.target.matches('[data-ai]')) openModal('ai');
    if(e.target.classList.contains('x') || e.target.classList.contains('modal')) closeModals();
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if($('install')) $('install').hidden = false; });
  if($('install')) $('install').addEventListener('click', async () => { if(deferredPrompt) await deferredPrompt.prompt(); $('install').hidden = true; });

  if($('q')) $('q').addEventListener('input', renderSales);
  document.querySelectorAll('#filters .chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('#filters .chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    activeSaleFilter = chip.dataset.f;
    renderSales();
  }));
  if($('verified')) $('verified').addEventListener('click', () => {
    verifiedOnlyState = !verifiedOnlyState;
    localStorage.setItem('thrifteyes_verified_only', String(verifiedOnlyState));
    $('verified').classList.toggle('on', verifiedOnlyState);
    renderSales();
    toast(verifiedOnlyState ? 'Showing verified only.' : 'Showing all sales.');
  });
  if($('loc')) $('loc').addEventListener('click', () => navigator.geolocation?.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    map.setView(ll, 13);
    L.circleMarker(ll, {radius:7, color:'#4fd68d'}).addTo(map).bindPopup('You are here').openPopup();
  }, () => toast('Location unavailable.')));
  if($('reset')) $('reset').addEventListener('click', () => map.setView([25.7617,-80.1918],12));
  if($('newSale')) $('newSale').addEventListener('click', () => openModal('saleModal'));
  if($('saleForm')) $('saleForm').addEventListener('submit', e => {
    e.preventDefault();
    data.sales.push({id:uid(), name:$('saleName').value, type:$('saleType').value, cat:$('saleCat').value || 'General', desc:'New ThriftEyes Sale', lat:+$('saleLat').value, lng:+$('saleLng').value, ver:$('saleVer').checked, date:'Scheduled'});
    saveData(); closeModals(); renderSales(); toast('Sale created.');
  });

  if($('startCam')) $('startCam').addEventListener('click', startCamera);
  if($('stopCam')) $('stopCam').addEventListener('click', stopCamera);
  if($('snap')) $('snap').addEventListener('click', capturePhoto);
  if($('upload')) $('upload').addEventListener('change', e => {
    const file = e.target.files[0];
    if(file){ $('prev').src = URL.createObjectURL(file); $('prev').style.display = 'block'; $('vid').style.display = 'none'; simulateAI(); }
  });
  if($('itemForm')) $('itemForm').addEventListener('submit', e => {
    e.preventDefault();
    data.items.unshift({id:uid(), title:$('iTitle').value, desc:$('iDesc').value, cat:$('iCat').value, cond:$('iCond').value, price:+$('iPrice').value, img:$('prev').src || ''});
    saveData(); renderItems(); closeModals(); showPage('items'); toast('Listing saved.');
  });

  ['cItems','cPrice','cComm','cTurn'].forEach(id => { if($(id)) $(id).addEventListener('input', renderCalculator); });
  document.querySelectorAll('.apply').forEach(btn => btn.addEventListener('click', () => { $('hType').value = btn.closest('article').dataset.host; $('hostForm').scrollIntoView({behavior:'smooth'}); }));
  if($('hostForm')) $('hostForm').addEventListener('submit', e => {
    e.preventDefault();
    data.apps.push({id:uid(), name:$('hName').value, email:$('hEmail').value, loc:$('hLoc').value, type:$('hType').value, cap:$('hCap').value});
    data.hosts.push({id:uid(), name:$('hName').value, type:$('hType').value, cap:$('hCap').value, verified:false});
    saveData(); $('hostForm').reset(); toast('Host application saved.');
  });
  if($('hostMatch')) $('hostMatch').addEventListener('click', () => { showPage('map'); activeSaleFilter='Hosted'; document.querySelectorAll('#filters .chip').forEach(c=>c.classList.toggle('on', c.dataset.f==='Hosted')); renderSales(); });
  if($('export')) $('export').addEventListener('click', () => { const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='thrifteyes-export.json'; a.click(); });
  if($('wipe')) $('wipe').addEventListener('click', () => { if(confirm('Reset all local data?')){ localStorage.removeItem(KEY); location.reload(); } });
}

if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn)); }

document.addEventListener('DOMContentLoaded', () => { bindEvents(); renderStats(); renderItems(); renderCalculator(); initMap(); });
