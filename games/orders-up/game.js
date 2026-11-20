/* Orders Up - tap the menu items to match each customer's order before they lose patience. */
(function () {
  'use strict';
  Kit.ns('orders-up');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  let W, H, u, trayY, btnTop, btnH, cols;
  const STAGES = [
    { name: 'Burger Barn', menu: ['burger', 'fries', 'soda', 'cookie'], bg: ['#8a2a1c', '#5a1810'], fl: ['#e8d8b8', '#d0bc94'], maxItems: 1, cust: 2, pat: 22, goal: 6 },
    { name: 'Pizza Palace', menu: ['pizza', 'soda', 'salad', 'cake'], bg: ['#2a6a3a', '#174a24'], fl: ['#f2e6c8', '#d8c8a0'], maxItems: 2, cust: 2, pat: 21, goal: 8 },
    { name: 'Taco Fiesta', menu: ['taco', 'burrito', 'corn', 'soda', 'icecream'], bg: ['#c8741c', '#8a4a0c'], fl: ['#f4e0b0', '#dcc488'], maxItems: 2, cust: 3, pat: 20, goal: 10 },
    { name: 'Chicken Shack', menu: ['nuggets', 'fries', 'sandwich', 'soda', 'cookie', 'corn'], bg: ['#a82a2a', '#6a1414'], fl: ['#f2e4cc', '#d6c2a0'], maxItems: 3, cust: 3, pat: 19, goal: 12 },
    { name: 'Donut Den', menu: ['donut', 'coffee', 'icecream', 'cookie', 'cake', 'bubble'], bg: ['#c84a8a', '#8a2a5a'], fl: ['#fbe6f0', '#e8c4d8'], maxItems: 3, cust: 3, pat: 18, goal: 14 },
    { name: 'Food Court', menu: ['burger', 'fries', 'soda', 'pizza', 'taco', 'hotdog', 'nuggets', 'donut'], bg: ['#2a3a8a', '#141e5a'], fl: ['#e8ecf8', '#c4cce0'], maxItems: 4, cust: 4, pat: 17, goal: 16 }
  ];
  const stg = () => { const b = STAGES[(stage - 1) % STAGES.length]; const lap = Math.floor((stage - 1) / STAGES.length); return Object.assign({}, b, { pat: Math.max(9, b.pat - lap * 2.5), goal: b.goal + lap * 2 }); };
  const COLS = ['#ffb74a', '#6ac8ff', '#9aee7a', '#ff8ab4', '#c8a0ff', '#ffe066'], HATS = ['', '', '\u{1F9E2}', '\u{1F452}', '\u{1F3A9}', ''];
  let mode = 'title', stage = 1, score = 0, strikes = 0, served = 0, servedTotal = 0, combo = 0, bestCombo = 0, t = 0, custs = [], tray = [], parts = [], spawnT = 0, state = 'play', stateT = 0, shake = 0, flash = 0, cfg, menuBtns = [], nextId = 1;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760);
    cfg = cfg || stg(); const n = cfg.menu.length; cols = n <= 4 ? 4 : n <= 6 ? 3 : 4; const rows = Math.ceil(n / cols);
    btnH = Math.min(86 * u, (H * 0.34) / rows - 8); trayY = H - rows * (btnH + 8) - 20 - 56 * u; btnTop = trayY + 56 * u;
    const bw = (W - 24 - (cols - 1) * 8) / cols; menuBtns = cfg.menu.map((k, i) => ({ k, x: 12 + (i % cols) * (bw + 8), y: btnTop + Math.floor(i / cols) * (btnH + 8), w: bw, h: btnH, p: 0 }));
  }
  S.onresize = layout; layout();
  function custSlots() { const n = cfg.cust, w = (W - 16) / n; return Array.from({ length: n }, (_, i) => ({ x: 8 + w * i + w / 2, w: w - 8 })); }
  function newOrder() { const k = rint(1, Math.min(cfg.maxItems, stage > 1 || cfg.maxItems > 1 ? cfg.maxItems : 1)); const o = []; for (let i = 0; i < k; i++) o.push(pick(cfg.menu)); return o.sort(); }
  function spawn() {
    const slots = custSlots(); const free = slots.map((s, i) => i).filter(i => !custs.some(c => c.slot === i)); if (!free.length) return false;
    const vip = Math.random() < 0.12, o = newOrder(), pat = cfg.pat * (vip ? 0.85 : 1) * (0.9 + o.length * 0.18);
    custs.push({ id: nextId++, slot: pick(free), order: o, pat, pmax: pat, vip, col: pick(COLS), hat: pick(HATS), x: Math.random() < 0.5 ? -60 : W + 60, bob: Math.random() * 6, leaving: 0, state: 'in' }); return true;
  }
  function counts(a) { const m = {}; a.forEach(k => m[k] = (m[k] || 0) + 1); return m; }
  function isSubset(a, b) { const ca = counts(a), cb = counts(b); return Object.keys(ca).every(k => (cb[k] || 0) >= ca[k]); }
  function same(a, b) { return a.length === b.length && isSubset(a, b); }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + served + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function say(txt, x, y, col) { parts.push({ txt, x, y, age: 0, life: 1.1, col }); }
  function tap(i) {
    if (mode !== 'play' || state !== 'play') return; const b = menuBtns[i]; if (!b) return; b.p = 1; Kit.ac();
    const active = custs.filter(c => c.state === 'wait'); tray.push(b.k); Kit.tone(520 + i * 60, 0.06, 'triangle', 0.14);
    const match = active.find(c => same(c.order, tray));
    if (match) { serve(match); return; }
    if (!active.some(c => isSubset(tray, c.order))) { /* wrong combination */ combo = 0; shake = 0.35; flash = 0.25; Kit.tone(150, 0.25, 'sawtooth', 0.14, -60); Kit.vibe(30); say('Oops!', W / 2, trayY - 10, '#ff8a7a'); tray = []; }
    if (tray.length > 5) tray = [];
  }
  function serve(c) {
    const k = clamp(c.pat / c.pmax, 0, 1); combo++; bestCombo = Math.max(bestCombo, combo); const mult = 1 + Math.min(10, combo - 1) * 0.1;
    const pts = Math.round((80 * c.order.length + 100 * k) * (c.vip ? 2 : 1) * mult); score += pts; served++; servedTotal++; c.state = 'out'; c.leaving = 0; c.happy = true; tray = [];
    const s = custSlots()[c.slot]; say('+' + pts, s.x, trayY - 220 * u, '#ffe066'); if (combo >= 3) say('x' + combo + ' combo!', s.x, trayY - 250 * u, '#8aee9a');
    for (let i = 0; i < 10; i++) parts.push({ x: s.x, y: trayY - 150 * u, vx: rnd(-130, 130), vy: rnd(-220, -60), age: 0, life: 0.8, c: pick(['#ffe066', '#ff8a7a', '#8aee9a']) });
    Kit.tone(660, 0.1, 'triangle', 0.2); Kit.tone(990, 0.16, 'triangle', 0.18, 0, Kit.ac().currentTime + 0.08); syncHud();
    if (served >= cfg.goal) { state = 'clear'; stateT = 0; const b = 300 + (3 - strikes) * 100; score += b; say('Stage clear! +' + b, W / 2, H * 0.4, '#fff'); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.2, 'triangle', 0.22, 0, Kit.ac().currentTime + 0.12); }
  }
  function lose(c) {
    strikes++; combo = 0; flash = 0.5; c.state = 'out'; c.happy = false; const s = custSlots()[c.slot]; say('Too slow!', s.x, trayY - 220 * u, '#ff8a7a'); Kit.tone(170, 0.4, 'sawtooth', 0.18, -90); Kit.vibe(60); syncHud();
    if (strikes >= 3) { state = 'lost'; stateT = 0; }
  }
  function newStage() { cfg = stg(); layout(); custs = []; tray = []; served = 0; spawnT = 0.4; state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, cfg.name); syncHud(); }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; } else q.y -= 30 * dt; }); parts = parts.filter(q => q.age < q.life);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); menuBtns.forEach(b => b.p = Math.max(0, b.p - dt * 6));
    if (mode !== 'play') return; stateT += dt; t += 0;
    if (state === 'lost') { if (stateT > 1.1) gameOver(); return; }
    if (state === 'clear') { if (stateT > 1.8) { stage++; newStage(); } return; }
    const slots = custSlots();
    custs.forEach(c => {
      const s = slots[c.slot]; c.bob += dt * 3;
      if (c.state === 'in') { c.x += (s.x - c.x) * Math.min(1, dt * 7); if (Math.abs(c.x - s.x) < 2) { c.x = s.x; c.state = 'wait'; Kit.tone(880, 0.05, 'sine', 0.1); } }
      else if (c.state === 'wait') { c.x += (s.x - c.x) * Math.min(1, dt * 7); c.pat -= dt * (1 + stage * 0.02); if (c.pat <= 0) lose(c); }
      else { c.leaving += dt; c.x += (c.happy ? 1 : -1) * 260 * dt * c.leaving; }
    });
    custs = custs.filter(c => !(c.state === 'out' && c.leaving > 0.9));
    spawnT -= dt; if (spawnT <= 0) { const waiting = custs.filter(c => c.state !== 'out').length; if (waiting < cfg.cust && spawn()) spawnT = Math.max(0.9, 2.6 - stage * 0.15) * rnd(0.7, 1.3); else spawnT = 0.5; }
    if (custs.filter(c => c.state === 'wait').length === 0 && spawnT > 0.6) spawnT = 0.6;
  }
  function drawCust(c) {
    const s = custSlots()[c.slot], w = s.w, cx = c.x, cy = trayY - 120 * u + Math.sin(c.bob) * 3, r = Math.min(34 * u, w * 0.3), k = clamp(c.pat / c.pmax, 0, 1);
    ctx.save(); ctx.globalAlpha = c.state === 'out' ? clamp(1 - c.leaving, 0, 1) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.6, r * 1.1, r * 0.28, 0, 0, TAU); ctx.fill();
    /* body */
    const g = ctx.createLinearGradient(0, cy, 0, cy + r * 1.7); g.addColorStop(0, c.col); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = c.vip ? '#ffd23a' : c.col; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cx - r * 0.95, cy + r * 0.5, r * 1.9, r * 1.1, r * 0.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#ffe0bc'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.stroke();
    const mood = k > 0.6 ? '\u{1F600}' : k > 0.35 ? '\u{1F610}' : '\u{1F620}'; ctx.globalAlpha *= 1; Food.emoji(ctx, mood, cx, cy + 1, r * 1.55, { shadow: false });
    if (c.hat) Food.emoji(ctx, c.hat, cx, cy - r * 0.95, r * 1.1, { shadow: false }); if (c.vip) Food.emoji(ctx, '\u{1F451}', cx, cy - r * 1.15, r * 0.9, { shadow: false });
    /* patience */
    Food.meter(ctx, cx - r * 1.1, cy + r * 1.75, r * 2.2, 8 * u, k, k > 0.5 ? '#7dea8a' : k > 0.25 ? '#ffd23a' : '#ff5a4a');
    /* order bubble */
    const n = c.order.length, bw = Math.min(w - 4, 24 * u + n * 34 * u), bh = 46 * u, by = cy - r - 54 * u;
    Food.bubble(ctx, cx, by, bw, bh, 'r');
    const tc = counts(tray); c.order.forEach((it, i) => { const ix = cx - ((n - 1) * 32 * u) / 2 + i * 32 * u; const have = tc[it] > 0; if (have) tc[it]--; Food.emoji(ctx, it, ix, by, 28 * u, { shadow: false, alpha: have ? 0.35 : 1 }); if (have) { ctx.fillStyle = '#2fae4c'; ctx.font = '700 ' + Math.round(20 * u) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', ix, by); } });
    ctx.restore();
  }
  function render() {
    const T = cfg; const sx = shake > 0 ? Math.sin(t * 90) * shake * 12 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, trayY); g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    /* wall menu board */
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.roundRect(W / 2 - 110 * u, 70 * u, 220 * u, 40 * u, 10); ctx.fill(); Food.text(ctx, T.name.toUpperCase(), W / 2, 90 * u, 22 * u, '#ffe066');
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * W / 5, 120 * u); ctx.lineTo(i * W / 5, trayY - 60 * u); ctx.stroke(); }
    custs.forEach(drawCust);
    /* counter */
    const cy = trayY - 52 * u; const cg = ctx.createLinearGradient(0, cy, 0, cy + 40 * u); cg.addColorStop(0, '#ffcf8a'); cg.addColorStop(1, '#a8682a'); ctx.fillStyle = cg; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-4, cy, W + 8, 40 * u, 8); ctx.fill(); ctx.stroke();
    Food.floor(ctx, W, H, cy + 40 * u, T.fl[0], T.fl[1], 40 * u);
    /* tray strip */
    ctx.fillStyle = 'rgba(30,10,6,.92)'; ctx.fillRect(0, trayY - 8 * u, W, H - trayY + 8 * u); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, trayY - 8 * u); ctx.lineTo(W, trayY - 8 * u); ctx.stroke();
    Heroes.draw(ctx, 'hammy', 36 * u, trayY + 44 * u, 0.5 * u, { t, look: Math.sin(t * 0.8) });
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.strokeStyle = 'rgba(255,207,74,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(70 * u, trayY, W - 70 * u - 12, 48 * u, 14); ctx.fill(); ctx.stroke();
    if (!tray.length) Food.text(ctx, 'Tap items to build the order', 70 * u + (W - 70 * u - 12) / 2, trayY + 24 * u, 14 * u + 1, 'rgba(255,240,208,.7)', { stroke: false });
    tray.forEach((it, i) => Food.emoji(ctx, it, 96 * u + i * 40 * u, trayY + 24 * u, 32 * u, { shadow: false }));
    menuBtns.forEach(b => { const k = b.p, dy = k * 4; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(b.x, b.y + 5, b.w, b.h, 16); ctx.fill(); const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); bg.addColorStop(0, k > 0 ? '#fff0b0' : '#fff6e0'); bg.addColorStop(1, k > 0 ? '#ffd86a' : '#ffe0a0'); ctx.fillStyle = bg; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(b.x, b.y + dy, b.w, b.h, 16); ctx.fill(); ctx.stroke(); Food.emoji(ctx, b.k, b.x + b.w / 2, b.y + b.h / 2 + dy, Math.min(b.h * 0.7, b.w * 0.6), { shadow: false }); });
    /* trash */
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(W - 40 * u, trayY - 24 * u, 0, 0, TAU); ctx.fill();
    parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); Food.text(ctx, q.txt, q.x, q.y, 22 * u + 2, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(k, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,40,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (mode === 'play' && stage === 1 && served === 0 && !custs.some(c => c.state === 'wait')) { } else if (mode === 'play' && stage === 1 && served < 2) Food.text(ctx, 'Match the order in the bubble!', W / 2, 140 * u, 16 * u + 1, '#fff');
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150);
    F.over(nb ? 'New best!' : 'Shift over!', [['Score', score.toLocaleString(), nb], ['Customers served', servedTotal], ['Best combo', 'x' + bestCombo], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]);
  }
  const F = Food.flow({ hero: 'hammy', onStart() { stage = 1; score = 0; strikes = 0; servedTotal = 0; combo = 0; bestCombo = 0; parts = []; cfg = null; newStage(); } });
  $('game').addEventListener('pointerdown', e => {
    if (F.mode !== 'play') return; Kit.ac(); const x = e.clientX, y = e.clientY;
    for (let i = 0; i < menuBtns.length; i++) { const b = menuBtns[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { tap(i); return; } }
    if (y >= trayY && y <= trayY + 48 * u && x > 70 * u && tray.length) { tray = []; Kit.tone(300, 0.06, 'sine', 0.1); }
  });
  Kit.loop((dt, tt) => { t = tt; mode = F.mode; S.watch(dt); if (mode !== 'pause') update(dt); if (cfg) render(); else { ctx.fillStyle = '#2a0e0a'; ctx.fillRect(0, 0, W, H); } });
  window.__o = { get s() { return { mode: F.mode, stage, score, strikes, served, goal: cfg && cfg.goal, state, tray: tray.slice(), menu: cfg && cfg.menu, custs: custs.map(c => ({ id: c.id, order: c.order, st: c.state, pat: c.pat })) }; }, tap, get btns() { return menuBtns; } };
})();
