/* Style Era - sort falling fashion pieces into the decade they belong to. */
(function () {
  'use strict';
  Kit.ns('style-era');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const P = '#ff4fa3', Y = '#ffd23a', B = '#4a8ae8', V = '#7a5ae8', K = '#2a2a3a', Wt = '#f4f4f8', R = '#e8453a', T = '#2ac8b8', G = '#3ab85a';
  const ERA = {
    '60s': { c: '#ff9a3a', items: [['Mod Mini Skirt', 'bottom', 'skirt', Y], ['Go-Go Boots', 'shoes', 'boots', Wt], ['Shift Top', 'top', 'tank', P], ['Pillbox Hat', 'hat', 'cap', T], ['Flower-Power Blouse', 'top', 'blouse', Y]] },
    '70s': { c: '#c8742c', items: [['Bell Bottoms', 'bottom', 'jeans', B], ['Platform Sandals', 'shoes', 'sandals', V], ['Disco Blouse', 'top', 'blouse', Y], ['Floppy Sun Hat', 'hat', 'sun', R], ['Fringe Jacket', 'top', 'jacket', '#c8742c']] },
    '80s': { c: '#ff4fa3', items: [['Neon Crop Top', 'top', 'crop', P], ['Shoulder-Pad Blazer', 'top', 'jacket', V], ['High-Top Sneakers', 'shoes', 'sneakers', R], ['Jelly Sandals', 'shoes', 'sandals', T], ['Parachute Shorts', 'bottom', 'shorts', Y]] },
    '90s': { c: '#4a8ae8', items: [['Flannel Shirt', 'top', 'blouse', R], ['Baggy Jeans', 'bottom', 'jeans', B], ['Chunky Boots', 'shoes', 'boots', K], ['Bucket Hat', 'hat', 'beanie', G], ['Slip Tank', 'top', 'tank', K]] },
    '00s': { c: '#2ac8b8', items: [['Low-Rise Jeans', 'bottom', 'jeans', B], ['Trucker Cap', 'hat', 'cap', Wt], ['Velour Hoodie', 'top', 'jacket', P], ['Baguette Bag', 'bag', 'clutch', V], ['Mini Skirt', 'bottom', 'skirt', Wt]] }
  };
  const STAGES = [
    { name: 'Two Decades', eras: ['60s', '90s'], speed: 105, gap: 2.4, goal: 8, bg: ['#ffd0e0', '#8a3a9a'] },
    { name: 'Close Calls', eras: ['70s', '80s'], speed: 120, gap: 2.1, goal: 10, bg: ['#ffe0a0', '#c85a3a'] },
    { name: 'Three-Way', eras: ['60s', '80s', '00s'], speed: 125, gap: 2.0, goal: 12, bg: ['#c8b8ff', '#3a2a8a'] },
    { name: 'Throwback Rush', eras: ['70s', '90s', '00s'], speed: 145, gap: 1.7, goal: 14, bg: ['#7ad8d0', '#1a4a7a'] },
    { name: 'Time Warp', eras: ['60s', '80s', '90s'], speed: 165, gap: 1.4, goal: 16, bg: ['#ff6a8a', '#2a0a3a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { speed: b.speed + x * 10, gap: Math.max(1, b.gap - x * .1), goal: b.goal + Math.min(x * 2, 8), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, bins = [], stage = 1, score = 0, lives = 3, streak = 0, bestStreak = 0, sorted = 0, sortedTotal = 0, t = 0, cfg, items = [], spawnT = 1, state = 'play', stateT = 0, shake = 0, flash = 0, hintT = 0, missed = 0, lastBin = -1, binFlash = [];
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); if (!cfg) return; const n = cfg.eras.length, bw = (W - 20 * u - (n - 1) * 8) / n; bins = cfg.eras.map((e, i) => ({ e, x: 10 * u + i * (bw + 8) + bw / 2, y: H - 70 * u, w: bw, h: 100 * u }));
  }
  S.onresize = layout;
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + sorted + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives)); }
  function newStage() { cfg = stg(); sorted = 0; items = []; spawnT = .9; binFlash = cfg.eras.map(() => 0); layout(); state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, cfg.name); syncHud(); }
  function spawn() { const d = Math.floor(Math.random() * cfg.eras.length), era = cfg.eras[d], def = pick(ERA[era].items); items.push({ name: def[0], it: { slot: def[1], shape: def[2], color: def[3] }, d, x: W / 2 + rnd(-40, 40) * u, y: 120 * u, st: 'fall', tt: 0, from: null, rot: rnd(-.1, .1), bx: 0, by: 0 }); }
  function answer(bi) {
    if (F.mode !== 'play' || state !== 'play') return false; const lowest = items.filter(i => i.st === 'fall').sort((a, b) => b.y - a.y)[0]; if (!lowest) return false; Kit.ac();
    const ok = lowest.d === bi; lowest.st = 'fly'; lowest.tt = 0; lowest.from = { x: lowest.x, y: lowest.y }; lowest.ok = ok; lowest.to = bi; const bn = bins[bi];
    if (ok) { streak++; bestStreak = Math.max(bestStreak, streak); const p = Math.round(50 * (1 + Math.min(streak, 10) / 4)); score += p; sorted++; sortedTotal++; FX.say('+' + p + (streak >= 3 ? '  x' + streak : ''), bn.x, bn.y - 80 * u, '#ffe066', 20); FX.burst(bn.x, bn.y - 20 * u, [ERA[bn.e].c, '#fff'], 8); Kit.tone(640 + Math.min(streak, 8) * 50, .09, 'triangle', .18); binFlash[bi] = .4; }
    else { streak = 0; lose(lowest.x, lowest.y, 'That’s ' + cfg.eras[lowest.d] + '!'); }
    syncHud(); if (ok && sorted >= cfg.goal) { state = 'clear'; stateT = 0; const b = 400 + lives * 150; score += b; FX.say('Stage clear! +' + b, W / 2, H * .4, '#fff', 26); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); syncHud(); }
    return true;
  }
  function lose(x, y, msg) { lives--; shake = .3; flash = .3; FX.say(msg, W / 2, y - 30 * u, '#ff8a7a', 22); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); syncHud(); if (lives <= 0) { state = 'lost'; stateT = 0; } }
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); binFlash = binFlash.map(v => Math.max(0, v - dt)); if (F.mode !== 'play') return; stateT += dt; hintT += dt;
    if (state === 'play') {
      spawnT -= dt; if (spawnT <= 0 && items.filter(i => i.st === 'fall').length < 4) { spawn(); spawnT = cfg.gap * rnd(.85, 1.2); } else if (spawnT <= 0) spawnT = .3;
      const floor = H - 150 * u; items.forEach(i => { if (i.st === 'fall') { i.y += cfg.speed * u * dt * (1 + Math.min(sortedTotal, 40) * .004); if (i.y > floor) { i.st = 'gone'; streak = 0; missed++; lose(i.x, floor, 'Too slow!'); } } else if (i.st === 'fly') { i.tt += dt * 4; if (i.tt >= 1) i.st = 'gone'; } });
      items = items.filter(i => i.st !== 'gone');
    } else if (state === 'clear') { if (stateT > 1.8) { stage++; newStage(); } } else if (state === 'lost' && stateT > .8) gameOver();
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 7; i++) ctx.fillRect(0, 100 * u + i * 80 * u + (t * 30) % (80 * u), W, 26 * u);
    Heroes.draw(ctx, 'chrono', 46 * u, 150 * u, .5 * u, { t, look: 0 });
    const lowest = items.filter(i => i.st === 'fall').sort((a, b) => b.y - a.y)[0];
    items.forEach(i => { let x = i.x, y = i.y, s = 1.15 * u, a = 1; if (i.st === 'fly') { const k = i.tt, e = k * k, b = bins[i.to]; x = i.from.x + (b.x - i.from.x) * e; y = i.from.y + (b.y - 20 * u - i.from.y) * e; s *= 1 - .6 * e; a = 1 - Math.max(0, k - .7) * 2; }
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(x, y); ctx.rotate(i.rot + (i.st === 'fly' ? i.tt * 3 : Math.sin(t * 2 + i.x) * .06)); if (i === lowest) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(0, 0, 58 * u, 0, TAU); ctx.fill(); } Fashion.piece(ctx, i.it, 0, 0, s); ctx.restore();
      if (i.st === 'fall') { ctx.font = '800 ' + Math.round(14 * u) + 'px system-ui'; const w = ctx.measureText(i.name).width + 16 * u; ctx.fillStyle = '#fff6fa'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x - w / 2, y + 52 * u, w, 24 * u, 12 * u); ctx.fill(); ctx.stroke(); Food.text(ctx, i.name, x, y + 64 * u, 14 * u, '#3a0a4a', { stroke: false }); } });
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H - 150 * u); ctx.lineTo(W, H - 150 * u); ctx.stroke(); ctx.setLineDash([]);
    bins.forEach((b, i) => { const f = binFlash[i] > 0 ? 1 + binFlash[i] * .2 : 1; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(f, f); ctx.fillStyle = ERA[b.e].c; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.roundRect(-b.w / 2 + 6, -b.h / 2 + 6, b.w - 12, 20 * u, 10); ctx.fill(); Food.text(ctx, b.e, 0, -4 * u, 34 * u, '#fff'); Food.text(ctx, 'tap or swipe', 0, 30 * u, 11 * u, 'rgba(255,255,255,.85)', { stroke: false }); ctx.restore(); });
    if (streak >= 3) Food.text(ctx, 'Streak x' + streak, W - 70 * u, 100 * u, 18 * u, '#ffe066');
    if (stage === 1 && sortedTotal < 2) Food.text(ctx, 'Which decade is it from?', W / 2, 98 * u, 15 * u, '#fff');
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function tapAt(x, y) { if (F.mode !== 'play' || state !== 'play') return false; for (let i = 0; i < bins.length; i++) { const b = bins[i]; if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 - 20 * u) return answer(i); } return false; }
  let sw = null; const cv = $('game');
  cv.addEventListener('pointerdown', e => { if (tapAt(e.clientX, e.clientY)) { sw = null; return; } sw = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', e => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; const n = bins.length; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) answer(dx < 0 ? 0 : n - 1); else if (dy > 40 && n === 3) answer(1); });
  cv.addEventListener('pointercancel', () => { sw = null; });
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Out of style!', [['Score', score.toLocaleString(), nb], ['Pieces sorted', sortedTotal], ['Best streak', bestStreak], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'chrono', onStart() { stage = 1; score = 0; lives = 3; streak = 0; bestStreak = 0; sortedTotal = 0; missed = 0; FX.clear(); newStage(); } });
  cfg = stg(); layout(); binFlash = [0, 0, 0];
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__se = { get s() { const low = items.filter(i => i.st === 'fall').sort((a, b) => b.y - a.y)[0]; return { mode: F.mode, stage, score, strikes: 3 - lives, lives, served: sorted, goal: cfg.goal, state, low: low ? { d: low.d, y: low.y } : null, bins: bins.map(b => ({ x: b.x, y: b.y })) }; }, tapAt, answer };
})();
