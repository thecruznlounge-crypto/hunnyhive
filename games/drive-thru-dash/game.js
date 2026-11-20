/* Drive Thru Dash - swipe between lanes, grab the items on your ticket, dodge traffic, reach the window. */
(function () {
  'use strict';
  Kit.ns('drive-thru-dash');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const STAGES = [
    { name: 'Main Street', menu: ['burger', 'fries', 'soda'], need: [2, 3], speed: 300, obs: 0.9, goal: 3, road: '#3a3d48', side: '#4a9a4a', sky: '#8ad0ff' },
    { name: 'Downtown', menu: ['burger', 'fries', 'soda', 'pizza'], need: [3, 3], speed: 340, obs: 1.1, goal: 4, road: '#2f323c', side: '#8a8f9c', sky: '#ffb870' },
    { name: 'Rainy Highway', menu: ['burger', 'fries', 'soda', 'taco', 'hotdog'], need: [3, 4], speed: 380, obs: 1.3, goal: 4, road: '#262a34', side: '#3a6a5a', sky: '#7a8aa8', rain: 1 },
    { name: 'Desert Road', menu: ['burger', 'fries', 'soda', 'nuggets', 'donut'], need: [4, 4], speed: 420, obs: 1.5, goal: 5, road: '#4a4038', side: '#d8a860', sky: '#ffd890' },
    { name: 'Night Rush', menu: ['burger', 'fries', 'soda', 'pizza', 'taco', 'donut'], need: [4, 5], speed: 470, obs: 1.8, goal: 6, road: '#1c1e28', side: '#1a3a3a', sky: '#1c2050', night: 1 }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { speed: b.speed + x * 25, obs: b.obs + x * 0.15, goal: b.goal + Math.min(x, 3), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, laneW, roadL, carY;
  let stage = 1, score = 0, lives = 3, deliveredTotal = 0, delivered = 0, combo = 0, bestCombo = 0, t = 0, cfg, ticket = [], got = [], objs = [], parts = [], scroll = 0, lane = 1, laneX = 1, spawnT = 0, dist = 0, hurt = 0, state = 'play', stateT = 0, windowOn = false, flash = 0, shake = 0, speedK = 1, slip = 0, rain = [];
  const best = () => Kit.get('best', 0);
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 760); laneW = Math.min(100 * u, W / 3.4); roadL = W / 2 - laneW * 1.5; carY = H - 150 * u; }
  S.onresize = layout; layout();
  const lx = l => roadL + laneW * (l + 0.5);
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + delivered + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '❤'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives)); }
  function say(txt, x, y, col) { parts.push({ txt, x, y, age: 0, life: 1.0, col }); }
  function newTicket() { const n = rint(cfg.need[0], cfg.need[1]); ticket = []; for (let i = 0; i < n; i++) ticket.push(pick(cfg.menu)); got = []; windowOn = false; objs = objs.filter(o => o.type !== 'win'); }
  function newStage() { cfg = stg(); delivered = 0; objs = []; newTicket(); spawnT = 0.6; speedK = 1; Kit.banner('Stage ' + stage, cfg.name); syncHud(); }
  function need() { const c = ticket.slice(); got.forEach(g => { const i = c.indexOf(g); if (i >= 0) c.splice(i, 1); }); return c; }
  function spawnRow() {
    const nd = need(), lanes = [0, 1, 2].sort(() => Math.random() - 0.5); const y = -60 * u;
    if (!nd.length) { if (!windowOn) { windowOn = true; objs.push({ type: 'win', lane: rint(0, 2), y, w: 1 }); } return; }
    let used = 0;
    if (Math.random() < 0.85) { const k = Math.random() < 0.65 ? pick(nd) : pick(cfg.menu); objs.push({ type: 'item', k, lane: lanes[used++], y }); }
    const nob = Math.random() < 0.55 * cfg.obs / 1.4 ? 1 + (Math.random() < (cfg.obs - 1) * 0.3 ? 1 : 0) : 0;
    for (let i = 0; i < nob && used < 3; i++) { const kind = pick(['cone', 'cone', 'car', 'truck', 'puddle']); objs.push({ type: 'obs', k: kind, lane: lanes[used++], y, slow: Math.random() * 0.4 }); }
  }
  function hit(o) {
    if (o.type === 'item') {
      o.dead = 1; const nd = need();
      if (nd.includes(o.k)) { got.push(o.k); combo++; bestCombo = Math.max(bestCombo, combo); const p = Math.round(50 * (1 + Math.min(6, combo - 1) * 0.25)); score += p; say('+' + p, lx(o.lane), carY - 50 * u, '#ffe066'); Kit.tone(520 + got.length * 80, 0.09, 'triangle', 0.18); for (let i = 0; i < 8; i++) parts.push({ x: lx(o.lane), y: carY, vx: rnd(-120, 120), vy: rnd(-200, -40), age: 0, life: 0.6, c: '#ffe066' }); }
      else { combo = 0; score = Math.max(0, score - 20); say('Not on ticket', lx(o.lane), carY - 50 * u, '#ff9a8a'); Kit.tone(220, 0.15, 'square', 0.1, -60); }
      syncHud();
    } else if (o.type === 'win') {
      o.dead = 1; const b = 200 + ticket.length * 50 + Math.round(combo * 10); score += b; delivered++; deliveredTotal++; say('Order up! +' + b, W / 2, carY - 80 * u, '#8aee9a'); Kit.tone(660, 0.12, 'triangle', 0.2); Kit.tone(990, 0.22, 'triangle', 0.18, 0, Kit.ac().currentTime + 0.12);
      if (delivered >= cfg.goal) { state = 'clear'; stateT = 0; const bb = 400 + lives * 150; score += bb; say('Stage clear! +' + bb, W / 2, H * 0.35, '#fff'); } else newTicket(); syncHud();
    } else if (o.type === 'obs') {
      if (o.k === 'puddle') { if (!o.dead) { o.dead = 1; slip = 1.0; say('Splash!', lx(o.lane), carY - 40 * u, '#9ad0ff'); Kit.noise(0.3, 0.15); } return; }
      if (hurt > 0) return; o.dead = 1; lives--; hurt = 1.4; combo = 0; shake = 0.4; flash = 0.4; Kit.tone(120, 0.4, 'sawtooth', 0.2, -60); Kit.noise(0.3, 0.25); Kit.vibe(60);
      ticket.length && got.length && got.pop(); say('Crash!', lx(o.lane), carY - 50 * u, '#ff8a7a'); syncHud();
      if (lives <= 0) { state = 'lost'; stateT = 0; }
    }
  }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 400 * dt; } else q.y -= 40 * dt; }); parts = parts.filter(q => q.age < q.life);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); hurt = Math.max(0, hurt - dt); slip = Math.max(0, slip - dt);
    if (F.mode !== 'play') return; stateT += dt;
    laneX += (lane - laneX) * Math.min(1, dt * (slip > 0 ? 5 : 14));
    if (state === 'play' || state === 'clear') {
      speedK = Math.min(1.25, speedK + dt * 0.01); const v = cfg.speed * u * speedK * (state === 'clear' ? 0.5 : 1);
      scroll = (scroll + v * dt) % (80 * u); dist += v * dt;
      objs.forEach(o => { o.y += v * dt * (o.type === 'obs' && o.k !== 'puddle' && o.k !== 'cone' ? 0.7 : 1); const dl = Math.abs(lx(o.lane) - lx(laneX)); if (!o.dead && Math.abs(o.y - carY) < (o.type === 'win' ? 40 : 34) * u && dl < laneW * 0.42) hit(o); });
      objs.forEach(o => { if (o.type === 'win' && !o.dead && o.y >= H + 80 * u) { windowOn = false; say('Missed it!', W / 2, H * 0.5, '#ff9a8a'); } }); objs = objs.filter(o => o.y < H + 80 * u && !(o.dead && o.dead++ > 3));
      if (state === 'play') { spawnT -= dt; if (spawnT <= 0) { spawnRow(); spawnT = (260 * u) / v * rnd(0.85, 1.25); } }
      else if (stateT > 1.8) { stage++; newStage(); state = 'play'; stateT = 0; }
    } else if (state === 'lost' && stateT > 0.8) gameOver();
  }
  function drawCar(x, y, col, s, kind) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 6, 34, 56, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-26, -50, 52, kind === 'truck' ? 120 : 98, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(180,230,255,.85)'; ctx.beginPath(); ctx.roundRect(-20, -34, 40, 22, 6); ctx.fill(); ctx.beginPath(); ctx.roundRect(-20, 16, 40, 16, 6); ctx.fill();
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-22, -48, 8, 5); ctx.fillRect(14, -48, 8, 5); ctx.restore();
  }
  function render() {
    const c = cfg, sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    ctx.fillStyle = c.side; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c.road; ctx.fillRect(roadL - 8, 0, laneW * 3 + 16, H);
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(roadL - 8, 0, 5, H); ctx.fillRect(roadL + laneW * 3 + 3, 0, 5, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let l = 1; l < 3; l++) for (let y = -80 * u + scroll; y < H; y += 80 * u) ctx.fillRect(roadL + laneW * l - 2, y, 4, 40 * u);
    /* roadside decor */
    for (let y = -80 * u + scroll; y < H; y += 160 * u) { const k = Math.floor((y - scroll) / (160 * u)); ctx.font = (34 * u) + 'px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(c.night ? '\u{1F4A1}' : c.side === '#d8a860' ? '\u{1F335}' : '\u{1F333}', (k % 2 ? roadL * 0.5 : W - roadL * 0.5), y); }
    objs.forEach(o => {
      if (o.dead) return; const x = lx(o.lane);
      if (o.type === 'item') { ctx.fillStyle = 'rgba(255,246,224,.95)'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, o.y, 32 * u, 0, TAU); ctx.fill(); ctx.stroke(); Food.emoji(ctx, o.k, x, o.y, 44 * u, { shadow: false }); if (need().includes(o.k)) { ctx.strokeStyle = 'rgba(255,224,102,' + (0.5 + 0.4 * Math.sin(t * 9)) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, o.y, 38 * u, 0, TAU); ctx.stroke(); } }
      else if (o.type === 'win') { ctx.fillStyle = '#e8453a'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x - laneW * 0.48, o.y - 40 * u, laneW * 0.96, 80 * u, 12); ctx.fill(); ctx.stroke(); Food.emoji(ctx, 'shop', x, o.y - 6 * u, 46 * u, { shadow: false }); Food.text(ctx, 'PICKUP', x, o.y + 28 * u, 14 * u, '#fff'); ctx.strokeStyle = 'rgba(255,224,102,' + (0.5 + 0.4 * Math.sin(t * 9)) + ')'; ctx.lineWidth = 5; ctx.strokeRect(x - laneW * 0.5, o.y - 44 * u, laneW, 88 * u); }
      else if (o.k === 'cone') Food.emoji(ctx, 'cone', x, o.y, 46 * u, { shadow: true });
      else if (o.k === 'puddle') { ctx.fillStyle = 'rgba(90,150,220,.7)'; ctx.beginPath(); ctx.ellipse(x, o.y, 40 * u, 24 * u, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
      else drawCar(x, o.y, o.k === 'truck' ? '#d8a02a' : pick2(o.lane), 0.85 * u, o.k);
    });
    /* player car */
    if (!(hurt > 0 && Math.floor(t * 14) % 2)) { const px = lx(laneX), lean = (lane - laneX) * 0.2; ctx.save(); ctx.translate(px, carY); ctx.rotate(lean + (slip > 0 ? Math.sin(t * 18) * 0.15 : 0)); ctx.translate(-px, -carY); drawCar(px, carY, '#e8453a', 0.95 * u); Heroes.draw(ctx, 'rocket', px, carY - 8 * u, 0.28 * u, { t, look: (lane - laneX) }); ctx.restore(); }
    if (c.rain) { ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 80) % W, y = (i * 53 + t * 900) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 18); ctx.stroke(); } }
    if (c.night) { ctx.fillStyle = 'rgba(8,10,40,.45)'; ctx.fillRect(0, 0, W, H); const gl = ctx.createRadialGradient(lx(laneX), carY - 100 * u, 10, lx(laneX), carY - 100 * u, 260 * u); gl.addColorStop(0, 'rgba(255,240,180,.35)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    /* ticket */
    const tw = 44 * u * ticket.length + 20, tx = W / 2 - tw / 2, ty = 66 * u; ctx.fillStyle = '#fffdf0'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 58 * u, 10); ctx.fill(); ctx.stroke();
    const gc = got.slice(); ticket.forEach((k, i) => { const j = gc.indexOf(k), ok = j >= 0; if (ok) gc.splice(j, 1); ctx.globalAlpha = ok ? 0.35 : 1; Food.emoji(ctx, k, tx + 32 * u + i * 44 * u - 10 * u + 10, ty + 29 * u, 34 * u, { shadow: false }); ctx.globalAlpha = 1; if (ok) Food.emoji(ctx, 'check', tx + 32 * u + i * 44 * u, ty + 29 * u, 24 * u, { shadow: false }); });
    if (windowOn) Food.text(ctx, 'Head to the pickup window!', W / 2, ty + 78 * u, 14 * u + 1, '#fff');
    parts.forEach(q => { const kk = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, kk * 2); Food.text(ctx, q.txt, q.x, q.y, 20 * u + 2, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(kk, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,40,' + flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
    if (stage === 1 && delivered === 0 && dist < 2200 * u) Food.text(ctx, 'Swipe or tap left / right to change lanes', W / 2, H - 50 * u, 15 * u, '#fff');
  }
  const CARCOL = ['#3a7ad8', '#8a4ad8', '#2aa86a', '#d8d8e0']; function pick2(l) { return CARCOL[(l + Math.floor(t / 3)) % CARCOL.length]; }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); F.over(nb ? 'New best!' : 'Out of gas!', [['Score', score.toLocaleString(), nb], ['Orders delivered', deliveredTotal], ['Best combo', 'x' + bestCombo], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'rocket', onStart() { stage = 1; score = 0; lives = 3; deliveredTotal = 0; combo = 0; bestCombo = 0; parts = []; lane = 1; laneX = 1; dist = 0; hurt = 0; slip = 0; state = 'play'; stateT = 0; cfg = stg(); newStage(); } });
  let sx0 = null, sy0 = 0;
  const cv = $('game'); cv.addEventListener('pointerdown', e => { Kit.ac(); sx0 = e.clientX; sy0 = e.clientY; });
  cv.addEventListener('pointerup', e => { if (sx0 == null || F.mode !== 'play') { sx0 = null; return; } const dx = e.clientX - sx0; if (Math.abs(dx) > 30) lane = clamp(lane + (dx > 0 ? 1 : -1), 0, 2); else lane = clamp(lane + (e.clientX > W / 2 ? 1 : -1), 0, 2); sx0 = null; });
  window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') lane = clamp(lane - 1, 0, 2); if (e.key === 'ArrowRight') lane = clamp(lane + 1, 0, 2); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); if (cfg) render(); else { ctx.fillStyle = '#2a0e0a'; ctx.fillRect(0, 0, W, H); } });
  window.__d = { get s() { return { mode: F.mode, stage, score, lives, delivered, goal: cfg && cfg.goal, lane, ticket, got, objs: objs.filter(o => !o.dead).map(o => ({ type: o.type, k: o.k, lane: o.lane, y: o.y })), carY }; }, setLane(l) { lane = l; } };
})();
