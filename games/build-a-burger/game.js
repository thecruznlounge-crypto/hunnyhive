/* Build a Burger - tap the right ingredient as it rides the belt to stack the order in sequence. */
(function () {
  'use strict';
  Kit.ns('build-a-burger');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const NAMES = { bunB: 'Bottom bun', bunT: 'Top bun', patty: 'Patty', cheese: 'Cheese', lettuce: 'Lettuce', tomato: 'Tomato', onion: 'Onion', pickle: 'Pickles', bacon: 'Bacon', egg: 'Egg', sauce: 'Sauce' };
  const STAGES = [
    { name: 'Burger Barn', pool: ['patty', 'cheese'], len: [3, 4], belts: 1, speed: 90, time: 16, goal: 4, bg: ['#8a2a1c', '#4a120a'] },
    { name: 'Salad Bar', pool: ['patty', 'cheese', 'lettuce', 'tomato'], len: [4, 6], belts: 1, speed: 105, time: 17, goal: 5, bg: ['#2a6a3a', '#123a1c'] },
    { name: 'Double Decker', pool: ['patty', 'cheese', 'lettuce', 'tomato', 'onion'], len: [5, 7], belts: 2, speed: 110, time: 18, goal: 5, bg: ['#c8741c', '#6a3808'] },
    { name: 'Bacon Brunch', pool: ['patty', 'cheese', 'bacon', 'egg', 'tomato', 'pickle'], len: [6, 8], belts: 2, speed: 125, time: 19, goal: 6, bg: ['#a82a2a', '#561010'] },
    { name: 'Mega Stack', pool: ['patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon', 'egg', 'sauce'], len: [7, 10], belts: 2, speed: 140, time: 21, goal: 6, bg: ['#2a3a8a', '#10184a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)]; const x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { speed: b.speed + x * 8, time: Math.max(11, b.time - x), goal: b.goal + Math.min(x, 4), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, plateX, plateY, belts;
  let mode = 'title', stage = 1, score = 0, strikes = 0, made = 0, madeTotal = 0, combo = 0, bestCombo = 0, t = 0, cfg, order = [], step = 0, stack = [], items = [], parts = [], flying = [], timeLeft = 0, tmax = 1, spawnT = 0, state = 'play', stateT = 0, flash = 0, shake = 0, nextNeed = 0, serveAnim = 0;
  const best = () => Kit.get('best', 0);
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 760); plateX = W * 0.34; plateY = H - 330 * u; const n = cfg ? cfg.belts : 1; belts = []; for (let i = 0; i < n; i++) belts.push({ y: H - (96 + i * 92) * u, dir: i % 2 ? 1 : -1 }); }
  S.onresize = layout; layout();
  function makeOrder() { const n = rint(cfg.len[0], cfg.len[1]); const o = ['bunB']; for (let i = 0; i < n - 2; i++) o.push(i === 0 && Math.random() < 0.8 ? 'patty' : pick(cfg.pool)); o.push('bunT'); return o; }
  function stackH(list, w) { let h = 0; list.forEach(k => h += Food.SH[k] * w * (k === 'bunT' ? 0.7 : k === 'cheese' ? 0.6 : 1) * 0.84); return h; }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + made + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function say(txt, x, y, col) { parts.push({ txt, x, y, age: 0, life: 1.1, col }); }
  function newBurger() { order = makeOrder(); step = 0; stack = []; flying = []; tmax = timeLeft = cfg.time + order.length * 1.2; state = 'play'; stateT = 0; syncHud(); }
  function newStage() { cfg = stg(); layout(); items = []; made = 0; Kit.banner('Stage ' + stage, cfg.name); newBurger(); spawnT = 0; }
  function spawnItem(bi) {
    const need = order[step]; const k = Math.random() < 0.6 ? need : pick(cfg.pool.concat(['bunB', 'bunT']).filter(x => true));
    const b = belts[bi]; items.push({ k, x: b.dir < 0 ? W + 50 * u : -50 * u, b: bi, y: b.y, bob: Math.random() * 6, gold: Math.random() < 0.05, dead: 0 });
  }
  function tapAt(x, y) {
    if (F.mode !== 'play' || state !== 'play') return; Kit.ac();
    let hit = null, bd = 48 * u; items.forEach(it => { if (it.dead) return; const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; hit = it; } }); if (!hit) return;
    const need = order[step];
    if (hit.k === need) {
      hit.dead = 1; const w = 128 * u, sh = stackH(stack, w); flying.push({ k: hit.k, x: hit.x, y: hit.y, tx: plateX, ty: plateY - sh - 6 * u, t: 0 }); stack.push(hit.k); step++; combo++; bestCombo = Math.max(bestCombo, combo);
      const pts = Math.round(10 * (1 + Math.min(8, combo - 1) * 0.2)); score += pts; if (hit.gold) { timeLeft = Math.min(tmax, timeLeft + 4); say('+4s', hit.x, hit.y - 30, '#ffe066'); }
      Kit.tone(420 + step * 60, 0.07, 'triangle', 0.16); if (step >= order.length) finishBurger();
    } else { hit.dead = 2; combo = 0; shake = 0.3; flash = 0.2; timeLeft -= 2.5; say('Wrong! -2.5s', hit.x, hit.y - 30, '#ff8a7a'); Kit.tone(150, 0.25, 'sawtooth', 0.14, -60); Kit.vibe(25); }
  }
  function finishBurger() {
    const k = clamp(timeLeft / tmax, 0, 1), pts = Math.round(order.length * 40 + 200 * k); score += pts; made++; madeTotal++; state = 'serve'; stateT = 0; say('+' + pts, plateX, plateY - 200 * u, '#ffe066'); if (combo >= 6) say('Perfect run!', plateX, plateY - 230 * u, '#8aee9a');
    for (let i = 0; i < 16; i++) parts.push({ x: plateX, y: plateY - 80 * u, vx: rnd(-160, 160), vy: rnd(-260, -60), age: 0, life: 0.9, c: pick(['#ffe066', '#ff8a7a', '#8aee9a']) });
    Kit.tone(660, 0.1, 'triangle', 0.2); Kit.tone(990, 0.2, 'triangle', 0.18, 0, Kit.ac().currentTime + 0.1); syncHud();
  }
  function fail() { strikes++; combo = 0; flash = 0.5; state = 'burn'; stateT = 0; say('Burger burnt!', plateX, plateY - 200 * u, '#ff8a7a'); Kit.tone(160, 0.5, 'sawtooth', 0.18, -90); Kit.vibe(70); syncHud(); }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; } else q.y -= 30 * dt; }); parts = parts.filter(q => q.age < q.life);
    flying.forEach(f => { f.t = Math.min(1, f.t + dt * 5); }); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2);
    if (F.mode !== 'play') return; stateT += dt;
    items.forEach(it => { const b = belts[it.b]; it.x += b.dir * cfg.speed * u * dt * (1 + stage * 0.01); it.bob += dt * 4; if (it.dead) it.dying = (it.dying || 0) + dt; });
    items = items.filter(it => it.x > -80 * u && it.x < W + 80 * u && !(it.dead && it.dying > 0.4));
    if (state === 'play') {
      timeLeft -= dt; if (timeLeft <= 0) { fail(); if (strikes >= 3) { state = 'lost'; stateT = 0; } }
      spawnT -= dt; const gap = 104 * u / (cfg.speed * u); if (spawnT <= 0) { for (let i = 0; i < belts.length; i++) if (!items.some(it => it.b === i && ((belts[i].dir < 0 && it.x > W - 20 * u) || (belts[i].dir > 0 && it.x < 20 * u)))) if (Math.random() < 0.9) spawnItem(i); spawnT = gap * rnd(0.95, 1.2); }
    } else if (state === 'serve') { if (stateT > 1.0) { if (made >= cfg.goal) { state = 'clear'; stateT = 0; const b = 300 + (3 - strikes) * 100; score += b; say('Stage clear! +' + b, W / 2, H * 0.35, '#fff'); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.22, 'triangle', 0.22, 0, Kit.ac().currentTime + 0.12); } else newBurger(); } }
    else if (state === 'burn') { if (stateT > 1.0) { if (strikes >= 3) { state = 'lost'; stateT = 0; } else newBurger(); } }
    else if (state === 'lost') { if (stateT > 0.6) gameOver(); }
    else if (state === 'clear') { if (stateT > 1.8) { stage++; newStage(); } }
  }
  function drawStack(w, alpha) {
    let y = plateY; const sc = Math.min(1, (plateY - 150 * u) / Math.max(1, stackH(stack, w) + 40)), ww = w * sc; y = plateY;
    /* plate */
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(plateX, plateY + 8 * u, 96 * u, 16 * u, 0, 0, TAU); ctx.fill();
    const pg = ctx.createLinearGradient(0, plateY - 4, 0, plateY + 14 * u); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#c8d0e0'); ctx.fillStyle = pg; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(plateX, plateY + 4 * u, 92 * u, 15 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
    stack.forEach((k, i) => { if (flying.some(f => f.k === k && f.t < 1 && i === stack.length - 1)) return; const hh = Food.slice(ctx, k, plateX + Math.sin(i * 2.1) * 2 * u, y - Food.SH[k] * ww * 0.42, ww); y -= hh * 0.84; });
    return { y, sc };
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * W / 7, 0); ctx.lineTo(i * W / 7, H); ctx.stroke(); }
    /* timer */
    const k = clamp(timeLeft / tmax, 0, 1); Food.meter(ctx, 14, 62 * u + 6, W - 28, 12 * u, k, k > 0.5 ? '#7dea8a' : k > 0.25 ? '#ffd23a' : '#ff5a4a');
    /* ticket */
    const tx = W * 0.6, tw = W - tx - 10, th = 40 * u + order.length * 26 * u; ctx.save(); ctx.translate(tx + tw / 2, 108 * u + th / 2); ctx.rotate(0.03); ctx.fillStyle = '#fffdf0'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 8); ctx.fill(); ctx.stroke();
    Food.text(ctx, 'ORDER', 0, -th / 2 + 18 * u, 16 * u, '#e8453a', { stroke: false });
    for (let i = 0; i < order.length; i++) { const idx = order.length - 1 - i, yy = -th / 2 + 44 * u + i * 26 * u; const done = idx < step, cur = idx === step; if (cur) { ctx.fillStyle = 'rgba(255,207,74,.45)'; ctx.fillRect(-tw / 2 + 6, yy - 12 * u, tw - 12, 24 * u); } ctx.globalAlpha = done ? 0.4 : 1; Food.slice(ctx, order[idx], -tw / 2 + 36 * u, yy, 44 * u); Food.text(ctx, NAMES[order[idx]], -tw / 2 + 66 * u, yy, 12 * u + 1, '#3a1608', { align: 'left', stroke: false }); ctx.globalAlpha = 1; if (done) Food.text(ctx, '✓', tw / 2 - 16, yy, 16 * u, '#2fae4c', { stroke: false }); }
    ctx.restore();
    /* assembly */
    const sc0 = 1; drawStack(128 * u, 1);
    flying.forEach(f => { const e = 1 - Math.pow(1 - f.t, 3), x = f.x + (f.tx - f.x) * e, y = f.y + (f.ty - f.y) * e - Math.sin(e * Math.PI) * 60 * u; if (f.t < 1) Food.slice(ctx, f.k, x, y, 128 * u * (1 - e * 0.0)); });
    flying = flying.filter(f => f.t < 1 || (f.t = 1, false));
    if (state === 'serve') { Food.text(ctx, 'Order up!', plateX, plateY - 150 * u - stateT * 20, 30 * u, '#ffe066'); }
    /* mascot */
    Heroes.draw(ctx, 'patty', W * 0.84, H - 290 * u, 0.68 * u, { t, look: Math.sin(t) });
    /* belts */
    belts.forEach((b, i) => {
      const bh = 70 * u; ctx.fillStyle = '#2a2e3a'; ctx.strokeStyle = '#12141c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-4, b.y - bh / 2, W + 8, bh, 10); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; const off = ((t * cfg.speed * u * b.dir) % (28 * u) + 28 * u) % (28 * u); for (let x = -28 * u + off; x < W + 28 * u; x += 28 * u) { ctx.beginPath(); ctx.moveTo(x, b.y - bh / 2 + 4); ctx.lineTo(x + 10 * u, b.y + bh / 2 - 4); ctx.stroke(); }
      ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(14 * u, b.y - bh / 2 - 4 * u, 0, 0, TAU); ctx.fill();
    });
    items.forEach(it => {
      const a = it.dead ? clamp(1 - (it.dying || 0) / 0.4, 0, 1) : 1; if (it.dead === 1) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(it.x, it.y + Math.sin(it.bob) * 2); if (it.dead === 2) { ctx.rotate((it.dying || 0) * 8); ctx.scale(1 - (it.dying || 0), 1 - (it.dying || 0)); }
      ctx.fillStyle = it.gold ? 'rgba(255,224,102,.95)' : 'rgba(255,246,224,.95)'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-46 * u, -28 * u, 92 * u, 56 * u, 14); ctx.fill(); ctx.stroke();
      Food.slice(ctx, it.k, 0, it.k === 'bunT' ? 8 * u : 0, 70 * u); if (it.gold) Food.emoji(ctx, 'star', 30 * u, -20 * u, 20 * u, { shadow: false });
      ctx.restore();
    });
    if (order[step] && state === 'play') { /* hint pulse on next needed */ items.forEach(it => { if (!it.dead && it.k === order[step]) { ctx.strokeStyle = 'rgba(255,224,102,' + (0.35 + 0.25 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(it.x - 49 * u, it.y - 31 * u, 98 * u, 62 * u, 16); ctx.stroke(); } }); }
    parts.forEach(q => { const kk = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, kk * 2); Food.text(ctx, q.txt, q.x, q.y, 22 * u + 2, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(kk, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,40,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (F.mode === 'play' && stage === 1 && made < 1 && state === 'play') Food.text(ctx, 'Tap the glowing ingredient: ' + NAMES[order[step]], W / 2, 150 * u + 150 * u, 16 * u + 1, '#fff');
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); F.over(nb ? 'New best!' : 'Kitchen closed!', [['Score', score.toLocaleString(), nb], ['Burgers served', madeTotal], ['Best combo', 'x' + bestCombo], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'patty', onStart() { stage = 1; score = 0; strikes = 0; madeTotal = 0; combo = 0; bestCombo = 0; parts = []; cfg = null; cfg = stg(); newStage(); } });
  $('game').addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY));
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); if (cfg) render(); else { ctx.fillStyle = '#2a0e0a'; ctx.fillRect(0, 0, W, H); } });
  window.__b = { get s() { return { mode: F.mode, stage, score, strikes, made, goal: cfg && cfg.goal, state, step, need: order[step], order, items: items.filter(i => !i.dead).map(i => ({ k: i.k, x: i.x, y: i.y })) }; }, tapAt };
})();
