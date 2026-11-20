/* Roadesy Pro — provider app (pro.roadesy.com). Talks to roadesy.com/api/pro.php. */
(() => {
const VERSION = "2";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + (Math.round(n * 100) % 100 ? (+n).toFixed(2) : Math.round(n));
const mi = km => (km / 1.609).toFixed(km / 1.609 < 10 ? 1 : 0) + " mi";
const store = {get: (k, d) => { try{ const v = localStorage.getItem("rbpro_" + k); return v ? JSON.parse(v) : d; }catch{ return d; } },
  set: (k, v) => { try{ v == null ? localStorage.removeItem("rbpro_" + k) : localStorage.setItem("rbpro_" + k, JSON.stringify(v)); }catch{} }};
let tt; const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); };
$("#ver").textContent = "v" + VERSION;

/* The API lives on the main site: pro.roadesy.com → roadesy.com/api/pro.php (a test address can be set only on localhost) */
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (local){ const o = new URLSearchParams(location.search).get("api"); if (o) store.set("api", o); const s = store.get("api"); if (s) return s; }
  return location.protocol + "//" + location.host.replace(/^pro\./, "") + "/api/pro.php";
})();
let token = store.get("token", null), me = store.get("me", null), S = store.get("services", null);

async function api(a, body, opts = {}){
  const r = await fetch(API + "?a=" + a, {method: body ? "POST" : "GET", headers: Object.assign({"Content-Type": "application/json"}, token ? {Authorization: "Bearer " + token} : {}),
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: opts.signal});
  let j = {}; try{ j = await r.json(); }catch{}
  if (r.status === 401 && token && a !== "login"){ signOut(true); throw new Error(j.error || "Please sign in again."); }
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}
const err = (el, m) => { const e = $(el); e.textContent = m || ""; e.hidden = !m; };
function busyBtn(b, on, label){ if (on){ b.dataset.l = b.innerHTML; b.innerHTML = `<span class="spin"></span>`; b.disabled = true; } else { b.innerHTML = label || b.dataset.l || b.innerHTML; b.disabled = false; } }

/* ---------- views ---------- */
let view = "";
function show(v){
  view = v;
  ["Auth", "Signup", "Pending", "Jobs", "Prices", "Profile"].forEach(n => $("#v" + n).hidden = n !== v);
  const tabbed = ["Jobs", "Prices", "Profile"].includes(v);
  $("#tabs").hidden = !tabbed; $("#main").classList.toggle("noTabs", !tabbed);
  $$("nav.tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === v));
  if (v === "Prices") renderPrices(); if (v === "Profile") renderProfile(); if (v === "Jobs") renderJobsHead();
  scrollTo(0, 0);
}
$$("nav.tabs button").forEach(b => b.onclick = () => show(b.dataset.tab));
function route(){
  if (!token){ show("Auth"); return; }
  if (!me){ show("Auth"); return; }
  if (me.status === "active"){ if (!["Jobs", "Prices", "Profile"].includes(view)) show("Jobs"); startPolling(); setTimeout(poll, 0); }
  else { stopDuty(true); show("Pending"); renderPending(); }
}
function setMe(m){ me = m; store.set("me", m); }
function signOut(expired){
  if (!expired && token) api("logout", {}).catch(() => {});
  stopDuty(true); token = null; me = null; store.set("token", null); store.set("me", null); clearInterval(pollT); pollT = null;
  show("Auth"); if (expired) toast("Please sign in again");
}

/* ---------- services list (cached for offline) ---------- */
async function loadServices(){ try{ const j = await api("services"); S = j.services; store.set("services", S); }catch{} return S; }

/* ---------- sign in / reset ---------- */
$$("[data-auth]").forEach(b => b.onclick = () => {
  $$("[data-auth]").forEach(x => x.classList.toggle("on", x === b));
  if (b.dataset.auth === "up") startWizard("new"); else { $("#fIn").hidden = false; $("#fReset").hidden = true; }
});
$("#fIn").onsubmit = async e => {
  e.preventDefault(); const b = e.submitter || $("#fIn button[type=submit]"); err("#inErr"); busyBtn(b, true);
  try{ const j = await api("login", {email: $("#inEmail").value.trim(), password: $("#inPw").value}); token = j.token; store.set("token", token); setMe(j.me); $("#inPw").value = ""; route(); }
  catch(x){ err("#inErr", x.message); }
  busyBtn(b, false);
};
$("#forgotBtn").onclick = () => { $("#fIn").hidden = true; $("#fReset").hidden = false; $("#rsEmail").value = $("#inEmail").value; $("#rsStep2").hidden = true; $("#rsBtn").textContent = "Email me a code"; err("#rsErr"); };
$("#rsBack").onclick = () => { $("#fIn").hidden = false; $("#fReset").hidden = true; };
$("#fReset").onsubmit = async e => {
  e.preventDefault(); const b = $("#rsBtn"); err("#rsErr"); busyBtn(b, true);
  try{
    if ($("#rsStep2").hidden){
      await api("forgot", {email: $("#rsEmail").value.trim()});
      $("#rsStep2").hidden = false; $("#resetSub").textContent = "If that email has an account, a code is on its way. Check spam too."; busyBtn(b, false, "Set new password"); return;
    }
    const j = await api("reset", {email: $("#rsEmail").value.trim(), code: $("#rsCode").value.trim(), password: $("#rsPw").value});
    token = j.token; store.set("token", token); setMe(j.me); toast("Password changed"); route();
  }catch(x){ err("#rsErr", x.message); }
  busyBtn(b, false);
};

/* ---------- sign-up wizard / edit profile ---------- */
let wiz = {mode: "new", step: 1, back: "Auth", data: null}, areaMap = null, areaMk = null, areaCircle = null;
function blankProfile(){ return {biz: "", contact: "", phone: "", hours: "", about: "", types: [], rates: {}, base: null, radiusMi: 15, vehicle: {desc: "", plate: ""}, license: "", insurance: ""}; }
async function startWizard(mode){
  if (!S) await loadServices();
  if (!S){ toast("Connect to the internet to continue"); return; }
  wiz = {mode, step: 1, back: mode === "new" ? "Auth" : view, data: mode === "new" ? blankProfile() : JSON.parse(JSON.stringify(me))};
  const d = wiz.data;
  $("#suTitle").textContent = mode === "new" ? "Create your Pro account" : "Edit your details";
  $("#suSub").textContent = mode === "new" ? "3 quick steps. We check your license and insurance before you go live." : "Changes show to drivers right away.";
  $("#acctBox").hidden = mode !== "new"; $("#agreeRow").hidden = mode !== "new";
  $("#uBiz").value = d.biz || ""; $("#uContact").value = d.contact || ""; $("#uPhone").value = d.phone || ""; $("#uHours").value = d.hours || ""; $("#uAbout").value = d.about || "";
  $("#uBase").value = (d.base && d.base.label) || ""; $("#uRadius").value = d.radiusMi || 15; $("#uRadLbl").textContent = (d.radiusMi || 15) + " mi";
  $("#uVeh").value = (d.vehicle && d.vehicle.desc) || ""; $("#uPlate").value = (d.vehicle && d.vehicle.plate) || "";
  $("#uLic").value = d.license || ""; $("#uIns").value = d.insurance || "";
  renderTypes(); show("Signup"); wizStep(1);
}
function wizStep(n){
  wiz.step = n;
  $$("#fUp [data-step]").forEach(s => s.hidden = +s.dataset.step !== n);
  $$("#suSteps i").forEach((x, i) => x.classList.toggle("on", i < n));
  $("#suNext").textContent = n < 3 ? "Next" : wiz.mode === "new" ? "Create account" : "Save changes";
  $("#suBack").textContent = n === 1 ? (wiz.mode === "new" ? "Cancel" : "Cancel") : "Back";
  err("#upErr");
  if (n === 3) setTimeout(initAreaMap, 50);
  scrollTo(0, 0);
}
function renderTypes(){
  const d = wiz.data;
  $("#uTypes").innerHTML = Object.entries(S).map(([k, t]) => `<label class="svcT"><input type="checkbox" value="${k}" ${d.types.includes(k) ? "checked" : ""}><b>${esc(t.label)}</b></label>`).join("");
  $("#uTypes").onchange = () => { collectRates("#uRates", d); d.types = $$("#uTypes input:checked").map(i => i.value); renderRates("#uRates", d); };
  renderRates("#uRates", d);
}
function ratesFor(d, t){ return (d.rates && d.rates[t]) || S[t].svcs.map(s => [true, s[1]]); }
function renderRates(sel, d){
  $(sel).innerHTML = d.types.map(t => `<div class="card" data-t="${t}"><h3>${esc(S[t].label)} prices</h3>
    <div class="sub">Untick anything you don't do.</div>
    ${S[t].svcs.map((s, i) => { const r = ratesFor(d, t)[i] || [true, s[1]];
      return `<div class="rate"><input type="checkbox" data-i="${i}" ${r[0] ? "checked" : ""} aria-label="Offer ${esc(s[0])}"><span>${esc(s[0])}${s[2] === "addon" ? `<br><small>add-on, shown with your prices</small>` : ""}</span>
        <span class="money">$<input inputmode="decimal" data-p="${i}" value="${r[1]}" aria-label="${esc(s[0])} price"></span></div>`; }).join("")}</div>`).join("");
}
function collectRates(sel, d){
  $$(sel + " [data-t]").forEach(c => { const t = c.dataset.t;
    d.rates[t] = S[t].svcs.map((s, i) => { const p = parseFloat(c.querySelector(`[data-p="${i}"]`).value); return [c.querySelector(`[data-i="${i}"]`).checked, p >= 0 ? p : s[1]]; }); });
}
function initAreaMap(){
  if (!window.L) { $("#areaMap").innerHTML = `<div class="small" style="padding:14px">The map needs a connection. You can still use your current location.</div>`; return; }
  const d = wiz.data, c = d.base || store.get("lastFix") || {lat: 25.9, lon: -80.25};
  if (!areaMap){
    areaMap = L.map("areaMap", {zoomControl: true, attributionControl: false}).setView([c.lat, c.lon], d.base ? 11 : 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19}).addTo(areaMap);
    areaMap.on("click", e => setBase(e.latlng.lat, e.latlng.lng));
  } else { areaMap.invalidateSize(); areaMap.setView([c.lat, c.lon], areaMap.getZoom()); }
  drawArea();
}
function setBase(lat, lon){ wiz.data.base = Object.assign({}, wiz.data.base || {}, {lat: +lat.toFixed(6), lon: +lon.toFixed(6)}); drawArea(true); }
function drawArea(fit){
  const d = wiz.data; if (!areaMap || !d.base) return;
  const ll = [d.base.lat, d.base.lon], r = (+$("#uRadius").value) * 1609;
  const ic = L.divIcon({className: "", html: `<div class="mk me">🛻</div>`, iconSize: [30, 30], iconAnchor: [15, 15]});
  areaMk ? areaMk.setLatLng(ll) : areaMk = L.marker(ll, {icon: ic}).addTo(areaMap);
  areaCircle ? (areaCircle.setLatLng(ll), areaCircle.setRadius(r)) : areaCircle = L.circle(ll, {radius: r, color: "#9d7bff", weight: 2, fillOpacity: .08}).addTo(areaMap);
  if (fit) try{ areaMap.fitBounds(areaCircle.getBounds(), {padding: [10, 10]}); }catch{}
}
$("#uRadius").oninput = () => { $("#uRadLbl").textContent = $("#uRadius").value + " mi"; drawArea(); };
$("#uRadius").onchange = () => drawArea(true);
$("#useLoc").onclick = () => {
  const b = $("#useLoc"); busyBtn(b, true);
  navigator.geolocation.getCurrentPosition(g => { busyBtn(b, false); store.set("lastFix", {lat: g.coords.latitude, lon: g.coords.longitude}); setBase(g.coords.latitude, g.coords.longitude); },
    () => { busyBtn(b, false); toast("Couldn't get your location. Tap the map instead."); }, {enableHighAccuracy: true, timeout: 12000});
};
$("#suBack").onclick = () => { if (wiz.step > 1) wizStep(wiz.step - 1); else { show(wiz.back); if (wiz.back === "Pending") renderPending(); } };
$("#fUp").onsubmit = async e => {
  e.preventDefault(); err("#upErr");
  const d = wiz.data, digits = s => s.replace(/\D/g, "").length;
  if (wiz.step === 1){
    Object.assign(d, {biz: $("#uBiz").value.trim(), contact: $("#uContact").value.trim(), phone: $("#uPhone").value.trim(), hours: $("#uHours").value.trim(), about: $("#uAbout").value.trim()});
    if (!d.biz) return err("#upErr", "Add your business name.");
    if (digits(d.phone) < 10) return err("#upErr", "Add a phone number customers can call (10 digits).");
    if (wiz.mode === "new"){
      if (!/^\S+@\S+\.\S+$/.test($("#uEmail").value.trim())) return err("#upErr", "Add a valid email.");
      if ($("#uPw").value.length < 8) return err("#upErr", "Use a password with at least 8 characters.");
    }
    return wizStep(2);
  }
  if (wiz.step === 2){
    collectRates("#uRates", d); d.types = $$("#uTypes input:checked").map(i => i.value);
    if (!d.types.length) return err("#upErr", "Pick at least one service you offer.");
    return wizStep(3);
  }
  if (!d.base) return err("#upErr", "Set your base: tap \"Use my current location\" or tap the map.");
  if (wiz.mode === "new" && !$("#uAgree").checked) return err("#upErr", "Tick the box to confirm you're licensed and insured.");
  d.base.label = $("#uBase").value.trim(); d.radiusMi = +$("#uRadius").value;
  d.vehicle = {desc: $("#uVeh").value.trim(), plate: $("#uPlate").value.trim()}; d.license = $("#uLic").value.trim(); d.insurance = $("#uIns").value.trim();
  const b = $("#suNext"); busyBtn(b, true);
  try{
    if (wiz.mode === "new"){
      const j = await api("signup", Object.assign({}, d, {email: $("#uEmail").value.trim(), password: $("#uPw").value}));
      token = j.token; store.set("token", token); setMe(j.me); $("#uPw").value = ""; route();
    } else {
      const j = await api("save", d); setMe(j.me); toast("Saved"); show(wiz.back); if (wiz.back === "Pending") renderPending();
    }
  }catch(x){ err("#upErr", x.message); }
  busyBtn(b, false);
};

/* ---------- waiting for approval ---------- */
let pendT = null;
function renderPending(){
  const sus = me && me.status === "suspended";
  $("#pdTitle").textContent = sus ? "Your account is paused" : "Thanks, we're reviewing your account";
  $("#pdSub").textContent = sus ? "You can't go on duty right now. Contact Roadesy if you think this is a mistake." :
    "We check your license and insurance, usually within a day. You'll get an email when you're approved, and this screen updates on its own.";
  clearInterval(pendT);
  pendT = setInterval(async () => { if (view !== "Pending") return clearInterval(pendT); try{ const j = await api("me"); setMe(j.me); if (j.me.status === "active"){ clearInterval(pendT); toast("You're approved!"); route(); } }catch{} }, 30000);
}
$("#pdEdit").onclick = () => startWizard("edit");
$("#pdOut").onclick = () => signOut();

/* ---------- on duty: location, polling, requests ---------- */
let watchId = null, fix = null, lastSent = 0, wake = null, pollT = null, polling = false, offers = [], seen = new Set(), job = null, lastJobId = null, deadlines = {};
function renderJobsHead(){
  if (!me) return;
  $("#jBiz").textContent = me.biz; $("#jSub").textContent = (me.types || []).map(t => S && S[t] ? S[t].label : t).join(" · ") + (me.base && me.base.label ? " · " + me.base.label : "");
  $("#duty").checked = !!me.duty; $("#live").checked = me.live !== false;
  $("#stRate").textContent = me.ratingAvg ? "★ " + me.ratingAvg : "–";
  locStatus(); renderReqs(); renderJob();
}
function locStatus(){
  const s = $("#locStatus");
  if (!me || !me.duty){ s.innerHTML = `<span class="dot"></span><span>Off duty. Drivers can't see or book you.</span>`; return; }
  if (job && ["onway", "arrived", "assigned"].includes(job.state) && me.live !== false){ s.innerHTML = `<span class="dot live"></span><span>On a job · sharing your exact location every 15 sec with ${esc(job.name || "the customer")}</span>`; return; }
  if (me.live === false){ s.innerHTML = `<span class="dot on"></span><span>On duty · drivers see your base${me.base && me.base.label ? " (" + esc(me.base.label) + ")" : ""}, not a live truck</span>`; return; }
  if (!fix){ s.innerHTML = `<span class="dot on"></span><span>On duty · waiting for your location… allow location for this app</span>`; return; }
  if (!lastSent){ s.innerHTML = `<span class="dot live"></span><span>Live · sending your location…</span>`; return; }
  const ago = Math.floor((Date.now() - lastSent) / 60000);
  s.innerHTML = `<span class="dot live"></span><span>Live · location sent ${ago < 1 ? "just now" : ago + " min ago"} · next in ${Math.max(0, 5 - ago)} min</span>`;
}
function startWatch(){
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(g => { fix = {lat: +g.coords.latitude.toFixed(6), lon: +g.coords.longitude.toFixed(6)}; store.set("lastFix", fix); },
    () => {}, {enableHighAccuracy: true, maximumAge: 10000, timeout: 30000});
}
function stopWatch(){ if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; }
async function keepAwake(){ try{ if ("wakeLock" in navigator && !wake && me && me.duty && document.visibilityState === "visible"){ wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => wake = null); } }catch{} }
document.addEventListener("visibilitychange", () => { keepAwake(); if (document.visibilityState === "visible") poll(); });
function stopDuty(local){ stopWatch(); try{ wake && wake.release(); }catch{} wake = null; if (local && me) me.duty = false; }

$("#duty").onchange = async () => {
  const on = $("#duty").checked;
  try{
    if (on){ startWatch(); try{ if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }catch{} }
    const j = await api("duty", Object.assign({on}, fix ? {loc: fix} : {})); setMe(j.me); if (fix) lastSent = Date.now();
    if (on){ keepAwake(); toast("You're on duty. Keep this app open to get requests."); } else { stopDuty(); offers = []; toast("Off duty. Drivers can't see you."); }
    renderJobsHead(); startPolling(); poll();
  }catch(x){ $("#duty").checked = !on; toast(x.message); if (on) stopWatch(); }
};
$("#live").onchange = async () => {
  const live = $("#live").checked;
  try{ const j = await api("duty", {live}); setMe(j.me); locStatus(); toast(live ? "Live location on" : "Live location off — drivers see your base"); }
  catch(x){ $("#live").checked = !live; toast(x.message); }
};

function startPolling(){
  clearInterval(pollT);
  pollT = setInterval(poll, me && me.duty ? 5000 : 30000);
  if (me && me.duty){ startWatch(); keepAwake(); }
}
async function poll(){
  if (!token || !me || me.status !== "active" || polling || !navigator.onLine) return;
  polling = true;
  const now = Date.now(), body = {};
  const every = job && me.live !== false ? 15000 : 300000;
  if (me.duty && me.live !== false && fix && now - lastSent >= every){ body.loc = fix; }
  try{
    const j = await api("poll", body);
    if (body.loc) lastSent = now;
    const wasDuty = me.duty; setMe(j.me);
    if (wasDuty && !j.me.duty) toast("You were taken off duty");
    if (j.me.status !== "active"){ polling = false; route(); return; }
    $("#stJobs").textContent = j.today.jobs; $("#stEarn").textContent = money(j.today.earned); $("#stRate").textContent = j.me.ratingAvg ? "★ " + j.me.ratingAvg : "–";
    const prevJob = job; job = j.job;
    if (prevJob && !job && lastJobId === prevJob.id && prevJob.state !== "done") toast("That job was closed — the customer may have cancelled");
    if (job && (!prevJob || prevJob.id !== job.id)){ alertNew("You have a new job: " + job.svcName); }
    lastJobId = job ? job.id : lastJobId;
    const fresh = j.offers.filter(o => !seen.has(o.id + o.mode));
    j.offers.forEach(o => { seen.add(o.id + o.mode); if (deadlines[o.id] == null || o.mode === "now") deadlines[o.id] = Date.now() + o.expires * 1000; });
    offers = j.offers; quotes = j.quotes || [];
    if (fresh.length) alertNew(fresh[0].mode === "now" ? "New request — be first to accept" : fresh[0].mode === "book" ? "A driver booked you" : "New quote request");
    renderReqs(); if (!jobSig || jobSig !== sig(job)) renderJob(); locStatus();
    if (me.duty !== $("#duty").checked) $("#duty").checked = me.duty;
    clearInterval(pollT); pollT = setInterval(poll, me.duty ? 5000 : 30000);
  }catch{}
  polling = false;
}
let quotes = [], jobSig = "";
const sig = j => j ? j.id + j.state + (j.price || "") : "";
function alertNew(msg){
  beep(); try{ navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 200]); }catch{}
  toast(msg);
  if (view !== "Jobs"){ $("#tabBadge").hidden = false; $("#tabBadge").textContent = "!"; }
  try{
    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted")
      navigator.serviceWorker.ready.then(r => r.showNotification("Roadesy Pro", {body: msg, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "rbpro", renotify: true, vibrate: [200, 100, 200]}));
  }catch{}
}
let actx = null;
function beep(){
  try{ actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .22].forEach(t0 => { const o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination);
      o.frequency.value = 880; g.gain.value = .12; o.start(actx.currentTime + t0); o.frequency.setValueAtTime(1175, actx.currentTime + t0 + .1); o.stop(actx.currentTime + t0 + .18); }); }catch{}
}
document.addEventListener("pointerdown", () => { try{ actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); }catch{} }, {once: true});

const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
function renderReqs(){
  const box = $("#reqs"); if (!box) return;
  if (view === "Jobs") $("#tabBadge").hidden = true;
  $("#reqCount").textContent = offers.length ? offers.length + " waiting" : "";
  if (!me || !me.duty){ box.innerHTML = `<div class="empty">Turn on <b>On duty</b> to start getting requests.</div>`; renderMyQuotes(); return; }
  if (job){ box.innerHTML = `<div class="empty">Finish your active job to get new requests.</div>`; renderMyQuotes(); return; }
  if (!offers.length){ box.innerHTML = `<div class="empty">Waiting for drivers near you… you'll hear a sound when a request comes in.</div>`; renderMyQuotes(); return; }
  // keep what the provider is typing in quote boxes
  const typed = {}; $$("#reqs [data-qp]").forEach(i => typed[i.dataset.qp] = [i.value, $(`[data-qe="${i.dataset.qp}"]`).value]);
  box.innerHTML = offers.map(o => {
    const kind = o.mode === "now" ? "GET HELP NOW" : o.mode === "book" ? "BOOKED YOU" : "QUOTE REQUEST";
    const t = typed[o.id], mq = o.myQuote;
    return `<div class="req ${o.mode}">
      <div class="top"><span class="kind">${kind}</span><span class="timer" data-dl="${o.id}">${mmss(Math.max(0, (deadlines[o.id] - Date.now()) / 1000))} left</span></div>
      <h4>${esc(o.svcName)}</h4>
      <div class="meta">${esc(o.vehicle || "Vehicle not given")} · ${mi(o.km)} away · about ${o.eta} min</div>
      ${o.note ? `<div class="note">"${esc(o.note)}"</div>` : ""}
      ${o.mode === "quote" ? `${mq ? `<div class="note" style="color:#cbbcff">Quote sent: ${money(mq.price)} · ${mq.eta} min. Waiting for the driver to choose…</div>` : ""}
        <div class="qin"><label>Your price<input data-qp="${o.id}" inputmode="decimal" value="${esc(t ? t[0] : mq ? mq.price : o.myPrice ?? "")}"></label>
        <label>Arrive in (min)<input data-qe="${o.id}" inputmode="numeric" value="${esc(t ? t[1] : mq ? mq.eta : o.eta)}"></label></div>
        <div class="btns"><button class="btn" data-pass="${o.id}">Pass</button><button class="btn pro" data-quote="${o.id}">${mq ? "Update quote" : "Send quote"}</button></div>`
      : `<div class="btns"><button class="btn" data-pass="${o.id}">Pass</button><button class="btn ${o.mode === "now" ? "go" : "amb"}" data-accept="${o.id}">Accept · ${money(o.myPrice)}</button></div>`}
      <div class="small" style="margin-top:8px">You'll see the exact spot and the driver's phone after you're chosen.</div>
    </div>`; }).join("");
  renderMyQuotes();
}
function renderMyQuotes(){
  const lost = quotes.filter(q => !q.won && q.state !== "open");
  $("#myQuotes").innerHTML = lost.length ? `<div class="sec-t"><span>Your recent quotes</span></div>` + lost.slice(0, 5).map(q =>
    `<div class="card" style="padding:10px 14px"><div class="row"><span>${esc(q.svcName)} · ${money(q.price)}</span><span class="small">${q.state === "expired" ? "Expired" : "Driver chose another provider"}</span></div></div>`).join("") : "";
}
setInterval(() => { $$("[data-dl]").forEach(el => { const s = (deadlines[el.dataset.dl] - Date.now()) / 1000; el.textContent = s > 0 ? mmss(s) + " left" : "closing…"; }); if (view === "Jobs" && fix) locStatus(); }, 1000);
$("#reqs").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const rid = b.dataset.accept || b.dataset.quote || b.dataset.pass; if (!rid) return;
  busyBtn(b, true);
  try{
    if (b.dataset.accept){ await api("accept", {rid, loc: fix || undefined}); toast("Accepted! The customer can see you coming."); }
    if (b.dataset.pass){ await api("pass", {rid}); offers = offers.filter(o => o.id !== rid); renderReqs(); }
    if (b.dataset.quote){ const price = parseFloat($(`[data-qp="${rid}"]`).value), eta = parseInt($(`[data-qe="${rid}"]`).value);
      if (!(price > 0) || !(eta > 0)){ busyBtn(b, false); return toast("Enter your price and arrival time"); }
      await api("quote", {rid, price, eta}); toast("Quote sent"); }
  }catch(x){ toast(x.message); }
  busyBtn(b, false); poll();
});

/* ---------- active job ---------- */
let jmap = null;
const STEPS = [["assigned", "Accepted"], ["onway", "On my way"], ["arrived", "Arrived"], ["done", "Done"]];
function renderJob(){
  jobSig = sig(job);
  const box = $("#job"); if (!box) return;
  if (!job){ box.innerHTML = `<div class="empty">No active job.</div>`; if (jmap){ jmap.remove(); jmap = null; } return; }
  const j = job, idx = STEPS.findIndex(s => s[0] === j.state);
  const next = {assigned: ["onway", "On my way"], onway: ["arrived", "I've arrived"], arrived: ["done", `Job done · collect ${money(j.price)}`]}[j.state];
  const tel = String(j.phone || "").replace(/[^\d+]/g, "");
  box.innerHTML = `<div class="card job">
    <div class="row"><div><h3>${esc(j.svcName)}</h3><div class="sub">${esc(j.name || "Customer")} · ${esc(j.vehicle || "vehicle not given")}</div></div><b style="font-size:21px">${money(j.price)}</b></div>
    ${j.note ? `<div class="note">"${esc(j.note)}"</div>` : ""}
    <div class="map" id="jobMap"></div>
    <div class="jsteps">${STEPS.map((s, i) => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</div>
    <div class="stl">${STEPS.map(s => `<span>${s[1]}</span>`).join("")}</div>
    <div class="small" style="margin-top:8px">${j.state === "assigned" ? "The customer sees your name, truck and arrival time. Tap \"On my way\" when you roll." : j.state === "onway" ? "The customer sees your truck move every 15 sec." : "Collect payment directly from the customer."}</div>
    <div class="btns"><a class="btn" href="tel:${esc(tel)}">Call ${esc(j.name || "customer")}</a>
      <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${j.spot.lat},${j.spot.lon}&travelmode=driving">Navigate</a></div>
    ${next ? `<button class="btn go" data-step="${next[0]}">${next[1]}</button>` : ""}
    <button class="btn ghost" data-drop>Can't make it</button>
  </div>`;
  box.querySelector("[data-step]") && (box.querySelector("[data-step]").onclick = e => step(e.currentTarget, e.currentTarget.dataset.step));
  let arm = 0; box.querySelector("[data-drop]").onclick = e => { if (Date.now() - arm > 3000){ arm = Date.now(); toast("Tap again to drop this job. The customer will be told."); return; } step(e.currentTarget, "dropped"); };
  drawJobMap();
}
async function step(b, st){
  busyBtn(b, true);
  try{ await api("step", {rid: job.id, step: st, loc: fix || undefined}); if (fix) lastSent = Date.now();
    toast(st === "done" ? "Job done. Nice work!" : st === "dropped" ? "Job dropped" : st === "arrived" ? "Customer notified you're here" : "Customer notified you're on the way"); }
  catch(x){ toast(x.message); }
  busyBtn(b, false); poll();
}
function drawJobMap(){
  const el = $("#jobMap"); if (!el || !job) return;
  if (!window.L){ el.innerHTML = `<div class="small" style="padding:14px">Map needs a connection.</div>`; return; }
  if (jmap){ jmap.remove(); jmap = null; }
  jmap = L.map(el, {zoomControl: false, attributionControl: false});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19}).addTo(jmap);
  const ic = (c, t) => L.divIcon({className: "", html: `<div class="mk ${c}">${t}</div>`, iconSize: [30, 30], iconAnchor: [15, 15]});
  const cu = [job.spot.lat, job.spot.lon], tr = fix || (me.loc && me.loc.lat ? me.loc : me.base);
  L.marker(cu, {icon: ic("cu", "🚗")}).addTo(jmap);
  if (tr){ L.marker([tr.lat, tr.lon], {icon: ic("me", "🛻")}).addTo(jmap);
    L.polyline([[tr.lat, tr.lon], cu], {color: "#9d7bff", weight: 4, dashArray: "6 8"}).addTo(jmap);
    jmap.fitBounds([[tr.lat, tr.lon], cu], {padding: [30, 30], maxZoom: 16}); }
  else jmap.setView(cu, 15);
}

/* ---------- prices ---------- */
function renderPrices(){ if (!me || !S) return; const d = {types: me.types || [], rates: JSON.parse(JSON.stringify(me.rates || {}))}; renderRates("#pRates", d); $("#pRates").dataset.d = ""; }
$("#pSave").onclick = async () => {
  const b = $("#pSave"), d = {types: me.types, rates: JSON.parse(JSON.stringify(me.rates || {}))}; collectRates("#pRates", d); err("#pErr"); busyBtn(b, true);
  try{ const j = await api("save", {rates: d.rates}); setMe(j.me); toast("Prices saved — drivers see them now"); }catch(x){ err("#pErr", x.message); }
  busyBtn(b, false);
};

/* ---------- profile ---------- */
function renderProfile(){
  if (!me) return;
  const rows = [["Business", me.biz], ["Contact", me.contact], ["Phone", me.phone], ["Email", me.email], ["Services", (me.types || []).map(t => S && S[t] ? S[t].label : t).join(", ")],
    ["Base", (me.base && me.base.label) || (me.base ? me.base.lat.toFixed(3) + ", " + me.base.lon.toFixed(3) : "")], ["Area", (me.radiusMi || 15) + " mi"], ["Hours", me.hours],
    ["Vehicle", [me.vehicle && me.vehicle.desc, me.vehicle && me.vehicle.plate].filter(Boolean).join(" · ")], ["License", me.license], ["Insurance", me.insurance],
    ["Jobs · rating", (me.jobs || 0) + " · " + (me.ratingAvg ? "★ " + me.ratingAvg : "no ratings yet")]];
  $("#profK").innerHTML = rows.map(([k, v]) => `<span>${k}</span><div>${esc(v || "—")}</div>`).join("");
}
$("#profEdit").onclick = () => startWizard("edit");
$("#outBtn").onclick = () => signOut();
$("#cpBtn").onclick = async () => {
  const b = $("#cpBtn"); busyBtn(b, true); $("#cpMsg").innerHTML = "";
  try{ await api("password", {old: $("#cpOld").value, password: $("#cpNew").value}); $("#cpMsg").innerHTML = `<div class="ok">Password changed.</div>`; $("#cpOld").value = $("#cpNew").value = ""; }
  catch(x){ $("#cpMsg").innerHTML = `<div class="err">${esc(x.message)}</div>`; }
  busyBtn(b, false);
};

/* ---------- install (one tap), offline, service worker ---------- */
let deferred = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const twa = document.referrer.startsWith("android-app://");
function showInstall(on){ $("#installBtn").hidden = !on || standalone || twa; }
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; showInstall(true); });
addEventListener("appinstalled", () => { showInstall(false); toast("Roadesy Pro installed"); });
showInstall(true);
$("#installBtn").onclick = async () => {
  if (deferred){ deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r.outcome === "accepted") showInstall(false); }
  else if (isIOS) toast("Tap Share ⇧, then “Add to Home Screen”");
  else toast("Open your browser menu → Install app");
};
const net = () => { $("#offline").hidden = navigator.onLine; if (navigator.onLine) poll(); };
addEventListener("online", net); addEventListener("offline", net); net();
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ---------- start ---------- */
(async () => {
  route();
  await loadServices();
  if (token){ try{ const j = await api("me"); setMe(j.me); }catch{} route(); poll(); }
})();
})();
