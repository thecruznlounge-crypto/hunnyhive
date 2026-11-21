/* Hunnyhive — Cloudflare Pages worker (advanced mode).
   Replaces the old Apache .htaccess: subdomain routing, redirects, headers,
   and serves *.html files directly (Pages would otherwise 308-redirect them,
   which breaks service workers that cached index.html).
   The store API (submissions, checker, MasterDash) lives in worker/api.js. */
import { handleApi, registryRead, getFile } from './worker/api.js';
const ROOT = 'hunnyhive.app';
const RESERVED = new Set(['www','mail','cpanel','webmail','admin','masterdash','ftp','games','productivity','activities']);
const GAME_HOSTS = { artatwar: 'art-at-war', sketchmatch: 'sketch-match', escapesketch: 'escape-sketch' };
const OLD_GAMES = /^\/(air-rescue|beat-cops-beat-box|calling-all-cars|fire-level|pair-of-medics|red-light-blue-light|sky-eyes|wave-crash)(\/.*)?$/;
const PRIVATE = /^\/(api|data|worker)(\/|$)|^\/(wrangler\.jsonc|_worker\.js|\.assetsignore)$|\.(php|md|sql|zip|log|env|py|sh|bak|ini|lock)$|\/\.(?!well-known)/i;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const host = url.hostname.toLowerCase();
    const p = url.pathname;
    const go = (to, code = 301) => Response.redirect(to.startsWith('http') ? to : url.origin + to, code);

    // Old domain (if mypwa.store is ever pointed at this project)
    const old = host.match(/^(?:(.+)\.)?mypwa\.store$/);
    if (old) { const sub = old[1] && old[1] !== 'www' ? old[1] + '.' : ''; return go(`https://${sub}${ROOT}${p}${url.search}`); }
    if (host === 'www.' + ROOT) return go(`https://${ROOT}${p}${url.search}`);
    // Store API (old PHP endpoints, now served by the worker)
    if (p.startsWith('/api/')) return handleApi(req, env, null, p);
    if (PRIVATE.test(p)) return notFound(env, url);

    // Subdomains: game shortcuts and <slug>.hunnyhive.app -> /<slug>/app/
    if (host.endsWith('.' + ROOT)) {
      const sub = host.slice(0, -(ROOT.length + 1));
      if (sub === 'masterdash') {
        if (!/^\/(_manage|assets|icons|logo|sdk|apps\.json)/.test(p)) return serve(env, req, url, '/_manage' + (p === '/' ? '/' : p));
      } else if (GAME_HOSTS[sub]) {
        const base = '/games/' + GAME_HOSTS[sub];
        if (!p.startsWith(base + '/')) return serve(env, req, url, base + p);
      } else if (!RESERVED.has(sub) && !/^\/[^/]+\/app\//.test(p)) {
        const r = await serve(env, req, url, '/' + sub + '/app' + p);
        if (r.status !== 404) return r;
      }
    }

    // Retired / renamed paths
    if (/^\/roadbudz(\/.*)?$/.test(p)) return go('/roadesy/');
    if (/^\/apps\/roadbudz\/?$/.test(p)) return go('/apps/roadesy');
    if (/^\/(apps\/)?(myvertise(-app|-market|-media)?|journee(-one)?)(\/.*)?$/.test(p)) return go('/');
    if (/^\/shoppervon(\/.*)?$/.test(p)) return go('/merkuri/');
    if (/^\/glacier-run(\/.*)?$/.test(p)) return go('/games/glacier-rumble/');
    if (/^\/store\/?$/.test(p)) return go('/');
    const g = p.match(OLD_GAMES); if (g) return go('/games/' + g[1] + (g[2] || ''));
    if (/^\/(admin|masterdash|parking-page)(\.html|\.shtml)?\/?$/.test(p)) return notFound(env, url);

    // Pretty preview pages: /apps/<slug> -> app.html (it reads the slug from the path)
    if (/^\/apps\/?$/.test(p)) return go('/?source=apps', 302);
    if (/^\/apps\/[a-z0-9-]+\/?$/.test(p)) return serve(env, req, url, '/app.html');

    // Catalog and uploaded images: storage first (MasterDash edits), repo files as fallback
    if (p === '/apps.json' && env.HIVE) {
      const reg = await registryRead(env, url.origin).catch(() => null);
      if (reg) return withHeaders(new Response(JSON.stringify(reg), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }), p);
    }
    if (/^\/(icons\/apps|shots)\//.test(p)) {
      const f = await getFile(env, decodeURIComponent(p));
      if (f) return withHeaders(f, p, true);
    }
    return serve(env, req, url, p);
  }
};

async function serve(env, req, url, path) {
  // Ask Pages for the "pretty" path so it never answers with a 308
  let pretty = path;
  if (/\/index\.html$/i.test(pretty)) pretty = pretty.slice(0, -10);
  else if (/\.html$/i.test(pretty)) pretty = pretty.slice(0, -5);
  const u = new URL(url); u.pathname = pretty;
  let res = await env.ASSETS.fetch(new Request(u, req));
  if (res.status >= 300 && res.status < 400) {            // still a redirect? follow it once internally
    const loc = res.headers.get('Location');
    if (loc) { const v = new URL(loc, u); if (v.origin === u.origin) res = await env.ASSETS.fetch(new Request(v, req)); }
  }
  return withHeaders(res, path);
}

async function notFound(env, url) {
  const u = new URL(url); u.pathname = '/404';
  const r = await env.ASSETS.fetch(u);
  return new Response(r.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function withHeaders(res, path, short) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  const file = path.split('/').pop() || 'index.html';
  if (/^(sw\.js|apps\.json|manifest\.json|app\.html|index\.html)$/.test(file) || path.endsWith('/') || path === '/app.html') h.set('Cache-Control', 'no-cache');
  if (/^(install\.js|apps\.json)$/.test(file)) h.set('Access-Control-Allow-Origin', '*');
  if (/\.(png|jpg|jpeg|webp|svg|woff2)$/i.test(file)) h.set('Cache-Control', short ? 'public, max-age=300' : 'public, max-age=604800');
  if (/\.webmanifest$/i.test(file)) h.set('Content-Type', 'application/manifest+json');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
