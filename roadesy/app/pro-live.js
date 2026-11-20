/* Roadesy Pro on the driver app: real providers who subscribed and are on duty near you.
   They show as purple PRO pins above the free listings. Drivers can Get help now (nearest first), Book now, or Get quotes,
   then watch the truck come to them. Nothing here exists until approved providers go on duty; the free directory always works. */
(() => {
const API = "api/pro.php";
const PRO_CATS = ["tow", "roadside", "mobmech", "mobtire", "lock"];
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const X = () => window.RBX;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + (Math.round(n * 100) % 100 ? (+n).toFixed(2) : Math.round(n));
const ls = {get: (k, d) => { try{ const v = localStorage.getItem("rb_" + k); return v ? JSON.parse(v) : d; }catch{ return d; } },
  set: (k, v) => { try{ v == null ? localStorage.removeItem("rb_" + k) : localStorage.setItem("rb_" + k, JSON.stringify(v)); }catch{} }};
async function api(a, body, q = ""){
  const r = await fetch(`${API}?a=${a}${q}`, {method: body ? "POST" : "GET", headers: {"Content-Type": "application/json"}, body: body ? JSON.stringify(body) : undefined, cache: "no-store"});
  let j = {}; try{ j = await r.json(); }catch{}
  if (!r.ok) throw new Error(j.error || "Couldn't reach Roadesy Pro. Try again or call a listing.");
  return j;
}

/* ---------- styles ---------- */
const css = `:root{--pro:#9d7bff;--pro-ink:#140a33;--pro-bg:#211a3a}
.pmk{position:relative;width:38px;height:50px}
.pmk .pn{position:absolute;left:2px;top:2px;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--pro);border:2px solid #fff;box-shadow:0 3px 8px #0009}
.pmk .gl{position:absolute;left:2px;top:2px;width:34px;height:34px;display:grid;place-items:center;color:var(--pro-ink)}
.pmk .gl svg{width:17px;height:17px}
.pmk .bd{position:absolute;top:-6px;right:-8px;background:#fff;color:var(--pro-ink);font:900 8.5px/1 system-ui,sans-serif;padding:2px 4px;border-radius:5px;letter-spacing:.3px;box-shadow:0 1px 4px #0008}
.pmk .pr{position:absolute;top:42px;left:50%;transform:translateX(-50%);background:var(--pro);color:var(--pro-ink);font-size:11px;font-weight:800;padding:1px 6px;border-radius:6px;white-space:nowrap}
.pmk.live::before{content:"";position:absolute;left:-5px;top:-5px;width:48px;height:48px;border-radius:50%;border:3px solid var(--pro);animation:prop 1.8s ease-out infinite}
.pmk.stale{opacity:.45}
.pmk.job .pn{background:#fff;border-color:var(--pro)}
@keyframes prop{from{transform:scale(.6);opacity:.9}to{transform:scale(1.5);opacity:0}}
.pro-sec{margin:2px 0 12px}
.pro-hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:2px 2px 8px;font-size:12px;color:var(--muted)}
.pro-hd b{color:var(--pro);font-size:13px;letter-spacing:.2px}
.item.pro{border-color:#5b47a8;background:linear-gradient(180deg,var(--pro-bg),var(--card) 70%)}
.tag.pro{background:var(--pro);color:var(--pro-ink);font-weight:800}
.tag.live{background:#2a2050;color:#cbbcff}
.pro-price{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 2px;font-size:13px}
.pro-price b{font-size:16px}
.pro-eta{font-weight:800;color:#cbbcff}
.act.pro-book{background:var(--pro);color:var(--pro-ink);font-weight:800}
.act.pro-quote{border:1px solid #5b47a8}
.pro-scrim{position:fixed;inset:0;background:#000a;z-index:1200;display:none}
.pro-scrim.on{display:block}
.pro-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1201;background:var(--card);border-radius:20px 20px 0 0;max-height:88vh;overflow:auto;
  padding:16px 16px calc(18px + env(safe-area-inset-bottom));transform:translateY(105%);transition:transform .22s;max-width:560px;margin:0 auto;box-shadow:0 -8px 30px #000a}
.pro-sheet.on{transform:none}
.pro-sheet h3{margin:0;font-size:19px}
.pro-sheet .sub{color:var(--muted);font-size:13px;margin-top:2px}
.pro-sheet .x{position:absolute;right:12px;top:10px;width:34px;height:34px;border-radius:50%;background:var(--card2);font-size:18px}
.pro-sec2{background:var(--card2);border-radius:14px;padding:12px;margin-top:12px}
.pro-sec2 h5{margin:0 0 8px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
.pro-rates{display:grid;gap:6px}
.pro-rate{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.pro-opt{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:12px;margin-top:6px;cursor:pointer}
.pro-opt input{accent-color:var(--pro);width:18px;height:18px}
.pro-opt .r{margin-left:auto;font-weight:800}
.pro-sheet textarea{width:100%;min-height:62px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:10px;font:inherit;resize:vertical}
.pro-btn{display:block;width:100%;text-align:center;padding:14px;border-radius:14px;font-weight:800;margin-top:12px;background:var(--pro);color:var(--pro-ink)}
.pro-btn.ghost{background:var(--card2);color:var(--text)}
.pro-btn:disabled{opacity:.5}
.pro-row{display:flex;gap:10px}.pro-row .pro-btn{flex:1}
.pro-quote{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #5b47a8;border-radius:14px;margin-top:8px;animation:pop .25s}
.pro-quote .q-p{font-size:20px;font-weight:900}
.pro-quote .q-m{font-size:12.5px;color:var(--muted)}
.pro-quote button{margin-left:auto;background:var(--pro);color:var(--pro-ink);font-weight:800;padding:9px 14px;border-radius:12px}
.pro-wait{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13.5px;margin-top:10px}
.pro-wait i{width:16px;height:16px;border:2px solid var(--pro);border-right-color:transparent;border-radius:50%;animation:s 1s linear infinite}
.pro-track{background:linear-gradient(180deg,var(--pro-bg),var(--card) 80%);border:1px solid #5b47a8;border-radius:18px;padding:12px 14px;margin:2px 0 12px}
.pro-track .t1{display:flex;align-items:center;gap:12px}
.pro-track .big{font-size:30px;font-weight:900;line-height:1;color:#cbbcff}
.pro-track .big small{font-size:13px;font-weight:700;color:var(--muted)}
.pro-track .who{font-size:13px;color:var(--muted);margin-top:4px}
.pro-track .who b{color:var(--text)}
.pro-steps{display:flex;gap:4px;margin:10px 0 6px}
.pro-steps i{flex:1;height:5px;border-radius:3px;background:var(--line)}
.pro-steps i.on{background:var(--pro)}
.pro-stl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.pro-track .acts{margin-top:10px}
.pro-stars{display:flex;gap:6px;justify-content:center;margin:12px 0 4px}
.pro-stars button{font-size:32px;color:var(--line)}
.pro-stars button.on{color:var(--amber)}
.pro-now{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;border-radius:16px;background:var(--pro);color:var(--pro-ink);font-weight:900;font-size:17px;margin:0 0 12px;text-align:left;box-shadow:0 6px 18px #9d7bff33}
.pro-now svg{width:26px;height:26px;flex:none}
.pro-now small{display:block;font-weight:700;font-size:12.5px;opacity:.8;margin-top:1px}
.pro-now .go{margin-left:auto;font-size:22px}
.pro-pin{position:fixed;z-index:960;width:44px;height:60px;transform:translate(-50%,-100%);pointer-events:none;transition:transform .12s}
.pro-pin.lift{transform:translate(-50%,calc(-100% - 10px))}
.pro-pin .h{position:absolute;left:4px;top:0;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--amber);border:3px solid #fff;box-shadow:0 4px 10px #000a}
.pro-pin .h::after{content:"";position:absolute;left:10px;top:10px;width:10px;height:10px;border-radius:50%;background:var(--amber-ink,#1a1300)}
.pro-pin .s{position:absolute;left:17px;bottom:-4px;width:10px;height:5px;border-radius:50%;background:#000a}
.pro-adj{position:fixed;left:12px;right:12px;z-index:961;max-width:520px;margin:0 auto;background:var(--card);border:1px solid #5b47a8;border-radius:18px;padding:12px 14px;box-shadow:0 8px 26px #000b}
.pro-adj b{font-size:15.5px}
.pro-adj .pro-note{margin-top:4px}
.pro-adj .pro-row .pro-btn{margin-top:10px;padding:12px}
.pro-try{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--card2);margin-top:8px;font-size:14px}
.pro-try .st{margin-left:auto;font-weight:800;font-size:13px;white-space:nowrap}
.pro-try.ask{border:1px solid var(--pro)}
.pro-try.ask .st{color:#cbbcff}
.pro-try.no{opacity:.5}
.pro-try.yes{border:1px solid var(--green)}
.pro-try.yes .st{color:var(--green)}
.spot-mk{width:18px;height:18px;border-radius:50%;background:var(--amber);border:3px solid #fff;box-shadow:0 2px 6px #000a}
.pro-note{font-size:12px;color:var(--muted);margin-top:10px;line-height:1.45}
.pro-err{background:#3a1a1c;color:#ffb4b4;border-radius:12px;padding:10px 12px;margin-top:10px;font-size:14px}
.pro-sheet input.pro-in{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:11px;font:inherit;margin-top:8px}
.pro-sheet .pro-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
`;
document.head.insertAdjacentHTML("beforeend", `<style id="proCss">${css}</style>`);
document.body.insertAdjacentHTML("beforeend", `<div class="pro-scrim" id="proScrim"></div><div class="pro-sheet" id="proSheet"></div>`);
let busy = false;
$("#proScrim").onclick = () => { if (!busy) closeSheet(); };

/* ---------- providers near you ---------- */
let pros = [], svcDef = null, forCat = "", forCtr = null, fetchedAt = 0, layer = null, refreshT = null, loading = false;
const avail = () => pros;
const agoTxt = p => { if (!p.updated) return ""; const m = Math.floor((Date.now() / 1000 - p.updated) / 60); return m < 1 ? "updated just now" : `updated ${m} min ago`; };
function mainRate(p, cat){ return p.rates.find(r => r.cat === cat && !r.addon); }
function rateOf(p, cat, svc){ const r = p.rates.find(x => x.cat === cat && x.svc === svc); return r ? r.price : null; }
function priceLine(p, cat){
  const m = mainRate(p, cat); if (!m) return {main: "", label: ""};
  if (cat === "tow"){ const per = rateOf(p, "tow", 1);
    return {main: `${money(m.price)} hookup`, est: per != null ? `+ ${money(per)}/mi after 5 mi` : "", book: m.price, svc: m.svc, label: m.name}; }
  return {main: money(m.price), est: "", book: m.price, svc: m.svc, label: m.name};
}
async function fetchNear(cat, ctr, force){
  if (loading) return;
  if (!force && cat === forCat && forCtr && X().km(forCtr, ctr) < 1 && Date.now() - fetchedAt < 60000) return;
  loading = true;
  try{
    const j = await api("near", null, `&cat=${cat}&lat=${ctr.lat.toFixed(5)}&lon=${ctr.lon.toFixed(5)}`);
    if (X().cat !== cat) return;                     // the driver switched category meanwhile
    pros = j.providers || []; svcDef = j.services || null; forCat = cat; forCtr = ctr; fetchedAt = Date.now();
  }catch{ if (cat !== forCat) pros = []; }
  finally{ loading = false; }
  inject(); plotPros();
}

/* ---------- map pins ---------- */
function pinFor(p, job){
  const ic = (X().CATS.find(c => c.id === forCat) || X().CATS[0]).icon;
  const label = job ? (track && track.eta != null ? `${track.eta} min` : "") : priceLine(p, forCat).main.replace(" hookup", "");
  return L.divIcon({className: "", html: `<div class="pmk ${p.live ? "live" : ""} ${job ? "job" : ""}"><div class="pn"></div><div class="gl">${X().svg(ic)}</div><div class="bd">PRO</div>${label ? `<div class="pr">${esc(label)}</div>` : ""}</div>`,
    iconSize: [38, 50], iconAnchor: [19, 46]});
}
function plotPros(){
  const map = X().map; if (!map || !window.L) return;
  if (!layer) layer = L.layerGroup().addTo(map);
  layer.clearLayers();
  if (track && track.provider && track.provider.lat != null){
    const v = track.provider, s = track.spot;
    L.marker([v.lat, v.lon], {icon: pinFor({live: v.live}, true), zIndexOffset: 900}).addTo(layer);
    L.marker([s.lat, s.lon], {icon: L.divIcon({className: "", html: `<div class="spot-mk"></div>`, iconSize: [18, 18], iconAnchor: [9, 9]}), zIndexOffset: 800}).addTo(layer);
    L.polyline([[v.lat, v.lon], [s.lat, s.lon]], {color: "#9d7bff", weight: 4, dashArray: "6 8", opacity: .9}).addTo(layer);
    return;
  }
  if (track) return;
  if (!PRO_CATS.includes(X().cat)) return;
  pros.forEach(p => { if (p.lat == null) return; L.marker([p.lat, p.lon], {icon: pinFor(p), zIndexOffset: 800}).addTo(layer).on("click", () => openPro(p)); });
}

/* ---------- list section (only when providers are on duty near you) ---------- */
function section(){
  if (!pros.length || !PRO_CATS.includes(X().cat) || X().cat !== forCat) return "";
  const near = pros[0];
  return `<div class="pro-sec"><div class="pro-hd"><b>Roadesy Pro</b><span>Paid providers · prices up front · sorted by arrival</span></div>
  <button class="pro-now" data-pronow>${X().svg(X().I.bolt || X().I.phone)}<span>Get help now<small>Nearest available Pro · about ${near.eta} min away</small></span><span class="go">›</span></button>
  <div class="list">${pros.map(p => { const pl = priceLine(p, forCat);
    return `<div class="item pro">
      <div class="row"><div><h4 data-pro="${esc(p.id)}">${esc(p.biz)}</h4>
        <div class="meta">${p.rating ? "★ " + p.rating + " · " : ""}${p.jobs} jobs${p.vehicle ? " · " + esc(p.vehicle) : ""}</div></div>
        <div class="dist"><span class="pro-eta">${p.eta} min</span><br>${X().mi(p.km)}</div></div>
      <span class="tag pro">PRO</span>${p.live ? `<span class="tag live">● Live · ${agoTxt(p)}</span>` : `<span class="tag">Shop location</span>`}
      <div class="pro-price"><span><b>${esc(pl.main)}</b> ${forCat === "tow" ? "" : esc((pl.label || "").toLowerCase())}</span>${pl.est ? `<span style="color:var(--muted)">${esc(pl.est)}</span>` : ""}</div>
      <div class="acts"><button class="act pro-book" data-probook="${esc(p.id)}">Book now · ${money(pl.book)}</button><button class="act pro-quote" data-proquote="${esc(p.id)}">Get quote</button></div>
    </div>`; }).join("")}</div>
  <div class="pro-hd" style="margin-top:10px"><span>Other listings near you</span></div></div>`;
}
function inject(){
  const r = $("#results"); if (!r) return;
  const old = r.querySelector(".pro-sec"); if (old) old.remove();
  if (track) return;
  const h = section(); if (h) r.insertAdjacentHTML("afterbegin", h);
}
const byId = id => pros.find(p => p.id === id);
$("#results").addEventListener("click", e => {
  const n = e.target.closest("[data-pronow]"); if (n){ e.stopPropagation(); adjustSpot(spot => requestSheet("now", null, spot)); return; }
  const b = e.target.closest("[data-probook]"); if (b){ e.stopPropagation(); const p = byId(b.dataset.probook); adjustSpot(spot => requestSheet("book", p, spot)); return; }
  const q = e.target.closest("[data-proquote]"); if (q){ e.stopPropagation(); adjustSpot(spot => requestSheet("quote", null, spot)); return; }
  const h = e.target.closest("[data-pro]"); if (h){ e.stopPropagation(); openPro(byId(h.dataset.pro)); }
}, true);
new MutationObserver(() => {
  if (track){ if (!$("#results .pro-track")) renderTrack(); }
  else if (pros.length && !$("#results .pro-sec")) inject();
}).observe($("#results"), {childList: true});

/* hook the app calls after every redraw */
window.RBPRO = {
  draw(c, ctr){
    if (track){ plotPros(); return; }
    if (!PRO_CATS.includes(c.id)){ pros = []; forCat = c.id; if (layer) layer.clearLayers(); return; }
    if (c.id !== forCat){ pros = []; inject(); plotPros(); }
    fetchNear(c.id, ctr);
    clearInterval(refreshT); refreshT = setInterval(() => { if (!track && document.visibilityState === "visible" && PRO_CATS.includes(X().cat) && forCtr) fetchNear(X().cat, forCtr, true); }, 60000);
  }
};

/* ---------- sheets ---------- */
function openSheet(html){ const s = $("#proSheet"); s.onclick = null; s.innerHTML = `<button class="x" data-x aria-label="Close">✕</button>` + html; $("#proScrim").classList.add("on"); s.classList.add("on");
  s.querySelector("[data-x]").onclick = () => { if (!busy) closeSheet(); }; }
function closeSheet(){ $("#proSheet").classList.remove("on"); $("#proScrim").classList.remove("on"); }
function openPro(p){
  if (!p) return;
  const pl = priceLine(p, forCat), rates = p.rates.filter(r => r.cat === forCat);
  openSheet(`<h3>${esc(p.biz)}</h3><div class="sub">${p.rating ? "★ " + p.rating + " · " : ""}${p.jobs} jobs · <span class="tag pro" style="margin:0">PRO</span></div>
    <div class="pro-sec2"><div class="pro-rate"><span>Arrives in about</span><b class="pro-eta">${p.eta} min</b></div>
      <div class="pro-rate"><span>Distance by road</span><b>${X().mi(p.km)}</b></div>
      ${p.vehicle ? `<div class="pro-rate"><span>Vehicle</span><b>${esc(p.vehicle)}</b></div>` : ""}
      ${p.hours ? `<div class="pro-rate"><span>Hours</span><b>${esc(p.hours)}</b></div>` : ""}
      <div class="pro-rate"><span>Location</span><b>${p.live ? "Live · " + agoTxt(p) : "Shop location"}</b></div></div>
    <div class="pro-sec2"><h5>Prices</h5><div class="pro-rates">${rates.map(r => `<div class="pro-rate"><span>${esc(r.name)}</span><b>${money(r.price)}</b></div>`).join("")}</div>
      ${forCat === "tow" ? `<div class="pro-note">The total depends on how far you're towed.</div>` : ""}</div>
    <div class="pro-row"><button class="pro-btn ghost" data-q>Get quotes</button><button class="pro-btn" data-b>Book now · ${money(pl.book)}</button></div>`);
  $("#proSheet [data-b]").onclick = () => { closeSheet(); adjustSpot(spot => requestSheet("book", p, spot)); };
  $("#proSheet [data-q]").onclick = () => { closeSheet(); adjustSpot(spot => requestSheet("quote", null, spot)); };
}

/* ---------- confirm your exact spot (drag the map under a pin) ---------- */
function visibleMap(){
  const m = X().map.getContainer().getBoundingClientRect(), cats = $("#cats");
  const top = Math.max(m.top, cats ? cats.getBoundingClientRect().bottom : 0) + 8, sh = $("#msheet");
  return {m, x: X().sideList() && sh ? (sh.getBoundingClientRect().right + m.right) / 2 : (m.left + m.right) / 2, top, bottom: m.bottom};
}
function adjustSpot(then){
  const map = X().map, start = X().pos || forCtr;
  if (!map || !start || !window.L){ if (start) then({lat: start.lat, lon: start.lon}); return; }
  if (!X().sideList()) document.documentElement.style.setProperty("--sheetVis", "0px");
  setTimeout(() => {
    const nav = $("nav.tabs"), navH = nav ? nav.getBoundingClientRect().height : 0;
    const bar = document.createElement("div"); bar.className = "pro-adj"; bar.style.bottom = (navH + 12) + "px";
    bar.innerHTML = `<b>Is the pin on your exact spot?</b><div class="pro-note" id="adjTxt">Drag the map to move it — shoulder, lane side or parking spot.</div>
      <div class="pro-row"><button class="pro-btn ghost" data-ac>Cancel</button><button class="pro-btn" data-ok>Confirm spot</button></div>`;
    document.body.appendChild(bar);
    const v = visibleMap(); v.bottom = Math.min(v.bottom, bar.getBoundingClientRect().top - 8);
    const y = v.top + (v.bottom - v.top) * .55;
    const pin = document.createElement("div"); pin.className = "pro-pin"; pin.innerHTML = `<div class="h"></div><div class="s"></div>`;
    pin.style.left = v.x + "px"; pin.style.top = y + "px"; document.body.appendChild(pin);
    const cp = [v.x - v.m.left, y - v.m.top], size = map.getSize();
    try{ map.setView([start.lat, start.lon], 18, {animate: false}); map.panBy([size.x / 2 - cp[0], size.y / 2 - cp[1]], {animate: false}); }catch{}
    const at = () => { try{ const ll = map.containerPointToLatLng(cp); return {lat: ll.lat, lon: ll.lng}; }catch{ return {lat: start.lat, lon: start.lon}; } };
    const onMove = () => pin.classList.add("lift");
    const onEnd = () => { pin.classList.remove("lift"); const ft = Math.round(X().km(start, at()) * 3281);
      $("#adjTxt").textContent = ft < 30 ? "Right at your GPS location. Drag the map if you're somewhere else." : `${ft < 1000 ? ft + " ft" : (ft / 5280).toFixed(1) + " mi"} from your GPS location. The provider comes to the pin.`; };
    map.on("movestart", onMove); map.on("moveend", onEnd);
    const done = () => { map.off("movestart", onMove); map.off("moveend", onEnd); pin.remove(); bar.remove(); try{ if (!X().sideList()) X().setSheet("half"); }catch{} };
    bar.querySelector("[data-ac]").onclick = () => { done(); try{ X().viewAt(start.lat, start.lon, 14); }catch{} };
    bar.querySelector("[data-ok]").onclick = () => { const s = at(); done(); then({lat: +s.lat.toFixed(6), lon: +s.lon.toFixed(6)}); };
  }, 260);
}

/* ---------- the request ---------- */
function carLine(){ const c = X().car(); const t = [c.carColor, c.carModel].filter(Boolean).join(" "); return t ? t + (c.carPlate ? " · " + c.carPlate : "") : ""; }
function requestSheet(mode, p, spot){
  const cat = forCat, svcs = (svcDef && svcDef.svcs) || [];
  const opts = svcs.map((s, i) => [s, i]).filter(([s]) => s[2] !== "addon").map(([s, i]) => {
    const vals = (mode === "book" ? [p] : pros).map(x => rateOf(x, cat, i)).filter(v => v != null);
    if (!vals.length) return "";
    const lo = Math.min(...vals), hi = Math.max(...vals), from = /, from$/.test(s[0]), name = s[0].replace(/, from$/, "");
    const pr = from ? "from " + money(lo) : lo === hi ? money(lo) : money(lo) + "–" + money(hi);
    return `<label class="pro-opt"><input type="radio" name="psvc" value="${i}"><span>${esc(name)}</span><span class="r">${mode === "quote" ? "" : pr}</span></label>`; }).join("");
  const car = carLine(), me = ls.get("proMe", {});
  openSheet(`<h3>${mode === "now" ? "Get help now" : mode === "book" ? "Book " + esc(p.biz) : "Get quotes"}</h3>
    <div class="sub">${mode === "now" ? "Goes to the nearest available Pro first. The price is locked when they accept." : mode === "book" ? `About ${p.eta} min away · the price is locked when they accept` : "Nearby Pro providers send you a price and arrival time. You pick one."}</div>
    <div class="pro-sec2"><h5>What do you need?</h5>${opts || `<div class="pro-note">No Pro provider near you offers this right now.</div>`}</div>
    <div class="pro-sec2"><h5>Your vehicle</h5><div style="font-size:14px">${car ? esc(car) : `<span style="color:var(--muted)">Add your car in My Car so the driver knows what to look for.</span>`}</div>
      <textarea id="proNote" placeholder="Anything they should know? e.g. hazards on, right shoulder past exit 12" style="margin-top:8px" maxlength="280"></textarea></div>
    <div class="pro-sec2"><h5>How they reach you</h5><div class="pro-two"><input class="pro-in" id="proName" placeholder="Your first name" maxlength="40" value="${esc(me.name || "")}" autocomplete="given-name">
      <input class="pro-in" id="proPhone" type="tel" placeholder="Your phone *" maxlength="30" value="${esc(me.phone || "")}" autocomplete="tel"></div>
      <div class="pro-note">Only the provider who takes your job gets your number and exact spot.</div></div>
    <button class="pro-btn" data-send ${opts ? "" : "disabled"}>${mode === "now" ? "Request nearest Pro" : mode === "book" ? "Send booking" : "Ask for quotes"}</button>
    <div class="pro-err" id="proErr" hidden></div>`);
  const first = $("#proSheet input[name=psvc]"); if (first) first.checked = true;
  $("#proSheet [data-send]").onclick = async e => {
    const svc = +(($("#proSheet input[name=psvc]:checked") || {}).value ?? -1), phone = $("#proPhone").value.trim(), name = $("#proName").value.trim();
    const errEl = $("#proErr"); errEl.hidden = true;
    if (svc < 0) return;
    if (phone.replace(/\D/g, "").length < 10){ errEl.textContent = "Add your phone number so the provider can reach you."; errEl.hidden = false; return; }
    ls.set("proMe", {name, phone});
    const b = e.currentTarget; b.disabled = true; b.textContent = "Sending…";
    try{
      const j = await api("request", {mode, cat, svc, spot, phone, name, vehicle: car, note: $("#proNote").value.trim(), pid: p ? p.id : undefined});
      ls.set("proReq", {rid: j.rid, s: j.s, at: Date.now(), cat, mode});
      startTracking(j.rid, j.s, cat);
    }catch(x){ errEl.textContent = x.message; errEl.hidden = false; b.disabled = false; b.textContent = "Try again"; }
  };
}

/* ---------- after sending: searching → quotes → truck on the way → rate ---------- */
let track = null, trackT = null, lastState = "", cancelArm = 0;
function startTracking(rid, s, cat){
  track = {rid, s, cat, state: "open"}; lastState = "";
  const r = $("#results .pro-sec"); if (r) r.remove();
  status(); clearInterval(trackT); trackT = setInterval(status, 4000);
}
async function status(){
  if (!track) return;
  try{
    const j = await api("status", null, `&rid=${track.rid}&s=${track.s}`);
    Object.assign(track, j);
    const changed = j.state !== lastState; lastState = j.state;
    if (j.state === "open") showSearching(changed);
    else if (["assigned", "onway", "arrived"].includes(j.state)){
      if (changed){ closeSheet(); if (j.state === "assigned") X().toast(`${j.provider.biz} accepted`); if (j.state === "onway") X().toast(`${j.provider.biz} is on the way`);
        if (j.state === "arrived"){ X().toast(`${j.provider.contact || j.provider.biz} has arrived`); try{ navigator.vibrate && navigator.vibrate([200, 100, 200]); }catch{} }
        try{ if (!X().sideList()) X().setSheet("half"); }catch{} }
      renderTrack(); plotPros(); fitJob(changed);
    }
    else if (j.state === "done"){ renderTrack(); plotPros(); if (changed) rate(); clearInterval(trackT); trackT = null; }
    else ended(j.state);
  }catch(x){
    if (/not found/i.test(x.message)){ ended("gone"); }
  }
}
function showSearching(first){
  const t = track, ex = t.expires != null ? `<span class="pro-note">${t.expires}s</span>` : "";
  busy = false;
  if (t.mode === "now"){
    const a = t.asking;
    if (!first && $("#proSheet .pro-try.ask")){ const st = $("#proSheet .pro-try.ask .st"); st.textContent = `Asking · ${t.expires}s`; $("#tryWho").innerHTML = a ? `<b>${esc(a.biz)}</b><br><span style="color:var(--muted);font-size:12.5px">${a.eta} min away${a.price != null ? " · " + money(a.price) : ""}</span>` : ""; return; }
    openSheet(`<h3>Finding your Pro</h3><div class="sub">${esc(t.svcName)} · nearest first, 30 sec each to accept</div>
      ${t.tried ? `<div class="pro-try no"><span>${t.tried} nearer provider${t.tried > 1 ? "s" : ""} couldn't take it</span><span class="st">Busy</span></div>` : ""}
      <div class="pro-try ask"><span id="tryWho">${a ? `<b>${esc(a.biz)}</b><br><span style="color:var(--muted);font-size:12.5px">${a.eta} min away${a.price != null ? " · " + money(a.price) : ""}</span>` : ""}</span><span class="st">Asking · ${t.expires}s</span></div>
      <div class="pro-wait"><i></i>Waiting for them to accept…</div><button class="pro-btn ghost" data-stop>Cancel request</button>`);
  } else if (t.mode === "book"){
    if (!first && $("#bookLeft")){ $("#bookLeft").textContent = Math.ceil(t.expires / 60) + " min"; return; }
    openSheet(`<h3>Waiting for them to accept</h3><div class="sub">${esc(t.svcName)}</div>
      <div class="pro-wait"><i></i>They have <b id="bookLeft">${Math.ceil(t.expires / 60)} min</b> to accept. You'll see their truck once they do.</div><button class="pro-btn ghost" data-stop>Cancel request</button>`);
  } else {
    const qs = t.quotes || [];
    const html = qs.map(q => `<div class="pro-quote"><div><div class="q-p">${money(q.price)}</div><div class="q-m"><b style="color:var(--text)">${esc(q.biz)}</b><br>${q.eta} min away${q.rating ? " · ★ " + q.rating : ""}</div></div><button data-acc="${esc(q.id)}">Accept</button></div>`).join("");
    if (!first && $("#proQuotes")){ if ($("#proQuotes").dataset.n !== String(qs.length)){ $("#proQuotes").innerHTML = html; $("#proQuotes").dataset.n = qs.length; }
      $("#proQW").innerHTML = qs.length ? `${qs.length} quote${qs.length > 1 ? "s" : ""} · open for ${Math.ceil(t.expires / 60)} more min` : `<i></i>Waiting for providers… open for ${Math.ceil(t.expires / 60)} more min`; return; }
    openSheet(`<h3>Quotes</h3><div class="sub">${esc(t.svcName)} · pick the price and arrival time that work for you</div>
      <div id="proQuotes" data-n="${qs.length}">${html}</div><div class="pro-wait" id="proQW"><i></i>Waiting for providers…</div><button class="pro-btn ghost" data-stop>Cancel request</button>`);
    $("#proSheet").onclick = async e => { const a = e.target.closest("[data-acc]"); if (!a) return; a.disabled = true;
      try{ await api("choose", {rid: track.rid, s: track.s, pid: a.dataset.acc}); status(); }catch(x){ X().toast(x.message); a.disabled = false; } };
  }
  const stop = $("#proSheet [data-stop]"); if (stop) stop.onclick = cancelReq;
}
async function cancelReq(){
  try{ await api("cancel", {rid: track.rid, s: track.s}); }catch{}
  ended("cancelled");
}
function ended(state){
  const msg = {nobody: "No Pro could take it right now. Try again in a few minutes, or call a listing below.", expired: "Nobody answered in time. Try again, or call a listing below.",
    declined: "They couldn't take it. Pick another provider or try Get help now.", dropped: "Your provider can't make it. Sorry about that. Try Get help now again.",
    cancelled: "Request cancelled.", gone: "That request has ended."}[state] || "That request has ended.";
  clearInterval(trackT); trackT = null; track = null; lastState = ""; ls.set("proReq", null);
  const t = $("#results .pro-track"); if (t) t.remove();
  if (["nobody", "expired", "declined", "dropped"].includes(state)) openSheet(`<h3>Sorry</h3><div class="sub" style="margin-top:6px">${esc(msg)}</div><button class="pro-btn" data-x2>OK</button>`), $("#proSheet [data-x2]").onclick = closeSheet;
  else { closeSheet(); X().toast(msg); }
  if (forCtr) fetchNear(X().cat, forCtr, true); else { inject(); plotPros(); }
}
const STEPS = [["assigned", "Accepted"], ["onway", "On the way"], ["arrived", "Arrived"], ["done", "Done"]];
function renderTrack(){
  const old = $("#results .pro-track"); if (old) old.remove();
  if (!track || !track.provider) return;
  const t = track, v = t.provider, idx = STEPS.findIndex(s => s[0] === t.state);
  const head = t.state === "assigned" ? `<div class="big">${t.eta ?? "–"}<small> min · getting ready</small></div>`
    : t.state === "onway" ? `<div class="big">${t.eta ?? "–"}<small> min away${t.km != null ? " · " + X().mi(t.km) : ""}</small></div>`
    : t.state === "arrived" ? `<div class="big">Here<small>${v.vehicle ? " · look for the " + esc(v.vehicle) : ""}</small></div>`
    : `<div class="big">Done<small> · ${money(t.price)}</small></div>`;
  const tel = String(v.phone || "").replace(/[^\d+]/g, "");
  const ago = v.updated ? Math.floor((Date.now() / 1000 - v.updated) / 60) : null;
  $("#results").insertAdjacentHTML("afterbegin", `<div class="pro-track" id="proTrack"><div class="t1"><div style="flex:1">${head}
      <div class="who"><b>${esc(v.contact || v.biz)}</b>${v.contact ? " · " + esc(v.biz) : ""}${v.rating ? " · ★ " + v.rating : ""}<br>${v.vehicle ? `<b>${esc(v.vehicle)}</b>` : ""}${v.plate ? " · " + esc(v.plate) : ""}</div></div></div>
    <div class="pro-steps">${STEPS.map((s, i) => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</div>
    <div class="pro-stl">${STEPS.map(s => `<span>${s[1]}</span>`).join("")}</div>
    <div class="pro-note" style="margin-top:6px">${esc(t.svcName)} · <b style="color:var(--text)">${money(t.price)}</b> agreed · pay the provider directly${v.live && ago != null ? ` · truck ${ago < 1 ? "updated just now" : "updated " + ago + " min ago"}` : ""}</div>
    <div class="acts">${t.state !== "done" ? `<a class="act call" href="tel:${esc(tel)}">${X().svg(X().I.phone)}Call ${esc(v.contact || "provider")}</a>` : ""}
      ${["assigned", "onway"].includes(t.state) ? `<button class="act" data-tcancel>Cancel</button>` : ""}${t.state === "done" ? `<button class="act pro-book" data-trate>Rate & close</button>` : ""}</div></div>`);
  const c = $("#proTrack [data-tcancel]"); if (c) c.onclick = () => { if (Date.now() - cancelArm > 3000){ cancelArm = Date.now(); X().toast("Tap Cancel again to cancel"); return; } cancelReq(); };
  const r = $("#proTrack [data-trate]"); if (r) r.onclick = rate;
}
function fitJob(force){
  const map = X().map; if (!map || !track || !track.provider || track.provider.lat == null) return;
  const a = track.provider, b = track.spot;
  if (!force && fitJob.at && Date.now() - fitJob.at < 20000) return; fitJob.at = Date.now();
  try{ map.fitBounds([[Math.min(a.lat, b.lat), Math.min(a.lon, b.lon)], [Math.max(a.lat, b.lat), Math.max(a.lon, b.lon)]],
    {paddingTopLeft: [40, 120], paddingBottomRight: [40, (X().sideList() ? 40 : X().sheetPx()) + 40], maxZoom: 16}); }catch{}
}
function rate(){
  if (!track) return;
  const v = track.provider || {};
  openSheet(`<h3>How was ${esc(v.contact || v.biz || "your provider")}?</h3><div class="sub">${esc(v.biz || "")} · ${esc(track.svcName)} · ${money(track.price)}</div>
    <div class="pro-stars">${[1, 2, 3, 4, 5].map(n => `<button data-s="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div>
    <button class="pro-btn" data-fin disabled>Submit</button><button class="pro-btn ghost" data-skip>Skip</button>
    <div class="pro-note">Ratings show on their Pro listing and help other drivers.</div>`);
  let stars = 0;
  $("#proSheet .pro-stars").onclick = e => { const s = e.target.closest("[data-s]"); if (!s) return; stars = +s.dataset.s;
    $$("#proSheet .pro-stars button").forEach(b => b.classList.toggle("on", +b.dataset.s <= stars)); $("#proSheet [data-fin]").disabled = false; };
  $("#proSheet [data-fin]").onclick = async () => { try{ await api("rate", {rid: track.rid, s: track.s, stars}); }catch{} closeSheet(); ended2("Thanks for rating"); };
  $("#proSheet [data-skip]").onclick = () => { closeSheet(); ended2("Glad you're back on the road"); };
}
function ended2(msg){ clearInterval(trackT); trackT = null; track = null; lastState = ""; ls.set("proReq", null); const t = $("#results .pro-track"); if (t) t.remove(); X().toast(msg); if (forCtr) fetchNear(X().cat, forCtr, true); }

/* pick up where the driver left off (app closed while help was on the way) */
const saved = ls.get("proReq", null);
if (saved && Date.now() - saved.at < 6 * 3600e3) setTimeout(() => { if (window.RBX && X().map) startTracking(saved.rid, saved.s, saved.cat); else setTimeout(() => startTracking(saved.rid, saved.s, saved.cat), 2500); }, 1500);
})();
