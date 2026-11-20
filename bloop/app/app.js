/* Bloop v2 — public restroom finder
 * Data: OpenStreetMap (Overpass) + Bloop community (Supabase, optional).
 * Vanilla JS, no build step. */
(() => {
  'use strict';

  const CFG = window.BLOOP_CONFIG || {};
  const CONFIG = {
    version: '2.16.0',
    defaultCenter: [25.7617, -80.1918],
    defaultZoom: 15,
    searchRadius: 2400,
    overpass: CFG.overpass || [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ],
    supabaseUrl: (CFG.supabaseUrl || '').replace(/\/+$/, ''),
    supabaseKey: CFG.supabaseKey || '',
    tiles: {
      // OpenStreetMap standard map — free, no key. Night mode darkens it with a CSS filter.
      dark: CFG.tileDark || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      light: CFG.tileLight || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      darkClass: CFG.tileDark ? '' : 'tiles-osm-dark',
      maxZoom: 19,
      attribution: CFG.tileAttribution || ('&copy; OpenStreetMap contributors' + ((CFG.geoapifyKey || '').trim() ? ' · Powered by Geoapify' : ''))
    },
    routing: {
      walk: (CFG.routeWalk || 'https://routing.openstreetmap.de/routed-foot').replace(/\/+$/, ''),
      drive: (CFG.routeDrive || 'https://routing.openstreetmap.de/routed-car').replace(/\/+$/, '')
    }
  };

  // ---------- Storage ----------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const Store = {
    userPlaces: () => LS.get('bloop_user_places', []),
    addUserPlace(p) { const a = this.userPlaces(); a.push(p); LS.set('bloop_user_places', a); },
    removeUserPlace(id) { LS.set('bloop_user_places', this.userPlaces().filter((p) => p.id !== id)); },
    ratings: () => LS.get('bloop_ratings', {}),
    rate(id, v, comment, subs) { const r = this.ratings(); r[id] = { v, comment: comment || '', subs: subs || null, ts: Date.now() }; LS.set('bloop_ratings', r); },
    checkins: () => LS.get('bloop_checkins', {}),
    checkin(id, status) { const c = this.checkins(); c[id] = { status, ts: Date.now() }; LS.set('bloop_checkins', c); },
    saved: () => LS.get('bloop_saved', {}),
    toggleSave(p) { const s = this.saved(); if (s[p.id]) delete s[p.id]; else s[p.id] = { ...p, d: undefined }; LS.set('bloop_saved', s); return !!s[p.id]; },
    myPhotos: () => LS.get('bloop_my_photos', {}),
    addMyPhoto(id, dataUrl) {
      const m = this.myPhotos(); (m[id] = m[id] || []).unshift(dataUrl); m[id] = m[id].slice(0, 3);
      const keys = Object.keys(m); if (keys.length > 25) delete m[keys[0]];
      LS.set('bloop_my_photos', m);
    },
    renameId(oldId, newId) {
      const m = LS.get('bloop_idmap', {}); m[oldId] = newId; LS.set('bloop_idmap', m);
      for (const k of ['bloop_ratings', 'bloop_checkins', 'bloop_my_photos', 'bloop_tips', 'bloop_attrs']) {
        const o = LS.get(k, {}); if (o[oldId]) { o[newId] = o[oldId]; delete o[oldId]; LS.set(k, o); }
      }
    },
    bump(k) { LS.set(k, (LS.get(k, 0) || 0) + 1); },
    tips: () => LS.get('bloop_tips', {}),
    addTip(id, kind, text, pt) { const t = this.tips(); (t[id] = t[id] || []).unshift({ kind, text, ts: Date.now(), lat: pt ? pt[0] : null, lng: pt ? pt[1] : null }); t[id] = t[id].slice(0, 3); LS.set('bloop_tips', t); }
  };
  const Prefs = {
    get nick() { return LS.get('bloop_nick', ''); }, set nick(v) { LS.set('bloop_nick', v); },
    get units() { return LS.get('bloop_units', 'imperial'); }, set units(v) { LS.set('bloop_units', v); },
    get style() { return LS.get('bloop_style', Prefs.theme === 'light' ? 'light' : 'dark'); }, set style(v) { LS.set('bloop_style', v); },
    get theme() { return LS.get('bloop_theme', 'light'); }, set theme(v) { LS.set('bloop_theme', v); }
  };

  // A restroom added on this phone gets a new ID once it uploads; this finds the current one
  const liveId = (id) => (id && id.startsWith('user-') && LS.get('bloop_idmap', {})[id]) || id;
  const DEVICE_ID = (() => {
    let id = LS.get('bloop_device', null);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12); LS.set('bloop_device', id); }
    return id;
  })();

  // ---------- Supabase REST + offline outbox ----------
  // Why community data might be off — shown in Account
  const CONFIG_STATUS = !window.BLOOP_CONFIG ? 'config.js didn’t load — it’s missing or has a typo (check commas and quotes)'
    : !CONFIG.supabaseUrl ? 'Supabase URL is empty in config.js'
    : !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(CONFIG.supabaseUrl) ? 'Supabase URL looks wrong — it should look like https://xxxx.supabase.co'
    : !CONFIG.supabaseKey ? 'Supabase key is empty in config.js'
    : '';
  const API = {
    enabled: !!(CONFIG.supabaseUrl && CONFIG.supabaseKey) && !/looks wrong/.test(CONFIG_STATUS),
    headers(extra = {}) {
      const h = { apikey: CONFIG.supabaseKey, ...extra };
      if (CONFIG.supabaseKey.startsWith('eyJ')) h.Authorization = `Bearer ${CONFIG.supabaseKey}`;
      return h;
    },
    async call(path, body, prefer) {
      const headers = this.headers({ 'Content-Type': 'application/json' });
      if (prefer) headers.Prefer = prefer;
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
        const text = await r.text();
        let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
        if (!r.ok) { const e = new Error((data && data.message) || `HTTP ${r.status}`); e.status = r.status; throw e; }
        return data;
      } finally { clearTimeout(to); }
    },
    placesInBox: (b) => API.call('rpc/places_in_box', b),
    stats: (ids) => API.call('rpc/place_stats', { ids }),
    reviews: (pid) => API.call('rpc/place_reviews', { pid }),
    photos: (pid) => API.call('rpc/place_photos', { pid }),
    tips: (pid) => API.call('rpc/place_tips', { pid }),
    reportIssue: (pid, reason, details) => API.call('rpc/report_issue', { pid, reason, details: details || null, device: DEVICE_ID }),
    photoUrl: (path) => `${CONFIG.supabaseUrl}/storage/v1/object/public/photos/${path}`,
    async uploadPhoto(placeId, blob) {
      const path = `p/${placeId.replace(/[^a-z0-9-]/gi, '_')}/${DEVICE_ID.slice(0, 8)}-${Date.now().toString(36)}.jpg`;
      const r = await fetch(`${CONFIG.supabaseUrl}/storage/v1/object/photos/${path}`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }), body: blob
      });
      if (!r.ok) throw new Error('Photo upload failed');
      await this.call('rpc/add_photo', { pid: placeId, path, device: DEVICE_ID });
      return path;
    }
  };

  const Outbox = {
    items: () => LS.get('bloop_outbox', []),
    push(item) { if (!API.enabled) return; const a = this.items(); a.push(item); LS.set('bloop_outbox', a); this.flush(); },
    busy: false,
    async flush() {
      if (!API.enabled || this.busy || !navigator.onLine) return;
      this.busy = true; let changed = false;
      const done = (fn) => { const cur = this.items(); if (fn) fn(cur); cur.shift(); LS.set('bloop_outbox', cur); changed = true; };
      for (;;) {
        const it = this.items()[0]; if (!it) break;
        try {
          if (it.type === 'place') {
            const p = it.payload;
            const body = {
              name: p.name, lat: p.lat, lng: p.lng, access: p.access, note: p.note || null,
              free: p.fee === false, accessible: p.acc === 'yes', baby: p.baby === true, unisex: p.unisex === true,
              showers: p.showers === true, hours: p.hours, device_id: DEVICE_ID
            };
            const uuid = await API.call('rpc/add_place', { p: body });
            const newId = uuid ? `sb-${uuid}` : null;
            if (newId) {
              Store.removeUserPlace(p.id); Store.renameId(p.id, newId);
              community.push(fromSB({ ...body, id: uuid })); LS.set('bloop_community', community);
              const sv = Store.saved(); if (sv[p.id]) { sv[newId] = { ...sv[p.id], id: newId, src: 'community', uuid }; delete sv[p.id]; LS.set('bloop_saved', sv); }
              if (detailId === p.id) detailId = newId;
            }
            done((cur) => cur.slice(1).forEach((x) => { if (newId && x.payload.place_id === p.id) x.payload.place_id = newId; }));
          } else if (it.payload.place_id.startsWith('user-') && liveId(it.payload.place_id) !== it.payload.place_id) {
            const nid = liveId(it.payload.place_id);
            const cur = this.items(); if (cur[0]) { cur[0].payload.place_id = nid; LS.set('bloop_outbox', cur); }
            continue; // retry with the uploaded restroom's ID
          } else if (it.payload.place_id.startsWith('user-')) {
            done(); // its restroom never uploaded
          } else {
            if (it.type === 'photo') {
              const blob = await PhotoQ.get(it.payload.key);
              if (blob) { await API.uploadPhoto(it.payload.place_id, blob); await PhotoQ.del(it.payload.key); toast('Your photo uploaded — it’ll appear once approved'); }
            } else if (it.type === 'report') await API.reportIssue(it.payload.place_id, it.payload.reason, it.payload.details);
            else if (it.type === 'attr') await API.call('rpc/set_attr', { pid: it.payload.place_id, attr: it.payload.attr, val: it.payload.value, device: DEVICE_ID });
            else if (it.type === 'tip') await API.call('rpc/add_tip2', { pid: it.payload.place_id, kind: it.payload.kind, tip: it.payload.tip || null, device: DEVICE_ID, lat: it.payload.lat ?? null, lng: it.payload.lng ?? null });
            else await API.call(it.type === 'rating' ? 'ratings' : 'checkins', { ...it.payload, device_id: DEVICE_ID }, 'return=minimal');
            done(); if (it.type !== 'report') refreshStats([it.payload.place_id]);
            if (it.type === 'tip') delete tipsCache[it.payload.place_id];
          }
        } catch (e) {
          if (e.status >= 400 && e.status < 500) { done(); toast(e.message || 'Couldn’t save that'); }
          else break; // offline or server down — retry later
        }
      }
      this.busy = false;
      if (changed) renderList();
    }
  };

  // Photos are too big for normal storage, so waiting photos are kept in IndexedDB
  const PhotoQ = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('bloop', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos');
        r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error);
      });
    },
    async op(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('photos', mode); const q = fn(tx.objectStore('photos')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }); },
    put(key, blob) { return this.op('readwrite', (s) => s.put(blob, key)); },
    get(key) { return this.op('readonly', (s) => s.get(key)); },
    del(key) { return this.op('readwrite', (s) => s.delete(key)); }
  };

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toRad = (d) => d * Math.PI / 180;
  const I = (n, c) => window.ICON(n, c);
  function distM(a, b) {
    const R = 6371000, dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) {
    if (m == null) return '';
    if (Prefs.units === 'imperial') { const ft = m * 3.28084; return ft < 528 ? `${Math.round(ft / 10) * 10} ft` : `${(m / 1609.34).toFixed(1)} mi`; }
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }
  const travel = (m) => m < 1200 ? `${Math.max(1, Math.round(m / 80))} min walk` : `${Math.max(1, Math.round(m / 500))} min drive`;
  const travelShort = (m) => `${m < 1200 ? Math.max(1, Math.round(m / 80)) : Math.max(1, Math.round(m / 500))} min`;
  function timeAgo(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  let toastT;
  function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- Opening hours ----------
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  function parseDays(str) {
    const set = new Set();
    for (const part of str.split(',')) {
      const [a, b] = part.trim().split('-'); const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i;
      if (i < 0 || j < 0) return null;
      let k = i; set.add(k); while (k !== j) { k = (k + 1) % 7; set.add(k); }
    }
    return set;
  }
  // Ranges [[startMin, endMin]] for a weekday, [] if closed, null if unknown
  function rangesFor(oh, day) {
    const s = oh.trim();
    if (/^24\/7$/.test(s)) return [[0, 1440]];
    let out = null;
    for (let rule of s.split(';')) {
      rule = rule.trim(); if (!rule) continue;
      const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/);
      if (!m) return null;
      const days = m[1] ? parseDays(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
      if (!days) return null;
      if (!days.has(day)) continue;
      const t = m[2].trim();
      if (/^(off|closed)$/i.test(t)) { out = []; continue; }
      if (t === '' || t === '24/7') { out = [[0, 1440]]; continue; }
      const rs = [];
      for (const r of t.split(',')) {
        const x = r.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/);
        if (!x) return null;
        const a = +x[1] * 60 + +x[2]; let b = +x[3] * 60 + +x[4]; if (b <= a) b += 1440;
        rs.push([a, b]);
      }
      out = rs;
    }
    return out ?? (s.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)/) ? [] : null);
  }
  function fmtClock(min) {
    min %= 1440; let h = Math.floor(min / 60); const m = min % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }
  function hoursInfo(oh, now = new Date()) {
    if (!oh) return { open: null, label: 'Hours unknown' };
    if (/^24\/7$/.test(oh.trim())) return { open: true, label: 'Open 24/7', h24: true };
    const day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    const today = rangesFor(oh, day);
    if (today == null) return { open: null, label: 'See hours' };
    const y = rangesFor(oh, (day + 6) % 7) || [];
    for (const [a, b] of y) if (b > 1440 && mins < b - 1440) return { open: true, label: `Open until ${fmtClock(b)}` };
    const all = [0, 1, 2, 3, 4, 5, 6].every((d) => { const r = rangesFor(oh, d); return r && r.some(([a, b]) => a === 0 && b >= 1440); });
    if (all) return { open: true, label: 'Open 24/7', h24: true };
    for (const [a, b] of today) if (mins >= a && mins < b) return { open: true, label: b >= 1440 && a === 0 ? 'Open 24 hours' : `Open until ${fmtClock(b)}` };
    const next = today.filter(([a]) => a > mins).sort((p, q) => p[0] - q[0])[0];
    return { open: false, label: next ? `Closed · opens ${fmtClock(next[0])}` : 'Closed now' };
  }

  // ---------- Categories ----------
  const CAT = {
    public: { icon: 'toilet', g: ['#a64dff', '#3d8bff'], label: 'Public restroom' },
    gas: { icon: 'fuel', g: ['#ff8a1f', '#c81e3a'], label: 'Gas station' },
    cafe: { icon: 'coffee', g: ['#d99245', '#6b3410'], label: 'Café' },
    food: { icon: 'food', g: ['#ff5e7e', '#ff9a3c'], label: 'Restaurant' },
    bar: { icon: 'glass', g: ['#e040fb', '#5b1aa8'], label: 'Bar / casino' },
    library: { icon: 'book', g: ['#818cf8', '#312e81'], label: 'Library' },
    store: { icon: 'bag', g: ['#3d8bff', '#1e3a8a'], label: 'Store' },
    mall: { icon: 'store', g: ['#4f7cff', '#7c3aed'], label: 'Mall' },
    hotel: { icon: 'bed', g: ['#14b8a6', '#1e40af'], label: 'Hotel' },
    park: { icon: 'tree', g: ['#22c55e', '#0e7490'], label: 'Park' },
    beach: { icon: 'beach', g: ['#22d3ee', '#2563eb'], label: 'Beach' },
    shower: { icon: 'shower', g: ['#06b6d4', '#1d4ed8'], label: 'Public shower' },
    rest: { icon: 'car', g: ['#0ea5e9', '#4338ca'], label: 'Highway rest area' },
    hospital: { icon: 'plus', g: ['#f43f5e', '#9f1239'], label: 'Hospital' },
    venue: { icon: 'building', g: ['#a855f7', '#4338ca'], label: 'Cinema / museum' },
    other: { icon: 'building', g: ['#64748b', '#2b3456'], label: 'Business' }
  };
  function categoryOf(t) {
    const a = t.amenity, s = t.shop, l = t.leisure, tr = t.tourism;
    if (a === 'shower') return 'shower';
    if (a === 'toilets') return l === 'park' ? 'park' : 'public';
    if (a === 'fuel') return 'gas';
    if (a === 'cafe' || a === 'ice_cream') return 'cafe';
    if (['restaurant', 'fast_food', 'food_court'].includes(a)) return 'food';
    if (['bar', 'pub', 'nightclub', 'casino', 'biergarten'].includes(a)) return 'bar';
    if (a === 'library' || a === 'community_centre') return 'library';
    if (a === 'hospital') return 'hospital';
    if (t.highway === 'rest_area' || t.highway === 'services') return 'rest';
    if (s === 'mall' || s === 'department_store') return 'mall';
    if (s) return 'store';
    if (['hotel', 'motel', 'hostel', 'guest_house'].includes(tr)) return 'hotel';
    if (a === 'cinema' || a === 'theatre' || tr === 'museum') return 'venue';
    if (l === 'park' || l === 'garden' || l === 'playground') return 'park';
    if (t.natural === 'beach' || l === 'beach_resort') return 'beach';
    return 'other';
  }
  const LIKELY_NOTE = {
    gas: 'Gas stations usually have a restroom for customers.',
    food: 'Chain restaurants usually have restrooms for customers.',
    cafe: 'Chain cafés usually have restrooms for customers.',
    store: 'Big stores usually have restrooms near the entrance or customer service.',
    mall: 'Malls have public restrooms, usually near the food court.',
    library: 'Usually open to the public during opening hours.',
    hospital: 'Lobby restrooms are usually open to visitors.',
    rest: 'Highway rest areas have public restrooms.',
    park: 'Many parks have restrooms near the playground, parking or main building.',
    hotel: 'Hotel lobbies usually have restrooms near the front desk.',
    venue: 'Usually has restrooms for visitors.',
    other: 'Places like this usually have a restroom for customers.'
  };
  const art = (cat) => { const c = CAT[cat] || CAT.other; return `<div class="art" style="background:linear-gradient(135deg,${c.g[0]},${c.g[1]})">${I(c.icon)}</div>`; };

  // ---------- Normalize ----------
  const tri = (v) => (v === 'yes' ? true : v === 'no' ? false : null);
  function fromOSM(el) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null) return null;
    const cat = categoryOf(t);
    const standalone = t.amenity === 'toilets' || t.amenity === 'shower';
    const likely = !standalone && t.toilets !== 'yes';
    const publicish = ['library', 'hospital', 'rest', 'mall', 'park'].includes(cat);
    const access = t['toilets:access'] || (standalone ? t.access : null) || (standalone || likely ? null : 'customers');
    const name = t.name || t.brand || (t.amenity === 'shower' ? 'Public Shower' : standalone ? 'Public Restroom' : CAT[cat].label);
    return {
      id: `osm-${el.type}-${el.id}`, src: 'osm', lat, lng, name, cat, inside: !standalone && !(likely && publicish), likely,
      fee: tri(standalone ? t.fee : (t['toilets:fee'] ?? null)),
      acc: t['toilets:wheelchair'] || t.wheelchair || null,
      baby: tri(t.changing_table ?? t['toilets:changing_table'] ?? t.diaper),
      unisex: t.unisex === 'yes' || t.gender_segregated === 'no' ? true : (t.unisex === 'no' || t.gender_segregated === 'yes' ? false : null),
      showers: t.amenity === 'shower' || t.shower === 'yes' ? true : tri(t.shower),
      pub: likely ? null : ['customers', 'private', 'no', 'permissive_customers'].includes(access) ? false : (access === 'yes' || access === 'public' || (standalone && !access) ? true : null),
      access, hours: t.opening_hours || (standalone ? null : t['toilets:opening_hours'] || null),
      addr: [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean).join(', '),
      phone: t.phone || t['contact:phone'] || null,
      note: [t.description, t['toilets:description'], t.note].filter(Boolean).join(' · ').slice(0, 200)
    };
  }
  function fromSB(r) {
    return {
      id: `sb-${r.id}`, uuid: r.id, src: 'community', lat: r.lat, lng: r.lng, name: r.name, cat: r.access === 'customers' ? 'other' : 'public',
      inside: r.access === 'customers', fee: r.free ? false : true, acc: r.accessible ? 'yes' : null, baby: r.baby ? true : null,
      unisex: r.unisex ? true : null, showers: r.showers ? true : null, pub: r.access === 'public', access: r.access,
      hours: r.hours || null, addr: '', phone: null, note: r.note || ''
    };
  }

  // ---------- State ----------
  let map, tileLayer, meMarker, meCircle, me = null, places = [], community = [], markers = new Map();
  let lastFetchCenter = null, fetching = false, detailId = null, currentTab = 'home', mapReady = false;
  let stats = LS.get('bloop_stats', {});
  const reviewsCache = {}, photosCache = {}, tipsCache = {};
  const filters = new Set();

  async function refreshStats(ids) {
    if (!API.enabled || !navigator.onLine || !ids.length) return;
    try {
      const rows = [];
      for (let i = 0; i < ids.length; i += 200) rows.push(...((await API.stats(ids.slice(i, i + 200))) || []));
      ids.forEach((id) => delete stats[id]);
      for (const r of rows) stats[r.place_id] = { attrs: r.attrs || {}, avg: r.avg_stars != null ? +r.avg_stars : null, n: r.n_ratings || 0, subs: { clean: num(r.avg_clean), stocked: num(r.avg_stocked), smell: num(r.avg_smell), safe: num(r.avg_safe) }, status: r.last_status, at: r.last_checkin_at ? Date.parse(r.last_checkin_at) : null, cover: r.cover_path || null, photos: r.n_photos || 0, noRestroom: r.no_restroom || 0, where: r.where_tip != null || r.where_lat != null ? { kind: 'where', text: r.where_tip || '', lat: r.where_lat, lng: r.where_lng, ts: Date.parse(r.where_at) } : null, tip: r.last_tip_kind ? { kind: r.last_tip_kind, text: r.last_tip_text || '', ts: Date.parse(r.last_tip_at) } : null };
      LS.set('bloop_stats', stats);
      renderList();
      if (detailId && ids.includes(detailId)) renderDetail();
    } catch {}
  }
  const num = (v) => (v == null ? null : +v);
  // Category ratings shown on each restroom: label, icon
  const SUBS = [['clean', 'Cleanliness', 'check'], ['stocked', 'Stocked (paper & soap)', 'toilet'], ['smell', 'Smell', 'info'], ['safe', 'Safety & lighting', 'lock']];
  function ratingInfo(id) {
    const my = Store.ratings()[id]; const mine = my?.v || null; const s = stats[id];
    if (s && s.avg != null) return { avg: s.avg, n: s.n, mine, subs: s.subs || {} };
    return { avg: mine, n: mine ? 1 : 0, mine, subs: (my && my.subs) || {} };
  }
  function latestCheckin(id) {
    const mine = Store.checkins()[id]; const s = stats[id];
    const theirs = s && s.status && s.at ? { status: s.status, ts: s.at } : null;
    if (mine && theirs) return mine.ts >= theirs.ts ? mine : theirs;
    return mine || theirs || null;
  }
  // Out of order stays visible for 2 days, "closed" for 6 hours
  function badStatus(id) {
    const ci = latestCheckin(id); if (!ci || ci.status === 'open') return null;
    return Date.now() - ci.ts < (ci.status === 'out of order' ? 48 : 6) * 3600e3 ? ci : null;
  }
  const TIP_KINDS = {
    open: ['Walk right in', 'check'], key: ['Ask for the key', 'key'], code: ['Door code', 'lock'],
    purchase: ['Buy something first', 'tag'], staff: ['Ask staff to unlock', 'people'], where: ['Where inside', 'pin'], other: ['Tip', 'info']
  };
  function tipsFor(p) {
    const all = [...(Store.tips()[p.id] || []).map((t) => ({ ...t, mine: true })),
      ...(tipsCache[p.id] || []).map((t) => ({ kind: t.kind, text: t.tip || '', ts: Date.parse(t.created_at), lat: t.lat, lng: t.lng }))];
    if (!tipsCache[p.id] && stats[p.id] && stats[p.id].tip) all.push(stats[p.id].tip);
    if (!tipsCache[p.id] && stats[p.id] && stats[p.id].where) all.push(stats[p.id].where);
    const seen = new Set(); const out = [];
    for (const t of all.sort((x, y) => y.ts - x.ts)) { const k = `${t.kind}|${t.text}`; if (!seen.has(k)) { seen.add(k); out.push(t); } }
    if (p.note) out.push({ kind: 'other', text: p.note, listing: true });
    return out;
  }
  // Latest "where inside" info: text + optional exact pin (ignored if pinned far from the place)
  function whereFor(p) {
    const w = tipsFor(p).find((t) => t.kind === 'where'); if (!w) return null;
    const pt = w.lat != null && w.lng != null && distM([p.lat, p.lng], [w.lat, w.lng]) < 400 ? [w.lat, w.lng] : null;
    return { text: w.text, pt };
  }
  // "Bloop Clean" badge: 4.5+ for cleanliness (or overall) from at least 10 reviews
  const CLEAN_BADGE = { minReviews: CFG.cleanBadgeMinReviews || 10, minScore: 4.5 };
  function isBloopClean(p) {
    const r = ratingInfo(p.id); const score = r.subs && r.subs.clean != null ? r.subs.clean : r.avg;
    return r.n >= CLEAN_BADGE.minReviews && score != null && score >= CLEAN_BADGE.minScore;
  }
  const CLEAN_BADGE_HTML = '<span class="badge clean">✨ BLOOP CLEAN</span>';
  // A "likely" place becomes confirmed once anyone rates it, checks in, or says yes
  function isConfirmed(p) {
    if (!p.likely) return true;
    if (LS.get('bloop_confirmed', []).includes(p.id) || Store.ratings()[p.id]) return true;
    const s = stats[p.id]; return !!(s && (s.n > 0 || s.status === 'open'));
  }
  function isHiddenPlace(p) {
    if (!p.likely) return false;
    if (LS.get('bloop_norestroom', []).includes(p.id)) return true;
    const s = stats[p.id]; return !!(s && s.noRestroom >= 2 && !(s.n > 0));
  }
  function coverUrl(p) {
    const mine = Store.myPhotos()[p.id]; if (mine && mine[0]) return mine[0];
    const s = stats[p.id]; return s && s.cover && API.enabled ? API.photoUrl(s.cover) : null;
  }

  // ---------- Map ----------
  function initMap() {
    const v = LS.get('bloop_view', null);
    map = L.map('map', { zoomControl: false }).setView(v ? v.c : CONFIG.defaultCenter, v ? v.z : CONFIG.defaultZoom);
    setTiles(Prefs.style);
    map.on('moveend', () => {
      const c = map.getCenter();
      LS.set('bloop_view', { c: [c.lat, c.lng], z: map.getZoom() });
      if (document.body.classList.contains('adding') || fetching || !lastFetchCenter) return;
      $('#searchAreaBtn').hidden = !(distM(lastFetchCenter, [c.lat, c.lng]) > CONFIG.searchRadius * 0.5 && map.getZoom() >= 13);
    });
    map.on('click', () => { $('#searchResults').hidden = true; });
  }
  function setTiles(style) {
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(style === 'light' ? CONFIG.tiles.light : CONFIG.tiles.dark, {
      maxZoom: CONFIG.tiles.maxZoom, attribution: CONFIG.tiles.attribution, className: style === 'light' ? '' : CONFIG.tiles.darkClass, crossOrigin: true
    }).addTo(map);
  }
  function pinKind(p) { return badStatus(p.id) ? 'oos' : p.src === 'user' ? 'pending' : p.src === 'community' ? 'community' : p.inside ? 'business' : 'public'; }
  function pinIcon(p, sel) {
    if (!isConfirmed(p) && !badStatus(p.id)) {
      const html = `<div class="pin p-likely ${sel ? 'sel' : ''}"><svg viewBox="0 0 40 50"><ellipse cx="20" cy="48.6" rx="6" ry="1.4" fill="rgba(0,0,0,.25)"/><path d="M20 3S5.2 20.3 5.2 32a14.8 14.8 0 0 0 29.6 0C34.8 20.3 20 3 20 3z" class="lk-fill" stroke="#8b6cff" stroke-width="2.2" stroke-dasharray="4 2.5"/><svg x="9.6" y="21.4" width="20.8" height="20.8" viewBox="0 0 24 24" style="color:#8b6cff"><use href="#i-toilet"/></svg></svg></div>`;
      return L.divIcon({ className: '', html, iconSize: [38, 48], iconAnchor: [19, 47] });
    }
    const k = pinKind(p);
    const html = `<div class="pin p-${k === 'pending' ? 'community' : k} ${sel ? 'sel' : ''}">${k === 'oos' ? '<span class="pin-warn">!</span>' : isBloopClean(p) ? '<span class="pin-clean">✨</span>' : ''}<svg viewBox="0 0 40 50"><ellipse cx="20" cy="48.6" rx="7" ry="1.6" fill="rgba(0,0,0,.35)"/><path d="M20 1.8S4.2 19.8 4.2 32a15.8 15.8 0 0 0 31.6 0C35.8 19.8 20 1.8 20 1.8z" fill="url(#g-${k})" stroke="rgba(255,255,255,.85)" stroke-width="1.6"/><svg x="8.4" y="20.6" width="23.2" height="23.2" viewBox="0 0 24 24" style="color:#fff"><use href="#i-toilet"/></svg></svg></div>`;
    return L.divIcon({ className: '', html, iconSize: [46, 58], iconAnchor: [23, 57] });
  }
  function setMe(ll, acc) {
    me = ll;
    if (!map) return;
    const icon = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    if (meMarker) meMarker.setLatLng(ll); else meMarker = L.marker(ll, { icon, interactive: false, zIndexOffset: 2000 }).addTo(map);
    const r = nav ? Math.max(10, Math.min(acc || 20, 60)) : Math.max(120, Math.min(acc || 120, 600));
    if (meCircle) { meCircle.setLatLng(ll); meCircle.setRadius(r); }
    else meCircle = L.circle(ll, { radius: r, color: '#3da0ff', weight: 1.5, opacity: .7, fillColor: '#3da0ff', fillOpacity: .12, interactive: false }).addTo(map);
  }
  function locate(fly = true) {
    if (!navigator.geolocation) { toast('Location isn’t available on this device'); return Promise.resolve(null); }
    return new Promise((res) => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setMe(ll, pos.coords.accuracy);
        if (fly && map) map.setView(ll, Math.max(map.getZoom(), 15));
        res(ll);
      }, () => { toast('Location is off — showing the map area instead'); res(null); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }

  // ---------- Data ----------
  const setStatus = (s) => {
    if (s === 'retry') {
      $('#status').innerHTML = `Restroom data didn’t load — the map server may be busy. <button class="btn" id="retryBtn" style="height:36px;margin-top:6px">Retry</button>`;
      $('#retryBtn').onclick = () => { const c = map.getCenter(); fetchArea(me || [c.lat, c.lng]); };
    } else $('#status').textContent = s;
  };
  // ---------- Geoapify Places (OpenStreetMap data, hosted) ----------
  const GEO_KEY = (CFG.geoapifyKey || '').trim();
  const GEO_CONFIRMED = 'amenity.toilet';
  const GEO_LIKELY = 'service.vehicle.fuel,catering.fast_food,catering.restaurant,catering.cafe,commercial.supermarket,commercial.shopping_mall,commercial.department_store,healthcare.hospital,education.library';
  const GEO_LIKELY_SAFE = 'service.vehicle.fuel,catering.fast_food,catering.cafe,commercial.supermarket';
  // Extra place types in their own request, so one unknown category can't break the main search
  const GEO_EXTRA = 'accommodation.hotel,leisure.park,commercial.houseware_and_hardware,entertainment.cinema,entertainment.museum';
  const OSM_TYPE = { n: 'node', w: 'way', r: 'relation', node: 'node', way: 'way', relation: 'relation' };
  // Turn Geoapify results back into OpenStreetMap-style elements so the rest of the app is unchanged
  function geoToElements(fc, likelySet) {
    const out = [];
    for (const f of (fc && fc.features) || []) {
      const p = f.properties || {}; const raw = (p.datasource && p.datasource.raw) || {};
      const tags = { ...raw }; delete tags.osm_id; delete tags.osm_type;
      if (!tags.name && p.name) tags.name = p.name;
      if (!tags['addr:street'] && p.street) { tags['addr:street'] = p.street; if (p.housenumber) tags['addr:housenumber'] = p.housenumber; }
      if (!tags['addr:city'] && p.city) tags['addr:city'] = p.city;
      if (!tags.opening_hours && p.opening_hours) tags.opening_hours = p.opening_hours;
      const cats = p.categories || [];
      if (!tags.amenity && !tags.shop) {
        if (cats.includes('amenity.toilet')) tags.amenity = 'toilets';
        else if (cats.some((c) => c.startsWith('service.vehicle.fuel'))) tags.amenity = 'fuel';
        else if (cats.some((c) => c.startsWith('catering.fast_food'))) tags.amenity = 'fast_food';
        else if (cats.some((c) => c.startsWith('catering.cafe'))) tags.amenity = 'cafe';
        else if (cats.some((c) => c.startsWith('catering.restaurant'))) tags.amenity = 'restaurant';
        else if (cats.includes('commercial.supermarket')) tags.shop = 'supermarket';
        else if (cats.includes('commercial.shopping_mall')) tags.shop = 'mall';
        else if (cats.includes('commercial.department_store')) tags.shop = 'department_store';
        else if (cats.some((c) => c.startsWith('healthcare.hospital'))) tags.amenity = 'hospital';
        else if (cats.includes('education.library')) tags.amenity = 'library';
        else if (cats.some((c) => c.startsWith('accommodation.hotel'))) tags.tourism = 'hotel';
        else if (cats.some((c) => c.startsWith('leisure.park'))) tags.leisure = 'park';
        else if (cats.some((c) => c.startsWith('commercial.houseware_and_hardware'))) tags.shop = 'doityourself';
        else if (cats.some((c) => c.startsWith('entertainment.cinema'))) tags.amenity = 'cinema';
        else if (cats.some((c) => c.startsWith('entertainment.museum'))) tags.tourism = 'museum';
      }
      if (likelySet) {
        if (tags.toilets === 'no') continue;
        // parks only when they have a name (tiny unnamed green spaces rarely have restrooms)
        if ((tags.leisure === 'park' || (p.categories || []).includes('leisure.park')) && !tags.name && !p.name) continue;
      }
      const type = OSM_TYPE[raw.osm_type] || 'node';
      const id = raw.osm_id != null ? Math.abs(raw.osm_id) : p.place_id;
      out.push({ type, id, lat: p.lat, lon: p.lon, tags });
    }
    return out;
  }
  let lastGeoLog = '';
  async function geoapify(categories, lat, lng, radius, limit) {
    const go = async (cats) => {
      const url = `https://api.geoapify.com/v2/places?categories=${cats}&filter=circle:${lng},${lat},${radius}&bias=proximity:${lng},${lat}&limit=${limit}&apiKey=${encodeURIComponent(GEO_KEY)}`;
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
      try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? { ok: true, j: await r.json() } : { ok: false, status: r.status }; }
      finally { clearTimeout(to); }
    };
    try {
      let res = await go(categories);
      if (!res.ok && res.status === 400 && categories === GEO_LIKELY) res = await go(GEO_LIKELY_SAFE);
      if (!res.ok) { lastGeoLog = `Geoapify HTTP ${res.status}${res.status === 401 ? ' (key rejected)' : res.status === 429 ? ' (daily limit reached)' : ''}`; return null; }
      const els = geoToElements(res.j, categories !== GEO_CONFIRMED);
      lastGeoLog = `Geoapify OK (${els.length})`;
      return { elements: els };
    } catch (e) { lastGeoLog = `Geoapify ${e.name === 'AbortError' ? 'timed out' : 'failed'}`; return null; }
  }
  let lastOverpassLog = [];
  async function overpass(q, timeoutMs = 30000) {
    const log = [];
    for (const url of CONFIG.overpass) {
      const t0 = Date.now();
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
        clearTimeout(to);
        if (res.ok) { const j = await res.json(); log.push({ url, ok: true, ms: Date.now() - t0, n: (j.elements || []).length }); lastOverpassLog = log; return j; }
        log.push({ url, ok: false, ms: Date.now() - t0, err: `HTTP ${res.status}` });
      } catch (e) { log.push({ url, ok: false, ms: Date.now() - t0, err: e.name === 'AbortError' ? 'timed out' : (e.message || 'failed') }); }
    }
    lastOverpassLog = log; return null;
  }
  // Wrapper: never leaves the app stuck in "loading", and confirms what "Search this area" found
  async function fetchArea(center, fromButton = false) {
    if (fetching) return;
    try { await loadArea(center); }
    catch { setStatus('retry'); renderList(); }
    finally { fetching = false; }
    if (fromButton) {
      const n = lastRanked.length;
      toast(n ? `Found ${n} restroom${n === 1 ? '' : 's'} in this area` : 'No restrooms found here yet — zoom out a bit or tap Add');
      if (typeof panelState !== 'undefined' && panelState === 'min') setPanel('mid');
    }
  }
  async function loadArea(center) {
    if (fetching) return;
    fetching = true; $('#searchAreaBtn').hidden = true;
    setStatus('Looking for restrooms…'); renderList();
    const [lat, lng] = center, r = CONFIG.searchRadius;
    const A = `(around:${r},${lat},${lng})`, A2 = `(around:${Math.round(r * .8)},${lat},${lng})`, U = '["toilets"!~"^(no|yes)$"]';
    const q1 = `[out:json][timeout:25];(
      node["amenity"="toilets"]${A};
      way["amenity"="toilets"]${A};
      node["amenity"="shower"]${A};
      nwr["toilets"="yes"]["name"]${A};
    );out center tags 300;`;
    const q2 = `[out:json][timeout:25];(
      nwr["amenity"="fuel"]${U}${A2};
      nwr["amenity"~"^(fast_food|restaurant|cafe|cinema|theatre)$"]${U}${A2};
      nwr["shop"~"^(supermarket|department_store|doityourself|hardware|wholesale)$"]${U}${A2};
      nwr["tourism"~"^(hotel|motel|museum)$"]${U}${A2};
      nwr["leisure"="park"]["name"]${U}${A2};
      nwr["shop"="mall"]${U}${A2};
      nwr["amenity"~"^(library|hospital|community_centre)$"]${U}${A2};
      nwr["highway"~"^(rest_area|services)$"]${U}${A2};
    );out center tags 450;`;
    const dLat = (r * 1.6) / 111320, dLng = dLat / Math.cos(toRad(lat));
    const communityP = API.enabled && navigator.onLine
      ? API.placesInBox({ min_lat: lat - dLat, min_lng: lng - dLng, max_lat: lat + dLat, max_lng: lng + dLng }).then((rows) => (rows || []).map(fromSB)).catch(() => null)
      : Promise.resolve(null);
    // Confirmed restrooms and "likely" places load separately, so a slow likely search never blanks the map
    // Main source: Geoapify (hosted, reliable) when a key is set; volunteer Overpass servers as backup
    let d1 = null, d2 = null;
    if (navigator.onLine && GEO_KEY) {
      let d3;
      [d1, d2, d3] = await Promise.all([geoapify(GEO_CONFIRMED, lat, lng, r, 300), geoapify(GEO_LIKELY, lat, lng, Math.round(r * .85), 500), geoapify(GEO_EXTRA, lat, lng, Math.round(r * .85), 300)]);
      if (d3) d2 = { elements: [...((d2 && d2.elements) || []), ...d3.elements] };
    }
    if (navigator.onLine && !d1 && !d2) [d1, d2] = await Promise.all([overpass(q1), overpass(q2)]);
    let data = d1 || d2 ? { elements: [...((d1 && d1.elements) || []), ...((d2 && d2.elements) || [])] } : null;
    if (data) { const seen = new Set(); data.elements = data.elements.filter((e) => { const k = `${e.type}-${e.id}`; if (seen.has(k)) return false; seen.add(k); return true; }); }
    const comm = await communityP;
    fetching = false;
    if (comm) { community = comm; LS.set('bloop_community', community); }
    if (data) {
      places = data.elements.map(fromOSM).filter(Boolean);
      lastFetchCenter = center;
      LS.set('bloop_cache', { center, items: places, ts: Date.now() });
      setStatus('');
    } else {
      const c = LS.get('bloop_cache', null);
      if (c) { places = c.items; lastFetchCenter = c.center; setStatus(`No connection — showing saved results from ${timeAgo(c.ts)}`); }
      else setStatus(navigator.onLine ? 'retry' : 'You’re offline and nothing is saved yet.');
    }
    renderList();
    refreshStats(allPlaces().map((p) => p.id).filter((id) => !id.startsWith('user-')));
  }
  // ---------- Restroom details people can confirm or correct ----------
  const ATTRS = [
    ['unisex', 'people', 'Unisex / gender neutral'], ['accessible', 'wheelchair', 'Accessible (ADA)'],
    ['baby', 'baby', 'Baby changing station'], ['public', 'lock', 'Public access (no purchase)'],
    ['free', 'tag', 'Free to use'], ['showers', 'shower', 'Showers'], ['luxe', 'star', '✨ Luxe — a beautiful restroom']
  ];
  const baseAttr = (p, k) => {
    const t = (v) => (v === true ? 'yes' : v === false ? 'no' : null);
    if (k === 'unisex') return t(p.unisex);
    if (k === 'accessible') return p.acc === 'yes' || p.acc === 'limited' || p.acc === 'no' ? p.acc : null;
    if (k === 'baby') return t(p.baby);
    if (k === 'public') return t(p.pub);
    if (k === 'free') return p.fee === true ? 'no' : p.fee === false ? 'yes' : null;
    if (k === 'showers') return t(p.showers);
    return null;
  };
  // Your answer wins on your phone; otherwise the community's most common answer; otherwise the map listing
  function attrInfo(p, k) {
    const mine = (LS.get('bloop_attrs', {})[p.id] || {})[k];
    if (mine) return { v: mine, src: 'you' };
    const c = stats[p.id] && stats[p.id].attrs && stats[p.id].attrs[k];
    if (c && c.v) return { v: c.v, src: 'community', n: c.n };
    const b = baseAttr(p, k); return { v: b, src: b ? 'listing' : null };
  }
  // ✨ Luxe: you said so, or most people who answered said yes
  function isLuxe(p) { const a = attrInfo(p, 'luxe'); return a.v === 'yes' && (a.src === 'you' || (a.n || 0) >= 1); }
  const LUXE_BADGE_HTML = '<span class="badge luxe">👑 LUXE</span>';
  function withAttrs(p) {
    const has = LS.get('bloop_attrs', {})[p.id] || (stats[p.id] && stats[p.id].attrs && Object.keys(stats[p.id].attrs).length);
    if (!has) return p;
    const q = { ...p }; const g = (k) => attrInfo(p, k).v; const yn = (v) => (v === 'yes' ? true : v === 'no' ? false : null);
    if (g('unisex')) q.unisex = yn(g('unisex'));
    if (g('accessible')) q.acc = g('accessible');
    if (g('baby')) q.baby = yn(g('baby'));
    if (g('public')) { q.pub = yn(g('public')); q.customersOnly = g('public') === 'no'; }
    if (g('free')) q.fee = g('free') === 'no';
    if (g('showers')) q.showers = yn(g('showers'));
    return q;
  }
  function allPlaces() {
    const seen = new Set(community.map((p) => p.id));
    return [...places, ...community, ...Store.userPlaces().filter((p) => !seen.has(p.id))].map(withAttrs);
  }
  const findPlace = (id) => allPlaces().find((p) => p.id === id) || Store.saved()[id] || null;

  // ---------- Filters ----------
  const CHIPS = [['all', 'All'], ['clean', '✨ Bloop Clean'], ['luxe', '👑 Luxe'], ['confirmed', 'Confirmed', 'check'], ['free', 'Free'], ['h24', '24 hr'], ['accessible', 'Accessible', 'wheelchair'], ['family', 'Family', 'family'], ['open', 'Open now'], ['public', 'Public'], ['business', 'Business'], ['showers', 'Showers', 'shower']];
  function passes(p) {
    if (isHiddenPlace(p)) return false;
    if (filters.has('confirmed') && !isConfirmed(p)) return false;
    if (filters.has('clean') && !isBloopClean(p)) return false;
    if (filters.has('luxe') && !isLuxe(p)) return false;
    const h = hoursInfo(p.hours);
    if (filters.has('free') && (p.fee === true || (p.fee == null && p.inside))) return false;
    if (filters.has('h24') && !h.h24) return false;
    if (filters.has('accessible') && p.acc !== 'yes') return false;
    if (filters.has('family') && !(p.baby || p.unisex)) return false;
    if (filters.has('open') && h.open !== true) return false;
    if (filters.has('public') && p.inside) return false;
    if (filters.has('business') && !p.inside) return false;
    if (filters.has('showers') && !p.showers) return false;
    return true;
  }
  function renderChips() {
    $('#chips').innerHTML = CHIPS.map(([k, label, icon]) => `<button class="chip ${(k === 'all' ? !filters.size : filters.has(k)) ? 'active' : ''}" data-f="${k}">${icon ? I(icon) : ''}${label}</button>`).join('');
  }
  function setFilter(k, only = false) {
    if (k === 'all') filters.clear();
    else if (only) { filters.clear(); filters.add(k); }
    else filters.has(k) ? filters.delete(k) : filters.add(k);
    renderChips(); renderList();
  }

  // ---------- List ----------
  const refPoint = () => me || (map ? (() => { const c = map.getCenter(); return [c.lat, c.lng]; })() : CONFIG.defaultCenter);
  // The list follows the area you searched; if you're standing inside that area, it's sorted from where you are
  const areaRef = () => (me && (!lastFetchCenter || distM(me, lastFetchCenter) <= CONFIG.searchRadius) ? me : lastFetchCenter || refPoint());
  function ranked(list, fromMe = false) {
    const ref = fromMe ? refPoint() : areaRef();
    return list.map((p) => ({ ...p, d: distM(ref, [p.lat, p.lng]), dShow: me ? distM(me, [p.lat, p.lng]) : null })).map((p) => {
      const h = hoursInfo(p.hours); const r = ratingInfo(p.id).avg; const ci = latestCheckin(p.id);
      let w = p.d * (isConfirmed(p) ? 1 : 1.7) * (p.inside ? 1.2 : 1) * (h.open === false ? 3 : 1) * (r ? 1.15 - r * 0.05 : 1);
      if (badStatus(p.id)) w *= 3;
      return { ...p, w };
    }).sort((a, b) => a.w - b.w);
  }
  function featIcons(p) {
    return [p.unisex ? I('people') : '', p.acc === 'yes' ? I('wheelchair') : '', p.baby ? I('baby') : '', p.showers ? I('shower') : ''].join('');
  }
  function rowHTML(p, opts = {}) {
    const h = hoursInfo(p.hours);
    const ci = latestCheckin(p.id);
    const recentBad = badStatus(p.id);
    const tip = tipsFor(p)[0];
    const pill = recentBad ? `<span class="status-pill ${recentBad.status === 'out of order' ? 'oos' : 'closed'}">${recentBad.status === 'closed' ? 'Reported closed' : '⚠ Out of order'}</span>`
      : h.open === true ? `<span class="status-pill">${esc(h.label)}</span>`
      : h.open === false ? `<span class="status-pill closed">${esc(h.label)}</span>`
      : `<span class="badge ${p.inside ? 'business' : 'public'}">${p.inside ? 'BUSINESS' : 'PUBLIC'}</span>`;
    const r = ratingInfo(p.id);
    const cover = coverUrl(p);
    const saved = !!Store.saved()[p.id];
    return `<li class="row ${p.id === detailId ? 'selected' : ''}" data-id="${esc(p.id)}">
      <div class="thumb">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : art(p.cat)}</div>
      <div class="row-main">
        <div class="row-name">${esc(p.name)}</div>
        <div class="row-sub">${(p.dShow ?? p.d) != null ? `${fmtDist(p.dShow ?? p.d)} • ${travelShort(p.dShow ?? p.d)}` : ''}${r.avg ? ` • ★ ${r.avg}` : ''}${p.fee === true ? ' • Paid' : ''}</div>
        <div class="row-feat">${isLuxe(p) ? LUXE_BADGE_HTML : ''}${isBloopClean(p) ? CLEAN_BADGE_HTML : ''}${isConfirmed(p) ? '' : '<span class="badge likely">LIKELY</span>'}${pill}${featIcons(p)}</div>
        ${tip ? `<div class="row-tip">${I(TIP_KINDS[tip.kind] ? TIP_KINDS[tip.kind][1] : 'info')}<span>${esc(tip.text || TIP_KINDS[tip.kind][0])}</span></div>` : ''}
      </div>
      <div class="row-side">
        <button class="heart ${saved ? 'on' : ''}" data-save="${esc(p.id)}" aria-label="Save">${I('heart')}</button>
        ${I('chev')}
      </div>
    </li>`;
  }
  let lastRanked = [];
  function renderCleanest() {
    const el = $('#cleanest'); if (!el) return;
    const ref = refPoint();
    const top = allPlaces().filter((p) => !isHiddenPlace(p)).map((p) => ({ p, r: ratingInfo(p.id), d: distM(ref, [p.lat, p.lng]) }))
      .filter((x) => x.r.n >= 3 && x.d < 8000).map((x) => ({ ...x, s: x.r.subs && x.r.subs.clean != null ? x.r.subs.clean : x.r.avg }))
      .sort((a, b) => b.s - a.s || b.r.n - a.r.n).slice(0, 8);
    el.hidden = !top.length;
    $('#cleanestList').innerHTML = top.map(({ p, r, d, s }) => `<button class="clean-card" data-id="${esc(p.id)}">
      <div class="thumb">${coverUrl(p) ? `<img src="${esc(coverUrl(p))}" alt="" loading="lazy">` : art(p.cat)}</div>
      <b>${esc(p.name)}</b><span>${I('star')} ${(+s).toFixed(1)} · ${r.n} reviews</span><small>${fmtDist(d)}${isBloopClean(p) ? ' · ✨ Bloop Clean' : ''}</small></button>`).join('');
  }
  function renderFanciest() {
    const el = $('#fanciest'); if (!el) return;
    const ref = refPoint();
    const top = allPlaces().filter((p) => !isHiddenPlace(p) && isLuxe(p)).map((p) => ({ p, r: ratingInfo(p.id), d: distM(ref, [p.lat, p.lng]) }))
      .filter((x) => x.d < 25000).sort((a, b) => (b.r.avg || 0) - (a.r.avg || 0) || a.d - b.d).slice(0, 8);
    el.hidden = !top.length;
    $('#fanciestList').innerHTML = top.map(({ p, r, d }) => `<button class="clean-card" data-id="${esc(p.id)}">
      <div class="thumb">${coverUrl(p) ? `<img src="${esc(coverUrl(p))}" alt="" loading="lazy">` : art(p.cat)}</div>
      <b>${esc(p.name)}</b><span>${r.avg ? `${I('star')} ${(+r.avg).toFixed(1)} · ${r.n} reviews` : 'New · rate it'}</span><small>${fmtDist(d)} · 👑 Luxe</small></button>`).join('');
  }
  function renderList() {
    renderCleanest(); renderFanciest();
    if (!map) return;
    const list = ranked(allPlaces().filter(passes)).filter((p) => p.d < CONFIG.searchRadius * 3);
    lastRanked = list;
    const keep = new Set(list.map((p) => p.id));
    for (const [id, m] of markers) if (!keep.has(id)) { map.removeLayer(m); markers.delete(id); }
    for (const p of list) {
      if (!markers.has(p.id)) { const m = L.marker([p.lat, p.lng], { icon: pinIcon(p, p.id === detailId) }).addTo(map); m.on('click', () => openDetail(p.id)); markers.set(p.id, m); }
      else markers.get(p.id).setIcon(pinIcon(p, p.id === detailId));
    }
    $('#listCount').textContent = list.length ? `(${list.length})` : '';
    $('#list').innerHTML = list.length ? list.slice(0, 80).map((p) => rowHTML(p)).join('')
      : fetching ? '' : `<li class="empty">No restrooms match here.<br>${filters.size ? 'Try another filter, or ' : ''}tap <b>Add</b> to share one you know.</li>`;
  }

  // ---------- Detail ----------
  let editingAttr = null;
  function attrRow(p, k, icon, label) {
    const a = attrInfo(p, k), v = a.v;
    const mark = v === 'yes' ? `<span class="yes">${I('check')}</span>` : v === 'limited' ? '<span class="unk" style="color:#d97706">LIMITED</span>' : v === 'no' ? `<span class="no">${I('x')}</span>` : '<span class="unk">TAP TO ADD</span>';
    const src = a.src === 'you' ? 'You confirmed this' : a.src === 'community' ? `Confirmed by ${a.n} ${a.n === 1 ? 'person' : 'people'}` : a.src === 'listing' ? 'From the map listing · tap to confirm' : '';
    const opts = k === 'accessible' ? [['yes', 'Yes'], ['limited', 'Limited'], ['no', 'No']] : [['yes', 'Yes'], ['no', 'No']];
    return `<button class="feat attr" data-act="attr" data-k="${k}">${I(icon)}<span class="lbl">${label}${src ? `<small>${src}</small>` : ''}</span>${mark}</button>
      ${editingAttr === k ? `<div class="attr-edit">${opts.map(([val, l]) => `<button data-act="setattr" data-k="${k}" data-v="${val}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}<button data-act="setattr" data-k="${k}" data-v="" class="skip">Not sure</button></div>` : ''}`;
  }
  let photoIdx = 0;
  function openDetail(id, push = true) {
    const p = findPlace(id); if (!p) return;
    const was = detailId; detailId = id; photoIdx = 0; if (was !== id) editingAttr = null;
    if (push) { if (was) history.replaceState({ tab: currentTab, detail: id }, ''); else history.pushState({ tab: currentTab, detail: id }, ''); }
    $('#detail').hidden = false; $('#detailCta').hidden = false; $('#detail').scrollTop = 0;
    renderDetail(); renderList();
    if (map && currentTab === 'map') map.panTo([p.lat, p.lng], { animate: true });
    if (API.enabled && navigator.onLine && !id.startsWith('user-')) {
      API.reviews(id).then((r) => { reviewsCache[id] = r || []; if (detailId === id) renderDetail(); }).catch(() => {});
      API.tips(id).then((r) => { tipsCache[id] = r || []; if (detailId === id) renderDetail(); }).catch(() => {});
      API.photos(id).then((r) => { photosCache[id] = r || []; if (detailId === id) renderDetail(); }).catch(() => {});
      refreshStats([id]);
    }
  }
  function closeDetail() {
    detailId = null; $('#detail').hidden = true; $('#detailCta').hidden = true; renderList();
  }
  function photosFor(p) {
    const mine = (Store.myPhotos()[p.id] || []);
    const remote = (photosCache[p.id] || []).map((x) => API.photoUrl(x.path));
    return [...mine, ...remote];
  }
  function renderDetail() {
    const p = findPlace(detailId); if (!p) return;
    const d = me ? distM(me, [p.lat, p.lng]) : null;
    const h = hoursInfo(p.hours);
    const r = ratingInfo(p.id);
    const ci = latestCheckin(p.id);
    const saved = !!Store.saved()[p.id];
    const pics = photosFor(p);
    if (photoIdx >= pics.length) photoIdx = 0;
    const myR = Store.ratings()[p.id];
    let reviews = (reviewsCache[p.id] || []).map((x) => ({ name: x.nickname || 'Anonymous', stars: x.stars, text: x.comment, ts: Date.parse(x.created_at), subs: { clean: x.clean, stocked: x.stocked, smell: x.smell, safe: x.safe } }));
    if (myR && myR.comment && !reviews.some((x) => x.text === myR.comment)) reviews.unshift({ name: Prefs.nick || 'You', stars: myR.v, text: myR.comment, ts: myR.ts, subs: myR.subs || {} });
    const showAll = $('#detail').dataset.all === p.id;
    const starRow = (n) => `<span class="stars-row">${[1, 2, 3, 4, 5].map((i) => I('star', i <= n ? '' : 'off')).join('')}</span>`;
    const pill = h.open === true ? `<span class="status-pill">${esc(h.label)}</span>` : h.open === false ? `<span class="status-pill closed">${esc(h.label)}</span>` : `<span class="status-pill unknown">${esc(h.label)}</span>`;
    const unconfirmed = !isConfirmed(p);
    const kindLabel = unconfirmed ? `Likely restroom · ${(CAT[p.cat] || CAT.other).label}` : p.src === 'community' ? 'Added by the Bloop community' : p.src === 'user' ? (API.enabled ? 'Added by you · uploading when online' : 'Added by you') : (CAT[p.cat] || CAT.other).label;

    $('#detail').innerHTML = `
      <div class="d-head">
        <button data-act="back" aria-label="Back">${I('back')}</button>
        <div class="logo"><img src="icons/logo.svg" alt=""><span class="wordmark">Bloop</span></div>
        <button data-act="save" aria-label="Save">${saved ? `<svg class="ico" style="fill:#ff4d8d;stroke:#ff4d8d"><use href="#i-heart"/></svg>` : I('heart')}</button>
        <button data-act="share" aria-label="Share">${I('share')}</button>
      </div>
      <div class="d-hero">
        ${pics.length ? `<img src="${esc(pics[photoIdx])}" alt="Photo of ${esc(p.name)}">
          ${pics.length > 1 ? '<button class="nav prev" data-act="prev" aria-label="Previous photo"></button><button class="nav next" data-act="next" aria-label="Next photo"></button>' : ''}
          <div class="count">${I('image')} ${photoIdx + 1}/${pics.length}</div>`
        : `${art(p.cat)}<button class="add-photo" data-act="update">${I('camera')} Add the first photo</button>`}
      </div>
      <div class="d-top">
        <div>
          <h1>${esc(p.name)}</h1>
          <div class="sub">${d != null ? `${fmtDist(d)} • ${travel(d)}` : esc(kindLabel)}</div>
          ${pill}${isBloopClean(p) ? ' ' + CLEAN_BADGE_HTML : ''}${isLuxe(p) ? ' ' + LUXE_BADGE_HTML : ''}
        </div>
        <div class="score">
          <small>Bloop Score</small>
          <div class="num">${r.avg ? `${r.avg.toFixed(1)}${I('star')}<span>(${r.n})</span>` : '<span style="font-size:1rem">No ratings yet</span>'}</div>
          <div class="bar"><i style="width:${r.avg ? (r.avg / 5) * 100 : 0}%"></i></div>
        </div>
      </div>
      ${SUBS.some(([k]) => r.subs && r.subs[k] != null) ? `<div class="card breakdown">${SUBS.map(([k, l, ic]) => r.subs[k] != null ? `<div class="bd-row">${I(ic)}<span>${l}</span><div class="bar"><i style="width:${(r.subs[k] / 5) * 100}%"></i></div><b>${(+r.subs[k]).toFixed(1)}</b></div>` : '').join('')}</div>` : ''}
      ${badStatus(p.id) ? `<div class="status-banner ${badStatus(p.id).status === 'out of order' ? 'oos' : ''}">${I('info')}<span><b>${badStatus(p.id).status === 'out of order' ? 'Reported out of order' : 'Reported closed'}</b> · ${timeAgo(badStatus(p.id).ts)}. You may want a different restroom.</span></div>` : ''}
      <div class="actions">
        <button class="act primary" data-act="nav">${I('nav')}Navigate</button>
        <a class="act ${p.phone ? '' : 'disabled'}" href="${p.phone ? 'tel:' + esc(p.phone.replace(/[^\d+]/g, '')) : '#'}">${I('phone')}Call</a>
        <button class="act ${saved ? 'on' : ''}" data-act="save">${I('heart')}${saved ? 'Saved' : 'Save'}</button>
        <button class="act" data-act="report">${I('flag')}Report</button>
      </div>
      ${unconfirmed ? '' : `<div class="card">
        <h3>${I('clock')}Right now</h3>
        <p class="muted small" style="margin:0 0 10px">${ci ? `Last report: <b>${esc(ci.status)}</b> · ${timeAgo(ci.ts)}` : 'No reports yet. Here now? Let others know.'}</p>
        <div class="now-btns">
          <button class="st-open" data-act="st" data-v="open">${I('check')}Open</button>
          <button class="st-closed" data-act="st" data-v="closed">${I('x')}Closed</button>
          <button class="st-oos" data-act="st" data-v="out of order">${I('info')}Out of order</button>
        </div>
      </div>`}
      ${unconfirmed ? `<div class="card confirm-card">
        <h3>${I('info')}Not confirmed yet</h3>
        <p class="muted" style="margin:0 0 10px">${esc(LIKELY_NOTE[p.cat] || LIKELY_NOTE.other)} Been here? Help others know for sure.</p>
        <div class="confirm-btns"><button class="btn grad" data-act="yes">${I('check')}Yes, there's one</button><button class="btn" data-act="no">${I('x')}No restroom</button></div>
      </div>` : ''}
      <div class="card">
        <h3>${I('toilet')}Restroom Details</h3>
        <p class="muted small" style="margin:-2px 0 4px">Been here? Tap any line to confirm or correct it.</p>
        ${ATTRS.map(([k, icon, label]) => attrRow(p, k, icon, label)).join('')}
      </div>
      <div class="card">
        <div class="info-line">${I('pin')}<span>${esc(kindLabel)}${p.addr ? ' · ' + esc(p.addr) : ''}</span></div>
        ${p.hours ? `<div class="info-line">${I('clock')}<span>${esc(p.hours)}</span></div>` : ''}
      </div>
      <div class="card">
        <h3>${I('key')}How to get in <button class="link" data-act="tip">Add tip</button></h3>
        ${whereFor(p) ? '' : `<button class="where-cta" data-act="where">${I('pin')}<span>Know where the restroom is inside? <b>Add it</b></span></button>`}
        ${tipsFor(p).length ? tipsFor(p).slice(0, 4).map((t) => `<div class="tip-row">${I(TIP_KINDS[t.kind] ? TIP_KINDS[t.kind][1] : 'info')}<div><b>${esc((TIP_KINDS[t.kind] || TIP_KINDS.other)[0])}</b>${t.text ? `<div>${esc(t.text)}</div>` : ''}<small class="muted">${t.lat != null && t.kind === 'where' ? '📍 Exact spot pinned · ' : ''}${t.listing ? 'From the listing' : t.mine ? `You · ${timeAgo(t.ts)}` : timeAgo(t.ts)}</small></div></div>`).join('')
          : '<p class="muted" style="margin:6px 0">No tips yet. Know where the key is, or the door code? Tap “Add tip”.</p>'}
      </div>
      <div class="card">
        <h3>User Reviews ${reviews.length ? `(${reviews.length})` : ''} ${reviews.length > 2 && !showAll ? '<button class="link" data-act="all">View All</button>' : ''}</h3>
        ${reviews.length ? reviews.slice(0, showAll ? 50 : 2).map((x) => `
          <div class="review"><div class="avatar">${esc((x.name || 'A')[0].toUpperCase())}</div>
            <div><b>${esc(x.name)}</b>${starRow(x.stars)} <span class="muted small">&nbsp;${timeAgo(x.ts)}</span>${x.subs && SUBS.some(([k]) => x.subs[k]) ? `<div class="sub-chips">${SUBS.filter(([k]) => x.subs[k]).map(([k, l]) => `<span>${l.split(' ')[0]} ${x.subs[k]}★</span>`).join('')}</div>` : ''}<p>${esc(x.text)}</p></div></div>`).join('')
          : '<p class="muted" style="margin:6px 0">No reviews yet. Be the first — tap “Add Update / Photo”.</p>'}
      </div>`;
  }
  function onDetailClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const p = findPlace(detailId); if (!p) return;
    const act = b.dataset.act;
    if (act === 'back') history.back();
    else if (act === 'save') { const on = Store.toggleSave(p); toast(on ? 'Saved' : 'Removed from Saved'); renderDetail(); renderList(); }
    else if (act === 'share') shareP(p);
    else if (act === 'update') openUpdate(p);
    else if (act === 'all') { $('#detail').dataset.all = p.id; renderDetail(); }
    else if (act === 'prev' || act === 'next') { const n = photosFor(p).length; photoIdx = (photoIdx + (act === 'next' ? 1 : n - 1)) % n; renderDetail(); }
    else if (act === 'report') openReport(p);
    else if (act === 'nav') startNav(p);
    else if (act === 'attr') { editingAttr = editingAttr === b.dataset.k ? null : b.dataset.k; renderDetail(); }
    else if (act === 'setattr') {
      const k = b.dataset.k, v = b.dataset.v; editingAttr = null;
      if (v) {
        const all = LS.get('bloop_attrs', {}); (all[p.id] = all[p.id] || {})[k] = v; LS.set('bloop_attrs', all);
        if (v === 'yes' && p.likely) { const c = LS.get('bloop_confirmed', []); if (!c.includes(p.id)) { c.push(p.id); LS.set('bloop_confirmed', c); } }
        Outbox.push({ type: 'attr', payload: { place_id: p.id, attr: k, value: v } });
        toast('Thanks — updated for everyone');
      }
      renderDetail(); renderList();
    }
    else if (act === 'tip') openUpdate(p, true);
    else if (act === 'where') openUpdate(p, 'where');
    else if (act === 'st') {
      const v = b.dataset.v;
      Store.checkin(p.id, v); Outbox.push({ type: 'checkin', payload: { place_id: p.id, status: v } });
      if (v === 'open' && p.likely) { const c = LS.get('bloop_confirmed', []); if (!c.includes(p.id)) { c.push(p.id); LS.set('bloop_confirmed', c); } }
      toast(v === 'open' ? 'Thanks — marked open' : v === 'closed' ? 'Thanks — marked closed' : 'Thanks — marked out of order');
      renderDetail(); renderList();
    }
    else if (act === 'yes') {
      const c = LS.get('bloop_confirmed', []); if (!c.includes(p.id)) { c.push(p.id); LS.set('bloop_confirmed', c); }
      Store.checkin(p.id, 'open'); Outbox.push({ type: 'checkin', payload: { place_id: p.id, status: 'open' } });
      toast('Thanks! It’s now confirmed'); renderDetail(); renderList();
    } else if (act === 'no') {
      const n = LS.get('bloop_norestroom', []); if (!n.includes(p.id)) { n.push(p.id); LS.set('bloop_norestroom', n); }
      Outbox.push({ type: 'report', payload: { place_id: p.id, reason: 'no_restroom', details: '' } });
      toast('Thanks — we’ll hide it'); history.back(); setTimeout(renderList, 50);
    }
  }
  async function shareP(p) {
    const url = `${location.origin}${location.pathname}?place=${encodeURIComponent(p.id)}&ll=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const text = `🚻 ${p.name} — found with Bloop`;
    if (navigator.share) { try { await navigator.share({ title: 'Bloop', text, url }); } catch {} }
    else { try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch { toast(url, 5000); } }
  }
  const rep = { place: null, reason: null };
  function openReport(p) {
    const done = LS.get('bloop_reported', []);
    if (done.includes(p.id)) { toast('You already reported this one — thanks'); return; }
    rep.place = p; rep.reason = null;
    $('#reportForm').reset(); $('#repFor').textContent = p.name;
    $$('#repReasons button').forEach((b) => b.classList.remove('on'));
    openSheet('#reportSheet');
  }
  function submitReport(e) {
    e.preventDefault();
    if (!rep.reason) { toast('Pick what’s wrong first'); return; }
    const p = rep.place; const details = e.target.details.value.trim();
    const done = LS.get('bloop_reported', []); done.push(p.id); LS.set('bloop_reported', done);
    if (p.src !== 'user') Outbox.push({ type: 'report', payload: { place_id: p.id, reason: rep.reason, details } });
    closeSheets(); toast('Thanks — we’ll take a look');
  }

  // ---------- Update sheet (rating / review / check-in / photo) ----------
  const upd = { place: null, stars: 0, subs: {}, status: null, file: null, tipKind: null, wherePt: null, luxe: false };
  function openSheet(sel) { $('#backdrop').hidden = false; $(sel).hidden = false; }
  function closeSheets() { $('#backdrop').hidden = true; $$('.sheet').forEach((s) => (s.hidden = true)); }
  function openUpdate(p, focusTip = false) {
    Object.assign(upd, { place: p, stars: Store.ratings()[p.id]?.v || 0, subs: { ...((Store.ratings()[p.id] || {}).subs || {}) }, status: null, file: null, tipKind: null, wherePt: null, luxe: false });
    $('#wherePinState').textContent = '';
    $('#updateForm').reset(); $('#photoPreview').hidden = true;
    $('#updFor').textContent = p.name;
    $('#postingAs').textContent = `Posting as ${Prefs.nick || 'Anonymous'} · change your name in Account`;
    paintUpdate(); openSheet('#updateSheet');
    if (focusTip) setTimeout(() => { $(focusTip === 'where' ? '#whereField' : '#tipField').scrollIntoView({ block: 'center' }); }, 250);
  }
  function paintUpdate() {
    $('#subRates').innerHTML = SUBS.map(([k, label]) => `<div class="sub-rate"><span>${label}</span><div class="mini-stars" data-sub="${k}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" class="${i <= (upd.subs[k] || 0) ? 'on' : ''}" aria-label="${label} ${i} stars">${I('star')}</button>`).join('')}</div></div>`).join('');
    $('#rateBig').innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-s="${i}" class="${i <= upd.stars ? 'on' : ''}" aria-label="${i} stars">${I('star')}</button>`).join('');
    $$('#segStatus button').forEach((b) => b.classList.toggle('on', b.dataset.v === upd.status));
    $$('#segTip button').forEach((b) => b.classList.toggle('on', b.dataset.k === upd.tipKind));
    $('#luxeBtn').classList.toggle('on', upd.luxe);
  }
  async function compress(file, max, asDataUrl) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }
    const s = Math.min(1, max / Math.max(src.width, src.height));
    const c = document.createElement('canvas'); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return asDataUrl ? c.toDataURL('image/jpeg', 0.7) : new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
  }
  async function submitUpdate(e) {
    e.preventDefault();
    const p = findPlace(liveId(upd.place.id)) || { ...upd.place, id: liveId(upd.place.id) }; const comment = e.target.comment.value.trim();
    const tipText = (e.target.tip.value || '').trim();
    const whereText = (e.target.where.value || '').trim();
    if (upd.luxe) {
      const all = LS.get('bloop_attrs', {}); (all[p.id] = all[p.id] || {}).luxe = 'yes'; LS.set('bloop_attrs', all);
      Outbox.push({ type: 'attr', payload: { place_id: p.id, attr: 'luxe', value: 'yes' } });
    }
    if (!upd.luxe && !upd.stars && !upd.status && !upd.file && !upd.tipKind && !tipText && !whereText && !upd.wherePt) { toast('Add a rating, a status, a tip or a photo first'); return; }
    if (whereText || upd.wherePt) {
      Store.addTip(p.id, 'where', whereText, upd.wherePt);
      Outbox.push({ type: 'tip', payload: { place_id: p.id, kind: 'where', tip: whereText, lat: upd.wherePt ? upd.wherePt[0] : null, lng: upd.wherePt ? upd.wherePt[1] : null } });
    }
    if (upd.tipKind || tipText) {
      const kind = upd.tipKind || 'other';
      Store.addTip(p.id, kind, tipText);
      Outbox.push({ type: 'tip', payload: { place_id: p.id, kind, tip: tipText } });
    }
    if ((comment || Object.values(upd.subs).some(Boolean)) && !upd.stars) { toast('Give it an overall star rating too'); return; }
    if (upd.stars) {
      const subs = Object.fromEntries(SUBS.map(([k]) => [k, upd.subs[k] || null]));
      Store.rate(p.id, upd.stars, comment, subs);
      Outbox.push({ type: 'rating', payload: { place_id: p.id, stars: upd.stars, comment: comment || null, nickname: Prefs.nick || null, ...subs } });
    }
    if (upd.status) { Store.checkin(p.id, upd.status); Outbox.push({ type: 'checkin', payload: { place_id: p.id, status: upd.status } }); }
    let msg = 'Thanks for the update!';
    if (upd.file) {
      try {
        Store.addMyPhoto(p.id, await compress(upd.file, 480, true)); Store.bump('bloop_photo_count');
        if (API.enabled) {
          // Queue it like everything else: uploads now if there's signal, or later when there is
          const key = `ph-${Date.now().toString(36)}`;
          await PhotoQ.put(key, await compress(upd.file, 1280, false));
          Outbox.push({ type: 'photo', payload: { place_id: p.id, key } });
          msg = navigator.onLine ? 'Thanks! Your photo will appear for everyone once approved.' : 'Photo saved — it’ll upload when you’re back in signal.';
        }
      } catch { msg = 'Update saved, but the photo couldn’t be saved.'; }
    }
    closeSheets(); toast(msg); renderDetail(); renderList();
  }

  // ---------- "You're at Target" prompts (only while Bloop is open) ----------
  const Here = { anchor: null, t0: 0, checked: false, watch: null, current: null };
  const hereOn = () => LS.get('bloop_here', true);
  const DWELL_MS = () => LS.get('bloop_dwell_ms', 60000);
  const NOT_PLACES = /^(parking|parking_entrance|bench|waste_basket|atm|bicycle_parking|vending_machine|toilets|shower|fountain|drinking_water|post_box|telephone|charging_station|recycling|bus_station|taxi|clock|shelter)$/;
  function startPresence() {
    if (!hereOn() || !navigator.geolocation || Here.watch != null || document.visibilityState === 'hidden') return;
    Here.watch = navigator.geolocation.watchPosition(onPresence, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  function stopPresence() { if (Here.watch != null) { navigator.geolocation.clearWatch(Here.watch); Here.watch = null; } }
  function onPresence(pos) {
    if (nav) return; // navigation has its own tracking
    const ll = [pos.coords.latitude, pos.coords.longitude];
    setMe(ll, pos.coords.accuracy);
    if (pos.coords.accuracy > 60) return;
    if (!Here.anchor || distM(Here.anchor, ll) > 45) { Here.anchor = ll; Here.t0 = Date.now(); Here.checked = false; }
    if (!Here.checked && Date.now() - Here.t0 >= DWELL_MS()) { Here.checked = true; checkHere(ll); }
  }
  // Called again on a timer, since a phone that isn't moving may not send new positions
  setInterval(() => { if (Here.anchor && !Here.checked && !nav && Date.now() - Here.t0 >= DWELL_MS()) { Here.checked = true; checkHere(Here.anchor); } }, 10000);
  async function lookupHere(ll) {
    const [lat, lng] = ll; let els = [];
    try {
      if (GEO_KEY && navigator.onLine) {
        const url = `https://api.geoapify.com/v2/places?categories=commercial,catering,service.vehicle.fuel,accommodation,entertainment,leisure.park,healthcare.hospital,education.library,sport&filter=circle:${lng},${lat},60&bias=proximity:${lng},${lat}&limit=8&apiKey=${encodeURIComponent(GEO_KEY)}`;
        const r = await fetch(url); if (r.ok) els = geoToElements(await r.json(), false);
      }
      if (!els.length && navigator.onLine) {
        const j = await overpass(`[out:json][timeout:10];nwr["name"][~"^(shop|amenity|tourism|leisure)$"~"."](around:60,${lat},${lng});out center tags 15;`, 12000);
        els = (j && j.elements) || [];
      }
    } catch {}
    const places = els.filter((e) => e.tags && (e.tags.name || e.tags.brand) && !NOT_PLACES.test(e.tags.amenity || ''))
      .map(fromOSM).filter(Boolean).map((p) => ({ p, d: distM(ll, [p.lat, p.lng]) })).sort((x, y) => x.d - y.d);
    return places[0] && places[0].d <= 80 ? places[0].p : null;
  }
  async function checkHere(ll) {
    if (!hereOn() || nav || pinMode || document.body.classList.contains('adding') || !$('#backdrop').hidden || !$('#herePrompt').hidden) return;
    if (Date.now() - LS.get('bloop_here_last', 0) < 20 * 60e3) return;
    const asked = LS.get('bloop_here_asked', {});
    const fresh = (id) => !asked[id] || Date.now() - asked[id] > 30 * 864e5;
    const near = allPlaces().filter((p) => !isHiddenPlace(p)).map((p) => ({ p, d: distM(ll, [p.lat, p.lng]) })).filter((x) => x.d < 45).sort((x, y) => x.d - y.d)[0];
    if (near) { if (!isConfirmed(near.p) && fresh(near.p.id)) showHere('likely', near.p); return; }
    const poi = await lookupHere(ll);
    if (!poi || !fresh(poi.id)) return;
    const known = findPlace(poi.id);
    if (known) { if (!isConfirmed(known)) showHere('likely', known); return; }
    showHere('new', poi);
  }
  function showHere(type, p) {
    Here.current = { type, p };
    LS.set('bloop_here_last', Date.now());
    const asked = LS.get('bloop_here_asked', {}); asked[p.id] = Date.now(); LS.set('bloop_here_asked', asked);
    $('#hereTitle').textContent = `You’re at ${p.name}`;
    $('#hereText').textContent = type === 'new' ? `${p.name} isn’t on Bloop yet. Does it have a restroom?` : 'Is there a restroom here? Help others know for sure.';
    $('#hereArt').innerHTML = art(p.cat);
    $('#herePrompt').hidden = false;
  }
  function hereAnswer(ans) {
    const cur = Here.current; $('#herePrompt').hidden = true; Here.current = null; if (!cur) return;
    const p = cur.p;
    if (ans === 'later') { const asked = LS.get('bloop_here_asked', {}); asked[p.id] = Date.now() - 29 * 864e5; LS.set('bloop_here_asked', asked); return; }
    if (ans === 'no') {
      if (cur.type === 'likely') {
        const n = LS.get('bloop_norestroom', []); if (!n.includes(p.id)) { n.push(p.id); LS.set('bloop_norestroom', n); }
        Outbox.push({ type: 'report', payload: { place_id: p.id, reason: 'no_restroom', details: '' } }); renderList();
      }
      toast('Thanks for checking!'); return;
    }
    let place = p;
    if (cur.type === 'likely') {
      const c = LS.get('bloop_confirmed', []); if (!c.includes(p.id)) { c.push(p.id); LS.set('bloop_confirmed', c); }
      Store.checkin(p.id, 'open'); Outbox.push({ type: 'checkin', payload: { place_id: p.id, status: 'open' } });
    } else {
      const publicish = ['library', 'hospital', 'rest', 'mall', 'park'].includes(p.cat);
      place = {
        id: `user-${Date.now().toString(36)}`, src: 'user', lat: p.lat, lng: p.lng, name: p.name.slice(0, 80), cat: p.cat,
        inside: !publicish, fee: null, acc: null, baby: null, unisex: null, showers: null, pub: publicish ? true : null,
        access: publicish ? 'public' : 'customers', hours: p.hours || null, addr: p.addr || '', phone: p.phone || null, note: ''
      };
      Store.addUserPlace(place); Store.bump('bloop_added_count');
      Outbox.push({ type: 'place', payload: place });
    }
    renderList();
    toast(`Thanks! ${place.name} is on Bloop now`);
    setTimeout(() => openUpdate(place, 'where'), 400);
  }

  // ---------- Pin the exact restroom spot ----------
  let pinMode = null;
  function startWherePin() {
    const p = upd.place; if (!p) return;
    const f = $('#updateForm');
    pinMode = { place: p, keepForm: { comment: f.comment.value, tip: f.tip.value, where: f.where.value }, keepUpd: { ...upd } };
    $('#backdrop').hidden = true; $('#updateSheet').hidden = true;
    if (detailId) { $('#detail').hidden = true; $('#detailCta').hidden = true; }
    showTab('map', false);
    document.body.classList.add('adding');
    ['#crosshair', '#placeBar', '#placeHint'].forEach((s) => ($(s).hidden = false));
    $('#placeHint').textContent = 'Drag the map so the pin sits on the restroom';
    $('#placeConfirm').textContent = 'Restroom is here';
    const w = whereFor(p);
    map.setView(w && w.pt ? w.pt : [p.lat, p.lng], 19);
  }
  function finishWherePin(ok) {
    const pm = pinMode; pinMode = null; if (!pm) return;
    const c = map.getCenter();
    document.body.classList.remove('adding'); ['#crosshair', '#placeBar', '#placeHint'].forEach((s) => ($(s).hidden = true));
    $('#placeHint').textContent = 'Drag the map to put the pin on the restroom'; $('#placeConfirm').textContent = 'Pin here';
    if (detailId) { $('#detail').hidden = false; $('#detailCta').hidden = false; }
    Object.assign(upd, pm.keepUpd);
    if (ok) {
      if (distM([pm.place.lat, pm.place.lng], [c.lat, c.lng]) > 400) toast('That’s too far from this place — try again');
      else upd.wherePt = [c.lat, c.lng];
    }
    openSheet('#updateSheet'); paintUpdate();
    const f = $('#updateForm'); f.comment.value = pm.keepForm.comment; f.tip.value = pm.keepForm.tip; f.where.value = pm.keepForm.where;
    $('#wherePinState').textContent = upd.wherePt ? '✓ Exact spot pinned' : '';
    setTimeout(() => $('#whereField').scrollIntoView({ block: 'center' }), 200);
  }

  // ---------- Add flow ----------
  let pendingLL = null;
  function startAdd() {
    closeSheets();
    showTab('map');
    document.body.classList.add('adding');
    ['#crosshair', '#placeBar', '#placeHint'].forEach((s) => ($(s).hidden = false));
    $('#searchAreaBtn').hidden = true;
    if (map.getZoom() < 17) map.setZoom(18);
  }
  function endAdd() { document.body.classList.remove('adding'); ['#crosshair', '#placeBar', '#placeHint'].forEach((s) => ($(s).hidden = true)); }
  function confirmPlace() {
    const c = map.getCenter(); pendingLL = [c.lat, c.lng];
    endAdd(); $('#addForm').reset(); openSheet('#addSheet');
  }
  function saveAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target); const access = f.get('access');
    const hours = (f.get('hours') || '').trim() || (f.get('h24') ? '24/7' : null);
    const p = {
      id: `user-${Date.now().toString(36)}`, src: 'user', lat: pendingLL[0], lng: pendingLL[1], name: f.get('name').trim(),
      cat: access === 'customers' ? 'other' : 'public', inside: access === 'customers', fee: f.get('free') ? false : true,
      acc: f.get('accessible') ? 'yes' : null, baby: f.get('baby') ? true : null, unisex: f.get('unisex') ? true : null,
      showers: f.get('showers') ? true : null, pub: access === 'public', access, hours, addr: '', phone: null, note: (f.get('note') || '').trim()
    };
    Store.addUserPlace(p); Store.bump('bloop_added_count');
    Outbox.push({ type: 'place', payload: p });
    closeSheets(); renderList();
    toast(API.enabled ? (navigator.onLine ? 'Restroom added — thank you!' : 'Saved — it’ll upload when you’re back online') : 'Restroom added on this device');
  }

  // ---------- Search (places + addresses) ----------
  let searchT, searchSeq = 0;
  async function runSearch(q, show = true) {
    q = q.trim(); const box = $('#searchResults');
    if (q.length < 2) { box.hidden = true; return; }
    const seq = ++searchSeq;
    const ql = q.toLowerCase();
    const local = ranked(allPlaces().filter((p) => p.name.toLowerCase().includes(ql))).slice(0, 3);
    let geo = [];
    if (navigator.onLine && q.length >= 3) {
      try {
        const c = map.getCenter();
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}&viewbox=${c.lng - .4},${c.lat + .4},${c.lng + .4},${c.lat - .4}`;
        const r = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
        if (r.ok) geo = await r.json();
      } catch {}
    }
    if (seq !== searchSeq || !show) return;
    const html = [
      ...local.map((p) => `<button data-place="${esc(p.id)}">${I('toilet')}<div style="min-width:0"><div class="sr-main">${esc(p.name)}</div><div class="sr-sub">${fmtDist(p.d)} away</div></div></button>`),
      ...geo.map((g) => { const [main, ...rest] = g.display_name.split(', '); return `<button data-lat="${g.lat}" data-lng="${g.lon}">${I('pin')}<div style="min-width:0"><div class="sr-main">${esc(main)}</div><div class="sr-sub">${esc(rest.join(', '))}</div></div></button>`; })
    ].join('');
    box.innerHTML = html || `<button disabled>${I('info')}<div class="sr-main">No matches${navigator.onLine ? '' : ' (offline)'}</div></button>`;
    box.hidden = false;
  }
  function initSearch() {
    const input = $('#searchInput');
    input.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => runSearch(input.value), 450); });
    $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchT); runSearch(input.value); });
    $('#searchResults').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      $('#searchResults').hidden = true; input.blur();
      if (b.dataset.place) { openDetail(b.dataset.place); return; }
      const ll = [+b.dataset.lat, +b.dataset.lng];
      map.setView(ll, 16); fetchArea(ll);
    });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $('#micBtn').hidden = true; return; }
    $('#micBtn').onclick = () => {
      const rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false;
      $('#micBtn').classList.add('listening');
      rec.onresult = (e) => { input.value = e.results[0][0].transcript; runSearch(input.value); };
      rec.onend = () => $('#micBtn').classList.remove('listening');
      rec.onerror = () => { $('#micBtn').classList.remove('listening'); toast('Couldn’t hear that — try typing'); };
      rec.start();
    };
  }

  // ---------- Home ----------
  const CATS = [
    ['Near Me', 'pin', 'near'], ['Search', 'search', 'search'], ['Filters', 'filter', 'filters'],
    ['Accessible', 'wheelchair', 'accessible'], ['Family', 'family', 'family'], ['Showers', 'shower', 'showers'],
    ['24 Hours', 'h24', 'h24'], ['Free', 'tag', 'free'], ['Business Only', 'store', 'business']
  ];
  function initHome() {
    $('#catGrid').innerHTML = CATS.map(([l, i, a]) => `<button class="cat" data-a="${a}">${I(i)}${l}</button>`).join('');
    $('#catGrid').onclick = (e) => {
      const b = e.target.closest('.cat'); if (!b) return; const a = b.dataset.a;
      showTab('map');
      if (a === 'near') { setFilter('all'); locate(true).then((ll) => ll && maybeFetch(ll)); }
      else if (a === 'search') setTimeout(() => $('#searchInput').focus(), 150);
      else if (a === 'filters') { $('#chips').classList.add('flash'); setTimeout(() => $('#chips').classList.remove('flash'), 1100); }
      else setFilter(a, true);
    };
    $('#bloopNow').onclick = bloopNow;
    $('#howtoBtn').onclick = () => openVideo();
    $('#videoClose').onclick = () => history.back();
    $('#fanciestList').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) openDetail(b.dataset.id); };
    $('#cleanestList').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) openDetail(b.dataset.id); };
  }
  function maybeFetch(ll) { if (!lastFetchCenter || distM(lastFetchCenter, ll) > CONFIG.searchRadius * 0.5) return fetchArea(ll); renderList(); return Promise.resolve(); }
  let nowBusy = false;
  async function bloopNow() {
    if (nowBusy) return; nowBusy = true;
    const btn = $('#bloopNow'); btn.style.opacity = .75; toast('Finding the closest restroom…', 15000);
    try {
      const ll = await locate(false) || refPoint();
      if (map) map.setView(ll, 16);
      await maybeFetch(ll);
      const pool = ranked(allPlaces().filter((p) => !isHiddenPlace(p)), true);
      const ok = (p) => hoursInfo(p.hours).open !== false && p.fee !== true;
      const pick = pool.find((p) => ok(p) && isConfirmed(p) && p.d < 2500) || pool.find(ok) || pool[0];
      if (!pick) { toast('No restrooms found nearby yet — try the map'); showTab('map'); return; }
      toast(`Closest: ${pick.name} · ${fmtDist(pick.d)}`);
      openDetail(pick.id);
    } finally { nowBusy = false; btn.style.opacity = ''; }
  }

  // ---------- Turn-by-turn navigation (in-app) ----------
  let nav = null;
  const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  function stepText(s) {
    const m = s.maneuver || {}; const mod = m.modifier || ''; const onto = s.name ? ` onto ${s.name}` : '';
    const turn = { left: 'Turn left', right: 'Turn right', 'slight left': 'Bear left', 'slight right': 'Bear right', 'sharp left': 'Turn sharp left', 'sharp right': 'Turn sharp right', uturn: 'Make a U-turn', straight: 'Continue straight' };
    switch (m.type) {
      case 'depart': return `Head ${DIRS[Math.round((m.bearing_after || 0) / 45) % 8]}${s.name ? ' on ' + s.name : ''}`;
      case 'arrive': return `Arrive at ${nav ? nav.dest.name : 'the restroom'}`;
      case 'roundabout': case 'rotary': return `At the roundabout, take exit ${m.exit || 1}${onto}`;
      case 'merge': return `Merge${onto}`;
      case 'on ramp': return `Take the ramp${onto}`;
      case 'off ramp': return `Take the exit${onto}`;
      case 'fork': return `Keep ${mod.includes('left') ? 'left' : 'right'}${onto}`;
      case 'end of road': return `At the end of the road, ${(turn[mod] || 'turn').toLowerCase()}${onto}`;
      case 'continue': case 'new name': return !mod || mod === 'straight' ? `Continue${onto}` : `${turn[mod] || 'Continue'}${onto}`;
      default: return `${turn[mod] || 'Continue'}${onto}`;
    }
  }
  function stepIcon(s) {
    const m = s.maneuver || {}; const mod = m.modifier || '';
    if (m.type === 'arrive') return 'flag';
    if (m.type === 'roundabout' || m.type === 'rotary') return 'roundabout';
    if (mod === 'uturn') return 'uturn';
    if (mod === 'slight left') return 'slight-left';
    if (mod === 'slight right') return 'slight-right';
    if (mod.includes('left')) return 'turn-left';
    if (mod.includes('right')) return 'turn-right';
    return 'straight';
  }
  const lc1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const spoken = (t) => t.replace(/(\d)\s?ft\b/g, '$1 feet').replace(/(\d)\s?mi\b/g, '$1 miles').replace(/(\d)\s?km\b/g, '$1 kilometers').replace(/(\d)\s?m\b/g, '$1 meters');
  function speak(t) {
    if (!nav || nav.muted || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(spoken(t)); u.lang = navigator.language || 'en-US'; speechSynthesis.speak(u); } catch {}
  }
  function distToLine(p, coords) {
    // meters from point to polyline (local flat projection — fine at street scale)
    const k = Math.cos(toRad(p[0])) * 111320, K = 110540;
    const P = [p[1] * k, p[0] * K]; let best = Infinity;
    for (let i = 1; i < coords.length; i++) {
      const A = [coords[i - 1][1] * k, coords[i - 1][0] * K], B = [coords[i][1] * k, coords[i][0] * K];
      const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2)) : 0;
      const x = A[0] + t * dx - P[0], y = A[1] + t * dy - P[1];
      best = Math.min(best, Math.sqrt(x * x + y * y));
    }
    return best;
  }
  async function fetchRoute(from, to, mode) {
    const url = `${CONFIG.routing[mode]}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error('route');
      const j = await r.json(); const rt = j.routes && j.routes[0]; if (!rt) throw new Error('route');
      return {
        coords: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), total: rt.distance, duration: rt.duration,
        steps: rt.legs[0].steps.map((s) => ({ ...s, loc: [s.maneuver.location[1], s.maneuver.location[0]] }))
      };
    } finally { clearTimeout(t); }
  }
  function drawRoute() {
    if (nav.lines) nav.lines.forEach((l) => map.removeLayer(l));
    const straight = !nav.routed;
    nav.lines = [
      L.polyline(nav.coords, { color: '#1a1446', weight: 11, opacity: .7, interactive: false }).addTo(map),
      L.polyline(nav.coords, { color: '#8b6cff', weight: 6, opacity: 1, dashArray: straight ? '2 10' : null, lineCap: 'round', interactive: false }).addTo(map)
    ];
  }
  async function planRoute(announce) {
    const from = me, to = nav.to;
    $('#navEta').textContent = '…'; $('#navSub').textContent = 'Finding the best route';
    let r = null;
    if (navigator.onLine) { try { r = await fetchRoute(from, to, nav.mode); } catch {} }
    if (!nav) return;
    if (r) Object.assign(nav, r, { routed: true, idx: Math.min(1, r.steps.length - 1), pre: {}, off: 0 });
    else {
      const d = distM(from, to);
      Object.assign(nav, {
        routed: false, coords: [from, to], total: d, duration: d / (nav.mode === 'walk' ? 1.3 : 9), idx: 0, pre: {}, off: 0,
        steps: [{ maneuver: { type: 'arrive' }, loc: to, distance: 0, name: '' }]
      });
      toast(navigator.onLine ? 'Couldn’t get turn-by-turn — showing the direct line' : 'Offline — showing the direct line to the restroom', 4000);
    }
    drawRoute(); renderNav();
    if (announce) speak(nav.routed ? stepText(nav.steps[0]) + (nav.steps[1] ? `, then ${lc1(stepText(nav.steps[1]))}` : '') : `Head toward ${nav.dest.name}`);
  }
  async function startNav(p, mode) {
    let here = me || await locate(false);
    if (!here) { toast('Turn on location to get directions'); return; }
    if (nav) endNav(true);
    if (detailId) closeDetail();
    showTab('map', false);
    history.replaceState({ tab: 'map', nav: true }, '');
    const d = distM(here, [p.lat, p.lng]);
    const wh = whereFor(p);
    nav = { dest: p, to: wh && wh.pt ? wh.pt : [p.lat, p.lng], where: wh, mode: mode || (d < 1200 ? 'walk' : 'drive'), muted: LS.get('bloop_mute', false), follow: true, lastReroute: Date.now(), arrived: false };
    document.body.classList.add('navigating');
    ['#navBanner', '#navCard'].forEach((s) => ($(s).hidden = false)); $('#navSteps').hidden = true;
    paintNavControls();
    await planRoute(true);
    if (!nav) return;
    try { map.fitBounds(L.latLngBounds(nav.coords), { padding: [90, 60] }); } catch {}
    setTimeout(() => { if (nav && nav.follow && me) map.setView(me, nav.mode === 'walk' ? 18 : 17); }, 2200);
    if (navigator.geolocation) nav.watch = navigator.geolocation.watchPosition(onNavPos, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    try { if ('wakeLock' in navigator) nav.wake = await navigator.wakeLock.request('screen'); } catch {}
  }
  function onNavPos(pos) {
    if (!nav || nav.arrived) return;
    const ll = [pos.coords.latitude, pos.coords.longitude];
    setMe(ll, pos.coords.accuracy);
    if (nav.follow) map.setView(ll, map.getZoom() < 16 ? (nav.mode === 'walk' ? 18 : 17) : map.getZoom());
    const walk = nav.mode === 'walk';
    const dest = nav.to;
    if (distM(ll, dest) < (walk ? 20 : 40)) { arrived(); return; }
    const st = nav.steps; let next = st[nav.idx];
    let dNext = distM(ll, next.loc);
    if (nav.routed && dNext < (walk ? 15 : 30) && nav.idx < st.length - 1) {
      nav.idx++; next = st[nav.idx]; dNext = distM(ll, next.loc);
      speak(dNext > (walk ? 60 : 250) ? `In ${fmtDist(dNext)}, ${lc1(stepText(next))}` : stepText(next)); nav.pre[nav.idx] = true;
    } else if (nav.routed && !nav.pre[nav.idx] && dNext < (walk ? 60 : 250)) {
      nav.pre[nav.idx] = true; speak(`In ${fmtDist(dNext)}, ${lc1(stepText(next))}`);
    }
    // off route? re-plan (at most every 15 s)
    if (nav.routed && distToLine(ll, nav.coords) > (walk ? 40 : 70)) {
      if (++nav.off >= 2 && Date.now() - nav.lastReroute > 15000) { nav.lastReroute = Date.now(); speak('Rerouting'); planRoute(false); return; }
    } else nav.off = 0;
    if (!nav.routed) nav.coords[0] = ll, drawRoute();
    renderNav(ll);
  }
  function remaining(ll) {
    const st = nav.steps; ll = ll || me;
    let rem = distM(ll, st[nav.idx].loc);
    for (let i = nav.idx; i < st.length; i++) rem += st[i].distance || 0;
    if (!nav.routed) rem = distM(ll, nav.to);
    const secs = nav.mode === 'walk' ? rem / 1.3 : rem * (nav.duration / Math.max(nav.total, 1));
    return { rem, secs };
  }
  function renderNav(ll) {
    if (!nav) return;
    ll = ll || me;
    const st = nav.steps, next = st[nav.idx];
    const dNext = distM(ll, next.loc);
    $('#navIcon').innerHTML = I(nav.routed ? stepIcon(next) : 'nav');
    $('#navDist').textContent = fmtDist(dNext);
    $('#navText').textContent = nav.routed ? stepText(next) : `Toward ${nav.dest.name}`;
    const { rem, secs } = remaining(ll);
    const mins = Math.max(1, Math.round(secs / 60));
    const at = new Date(Date.now() + secs * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('#navEta').textContent = `${mins} min`;
    $('#navSub').textContent = `${fmtDist(rem)} · arrive ${at}`;
    $('#navSteps').innerHTML = nav.routed ? st.map((s, i) => `<li class="${i < nav.idx ? 'done' : i === nav.idx ? 'now' : ''}">${I(stepIcon(s))}<span>${esc(stepText(s))}</span><small>${s.distance ? fmtDist(s.distance) : ''}</small></li>`).join('') : '';
  }
  function paintNavControls() {
    $$('#navMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === nav.mode));
    $('#navMute').innerHTML = I(nav.muted ? 'mute' : 'sound');
  }
  function arrived() {
    nav.arrived = true;
    if (nav.watch != null) navigator.geolocation.clearWatch(nav.watch);
    const where = nav.where && nav.where.text;
    speak(`You've arrived at ${nav.dest.name}.${where ? ` The restroom is ${lc1(where)}.` : ''}`);
    $('#navIcon').innerHTML = I('flag'); $('#navDist').textContent = 'You’ve arrived'; $('#navText').textContent = where ? `Restroom: ${where}` : nav.dest.name;
    $('#navEta').textContent = 'Arrived'; $('#navSub').textContent = where ? `${nav.dest.name} · ${where}` : 'How was it?';
    $('#navSteps').hidden = true; $('#navMode').hidden = true;
    $('#navCard .nav-btns').innerHTML = `<button class="btn" id="navDone2">Done</button><button class="btn grad" id="navRate" style="grid-column:span 2">${I('star')}Rate this restroom</button>`;
    const p = nav.dest;
    $('#navRate').onclick = () => { endNav(); openUpdate(p); };
    $('#navDone2').onclick = () => endNav();
  }
  function endNav(silent) {
    if (!nav) return;
    if (nav.watch != null) navigator.geolocation.clearWatch(nav.watch);
    if (nav.lines) nav.lines.forEach((l) => map.removeLayer(l));
    try { nav.wake && nav.wake.release(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    nav = null;
    document.body.classList.remove('navigating');
    ['#navBanner', '#navCard', '#recenterBtn'].forEach((s) => ($(s).hidden = true));
    $('#navMode').hidden = false;
    $('#navCard .nav-btns').innerHTML = `<button class="btn" id="navMute" aria-label="Voice on/off">${I('sound')}</button><button class="btn" id="navList">${I('list')}Steps</button><button class="btn end" id="navEnd">End</button>`;
    bindNavButtons();
    if (!silent) { history.replaceState({ tab: 'map' }, ''); renderList(); }
  }
  function bindNavButtons() {
    $('#navEnd').onclick = () => endNav();
    $('#navList').onclick = () => { $('#navSteps').hidden = !$('#navSteps').hidden; };
    $('#navMute').onclick = () => { nav.muted = !nav.muted; LS.set('bloop_mute', nav.muted); if (nav.muted) try { speechSynthesis.cancel(); } catch {} paintNavControls(); toast(nav.muted ? 'Voice off' : 'Voice on', 1200); };
  }
  function initNav() {
    bindNavButtons();
    $('#navMode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || !nav || b.dataset.m === nav.mode) return; nav.mode = b.dataset.m; paintNavControls(); planRoute(true); };
    $('#recenterBtn').onclick = () => { if (!nav) return; nav.follow = true; $('#recenterBtn').hidden = true; if (me) map.setView(me, nav.mode === 'walk' ? 18 : 17); };
    map.on('dragstart', () => { if (nav && !nav.arrived) { nav.follow = false; $('#recenterBtn').hidden = false; } });
    document.addEventListener('visibilitychange', async () => { if (nav && document.visibilityState === 'visible' && 'wakeLock' in navigator) { try { nav.wake = await navigator.wakeLock.request('screen'); } catch {} } });
  }

  // ---------- Saved & Account ----------
  function renderSaved() {
    const s = Object.values(Store.saved());
    const ref = refPoint();
    $('#savedList').innerHTML = s.length ? s.map((p) => ({ ...p, d: distM(ref, [p.lat, p.lng]) })).sort((a, b) => a.d - b.d).map((p) => rowHTML(p)).join('')
      : `<li class="empty">${I('heart')}<br>Tap the heart on any restroom to keep it here — handy for your regular routes.</li>`;
  }
  let clearArmed = 0;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOSSafari = () => isIOS && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  // Show Install only where it really works: one tap on Android/Chrome/Edge, a 2-step guide on iPhone Safari
  const canInstall = () => !isStandalone() && (!!window.__bip || isIOSSafari());
  function updateInstallUI() {
    const show = canInstall();
    $('#homeInstall').hidden = !show;
    if (currentTab === 'account') renderAccount();
  }
  function doInstall() {
    const bip = window.__bip;
    if (bip) {
      bip.prompt(); // must run straight from the tap — no awaits before this
      window.__bip = null;
      bip.userChoice.then((r) => { if (r && r.outcome === 'accepted') toast('Installing Bloop…'); updateInstallUI(); });
    } else if (isIOSSafari()) openSheet('#iosSheet');
  }
  function renderAccount() {
    const nick = Prefs.nick;
    const n = (k) => Object.keys(LS.get(k, {})).length;
    $('#accountBody').innerHTML = `
      <div class="acct-top"><div class="avatar">${esc((nick || 'B')[0].toUpperCase())}</div>
        <div><div style="font-weight:800;font-size:1.25rem">${esc(nick || 'Anonymous Blooper')}</div><div class="muted small">No sign-up needed</div></div></div>
      ${LS.get('bloop_admin', false) ? `<div class="card"><h3>${I('gear')}Admin tools</h3>
        <p class="small muted" style="margin:0 0 6px">Only you see this. Tap the version number 5 times to hide it.</p>
        <div class="set-row"><span>Restroom data servers</span><button class="btn" id="testMap">Test</button></div>
        <div class="small" id="mapResult"></div>
      </div>` : ''}
      ${LS.get('bloop_admin', false) || !API.enabled ? `<div class="card"><h3>Community data</h3>
        <div class="set-row"><span>${API.enabled ? `${I('check', 'ok-ico')} Connected to Supabase` : `${I('info', 'warn-ico')} Device-only mode`}</span>${API.enabled ? '<button class="btn" id="testConn">Test connection</button>' : ''}</div>
        ${API.enabled ? '<p class="small muted" id="connResult" style="margin:4px 0 0"></p>' : `<p class="small" style="margin:4px 0 0;color:#d97706">${esc(CONFIG_STATUS)}. Ratings and new restrooms are only saved on this phone until this is fixed.</p>`}
      </div>` : ''}
      <div class="card"><h3>Your impact</h3>
        <div class="stats-grid"><div><b>${n('bloop_ratings')}</b><span>Ratings</span></div><div><b>${n('bloop_checkins')}</b><span>Check-ins</span></div><div><b>${LS.get('bloop_added_count', 0)}</b><span>Added</span></div><div><b>${LS.get('bloop_photo_count', 0)}</b><span>Photos</span></div></div></div>
      <div class="card"><h3>Settings</h3>
        <label class="field" style="margin-top:4px">Display name on reviews
          <input id="nickInput" maxlength="24" placeholder="Anonymous" value="${esc(nick)}"></label>
        <div class="set-row"><span>Distance</span><div class="mini-seg" data-pref="units"><button data-v="imperial" class="${Prefs.units === 'imperial' ? 'on' : ''}">Miles</button><button data-v="metric" class="${Prefs.units === 'metric' ? 'on' : ''}">Km</button></div></div>
        <div class="set-row"><span>Appearance</span><div class="mini-seg" data-pref="theme"><button data-v="light" class="${Prefs.theme === 'light' ? 'on' : ''}">Light</button><button data-v="dark" class="${Prefs.theme === 'dark' ? 'on' : ''}">Dark</button><button data-v="auto" class="${Prefs.theme === 'auto' ? 'on' : ''}">Auto</button></div></div>
        <div class="set-row"><span>Ask when I’m at a place<br><small class="muted">“You’re at Target — is there a restroom?”</small></span><div class="mini-seg" data-pref="here"><button data-v="on" class="${hereOn() ? 'on' : ''}">On</button><button data-v="off" class="${hereOn() ? '' : 'on'}">Off</button></div></div>
        <div class="set-row"><span>Map style</span><div class="mini-seg" data-pref="style"><button data-v="dark" class="${Prefs.style === 'dark' ? 'on' : ''}">Night</button><button data-v="light" class="${Prefs.style === 'light' ? 'on' : ''}">Day</button></div></div>
        ${canInstall() ? `<div class="set-row"><span>Install Bloop on this device</span><button class="btn grad" id="installBtn">${I('download')}Install</button></div>` : ''}
      </div>
      <div class="card"><h3>About</h3>
        <p class="small muted" style="margin:4px 0 10px">Restroom and map data © OpenStreetMap contributors, directions by OSRM / FOSSGIS, plus places added by the Bloop community. Bloop uses a random device ID instead of an account — no email or name is collected. Your location is only used to look up nearby restrooms and is never saved by Bloop.</p>
        <button class="set-row legal-link" id="howtoRow"><span>Watch how Bloop works</span>${I('chev')}</button>
        <button class="set-row legal-link" data-legal="privacy"><span>Privacy policy</span>${I('chev')}</button>
        <button class="set-row legal-link" data-legal="terms"><span>Terms of use</span>${I('chev')}</button>
        <div class="set-row"><span class="small muted">Device ID</span><span class="small muted" style="font-family:monospace">${DEVICE_ID.slice(0, 13)}</span></div>
        <div class="set-row"><span class="small muted" id="verTap">Version ${CONFIG.version}</span><button class="btn" id="clearBtn">${I('trash')}Clear my data</button></div>
      </div>`;
    $('#nickInput').onchange = (e) => { Prefs.nick = e.target.value.trim().slice(0, 24); renderAccount(); toast('Name saved'); };
    $$('.mini-seg').forEach((seg) => (seg.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (seg.dataset.pref === 'theme') { setTheme(b.dataset.v); return; }
      if (seg.dataset.pref === 'here') { LS.set('bloop_here', b.dataset.v === 'on'); if (b.dataset.v === 'on') startPresence(); else stopPresence(); renderAccount(); return; }
      Prefs[seg.dataset.pref] = b.dataset.v;
      if (seg.dataset.pref === 'style' && map) setTiles(b.dataset.v);
      renderAccount(); renderList();
    }));
    const ib = $('#installBtn'); if (ib) ib.onclick = doInstall;
    $$('[data-legal]').forEach((b) => (b.onclick = () => openLegal(b.dataset.legal)));
    $('#howtoRow').onclick = () => openVideo();
    let taps = 0, tapT;
    $('#verTap').onclick = () => { clearTimeout(tapT); tapT = setTimeout(() => (taps = 0), 1500);
      if (++taps >= 5) { taps = 0; LS.set('bloop_admin', !LS.get('bloop_admin', false)); toast(LS.get('bloop_admin', false) ? 'Admin tools on' : 'Admin tools hidden'); renderAccount(); } };
    const tm = $('#testMap');
    if (tm) tm.onclick = async () => {
      const out = $('#mapResult'); out.innerHTML = '<p class="muted">Testing each server…</p>';
      const [lat, lng] = refPoint();
      const rows = [];
      if (GEO_KEY) {
        const t0 = Date.now(); const g = await geoapify(GEO_CONFIRMED, lat, lng, 3000, 20);
        rows.push(`<div class="set-row"><span><b>Geoapify</b> (main)</span><span>${g ? `<span style="color:#16a34a">✓ OK</span> · ${g.elements.length} restrooms · ${Date.now() - t0} ms` : `<span style="color:#dc2626">✗ ${esc(lastGeoLog.replace('Geoapify ', ''))}</span>`}</span></div>`);
      } else rows.push(`<div class="set-row"><span><b>Geoapify</b> (main)</span><span style="color:#d97706">No key in config.js</span></div>`);
      out.innerHTML = rows.join('');
      for (const url of CONFIG.overpass) {
        const t0 = Date.now(); let line;
        try {
          const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(`[out:json][timeout:10];node["amenity"="toilets"](around:3000,${lat},${lng});out 20;`) });
          clearTimeout(to);
          line = res.ok ? `<span style="color:#16a34a">✓ OK</span> · ${(await res.json()).elements.length} restrooms · ${Date.now() - t0} ms` : `<span style="color:#dc2626">✗ HTTP ${res.status}</span>`;
        } catch (e) { line = `<span style="color:#dc2626">✗ ${e.name === 'AbortError' ? 'timed out' : esc(e.message || 'blocked')}</span>`; }
        rows.push(`<div class="set-row"><span style="word-break:break-all">${esc(new URL(url).hostname)}</span><span>${line}</span></div>`);
        out.innerHTML = rows.join('');
      }
      if (lastGeoLog) out.innerHTML += `<p class="muted" style="margin:8px 0 0">Last map search: ${esc(lastGeoLog)}</p>`;
      if (lastOverpassLog.length) out.innerHTML += `<p class="muted" style="margin:8px 0 0">Last map search: ${lastOverpassLog.map((l) => `${esc(new URL(l.url).hostname)} ${l.ok ? `OK (${l.n})` : esc(l.err)}`).join(' → ')}</p>`;
    };
    const tc = $('#testConn');
    if (tc) tc.onclick = async () => {
      const out = $('#connResult'); out.textContent = 'Testing…'; out.style.color = '';
      try { await API.stats(['bloop-test']); out.textContent = 'Working — Bloop can read and save community data.'; out.style.color = '#16a34a'; }
      catch (e) {
        const m = String(e.message || e);
        out.style.color = '#dc2626';
        out.textContent = /401|403|invalid api key|jwt/i.test(m) ? 'The Supabase key was rejected — copy the publishable (anon) key again into config.js.'
          : /404|could not find|function/i.test(m) ? 'Connected, but the database isn’t set up — run supabase.sql in the Supabase SQL Editor.'
          : navigator.onLine ? `Couldn’t reach Supabase: ${m}` : 'You’re offline.';
      }
    };
    $('#clearBtn').onclick = () => {
      if (Date.now() - clearArmed > 4000) { clearArmed = Date.now(); toast('Tap again to clear saved places, ratings and settings on this device'); return; }
      Object.keys(localStorage).filter((k) => k.startsWith('bloop_') && k !== 'bloop_device').forEach((k) => localStorage.removeItem(k));
      location.reload();
    };
  }

  // ---------- "See how Bloop works" video ----------
  function openVideo(push = true) {
    const wrap = $('#videoWrap');
    wrap.innerHTML = `<video src="media/bloop-intro.mp4" poster="media/bloop-intro-poster.jpg" controls playsinline autoplay preload="metadata"></video>`;
    const v = wrap.querySelector('video');
    v.onerror = () => { wrap.innerHTML = `<p class="video-msg">${navigator.onLine ? 'The video couldn’t load. Make sure the <b>media</b> folder is uploaded.' : 'You’re offline. The video plays when you have signal.'}</p>`; };
    $('#videoModal').hidden = false;
    if (push) history.pushState({ tab: currentTab, video: true }, '');
  }
  function closeVideo() { const v = $('#videoWrap video'); if (v) v.pause(); $('#videoWrap').innerHTML = ''; $('#videoModal').hidden = true; }

  // ---------- Privacy / Terms (in-app) ----------
  // Loads the public privacy/terms page text straight into the app (no frames, so hosting
  // security settings can't block it). Works offline once the app has cached the pages.
  async function openLegal(page, push = true) {
    const el = $('#legal'), body = $('#legalBody');
    el.querySelector('h2').textContent = page === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    body.innerHTML = '<p class="muted">Loading…</p>';
    el.hidden = false; el.scrollTop = 0;
    if (push) history.pushState({ tab: currentTab, legal: page }, '');
    try {
      const r = await fetch(`${page}.html`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const main = doc.querySelector('main'); if (!main) throw new Error('empty');
      main.querySelectorAll('header, h1, script').forEach((x) => x.remove());
      body.innerHTML = main.innerHTML;
    } catch (err) {
      body.innerHTML = `<p>Couldn’t load this page${navigator.onLine ? '' : ' while offline'}.</p><p class="muted small">Make sure <b>${page}.html</b> is uploaded to your site. (${esc(String(err.message || err))})</p>`;
    }
  }
  function closeLegal() { $('#legal').hidden = true; }

  // ---------- Light / dark mode ----------
  const sysLight = matchMedia('(prefers-color-scheme: light)');
  const isLight = () => Prefs.theme === 'light' || (Prefs.theme === 'auto' && sysLight.matches);
  function applyTheme(syncMap = true) {
    const light = isLight();
    document.documentElement.classList.toggle('light', light);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = light ? '#f4f6fb' : '#0b1020';
    $('#themeBtn').innerHTML = I(light ? 'moon' : 'sun');
    $('#themeBtn').setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    if (syncMap && map) { Prefs.style = light ? 'light' : 'dark'; setTiles(Prefs.style); }
  }
  function setTheme(t) { Prefs.theme = t; applyTheme(); if (currentTab === 'account') renderAccount(); }

  // ---------- Tabs & history ----------
  function showTab(t, push = true) {
    if (t === 'add') { startAdd(); return; }
    if (t !== 'map') endAdd();
    currentTab = t;
    $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === t));
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $('#searchResults').hidden = true;
    if (t === 'map') {
      setTimeout(() => map.invalidateSize(), 30);
      if (!mapReady) { mapReady = true; const c = map.getCenter(); maybeFetch(me || [c.lat, c.lng]); }
    }
    if (t === 'saved') renderSaved();
    if (t === 'account') renderAccount();
    if (push && !detailId) history.pushState({ tab: t }, '');
  }
  window.addEventListener('popstate', (e) => {
    const st = e.state || { tab: 'home' };
    closeSheets();
    if (nav && !st.nav) endNav(true);
    if (!$('#videoModal').hidden && !st.video) closeVideo();
    if (st.video) { openVideo(false); return; }
    if (st.legal) { openLegal(st.legal, false); return; }
    if (!$('#legal').hidden) closeLegal();
    if (st.detail) { if (st.tab !== currentTab) showTab(st.tab, false); openDetail(st.detail, false); }
    else { if (detailId) closeDetail(); showTab(st.tab || 'home', false); }
  });

  // ---------- Panel ----------
  // List panel on phones: 'min' (just the header — map gets the screen), 'mid', 'full'
  const PANEL = ['min', 'mid', 'full'];
  let panelState = 'mid';
  function setPanel(st) {
    panelState = st;
    const el = $('#listPanel');
    el.classList.toggle('expanded', st === 'full'); el.classList.toggle('collapsed', st === 'min');
    document.body.classList.toggle('panel-expanded', st === 'full'); document.body.classList.toggle('panel-collapsed', st === 'min');
  }
  const stepPanel = (dir) => setPanel(PANEL[Math.max(0, Math.min(2, PANEL.indexOf(panelState) + dir))]);
  function initPanel() {
    const grab = [$('#panelHandle'), $('#listPanel .panel-head')]; let y0 = null, moved = false;
    grab.forEach((h) => {
      h.addEventListener('click', () => { if (moved) { moved = false; return; } setPanel(panelState === 'mid' ? 'full' : 'mid'); });
      h.addEventListener('touchstart', (ev) => { y0 = ev.touches[0].clientY; moved = false; }, { passive: true });
      h.addEventListener('touchend', (ev) => {
        if (y0 == null) return; const dy = ev.changedTouches[0].clientY - y0; y0 = null;
        if (Math.abs(dy) > 30) { moved = true; stepPanel(dy < 0 ? 1 : -1); setTimeout(() => (moved = false), 350); }
      });
    });
    // moving the map slides the list down out of the way (phones only)
    map.on('dragstart', () => { if (innerWidth < 768 && panelState !== 'min' && !nav) setPanel('min'); });
  }

  // ---------- Boot ----------
  function listClick(e) {
    const heart = e.target.closest('[data-save]');
    if (heart) { e.stopPropagation(); const p = findPlace(heart.dataset.save); if (p) { const on = Store.toggleSave(p); heart.classList.toggle('on', on); toast(on ? 'Saved' : 'Removed from Saved'); if (currentTab === 'saved') renderSaved(); } return; }
    const row = e.target.closest('.row'); if (row) openDetail(row.dataset.id);
  }
  function boot() {
    initMap(); initHome(); initPanel(); initSearch(); renderChips(); initNav();
    community = LS.get('bloop_community', []);
    const c = LS.get('bloop_cache', null); if (c) { places = c.items; lastFetchCenter = c.center; }

    $('#tabbar').onclick = (e) => { const b = e.target.closest('.tab'); if (!b) return; if (detailId) { closeDetail(); history.replaceState({ tab: currentTab }, ''); } showTab(b.dataset.tab); };
    $('#chips').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setFilter(b.dataset.f); };
    $('#list').onclick = listClick; $('#savedList').onclick = listClick;
    $('#detail').onclick = onDetailClick;
    $('#updateBtn').onclick = () => { const p = findPlace(detailId); if (p) openUpdate(p); };
    $('#rateBig').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { upd.stars = +b.dataset.s; paintUpdate(); } };
    $('#subRates').onclick = (e) => { const b = e.target.closest('[data-v]'); const g = e.target.closest('[data-sub]'); if (b && g) { const k = g.dataset.sub, v = +b.dataset.v; upd.subs[k] = upd.subs[k] === v ? 0 : v; if (!upd.stars) upd.stars = v; paintUpdate(); } };
    $('#luxeBtn').onclick = () => { upd.luxe = !upd.luxe; paintUpdate(); };
    $('#segTip').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { upd.tipKind = upd.tipKind === b.dataset.k ? null : b.dataset.k; paintUpdate(); } };
    $('#segStatus').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { upd.status = upd.status === b.dataset.v ? null : b.dataset.v; paintUpdate(); } };
    $('#photoInput').onchange = (e) => { const f = e.target.files[0]; if (!f) return; upd.file = f; const pv = $('#photoPreview'); pv.src = URL.createObjectURL(f); pv.hidden = false; };
    $('#updateForm').onsubmit = submitUpdate;
    $('#repReasons').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; rep.reason = b.dataset.r; $$('#repReasons button').forEach((x) => x.classList.toggle('on', x === b)); };
    $('#reportForm').onsubmit = submitReport;
    $('#searchAreaBtn').onclick = () => { const c2 = map.getCenter(); fetchArea([c2.lat, c2.lng], true); };
    $('#locateBtn').onclick = async () => { const ll = await locate(true); if (ll) maybeFetch(ll); };
    $('#layersBtn').onclick = () => { Prefs.style = Prefs.style === 'dark' ? 'light' : 'dark'; setTiles(Prefs.style); toast(Prefs.style === 'dark' ? 'Night map' : 'Day map', 1200); };
    $('#placeCancel').onclick = () => (pinMode ? finishWherePin(false) : endAdd());
    $('#placeConfirm').onclick = () => (pinMode ? finishWherePin(true) : confirmPlace());
    $('#wherePinBtn').onclick = startWherePin;
    $('#wherePresets').onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; const inp = $('#updateForm').where; inp.value = inp.value && !inp.value.includes(b.dataset.w) ? `${inp.value}, ${b.dataset.w.toLowerCase()}` : b.dataset.w; };
    $('#addForm').onsubmit = saveAdd;
    $('#legalBack').onclick = () => history.back();
    $('#legalBody').onclick = (e) => {
      const l = e.target.closest('a[href]'); if (!l) return;
      const m = l.getAttribute('href').match(/^(privacy|terms)\.html$/);
      if (m) { e.preventDefault(); openLegal(m[1], false); history.replaceState({ tab: currentTab, legal: m[1] }, ''); }
    };
    $$('[data-terms]').forEach((x) => (x.onclick = (e) => { e.preventDefault(); closeSheets(); openLegal('terms'); }));
    $('#backdrop').onclick = closeSheets;
    $$('[data-close]').forEach((b) => (b.onclick = closeSheets));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#videoModal').hidden) history.back(); else if (!$('#backdrop').hidden) closeSheets(); else if (detailId) history.back(); else endAdd(); } });
    addEventListener('online', () => { toast('Back online'); Outbox.flush(); });
    $('#herePrompt').onclick = (e) => { const b = e.target.closest('[data-here]'); if (b) hereAnswer(b.dataset.here); };
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? startPresence() : stopPresence()));
    addEventListener('offline', () => toast('You’re offline — saved results still work'));
    $('#homeInstall').onclick = doInstall;
    applyTheme(false);
    $('#themeBtn').onclick = () => setTheme(isLight() ? 'dark' : 'light');
    sysLight.addEventListener && sysLight.addEventListener('change', () => { if (Prefs.theme === 'auto') applyTheme(); });
    updateInstallUI();
    addEventListener('bloop:installable', updateInstallUI);
    addEventListener('appinstalled', () => { window.__bip = null; updateInstallUI(); toast('Bloop installed!'); });

    history.replaceState({ tab: 'home' }, '');
    const qs = new URLSearchParams(location.search);
    if (qs.get('place') && qs.get('ll')) {
      const ll = qs.get('ll').split(',').map(Number); const pid = qs.get('place');
      history.replaceState({ tab: 'home' }, '', location.pathname);
      if (ll.length === 2 && ll.every(Number.isFinite)) {
        showTab('map'); mapReady = true; map.setView(ll, 17);
        fetchArea(ll).then(() => { if (findPlace(pid)) openDetail(pid); else toast('That restroom isn’t listed anymore'); });
      }
    } else if (qs.get('add') === '1') startAdd();
    else if (qs.get('tab')) showTab(qs.get('tab'));
    Outbox.flush();
    locate(false).then((ll) => { if (ll) startPresence(); if (ll && map) { map.setView(ll, 15); maybeFetch(ll); } else renderCleanest(); });
  }

  if (window.L) boot();
  else document.body.insertAdjacentHTML('beforeend', '<div class="toast">Connect to the internet once to load Bloop — after that it works offline.</div>');
  window.bloop = { hoursInfo, Store };
})();
