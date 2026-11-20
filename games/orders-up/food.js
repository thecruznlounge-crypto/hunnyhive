/* Food: shared drawing helpers for the fast food games (emoji items, layered burger slices, shakes, bubbles). */
window.Food = (function () {
  const TAU = Math.PI * 2;
  const EMO = { burger: '\u{1F354}', fries: '\u{1F35F}', soda: '\u{1F964}', pizza: '\u{1F355}', taco: '\u{1F32E}', hotdog: '\u{1F32D}', nuggets: '\u{1F357}', donut: '\u{1F369}', icecream: '\u{1F366}', cookie: '\u{1F36A}', burrito: '\u{1F32F}', sushi: '\u{1F363}', coffee: '☕', salad: '\u{1F957}', cake: '\u{1F370}', corn: '\u{1F33D}', sandwich: '\u{1F96A}', bag: '\u{1F6CD}️', star: '⭐', coin: '\u{1FA99}', cash: '\u{1F4B5}', fire: '\u{1F525}', check: '✅', cross: '❌', clock: '⏱️', cone: '\u{1F6A7}', car: '\u{1F697}', truck: '\u{1F69A}', van: '\u{1F690}', bus: '\u{1F68C}', moto: '\u{1F3CD}️', bubble: '\u{1F9CB}', ketchup: '\u{1F345}', cheese: '\u{1F9C0}', egg: '\u{1F95A}', bacon: '\u{1F953}', pickle: '\u{1F952}', onion: '\u{1F9C5}', mop: '\u{1F9F9}', warn: '⚠️', home: '\u{1F3E0}', shop: '\u{1F3EA}', truckfood: '\u{1F69A}', person: '\u{1F9D1}' };
  const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function emoji(c, ch, x, y, size, o) {
    o = o || {}; c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.sx) c.scale(o.sx, o.sy == null ? o.sx : o.sy);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.shadow !== false) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, size * 0.42, size * 0.4, size * 0.1, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#fff'; c.font = Math.round(size) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(EMO[ch] || ch, 0, 0); c.restore();
  }
  function grad(c, x0, y0, x1, y1, a, b) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  /* Burger layers. Origin is the centre of the layer, w is the width. Heights vary; returns the layer height. */
  const SH = { bunB: 0.2, patty: 0.17, cheese: 0.07, lettuce: 0.1, tomato: 0.09, onion: 0.07, pickle: 0.07, bacon: 0.07, egg: 0.09, sauce: 0.06, bunT: 0.42 };
  function slice(c, name, x, y, w, o) {
    o = o || {}; const h = w * SH[name]; c.save(); c.translate(x, y); c.lineJoin = 'round'; c.strokeStyle = 'rgba(58,26,8,.85)'; c.lineWidth = Math.max(1.6, w * 0.025);
    if (name === 'bunB') { rr(c, -w / 2, -h / 2, w, h, [h * 0.15, h * 0.15, h * 0.5, h * 0.5]); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#f4c36a', '#c98a32'); c.fill(); c.stroke(); }
    else if (name === 'bunT') {
      c.beginPath(); c.moveTo(-w / 2, h * 0.5); c.bezierCurveTo(-w / 2, -h * 0.9, w / 2, -h * 0.9, w / 2, h * 0.5); c.lineTo(-w / 2, h * 0.5); c.closePath(); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#f9d58a', '#d99a3a'); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-w * 0.18, -h * 0.28, w * 0.16, h * 0.08, -0.4, 0, TAU); c.fill();
      c.fillStyle = '#fff6d8'; [[-0.22, -0.05, 0.3], [0.05, -0.28, -0.2], [0.25, -0.02, 0.5], [-0.05, 0.12, 0.1], [0.34, 0.2, 0.3], [-0.34, 0.2, -0.3]].forEach(s => { c.beginPath(); c.ellipse(s[0] * w, s[1] * h, w * 0.025, w * 0.013, s[2], 0, TAU); c.fill(); });
    }
    else if (name === 'patty') { rr(c, -w * 0.47, -h / 2, w * 0.94, h, h * 0.45); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#8a4a2a', '#4a2210'); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-w * 0.38, -h * 0.3, w * 0.76, h * 0.12); c.fillStyle = 'rgba(0,0,0,.25)'; [-0.3, -0.1, 0.12, 0.3].forEach(k => c.fillRect(k * w, -h * 0.08, w * 0.04, h * 0.3)); }
    else if (name === 'cheese') { c.beginPath(); c.moveTo(-w * 0.5, -h / 2); c.lineTo(w * 0.5, -h / 2); c.lineTo(w * 0.5, 0); c.lineTo(w * 0.36, h * 1.5); c.lineTo(w * 0.24, 0); c.lineTo(-w * 0.1, 0); c.lineTo(-w * 0.2, h * 1.1); c.lineTo(-w * 0.32, 0); c.lineTo(-w * 0.5, 0); c.closePath(); c.fillStyle = grad(c, 0, -h / 2, 0, h, '#ffe066', '#f0b41c'); c.fill(); c.stroke(); }
    else if (name === 'lettuce') { c.beginPath(); c.moveTo(-w * 0.52, 0); for (let i = 0; i < 10; i++) c.quadraticCurveTo(-w * 0.52 + (i + 0.5) * w * 0.104, i % 2 ? h * 0.9 : -h * 0.9, -w * 0.52 + (i + 1) * w * 0.104, 0); c.lineTo(w * 0.52, h * 0.1); c.lineTo(-w * 0.52, h * 0.1); c.closePath(); c.fillStyle = grad(c, 0, -h, 0, h, '#a8ee6a', '#4aa83a'); c.fill(); c.stroke(); }
    else if (name === 'tomato') { rr(c, -w * 0.44, -h / 2, w * 0.88, h, h / 2); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#ff6a52', '#c42f2f'); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-w * 0.34, -h * 0.28, w * 0.5, h * 0.14); }
    else if (name === 'onion') { rr(c, -w * 0.42, -h / 2, w * 0.84, h, h / 2); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#fbe8ff', '#c89ad8'); c.fill(); c.stroke(); c.strokeStyle = 'rgba(120,60,150,.5)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-w * 0.3, 0); c.lineTo(w * 0.3, 0); c.stroke(); }
    else if (name === 'pickle') { [-0.22, 0.22].forEach(k => { rr(c, k * w - w * 0.17, -h / 2, w * 0.34, h, h / 2); c.fillStyle = grad(c, 0, -h / 2, 0, h / 2, '#8ad84a', '#3e8a22'); c.fill(); c.stroke(); }); }
    else if (name === 'bacon') { c.beginPath(); c.moveTo(-w * 0.46, 0); for (let i = 0; i < 6; i++) c.quadraticCurveTo(-w * 0.46 + (i + 0.5) * w * 0.153, i % 2 ? -h * 0.9 : h * 0.9, -w * 0.46 + (i + 1) * w * 0.153, 0); c.lineWidth = h * 1.1; c.strokeStyle = '#7a1c14'; c.stroke(); c.lineWidth = h * 0.5; c.strokeStyle = '#d8584a'; c.stroke(); }
    else if (name === 'egg') { c.beginPath(); c.ellipse(0, 0, w * 0.46, h * 0.55, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.stroke(); c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(w * 0.05, -h * 0.05, h * 0.3, 0, TAU); c.fill(); }
    else if (name === 'sauce') { rr(c, -w * 0.45, -h / 2, w * 0.9, h, h / 2); c.fillStyle = '#e8453a'; c.fill(); c.strokeStyle = 'rgba(58,26,8,.6)'; c.lineWidth = 1.4; c.stroke(); }
    c.restore(); return name === 'bunT' ? h * 0.7 : name === 'cheese' ? h * 0.6 : h;
  }
  const SHAKE = { vanilla: ['#fff3d0', '#f0dca0'], choco: ['#8a5a3a', '#5a3018'], berry: ['#ff9ac0', '#e8588a'], mint: ['#9ae8c0', '#4cc08a'], banana: ['#ffe27a', '#f0b83a'], blue: ['#8ac8ff', '#4a90e8'] };
  function shake(c, flavor, x, y, s, o) {
    o = o || {}; const f = SHAKE[flavor] || SHAKE.vanilla; c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(s, s); c.lineJoin = 'round'; c.strokeStyle = 'rgba(58,26,8,.85)'; c.lineWidth = 2.4;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 30, 17, 4, 0, 0, TAU); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(6, -10); c.lineTo(12, -38); c.stroke(); c.strokeStyle = '#e8453a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(7, -10); c.lineTo(13, -38); c.stroke();
    c.strokeStyle = 'rgba(58,26,8,.85)'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-16, -6); c.lineTo(16, -6); c.lineTo(11, 28); c.lineTo(-11, 28); c.closePath(); c.fillStyle = grad(c, -16, 0, 16, 0, f[0], f[1]); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-12, -3, 4, 26);
    c.beginPath(); c.ellipse(0, -8, 19, 8, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -15, 14, 10, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.stroke();
    c.fillStyle = '#e8453a'; c.beginPath(); c.arc(0, -25, 4.4, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }
  function bubble(c, x, y, w, h, tail, fill) {
    c.save(); c.fillStyle = fill || '#fff'; c.strokeStyle = 'rgba(58,26,8,.9)'; c.lineWidth = 2.4; c.lineJoin = 'round';
    c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, Math.min(18, h / 2)); c.fill(); c.stroke();
    if (tail) { c.beginPath(); c.moveTo(x - 8, y + h / 2 - 1); c.lineTo(x + (tail === 'l' ? -14 : 2), y + h / 2 + 14); c.lineTo(x + 10, y + h / 2 - 1); c.closePath(); c.fill(); c.stroke(); c.fillStyle = fill || '#fff'; c.fillRect(x - 7, y + h / 2 - 3, 16, 4); }
    c.restore();
  }
  function text(c, s, x, y, size, color, o) {
    o = o || {}; c.save(); c.font = '700 ' + Math.round(size) + 'px Fredoka, system-ui, sans-serif'; c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
    if (o.stroke !== false) { c.lineWidth = Math.max(3, size * 0.2); c.strokeStyle = o.sc || 'rgba(40,12,4,.85)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = color || '#fff'; c.fillText(s, x, y); c.restore();
  }
  function floor(c, W, H, y0, a, b, sz) { for (let y = y0; y < H; y += sz) for (let x = 0; x < W; x += sz) { c.fillStyle = (((x / sz) | 0) + (((y - y0) / sz) | 0)) % 2 ? a : b; c.fillRect(x, y, sz + 1, sz + 1); } }
  function meter(c, x, y, w, h, k, col, bg) { c.fillStyle = bg || 'rgba(0,0,0,.5)'; rr(c, x, y, w, h, h / 2); c.fill(); if (k > 0) { c.fillStyle = col; rr(c, x, y, Math.max(h, w * Math.min(1, k)), h, h / 2); c.fill(); } }
  /* Shared game flow: title -> play -> pause -> over, with results portrait. cfg: {hero, onStart(), best key via Kit.get} */
  function flow(cfg) {
    const $ = Kit.$, F = { mode: 'title' };
    F.start = () => { F.mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); cfg.onStart(); };
    F.pause = () => { if (F.mode !== 'play') return; F.mode = 'pause'; Kit.show('pause'); };
    F.resume = () => { if (F.mode === 'pause') { F.mode = 'play'; Kit.hideScreens(); } };
    F.menu = () => { F.mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); };
    F.over = (title, rows) => {
      F.mode = 'over'; $('hud').classList.remove('show'); $('resTitle').textContent = title;
      $('resStats').innerHTML = rows.map(r => '<div class="row' + (r[2] ? ' hi' : '') + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
      const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, d = Math.min(2, devicePixelRatio || 1); c.width = cw * d; c.height = ch * d;
      const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); Heroes.draw(g, cfg.hero, cw / 2, ch - 8, Math.min(ch / 125, cw / 150), { look: 0 });
      Kit.show('over');
    };
    Kit.wire({ onPause: F.pause, onResume: F.resume, onQuit: F.menu });
    ['btnPlay', 'btnAgain', 'btnRestart'].forEach(id => $(id).addEventListener('click', F.start)); $('btnMenu').addEventListener('click', F.menu);
    return F;
  }
  return { flow, emoji, slice, shake, bubble, text, floor, meter, SHAKE, EMO, SH, TAU };
})();
