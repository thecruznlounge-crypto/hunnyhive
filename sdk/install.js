/*!
 * Hunnyhive quick-install SDK  v1
 * Add ONE line to your PWA's <head> (as early as possible, before other scripts):
 *   <script src="https://hunnyhive.app/sdk/install.js"></script>
 * Optional: any element with  data-hunnyhive-install  becomes a one-tap install button.
 * (The older data-mypwa-install attribute and window.MyPWA keep working: same SDK.)
 *
 * What it does
 *  1. Captures the browser's install prompt as early as possible (window.__bip).
 *  2. When your app is opened from the store (?install=1) it shows one full-screen
 *     "Install" button. One tap -> the native install dialog. No extra steps.
 *  3. iOS / browsers without an install API get a 2-step "Add to Home Screen" guide.
 * Works on any origin; no dependencies; ~4 KB.
 */
(function (w, d) {
  'use strict';
  if (w.MyPWA && w.MyPWA.__v) return;
  var deferred = w.__bip || null, listeners = [];
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = function () { return (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  var qs = new URLSearchParams(location.search);
  var wantsInstall = qs.get('install') === '1' || qs.get('mypwa_install') === '1' || qs.get('hunnyhive_install') === '1';
  var fromStore = qs.get('from') === 'store';

  w.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; w.__bip = e;
    listeners.forEach(function (f) { try { f(true); } catch (x) {} });
    if (wantsInstall && overlay) setState('ready');
  });
  w.addEventListener('appinstalled', function () { deferred = null; w.__bip = null; try { localStorage.setItem('mypwa:installed:' + location.host + location.pathname.split('/')[1], '1'); } catch (x) {} if (overlay) setState('done'); });

  function appInfo() {
    var name = (d.querySelector('meta[name="application-name"]') || {}).content || (d.title || location.host).split(/[|\-–—]/)[0].trim();
    var icon = '';
    var l = d.querySelector('link[rel="apple-touch-icon"]') || d.querySelector('link[rel~="icon"]');
    if (l) icon = l.href;
    return { name: name, icon: icon };
  }

  function install() {
    if (deferred) {
      var p = deferred; deferred = null; w.__bip = null;
      p.prompt();
      return p.userChoice.then(function (c) { return c && c.outcome; }).catch(function () { return 'dismissed'; });
    }
    return Promise.resolve('unavailable');
  }

  /* ---------- overlay ---------- */
  var overlay = null, els = {};
  function css() {
    var s = d.createElement('style');
    s.textContent = '.mpi-o{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(23,18,11,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '.mpi-c{width:100%;max-width:380px;background:#FFF9EC;color:#241A0E;border-radius:28px;padding:26px 22px 20px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.45)}' +
      '@media(prefers-color-scheme:dark){.mpi-c{background:#231B11;color:#FBF1DE}.mpi-t{color:#C2B092!important}.mpi-x{color:#C2B092!important}.mpi-g{background:#3A2E1D!important;color:#FBF1DE!important}}' +
      '.mpi-i{width:96px;height:96px;border-radius:22%;object-fit:cover;box-shadow:0 10px 28px rgba(0,0,0,.25);background:#FFE7A8}' +
      '.mpi-n{font-size:24px;font-weight:800;margin:14px 0 2px}.mpi-t{font-size:14px;color:#6B5A44;margin:0 0 18px}' +
      '.mpi-b{display:block;width:100%;border:0;border-radius:16px;background:#F2A900;color:#241A0E;font:800 18px system-ui,sans-serif;padding:16px;cursor:pointer}.mpi-b:active{transform:scale(.98)}' +
      '.mpi-g{display:block;width:100%;margin-top:10px;border:0;border-radius:14px;background:#F3E8D2;color:#4A3A26;font:700 14px system-ui,sans-serif;padding:12px;cursor:pointer;text-decoration:none}' +
      '.mpi-s{text-align:left;font-size:15px;line-height:1.5;margin:6px 0 4px}.mpi-s b{display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:#F2A900;color:#241A0E;font-size:12px;margin-right:8px}' +
      '.mpi-s p{margin:10px 0}.mpi-ok{font-size:44px;margin:0}';
    d.head.appendChild(s);
  }
  function build() {
    css();
    var a = appInfo();
    overlay = d.createElement('div'); overlay.className = 'mpi-o'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="mpi-c"><div class="mpi-top"></div></div>';
    d.body.appendChild(overlay);
    els.top = overlay.querySelector('.mpi-top'); els.a = a;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }
  function close() { if (overlay) { overlay.remove(); overlay = null; } try { var u = new URL(location.href); u.searchParams.delete('install'); u.searchParams.delete('mypwa_install'); u.searchParams.delete('hunnyhive_install'); history.replaceState(null, '', u); } catch (x) {} }
  function head(a) { return (a.icon ? '<img class="mpi-i" src="' + a.icon + '" alt="">' : '') + '<div class="mpi-n"></div>'; }
  function setState(s) {
    if (!overlay) return; var a = els.a, h = head(a), top = els.top, back = fromStore ? '<a class="mpi-g" href="https://hunnyhive.app/">Back to Hunnyhive</a>' : '';
    if (s === 'ready') top.innerHTML = h + '<p class="mpi-t">Add it to your home screen. One tap.</p><button class="mpi-b" data-a="go">Install app</button><button class="mpi-g" data-a="x">Not now</button>' + back;
    else if (s === 'ios') top.innerHTML = h + '<p class="mpi-t">Two quick steps in Safari:</p><div class="mpi-s"><p><b>1</b>Tap the <strong>Share</strong> button <span aria-hidden="true">⬆️</span></p><p><b>2</b>Choose <strong>Add to Home Screen</strong></p></div><button class="mpi-g" data-a="x">Got it</button>' + back;
    else if (s === 'manual') top.innerHTML = h + '<p class="mpi-t">This browser isn’t offering install for this app. Open this page in Chrome or Edge to install with one tap.</p><button class="mpi-g" data-a="x">Got it</button>' + back;
    else if (s === 'done') top.innerHTML = '<p class="mpi-ok">✅</p><div class="mpi-n"></div><p class="mpi-t">Installed. Find it on your home screen.</p><button class="mpi-b" data-a="x">Done</button>' + back;
    else if (s === 'wait') top.innerHTML = h + '<p class="mpi-t">Getting ready…</p><button class="mpi-b" data-a="go">Install app</button><button class="mpi-g" data-a="x">Not now</button>' + back;
    var n = top.querySelector('.mpi-n'); if (n) n.textContent = a.name;
    top.onclick = function (e) {
      var t = e.target.closest('[data-a]'); if (!t) return; var act = t.getAttribute('data-a');
      if (act === 'x') close();
      if (act === 'go') api.install().then(function (r) { if (r === 'accepted') setState('done'); else if (r === 'unavailable') setState(isIOS ? 'ios' : 'manual'); else close(); });
    };
  }
  function showOverlay() {
    if (isStandalone() || overlay) return;
    if (!d.body) return d.addEventListener('DOMContentLoaded', showOverlay);
    build();
    if (isIOS) setState('ios'); else if (deferred) setState('ready'); else { setState('wait'); setTimeout(function () { if (overlay && !deferred) setState('manual'); }, 2500); }
  }

  /* ---------- public API ---------- */
  var api = w.MyPWA = w.Hunnyhive = {
    __v: 1,
    install: function () { return deferred ? install() : Promise.resolve(isIOS ? (showOverlay(), 'ios') : 'unavailable'); },
    canPrompt: function () { return !!deferred; },
    isInstalled: isStandalone,
    onReady: function (f) { listeners.push(f); if (deferred) f(true); },
    showInstall: showOverlay
  };
  function bind() {
    Array.prototype.forEach.call(d.querySelectorAll('[data-mypwa-install],[data-hunnyhive-install]'), function (b) {
      if (b.__mpi) return; b.__mpi = 1;
      if (isStandalone()) { b.style.display = 'none'; return; }
      b.addEventListener('click', function (e) { e.preventDefault(); if (deferred) install(); else showOverlay(); });
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bind); else bind();
  if (wantsInstall) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', showOverlay); else showOverlay(); }
})(window, document);
