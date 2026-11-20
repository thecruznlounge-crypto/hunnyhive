/* Roadesy – app logic (vanilla JS, no build step) */
(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const RB_VERSION = "23";
const CFG = Object.assign({NREL_KEY:"DEMO_KEY", TILE_URL:"https://tile.openstreetmap.org/{z}/{x}/{y}.png", TILE_ATTR:"&copy; OpenStreetMap",
  TILE_MAX_OFFLINE_ZOOM:14, TILE_MAX_OFFLINE:1500, USE_PROXY:true}, window.RB_CONFIG || {});
// Mirrors first: since Apr 2026 the main server (overpass-api.de) refuses many requests from phone browsers
const OVERPASS = ["https://overpass.kumi.systems/api/interpreter","https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const OSRM = "https://router.project-osrm.org/";
function fetchT(url, ms, opt = {}){
  const ac = new AbortController(), t = setTimeout(()=>ac.abort(), ms);
  return fetch(url, {...opt, signal:ac.signal}).finally(()=>clearTimeout(t));
}

/* Free Overpass servers allow ~2 requests at a time per phone: run at most 2, try the last server that
   answered first, and rest any server that says it's busy so the next request goes straight to a backup. */
const opRest = {}; let opBest = 0; try{ opBest = Math.max(0, OVERPASS.indexOf(localStorage.getItem("rb_opBestUrl"))); }catch{}
let opActive = 0; const opWait = [];
const opSlot = () => new Promise(r => { if (opActive < 2){ opActive++; r(); } else opWait.push(r); });
const opDone = () => { const n = opWait.shift(); if (n) n(); else opActive--; };
async function tryServer(i, q, ms){
  const r = await fetchT(OVERPASS[i], ms, {method:"POST", body:"data=" + encodeURIComponent(q)});
  if (r.status === 429 || r.status >= 500){ opRest[i] = Date.now() + 30000; throw 0; }
  if (!r.ok) throw 0;
  const j = await r.json();
  if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)){ opRest[i] = Date.now() + 15000; throw 0; }
  if (opBest !== i){ opBest = i; try{ localStorage.setItem("rb_opBestUrl", OVERPASS[i]); }catch{} }
  return j;
}
async function overpass(q, ms = 10000){
  await opSlot();
  try{
    const order = OVERPASS.map((_, i) => i).sort((a, b) => (a === opBest ? -1 : b === opBest ? 1 : a - b));
    const ready = order.filter(i => (opRest[i] || 0) <= Date.now()), list = ready.length ? ready : order;
    // ask the best server; if it hasn't answered in 6 s, ask the next one too and take whichever answers first
    return await new Promise((resolve, reject) => {
      let idx = 0, pending = 0, done = false, timer = null;
      const launch = () => {
        if (done || idx >= list.length) return;
        const i = list[idx++]; pending++;
        clearTimeout(timer); timer = setTimeout(launch, 4000);
        tryServer(i, q, ms).then(j => { if (!done){ done = true; clearTimeout(timer); resolve(j); } })
          .catch(() => { opRest[i] = Math.max(opRest[i] || 0, Date.now() + 20000); pending--; if (done) return;
            if (idx < list.length) launch(); else if (!pending){ clearTimeout(timer); reject(new Error("listings servers busy")); } });
      };
      launch();
    });
  } finally { opDone(); }
}

/* api/*.php on your own hosting caches listings for everyone; used automatically when present */
let proxyP = null, pingInfo = {};
function proxyOn(){
  if (!proxyP) proxyP = (async () => {
    if (!CFG.USE_PROXY || !/^https?:$/.test(location.protocol)) return false;
    try{ const j = await (await fetchT("api/ping.php", 3500, {cache:"no-store"})).json(); pingInfo = j || {}; return !!(j && j.ok); }catch{ return false; }
  })();
  return proxyP;
}
async function runPool(list, fn, n){
  let i = 0;
  await Promise.all(Array.from({length: Math.min(n, list.length)}, async () => { while (i < list.length) await fn(list[i++]); }));
}
const NOMINATIM = "https://nominatim.openstreetmap.org";
const store = {
  get:(k,d)=>{try{const v=localStorage.getItem("rb_"+k);return v?JSON.parse(v):d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem("rb_"+k,JSON.stringify(v))}catch{}}
};
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const telNum = p => String(p||"").split(/[;,]/)[0].replace(/[^\d+]/g,"");

/* ---------- icons ---------- */
const I = {
  road:'<path d="M5 21 9 3M19 21 15 3M12 5v2M12 11v2M12 17v2"/>',
  tow:'<path d="M2 17h3m14 0h3M5 17V9h7l3 4h4v4"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/><path d="M12 9 18 3l2 2"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  tire:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>',
  shop:'<path d="M3 21V9l9-6 9 6v12"/><path d="M8 21v-6h8v6"/>',
  fuel:'<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 9h6"/><path d="m14 8 3 3v6a2 2 0 0 0 4 0V9l-3-3"/>',
  phone:'<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor" stroke="none"/>',
  nav:'<path d="M3 11 21 3l-8 18-2-8z"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>'
};
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

/* ---------- categories ---------- */
const A = "(around:{R},{LAT},{LON})";
const CATS = [
  {id:"roadside", name:"Roadside Service", icon:I.road, g:"roadside assistance",
   q:[`nwr["name"~"roadside|road service|lockout|jump ?start|motor club|mobile ev|ev (roadside|charging service)",i]${A};`, `nwr["service:vehicle:breakdown"="yes"]${A};`]},
  {id:"tow", name:"Towing", icon:I.tow, g:"towing service",
   q:[`nwr["name"~"towing|tow truck|wrecker|recovery",i]${A};`, `nwr["service:vehicle:towing"="yes"]${A};`]},
  {id:"mobmech", name:"Mobile Mechanic", icon:I.wrench, g:"mobile mechanic",
   q:[`nwr["name"~"mobile (auto|mechanic|repair|car|diesel)|mechanic on|on.?site auto",i]${A};`]},
  {id:"mobtire", name:"Mobile Tire", icon:I.tire, g:"mobile tire service",
   q:[`nwr["shop"="tyres"]${A};`, `nwr["name"~"mobile tire|tire (service|repair)",i]${A};`]},
  {id:"lock", name:"Locksmith", icon:I.key, g:"mobile locksmith",
   q:[`nwr["craft"="locksmith"]${A};`, `nwr["shop"="locksmith"]${A};`, `nwr["name"~"locksmith|lockout|car keys?|auto keys?|key (fob|programming)",i]${A};`]},
  {id:"shop", name:"Mechanic Shops", icon:I.shop, g:"auto repair shop",
   q:[`nwr["shop"="car_repair"]${A};`]},
  {id:"plaza", name:"Service Plazas", icon:I.fuel, g:"highway service plaza",
   q:()=>[`nwr["highway"="services"]${A};`,`nwr["highway"="rest_area"]${A};`]
     .concat(power()!=="ev" ? [`nwr["amenity"="fuel"]${A};`] : [])
     .concat(power()==="ev"||power()==="phev" ? [`nwr["amenity"="charging_station"]${A};`] : [])}
];

/* ---------- state ---------- */
let pos = store.get("pos", null);     // last GPS fix {lat,lon,acc}
let cat = store.get("cat", "tow");
let radiusMi = store.get("rMi", null) ?? ({8:5, 24:15, 48:30}[store.get("r", 24)] || 10);
let radiusKm = radiusMi * 1.609;
let stateCode = store.get("state", null);
const urlP = new URLSearchParams(location.search);
if (CATS.some(c => c.id === urlP.get("cat"))) cat = urlP.get("cat");

/* ---------- patrol card ---------- */
const sel = $("#stateSel");
sel.innerHTML = Object.entries(STATES).sort((a,b)=>a[1].n.localeCompare(b[1].n)).map(([k])=>`<option value="${k}">${k}</option>`).join("");
sel.insertAdjacentHTML("afterbegin", `<option value="" disabled>State</option>`); sel.value = "";
sel.onchange = () => { stateCode = sel.value; store.set("state", stateCode); store.set("stateManual", true); renderPatrol(); };
const telHref = code => "tel:" + code.replace(/#/g,"%23");
function renderPatrol(){
  const s = STATES[stateCode] || null;
  if (stateCode) sel.value = stateCode;
  if (!s){ $("#pAgency").textContent="State Highway Patrol"; $("#pProg").textContent="Set your state for the direct line"; return; }
  $("#pAgency").textContent = s.a;
  $("#pProg").textContent = s.prog || (s.code ? "Direct cell line to the nearest post" : "Call 911 — it routes to state troopers");
  $("#pCall").href = telHref(s.code || "911");
  $("#pCode").textContent = s.code ? `Call ${s.label ? s.label+" ("+s.code+")" : s.code}` : "Call 911";
  $("#pNote").textContent = s.note || (s.code ? "Star codes work from cell phones only." : "");
}

/* ---------- location ---------- */
function setLoc(text, ok){ $("#locText").textContent=text; $("#locChip").classList.toggle("ok", !!ok); }
function gotFix(p, quick){
  const was = pos;
  pos = {lat:p.coords.latitude, lon:p.coords.longitude, acc:Math.round(p.coords.accuracy)};
  store.set("pos", pos); store.set("posAt", Date.now());
  setLoc("Near you", true);
  $("#gpsLine").textContent = `GPS ready (±${pos.acc} m). Sends your pin, roadside details and vehicle to a friend or tow driver.`;
  showMe(pos);
  const moved = !was || km(was, pos) > 0.4;
  if (map && !nav && (moved || !quick)) viewAt(pos.lat, pos.lon, Math.max(map.getZoom(), 13));
  if (quick || moved || !shown.length){ $("#area").value = ""; store.set("area", ""); load(); }
  if (moved){ reverse(); setTimeout(nearestExit, 1500); }
}
function locate(){
  if (!navigator.geolocation){ setLoc("No GPS", false); load(); return; }
  if (pos && map && !nav) viewAt(pos.lat, pos.lon, Math.max(map.getZoom(), 13));
  setLoc("Locating…", false);
  const precise = () => navigator.geolocation.getCurrentPosition(p => gotFix(p, false), () => {
    if (!pos){ setLoc("Location off", false); noLocation(); } else if ($("#locText").textContent === "Locating…") setLoc("Last known spot", false);
  }, {enableHighAccuracy:true, timeout:20000, maximumAge:0});
  // 1) quick Wi-Fi/cell fix (seconds, works indoors and on tablets) → 2) precise GPS refines it
  navigator.geolocation.getCurrentPosition(p => { gotFix(p, true); precise(); }, precise, {enableHighAccuracy:false, timeout:8000, maximumAge:600000});
}
function noLocation(){
  if ($("#area").value.trim()){ load(); return; }
  $("#results").innerHTML = `<div class="empty"><b>Roadesy needs your location or a city/ZIP to show help on the map.</b><br>
    Allow location for this site in your browser settings, or type a city or ZIP above and press Enter.<br>The patrol button above works without it.</div>
    <button class="more" data-retry-loc>Try location again</button><button class="more" data-check>Run a connection check</button>`;
  mapNote("");
}
$("#locChip").onclick = locate;

async function reverse(){
  try{
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=10&lat=${pos.lat}&lon=${pos.lon}`,{headers:{"Accept-Language":"en"}});
    const a = (await r.json()).address || {};
    const iso = (a["ISO3166-2-lvl4"]||"").replace("US-","");
    const place = a.city || a.town || a.village || a.county || "";
    if (place) setLoc(`${place}${iso?", "+iso:""}`, true);
    if (iso && STATES[iso] && !store.get("stateManual", false)){ stateCode = iso; store.set("state", iso); renderPatrol(); }
  }catch{}
}

/* nearest interstate + exit → "tell dispatch" line and roadside details */
async function nearestExit(){
  const q = `[out:json][timeout:15];(node["highway"="motorway_junction"](around:6000,${pos.lat},${pos.lon});way["highway"~"^(motorway|trunk)$"](around:150,${pos.lat},${pos.lon}););out center tags;`;
  try{
    const j = await overpass(q, 8000);
    const exit = j.elements.filter(e=>e.type==="node").map(e=>({...e,d:km(pos,{lat:e.lat,lon:e.lon})})).sort((a,b)=>a.d-b.d)[0];
    const hw = j.elements.find(e=>e.type==="way");
    const road = hw ? ((hw.tags.ref||"").split(";")[0].replace(/^I /,"I-").replace(/^US /,"US-") || hw.tags.name || "") : "";
    const exitTxt = exit ? `${exit.tags.ref?"Exit "+exit.tags.ref:"Exit"}${exit.tags.name?" – "+exit.tags.name:""}` : "";
    const parts = [];
    if (road){ parts.push(`You appear to be on <b>${esc(road)}</b>.`); if (!$("#sosRoad").value) $("#sosRoad").value = road; }
    if (exit){ parts.push(`Nearest exit: <b>${esc(exitTxt)}</b> (${mi(exit.d)}).`); if (!$("#sosMile").value) $("#sosMile").value = `Near ${exitTxt}`; }
    if (parts.length) $("#tell").innerHTML = parts.join(" ") + " Also give your direction of travel and vehicle color/make.";
  }catch{}
}

/* ---------- categories / filters UI ---------- */
$("#cats").innerHTML = CATS.map(c=>`<button class="cat" data-c="${c.id}"><div class="ic">${svg(c.icon)}</div><span>${c.name}</span></button>`).join("");
$$(".cat").forEach(b=>b.onclick=()=>{
  cat=b.dataset.c; store.set("cat",cat); markCat(); load();
  if (sheetState === "full") setSheet("half");
});
function markCat(){ $$(".cat").forEach(b=>b.classList.toggle("on", b.dataset.c===cat)); }
/* distance slider: results update while you slide, more are fetched when you let go */
const radIn = $("#radius");
function setRadius(m){ radiusMi = Math.max(1, Math.min(30, Math.round(m))); radiusKm = radiusMi * 1.609; store.set("rMi", radiusMi);
  radIn.value = radiusMi; $("#radLbl").textContent = `${radiusMi} mi`; radIn.style.setProperty("--p", ((radiusMi-1)/29*100) + "%"); }
setRadius(radiusMi);
radIn.addEventListener("input", () => { setRadius(+radIn.value); if (redrawNow) redrawNow(true); });
radIn.addEventListener("change", () => load());

$("#refresh").onclick = locate;
$("#here").onclick = ()=>{ const c = map.getCenter(); load({lat:c.lat, lon:c.lng, fromMap:true}); };
$("#searchForm").onsubmit = e => { e.preventDefault(); document.activeElement.blur(); load(); };
["#q","#area"].forEach(sel => $(sel).addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); e.target.blur(); load(); } }));
$("#area").value = store.get("area", "");

/* ---------- search ---------- */
const km = (a,b)=>{const R=6371,t=x=>x*Math.PI/180,dl=t(b.lat-a.lat),dn=t(b.lon-a.lon);
  const h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
const mi = k => (k*0.621371<10 ? (k*0.621371).toFixed(1) : Math.round(k*0.621371)) + " mi";

const geoCache = store.get("geo", {});
async function center(){
  const typed = $("#area").value.trim();
  store.set("area", typed);
  if (typed){
    if (geoCache[typed]) return geoCache[typed];
    try{
      const j = await (await fetch(`${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(typed)}`,{headers:{"Accept-Language":"en"}})).json();
      if (j[0]){ geoCache[typed] = {lat:+j[0].lat, lon:+j[0].lon}; store.set("geo", geoCache); return geoCache[typed]; }
    }catch{}
    return null;
  }
  if (pos) return pos;
  if (map && map.getZoom() >= 9){ const c = map.getCenter(); return {lat:c.lat, lon:c.lng, fromMap:true}; }
  return null;
}

let reqId = 0, shown = [], widened = false, redrawNow = null;

/* ---- listings: the map is split into ~13-mile cells. Each cell is one small, fast request,
   shown the moment it arrives (nearest first) and kept on the phone for offline use. ---- */
const CELL = 0.2, FRESH = 7*864e5;
function cellBox(k){ const [i, j] = k.split("_").map(Number); return [i*CELL, j*CELL, (i+1)*CELL, (j+1)*CELL]; }
function cellsAround(c, rk){
  const dLat = rk/111, dLon = rk/(111*Math.cos(c.lat*Math.PI/180)), out = [];
  for (let i = Math.floor((c.lat-dLat)/CELL); i <= Math.floor((c.lat+dLat)/CELL); i++)
    for (let j = Math.floor((c.lon-dLon)/CELL); j <= Math.floor((c.lon+dLon)/CELL); j++){
      const [s, w, n, e] = cellBox(`${i}_${j}`);
      const d = km(c, {lat: Math.min(Math.max(c.lat, s), n), lon: Math.min(Math.max(c.lon, w), e)});  // closest point of the cell
      if (d <= rk) out.push({k:`${i}_${j}`, d});
    }
  return out.sort((a, b) => a.d - b.d).map(x => x.k);
}
function cellQuery(k){
  const [s, w, n, e] = cellBox(k).map(v => v.toFixed(3));
  return `[out:json][timeout:20][bbox:${s},${w},${n},${e}];(
nwr["shop"~"^(car_repair|tyres|truck_repair)$"];nwr["craft"="car_repair"];
nwr["amenity"~"^(fuel|charging_station)$"];nwr["highway"~"^(services|rest_area)$"];
nwr["service:vehicle:towing"];nwr["service:vehicle:breakdown"];
nwr["shop"]["name"~"tow|wrecker|roadside|mobile",i];nwr["office"]["name"~"tow|wrecker|roadside|mobile",i];
);out center tags qt;`;
}
const cdb = (() => {        // IndexedDB: listings cells + EV stations (localStorage is too small)
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open("roadbudz-data", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("cells", {keyPath:"k"}); r.result.createObjectStore("ev", {keyPath:"k"}); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = async (st, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(st, mode); const q = fn(t.objectStore(st)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return { get:(st, k) => run(st, "readonly", s => s.get(k)), put:(st, v) => run(st, "readwrite", s => s.put(v)) };
})();
const cellMem = new Map(), cellFlight = new Map(); let proxyFails = 0;
async function cellFromDisk(k){
  if (cellMem.has(k)) return cellMem.get(k);
  try{ const v = await cdb.get("cells", k); if (v) cellMem.set(k, v); return v || null; }catch{ return null; }
}
function getCell(k){
  if (cellFlight.has(k)) return cellFlight.get(k);         // same cell already on its way: share it
  const p = (async () => {
    const have = await cellFromDisk(k);
    if (have && Date.now() - have.t < FRESH) return have;
    try{
      let els, settled = false;
      const direct = () => overpass(cellQuery(k)).then(j => j.elements);
      if (await proxyOn() && proxyFails < 3){
        const viaCache = fetchT(`api/places.php?cell=${k}`, 30000).then(async r => { if (!r.ok) throw 0; return (await r.json()).elements; })
          .catch(e => { proxyFails++; throw e; });
        // your cache answers instantly for areas anyone has opened; if it's still working after 3 s, ask the public mirrors too
        els = await Promise.any([viaCache, new Promise((res, rej) => setTimeout(() => settled ? rej(0) : direct().then(res, rej), 3000))]);
        settled = true;
      } else els = await direct();
      const v = {k, t: Date.now(), items: els.map(toItem).filter(x => x.lat != null)};
      cellMem.set(k, v); cdb.put("cells", v).catch(()=>{});
      return v;
    }catch(e){ if (have) return have; throw e; }           // offline / busy: an old copy beats nothing
  })();
  cellFlight.set(k, p); p.catch(()=>{}).finally(() => cellFlight.delete(k));
  return p;
}
function toItem(e){
  const t=e.tags||{}, lat=e.lat??e.center?.lat, lon=e.lon??e.center?.lon;
  return {id:e.type[0]+e.id, name:t.name||t.brand||defaultName(t), lat, lon,
    phone:t.phone||t["contact:phone"]||"", hours:t.opening_hours||"",
    addr:[t["addr:housenumber"],t["addr:street"],t["addr:city"]].filter(Boolean).join(" "), kind:kindOf(t), tags:keepTags(t)};
}

/* ---- EV charging stations: U.S. DOE Alternative Fuels Data Center (complete US list with connectors, ports and pricing) ---- */
const NREL = "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json";
const CONN = {J1772:"type1", J1772COMBO:"type1_combo", CHADEMO:"chademo", TESLA:"nacs", NEMA515:"nema_5_15", NEMA520:"nema_5_15", NEMA1450:"nema_14_50"};
const wantsEV = () => power() === "ev" || power() === "phev";
const evKey = (c, rk) => `${Math.round(c.lat*20)/20}_${Math.round(c.lon*20)/20}_${Math.min(50, Math.ceil(rk*0.621 + 4))}`;
function evItem(s){
  const tags = {amenity:"charging_station", network: s.ev_network || "", "ev:dc": s.ev_dc_fast_num || 0, "ev:l2": s.ev_level2_evse_num || 0, "ev:pricing": s.ev_pricing || "", src:"afdc"};
  (s.ev_connector_types || []).forEach(c => { if (CONN[c]) tags["socket:" + CONN[c]] = "yes"; });
  return {id:"a" + s.id, name: s.station_name || "EV Charger", lat: s.latitude, lon: s.longitude, phone: s.station_phone || "",
    hours: s.access_days_time || "", addr: [s.street_address, s.city].filter(Boolean).join(", "), kind:"EV charger", tags};
}
async function evStations(c, rk){
  const lat = Math.round(c.lat*20)/20, lon = Math.round(c.lon*20)/20, rmi = Math.min(50, Math.ceil(rk*0.621 + 4)), k = evKey(c, rk);
  let have = null; try{ have = await cdb.get("ev", k); }catch{}
  if (have && Date.now() - have.t < 864e5) return have.items;
  try{
    let list = null;
    if (await proxyOn()){
      try{ const r = await fetchT(`api/ev.php?lat=${lat}&lon=${lon}&radius=${rmi}`, 20000); if (r.ok) list = (await r.json()).fuel_stations; }catch{}
    }
    if (!list){
      const r = await fetchT(`${NREL}?api_key=${encodeURIComponent(CFG.NREL_KEY)}&latitude=${lat}&longitude=${lon}&radius=${rmi}&fuel_type=ELEC&status=E&access=public&limit=200`, 20000);
      if (!r.ok) throw 0;
      list = (await r.json()).fuel_stations;
    }
    const items = (list || []).map(evItem).filter(x => x.lat != null);
    cdb.put("ev", {k, t: Date.now(), items}).catch(()=>{});
    return items;
  }catch{ return have ? have.items : []; }
}
function mergeEV(list, ev){     // DOE data replaces the same charger from OpenStreetMap
  return list.filter(x => !(x.tags.amenity === "charging_station" && ev.some(a => Math.abs(a.lat - x.lat) < .0008 && Math.abs(a.lon - x.lon) < .0008))).concat(ev);
}

/* ---- businesses that come to you: mobile EV charging + mobile providers listed on Roadesy ---- */
const covers = (p, c) => c && (p.national || (p.areas || []).some(a => km(c, a) <= a.km));
function mobileEV(c){ return (window.MOBILE_EV || []).filter(p => covers(p, c)); }
let comeList = [];                                   // what the "comes to you" cards point at
function mobileEVRow(c){
  const list = mobileEV(c);
  if (!list.length) return "";
  comeEV = list;
  return `<button class="evrow" data-evlist>${svg(I.bolt)}<span><b>Mobile EV charging</b> · ${list.filter(p => !p.national).length || list.length} services cover your area</span><i>›</i></button>`;
}
let comeEV = [];
function evListSheet(){
  $("#sheetBody").innerHTML = `<div class="sh-top"><div class="sh-ic" style="background:var(--green);color:#03140b">${svg(I.bolt)}</div><div><h3>Mobile EV charging</h3><div class="meta">They bring enough charge to reach a charger</div></div></div>
    <div class="list" style="margin-top:12px">${comeEV.map((p, k) => `<div class="item"><div class="row"><div><h4 data-evp="${k}">${esc(p.name)}</h4><div class="meta">${esc(p.note || "")}${p.hours ? " · " + esc(p.hours) : ""}</div></div></div>
      <div class="acts"><a class="act call ${p.phone ? "" : "dis"}" href="tel:${esc(telNum(p.phone))}">${svg(I.phone)}Call</a><button class="act" data-evp="${k}">Details</button></div></div>`).join("")}</div>
    <div class="empty" style="padding:12px 4px 0">Independent businesses — confirm coverage, price and your connector before they dispatch.</div>
    <button class="btn ghost" data-close>Close</button>`;
  $$("#sheet [data-evp]").forEach(b => b.onclick = () => openProvider(comeEV[+b.dataset.evp]));
  openSheet();
}
/* ---- businesses listed on Roadesy (providers.json, approved by you) ---- */
let PROVIDERS = [];
fetchT("providers.json", 8000, {cache:"no-cache"}).then(r => r.ok ? r.json() : []).then(l => { PROVIDERS = Array.isArray(l) ? l : []; store.set("providers", PROVIDERS); if (PROVIDERS.length && redrawNow) redrawNow(); })
  .catch(() => { PROVIDERS = store.get("providers", []); });
function partnerItems(){
  return PROVIDERS.filter(p => p.lat != null && p.lon != null).map((p, i) => ({id: "p" + i, name: p.name, lat: +p.lat, lon: +p.lon, phone: p.phone || "",
    hours: p.hours || "", addr: p.address || "", kind: "Listed on Roadesy", tags: {src: "rb"}, prov: p}));
}
const partnersMobile = c => PROVIDERS.filter(p => (p.lat == null || p.lon == null) && (p.cats || []).includes(cat) && covers(p, c));
// Mobile businesses listed on Roadesy show as normal listings; mobile EV charging is a single row, only for EV/plug-in owners
const mobileEVFor = c => {
  comeList = partnersMobile(c);
  const cards = comeList.map((p, k) => `<div class="item"><div class="row"><div><h4 data-prov="${k}">${esc(p.name)}</h4><div class="meta">${esc(p.note || "")}${p.hours ? " · " + esc(p.hours) : ""}</div></div><div class="dist">Comes<br>to you</div></div>
    <span class="tag feat">Listed on Roadesy</span><div class="acts"><a class="act call ${p.phone ? "" : "dis"}" href="tel:${esc(telNum(p.phone))}">${svg(I.phone)}Call</a><button class="act" data-prov="${k}">Details</button></div></div>`).join("");
  return (cards ? `<div class="list" style="margin-bottom:10px">${cards}</div>` : "") + (wantsEV() && ["roadside", "tow", "plaza"].includes(cat) ? mobileEVRow(c) : "");
};

const has = (x, re) => re.test(x.name);
// HERE files alarm and camera installers with locksmiths; drop those unless the name says lock or key
const notLocksmith = x => /alarm|security system|camera|cctv|surveillance|\badt\b/i.test(x.name) && !/lock|key/i.test(x.name);
// auto and mobile locksmiths first: they come to a car that's locked out
const autoLock = x => /auto|car|vehicle|mobile|24|emergency|lockout|key (fob|programming)|car keys?/i.test(x.name + " " + ((x.tags && x.tags["here:cats"]) || "")) ? 0 : 1;
const y = v => v && v !== "no";
function inCat(x, c){
  if (x.prov) return (x.prov.cats || []).includes(c);
  if (x.hcat) return x.hcat === c && !(c === "lock" && notLocksmith(x));
  const t = x.tags;
  switch (c){
    case "tow": return y(t["service:vehicle:towing"]) || has(x,/tow|wrecker|recovery/i);
    case "roadside": return y(t["service:vehicle:breakdown"]) || has(x,/roadside|road service|lockout|jump ?start|motor club|mobile ev|tow|wrecker/i);
    case "mobmech": return has(x,/mobile (auto|mechanic|repair|car|diesel|truck)|on.?site (auto|mechanic)|mechanic on/i);
    case "mobtire": return t.shop === "tyres" || has(x,/mobile tire|tire (service|repair)|tyre/i) || y(t["service:vehicle:tyres"]);
    case "lock": return (t.craft === "locksmith" || t.shop === "locksmith" || has(x,/locksmith|lockout|car keys?|auto keys?|key (fob|programming)/i)) && !notLocksmith(x);
    case "shop": return t.shop === "car_repair" || t.shop === "truck_repair" || t.craft === "car_repair";
    case "plaza": {
      if (t.highway === "services" || t.highway === "rest_area") return true;
      const p = power();
      if (t.amenity === "fuel") return p !== "ev";
      if (t.amenity === "charging_station") return p === "ev" || p === "phev";
      return false;
    }
  }
  return false;
}
function pick(items, ctr){
  const q = $("#q").value.trim().toLowerCase(), words = q ? q.split(/\s+/) : [];
  const seen = new Set();
  return items
    .filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return words.length ? words.every(w => (x.name+" "+x.kind).toLowerCase().includes(w)) : inCat(x, cat); })
    .map(x => ({...x, d: km(ctr, x), drive: driveCache.get(x.id)}))
    .filter(x => x.d <= radiusKm)
    .sort((a,b)=> (b.prov ? 1 : 0) - (a.prov ? 1 : 0) || (cat==="plaza" && !words.length ? rank(a)-rank(b) : 0) || (cat==="lock" && !words.length ? autoLock(a)-autoLock(b) : 0) || a.d-b.d)
    .slice(0, 60);
}
function mapNote(t){ const n = $("#mapNote"); if (n){ n.textContent = t || ""; n.classList.toggle("on", !!t); } }

async function load(forced, diskOnly){
  const c = CATS.find(x=>x.id===cat);
  const id = ++reqId;
  $("#here").classList.remove("on");
  const ctr = forced || await center();
  if (id!==reqId) return;
  if (!ctr){
    $("#results").innerHTML = `<div class="empty">${$("#area").value.trim() ? "Couldn't find that city or ZIP." : "Turn on location or enter a city/ZIP to find help near you.<br>The patrol button above works without it."}</div>`;
    return;
  }
  if (ctr !== pos && !ctr.fromMap) showMe(ctr, true);
  if (window.RBPRO) try{ RBPRO.draw(c, ctr); }catch(e){ console.warn("pro preview", e); }
  const near = cellsAround(ctr, radiusKm);
  const got = new Map(); let ev = [], fitted = false, failed = 0;
  const all = () => {
    const h = got.get("here") || [];
    let l = [].concat(...[...got.entries()].filter(([k]) => k !== "here").map(([, v]) => v), partnerItems());
    if (h.length) l = l.filter(x => x.prov || !h.some(a => Math.abs(a.lat - x.lat) < .0006 && Math.abs(a.lon - x.lon) < .0006));
    l = l.concat(h);
    return ev.length ? mergeEV(l, ev) : l;
  };
  const draw = (refit) => {
    if (id !== reqId) return 0;
    const f = pick(all(), ctr);
    $("#results").innerHTML = render(c, f, "", ctr);
    plot(f, ctr, refit || !fitted); if (f.length) fitted = true;
    rangeRing(ctr);
    driveTimes(f, ctr);
    if (window.RBPRO) try{ RBPRO.draw(c, ctr); }catch(e){ console.warn("pro preview", e); }
    return f.length;
  };
  redrawNow = (refit) => draw(refit);
  const count = () => pick(all(), ctr).length;
  const busy = t => mapNote(count() ? "" : t);          // a note only while nothing is on screen

  // 1) what the phone already has shows instantly (also offline)
  for (const k of near){ const v = await cellFromDisk(k); if (v) got.set(k, v.items); }
  if (wantsEV()){ try{ const v = await cdb.get("ev", evKey(ctr, radiusKm)); if (v) ev = v.items; }catch{} }
  if (id !== reqId) return;
  if (got.size) draw();
  else { $("#results").innerHTML = `${mobileEVFor(ctr)}<div class="spin"></div><div class="empty" style="padding-top:0">Finding help near you…</div>`; pins && pins.clearLayers(); }
  if (diskOnly) return;
  busy("Finding help near you…");

  // 2) HERE business listings (about a second)
  const stall = setTimeout(() => { if (id === reqId && !count()) autoDiagnose(); }, 15000);
  const evP = wantsEV() ? evStations(ctr, radiusKm).then(l => { if (id === reqId){ ev = l; draw(); } }) : null;
  if (await hereOn()){
    const l = await hereCat(cat, ctr, radiusKm);
    if (id !== reqId) return;
    if (l){ got.set("here", l); draw(); }
  }
  // 3) OpenStreetMap fills gaps only when HERE didn't find enough — quietly, nearest areas first
  if (count() < 5){
    busy("Finding help near you…");
    const todo = near.filter(k => { const v = cellMem.get(k); return !v || Date.now() - v.t >= FRESH; });
    await runPool(todo, async k => {
      if (id !== reqId) return;
      try{ const v = await getCell(k); got.set(k, v.items); draw(); }catch{ failed++; }
    }, (await proxyOn()) ? 4 : 2);
    if (id !== reqId) return;
  }
  if (evP) await evP;
  if (id !== reqId) return;
  if (!count()){ busy("Searching…"); const l = await nominatimCat(cat, ctr); if (id !== reqId) return; if (l.length) got.set("nom_" + cat, l); }
  clearTimeout(stall); $("#diagLine").hidden = true; mapNote("");
  if (!got.size && !ev.length){
    $("#results").innerHTML = `${mobileEVFor(ctr)}<div class="empty">Couldn't reach the listings right now — weak signal or the listings servers are busy. Saved contacts in My Car and the SOS button still work.</div><button class="more" data-retry>Try again</button><button class="more" data-check>Run a connection check</button>`;
    return;
  }
  draw();
}

/* the distance you picked, drawn on the map */
let ring = null;
function rangeRing(c){
  if (!map || !window.L || !L.circle) return;
  try{
    if (!ring) ring = L.circle([c.lat, c.lon], {radius: radiusKm*1000, color: "#ffb81c", weight: 1.5, opacity: .7, fillColor: "#ffb81c", fillOpacity: .05, interactive: false}).addTo(map);
    else { ring.setLatLng([c.lat, c.lon]); ring.setRadius(radiusKm*1000); }
  }catch{}
}

/* ---- main business listings: HERE (via your server, key stays there). Fast, and it has real towing,
   road-assistance, repair and tire businesses that OpenStreetMap is missing. ---- */
const HERE_TAGS = [["700-7200-0278",{"service:vehicle:towing":"yes"},"Towing"],["700-7850-0128",{"service:vehicle:breakdown":"yes"},"Roadside assistance"],
  ["700-7850-0129",{"service:vehicle:breakdown":"yes"},"Auto club"],["700-7200-0263",{craft:"locksmith"},"Locksmith"],["700-7850-0125",{shop:"tyres"},"Tire shop"],["700-7850-0126",{shop:"truck_repair"},"Truck repair"],
  ["700-7850-0122",{shop:"car_repair"},""],["700-7850-0000",{shop:"car_repair"},""],["700-7600-0322",{amenity:"charging_station"},"EV charger"],
  ["700-7600-0116",{amenity:"fuel"},"Fuel"],["700-7900-0132",{highway:"services"},"Truck stop"],["400-4300",{highway:"rest_area"},"Rest area"]];
const hereOn = async () => (await proxyOn()) && !!pingInfo.here;
const hereCatKey = c => c === "plaza" ? (power() === "ev" ? "plaza_ev" : power() === "phev" ? "plaza_phev" : "plaza") : c;
function hereItem(h, c){
  const tags = {src: "here"}; let kind = "";
  for (const k of h.cats || []){ const m = HERE_TAGS.find(t => k.id.startsWith(t[0])); if (m){ Object.assign(tags, m[1]); if (!kind && m[2]) kind = m[2]; } }
  if (h.chain) tags.brand = h.chain; if (h.www) tags.website = h.www; if (h.hours) tags.opening_hours = h.hours;
  tags["here:cats"] = (h.cats || []).map(k => k.name).filter(Boolean).join("|");
  if (/mobile/i.test(h.name)) kind = "Mobile";
  return {id: "h" + h.id, name: h.name, lat: h.lat, lon: h.lon, phone: h.phone || "", hours: h.hours || "", addr: h.addr || "", kind: kind || kindOf(tags), tags, hcat: c};
}
async function hereCat(c, ctr, rk){
  const hc = hereCatKey(c), r = rk <= 8 ? 8000 : rk <= 24 ? 24000 : 48000;
  const lat = Math.round(ctr.lat*20)/20, lon = Math.round(ctr.lon*20)/20, key = `here_${hc}_${lat}_${lon}_${r}`;
  let have = null; try{ have = await cdb.get("cells", key); }catch{}
  if (have && Date.now() - have.t < 864e5) return have.items;
  try{
    const res = await fetchT(`api/here.php?cat=${hc}&lat=${lat}&lon=${lon}&r=${r}`, 12000);
    if (!res.ok) throw 0;
    const items = ((await res.json()).items || []).map(h => hereItem(h, c));
    cdb.put("cells", {k: key, t: Date.now(), items}).catch(()=>{});
    return items;
  }catch{ return have ? have.items : null; }
}

/* ---- backup source: OpenStreetMap search (Nominatim). One request for the category on screen, only when the
   listings servers don't answer. Cached 7 days. Policy: on demand, ≤1 request/second, results cached. ---- */
const NOM_Q = {shop:["[car repair]"], mobtire:["[tyres]","tire"], tow:["towing"], roadside:["towing","roadside"], mobmech:["mobile mechanic"], lock:["[locksmith]","locksmith"],
  plaza:() => wantsEV() ? (power()==="phev" ? ["[charging station]","[fuel]"] : ["[charging station]"]) : ["[fuel]"]};
let nomLast = 0;
async function nominatimCat(c, ctr){
  const qs = typeof NOM_Q[c] === "function" ? NOM_Q[c]() : NOM_Q[c]; if (!qs) return [];
  const key = `nom_${c}_${power()}_${ctr.lat.toFixed(2)}_${ctr.lon.toFixed(2)}`;
  try{ const v = await cdb.get("cells", key); if (v && Date.now() - v.t < FRESH) return v.items; }catch{}
  const out = [];
  for (const q of qs){
    const d = q.startsWith("[") ? 0.15 : 0.35;                 // amenity-only searches need a small box
    const vb = [ctr.lon-d, ctr.lat+d, ctr.lon+d, ctr.lat-d].map(v => v.toFixed(4)).join(",");
    const wait = 1100 - (Date.now() - nomLast); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    nomLast = Date.now();
    try{
      const r = await fetchT(`${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}&viewbox=${vb}&bounded=1&limit=40&extratags=1&addressdetails=1&countrycodes=us`, 10000, {headers:{"Accept-Language":"en"}});
      if (!r.ok) continue;
      for (const e of await r.json()){
        const x = e.extratags || {}, a = e.address || {}, tags = {...x, [e.category]: e.type};
        if (e.name) tags.name = e.name;
        out.push({id: (e.osm_type||"n")[0] + e.osm_id, name: e.name || defaultName(tags), lat: +e.lat, lon: +e.lon,
          phone: x.phone || x["contact:phone"] || "", hours: x.opening_hours || "",
          addr: [a.house_number, a.road, a.city || a.town || a.village].filter(Boolean).join(" "), kind: kindOf(tags), tags: keepTags(tags)});
      }
    }catch{}
  }
  if (out.length) cdb.put("cells", {k: key, t: Date.now(), items: out}).catch(()=>{});
  return out;
}

/* ---- drive distance & time by road for the closest results (one request for up to 25) ---- */
const driveCache = new Map(); let driveT = null, driveFrom = "";
const COMES = ["tow", "roadside", "mobmech", "mobtire", "lock"];     // these businesses drive to you
const comesCat = () => COMES.includes(cat);
function driveTimes(list, ctr){
  if (!pos || ctr !== pos || !navigator.onLine) return;
  const from = `${pos.lat.toFixed(3)},${pos.lon.toFixed(3)}`;
  if (from !== driveFrom){ driveCache.clear(); driveFrom = from; }
  const need = list.slice(0, 25).filter(x => !driveCache.has(x.id));
  if (!need.length) return;
  clearTimeout(driveT);
  driveT = setTimeout(async () => {
    try{
      const coords = [`${pos.lon},${pos.lat}`].concat(need.map(x => `${x.lon},${x.lat}`)).join(";");
      // tow trucks & mobile services: time from THEIR location to YOU; shops & plazas: time from you to them
      const toYou = comesCat(), idx = need.map((_, i) => i + 1).join(";");
      const q = toYou ? `sources=${idx}&destinations=0` : `sources=0`;
      const j = await (await fetchT(`${OSRM}table/v1/driving/${coords}?${q}&annotations=duration,distance`, 10000)).json();
      if (j.code !== "Ok") return;
      need.forEach((x, i) => {
        const s = toYou ? j.durations[i][0] : j.durations[0][i+1], m = j.distances ? (toYou ? j.distances[i][0] : j.distances[0][i+1]) : null;
        if (s == null) return;
        driveCache.set(x.id, {s, m});
        const el = document.querySelector(`[data-did="${CSS.escape(x.id)}"]`);
        if (el) el.innerHTML = distHTML({...x, drive: {s, m}});
        const sx = shown.find(z => z.id === x.id); if (sx) sx.drive = {s, m};
      });
    }catch{}
  }, 700);
}
const mins = s => { const m = Math.max(1, Math.round(s/60)); return m < 60 ? `${m} min` : `${Math.floor(m/60)} h ${m%60} min`; };
function distHTML(x){ return x.drive && x.drive.m != null ? `${mi(x.drive.m/1000)}<small>${comesCat() ? "~" + mins(x.drive.s) + " to you" : mins(x.drive.s) + " drive"}</small>` : mi(x.d); }

/* ---- arrival estimate: drive time from the business to you + how long until they can leave ---- */
function etaHTML(x){
  const road = x.drive && x.drive.s != null;
  const s = road ? x.drive.s : (x.d * 0.621371 * 1.3) / 35 * 3600;          // no road data yet: ~35 mph average
  const m = road && x.drive.m != null ? x.drive.m/1000 : x.d * 1.3;
  return `<div class="sh-sec"><h5>When they could reach you</h5>
    <div class="eta-big"><b id="etaClock">—</b><small>${road ? "" : "about "}${mins(s)} drive · ${mi(m)}${road ? " by road" : ""}</small></div>
    <div class="kv" style="margin:8px 0 6px;font-size:13px">If they can leave:</div>
    <div class="eta-ch" data-drive="${Math.round(s)}">${[["Now",0],["15 min",15],["30 min",30],["1 hr",60]].map(([l,v],i) => `<button class="chip ${i===1?"on":""}" data-wait="${v}">${l}</button>`).join("")}</div>
    <div class="kv" style="font-size:12px;color:var(--muted);margin-top:8px">Drive time only. Ask for their real arrival time when you call — they may be finishing another job.</div></div>`;
}
function wireEta(){
  const box = document.querySelector("#sheet .eta-ch"); if (!box) return;
  const drive = +box.dataset.drive;
  const set = w => { $$("#sheet .eta-ch .chip").forEach(c => c.classList.toggle("on", +c.dataset.wait === w));
    const at = new Date(Date.now() + (drive + w*60) * 1000);
    $("#etaClock").textContent = `~${mins(drive + w*60)} · ${at.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}`; };
  box.onclick = e => { const c = e.target.closest("[data-wait]"); if (c) set(+c.dataset.wait); };
  set(15);
}

/* ---- tow estimate (your hook-up + per-mile rates, set in Safety) ---- */
function towRates(){ const r = store.get("towRates", {}); const set = r.hook != null && r.hook !== ""; return {hook: set ? +r.hook : 75, mile: r.mile != null && r.mile !== "" ? +r.mile : 4, set}; }
function towHTML(x){
  const r = towRates(), road = x.drive && x.drive.m != null, miles = road ? x.drive.m/1609.34 : x.d*0.621371*1.25;
  const est = r.hook + r.mile*miles;
  return `<div class="sh-sec"><h5>Tow here — estimate</h5><div class="price"><b>$${Math.round(est)}</b><small>${road ? "" : "about "}${miles.toFixed(1)} mi${road ? " by road" : ""} · $${r.hook} hook-up + $${r.mile.toFixed(2)}/mi</small></div>
    <div class="kv" style="font-size:12px;color:var(--muted)">${r.set ? "Your rates" : "Typical rates"} — change them in Safety. Always get the total price from the tow company.</div></div>`;
}
function defaultName(t){
  if (t.highway==="services") return "Service Plaza";
  if (t.highway==="rest_area") return "Rest Area";
  if (t.amenity==="fuel") return "Gas Station";
  if (t.amenity==="charging_station") return "EV Charger";
  if (t.shop==="tyres") return "Tire Shop";
  if (t.craft==="locksmith" || t.shop==="locksmith") return "Locksmith";
  return "Auto Repair";
}
function kindOf(t){
  if (t.highway==="services") return "Service plaza";
  if (t.highway==="rest_area") return "Rest area";
  if (t.amenity==="fuel") return "Fuel";
  if (t.amenity==="charging_station") return "EV charger";
  if (/mobile/i.test(t.name||"")) return "Mobile";
  if (t.shop==="tyres") return "Tire shop";
  if (t.craft==="locksmith" || t.shop==="locksmith") return "Locksmith";
  return "";
}
const rank = x => x.kind==="Service plaza"?0 : x.kind==="Rest area"?1
  : x.kind==="EV charger" ? (power()==="ev"?1.5:2.5)
  : (power()==="diesel" && x.tags && /yes|\d/.test((x.tags["fuel:diesel"]||"")+(x.tags["fuel:HGV_diesel"]||""))) ? 1.6 : 2;

function moreLinks(n){
  return n < 3 && radiusMi < 30 ? `<button class="more" data-widen>Show within ${Math.min(30, Math.max(radiusMi * 2, radiusMi + 5))} mi</button>` : "";
}
function render(c, items, note, ctr){
  shown = items;
  $("#sumTxt").textContent = items.length ? `${c.name} · ${items.length} nearby` : `${c.name}`;
  const span = radiusKm;
  const top = mobileEVFor(ctr);
  if (!items.length) return `${top}<div class="empty">No ${c.name.toLowerCase()} listed within ${mi(span)}${$("#q").value.trim()?" matching your search":""}. Try another category, drag the map and tap “Search this area”, or add a business you know to Saved contacts.</div>${moreLinks(items.length)}`;
  return `${top}<div class="list">${items.map((x,i)=>`
    <div class="item">
      <div class="row"><div><h4 data-i="${i}">${esc(x.name)}</h4>
        <div class="meta">${esc(x.addr||"")}${x.hours?`${x.addr?" · ":""}${esc(x.hours)}`:""}</div></div>
        <div class="dist" data-did="${esc(x.id)}">${distHTML(x)}</div></div>
      ${x.kind?`<span class="tag ${x.prov?"feat":""}">${esc(x.kind)}</span>`:""}${/24\/7/.test(x.hours)?`<span class="tag open">24/7</span>`:""}
      <div class="acts">
        <a class="act call ${x.phone?"":"dis"}" href="tel:${esc(telNum(x.phone))}">${svg(I.phone)}Call</a>
        <button class="act" data-route="${i}">${svg(I.nav)}Directions</button>
      </div>
    </div>`).join("")}</div><div class="empty" style="padding:14px 10px 4px">${note?esc(note)+" ":""}Listings aren't verified — call to confirm service, price and availability.${items.some(x=>x.tags.src==="here")?" Business listings © HERE.":""}${items.some(x=>x.tags.src==="afdc")?" EV chargers: U.S. DOE Alternative Fuels Data Center.":""}</div>${note?`<button class="more" data-retry>Try again</button>`:moreLinks()}`;
}
$("#results").addEventListener("click", e => {
  const pv = e.target.closest("[data-prov]"); if (pv){ openProvider(comeList[+pv.dataset.prov]); return; }
  if (e.target.closest("[data-evlist]")){ evListSheet(); return; }
  const h = e.target.closest("h4[data-i]"); if (h){ focusPin(+h.dataset.i); openPlace(shown[+h.dataset.i]); return; }
  const r = e.target.closest("[data-route]"); if (r){ routeTo(shown[+r.dataset.route]); return; }
  if (e.target.closest("[data-widen]")){ setRadius(Math.min(30, Math.max(radiusMi * 2, radiusMi + 5))); load(); return; }
  if (e.target.closest("[data-retry]")) load();
  if (e.target.closest("[data-retry-loc]")) locate();
  if (e.target.closest("[data-check]")) connCheck();
});

/* ---------- map-first layout: bottom sheet (phones) / side list (tablets), SOS button ---------- */
const sideList = () => matchMedia("(min-width:1000px), (orientation:landscape) and (min-width:760px)").matches;
let sheetState = store.get("sheet", "half");
function sheetHeights(){
  const H = $("#mf").clientHeight || innerHeight - 130;
  return {peek: Math.min(200, Math.round(H*0.3)), half: Math.round(H*0.48), full: H - 52};
}
const sheetPx = () => sideList() ? 0 : (sheetHeights()[sheetState] || 200);
function setSheet(st, keepMap){
  if (sideList()){ document.documentElement.style.setProperty("--sheetVis", "0px"); return; }
  sheetState = st; store.set("sheet", st);
  document.documentElement.style.setProperty("--sheetVis", sheetHeights()[st] + "px");
}
function measure(){
  const hd = $("header"), nv = $("nav.tabs");
  if (hd) document.documentElement.style.setProperty("--hdrH", Math.round(hd.getBoundingClientRect().bottom) + "px");
  if (nv) document.documentElement.style.setProperty("--navH", Math.round(nv.getBoundingClientRect().height) + "px");
  setSheet(sheetState);
}
addEventListener("resize", () => { measure(); map && map.invalidateSize(); });
// drag the sheet by its header; a tap toggles between small and half
(() => {
  const head = $("#msHead"), sh = $("#msheet"); let y0 = null, v0 = 0, moved = false;
  head.addEventListener("pointerdown", e => {
    if (sideList() || e.target.closest("button, input, form, .bar")) return;
    y0 = e.clientY; v0 = sheetPx(); moved = false; sh.classList.add("drag"); head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", e => {
    if (y0 === null) return;
    const dy = y0 - e.clientY; if (Math.abs(dy) > 6) moved = true;
    const hs = sheetHeights(), v = Math.max(hs.peek - 40, Math.min(hs.full, v0 + dy));
    document.documentElement.style.setProperty("--sheetVis", v + "px");
  });
  const end = e => {
    if (y0 === null) return;
    sh.classList.remove("drag");
    const hs = sheetHeights(), v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheetVis")) || hs.half;
    if (!moved) setSheet(sheetState === "peek" ? "half" : "peek");
    else setSheet(Object.entries(hs).sort((a, b) => Math.abs(a[1]-v) - Math.abs(b[1]-v))[0][0]);
    y0 = null;
  };
  head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
})();
// search fields fold away in the sheet header
$("#srchBtn").onclick = () => { const f = $("#searchForm"); f.hidden = !f.hidden; if (!f.hidden){ if (sheetState === "peek") setSheet("half"); $("#q").focus(); } };
// SOS → patrol card (tap Call there to dial: two taps total)
function openSOS(){ $("#sosPanel").hidden = false; }
$("#sosBtn").onclick = openSOS;
$$("[data-sosclose]").forEach(b => b.onclick = () => { $("#sosPanel").hidden = true; });
// center a spot in the visible part of the map (above the sheet)
function viewAt(lat, lon, z){
  if (!map) return;
  map.setView([lat, lon], z, {animate: false});
  const off = sideList() ? 0 : Math.round((sheetPx() - 52) / 2);
  if (off > 0) try{ map.panBy([0, off], {animate: false}); }catch{}
}

/* ---------- in-app map (Leaflet + OpenStreetMap) ---------- */
let map = null, pins = null, me = null, markers = [];
function ensureMap(c){
  if (map) return true;
  if (!window.L){ $("#map").textContent = "Map needs a connection the first time. Listings below still work."; return false; }
  $("#map").textContent = "";
  map = L.map("map", {zoomControl:true}).setView([c.lat, c.lon], c.z || 13);
  L.tileLayer(CFG.TILE_URL, {maxZoom:19, attribution:CFG.TILE_ATTR}).addTo(map);
  try{ map.attributionControl.setPrefix(false); }catch{}
  pins = L.layerGroup().addTo(map);
  map.on("dragend", ()=>{ if (!nav) $("#here").classList.add("on"); });
  map.on("dragstart", ()=>{ if (nav) nav.panUntil = Date.now() + 10000; });
  return true;
}
function showMe(c, isArea){
  if (!ensureMap(c)) return;
  if (isArea){ viewAt(c.lat, c.lon, 13); return; }
  const icon = L.divIcon({className:"", html:'<div class="me-dot"></div>', iconSize:[16,16], iconAnchor:[8,8]});
  if (me) me.setLatLng([c.lat, c.lon]); else me = L.marker([c.lat, c.lon], {icon, zIndexOffset:1000}).addTo(map).bindPopup("You are here");
}
function pinIcon(x){
  const am = x.tags && x.tags.amenity, fuel = am === "fuel", ev = am === "charging_station";
  const b = fuel ? brandOf(x) : ev ? networkOf(x) : null;
  const p = (fuel||ev) ? priceOf(x.id, ev) : null;
  const lo = lowest[am];
  const low = p && lo != null && p.price <= lo;
  const ic = ev ? I.bolt : fuel ? I.fuel : (CATS.find(c=>c.id===cat)||CATS[0]).icon;
  const html = `<div class="mk"><div class="pn" style="${b?`background:${b[1]}`:ev?"background:var(--green)":""}"></div><div class="gl" style="${b?`color:${b[2]}`:ev?"color:#03140b":""}">${svg(ic)}</div>${p?`<div class="pr ${low?"low":""}">$${p.price.toFixed(2)}${ev?"/kWh":""}</div>`:""}</div>`;
  return L.divIcon({className:"", html, iconSize:[34,46], iconAnchor:[17,42]});
}
let lowest = {};
function plot(items, ctr, fit){
  if (!map) return;
  pins.clearLayers(); markers = [];
  lowest = {};
  for (const am of ["fuel","charging_station"]){
    const ps = items.filter(x=>x.tags&&x.tags.amenity===am).map(x=>priceOf(x.id, am==="charging_station")).filter(Boolean).map(p=>p.price);
    lowest[am] = ps.length > 1 ? Math.min(...ps) : null;
  }
  items.forEach(x=>{
    markers.push(L.marker([x.lat, x.lon], {icon:pinIcon(x), riseOnHover:true}).addTo(pins).on("click", ()=>openPlace(x)));
  });
  if (!fit || ctr.fromMap || nav) return;   // keep the view the user chose
  // keep YOU (or the searched place) in the middle, zoomed out just enough to show the closest results
  let dl = .006, dn = .006;
  items.slice(0, 8).forEach(x => { dl = Math.max(dl, Math.abs(x.lat-ctr.lat)); dn = Math.max(dn, Math.abs(x.lon-ctr.lon)); });
  const rl = radiusKm/111, rn = radiusKm/(111*Math.cos(ctr.lat*Math.PI/180));
  dl = Math.min(dl, rl); dn = Math.min(dn, rn);
  map.fitBounds([[ctr.lat-dl, ctr.lon-dn], [ctr.lat+dl, ctr.lon+dn]], {paddingTopLeft:[24, sideList() ? 24 : 64], paddingBottomRight:[24, sheetPx() + 24], maxZoom:15});
}
function recenter(){
  if (!pos){ locate(); return; }
  if (nav) nav.panUntil = 0;
  map && viewAt(pos.lat, pos.lon, Math.max(map.getZoom(), 14));
}
$("#recenterBtn").onclick = recenter;
function focusPin(i){
  const x = shown[i]; if (!map || !x) return;
  if (!sideList()) setSheet("peek");
  viewAt(x.lat, x.lon, 15);
}

/* ---------- my car ---------- */
const F = ["carModel","carPower","carColor","carPlate","carIns","carEmerg"];
const car = store.get("car",{});
F.forEach(f=>$("#"+f).value = car[f] || (f==="carPower" ? "gas" : ""));
function syncIns(){ const n=telNum(car.carIns); $("#callIns").href = n?"tel:"+n:"#"; $("#callIns").style.opacity = n?1:.4; }
syncIns();
$("#saveCar").onclick=()=>{ const was = power(); F.forEach(f=>car[f]=$("#"+f).value.trim()); store.set("car",car); syncIns(); toast("Saved"); if (power()!==was) load(); };

function sosText(){
  const v = [car.carColor || $("#carColor").value, car.carModel || $("#carModel").value].filter(Boolean).join(" ");
  const plate = car.carPlate || $("#carPlate").value;
  const pw = {ev:"electric", phev:"plug-in hybrid", diesel:"diesel"}[power()];
  return ["Roadesy – I need roadside help",
    pos ? `Location: https://maps.google.com/?q=${pos.lat},${pos.lon} (±${pos.acc||"?"} m)` : "GPS not available",
    `Road: ${$("#sosRoad").value || "not entered"}`,
    `Direction: ${$("#sosDir").value || "not entered"}`,
    `Mile marker / exit: ${$("#sosMile").value || "not entered"}`,
    `Vehicle: ${v || "not entered"}${plate?` (${plate})`:""}${pw?` – ${pw}`:""}`].join("\n");
}
$("#shareLoc").onclick=async()=>{
  if (!pos) toast("No GPS yet — sharing without your location");
  const files = media.map(m => new File([m.blob], m.name, {type:m.blob.type}));
  const np = media.filter(m=>m.kind==="photo").length, nv = media.length - np;
  const what = [np ? `${np} photo${np>1?"s":""}` : "", nv ? "1 video" : ""].filter(Boolean).join(" and ");
  const text = sosText() + (what ? `\n${what} attached` : "");
  try{
    if (files.length && navigator.canShare && navigator.canShare({files})){
      await navigator.share({title:"Roadesy – I need roadside help", text, files});
    } else if (navigator.share){
      if (files.length) toast("This browser can't attach media — sending text only");
      await navigator.share({title:"My location", text:sosText()});
    } else { await navigator.clipboard.writeText(sosText()); toast("Copied to clipboard"); }
  }catch(e){ if (e && e.name !== "AbortError") toast("Couldn't share — try fewer or smaller files"); }
};

/* ---------- photos & video (kept on this phone in IndexedDB until cleared) ---------- */
const MAX_PHOTOS = 3, MAX_VIDEO_SEC = 15, MAX_VIDEO_MB = 40;
let media = [];   // {id, kind:"photo"|"video", blob, name, dur}
const db = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open("roadbudz", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("media", {keyPath:"id"});
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction("media", mode); const out = fn(t.objectStore("media")); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  return { all: () => tx("readonly", s => s.getAll()), put: m => tx("readwrite", s => s.put(m)), del: id => tx("readwrite", s => s.delete(id)), clear: () => tx("readwrite", s => s.clear()) };
})();

/* Resize to ≤1600px and re-encode: smaller to send on weak signal, and strips the photo's embedded GPS/camera data */
async function shrinkPhoto(file){
  try{
    const bmp = await createImageBitmap(file, {imageOrientation:"from-image"});
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width*k); c.height = Math.round(bmp.height*k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", .8)) || file;
  }catch{ return file; }
}
function videoLength(file){
  return new Promise(res => {
    const v = document.createElement("video"), u = URL.createObjectURL(file);
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => { URL.revokeObjectURL(u); res(isFinite(v.duration) ? v.duration : 0); };
    v.onerror = () => { URL.revokeObjectURL(u); res(0); };
    v.src = u;
  });
}
const urls = new Map();
function renderMedia(){
  urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
  const photos = media.filter(m=>m.kind==="photo").length, video = media.some(m=>m.kind==="video");
  $("#thumbs").innerHTML = media.map(m => { const u = URL.createObjectURL(m.blob); urls.set(m.id, u);
    return `<div class="th">${m.kind==="photo" ? `<img src="${u}" alt="Photo">` : `<video src="${u}#t=0.1" muted playsinline></video><span class="vb">▶ ${Math.round(m.dur)}s</span>`}<button class="x" data-rm="${m.id}" aria-label="Remove">×</button></div>`; }).join("");
  $("#mediaCount").textContent = media.length ? `${photos}/${MAX_PHOTOS} photos${video?" · 1 video":""}` : "optional";
  $("#addPhoto").disabled = photos >= MAX_PHOTOS;
  $("#addVideo").disabled = video;
  $("#clearMedia").hidden = !media.length;
  $$("[data-rm]").forEach(b => b.onclick = async () => { await db.del(b.dataset.rm).catch(()=>{}); media = media.filter(m => m.id !== b.dataset.rm); renderMedia(); });
}
async function addFile(file, kind){
  if (!file) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  if (kind === "photo"){
    const blob = await shrinkPhoto(file);
    media.push({id, kind, blob, name:`roadesy-photo-${media.length+1}.jpg`});
  } else {
    const dur = await videoLength(file);
    if (dur > MAX_VIDEO_SEC + 1){ toast(`Keep the video under ${MAX_VIDEO_SEC} seconds`); return; }
    if (file.size > MAX_VIDEO_MB*1e6){ toast("That video is too large to send — record a shorter clip"); return; }
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    media.push({id, kind, blob:file, name:`roadesy-video.${ext}`, dur});
  }
  await db.put(media[media.length-1]).catch(()=>{});
  renderMedia(); toast(kind === "photo" ? "Photo added" : "Video added");
}
$("#photoIn").onchange = e => { addFile(e.target.files[0], "photo"); e.target.value = ""; };
$("#videoIn").onchange = e => { addFile(e.target.files[0], "video"); e.target.value = ""; };

/* Safety check before the camera opens */
function cameraSafety(kind){
  if (store.get("camSafeOk", 0) > Date.now() - 6*3600e3){ $(kind==="photo"?"#photoIn":"#videoIn").click(); return; }
  $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic" style="background:var(--red);color:#fff">${svg('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>')}</div>
      <div><h3>Stay out of traffic</h3><div class="meta">Before you take ${kind==="photo"?"photos":"a video"}</div></div></div>
    <ul class="safe-list">
      <li>Shoot from inside your car, or from behind a guardrail or barrier.</li>
      <li>Never stand in a travel lane or on the traffic side of your car.</li>
      <li>At night, keep your hazards on and skip the photos if it isn't safe.</li>
    </ul>
    <div class="cf-acts"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="camGo">I'm in a safe spot</button></div>`;
  $("#camGo").onclick = () => { store.set("camSafeOk", Date.now()); closeSheet(); $(kind==="photo"?"#photoIn":"#videoIn").click(); };
  openSheet();
}
$("#addPhoto").onclick = () => cameraSafety("photo");
$("#addVideo").onclick = () => cameraSafety("video");
$("#clearMedia").onclick = async () => { await db.clear().catch(()=>{}); media = []; renderMedia(); toast("Photos & video cleared"); };
db.all().then(list => { media = (list || []).sort((a,b)=>a.id<b.id?-1:1); renderMedia(); }).catch(()=>renderMedia());
$("#copyLoc").onclick=async()=>{ try{ await navigator.clipboard.writeText(sosText()); toast("Details copied"); }catch{ toast("Copy unavailable — use Share"); } };

/* saved contacts */
function contacts(){ return store.get("contacts", []); }
function renderSaved(){
  const list = contacts();
  $("#savedList").innerHTML = list.length ? list.map((c,i)=>`
    <div class="saved"><div><b>${esc(c.name)}</b><small>${esc(c.notes||c.phone)}</small></div>
      <div style="display:flex;gap:6px;align-items:center"><a class="act call" style="flex:none;padding:9px 14px" href="tel:${esc(telNum(c.phone))}">${svg(I.phone)}Call</a><button class="x" data-del="${i}">Remove</button></div></div>`).join("")
    : `<div class="empty" style="padding:6px 0 0;text-align:left">No contacts saved yet.</div>`;
  $$("[data-del]").forEach(b=>b.onclick=()=>{ const l=contacts(); l.splice(+b.dataset.del,1); store.set("contacts",l); renderSaved(); });
}
$("#svAdd").onclick=()=>{
  const name=$("#svName").value.trim(), phone=$("#svPhone").value.trim(), notes=$("#svNotes").value.trim();
  if (!name || !phone){ toast("Enter a name and phone number"); return; }
  const l=contacts(); l.push({name,phone,notes}); store.set("contacts",l);
  ["svName","svPhone","svNotes"].forEach(f=>$("#"+f).value=""); renderSaved(); toast("Contact saved");
};
renderSaved();

/* ---------- tabs, toast, install ---------- */
function tab(v){
  $$("nav.tabs button").forEach(x=>x.classList.toggle("on",x.dataset.v===v));
  $$(".view").forEach(el=>el.classList.toggle("on", el.id==="v-"+v));
  scrollTo(0,0);
  document.body.classList.toggle("findv", v === "find");
  if (v==="find"){ measure(); if (map) setTimeout(()=>map.invalidateSize(), 50); }
}
$$("nav.tabs button").forEach(b=>b.onclick=()=>tab(b.dataset.v));
let tt; function toast(m){ const t=$("#toast"); t.textContent=m; t.classList.add("on"); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove("on"),1800); }

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
let deferred;
function showInstall(on){ $("#installCard").style.display = on ? "block" : "none"; $("#hdrInstall").hidden = !on; }
addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferred=e; showInstall(true); });
if (!standalone) showInstall(true);   // front-page button is always offered until installed
async function install(){
  if (deferred){ deferred.prompt(); const r = await deferred.userChoice; deferred=null; if (r.outcome==="accepted") showInstall(false); }
  else if (isIOS) toast("Tap Share ⇧, then “Add to Home Screen”");
  else toast("Open your browser menu → Install app");
}
$("#installBtn").onclick = install;
$("#hdrInstall").onclick = install;
addEventListener("appinstalled", ()=>{ showInstall(false); toast("Roadesy installed"); });
if (/[?&]from=roadbudz/.test(location.search)) setTimeout(() => toast("RoadBudz is now Roadesy — tap Install to add the new app"), 2500);
if ("serviceWorker" in navigator) addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

/* ---------- place details (bottom sheet) ---------- */
const KEEP = /^(socket:|network|fee$|charge$|capacity$|access$|amenity|shop|highway|brand|operator|website|contact:website|opening_hours|fuel:|service:vehicle:|compressed_air|car_wash|toilets|atm|payment:|description|craft|hgv|truck|self_service|shop$)/;
function keepTags(t){ const o={}; for (const k in t) if (KEEP.test(k)) o[k]=t[k]; return o; }

const BRANDS = [ // [match, pin color, glyph color]
  [/shell/i,"#FBCE07","#DD1D21"],[/chevron/i,"#0054A4","#fff"],[/texaco/i,"#E2231A","#fff"],[/exxon/i,"#E2231A","#fff"],
  [/mobil/i,"#0A3A84","#fff"],[/\bbp\b|amoco/i,"#009B3A","#FFE600"],[/sunoco/i,"#003A70","#FFD100"],[/marathon/i,"#E2231A","#fff"],
  [/speedway/i,"#E2231A","#fff"],[/wawa/i,"#E31837","#FFD200"],[/racetrac/i,"#E31837","#FFD200"],[/citgo/i,"#E8222E","#fff"],
  [/circle k/i,"#DA291C","#fff"],[/7-?eleven/i,"#00824A","#F47B20"],[/valero/i,"#00A1DE","#FFD200"],[/costco/i,"#E31837","#fff"],
  [/sam'?s club/i,"#0067A0","#fff"],[/murphy/i,"#003F87","#fff"],[/sheetz/i,"#E31837","#fff"],[/quiktrip|\bqt\b/i,"#E31837","#fff"],
  [/pilot|flying j/i,"#FFD100","#E31837"],[/love'?s/i,"#FFD100","#E31837"],[/gulf/i,"#F58025","#fff"],[/phillips 66/i,"#E31837","#fff"],
  [/kroger/i,"#0068B3","#fff"],[/publix/i,"#3E8E41","#fff"],[/cumberland/i,"#00843D","#fff"],[/mapco/i,"#0057A8","#fff"]
];
const NETWORKS = [
  [/tesla/i,"#E31937","#fff"],[/electrify america/i,"#00A9E0","#fff"],[/chargepoint/i,"#F7941D","#fff"],[/evgo/i,"#0072CE","#fff"],
  [/blink/i,"#00AEEF","#fff"],[/ionna/i,"#5A2D82","#fff"],[/shell recharge|volta/i,"#FBCE07","#DD1D21"],[/rivian/i,"#FFB81C","#1a1300"],
  [/francis|flo\b/i,"#00A651","#fff"],[/bp pulse/i,"#009B3A","#FFE600"]];
function networkOf(x){ const t=x.tags; const n=[t.network,t.operator,t.brand,x.name].filter(Boolean).join(" "); return NETWORKS.find(b=>b[0].test(n)) || null; }
function power(){ return (car && car.carPower) || "gas"; }
const SOCKETS = {type1:"J1772",type1_combo:"CCS",type2_combo:"CCS2",chademo:"CHAdeMO",tesla_supercharger:"Tesla Supercharger",
  nacs:"NACS (Tesla)",tesla_destination:"Tesla Destination",type2:"Type 2",schuko:"Wall outlet",nema_5_15:"Wall outlet",nema_14_50:"NEMA 14-50"};
function brandOf(x){ const n = (x.tags.brand||"")+" "+x.name; return BRANDS.find(b=>b[0].test(n)) || null; }

const prices = store.get("prices", {});
// gas: one price per grade; EV: one price per kWh. A report lasts 7 days.
const GRADES = [["reg","Regular"],["mid","Mid-grade"],["prem","Premium"],["dsl","Diesel"]];
const fresh = p => p && Date.now()-p.at < 7*864e5 ? p : null;
function gradesOf(id){
  const p = prices[id]; if (!p) return {};
  const g = Object.assign({}, p.g || {}); if (p.price && !g.reg && !p.ev) g.reg = {price:p.price, at:p.at};   // older reports were regular
  for (const k in g) if (!fresh(g[k])) delete g[k];
  return g;
}
const pinGrade = () => power() === "diesel" ? "dsl" : "reg";        // the map shows the grade your car uses
function priceOf(id, ev){ return ev ? fresh(prices[id]) : (gradesOf(id)[pinGrade()] || null); }
const ago = t => { const m = Math.round((Date.now()-t)/6e4); return m<60 ? `${m} min ago` : m<1440 ? `${Math.round(m/60)} h ago` : `${Math.round(m/1440)} d ago`; };

const FUEL = {"fuel:octane_87":"Regular 87","fuel:octane_89":"Mid-grade 89","fuel:octane_91":"Premium 91","fuel:octane_93":"Premium 93",
  "fuel:diesel":"Diesel","fuel:HGV_diesel":"Truck diesel","fuel:e85":"E85","fuel:e15":"E15","fuel:lpg":"Propane / LPG","fuel:cng":"CNG","fuel:adblue":"DEF / AdBlue"};
const SVC = {towing:"Towing",tyres:"Tires",brakes:"Brakes",oil_change:"Oil change",diagnostics:"Diagnostics",batteries:"Batteries",
  car_repair:"General repair",repairs:"Repairs",electrical:"Electrical",engine:"Engine",transmission:"Transmission",glass:"Glass",
  air_conditioning:"A/C",exhaust:"Exhaust",alignment:"Alignment",suspension:"Suspension",body_repair:"Body work",inspection:"Inspection",
  breakdown:"Breakdown help",truck_repair:"Truck repair",wheels:"Wheels",car_parts:"Parts",new_car_sales:"Sales",used_car_sales:"Used sales"};
const yes = v => v && v !== "no";

function placeFacts(x){
  const t = x.tags || {}, chips = [], extras = [];
  if (t.amenity === "charging_station"){
    for (const k in t){
      const m = k.match(/^socket:([a-z0-9_]+)$/i); if (!m || !yes(t[k])) continue;
      const n = /^\d+$/.test(t[k]) ? ` ×${t[k]}` : "", out = t[`socket:${m[1]}:output`];
      chips.push(`${SOCKETS[m[1]] || m[1].replace(/_/g," ")}${n}${out?` · ${out}`:""}`);
    }
    if (+t["ev:dc"]) chips.unshift(`DC fast ×${t["ev:dc"]}`);
    if (+t["ev:l2"]) chips.push(`Level 2 ×${t["ev:l2"]}`);
    if (!chips.length) chips.push("Connector types not listed");
    const net = t.network || t.operator || t.brand; if (net) extras.push(net);
    if (t.capacity) extras.push(`${t.capacity} stalls`);
    if (t.fee === "no") extras.push("Free to charge"); else if (t.fee === "yes") extras.push("Paid");
    if (t.charge) extras.push(t.charge);
    if (t.access && t.access !== "yes" && t.access !== "public") extras.push(`Access: ${t.access}`);
  } else if (t.amenity === "fuel"){
    for (const k in FUEL) if (yes(t[k])) chips.push(FUEL[k]);
    if (!chips.length) chips.push("Gasoline");
    if (yes(t.compressed_air)) extras.push("Air pump");
    if (yes(t.car_wash)) extras.push("Car wash");
    if (yes(t.toilets)) extras.push("Restrooms");
    if (yes(t.atm)) extras.push("ATM");
    if (t.shop) extras.push("Store");
    if (yes(t.hgv) || yes(t["fuel:HGV_diesel"])) extras.push("Truck lanes");
    if (t.self_service === "no") extras.push("Full service");
  } else {
    for (const k in t){ const m = k.match(/^service:vehicle:(.+)$/); if (m && yes(t[k])) chips.push(SVC[m[1]] || m[1].replace(/_/g," ")); }
    (t["here:cats"] || "").split("|").filter(Boolean).forEach(n => { const ln = n.toLowerCase(); if (!chips.some(c => ln.includes(c.toLowerCase()) || c.toLowerCase().includes(ln))) chips.push(n); });
    if (!chips.length){
      chips.push({tow:"Towing",roadside:"Roadside help",mobmech:"Mobile repair",mobtire:"Tire service",lock:"Locksmith",shop:"Auto repair",plaza:"Travel stop"}[cat] || "Auto service");
      if (t.shop === "tyres") chips[0] = "Tires";
      if (cat === "lock" && /mobile/i.test(t.name || "")) chips[0] = "Mobile locksmith";
      if (t.highway === "rest_area") chips[0] = "Rest area";
      if (t.highway === "services") chips[0] = "Service plaza";
    }
    if (t.highway === "services" || t.highway === "rest_area"){ if (yes(t.toilets) || t.highway==="rest_area") extras.push("Restrooms"); }
  }
  if (/24\/7/.test(t.opening_hours||"")) extras.unshift("Open 24/7");
  if (cat === "tow" && (power() === "ev" || power() === "phev")) extras.push("Your EV: ask for a flatbed");
  const pay = Object.keys(t).filter(k=>k.startsWith("payment:") && yes(t[k])).map(k=>k.slice(8).replace(/_/g," "));
  return {chips, extras, pay};
}

function openProvider(p, x){
  if (!p) return;
  const tel = telNum(p.phone), ev = /ev/i.test(p.note || "") || (p.services || []).some(s => /EV/.test(s));
  $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic" style="${ev ? "background:var(--green);color:#03140b" : ""}">${svg(ev ? I.bolt : I.wrench)}</div>
      <div><h3>${esc(p.name)}</h3><div class="meta">${x ? (x.drive && x.drive.m != null ? `${mi(x.drive.m/1000)} · ${mins(x.drive.s)} drive` : mi(x.d) + " away") + " · " : ""}${esc(p.note || (p.lat != null ? "Listed on Roadesy" : "Comes to you"))}</div></div></div>
    ${(p.services || []).length ? `<div class="sh-sec"><h5>Services</h5><div class="chips">${p.services.map(s => `<span>${esc(s)}</span>`).join("")}</div></div>` : ""}
    ${p.price ? `<div class="sh-sec"><h5>Price</h5><div class="kv">${esc(p.price)}</div></div>` : ""}
    ${p.coverage ? `<div class="sh-sec"><h5>Service area</h5><div class="kv">${esc(p.coverage)}</div></div>` : ""}
    ${(p.request || []).length ? `<div class="sh-sec"><h5>When you call</h5><ol class="steps">${p.request.map(r => `<li><span>${esc(r)}</span></li>`).join("")}</ol></div>` : ""}
    <div class="sh-sec"><h5>Details</h5><div class="kv">
      ${p.address ? esc(p.address) + "<br>" : ""}${p.hours ? "Hours: " + esc(p.hours) + "<br>" : ""}${tel ? "Phone: " + esc(p.phone) + "<br>" : ""}${p.site ? "Website: " + esc(p.site) : ""}</div></div>
    <div class="acts">
      <a class="act call ${tel ? "" : "dis"}" href="tel:${esc(tel)}">${svg(I.phone)}Call</a>
      ${x ? `<button class="act" data-goroute>${svg(I.nav)}Directions</button>` : ""}
    </div>
    <button class="btn ghost" data-close>Close</button>`;
  if (x) $("[data-goroute]").onclick = () => routeTo(x);
  openSheet();
}
function openPlace(x){
  if (!x) return;
  if (x.prov) return openProvider(x.prov, x);
  const t = x.tags || {}, fuel = t.amenity === "fuel", ev = t.amenity === "charging_station", b = fuel ? brandOf(x) : ev ? networkOf(x) : null;
  const {chips, extras, pay} = placeFacts(x);
  const tel = telNum(x.phone), web = t.website || t["contact:website"] || "";
  const p = (fuel||ev) ? priceOf(x.id, ev) : null, lo = lowest[t.amenity], low = p && lo != null && p.price <= lo;
  const gr = fuel ? gradesOf(x.id) : {}, noDsl = t["fuel:diesel"] === "no";
  const grades = GRADES.filter(([k]) => !(k === "dsl" && noDsl));
  const ic = ev ? I.bolt : fuel ? I.fuel : (CATS.find(c=>c.id===cat)||CATS[0]).icon;
  const unit = ev ? "/kWh" : "";
  $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic" style="${b?`background:${b[1]};color:${b[2]}`:ev?"background:var(--green);color:#03140b":""}">${svg(ic)}</div>
      <div><h3>${esc(x.name)}</h3><div class="meta">${x.drive&&x.drive.m!=null?`${mi(x.drive.m/1000)} · ${comesCat() ? "~" + mins(x.drive.s) + " to you" : mins(x.drive.s) + " drive"}`:mi(x.d)+" away"}${x.kind?" · "+esc(x.kind):""}${t.brand&&t.brand!==x.name?" · "+esc(t.brand):""}</div></div></div>
    ${fuel ? `<div class="sh-sec"><h5>Prices</h5>
      <div class="grades">${grades.map(([k, n]) => { const q = gr[k], l = k === pinGrade() && low;
        return `<div class="gr ${k === pinGrade() ? "mine" : ""}"><span>${n}</span><b class="${l ? "low" : ""}">${q ? "$" + q.price.toFixed(2) : "–"}</b><small>${q ? ago(q.at) : "not reported"}</small></div>`; }).join("")}</div>
      <form class="rep g" id="repForm"><select class="f" id="repGrade" aria-label="Fuel grade">${grades.map(([k, n]) => `<option value="${k}" ${k === pinGrade() ? "selected" : ""}>${n}</option>`).join("")}</select>
        <input id="repVal" type="number" inputmode="decimal" step="0.01" placeholder="e.g. 3.29"><button class="btn">Save</button></form>
      <div class="kv" style="font-size:12px;color:var(--muted);margin-top:6px">Prices reported on this phone. The map shows ${pinGrade() === "dsl" ? "diesel" : "regular"} to match My Car.</div></div>` : ""}
    ${ev ? `<div class="sh-sec"><h5>Price per kWh</h5>
      ${p ? `<div class="price"><b class="${low?"low":""}">$${p.price.toFixed(2)}${unit}</b><small>reported ${ago(p.at)} on this phone${low?" · lowest nearby":""}</small></div>`
          : t["ev:pricing"] ? `<div class="kv">Listed: ${esc(t["ev:pricing"])}</div>` : `<div class="kv">No price reported yet.</div>`}
      <form class="rep" id="repForm"><input id="repVal" type="number" inputmode="decimal" step="0.01" placeholder="${ev?"Report price per kWh, e.g. 0.48":"Report price, e.g. 3.29"}"><button class="btn">Save</button></form></div>` : ""}
    <div class="sh-sec"><h5>${ev?"Connectors":fuel?"Fuel types":"Services"}</h5><div class="chips">${chips.map(c=>`<span>${esc(c)}</span>`).join("")}</div></div>
    ${extras.length?`<div class="sh-sec"><h5>${ev?"Network & access":fuel?"Amenities":"Good to know"}</h5><div class="chips">${extras.map(c=>`<span>${esc(c)}</span>`).join("")}</div></div>`:""}
    ${comesCat() ? etaHTML(x) : ""}
    ${["shop","mobtire","plaza"].includes(cat) || ev ? towHTML(x) : ""}
    <div class="sh-sec"><h5>Details</h5><div class="kv">
      ${x.addr?esc(x.addr)+"<br>":""}${x.hours?"Hours: "+esc(x.hours)+"<br>":""}${tel?"Phone: "+esc(x.phone.split(/[;,]/)[0])+"<br>":""}
      ${pay.length?"Pays with: "+esc(pay.join(", "))+"<br>":""}${t.src==="afdc"?'<span style="color:var(--muted);font-size:12px">Charger data: U.S. DOE Alternative Fuels Data Center</span><br>':""}${t.src==="here"?'<span style="color:var(--muted);font-size:12px">Listing data © HERE</span><br>':""}${web?"Website: "+esc(web.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"")):""}
      ${!x.addr&&!x.hours&&!tel&&!web?"Not much is listed for this place yet — tap Directions to see the route.":""}</div></div>
    <div class="acts">
      <a class="act call ${tel?"":"dis"}" href="tel:${esc(tel)}">${svg(I.phone)}Call</a>
      <button class="act" data-goroute>${svg(I.nav)}Directions</button>
    </div>
    <button class="btn ghost" data-close>Close</button>`;
  $("[data-goroute]").onclick = () => routeTo(x);
  wireEta();
  const f = $("#repForm");
  if (f) f.onsubmit = e => {
    e.preventDefault();
    const v = parseFloat($("#repVal").value);
    if (ev ? !(v >= 0.05 && v <= 2) : !(v >= 1 && v <= 15)){ toast(ev ? "Enter a price like 0.48" : "Enter a price like 3.29"); return; }
    const val = Math.round(v*100)/100, now = Date.now();
    if (ev) prices[x.id] = {price:val, at:now, ev:true};
    else {
      const k = $("#repGrade").value, old = prices[x.id] || {};
      const g = Object.assign({}, old.g || {}); if (old.price && !g.reg && !old.ev) g.reg = {price:old.price, at:old.at};
      g[k] = {price:val, at:now};
      prices[x.id] = k === "reg" ? {price:val, at:now, g} : Object.assign({}, old, {g});
    }
    store.set("prices", prices);
    plot(shown, {lat:x.lat, lon:x.lon, fromMap:true}); openPlace(x); toast("Price saved");
  };
  openSheet();
}

function openSheet(){ $("#scrim").classList.add("on"); $("#sheet").classList.add("on"); }
function closeSheet(){ $("#scrim").classList.remove("on"); $("#sheet").classList.remove("on"); }
$("#scrim").onclick = closeSheet;
$("#sheet").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

/* ---------- in-app directions ---------- */
let routeLine = null, routeDest = null, follow = null;
function stepText(st){
  const m = st.maneuver || {}, road = st.name || st.ref || "", on = road ? ` onto ${road}` : "", mod = m.modifier || "";
  const turn = mod.includes("left") ? (mod.includes("slight") ? "Bear left" : mod.includes("sharp") ? "Sharp left" : "Turn left")
    : mod.includes("right") ? (mod.includes("slight") ? "Bear right" : mod.includes("sharp") ? "Sharp right" : "Turn right")
    : mod === "uturn" ? "Make a U-turn" : "Continue";
  switch (m.type){
    case "depart": return `Head out${road?" on "+road:""}`;
    case "arrive": return "Arrive at your destination";
    case "on ramp": return `Take the ramp${on}`;
    case "off ramp": return `Take the exit${road?" toward "+road:""}`;
    case "merge": return `Merge${on}`;
    case "fork": return `Keep ${mod.includes("left")?"left":"right"} at the fork${road?" toward "+road:""}`;
    case "roundabout": case "rotary": return `At the roundabout, take exit ${m.exit||1}${on}`;
    case "end of road": return `${turn} at the end of the road${on}`;
    default: return `${turn}${on}`;
  }
}
async function routeTo(x){
  if (!x) return;
  if (!pos){ toast("Turn on location for directions"); locate(); return; }
  if (!map){ toast("Map is still loading"); return; }
  $("#sheetBody").innerHTML = `<div class="spin"></div>`; openSheet();
  try{
    const j = await getRoute(pos, x);
    if (!j.routes || !j.routes[0]) throw 0;
    const rt = j.routes[0], pts = rt.geometry.coordinates.map(c=>[c[1],c[0]]);
    clearRoute(true);
    routeLine = L.polyline(pts, {color:"#ffb81c", weight:6, opacity:.95}).addTo(map);
    routeDest = x;
    map.fitBounds(routeLine.getBounds(), {padding:[30,30]});
    lastRoute = rt;
    driveCache.set(x.id, {s: rt.duration, m: rt.distance});
    const steps = rt.legs[0].steps.filter(st=>st.distance > 0 || st.maneuver.type==="arrive");
    $("#sheetBody").innerHTML = `
      <div class="sh-top"><div class="sh-ic">${svg(I.nav)}</div><div><h3>${esc(x.name)}</h3>
        <div class="meta">${mins(rt.duration)} · ${mi(rt.distance/1000)} by road</div></div></div>
      <div class="sh-sec"><h5>Route</h5><ol class="steps">${steps.map(st=>`<li><span>${esc(stepText(st))}</span><small>${st.distance>0?mi(st.distance/1000):""}</small></li>`).join("")}</ol></div>
      <div class="acts"><button class="act go" data-startnav>${svg(I.nav)}Start</button><a class="act call ${telNum(x.phone)?"":"dis"}" href="tel:${esc(telNum(x.phone))}">${svg(I.phone)}Call</a><button class="act" data-showroute>Map</button></div>
      <button class="btn ghost" data-clearroute>Clear route</button>`;
    $("[data-startnav]").onclick = () => { closeSheet(); track("nav"); startNav(x, rt); };
    $("[data-showroute]").onclick = () => { closeSheet(); setSheet("peek"); setTimeout(()=>map.invalidateSize(),300); };
    $("[data-clearroute]").onclick = () => { clearRoute(); closeSheet(); };
    if (navigator.geolocation && follow === null){   // keep the blue dot moving while a route is shown
      follow = navigator.geolocation.watchPosition(p=>{ pos = {lat:p.coords.latitude, lon:p.coords.longitude, acc:Math.round(p.coords.accuracy)}; store.set("pos",pos); showMe(pos); }, ()=>{}, {enableHighAccuracy:true, maximumAge:5000});
    }
  }catch{
    $("#sheetBody").innerHTML = `<div class="empty">Couldn't get a route right now (weak signal?).</div><button class="btn ghost" data-close>Close</button>`;
  }
}
let lastRoute = null;
async function getRoute(a, b){
  const r = await fetchT(`${OSRM}route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true`, 15000);
  return r.json();
}

/* ---------- turn-by-turn navigation (keeps guiding without signal once the route is loaded) ---------- */
let nav = null;
const ARROWS = {
  left:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/>',
  right:'<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v5"/>',
  straight:'<path d="M12 20V4M6 10l6-6 6 6"/>',
  uturn:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  arrive:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
};
const arrowFor = st => { const m = st.maneuver || {}, mod = m.modifier || ""; return m.type === "arrive" ? ARROWS.arrive : mod === "uturn" ? ARROWS.uturn : mod.includes("left") ? ARROWS.left : mod.includes("right") ? ARROWS.right : ARROWS.straight; };
const RE = 6371000, xy = (p, lat0) => [p[1]*Math.PI/180*RE*Math.cos(lat0*Math.PI/180), p[0]*Math.PI/180*RE];
function prepRoute(rt){
  const pts = rt.geometry.coordinates.map(c => [c[1], c[0]]), lat0 = pts[0][0], P = pts.map(p => xy(p, lat0)), cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i-1] + Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]));
  const steps = rt.legs[0].steps; let from = 0;
  const along = steps.map(st => {
    const q = xy([st.maneuver.location[1], st.maneuver.location[0]], lat0); let best = from, bd = Infinity;
    for (let i = from; i < P.length; i++){ const d = Math.hypot(P[i][0]-q[0], P[i][1]-q[1]); if (d < bd){ bd = d; best = i; } else if (d > bd + 3000) break; }
    from = best; return cum[best];
  });
  return {pts, P, cum, steps, along, lat0, total: rt.distance, dur: rt.duration, seg: 0};
}
function project(r, p){
  const q = xy(p, r.lat0);
  const scan = (s0, s1) => { let best = {d: Infinity, a: 0, seg: r.seg};
    for (let i = s0; i < s1; i++){ const A = r.P[i], B = r.P[i+1], vx = B[0]-A[0], vy = B[1]-A[1], L2 = vx*vx+vy*vy || 1;
      const t = Math.max(0, Math.min(1, ((q[0]-A[0])*vx + (q[1]-A[1])*vy)/L2)), x = A[0]+t*vx, yy = A[1]+t*vy, d = Math.hypot(q[0]-x, q[1]-yy);
      if (d < best.d) best = {d, a: r.cum[i] + t*Math.sqrt(L2), seg: i}; }
    return best; };
  let b = scan(Math.max(0, r.seg-10), Math.min(r.P.length-1, r.seg+80));
  if (b.d > 150) b = scan(0, r.P.length-1);
  return b;
}
const ftmi = m => m < 160 ? `${Math.max(50, Math.round(m*3.28084/50)*50)} ft` : mi(m/1000);
const spoken = m => m > 1200 ? `${(m/1609.34).toFixed(1)} miles` : m > 600 ? "half a mile" : m > 300 ? "a quarter mile" : `${Math.round(m*3.28084/100)*100 || 100} feet`;
function say(t){
  if (!nav || nav.muted || !("speechSynthesis" in window)) return;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; speechSynthesis.speak(u); }catch{}
}
async function wake(){ try{ if (nav && navigator.wakeLock) nav.wl = await navigator.wakeLock.request("screen"); }catch{} }
document.addEventListener("visibilitychange", () => { if (nav && document.visibilityState === "visible") wake(); });

function startNav(x, rt){
  if (follow !== null){ navigator.geolocation.clearWatch(follow); follow = null; }
  nav = {...prepRoute(rt), dest: x, said: {}, off: 0, rerouteAt: 0, muted: store.get("navMute", false), panUntil: 0, watch: null};
  $(".mapwrap").classList.add("nav"); $("#navTop").hidden = false; $("#navBot").hidden = false; $("#here").classList.remove("on");
  $("#nvMute").textContent = nav.muted ? "🔇" : "🔊";
  tab("find");
  $("#mf").classList.add("nav");
  setTimeout(() => { map.invalidateSize(); if (pos) map.setView([pos.lat, pos.lon], 16); }, 80);
  wake();
  const first = nav.steps.find((st, k) => k > 0) || nav.steps[0];
  say(`Starting route to ${x.name}. ${mins(rt.duration)}. ${stepText(first)}.`);
  if (pos) navUpdate({coords:{latitude: pos.lat, longitude: pos.lon, accuracy: pos.acc || 20}});
  if (nav && navigator.geolocation) nav.watch = navigator.geolocation.watchPosition(navUpdate, () => { if (nav) $("#nvText").textContent = "Waiting for GPS…"; }, {enableHighAccuracy:true, maximumAge:2000, timeout:20000});
}
function navUpdate(p){
  if (!nav) return;
  pos = {lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0)}; store.set("pos", pos); showMe(pos);
  const pr = project(nav, [pos.lat, pos.lon]); nav.seg = pr.seg;
  nav.off = (pr.d > 60 && pos.acc < 60) ? nav.off + 1 : 0;
  if (nav.off >= 3 && Date.now() - nav.rerouteAt > 15000) reroute();
  const a = pr.a, rem = Math.max(0, nav.total - a);
  let i = nav.steps.findIndex((st, k) => k > 0 && nav.along[k] > a + 8); if (i < 0) i = nav.steps.length - 1;
  const st = nav.steps[i], d = Math.max(0, nav.along[i] - a), txt = stepText(st);
  $("#nvIc").innerHTML = svg(arrowFor(st));
  $("#nvDist").textContent = ftmi(d);
  $("#nvText").textContent = nav.off >= 2 ? "Off route — finding a new one…" : txt;
  const left = nav.dur * (rem / (nav.total || 1));
  $("#nvEta").textContent = mins(left);
  $("#nvRem").textContent = `${mi(rem/1000)} · arrive ${new Date(Date.now() + left*1000).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}`;
  if (d < 420 && d > 130 && !nav.said[i+"f"]){ nav.said[i+"f"] = 1; say(`In ${spoken(d)}, ${txt.charAt(0).toLowerCase() + txt.slice(1)}`); }
  if (d <= 70 && !nav.said[i+"n"] && st.maneuver.type !== "arrive"){ nav.said[i+"n"] = 1; say(txt); }
  if (rem < 35 || (st.maneuver.type === "arrive" && d < 30)){ say(`You have arrived at ${nav.dest.name}`); const n = nav; endNav(); toast("You've arrived"); return; }
  if (Date.now() > nav.panUntil) map.setView([pos.lat, pos.lon], Math.max(map.getZoom(), 16));
}
async function reroute(){
  nav.rerouteAt = Date.now();
  try{
    const j = await getRoute(pos, nav.dest);
    if (!nav || !j.routes || !j.routes[0]) return;
    const rt = j.routes[0], keep = {dest: nav.dest, muted: nav.muted, watch: nav.watch, wl: nav.wl, panUntil: nav.panUntil, rerouteAt: nav.rerouteAt};
    nav = {...prepRoute(rt), ...keep, said: {}, off: 0};
    if (routeLine) routeLine.setLatLngs(nav.pts);
    say("Rerouting. " + stepText(nav.steps.find((st, k) => k > 0) || nav.steps[0]));
  }catch{ /* offline: keep guiding on the old route */ }
}
function endNav(){
  if (!nav) return;
  if (nav.watch !== null) navigator.geolocation.clearWatch(nav.watch);
  try{ nav.wl && nav.wl.release(); }catch{}
  nav = null;
  $(".mapwrap").classList.remove("nav"); $("#mf").classList.remove("nav"); $("#navTop").hidden = true; $("#navBot").hidden = true;
  clearRoute();
  setTimeout(() => map && map.invalidateSize(), 100);
}
$("#nvEnd").onclick = () => { try{ speechSynthesis.cancel(); }catch{} endNav(); };
$("#nvMute").onclick = () => { if (!nav) return; nav.muted = !nav.muted; store.set("navMute", nav.muted); $("#nvMute").textContent = nav.muted ? "🔇" : "🔊"; if (nav.muted) try{ speechSynthesis.cancel(); }catch{} };

/* ---------- offline map: save the map + listings around this spot ---------- */
const OFF_CACHE = "roadbudz-offline-v1";
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2**z);
const lat2y = (lat, z) => { const r = lat*Math.PI/180; return Math.floor((1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2 * 2**z); };
const tileURL = (z, x, y) => CFG.TILE_URL.replace("{s}", "a").replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{r}", "");
const boxOf = (c, rk) => { const dLat = rk/111, dLon = rk/(111*Math.cos(c.lat*Math.PI/180)); return {s: c.lat-dLat, n: c.lat+dLat, w: c.lon-dLon, e: c.lon+dLon}; };
function tilesFor(b, zMax){
  const out = [];
  for (let z = 8; z <= zMax; z++) for (let x = lon2x(b.w, z); x <= lon2x(b.e, z); x++) for (let yy = lat2y(b.n, z); yy <= lat2y(b.s, z); yy++) out.push(tileURL(z, x, yy));
  return out;
}
function offlinePlan(){
  const m = map ? map.getCenter() : null, c = m ? {lat: m.lat, lon: m.lng} : pos;
  if (!c) return null;
  const rk = radiusKm, b = boxOf(c, rk);
  let zMax = CFG.TILE_MAX_OFFLINE_ZOOM, urls = tilesFor(b, zMax);
  while (urls.length > CFG.TILE_MAX_OFFLINE && zMax > 11){ zMax--; urls = tilesFor(b, zMax); }
  return {c, rk, b, zMax, urls};
}
const offAreas = () => store.get("offAreas", []);
function offlineSheet(){
  if (!("caches" in window)){ toast("Offline maps need the app on HTTPS"); return; }
  const plan = offlinePlan(), areas = offAreas();
  $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic">${svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')}</div><div><h3>Offline map</h3><div class="meta">For dead zones and weak signal</div></div></div>
    <div class="sh-sec"><div class="kv">Saves the map and every listing within <b>${mi(radiusKm)}</b> of the middle of the map, so Roadesy works with no signal. Planning a new route still needs a connection; a route that's already started keeps guiding offline.</div></div>
    ${plan ? `<div class="sh-sec"><h5>This area</h5><div class="kv">About ${plan.urls.length.toLocaleString()} map tiles (~${Math.max(1, Math.round(plan.urls.length*14/1024))} MB), street detail to zoom ${plan.zMax}.</div></div>
      <div id="offProg" class="kv" style="margin-top:8px"></div>
      <button class="btn" id="offGo">Save this area</button>` : `<div class="empty">Map isn't ready yet.</div>`}
    ${areas.length ? `<div class="sh-sec"><h5>Saved areas</h5>${areas.map((a, i) => `<div class="saved"><div><b>${esc(a.name)}</b><small>${mi(a.rk)} around · ${a.n.toLocaleString()} tiles · ${new Date(a.t).toLocaleDateString()}</small></div><div style="display:flex;gap:6px"><button class="x" data-offgo="${i}">View</button><button class="x" data-offdel="${i}">Remove</button></div></div>`).join("")}</div>` : ""}
    <button class="btn ghost" data-close>Close</button>`;
  if (plan) $("#offGo").onclick = () => saveOffline(plan);
  $$("[data-offdel]").forEach(b => b.onclick = () => removeOffline(+b.dataset.offdel));
  $$("[data-offgo]").forEach(b => b.onclick = () => { const a = offAreas()[+b.dataset.offgo]; closeSheet(); map.setView([a.c.lat, a.c.lon], 12); load({lat: a.c.lat, lon: a.c.lon, fromMap: true}); });
  openSheet();
}
async function saveOffline(plan){
  const btn = $("#offGo"); btn.disabled = true; btn.textContent = "Saving…";
  try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch{}
  const cache = await caches.open(OFF_CACHE);
  let done = 0, bad = 0;
  const prog = t => { const el = $("#offProg"); if (el) el.textContent = t; };
  await runPool(plan.urls, async u => {
    try{
      if (!(await cache.match(u))){
        const r = await fetchT(u, 15000, {mode: "cors"});
        if (r.ok) await cache.put(u, r); else bad++;
      }
    }catch{ bad++; }
    if (++done % 15 === 0 || done === plan.urls.length) prog(`Map: ${done.toLocaleString()} / ${plan.urls.length.toLocaleString()} tiles`);
  }, 2);                                        // gentle on the free tile server
  prog("Saving listings for this area…");
  const cells = cellsAround(plan.c, plan.rk); let cd = 0;
  await runPool(cells, async k => { try{ await getCell(k); }catch{} prog(`Listings: ${++cd} / ${cells.length} areas`); }, (await proxyOn()) ? 4 : 2);
  if (wantsEV()) await evStations(plan.c, plan.rk);
  const nearMe = pos && km(pos, plan.c) < 3;
  const areas = offAreas();
  areas.push({name: nearMe ? $("#locText").textContent : `Map area (${plan.c.lat.toFixed(2)}, ${plan.c.lon.toFixed(2)})`, c: plan.c, rk: plan.rk, zMax: plan.zMax, n: plan.urls.length, t: Date.now()});
  store.set("offAreas", areas.slice(-5));
  toast(bad > plan.urls.length/4 ? "Saved partly — some map tiles didn't download" : "Area saved for offline use");
  offlineSheet();
}
async function removeOffline(i){
  const areas = offAreas(), a = areas.splice(i, 1)[0];
  if (a && "caches" in window){
    const keep = new Set(); areas.forEach(o => tilesFor(boxOf(o.c, o.rk), o.zMax).forEach(u => keep.add(u)));
    const cache = await caches.open(OFF_CACHE);
    await runPool(tilesFor(boxOf(a.c, a.rk), a.zMax).filter(u => !keep.has(u)), u => cache.delete(u), 8);
  }
  store.set("offAreas", areas); toast("Offline area removed"); offlineSheet();
}
$("#offlineBtn").onclick = offlineSheet;
addEventListener("offline", () => toast("You're offline — showing saved map and listings"));

function clearRoute(keepWatch){
  if (routeLine){ map.removeLayer(routeLine); routeLine = null; routeDest = null; }
  if (!keepWatch && follow !== null){ navigator.geolocation.clearWatch(follow); follow = null; }
}

/* ---------- emergency calls: step 1 tap, step 2 confirm ---------- */
function confirmCall(a){
  const num = decodeURIComponent(a.getAttribute("href").replace(/^tel:/,""));
  const is911 = num === "911";
  const s = STATES[stateCode];
  const who = is911 ? "Emergency services" : (s ? s.a : "Highway patrol");
  $("#sheetBody").innerHTML = `
    <div class="cf-who">Call ${esc(who)}?</div>
    <div class="cf-num">${esc(is911 ? "911" : (s && s.label ? `${s.label} (${num})` : num))}</div>
    <div class="cf-who">${is911 ? "Use for crashes, injuries, fire or danger." : esc(s && s.prog ? s.prog : "For breakdowns and help on the highway.")}</div>
    <div class="cf-tip">${$("#tell").innerHTML}</div>
    <div class="cf-acts"><button class="btn ghost" data-close>Cancel</button>
      <a class="btn ${is911?"red":""}" href="tel:${esc(num.replace(/#/g,"%23"))}" data-close>☎ Call ${esc(is911?"911":num)}</a></div>`;
  openSheet();
}
$$("[data-confirm]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); confirmCall(a); }));

async function autoDiagnose(){
  const el = $("#diagLine"); el.hidden = false; el.innerHTML = "Still loading — checking which listing servers answer…";
  const c = pos || {lat: map.getCenter().lat, lon: map.getCenter().lng}, cell = cellsAround(c, 1)[0], q = cellQuery(cell);
  const probe = async (label, fn) => { const t = performance.now(); try{ const r = await fn(); return `${label} ✓ ${((performance.now()-t)/1000).toFixed(1)}s${r ? " " + r : ""}`; }catch(e){ return `${label} ✗ ${e && e.name === "AbortError" ? "no answer" : (e && e.message) || "no answer"}`; } };
  const parts = await Promise.all([
    probe("Your server", async () => { if (!(await proxyOn())) throw new Error("not installed"); const r = await fetchT(`api/places.php?cell=${cell}`, 25000); if (!r.ok) throw new Error("HTTP " + r.status); return ""; }),
    ...OVERPASS.map(u => probe(new URL(u).hostname.replace(/^(overpass\.|maps\.)/, ""), async () => { const r = await fetchT(u, 15000, {method:"POST", body:"data=" + encodeURIComponent(q)}); if (!r.ok) throw new Error("HTTP " + r.status); await r.json(); return ""; }))
  ]);
  el.innerHTML = `<b>Listing servers right now:</b> ${parts.map(esc).join(" · ")}<br><button class="lnk" data-check>Full connection check</button>`;
}
$("#diagLine").addEventListener("click", e => { if (e.target.closest("[data-check]")) connCheck(); });

/* ---------- connection check: shows exactly which piece isn't working ---------- */
async function connCheck(){
  const rows = [], c = pos || (map ? {lat: map.getCenter().lat, lon: map.getCenter().lng} : {lat: 25.9, lon: -80.25});
  const paint = (done) => { $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic">${svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>')}</div><div><h3>Connection check</h3><div class="meta">Roadesy v${RB_VERSION} · ${done ? "Done — tap Copy to send the results" : "Checking…"}</div></div></div>
    <div class="chk">${rows.map(r => `<div class="ck ${r.ok === true ? "ok" : r.ok === false ? "bad" : ""}"><b>${r.ok === true ? "✓" : r.ok === false ? "✗" : "…"}</b><div><span>${esc(r.name)}</span><small>${esc(r.info || "")}</small></div></div>`).join("")}</div>
    ${done ? `<button class="btn" id="ckCopy">Copy results</button>` : `<div class="spin"></div>`}
    <button class="btn ghost" data-close>Close</button>`;
    const cp = $("#ckCopy"); if (cp) cp.onclick = async () => { const t = "Roadesy v" + RB_VERSION + " connection check " + new Date().toLocaleString() + "\n" + rows.map(r => `${r.ok ? "OK " : "FAIL"} ${r.name}: ${r.info}`).join("\n"); try{ await navigator.clipboard.writeText(t); toast("Copied"); }catch{ toast("Copy unavailable"); } };
  };
  openSheet();
  const test = async (name, fn) => { const r = {name, info: ""}; rows.push(r); paint(false); const t0 = performance.now();
    try{ const info = await fn(); r.ok = true; r.info = `${info || "ok"} · ${Math.round(performance.now() - t0)} ms`; }
    catch(e){ r.ok = false; r.info = `${e && e.name === "AbortError" ? "no answer (timed out)" : (e && e.message) || e || "failed"} · ${Math.round(performance.now() - t0)} ms`; }
    paint(false); };
  await test("Location", async () => {
    let st = "unknown"; try{ st = (await navigator.permissions.query({name: "geolocation"})).state; }catch{}
    if (!pos) throw new Error(`no fix yet (permission: ${st})`);
    const age = Math.round((Date.now() - (store.get("posAt", 0) || Date.now()))/60000);
    return `${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)} ±${pos.acc || "?"} m, ${age} min old (permission: ${st})`;
  });
  await test("Internet", async () => { if (!navigator.onLine) throw new Error("phone says offline"); return "online"; });
  await test("Map library", async () => { if (!window.L) throw new Error("didn't load"); return "loaded"; });
  await test("Map tiles", async () => {
    const z = 12, u = CFG.TILE_URL.replace("{s}","a").replace("{z}", z).replace("{x}", lon2x(c.lon, z)).replace("{y}", lat2y(c.lat, z)).replace("{r}","");
    const r = await fetchT(u, 10000, {mode: "cors", cache: "no-store"}); if (!r.ok) throw new Error("HTTP " + r.status); return "HTTP " + r.status;
  });
  const cell = cellsAround(c, 1)[0];
  await test("Your server cache (api/)", async () => {
    let j; try{ j = await (await fetchT("api/ping.php", 6000, {cache: "no-store"})).json(); }catch{ throw new Error("not installed or not running PHP"); }
    if (!j.ok) throw new Error("unexpected reply");
    const r = await fetchT(`api/places.php?cell=${cell}`, 30000, {cache: "no-store"});
    if (!r.ok){ let m = ""; try{ m = (await r.json()).error; }catch{} throw new Error(`ping ok, listings HTTP ${r.status}${m ? " " + m : ""}`); }
    const n = ((await r.json()).elements || []).length; return `ping ok, ${n} listings in your area${r.headers.get("X-RB-Stale") ? " (old copy)" : ""}`;
  });
  await test("Business listings (HERE)", async () => {
    if (!(await proxyOn())) throw new Error("needs the api/ folder on your server");
    if (!pingInfo.here) throw new Error("HERE_KEY not set in api/keys.php");
    const r = await fetchT(`api/here.php?cat=tow&lat=${c.lat}&lon=${c.lon}&r=24000`, 15000, {cache: "no-store"});
    if (!r.ok){ let m = ""; try{ m = (await r.json()).error; }catch{} throw new Error(`HTTP ${r.status} ${m}`); }
    return `${((await r.json()).items || []).length} towing/roadside businesses nearby`;
  });
  const q = cellQuery(cell);
  for (const u of OVERPASS) await test("Listings · " + new URL(u).hostname, async () => {
    const r = await fetchT(u, 15000, {method: "POST", body: "data=" + encodeURIComponent(q)});
    if (!r.ok) throw new Error("HTTP " + r.status + (r.status === 406 ? " (refused this browser)" : r.status === 429 ? " (busy / too many requests)" : ""));
    const j = await r.json(); if (j.remark) throw new Error(j.remark.slice(0, 80)); return `${j.elements.length} listings`;
  });
  await test("Backup search (OpenStreetMap)", async () => {
    const r = await fetchT(`${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent("[fuel]")}&viewbox=${c.lon-0.1},${c.lat+0.1},${c.lon+0.1},${c.lat-0.1}&bounded=1&limit=5`, 10000);
    if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); return `${j.length} gas stations nearby`;
  });
  await test("Directions (OSRM)", async () => {
    const j = await (await fetchT(`${OSRM}route/v1/driving/${c.lon},${c.lat};${c.lon + 0.01},${c.lat + 0.01}?overview=false`, 10000)).json();
    if (j.code !== "Ok") throw new Error(j.code || "no route"); return "ok";
  });
  if (wantsEV()) await test("EV chargers (U.S. DOE)", async () => { const l = await evStations(c, 16); if (!l.length) throw new Error("no stations returned"); return `${l.length} stations`; });
  paint(true);
}
$("#connCheck").onclick = connCheck;

/* ---------- List your business (in-app form → your server) ---------- */
const BIZ_TYPES = [["tow","Towing"],["roadside","Roadside service"],["mobmech","Mobile mechanic"],["mobtire","Mobile tire service"],["lock","Mobile locksmith"],["mobev","Mobile EV charging"],["shop","Repair shop"],["plaza","Fuel / service plaza"]];
function bizSheet(){
  $("#sheetBody").innerHTML = `
    <div class="sh-top"><div class="sh-ic">${svg(I.wrench)}</div><div><h3>List your business</h3><div class="meta">Free · reviewed before it shows in Roadesy</div></div></div>
    <form id="bizForm" autocomplete="on">
      <label>Business name</label><input name="name" required maxlength="120" placeholder="Joe's Towing & Recovery">
      <label>Type</label><select class="f" name="type">${BIZ_TYPES.map(([v,t]) => `<option value="${v}">${t}</option>`).join("")}</select>
      <label>Phone customers should call</label><input name="phone" type="tel" required maxlength="40" placeholder="305-555-0100">
      <label>Service area</label><input name="area" maxlength="300" placeholder="Miami-Dade & Broward, I-95 from Exit 1 to 32">
      <label>Hours</label><input name="hours" maxlength="120" placeholder="24/7">
      <label>Services</label><input name="services" maxlength="500" placeholder="Flatbed, lockouts, jump starts, EV-safe towing">
      <label>Your name &amp; email (not shown publicly)</label><input name="contact" maxlength="160" placeholder="Joe Smith · joe@example.com">
      <input name="website_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" name="here" style="width:auto"> My business is at my current location</label>
      <button class="btn" id="bizGo">Send request</button>
    </form>
    <button class="btn ghost" data-close>Cancel</button>`;
  $("#bizForm").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    if (f.here && pos){ f.lat = pos.lat; f.lon = pos.lon; } delete f.here;
    if (!f.name.trim() || (f.phone.replace(/\D/g, "").length < 7)){ toast("Add the business name and a phone number"); return; }
    $("#bizGo").disabled = true; $("#bizGo").textContent = "Sending…";
    const sent = await sendBiz(f); track("listing");
    if (!sent){ const q = store.get("bizQueue", []); q.push(f); store.set("bizQueue", q); }
    $("#sheetBody").innerHTML = `<div class="sh-top"><div class="sh-ic" style="background:var(--green);color:#03140b">${svg('<path d="M5 12l5 5L20 7"/>')}</div><div><h3>${sent ? "Request received" : "Saved — will send when you're online"}</h3><div class="meta">${esc(f.name)}</div></div></div>
      <div class="sh-sec"><div class="kv">We review every business before it appears in Roadesy. Once approved it shows on the map and in the matching category for drivers nearby.</div></div>
      <button class="btn ghost" data-close>Done</button>`;
  };
  openSheet();
}
async function sendBiz(f){
  if (!navigator.onLine || !(await proxyOn())) return false;
  try{ const r = await fetchT("api/listing.php", 15000, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(f)}); return r.ok; }catch{ return false; }
}
async function flushBiz(){
  const q = store.get("bizQueue", []); if (!q.length) return;
  const left = []; for (const f of q) if (!(await sendBiz(f))) left.push(f);
  store.set("bizQueue", left);
}
$("#listBiz").onclick = bizSheet;
addEventListener("online", flushBiz); setTimeout(flushBiz, 5000);

/* ---------- anonymous usage numbers: no account, no name, no exact location ---------- */
const UID = (() => { let u = store.get("uid", null);
  if (!u){ u = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12); store.set("uid", u); }
  return u; })();
const evq = store.get("evq", {});
function track(name){ evq[name] = (evq[name] || 0) + 1; store.set("evq", evq); }
async function sendStats(force){
  const day = new Date().toISOString().slice(0, 10);
  if (!force && store.get("statsDay", "") === day && !Object.keys(evq).length) return;
  if (!navigator.onLine || !(await proxyOn())) return;
  const body = JSON.stringify({uid: UID, v: RB_VERSION, installed: standalone ? 1 : 0, state: stateCode || "", ev: evq});
  let ok = false;
  try{
    if (navigator.sendBeacon) ok = navigator.sendBeacon("api/stats.php", new Blob([body], {type: "application/json"}));
    else ok = (await fetch("api/stats.php", {method: "POST", body, keepalive: true})).ok;
  }catch{}
  if (ok){ for (const k in evq) delete evq[k]; store.set("evq", evq); store.set("statsDay", day); }
}
setTimeout(() => sendStats(), 6000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && Object.keys(evq).length) sendStats(true); });
document.addEventListener("click", e => {
  const a = e.target.closest("a[href^='tel:']"); if (a) track(a.id === "pCall" ? "call_patrol" : a.id === "p911" ? "call_911" : "call");
  if (e.target.closest("#sosBtn")) track("sos");
  if (e.target.closest("[data-goroute],[data-route]")) track("dir");
  if (e.target.closest("#shareLoc")) track("share");
  if (e.target.closest("#offGo")) track("offline");
  if (e.target.closest("#donateBtn")) track("donate");
  const ct = e.target.closest(".cat[data-c]"); if (ct) track("cat:" + ct.dataset.c);
}, true);
addEventListener("appinstalled", () => track("install"));

/* ---------- donations (you set the link in config.js) ---------- */
(() => {
  const d = CFG.DONATE || {}, card = $("#donateCard");
  // Google Play limits donation links to developers; hidden inside the Play Store app unless you turn it on
  const fromPlay = document.referrer.startsWith("android-app://") || sessionStorage.getItem("rb_twa") === "1";
  if (fromPlay) try{ sessionStorage.setItem("rb_twa", "1"); }catch{}
  if (!d.url || (fromPlay && !d.showInPlayStore)) return;
  card.hidden = false;
  $("#donateBtn").textContent = d.label || "Donate";
  $("#donateBtn").onclick = () => window.open(d.url, "_blank", "noopener");
})();

/* tow rates for estimates */
(() => { const r = store.get("towRates", {}); $("#towHook").value = r.hook ?? ""; $("#towMile").value = r.mile ?? "";
  const save = () => store.set("towRates", {hook: $("#towHook").value.trim(), mile: $("#towMile").value.trim()});
  $("#towHook").onchange = save; $("#towMile").onchange = save; })();

/* ---------- boot ---------- */
$("#radiusLbl").textContent = "On the map below";
renderPatrol(); markCat();
document.body.classList.add("findv"); measure();
if (($("#q").value || $("#area").value)) $("#searchForm").hidden = false;
ensureMap(pos ? {...pos, z: 13} : {lat: 39.5, lon: -98.35, z: 4});  // centered on you (last known spot until GPS answers)
if (pos){ viewAt(pos.lat, pos.lon, 13); showMe(pos); load(null, true); }                         // saved listings show instantly, even offline
if (["car","safe"].includes(urlP.get("tab"))) tab(urlP.get("tab"));
// Home-screen shortcut "Call Highway Patrol" → dial immediately
if (urlP.has("patrol")) setTimeout(openSOS, 900);
// hooks for Roadesy Pro (pro-live.js): real providers on duty near the driver
window.RBX = {get map(){ return map; }, get pos(){ return pos; }, get cat(){ return cat; }, get radiusKm(){ return radiusKm; },
  car: () => store.get("car", {}), svg, I, CATS, COMES, mi, km, toast, viewAt, setSheet, sheetPx, sideList, esc};
setTimeout(()=>$("#splash").classList.add("out"), 1100);
locate();
})();
