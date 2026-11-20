/* Merkuri — The Element of Delivery · app.js v2.0.0 (vanilla, offline-first) */
(() => {
'use strict';
const VERSION = '2.0.2';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const icon = (id, cls = 'ic') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const now = () => new Date().toISOString();
const fmtTime = iso => new Date(iso).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});

/* ---------- Storage (safe) ---------- */
const KEY = 'merkuri.v2';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} }
};

const COURIERS = [
  {id:'c1', name:'Alex R.',   vehicle:'scooter', rating:4.9, reviews:128, price:8.50,  eta:15, spec:'Fast retail runs',         hue:28},
  {id:'c2', name:'Maria S.',  vehicle:'car',     rating:4.8, reviews:84,  price:9.25,  eta:18, spec:'Grocery & scheduled runs', hue:340},
  {id:'c3', name:'James T.',  vehicle:'bike',    rating:4.7, reviews:76,  price:7.75,  eta:12, spec:'Downtown quick drops',     hue:200},
  {id:'c4', name:'Sophie L.', vehicle:'scooter', rating:4.9, reviews:103, price:8.90,  eta:16, spec:'Restaurant & pharmacy',    hue:150},
  {id:'c5', name:'Jalen W.',  vehicle:'van',     rating:5.0, reviews:61,  price:22.00, eta:25, spec:'Packages, parts & bulk',   hue:45},
  {id:'c6', name:'Nia P.',    vehicle:'bike',    rating:4.7, reviews:52,  price:6.95,  eta:14, spec:'Brickell & Downtown',      hue:265},
  {id:'c7', name:'Diego M.',  vehicle:'car',     rating:4.8, reviews:139, price:10.50, eta:20, spec:'Catering & large orders',  hue:12},
  {id:'c8', name:'Ari K.',    vehicle:'scooter', rating:4.6, reviews:44,  price:7.40,  eta:13, spec:'Wynwood & Midtown',        hue:185}
];
const VEH_ICON = {bike:'bike', scooter:'scooter', car:'car', van:'truck'};
const AVG_RATE = 8.45;

const defaults = () => ({
  profile: {name:'', email:'', phone:'', role:'courier'},
  settings: {online:true, notify:false, geotag:true, rate:8.50},
  orders: [
    {id:1357, from:'Wynwood', to:'Midtown', mi:2.4, amount:12.45, status:'new', created:now()},
    {id:1356, from:'Brickell', to:'Coral Gables', mi:4.8, amount:15.80, status:'new', created:now()},
    {id:1355, from:'Little Havana', to:'Downtown', mi:2.1, amount:9.60, status:'new', created:now()}
  ],
  tx: [],
  threads: [
    {id:'t1', cid:'c1', msgs:[{me:false, t:'Hi! I can pick up from Wynwood in 10 minutes.', at:now()}]},
    {id:'t2', cid:'c2', msgs:[{me:false, t:'Scheduled run confirmed for tomorrow 9 AM.', at:now()}]},
    {id:'t3', cid:'c3', msgs:[{me:false, t:'Dropped at the front desk — photo uploaded.', at:now()}]}
  ],
  nextId: 1358
});
let S = Object.assign(defaults(), store.get() || {});
const save = () => store.set(S);

/* ---------- Toast ---------- */
let toastT;
function toast(msg, action) {
  const t = $('[data-toast]');
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="btn sm">${esc(action.label)}</button>` : '');
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('on'); };
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), action ? 9000 : 2800);
}

/* ---------- Modal ---------- */
const modal = $('[data-modal]');
function openModal(title, html, onMount) {
  $('[data-mtitle]').textContent = title;
  $('[data-mbody]').innerHTML = html;
  modal.classList.add('on');
  onMount && onMount($('[data-mbody]'));
}
const closeModal = () => modal.classList.remove('on');
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

/* ---------- Router ---------- */
const VIEWS = ['home','couriers','orders','trip','proof','network','wallet','messages','account'];
let pendingScroll = null, currentTrip = null;
function route() {
  let v = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'home';
  if (!VIEWS.includes(v)) v = 'home';
  if (v === 'trip' && !currentTrip) v = 'orders';
  $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  $$('.bottom-nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === v || (v === 'trip' && b.dataset.go === 'orders')));
  $('footer').style.display = v === 'home' ? '' : 'none';
  render[v] && render[v]();
  if (pendingScroll) { const el = document.getElementById(pendingScroll); pendingScroll = null; el && setTimeout(() => el.scrollIntoView({behavior:'smooth'}), 30); }
  else window.scrollTo(0, 0);
  $('[data-drawer]').classList.remove('on');
}
const go = v => { if (location.hash === '#/' + v) route(); else location.hash = '#/' + v; };
window.addEventListener('hashchange', route);

/* ---------- Map (SVG, offline) ---------- */
const ZONES = [
  {n:'Hialeah', x:140, y:70}, {n:'Doral', x:70, y:170}, {n:'Wynwood', x:330, y:150},
  {n:'Downtown', x:330, y:205}, {n:'Brickell', x:315, y:250}, {n:'Little Havana', x:225, y:225},
  {n:'Coral Gables', x:215, y:310}, {n:'Miami Beach', x:500, y:160}, {n:'Midtown', x:345, y:115}
];
function mapSVG(mini) {
  const roads = [
    'M0 120 C 120 130, 240 110, 600 140', 'M0 260 C 160 250, 300 270, 440 250', 'M290 0 C 300 120, 280 260, 300 400',
    'M150 0 C 170 140, 140 260, 180 400', 'M0 190 L 440 200', 'M60 400 L 420 40', 'M390 0 C 380 200, 400 300, 380 400',
    'M440 150 L 600 170', 'M440 250 C 470 220, 500 200, 600 210'
  ];
  let grid = '';
  for (let x = 0; x <= 600; x += 30) grid += `<path d="M${x} 0V400"/>`;
  for (let y = 0; y <= 400; y += 30) grid += `<path d="M0 ${y}H600"/>`;
  const dots = Array.from({length: mini ? 9 : 16}, (_, i) => {
    const z = ZONES[i % ZONES.length];
    const x = z.x + (Math.random() * 70 - 35), y = z.y + (Math.random() * 60 - 30);
    return `<g class="courier-dot" data-dot style="transform:translate(${x}px,${y}px)"><circle r="13" fill="rgba(5,11,18,.9)" stroke="#f2c76b" stroke-width="1.5"/><g transform="translate(-8 -8) scale(.68)" stroke="#f2c76b" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 9h6l3.5 8M9 9l3 8M15 9l-1-3h-2"/></g></g>`;
  }).join('');
  return `<svg class="mapsvg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
   <defs><radialGradient id="glow${mini?'m':''}"><stop offset="0" stop-color="#d8a94d" stop-opacity=".45"/><stop offset="1" stop-color="#d8a94d" stop-opacity="0"/></radialGradient></defs>
   <rect width="600" height="400" fill="#06101b"/>
   <path d="M430 0 C 410 120, 450 260, 420 400 L600 400 L600 0Z" fill="#081a2b"/>
   <path d="M470 60 C 490 140, 480 260, 500 360 L 530 360 C 515 260, 520 140, 500 60Z" fill="#0b1726" stroke="rgba(216,169,77,.12)"/>
   <g stroke="rgba(216,169,77,.05)" stroke-width="1">${grid}</g>
   <g stroke="rgba(160,180,200,.18)" stroke-width="2" fill="none">${roads.map(d => `<path d="${d}"/>`).join('')}</g>
   ${mini ? '' : ZONES.map(z => `<text class="map-label" x="${z.x}" y="${z.y - 22}" text-anchor="middle">${z.n}</text>`).join('')}
   <circle cx="320" cy="185" r="${mini ? 55 : 80}" fill="url(#glow${mini?'m':''})"/>
   <ellipse cx="320" cy="195" rx="${mini?30:44}" ry="${mini?10:14}" fill="none" stroke="#d8a94d" stroke-opacity=".6"><animate attributeName="rx" values="${mini?'20;40;20':'30;60;30'}" dur="3s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".8;0;.8" dur="3s" repeatCount="indefinite"/></ellipse>
   <path d="M320 195 c -14 -16 -18 -24 -18 -32 a18 18 0 0 1 36 0 c0 8 -4 16 -18 32z" fill="#e0a83e" stroke="#7a5414"/><circle cx="320" cy="163" r="6" fill="#06101b"/>
   ${dots}
  </svg>`;
}
function mountMap(el, mini) {
  el.innerHTML = mapSVG(mini) + (mini ? '' : `<div class="ctrls"><button class="iconbtn" aria-label="Filter" data-mapact="filter">${icon('filter','ic sm')}</button><div class="stack"><button class="iconbtn" aria-label="Zoom in" data-mapact="in">${icon('plus','ic sm')}</button><button class="iconbtn" aria-label="Zoom out" data-mapact="out">${icon('minus','ic sm')}</button><button class="iconbtn" aria-label="Recenter" data-mapact="center">${icon('target','ic sm')}</button></div></div><span class="sample-note">Sample data</span>`);
  let z = 1;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mapact]'); if (!b) return;
    const svg = $('.mapsvg', el), a = b.dataset.mapact;
    if (a === 'in') z = Math.min(2.4, z + .3);
    if (a === 'out') z = Math.max(1, z - .3);
    if (a === 'center') z = 1;
    if (a === 'filter') { go('couriers'); return; }
    svg.style.transform = `scale(${z})`;
  });
}
function wanderDots() {
  $$('[data-dot]').forEach(d => {
    if (Math.random() < .5) return;
    const m = d.style.transform.match(/translate\(([\d.-]+)px,\s*([\d.-]+)px/);
    if (!m) return;
    const x = Math.max(20, Math.min(560, +m[1] + (Math.random() * 40 - 20)));
    const y = Math.max(20, Math.min(380, +m[2] + (Math.random() * 30 - 15)));
    d.style.transform = `translate(${x}px,${y}px)`;
  });
}

/* ---------- Live stats (sample) ---------- */
const stats = {couriers:1248, orders:340, done:2156};
function tickStats() {
  stats.couriers += Math.round(Math.random() * 6 - 3);
  stats.orders = Math.max(280, stats.orders + Math.round(Math.random() * 8 - 4));
  if (Math.random() < .6) stats.done += 1;
  $$('[data-stat]').forEach(el => { const k = el.dataset.stat; if (k in stats) el.textContent = stats[k].toLocaleString(); });
  const r = $$('[data-stat="requests"]'); r.forEach(el => el.textContent = S.orders.filter(o => o.status === 'new').length + 21);
}

/* ---------- Couriers ---------- */
let filt = {q:'', v:'all', sort:'rating'};
function courierCard(c) {
  return `<article class="ccard">
    <button class="cthumb" data-video="${c.id}" style="background:radial-gradient(circle at 50% 35%,hsl(${c.hue} 45% 42%),hsl(${c.hue} 40% 14%) 70%)" aria-label="Play ${esc(c.name)} video profile">
      <span class="chip dim veh" style="background:rgba(0,0,0,.45);color:#fff">${icon(VEH_ICON[c.vehicle],'ic sm')}${c.vehicle}</span>
      <span class="ini">${esc(c.name.split(' ').map(s => s[0]).join(''))}</span>
      <span class="play">${icon('play','ic sm')}</span>
    </button>
    <div class="cbody">
      <span class="rate">${icon('star')} ${c.rating.toFixed(1)} (${c.reviews})</span>
      <h4>${esc(c.name)}</h4>
      <span class="muted" style="font-size:12.5px">${esc(c.spec)}</span>
      <div class="nums"><span><b>${money(c.price)}</b>Delivery</span><span style="text-align:right"><b>${c.eta} mins</b>ETA</span></div>
      <button class="btn sm" data-book="${c.id}">Choose</button>
    </div></article>`;
}
function renderCards() {
  const home = $('[data-cards="home"]');
  if (home) home.innerHTML = COURIERS.slice(0, 4).map(courierCard).join('');
  const all = $('[data-cards="all"]');
  if (!all) return;
  let list = COURIERS.filter(c => (filt.v === 'all' || c.vehicle === filt.v) &&
    (!filt.q || (c.name + ' ' + c.spec).toLowerCase().includes(filt.q.toLowerCase())));
  list.sort((a, b) => filt.sort === 'price' ? a.price - b.price : filt.sort === 'eta' ? a.eta - b.eta : b.rating - a.rating);
  all.innerHTML = list.length ? list.map(courierCard).join('') : `<div class="empty" style="grid-column:1/-1">${icon('search')}No couriers match. Try another filter.</div>`;
}
$('[data-q]').addEventListener('input', e => { filt.q = e.target.value; renderCards(); });
$('[data-sort]').addEventListener('change', e => { filt.sort = e.target.value; renderCards(); });
$('[data-vehicle]').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('[data-vehicle] button').forEach(x => x.classList.toggle('on', x === b));
  filt.v = b.dataset.v; renderCards();
});

function videoModal(id) {
  const c = COURIERS.find(x => x.id === id);
  openModal(c.name, `
    <div style="aspect-ratio:16/10;border-radius:14px;background:radial-gradient(circle at 50% 35%,hsl(${c.hue} 45% 40%),hsl(${c.hue} 40% 10%) 75%);display:grid;place-items:center;position:relative;overflow:hidden">
      <span style="font-size:64px;font-weight:800">${esc(c.name.split(' ').map(s => s[0]).join(''))}</span>
      <span class="chip" style="position:absolute;left:12px;top:12px">${icon(VEH_ICON[c.vehicle],'ic sm')} ${c.vehicle}</span>
    </div>
    <p class="muted" style="margin:12px 0">Video intro plays here once ${esc(c.name.split(' ')[0])} uploads one.</p>
    <div class="stat-row">Rating<b>★ ${c.rating} · ${c.reviews} reviews</b></div>
    <div class="stat-row">Specialty<b style="font-size:14px">${esc(c.spec)}</b></div>
    <div class="stat-row">Rate · ETA<b>${money(c.price)} · ${c.eta} min</b></div>
    <div style="display:flex;gap:10px;margin-top:16px"><button class="btn line" style="flex:1" data-msg="${c.id}">${icon('chat','ic sm')}Message</button><button class="btn" style="flex:1" data-book="${c.id}">Choose ${esc(c.name.split(' ')[0])}</button></div>`);
}

function bookModal(id) {
  const c = COURIERS.find(x => x.id === id);
  openModal('Book ' + c.name, `
    <form data-bookform>
      <label class="lbl">Pickup</label><input class="inp" name="from" required placeholder="e.g. Wynwood Walls" autocomplete="street-address">
      <label class="lbl">Drop-off</label><input class="inp" name="to" required placeholder="e.g. 3401 N Miami Ave">
      <label class="lbl">Notes for courier</label><textarea class="inp" name="notes" placeholder="Gate code, fragile, call on arrival…"></textarea>
      <div class="stat-row">Courier rate<b>${money(c.price)}</b></div>
      <div class="stat-row">Held in SecurePay escrow until proof<b>${icon('lock','ic sm')}</b></div>
      <button class="btn block" style="margin-top:14px">Confirm &amp; Hold ${money(c.price)}</button>
      <p class="muted" style="font-size:11.5px;margin-top:10px">By booking you agree to the <a href="terms.html">Terms</a>. Payments are processed by our payment partner when live.</p>
    </form>`, body => {
    $('form', body).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const o = {id:S.nextId++, from:f.get('from'), to:f.get('to'), notes:f.get('notes'), mi:+(1 + Math.random() * 5).toFixed(1), amount:c.price, status:'accepted', courier:c.id, created:now()};
      S.orders.unshift(o);
      S.tx.unshift({k:'hold', label:`Escrow hold · #${o.id}`, amt:o.amount, at:now()});
      save(); closeModal(); toast(`Booked ${c.name} · ${money(c.price)} held in escrow`);
      orderTab = 'accepted'; go('orders');
    };
  });
}

function requestModal() {
  openModal('Post a Delivery Request', `
    <form data-reqform>
      <label class="lbl">Pickup</label><input class="inp" name="from" required placeholder="Pickup area or address">
      <label class="lbl">Drop-off</label><input class="inp" name="to" required placeholder="Drop-off area or address">
      <label class="lbl">Your offer (USD)</label><input class="inp" name="amount" type="number" min="3" step="0.05" value="${AVG_RATE}" inputmode="decimal" required>
      <p class="muted" style="font-size:12px">RateSync local average: ${money(AVG_RATE)}</p>
      <button class="btn block" style="margin-top:14px">Post Request</button>
    </form>`, body => {
    $('form', body).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      S.orders.unshift({id:S.nextId++, from:f.get('from'), to:f.get('to'), mi:+(1 + Math.random() * 5).toFixed(1), amount:+f.get('amount'), status:'new', created:now()});
      save(); closeModal(); toast('Request posted to the marketplace'); orderTab = 'new'; go('orders');
    };
  });
}

/* ---------- Orders ---------- */
let orderTab = 'new';
$('[data-otab]').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  orderTab = b.dataset.t; renderOrders();
});
function renderOrders() {
  $$('[data-otab] button').forEach(b => b.classList.toggle('on', b.dataset.t === orderTab));
  const list = S.orders.filter(o => o.status === orderTab);
  const box = $('[data-olist]');
  if (!list.length) { box.innerHTML = `<div class="empty">${icon('orders')}No ${orderTab === 'active' ? 'in-progress' : orderTab} orders.</div>`; return; }
  box.innerHTML = list.map(o => {
    const c = o.courier && COURIERS.find(x => x.id === o.courier);
    const act = {
      new: `<button class="btn sm" data-oact="accept" data-id="${o.id}">Accept</button><button class="btn line sm" data-oact="decline" data-id="${o.id}">Decline</button>`,
      accepted: `<button class="btn sm" data-oact="start" data-id="${o.id}">${icon('route','ic sm')}Start Trip</button>`,
      active: `<button class="btn sm" data-oact="open" data-id="${o.id}">Open Trip</button><button class="btn line sm" data-oact="proof" data-id="${o.id}">${icon('camera','ic sm')}Capture Proof</button>`,
      done: `<span class="chip ok">${icon('check','ic sm')} Delivered · funds released</span>`
    }[o.status];
    return `<div class="order-card">
      <div class="route"><div><b>#${o.id}</b><span class="muted" style="font-size:12px">${o.mi} mi${c ? ' · ' + esc(c.name) : ''}</span></div>
      <div>${icon('pin','ic sm gold')}${esc(o.from)}</div><div>${icon('pin','ic sm bad')}${esc(o.to)}</div></div>
      <div class="amt">${money(o.amount)}</div>
      <div class="actions">${act}</div></div>`;
  }).join('');
  updateBadge();
}
function updateBadge() {
  const n = S.orders.filter(o => o.status === 'new').length, b = $('[data-badge]');
  b.hidden = !n; b.textContent = n;
}
$('[data-olist]').addEventListener('click', e => {
  const b = e.target.closest('[data-oact]'); if (!b) return;
  const o = S.orders.find(x => x.id === +b.dataset.id); if (!o) return;
  const a = b.dataset.oact;
  if (a === 'accept') { o.status = 'accepted'; S.tx.unshift({k:'hold', label:`Escrow hold · #${o.id}`, amt:o.amount, at:now()}); toast(`Order #${o.id} accepted`); }
  if (a === 'decline') { S.orders = S.orders.filter(x => x !== o); toast(`Order #${o.id} declined`); }
  if (a === 'start') { o.status = 'active'; o.started = now(); save(); currentTrip = o; go('trip'); return; }
  if (a === 'open') { currentTrip = o; go('trip'); return; }
  if (a === 'proof') { openCamera(o.id); return; }
  save(); renderOrders();
});

/* ---------- Trip ---------- */
let tripTimer;
function renderTrip() {
  const o = currentTrip;
  $('[data-tripmap]').innerHTML = `<svg viewBox="0 0 400 240" style="width:100%;height:100%" preserveAspectRatio="xMidYMid slice"><rect width="400" height="240" fill="#06101b"/>
   <g stroke="rgba(160,180,200,.15)" stroke-width="2" fill="none"><path d="M0 60H400M0 150H400M90 0V240M220 0V240M330 0V240"/></g>
   <path id="rt" d="M60 40 C 160 50, 90 130, 200 140 S 330 200, 340 210" stroke="#f2c76b" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-dasharray="7 6"><animate attributeName="stroke-dashoffset" from="26" to="0" dur="1s" repeatCount="indefinite"/></path>
   <circle cx="60" cy="40" r="8" fill="#f2c76b"/><circle cx="340" cy="210" r="8" fill="#ff5a5a"/>
   <circle r="9" fill="#06101b" stroke="#f2c76b" stroke-width="2"><animateMotion dur="14s" repeatCount="indefinite"><mpath href="#rt"/></animateMotion></circle>
   <text x="60" y="24" class="map-label" text-anchor="middle">${esc(o.from)}</text><text x="340" y="234" class="map-label" text-anchor="middle">${esc(o.to)}</text></svg>`;
  $('[data-tripinfo]').innerHTML = `
    <div class="stat-row">${icon('orders')}Order<b>#${o.id}</b></div>
    <div class="stat-row">${icon('pin')}Pickup<b style="font-size:14px">${esc(o.from)}</b></div>
    <div class="stat-row">${icon('pin')}Drop-off<b style="font-size:14px">${esc(o.to)}</b></div>
    ${o.notes ? `<div class="stat-row">${icon('doc')}Notes<b style="font-size:13px">${esc(o.notes)}</b></div>` : ''}
    <div style="display:flex;justify-content:space-between;margin:16px 0"><span><small class="muted">Earnings</small><br><b style="font-size:26px">${money(o.amount)}</b></span><span style="text-align:right"><small class="muted">Time</small><br><b style="font-size:26px" data-elapsed>0 min</b></span></div>
    <div style="display:grid;gap:10px"><button class="btn block" data-trip="nav">${icon('route','ic sm')}Navigate</button><button class="btn ghost block" data-trip="proof">${icon('camera','ic sm')}Capture Proof &amp; Complete</button></div>`;
  clearInterval(tripTimer);
  const upd = () => { const el = $('[data-elapsed]'); if (el) el.textContent = Math.max(0, Math.round((Date.now() - new Date(o.started || Date.now())) / 60000)) + ' min'; };
  upd(); tripTimer = setInterval(upd, 15000);
}
$('[data-tripinfo]').addEventListener('click', e => {
  const b = e.target.closest('[data-trip]'); if (!b || !currentTrip) return;
  if (b.dataset.trip === 'nav') {
    if (!navigator.onLine) return toast('Navigation needs a connection — you\'re offline');
    window.open('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(currentTrip.from + ', Miami FL') + '&destination=' + encodeURIComponent(currentTrip.to + ', Miami FL') + '&travelmode=driving', '_blank', 'noopener');
  } else openCamera(currentTrip.id);
});

/* ---------- Proof storage (IndexedDB) ---------- */
const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej('no idb');
      const r = indexedDB.open('merkuri', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('proofs', {keyPath:'id'});
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('proofs', mode); const out = fn(t.objectStore('proofs')); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); },
  put(p) { return this.tx('readwrite', s => s.put(p)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  all() { return this.tx('readonly', s => s.getAll()); },
  clear() { return this.tx('readwrite', s => s.clear()); }
};
const KIND_LABEL = {delivery:'Delivery proof', pickup:'Pickup verification', damage:'Damage report'};
async function renderProof() {
  const g = $('[data-gallery]');
  let items = [];
  try { items = (await DB.all()) || []; } catch {}
  items.sort((a, b) => b.at.localeCompare(a.at));
  g.innerHTML = items.length ? items.map(p => `<figure><img src="${p.img}" alt="${esc(KIND_LABEL[p.kind])}" loading="lazy"><button data-delproof="${p.id}" aria-label="Delete">${icon('x','ic sm')}</button><figcaption><b style="color:var(--text)">${esc(KIND_LABEL[p.kind])}</b>${p.order ? ' · #' + p.order : ''}<br>${fmtTime(p.at)}${p.geo ? '<br>' + p.geo : ''}</figcaption></figure>`).join('')
    : `<div class="empty" style="grid-column:1/-1">${icon('image')}No proof photos yet. Tap <b>Open Camera</b> to capture one.</div>`;
}
$('[data-gallery]').addEventListener('click', async e => {
  const b = e.target.closest('[data-delproof]'); if (!b) return;
  await DB.del(b.dataset.delproof); renderProof(); toast('Photo deleted');
});

/* ---------- Camera ---------- */
const cam = $('[data-camera]'), video = $('video', cam), still = $('.still', cam), canvas = $('canvas', cam);
let stream = null, facing = 'environment', torchOn = false, geo = null, kind = 'delivery', proofOrder = null, shot = null, stampT;
async function startStream() {
  stopStream();
  cam.classList.remove('noaccess');
  if (!navigator.mediaDevices?.getUserMedia) { cam.classList.add('noaccess'); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}, width:{ideal:1920}, height:{ideal:1080}}, audio:false});
    video.srcObject = stream;
    cam.classList.toggle('mirror', facing === 'user');
  } catch { cam.classList.add('noaccess'); }
}
function stopStream() { stream && stream.getTracks().forEach(t => t.stop()); stream = null; }
function stampText() { return `${KIND_LABEL[kind]}${proofOrder ? ' · #' + proofOrder : ''} · ${new Date().toLocaleString()}${geo ? ' · ' + geo : ''}`; }
function setGeo(on) {
  $('[data-cam="geo"]').classList.toggle('on', on);
  if (!on) { geo = null; return; }
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(p => { geo = p.coords.latitude.toFixed(5) + ', ' + p.coords.longitude.toFixed(5); }, () => { geo = null; $('[data-cam="geo"]').classList.remove('on'); }, {enableHighAccuracy:true, timeout:8000, maximumAge:60000});
}
function openCamera(orderId) {
  proofOrder = orderId || null; shot = null;
  cam.classList.remove('review'); $('[data-cam="save"]').disabled = true; $('[data-cam="save"]').classList.remove('done');
  cam.classList.add('on'); document.body.style.overflow = 'hidden';
  startStream(); setGeo(!!S.settings.geotag);
  clearInterval(stampT); stampT = setInterval(() => $('[data-stamp]').textContent = stampText(), 1000);
  $('[data-stamp]').textContent = stampText();
}
function closeCamera() { stopStream(); cam.classList.remove('on','review'); document.body.style.overflow = ''; clearInterval(stampT); torchOn = false; $('[data-cam="torch"]').classList.remove('on'); }
function finishShot(src) {
  const img = new Image();
  img.onload = () => {
    const max = 1280, sc = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * sc); canvas.height = Math.round(img.height * sc);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const fs = Math.max(14, Math.round(canvas.width / 48)), txt = stampText();
    ctx.font = `600 ${fs}px ui-monospace,monospace`;
    const w = ctx.measureText(txt).width + fs;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(fs / 2, canvas.height - fs * 2.4, Math.min(w, canvas.width - fs), fs * 1.8);
    ctx.fillStyle = '#f2c76b'; ctx.fillText(txt, fs, canvas.height - fs * 1.1, canvas.width - fs * 2);
    shot = canvas.toDataURL('image/jpeg', .82);
    still.src = shot; cam.classList.add('review');
    $('[data-cam="save"]').disabled = false; $('[data-cam="save"]').classList.add('done');
  };
  img.src = src;
}
cam.addEventListener('click', async e => {
  const b = e.target.closest('[data-cam],[data-kind]'); if (!b) return;
  if (b.dataset.kind) { kind = b.dataset.kind; $$('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); return; }
  const a = b.dataset.cam;
  if (a === 'close') closeCamera();
  if (a === 'flip') { if (cam.classList.contains('review')) { cam.classList.remove('review'); shot = null; $('[data-cam="save"]').disabled = true; return; } facing = facing === 'environment' ? 'user' : 'environment'; startStream(); }
  if (a === 'geo') setGeo(!b.classList.contains('on'));
  if (a === 'torch') {
    const t = stream?.getVideoTracks()[0], caps = t?.getCapabilities?.();
    if (caps && caps.torch) { torchOn = !torchOn; try { await t.applyConstraints({advanced:[{torch:torchOn}]}); b.classList.toggle('on', torchOn); } catch {} }
    else toast('Flash isn\'t supported on this camera');
  }
  if (a === 'shoot') {
    if (cam.classList.contains('review')) { cam.classList.remove('review'); shot = null; $('[data-cam="save"]').disabled = true; return; }
    if (!stream || !video.videoWidth) return toast('Camera not ready');
    const fx = $('.flashfx', cam); fx.classList.add('go'); requestAnimationFrame(() => setTimeout(() => fx.classList.remove('go'), 40));
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    const cx = c.getContext('2d'); if (facing === 'user') { cx.translate(c.width, 0); cx.scale(-1, 1); }
    cx.drawImage(video, 0, 0); finishShot(c.toDataURL('image/jpeg', .92));
  }
  if (a === 'save' && shot) {
    const p = {id:'p' + Date.now(), img:shot, kind, order:proofOrder, geo, at:now()};
    try { await DB.put(p); } catch { return toast('Could not save photo on this device'); }
    if (proofOrder && kind === 'delivery') completeOrder(proofOrder);
    else toast('Proof saved');
    closeCamera();
    if (!proofOrder) renderProof();
  }
});
$('[data-fileproof]').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => finishShot(r.result); r.readAsDataURL(f);
  cam.classList.remove('noaccess');
});
function completeOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  o.status = 'done'; o.completed = now();
  S.tx.unshift({k:'release', label:`Funds released · #${o.id}`, amt:o.amount, at:now()});
  save(); currentTrip = null; toast(`Delivered! ${money(o.amount)} released from escrow`);
  orderTab = 'done'; go('orders');
}

/* ---------- Network ---------- */
function renderNetwork() {
  const z = [['Wynwood', 92], ['Brickell', 84], ['Downtown', 77], ['Miami Beach', 63], ['Coral Gables', 48]];
  $('[data-zones]').innerHTML = z.map(([n, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${n}</span><span class="muted">${v}%</span></div><div class="bar"><span style="width:${v}%"></span></div></div>`).join('');
}

/* ---------- Wallet / RateSync ---------- */
function balances() {
  let avail = 0, escrow = 0, count = 0;
  const held = new Set();
  S.orders.forEach(o => { if (o.status === 'accepted' || o.status === 'active') escrow += o.amount; if (o.status === 'done') { avail += o.amount; count++; } });
  return {avail, escrow, count, held};
}
function renderWallet() {
  const b = balances();
  $('[data-bal="avail"]').textContent = money(b.avail);
  $('[data-bal="escrow"]').textContent = money(b.escrow);
  $('[data-bal="count"]').textContent = b.count;
  const inp = $('[data-myrate]'); if (document.activeElement !== inp) inp.value = S.settings.rate;
  rateSync();
  $('[data-tx]').innerHTML = S.tx.length ? S.tx.slice(0, 30).map(t => `<div class="tx"><span class="ring-ic">${icon(t.k === 'release' ? 'check' : 'lock','ic sm')}</span><span><span style="font-size:14px">${esc(t.label)}</span><br><small class="muted">${fmtTime(t.at)}</small></span><b class="${t.k === 'release' ? 'ok' : ''}">${t.k === 'release' ? '+' : ''}${money(t.amt)}</b></div>`).join('')
    : `<div class="empty">${icon('wallet')}No activity yet. Accept or book an order to see escrow in action.</div>`;
}
function rateSync() {
  const r = Math.max(1, +$('[data-myrate]').value || S.settings.rate);
  const diff = (r - AVG_RATE) / AVG_RATE;
  const comp = Math.round(Math.max(5, Math.min(99, 92 - diff * 120)));
  const jobs = Math.max(6, Math.round(28 * Math.pow(AVG_RATE / r, .7)));
  $('[data-comp]').textContent = comp + '%';
  $('[data-compbar]').style.width = comp + '%';
  $('[data-proj]').textContent = `$${Math.round(r * jobs * .85)} – $${Math.round(r * jobs * 1.05)}/day`;
  $('[data-advice]').textContent = diff > .15 ? 'You\'re priced well above the local average — expect fewer requests outside peak hours.'
    : diff < -.15 ? 'You\'re priced well below average — you could raise your rate and keep strong demand.'
    : 'Your rate is right in the competitive band for this area.';
}
$('[data-myrate]').addEventListener('input', () => { rateSync(); const v = +$('[data-myrate]').value; if (v > 0) { S.settings.rate = v; save(); } });

/* ---------- Messages ---------- */
let activeThread = null;
function renderMessages() {
  $('[data-tlist]').innerHTML = S.threads.map(t => {
    const c = COURIERS.find(x => x.id === t.cid), last = t.msgs[t.msgs.length - 1];
    return `<div class="thread ${t.id === activeThread ? 'on' : ''}" data-thread="${t.id}"><span class="avatar" style="background:hsl(${c.hue} 45% 35%)">${c.name[0]}</span><span style="min-width:0"><b>${esc(c.name)}</b><br><small class="muted" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last ? last.t : '')}</small></span></div>`;
  }).join('');
  const t = S.threads.find(x => x.id === activeThread);
  $('[data-threads]').classList.toggle('open', !!t);
  if (!t) { $('[data-msgs]').innerHTML = `<div class="empty">${icon('chat')}Pick a conversation.</div>`; $('[data-chatname]').textContent = 'Messages'; return; }
  $('[data-chatname]').textContent = COURIERS.find(x => x.id === t.cid).name;
  $('[data-msgs]').innerHTML = t.msgs.map(m => `<div class="bubble ${m.me ? 'me' : ''}">${esc(m.t)}<small>${fmtTime(m.at)}${m.me && m.queued ? ' · queued' : ''}</small></div>`).join('');
  const box = $('[data-msgs]'); box.scrollTop = box.scrollHeight;
}
$('[data-tlist]').addEventListener('click', e => { const t = e.target.closest('[data-thread]'); if (t) { activeThread = t.dataset.thread; renderMessages(); } });
$('[data-composer]').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('[data-msgin]'), v = inp.value.trim(), t = S.threads.find(x => x.id === activeThread);
  if (!v || !t) return;
  t.msgs.push({me:true, t:v, at:now(), queued:!navigator.onLine}); inp.value = ''; save(); renderMessages();
});
function openThreadFor(cid) {
  let t = S.threads.find(x => x.cid === cid);
  if (!t) { t = {id:'t' + Date.now(), cid, msgs:[]}; S.threads.unshift(t); save(); }
  activeThread = t.id; closeModal(); go('messages');
}

/* ---------- Account ---------- */
function renderAccount() {
  const p = S.profile;
  $('[data-acctsub]').textContent = p.name ? `${p.name}${p.email ? ' · ' + p.email : ''}` : 'Not signed in — your data is saved on this device';
  $$('[data-role] button').forEach(b => b.classList.toggle('on', b.dataset.r === p.role));
  $$('[data-sw]').forEach(b => b.classList.toggle('on', !!S.settings[b.dataset.sw]));
  $('[data-ver]').textContent = VERSION;
}
$('[data-role]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.profile.role = b.dataset.r; save(); renderAccount(); toast('Role set to ' + b.textContent); });
$$('[data-sw]').forEach(b => b.addEventListener('click', async () => {
  const k = b.dataset.sw; S.settings[k] = !S.settings[k];
  if (k === 'notify' && S.settings.notify && 'Notification' in window) {
    const r = await Notification.requestPermission().catch(() => 'denied');
    if (r !== 'granted') { S.settings.notify = false; toast('Notifications are blocked in your browser settings'); }
  }
  save(); renderAccount();
}));
function profileModal(title, role) {
  const p = S.profile;
  openModal(title, `
    <form data-pform>
      <label class="lbl">Full name</label><input class="inp" name="name" required value="${esc(p.name)}" autocomplete="name">
      <label class="lbl">Email</label><input class="inp" name="email" type="email" value="${esc(p.email)}" autocomplete="email">
      <label class="lbl">Phone</label><input class="inp" name="phone" type="tel" value="${esc(p.phone)}" autocomplete="tel">
      <label class="lbl">I want to</label>
      <select class="inp" name="role"><option value="courier">Deliver as a courier</option><option value="fleet">Launch &amp; manage a fleet</option><option value="customer">Send deliveries</option></select>
      <label style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:13px;color:var(--muted)"><input type="checkbox" required style="width:18px;height:18px;margin-top:2px;accent-color:var(--gold)">I agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</label>
      <button class="btn block" style="margin-top:16px">Continue</button>
      <p class="muted" style="font-size:11.5px;margin-top:10px">Saved on this device. Works offline.</p>
    </form>`, body => {
    const f = $('form', body); f.role.value = role || p.role;
    f.onsubmit = e => {
      e.preventDefault(); const d = new FormData(f);
      S.profile = {name:d.get('name').trim(), email:d.get('email').trim(), phone:d.get('phone').trim(), role:d.get('role')};
      save(); closeModal(); toast('Welcome to Merkuri, ' + S.profile.name.split(' ')[0]);
      go(S.profile.role === 'customer' ? 'couriers' : S.profile.role === 'fleet' ? 'network' : 'orders');
    };
  });
}
async function exportData() {
  let proofs = []; try { proofs = await DB.all(); } catch {}
  const blob = new Blob([JSON.stringify({app:'Merkuri', version:VERSION, exported:now(), data:S, proofs}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'merkuri-data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function wipeModal() {
  openModal('Delete my data', `<p class="muted" style="line-height:1.6">This permanently removes your profile, orders, messages, settings and proof photos from this device. This can't be undone.</p>
   <div style="display:flex;gap:10px;margin-top:18px"><button class="btn line" style="flex:1" data-act="close">Cancel</button><button class="btn" style="flex:1;background:var(--bad);color:#fff" data-wipe>Delete</button></div>`, body => {
    $('[data-wipe]', body).onclick = async () => {
      store.clear(); try { await DB.clear(); } catch {}
      S = defaults(); save(); closeModal(); toast('Your data was deleted'); go('home');
    };
  });
}

/* ---------- Install (one tap) ---------- */
let deferredPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || document.referrer.startsWith('android-app://');
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isStandalone()) document.body.classList.add('installed');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { deferredPrompt = null; document.body.classList.add('installed'); toast('Merkuri installed'); });
async function install() {
  if (isStandalone()) return toast('Merkuri is already installed');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const {outcome} = await deferredPrompt.userChoice.catch(() => ({}));
    deferredPrompt = null;
    if (outcome === 'accepted') document.body.classList.add('installed');
    return;
  }
  if (isIOS()) {
    return openModal('Install Merkuri', `<p class="muted">iPhone and iPad add apps from Safari's Share menu:</p>
      <div class="sheet-steps"><div><i>1</i>Tap ${icon('share','ic sm')} <b>Share</b> in Safari</div><div><i>2</i>Choose <b>Add to Home Screen</b></div><div><i>3</i>Tap <b>Add</b></div></div>
      <button class="btn block" data-act="close">Got it</button>`);
  }
  openModal('Install Merkuri', `<p class="muted" style="line-height:1.6">Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. For the best experience use Chrome, Edge or Samsung Internet.</p><button class="btn block" style="margin-top:16px" data-act="close">OK</button>`);
}

/* ---------- Global actions ---------- */
document.addEventListener('click', e => {
  const go_ = e.target.closest('[data-go]'); if (go_) { e.preventDefault(); go(go_.dataset.go); return; }
  const sc = e.target.closest('[data-scroll]'); if (sc) { pendingScroll = sc.dataset.scroll; if (location.hash === '#/home' || !location.hash) { e.preventDefault(); route(); } return; }
  const vid = e.target.closest('[data-video]'); if (vid) return videoModal(vid.dataset.video);
  const bk = e.target.closest('[data-book]'); if (bk) return bookModal(bk.dataset.book);
  const ms = e.target.closest('[data-msg]'); if (ms) return openThreadFor(ms.dataset.msg);
  const a = e.target.closest('[data-act]'); if (!a) return;
  switch (a.dataset.act) {
    case 'install': install(); break;
    case 'drawer': $('[data-drawer]').classList.toggle('on'); break;
    case 'close': closeModal(); break;
    case 'login': profileModal('Log in'); break;
    case 'start': profileModal('Get Started'); break;
    case 'fleet': profileModal('Launch a Fleet', 'fleet'); break;
    case 'courier': profileModal('Become a Courier', 'courier'); break;
    case 'request': requestModal(); break;
    case 'camera': openCamera(); break;
    case 'export': exportData(); break;
    case 'wipe': wipeModal(); break;
    case 'closechat': activeThread = null; renderMessages(); break;
    case 'share':
      if (navigator.share) navigator.share({title:'Merkuri', text:'The Element of Delivery', url:location.origin + location.pathname}).catch(() => {});
      else navigator.clipboard?.writeText(location.origin + location.pathname).then(() => toast('Link copied'));
      break;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('[data-drawer]').classList.remove('on'); if (cam.classList.contains('on')) closeCamera(); } });

/* ---------- Renderers ---------- */
const render = {
  home: renderCards, couriers: renderCards, orders: renderOrders, trip: renderTrip,
  proof: renderProof, network: renderNetwork, wallet: renderWallet, messages: renderMessages, account: renderAccount
};

/* ---------- Online / offline ---------- */
function netState() {
  document.body.classList.toggle('offline', !navigator.onLine);
  if (navigator.onLine) {
    let n = 0; S.threads.forEach(t => t.msgs.forEach(m => { if (m.queued) { m.queued = false; n++; } }));
    if (n) { save(); toast(`Back online · ${n} queued message${n > 1 ? 's' : ''} ready`); }
  }
}
window.addEventListener('online', netState); window.addEventListener('offline', () => { netState(); toast('You\'re offline — Merkuri keeps working'); });

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => toast('A new version of Merkuri is ready', {label:'Update', fn:() => w.postMessage('skip')});
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  });
}

/* ---------- Boot ---------- */
$('[data-year]').textContent = new Date().getFullYear();
$$('[data-map]').forEach(el => mountMap(el, false));
$$('[data-minimap]').forEach(el => mountMap(el, true));
renderCards(); updateBadge(); netState();
const qs = new URLSearchParams(location.search).get('view');
if (qs && VIEWS.includes(qs)) location.hash = '#/' + qs; else route();
setInterval(() => { if (document.visibilityState === 'visible') { tickStats(); wanderDots(); } }, 2600);
})();
