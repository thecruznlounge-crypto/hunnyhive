/* Install button helper - one tap, no manual steps.
   Chrome/Edge/Android/desktop: the button fires the browser's native install prompt directly,
   and is only shown once the browser has offered it. iPhone/iPad (no install API): a short
   Add to Home Screen guide. */
(function (global) {
  'use strict';
  let deferred = global.__bip || null;
  const buttons = [];
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function standalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) || global.navigator.standalone === true;
  }
  function refresh() {
    const show = !standalone() && (!!deferred || isIOS);
    buttons.forEach(b => { b.hidden = !show; });
  }
  function modal(html) {
    let m = document.getElementById('installModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'installModal';
      m.className = 'modal';
      m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="installTitle">' +
        '<h2 id="installTitle">Add to Home Screen</h2><div class="modal-body"></div>' +
        '<button class="btn primary" id="installClose" type="button">Got it</button></div>';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m || e.target.id === 'installClose') m.classList.remove('open'); });
    }
    m.querySelector('.modal-body').innerHTML = html;
    m.classList.add('open');
  }
  async function click() {
    if (deferred) {
      const d = deferred; deferred = null; global.__bip = null;
      d.prompt();
      try { await d.userChoice; } catch (e) { /* ignore */ }
      refresh();
      return;
    }
    if (isIOS) {
      modal('<ol><li>Tap the <b>Share</b> button in Safari.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>');
    }
  }
  /* Capture the install offer as early as possible (this file loads in <head>). */
  global.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; global.__bip = e; refresh(); });
  global.addEventListener('appinstalled', () => { deferred = null; global.__bip = null; buttons.forEach(b => { b.hidden = true; }); });

  function mount(selector) {
    document.querySelectorAll(selector).forEach(b => {
      if (buttons.indexOf(b) < 0) { buttons.push(b); b.addEventListener('click', click); }
    });
    refresh();
  }
  function registerSW() {
    if ('serviceWorker' in navigator) {
      global.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
    }
  }
  global.Install = { mount, registerSW, standalone };
})(window);
