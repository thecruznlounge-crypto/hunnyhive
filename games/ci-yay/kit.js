/* Arctic Games - small shared kit: audio, storage, screens, canvas setup, pause/mute/help wiring. */
(function (global) {
  'use strict';
  const Kit = {};
  const $ = id => document.getElementById(id);
  Kit.$ = $;

  /* ---------- storage ---------- */
  let NS = 'arctic';
  Kit.ns = n => { NS = n; };
  Kit.get = (k, d) => { try { const v = localStorage.getItem(NS + '.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  Kit.set = (k, v) => { try { localStorage.setItem(NS + '.' + k, JSON.stringify(v)); } catch (e) {} };

  /* ---------- audio ---------- */
  let AC = null, master = null, muted = false;
  try { muted = localStorage.getItem('arctic.muted') === '1'; } catch (e) {}
  Kit.ac = function () {
    if (!AC) {
      try {
        AC = new (global.AudioContext || global.webkitAudioContext)();
        master = AC.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(AC.destination);
      } catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  };
  Kit.out = () => { Kit.ac(); return master; };
  Kit.muted = () => muted;
  Kit.setMuted = function (m) {
    muted = !!m;
    try { localStorage.setItem('arctic.muted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.8;
    const b = $('btnMute'); if (b) b.classList.toggle('off', muted);
  };
  Kit.tone = function (freq, dur, type, vol, slide, when) {
    const a = Kit.ac(); if (!a || muted) return;
    const t = (when != null ? when : a.currentTime);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const v = vol == null ? 0.2 : vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  };
  let noiseBuf = null;
  Kit.noise = function (dur, vol, when, cutoff) {
    const a = Kit.ac(); if (!a || muted) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = (when != null ? when : a.currentTime);
    const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = cutoff || 1500;
    const g = a.createGain(); g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.03);
  };
  Kit.vibe = function (ms) {
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {}
  };

  /* ---------- UI helpers ---------- */
  Kit.show = function (id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id)); };
  Kit.hideScreens = function () { document.querySelectorAll('.screen').forEach(s => s.classList.remove('show')); };
  let toastT = 0;
  Kit.toast = function (msg) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1500);
  };
  Kit.banner = function (main, sub, cls) {
    const b = $('banner'); if (!b) return;
    b.className = 'banner';
    b.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    void b.offsetWidth; b.classList.add(cls || 'pop');
  };

  /* ---------- canvas ---------- */
  Kit.setup = function (canvas) {
    const S = { canvas, ctx: canvas.getContext('2d'), W: 0, H: 0, dpr: 1, cap: 2, onresize: null, slow: 0 };
    function fit() {
      S.W = global.innerWidth; S.H = global.innerHeight;
      S.dpr = Math.min(S.cap, global.devicePixelRatio || 1);
      canvas.width = Math.round(S.W * S.dpr); canvas.height = Math.round(S.H * S.dpr);
      S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (S.onresize) S.onresize();
    }
    global.addEventListener('resize', fit);
    global.addEventListener('orientationchange', () => setTimeout(fit, 120));
    fit(); S.fit = fit;
    /* adaptive resolution: if frames are slow, drop the pixel ratio */
    S.watch = function (dt) {
      if (dt > 0.034) S.slow++; else S.slow = Math.max(0, S.slow - 1);
      if (S.slow > 40 && S.cap > 1) { S.cap = Math.max(1, S.cap - 0.5); S.slow = 0; fit(); }
    };
    return S;
  };

  /* Fixed loop with clamped dt. fn(dt, t) */
  Kit.loop = function (fn) {
    let last = 0, t = 0, run = true;
    function f(ts) {
      if (!run) return;
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; t += dt;
      requestAnimationFrame(f);
      fn(dt, t);
    }
    requestAnimationFrame(f);
    return { stop() { run = false; } };
  };

  /* Wire pause, resume, quit, mute, help. hooks: {onPause, onResume, onQuit} */
  Kit.wire = function (hooks) {
    hooks = hooks || {};
    const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', fn); };
    on('btnMute', () => Kit.setMuted(!muted));
    on('btnHow', () => $('how').classList.add('open'));
    on('howClose', () => $('how').classList.remove('open'));
    on('btnPause', () => { if (hooks.onPause) hooks.onPause(); });
    on('btnResume', () => { if (hooks.onResume) hooks.onResume(); });
    on('btnQuit', () => { if (hooks.onQuit) hooks.onQuit(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && hooks.onPause) hooks.onPause(true); });
    Kit.setMuted(muted);
    if (global.Install) { Install.mount('.install-btn'); Install.registerSW(); }
  };

  global.Kit = Kit;
})(window);
