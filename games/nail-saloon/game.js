/* Nail Saloon - pick a polish, drag across each nail to paint it, add patterns. */
(function () {
  'use strict';
  Kit.ns('nail-saloon');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const COLORS = ['#ff4fa3', '#7a5ae8', '#2ac8b8', '#ffd23a', '#e8453a', '#4a8ae8', '#ffffff', '#2a2a3a'];
  const PATS = ['stripe', 'dot', 'heart', 'tip', 'glitter'], PICON = { stripe: '═', dot: '••', heart: '♥', tip: '▔', glitter: '✨' };
  const STAGES = [
    { name: 'Dusty Gulch', nails: 3, col: 3, pat: 0, time: 32, goal: 3, bg: ['#d89a5a', '#7a4a22'] },
    { name: 'Rodeo Row', nails: 5, col: 4, pat: 0, time: 40, goal: 4, bg: ['#c8742c', '#6a3410'] },
    { name: 'Gold Rush', nails: 5, col: 5, pat: 2, time: 46, goal: 4, bg: ['#e8b84a', '#8a5a14'] },
    { name: 'Showdown', nails: 5, col: 6, pat: 4, time: 46, goal: 5, bg: ['#b8402c', '#4a1410'] },
    { name: 'High Noon', nails: 5, col: 8, pat: 5, time: 44, goal: 6, bg: ['#ff8a3a', '#7a2a2a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { time: Math.max(24, b.time - x * 2), goal: b.goal + Math.min(x, 3), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, hx, hy, hs, nailPos = [], bottles = [], pats = [];
  let stage = 1, score = 0, strikes = 0, served = 0, servedTotal = 0, perfects = 0, smudgeTotal = 0, t = 0, cfg, cust, order, nails, timeLeft = 1, tmax = 1, state = 'play', stateT = 0, shake = 0, flash = 0, selC = null, selP = null, drag = null, smudge = 0, result = null;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); hs = 1.55 * u; hx = W / 2 + 46 * u; hy = H * .5; nailPos = Fashion.handNails().map(n => ({ x: hx + n.x * hs, y: hy + n.y * hs, rx: n.rx * hs, ry: n.ry * hs, rot: n.rot || 0 }));
    bottles = []; pats = []; if (!cfg) return; const n = cfg.col, tw = Math.min(46 * u, (W - 24) / n - 4), x0 = W / 2 - (n * (tw + 4)) / 2, by = H - 146 * u; for (let i = 0; i < n; i++) bottles.push({ c: COLORS[i], x: x0 + i * (tw + 4), y: by, w: tw, h: 62 * u });
    const m = cfg.pat, pw = 44 * u, px0 = W / 2 - (m * (pw + 6)) / 2; for (let i = 0; i < m; i++) pats.push({ p: PATS[i], x: px0 + i * (pw + 6), y: H - 74 * u, w: pw, h: 54 * u });
  }
  S.onresize = layout;
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + served + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function newStage() { cfg = stg(); served = 0; layout(); Kit.banner('Stage ' + stage, cfg.name); newCust(); }
  function newCust() {
    cust = { skin: pick(Fashion.SKIN) }; const pool = COLORS.slice(0, cfg.col); order = nails0(pool);
    nails = Fashion.handNails().map((n, i) => ({ c: null, cov: 0, p: null, cells: new Set(), on: i < cfg.nails })); if (cfg.nails === 3) { nails.forEach((n, i) => n.on = [0, 1, 2].includes(i)); }
    tmax = timeLeft = cfg.time; state = 'play'; stateT = 0; result = null; selC = null; selP = null; drag = null; smudge = 0; syncHud();
  }
  function nails0(pool) { const a = []; for (let i = 0; i < Fashion.handNails().length; i++) { const c = pick(pool); let p = null; if (cfg.pat && Math.random() < .55) p = pick(PATS.slice(0, cfg.pat)); a.push({ c, p }); } return a; }
  const active = () => nails.map((n, i) => ({ n, i })).filter(x => x.n.on);
  function inNail(i, x, y, k) { const p = nailPos[i], cs = Math.cos(-p.rot), sn = Math.sin(-p.rot), dx = x - p.x, dy = y - p.y, lx = dx * cs - dy * sn, ly = dx * sn + dy * cs; return { ok: (lx * lx) / ((p.rx * k) * (p.rx * k)) + (ly * ly) / ((p.ry * k) * (p.ry * k)) <= 1, ly: ly / p.ry }; }
  function paintAt(x, y, engaged) {
    let hit = false;
    active().forEach(({ n, i }) => { const r = inNail(i, x, y, 1.12); if (r.ok) { hit = true; if (n.c !== selC) { n.c = selC; n.cov = 0; n.cells = new Set(); n.p = null; } const cell = clamp(Math.floor((r.ly + 1) / 2 * 6), 0, 5); n.cells.add(cell); const was = n.cov; n.cov = n.cells.size / 6; if (n.cov >= 1 && was < 1) { Kit.tone(720 + i * 60, .08, 'triangle', .16); FX.burst(nailPos[i].x, nailPos[i].y, [n.c, '#fff'], 6); } } });
    if (!hit && engaged) { const nearFinger = active().some(({ i }) => { const p = nailPos[i]; return Math.abs(x - p.x) < p.rx * 1.9 && y > p.y - p.ry * 1.7 && y < p.y + p.ry * 3.2; }); if (nearFinger) { smudge += 1; if (smudge % 14 === 0) { smudgeTotal++; score = Math.max(0, score - 30); FX.say('Smudge! -30', x, y - 20 * u, '#ff8a7a', 16); Kit.tone(200, .1, 'sawtooth', .1, -60); flash = .12; syncHud(); } } }
  }
  function tapAt(x, y) {
    if (F.mode !== 'play' || state !== 'play') return; Kit.ac();
    for (const b of bottles) if (x >= b.x && x <= b.x + b.w && y >= b.y - 8 && y <= b.y + b.h) { selC = b.c; selP = null; Kit.tone(540, .06, 'triangle', .14); return true; }
    for (const b of pats) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { selP = b.p; selC = null; Kit.tone(600, .06, 'triangle', .14); return true; }
    if (selP) { for (const { n, i } of active()) if (inNail(i, x, y, 1.3).ok && n.cov >= 1) { n.p = selP; Kit.tone(820, .08, 'triangle', .16); FX.burst(nailPos[i].x, nailPos[i].y, ['#fff', '#ffe066'], 6); checkDone(); return true; } }
    return false;
  }
  function checkDone() {
    if (state !== 'play') return; const ok = active().every(({ n, i }) => n.cov >= 1 && n.c === order[i].c && (!order[i].p || n.p === order[i].p) && (order[i].p || !n.p || true));
    if (ok) finish(true);
  }
  function score_() { let correct = 0, total = 0; active().forEach(({ n, i }) => { total++; if (n.cov >= 1 && n.c === order[i].c) correct++; if (order[i].p) { total++; if (n.p === order[i].p) correct++; } }); return { correct, total }; }
  function finish(done) {
    if (state !== 'play') return; const r = score_(), k = clamp(timeLeft / tmax, 0, 1), pts = Math.round(r.correct * 80 * (1 + k) * (done ? 1.3 : 1)); result = { r, pts, done }; state = 'result'; stateT = 0;
    if (done || r.correct / r.total >= .7) { served++; servedTotal++; score += pts; if (done && smudge < 14) perfects++; FX.say('+' + pts, W / 2, H * .24, '#ffe066', 28); FX.burst(W / 2, H * .24, ['#ffe066', '#ff7ac0', '#fff']); Kit.tone(660, .1, 'triangle', .2); Kit.tone(990, .2, 'triangle', .16, 0, Kit.ac().currentTime + .1); }
    else { strikes++; shake = .3; flash = .3; FX.say('Unhappy customer!', W / 2, H * .24, '#ff8a7a', 24); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); }
    syncHud();
  }
  function next() {
    if (strikes >= 3) { state = 'lost'; stateT = 0; return; }
    if (served >= cfg.goal) { state = 'clear'; stateT = 0; const b = 400 + (3 - strikes) * 150; score += b; FX.say('Stage clear! +' + b, W / 2, H * .4, '#fff', 26); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); syncHud(); return; }
    newCust();
  }
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    if (state === 'play') { timeLeft -= dt; if (timeLeft <= 0) finish(false); }
    else if (state === 'result') { if (stateT > 1.5) next(); }
    else if (state === 'clear') { if (stateT > 1.9) { stage++; newStage(); } }
    else if (state === 'lost' && stateT > .7) gameOver();
  }
  function bottle(b, sel) {
    const x = b.x + b.w / 2, y = b.y + b.h / 2 - (sel ? 10 * u : 0), w = b.w * .74, h = b.h * .78; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, h / 2 + 4, w * .6, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = b.c; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.roundRect(-w / 2, -h * .12, w, h * .62, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-w / 2 + 5, -h * .06, 5, h * .44);
    ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.roundRect(-w * .2, -h * .5, w * .4, h * .4, 4); ctx.fill(); ctx.stroke();
    if (sel) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-w / 2 - 5, -h * .55, w + 10, h * 1.15, 12); ctx.stroke(); } ctx.restore();
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    ctx.strokeStyle = 'rgba(60,24,6,.25)'; ctx.lineWidth = 2; for (let y = 90 * u; y < H; y += 54 * u) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#ffd23a'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * W / 8 - 14, 84 * u); ctx.lineTo(i * W / 8 + 14, 84 * u); ctx.lineTo(i * W / 8, 104 * u); ctx.closePath(); ctx.fill(); }
    const k = clamp(timeLeft / tmax, 0, 1); Food.meter(ctx, 14, 62 * u + 6, W - 28, 12 * u, k, k > .5 ? '#7dea8a' : k > .25 ? '#ffd23a' : '#ff5a4a');
    /* order card */
    const ow = 168 * u, oh = 100 * u, ox = 10 * u, oy = 112 * u; ctx.save(); ctx.translate(ox + ow / 2, oy + oh / 2); ctx.rotate(-.03); ctx.fillStyle = '#fff6d8'; ctx.strokeStyle = '#4a2410'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-ow / 2, -oh / 2, ow, oh, 8); ctx.fill(); ctx.stroke(); Food.text(ctx, 'WANTED: THIS SET', 0, -oh / 2 + 14 * u, 11 * u, '#8a2a10', { stroke: false });
    active().slice().sort((a, b) => nailPos[a.i].x - nailPos[b.i].x).forEach(({ i }, j) => { const cx = -ow / 2 + 22 * u + j * 30 * u, o = order[i]; ctx.fillStyle = o.c; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, 0, 11 * u, 15 * u, 0, 0, TAU); ctx.fill(); ctx.stroke(); if (o.p) { ctx.save(); ctx.beginPath(); ctx.ellipse(cx, 0, 11 * u, 15 * u, 0, 0, TAU); ctx.clip(); ctx.translate(cx, 0); Fashion.pattern(ctx, o.p, 11 * u, 15 * u); ctx.restore(); } });
    ctx.restore();
    /* hand + nails */
    Fashion.hand(ctx, hx, hy, hs, { skin: cust.skin });
    nailPos.forEach((p, i) => { const n = nails[i]; if (!n.on) return; const sel = !!(order && order[i]) && state === 'play'; Fashion.nail(ctx, p.x, p.y, 1, n, { rx: p.rx, ry: p.ry, rot: p.rot }); });
    if (state === 'play' && selC) active().forEach(({ n, i }) => { if (n.cov < 1) { const p = nailPos[i]; ctx.strokeStyle = 'rgba(255,255,255,' + (.35 + .25 * Math.sin(t * 6)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx * 1.25, p.ry * 1.2, p.rot, 0, TAU); ctx.stroke(); } });
    if (state === 'play' && selP) active().forEach(({ n, i }) => { if (n.cov >= 1 && order[i].p && n.p !== order[i].p) { const p = nailPos[i]; ctx.strokeStyle = 'rgba(255,224,102,' + (.5 + .3 * Math.sin(t * 6)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx * 1.3, p.ry * 1.25, p.rot, 0, TAU); ctx.stroke(); } });
    if (drag && selC) { ctx.fillStyle = selC; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(drag.x, drag.y, 9 * u, 0, TAU); ctx.fill(); ctx.stroke(); }
    Heroes.draw(ctx, 'dusty', 58 * u, H - 200 * u, .62 * u, { t, look: Math.sin(t) });
    /* palette */
    ctx.fillStyle = 'rgba(40,12,4,.55)'; ctx.fillRect(0, H - 158 * u, W, 158 * u);
    bottles.forEach(b => bottle(b, selC === b.c));
    pats.forEach(b => { const sel = selP === b.p; ctx.fillStyle = sel ? '#ffe066' : 'rgba(255,255,255,.2)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = sel ? 3 : 1.5; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.stroke(); Food.text(ctx, PICON[b.p], b.x + b.w / 2, b.y + b.h / 2, 22 * u, sel ? '#4a2410' : '#fff', { stroke: false }); });
    if (result) Food.text(ctx, result.done ? 'PERFECT SET!' : result.r.correct / result.r.total >= .7 ? 'Good job' : 'Out of time', W / 2, hy + 128 * u, 26 * u, result.done ? '#ffe066' : '#fff');
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (stage === 1 && servedTotal === 0 && state === 'play') Food.text(ctx, selC ? 'Drag across each nail to paint it' : 'Pick a polish bottle first', W / 2, hy + 150 * u, 15 * u, '#fff');
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Saloon closed!', [['Score', score.toLocaleString(), nb], ['Customers served', servedTotal], ['Clean sets', perfects], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'dusty', onStart() { stage = 1; score = 0; strikes = 0; servedTotal = 0; perfects = 0; smudgeTotal = 0; FX.clear(); newStage(); } });
  const cv = $('game');
  cv.addEventListener('pointerdown', e => { if (tapAt(e.clientX, e.clientY)) return; if (F.mode === 'play' && state === 'play' && selC) { drag = { x: e.clientX, y: e.clientY, engaged: active().some(({ i }) => inNail(i, e.clientX, e.clientY, 1.15).ok) }; smudge = 0; paintAt(e.clientX, e.clientY, drag.engaged); } });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(d / 4)); for (let i = 1; i <= n; i++) paintAt(drag.x + dx * i / n, drag.y + dy * i / n, drag.engaged); drag.x = e.clientX; drag.y = e.clientY; if (!drag.engaged && active().some(({ i }) => inNail(i, drag.x, drag.y, 1.1).ok)) drag.engaged = true; });
  const up = () => { if (drag) { drag = null; checkDone(); } }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cfg = stg(); cust = { skin: Fashion.SKIN[1] }; order = Fashion.handNails().map(() => ({ c: COLORS[0], p: null })); nails = Fashion.handNails().map(() => ({ c: null, cov: 0, p: null, cells: new Set(), on: false })); layout();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__n = { get s() { return { mode: F.mode, stage, score, strikes, served, goal: cfg.goal, state, order, nails: nails.map(n => ({ c: n.c, cov: n.cov, p: n.p, on: n.on })), bottles: bottles.map(b => ({ c: b.c, x: b.x + b.w / 2, y: b.y + b.h / 2 })), pats: pats.map(b => ({ p: b.p, x: b.x + b.w / 2, y: b.y + b.h / 2 })), nailPos }; }, tapAt, paintAt, checkDone, setDrag(v) { drag = v; }, sel(c, p) { selC = c; selP = p; } };
})();
