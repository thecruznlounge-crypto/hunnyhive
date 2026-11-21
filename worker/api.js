/* Hunnyhive API on Cloudflare Workers — port of the old api/*.php.
   Same URLs (/api/check.php, /api/submit.php, /api/admin.php) and the same JSON,
   so the store pages and MasterDash work unchanged.
   Storage: one KV namespace bound as HIVE.
     registry            -> the catalog (apps.json). Missing = the apps.json in the repo is used.
     sub:<id>            -> a developer submission
     backup:<stamp>      -> catalog backups (last 25)
     file:<path>         -> uploaded icons/screenshots, served at <path>
     rl:<bucket>:<hash>  -> rate limit counters (auto-expire)
   Owner token: the ADMIN_TOKEN secret (header X-MYPWA-TOKEN, as before). */

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
class Fail extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const fail = (msg, code = 400) => { throw new Fail(msg, code); };

export async function handleApi(req, env, ctx, path) {
  try {
    if (path === '/api/check.php') return await check(req, env);
    if (path === '/api/submit.php') return await submit(req, env);
    if (path === '/api/admin.php') return await admin(req, env);
    return json({ ok: false, error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof Fail) return json({ ok: false, error: e.message }, e.code);
    return json({ ok: false, error: 'Server error: ' + (e && e.message || e) }, 500);
  }
}

/* ---------- helpers ---------- */
function kv(env) { if (!env.HIVE) fail('Storage is not connected yet (KV binding HIVE is missing).', 503); return env.HIVE; }
async function body(req) {
  const ct = req.headers.get('Content-Type') || '';
  const url = new URL(req.url); const q = Object.fromEntries(url.searchParams);
  if (req.method !== 'POST') return { fields: q, files: {} };
  if (ct.includes('application/json')) { try { const j = await req.json(); return { fields: Object.assign(q, j && typeof j === 'object' ? j : {}), files: {} }; } catch { return { fields: q, files: {} }; } }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData(); const fields = Object.assign({}, q), files = {};
    for (const [k, v] of fd.entries()) { if (typeof v === 'string') fields[k] = v; else files[k] = v; }
    return { fields, files };
  }
  return { fields: q, files: {} };
}
export const slugify = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const today = () => new Date().toISOString().slice(0, 10);
const cut = (s, n) => Array.from(String(s == null ? '' : s)).slice(0, n).join('');
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function sameStr(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

async function rateLimit(req, env, bucket, max, windowSec) {
  if (!env.HIVE) return;
  const ip = req.headers.get('CF-Connecting-IP') || '0';
  const key = `rl:${bucket}:${(await sha(ip)).slice(0, 20)}`;
  const now = Math.floor(Date.now() / 1000);
  const d = (await env.HIVE.get(key, 'json')) || { t: [] };
  d.t = (d.t || []).filter(t => t > now - windowSec);
  if (d.t.length >= max) fail('Too many requests. Please try again later.', 429);
  d.t.push(now);
  await env.HIVE.put(key, JSON.stringify(d), { expirationTtl: Math.max(60, windowSec) });
}

/* catalog */
export async function registryRead(env, origin) {
  if (env.HIVE) { const r = await env.HIVE.get('registry', 'json'); if (r && Array.isArray(r.apps)) return r; }
  const res = await env.ASSETS.fetch(new Request(origin + '/apps.json'));
  const j = res.ok ? await res.json().catch(() => null) : null;
  if (!j || !Array.isArray(j.apps)) fail('apps.json is missing or invalid.', 500);
  return j;
}
async function registryWrite(env, reg) {
  const H = kv(env);
  const cur = await H.get('registry');
  if (cur) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    await H.put('backup:' + stamp, cur);
    const list = await H.list({ prefix: 'backup:' });
    const keys = list.keys.map(k => k.name).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 25))) await H.delete(k);
  }
  reg.updated = today();
  await H.put('registry', JSON.stringify(reg, null, 2));
}
async function putFile(env, path, bytes, type) { await kv(env).put('file:' + path, bytes, { metadata: { type: type || 'application/octet-stream', at: Date.now() } }); }
export async function getFile(env, path) {
  if (!env.HIVE) return null;
  const r = await env.HIVE.getWithMetadata('file:' + path, 'arrayBuffer');
  if (!r || !r.value) return null;
  return new Response(r.value, { headers: { 'Content-Type': (r.metadata && r.metadata.type) || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' } });
}

/* ---------- safe fetch (https only, manual redirects, size cap) ---------- */
function resolveUrl(base, rel) { try { return new URL(rel, base).toString(); } catch { return null; } }
async function httpGet(url, maxBytes = 1500000, hops = 3) {
  for (let i = 0; i <= hops; i++) {
    let u; try { u = new URL(url); } catch { return { ok: false, status: 0, error: 'Bad address.', url }; }
    if (u.protocol !== 'https:') return { ok: false, status: 0, error: 'Only https:// URLs are allowed.', url };
    if (u.port && !['443', '8443'].includes(u.port)) return { ok: false, status: 0, error: 'Unsupported port.', url };
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|\[?f[cd])/i.test(u.hostname)) return { ok: false, status: 0, error: 'Address not allowed.', url };
    let res;
    try {
      res = await fetch(u.toString(), { redirect: 'manual', headers: { 'User-Agent': 'Hunnyhive-checker/1.0 (+https://hunnyhive.app/developers/)', 'Accept': 'text/html,application/json,image/*;q=0.9,*/*;q=0.5' }, signal: AbortSignal.timeout(10000) });
    } catch (e) { return { ok: false, status: 0, error: 'Request failed', url }; }
    if (res.status >= 300 && res.status < 400 && res.headers.get('Location')) { url = resolveUrl(url, res.headers.get('Location')); continue; }
    const type = res.headers.get('Content-Type') || '';
    const reader = res.body ? res.body.getReader() : null; const chunks = []; let n = 0;
    if (reader) { for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > maxBytes) { try { await reader.cancel(); } catch {} break; } chunks.push(value); } }
    const buf = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0)); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, bytes: buf, text: () => new TextDecoder().decode(buf), url, type, error: '' };
  }
  return { ok: false, status: 0, error: 'Too many redirects.', url };
}

/* ---------- PWA validation (same checks as before) ---------- */
const decodeEnt = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export async function checkPwa(url) {
  const checks = []; const info = { name: '', description: '', icon: '', manifest: null, start_url: '', final_url: url, screenshots: [] };
  const add = (id, label, level, msg, required) => checks.push({ id, label, level, msg, required });
  let u; try { u = new URL(url); } catch { u = null; }
  if (!u || u.protocol !== 'https:') { add('https', 'Served over HTTPS', 'fail', 'Use an https:// address.', true); return { checks, info, pass: false }; }
  add('https', 'Served over HTTPS', 'pass', '', true);
  const r = await httpGet(url);
  if (!r.ok) { add('reach', 'Page loads', 'fail', r.error || ('HTTP ' + r.status), true); return { checks, info, pass: false }; }
  add('reach', 'Page loads', 'pass', '', true); const html = r.text(); info.final_url = r.url;
  let scripts = '';
  const host = new URL(r.url).host; let n = 0;
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const abs = resolveUrl(r.url, decodeEnt(m[1])); if (!abs) continue;
    if (/mypwa\.store\/sdk\/install\.js|hunnyhive\.app\/sdk\/install\.js/i.test(abs)) { scripts += ' hunnyhive.app/sdk/install.js '; continue; }
    if (new URL(abs).host !== host || n >= 4) continue;
    n++; const s = await httpGet(abs, 400000); if (s.ok) scripts += '\n' + s.text();
  }
  const all = html + '\n' + scripts;
  let man = null, murl = '';
  const lm = html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]*>/i);
  const hm = lm && lm[0].match(/href=["']([^"']+)["']/i);
  if (hm) { murl = resolveUrl(r.url, decodeEnt(hm[1])) || ''; const mr = murl ? await httpGet(murl, 200000) : null; if (mr && mr.ok) { try { const j = JSON.parse(mr.text()); if (j && typeof j === 'object') man = j; } catch {} } }
  if (!man) add('manifest', 'Web app manifest', 'fail', 'Add <link rel="manifest" href="/manifest.webmanifest"> with a valid JSON manifest.', true);
  else {
    add('manifest', 'Web app manifest', 'pass', '', true); info.manifest = murl;
    const name = String(man.name || man.short_name || ''); info.name = name; info.description = String(man.description || '');
    add('name', 'Has a name', name ? 'pass' : 'fail', name ? '' : 'Add "name" to the manifest.', true);
    const start = String(man.start_url || ''); info.start_url = start ? resolveUrl(murl, start) : '';
    add('start', 'Has start_url', start ? 'pass' : 'fail', start ? '' : 'Add "start_url" (for example "/").', true);
    const disp = String(man.display || ''); const dOk = ['standalone', 'fullscreen', 'minimal-ui'].includes(disp);
    add('display', 'Opens like an app (display)', dOk ? 'pass' : 'fail', dOk ? '' : 'Set "display": "standalone".', true);
    let has192 = false, has512 = false, maskable = false, best = { px: 0, src: '' };
    for (const ic of (Array.isArray(man.icons) ? man.icons : [])) {
      if (!ic || typeof ic !== 'object') continue;
      for (const sz of String(ic.sizes || '').split(/\s+/)) {
        const mm = sz.match(/^(\d+)x(\d+)$/); if (!mm) continue; const px = +mm[1];
        if (px >= 192) has192 = true; if (px >= 512) has512 = true;
        const src = String(ic.src || ''); if (px > best.px && !/\.svg/i.test(src) && ic.type !== 'image/svg+xml') best = { px, src };
      }
      if (/maskable/i.test(String(ic.purpose || ''))) maskable = true;
    }
    add('icons', 'Icons 192px and 512px', (has192 && has512) ? 'pass' : 'fail', (has192 && has512) ? '' : 'Add PNG icons of at least 192x192 and 512x512.', true);
    add('maskable', 'Maskable icon', maskable ? 'pass' : 'warn', maskable ? '' : 'Recommended: add a 512px icon with "purpose": "maskable".', false);
    add('theme', 'theme_color and background_color', (man.theme_color != null && man.background_color != null) ? 'pass' : 'warn', 'Recommended for a polished launch screen.', false);
    add('desc', 'Description', man.description ? 'pass' : 'warn', 'Recommended: add a one-sentence "description" (shown in the store).', false);
    if (best.src) info.icon = resolveUrl(murl, best.src) || '';
    for (const s of (Array.isArray(man.screenshots) ? man.screenshots : [])) if (s && s.src && info.screenshots.length < 5) { const v = resolveUrl(murl, String(s.src)); if (v) info.screenshots.push(v); }
    add('shots', 'Screenshots in manifest', info.screenshots.length ? 'pass' : 'warn', 'Recommended: add "screenshots" so the store can show a real preview.', false);
  }
  const sw = /serviceWorker\s*\.\s*register\s*\(/i.test(all);
  add('sw', 'Service worker (works offline)', sw ? 'pass' : 'warn', sw ? '' : 'We could not find serviceWorker.register(). Recommended for offline support.', false);
  const sdk = /mypwa\.store\/sdk\/install\.js|hunnyhive\.app\/sdk\/install\.js/i.test(all);
  const own = /beforeinstallprompt/i.test(all) && /install['"]?\s*[=,:]\s*['"]?1|mypwa_install|hunnyhive_install|get\(\s*['"]install['"]\s*\)/i.test(all);
  add('quick', 'Quick install', (sdk || own) ? 'pass' : 'fail', (sdk || own) ? (sdk ? 'Uses the Hunnyhive SDK.' : 'Custom implementation detected.') : 'Add <script src="https://hunnyhive.app/sdk/install.js"></script> to your <head>. It handles the one-tap install when the store opens your app with ?install=1.', true);
  const pass = checks.every(c => !c.required || c.level === 'pass');
  return { checks, info, pass };
}

/* ---------- public endpoints ---------- */
async function check(req, env) {
  await rateLimit(req, env, 'check', 20, 3600);
  const { fields } = await body(req); let url = String(fields.url || '').trim();
  if (!url) fail('Enter your app address.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const r = await checkPwa(url);
  return json({ ok: true, pass: r.pass, checks: r.checks, info: { name: r.info.name, icon: r.info.icon, description: r.info.description } });
}

async function submit(req, env) {
  if (req.method !== 'POST') fail('POST only.', 405);
  kv(env);
  await rateLimit(req, env, 'submit', 5, 3600);
  const { fields: b } = await body(req);
  if (String(b.website || '').trim()) return json({ ok: true, id: 'ok' });            // honeypot
  let url = String(b.url || '').trim(); const email = String(b.email || '').trim();
  if (!url) fail('Enter your app address.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email so we can reach you.');
  const origin = new URL(req.url).origin;
  const reg = await registryRead(env, origin);
  const cats = (reg.categories || []).map(c => c.id);
  const cat = cats.includes(String(b.category || '')) ? String(b.category) : '';
  const r = await checkPwa(url);
  let host = ''; try { host = new URL(url).host; } catch {}
  const name = String(b.name || '').trim() || r.info.name || host || 'app';
  let slug = slugify(name) || slugify(host);
  if (reg.apps.some(a => a.slug === slug)) slug += '-' + Math.random().toString(16).slice(2, 5);
  const d = new Date(); const p = x => String(x).padStart(2, '0');
  const id = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${slug}`;
  const sub = { id, received: d.toISOString(), status: 'pending', slug, name, developer: cut(String(b.developer || '').trim(), 80), email, url,
    category: cat, tagline: cut(String(b.tagline || '').trim() || r.info.description, 140), icon_url: r.info.icon, screenshots: r.info.screenshots, pass: r.pass, checks: r.checks };
  await env.HIVE.put('sub:' + id, JSON.stringify(sub));
  return json({ ok: true, id, pass: r.pass, checks: r.checks, name });
}

/* ---------- owner API ---------- */
async function admin(req, env) {
  const tok = String(env.ADMIN_TOKEN || '');
  if (tok.length < 16) fail('Admin is disabled: add an ADMIN_TOKEN secret (16+ characters) to the hunnyhive Worker in Cloudflare.', 403);
  const given = req.headers.get('X-MYPWA-TOKEN') || '';
  if (!given || !sameStr(await sha(tok), await sha(given))) { await new Promise(r => setTimeout(r, 800)); fail('Admin access required.', 403); }
  const H = kv(env); const origin = new URL(req.url).origin;
  const { fields: b, files } = await body(req); const act = String(b.action || '');
  let o; const parse = v => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } } return v && typeof v === 'object' ? v : {}; };

  const subLoad = async id => { id = String(id || '').replace(/[^a-zA-Z0-9-]/g, ''); const s = await H.get('sub:' + id, 'json'); if (!s) fail('Submission not found.', 404); return s; };
  const subSave = s => H.put('sub:' + s.id, JSON.stringify(s));
  const cleanApp = (reg, a, old = {}) => {
    const cats = (reg.categories || []).map(c => c.id), colls = (reg.collections || []).map(c => c.id); const x = Object.assign({}, old);
    for (const k of ['name', 'developer', 'tagline', 'description']) if (a[k] != null) x[k] = cut(String(a[k]).trim(), k === 'description' ? 1200 : 140);
    if (a.category != null && cats.includes(a.category)) x.category = a.category;
    if ('collection' in a) x.collection = colls.includes(a.collection) ? a.collection : null;
    if (['hosted', 'redirect', 'external'].includes(a.type)) x.type = a.type;
    if (['live', 'beta', 'preview', 'hidden'].includes(a.status)) x.status = a.status;
    if (a.featured != null) x.featured = a.featured === true || a.featured === 'true' || a.featured === 1 || a.featured === '1';
    if ('domain' in a) { const v = String(a.domain || '').trim(); if (!v) { delete x.domain; delete x.domainLive; } else if (/^https:\/\/[a-z0-9.-]+\/?$/i.test(v)) x.domain = v.replace(/\/$/, '') + '/'; }
    if (a.domainLive != null) x.domainLive = a.domainLive === true || a.domainLive === 'true';
    for (const k of ['url', 'installUrl']) if (a[k] != null) { const v = String(a[k]).trim(); if (v === '' || /^(https:\/\/|\/)/.test(v)) x[k] = v; }
    return x;
  };
  const grabIcon = async (src, slug) => {
    if (!src) return false; const r = await httpGet(src, 3000000);
    if (!r.ok || !/^image\//i.test(r.type) || !r.bytes.length) return false;
    await putFile(env, `/icons/apps/${slug}.png`, r.bytes, r.type.split(';')[0]); return true;
  };
  const grabShots = async (list, slug) => {
    const out = []; let i = 0;
    for (const su of (list || []).slice(0, 4)) { const r = await httpGet(su, 3000000); if (!r.ok || !/^image\//i.test(r.type)) { i++; continue; }
      const ext = /png/i.test(r.type) ? 'png' : /webp/i.test(r.type) ? 'webp' : 'jpg'; const path = `/shots/${slug}/s${i}.${ext}`;
      await putFile(env, path, r.bytes, r.type.split(';')[0]); out.push(path); i++; }
    return out;
  };

  switch (act) {
    case 'list': {
      const subs = []; let cursor;
      do { const l = await H.list({ prefix: 'sub:', cursor }); for (const k of l.keys) { const s = await H.get(k.name, 'json'); if (s) subs.push(s); } cursor = l.list_complete ? null : l.cursor; } while (cursor);
      subs.sort((a, b) => String(b.received || '').localeCompare(String(a.received || '')));
      return json({ ok: true, registry: await registryRead(env, origin), submissions: subs, gd: true });
    }
    case 'save_app': {
      const slug = slugify(b.slug); if (!slug) fail('Missing slug.');
      const reg = await registryRead(env, origin); const idx = reg.apps.findIndex(a => a.slug === slug);
      const a = cleanApp(reg, parse(b.app), idx < 0 ? { slug, icon: `/icons/apps/${slug}.png`, screenshots: [], quickInstall: true, added: today(), status: 'live', type: 'external', featured: false, collection: null } : reg.apps[idx]);
      if (!a.name || !a.category || !a.url) fail('Name, category and URL are required.');
      if (a.type === 'external') a.installUrl = a.url;
      if (idx < 0) reg.apps.unshift(a); else reg.apps[idx] = a;
      await registryWrite(env, reg); return json({ ok: true, app: a });
    }
    case 'delete_app': {
      const slug = slugify(b.slug); const reg = await registryRead(env, origin); const n = reg.apps.length;
      reg.apps = reg.apps.filter(a => a.slug !== slug); if (reg.apps.length === n) fail('No such app.', 404);
      await registryWrite(env, reg); return json({ ok: true, note: 'Removed from the catalog. Its files were not touched.' });
    }
    case 'upload_icon': {
      const slug = slugify(b.slug); const f = files.icon; if (!slug || !f) fail('Choose an image.');
      if (f.size > 4000000) fail('Image is over 4 MB.');
      if (!/^image\//.test(f.type || '')) fail('That file is not an image.');
      const path = `/icons/apps/${slug}.png`; await putFile(env, path, await f.arrayBuffer(), f.type);
      const reg = await registryRead(env, origin); const a = reg.apps.find(x => x.slug === slug);
      if (a && a.icon !== path) { a.icon = path; delete a.iconNote; await registryWrite(env, reg); }
      return json({ ok: true, icon: path });
    }
    case 'upload_shot': {
      const slug = slugify(b.slug); const f = files.shot; if (!slug || !f) fail('Choose an image.');
      if (f.size > 4000000) fail('Image is over 4 MB.');
      if (!/^image\//.test(f.type || '')) fail('Not an image.');
      const ext = /png/.test(f.type) ? 'png' : /webp/.test(f.type) ? 'webp' : 'jpg'; const path = `/shots/${slug}/s${Date.now()}.${ext}`;
      await putFile(env, path, await f.arrayBuffer(), f.type);
      const reg = await registryRead(env, origin);
      for (const a of reg.apps) if (a.slug === slug) { a.screenshots = (a.screenshots || []).concat(path).slice(-6); }
      await registryWrite(env, reg); return json({ ok: true, shot: path });
    }
    case 'quick_add': {
      const url = String(b.url || '').trim(); if (!/^https:\/\//i.test(url)) fail('Paste the full https:// address.');
      const reg = await registryRead(env, origin); const cat = String(b.category || '');
      if (!cat || !(reg.categories || []).some(c => c.id === cat)) fail('Pick a category.');
      const r = await checkPwa(url); const i = r.info; const ofs = new URL(i.final_url || url).origin + '/';
      const name = String(b.name || '').trim() || i.name; if (!name) fail('Could not read a name from that site. Fill the name in.');
      const slug = slugify(b.slug || name); if (!slug) fail('Could not make a slug.');
      if (reg.apps.some(a => a.slug === slug)) fail(`"${slug}" is already in the catalog. Enter a different slug.`);
      const app = { slug, name, developer: name, category: cat, type: 'external', status: 'live', url: ofs, installUrl: ofs,
        tagline: cut(String(b.tagline || '') || i.description || (name + ' on Hunnyhive'), 140), description: i.description,
        icon: `/icons/apps/${slug}.png`, screenshots: [], quickInstall: true, added: today(), featured: false, collection: null };
      const iconOk = await grabIcon(i.icon, slug); if (!iconOk) { app.icon = '/icons/icon-512.png'; app.iconNote = 'placeholder'; }
      app.screenshots = await grabShots(i.screenshots, slug);
      reg.apps.unshift(app); await registryWrite(env, reg);
      return json({ ok: true, app, icon_ok: iconOk, shots: app.screenshots.length });
    }
    case 'reject': { const s = await subLoad(b.id); s.status = 'rejected'; s.note = cut(String(b.note || ''), 400); await subSave(s); return json({ ok: true }); }
    case 'approve': {
      const s = await subLoad(b.id); o = parse(b.app);
      const slug = slugify(o.slug || s.slug); const reg = await registryRead(env, origin);
      if (reg.apps.some(a => a.slug === slug)) fail('That slug is already in the catalog. Pick another.');
      const app = cleanApp(reg, Object.assign({ name: s.name, developer: s.developer || s.name, tagline: s.tagline || (s.name + ' on Hunnyhive'), category: s.category, url: s.url, type: 'external', status: s.pass ? 'live' : 'preview' }, o),
        { slug, icon: `/icons/apps/${slug}.png`, screenshots: [], quickInstall: true, added: today(), featured: false, collection: null });
      if (!app.category) fail('Pick a category.');
      app.installUrl = app.url;
      const iconOk = await grabIcon(s.icon_url, slug); if (!iconOk) { app.icon = '/icons/icon-512.png'; app.iconNote = 'placeholder'; }
      app.screenshots = await grabShots(s.screenshots, slug);
      reg.apps.unshift(app); await registryWrite(env, reg);
      s.status = 'approved'; s.slug = slug; await subSave(s);
      return json({ ok: true, app });
    }
    case 'recheck': {
      const s = await subLoad(b.id); const r = await checkPwa(s.url); s.checks = r.checks; s.pass = r.pass; if (r.info.icon) s.icon_url = r.info.icon; await subSave(s);
      return json({ ok: true, submission: s });
    }
    default: fail('Unknown action.');
  }
}
