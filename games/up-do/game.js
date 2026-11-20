/* Up Do - match the hairstyle on the card: shape, color and accessory. */
(function () {
  'use strict';
  Kit.ns('up-do');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const ALLSTY = ['bun', 'pony', 'braid', 'curls', 'bob', 'mohawk', 'pixie', 'afro'], ALLCOL = ['brown', 'blonde', 'red', 'pink', 'blue', 'purple', 'teal', 'silver'], ALLACC = [null, 'bow', 'flower', 'tiara', 'clip', 'band', 'shades'];
  const STAGES = [
    { name: 'Walk-in Wednesday', sty: 3, col: 3, acc: 2, mem: 0, time: 32, goal: 4, bg: ['#ff9ac8', '#a04a9a'] },
    { name: 'Prom Season', sty: 4, col: 5, acc: 4, mem: 0, time: 28, goal: 5, bg: ['#7a5ae8', '#3a1a8a'] },
    { name: 'Wedding Day', sty: 6, col: 6, acc: 5, mem: 5, time: 26, goal: 5, bg: ['#ffc8e0', '#c0609a'] },
    { name: 'Fashion Week', sty: 8, col: 8, acc: 6, mem: 3.5, time: 24, goal: 6, bg: ['#2ac8b8', '#0a4a6a'] },
    { name: 'Red Carpet', sty: 8, col: 8, acc: 7, mem: 2.5, time: 20, goal: 7, bg: ['#c8283a', '#4a0a2a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { time: Math.max(12, b.time - x * 1.5), goal: b.goal + Math.min(x, 3), mem: b.mem ? Math.max(1.5, b.mem - x * .3) : 0, name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  const E = { bow: '\u{1F380}', flower: '\u{1F338}', tiara: '\u{1F451}', clip: '\u{1F98B}', band: '\u{1F49C}', shades: '\u{1F576}️' };
  let W, H, u, tiles = [], doneBtn = { x: 0, y: 0, w: 1, h: 1 };
  let stage = 1, score = 0, strikes = 0, served = 0, servedTotal = 0, perfects = 0, combo = 0, t = 0, cfg, client, cur, target, timeLeft = 1, tmax = 1, state = 'play', stateT = 0, shake = 0, flash = 0, seen = 0, result = null, opts;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); tiles = [];
    if (!opts) return; const rows = [['sty', opts.sty], ['col', opts.col], ['acc', opts.acc]]; const rowH = 62 * u, y0 = H - 104 * u - rows.length * (rowH + 4);
    rows.forEach((r, ri) => { const n = r[1].length, tw = Math.min(54 * u, (W - 24 - (n - 1) * 6) / n), tot = n * tw + (n - 1) * 6, x0 = W / 2 - tot / 2; r[1].forEach((v, i) => tiles.push({ row: r[0], v, x: x0 + i * (tw + 6), y: y0 + ri * (rowH + 4), w: tw, h: rowH - 4 })); });
    doneBtn = { x: W / 2 - 90 * u, y: H - 84 * u, w: 180 * u, h: 56 * u };
  }
  S.onresize = layout;
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + served + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function newStage() { cfg = stg(); opts = { sty: ALLSTY.slice(0, cfg.sty), col: ALLCOL.slice(0, cfg.col), acc: ALLACC.slice(0, cfg.acc) }; served = 0; Kit.banner('Stage ' + stage, cfg.name); layout(); newClient(); }
  function newClient() {
    client = { skin: pick(Fashion.SKIN), mood: 1 };
    target = { sty: pick(opts.sty), col: pick(opts.col), acc: pick(opts.acc) };
    cur = { sty: opts.sty.find(s => s !== target.sty) || opts.sty[0], col: opts.col.find(c => c !== target.col) || opts.col[0], acc: null };
    tmax = timeLeft = cfg.time; seen = 0; state = 'play'; stateT = 0; result = null; syncHud();
  }
  function grade() {
    const a = cur.sty === target.sty ? 40 : 0, b = cur.col === target.col ? 40 : 0, c = cur.acc === target.acc ? 20 : 0, base = a + b + c, bonus = Math.round(base * clamp(timeLeft / tmax, 0, 1) * .5), pts = Math.round((base + bonus) * 5 * (1 + Math.min(5, combo) * .2));
    return { base, pts, stars: base >= 100 ? 3 : base >= 60 ? 2 : base >= 40 ? 1 : 0 };
  }
  function finish() {
    if (state !== 'play') return; const r = grade(); result = r; state = 'result'; stateT = 0;
    if (r.base >= 60) { served++; servedTotal++; combo++; score += r.pts; if (r.stars === 3) perfects++; client.mood = 1; FX.say('+' + r.pts, W * .36, H * .3, '#ffe066', 26); FX.burst(W * .36, H * .3, ['#ffe066', '#ff7ac0', '#7ad8ff']); Kit.tone(660, .1, 'triangle', .2); Kit.tone(990, .2, 'triangle', .16, 0, Kit.ac().currentTime + .1); }
    else if (r.base >= 40) { combo = 0; client.mood = .5; score += Math.round(r.pts / 2); FX.say('Close!', W * .36, H * .3, '#ffd0a0', 24); Kit.tone(400, .15, 'triangle', .14); }
    else { combo = 0; client.mood = 0; strikes++; shake = .3; flash = .3; FX.say('Not what I asked!', W * .36, H * .3, '#ff8a7a', 22); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); }
    seen = 99; syncHud();
  }
  function next() {
    if (strikes >= 3) { state = 'lost'; stateT = 0; return; }
    if (served >= cfg.goal) { state = 'clear'; stateT = 0; const b = 400 + (3 - strikes) * 150; score += b; FX.say('Stage clear! +' + b, W / 2, H * .4, '#fff', 26); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); syncHud(); return; }
    newClient();
  }
  function tapAt(x, y) {
    if (F.mode !== 'play' || state !== 'play') return; Kit.ac();
    if (x >= doneBtn.x && x <= doneBtn.x + doneBtn.w && y >= doneBtn.y && y <= doneBtn.y + doneBtn.h) return finish();
    for (const b of tiles) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { cur[b.row] = b.v; Kit.tone(500 + Math.random() * 200, .06, 'triangle', .14); return; }
  }
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    if (state === 'play') { timeLeft -= dt; seen += dt; if (timeLeft <= 0) finish(); }
    else if (state === 'result') { if (stateT > 1.6) next(); }
    else if (state === 'clear') { if (stateT > 1.9) { stage++; newStage(); } }
    else if (state === 'lost' && stateT > .7) gameOver();
  }
  function tileIcon(b, sel) {
    ctx.fillStyle = sel ? 'rgba(255,215,122,.95)' : 'rgba(255,255,255,.14)'; ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.4)'; ctx.lineWidth = sel ? 3 : 2; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.stroke();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (b.row === 'sty') { ctx.save(); ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 12); ctx.clip(); Fashion.head(ctx, cx, cy - 4 * u, b.w / 125, { style: b.v, color: cur.col, skin: client.skin, top: 'rgba(0,0,0,0)', mood: 1 }); ctx.restore(); }
    else if (b.row === 'col') { ctx.fillStyle = Fashion.HAIR[b.v]; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx, cy, b.w * .32, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(cx - b.w * .1, cy - b.w * .12, b.w * .08, b.w * .13, .5, 0, TAU); ctx.fill(); }
    else if (!b.v) Food.text(ctx, 'none', cx, cy, 12 * u, '#fff', { stroke: false });
    else { ctx.font = Math.round(b.w * .62) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(E[b.v], cx, cy + 2); }
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc((i * 83 + t * 8) % (W + 80) - 40, 120 + (i * 61) % 240, 30 + i * 6, 0, TAU); ctx.fill(); }
    const k = clamp(timeLeft / tmax, 0, 1); Food.meter(ctx, 14, 62 * u + 6, W - 28, 12 * u, k, k > .5 ? '#7dea8a' : k > .25 ? '#ffd23a' : '#ff5a4a');
    const cx = W * .34, cy = 200 * u, sc = 1.32 * u; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.strokeStyle = '#ffd77a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(cx - 105 * u, cy - 120 * u, 210 * u, 250 * u, 100 * u); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx - 105 * u, cy - 120 * u, 210 * u, 250 * u, 100 * u); ctx.clip();
    Fashion.head(ctx, cx, cy, sc, { skin: client.skin, style: cur.sty, color: cur.col, acc: cur.acc, t, mood: result ? client.mood : (timeLeft / tmax > .35 ? 1 : .5), look: Math.sin(t) });
    ctx.restore();
    const rx = W - 138 * u - 4, ry = 108 * u, rw = 130 * u, rh = 170 * u, hide = cfg.mem && seen > cfg.mem && state === 'play';
    ctx.save(); ctx.translate(rx + rw / 2, ry + rh / 2); ctx.rotate(.04); ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 12); ctx.fill(); ctx.stroke();
    Food.text(ctx, 'THE LOOK', 0, -rh / 2 + 16 * u, 13 * u, '#c8287a', { stroke: false });
    if (hide) { Food.text(ctx, '?', 0, 4 * u, 70 * u, '#c8c0d8', { stroke: false }); Food.text(ctx, 'memorize it!', 0, rh / 2 - 18 * u, 11 * u, '#8a6aa8', { stroke: false }); }
    else { ctx.save(); ctx.beginPath(); ctx.roundRect(-rw / 2 + 6, -rh / 2 + 28 * u, rw - 12, rh - 36 * u, 8); ctx.clip(); ctx.fillStyle = '#f4e6f8'; ctx.fillRect(-rw / 2, -rh / 2, rw, rh); Fashion.head(ctx, 0, 10 * u, .86 * u, { skin: client.skin, style: target.sty, color: target.col, acc: target.acc, t: 0 }); ctx.restore(); if (cfg.mem && state === 'play') Food.meter(ctx, -rw / 2 + 10, rh / 2 - 12 * u, rw - 20, 6 * u, clamp(1 - seen / cfg.mem, 0, 1), '#c8287a'); }
    ctx.restore();
    Heroes.draw(ctx, 'curly', W * .87, H - 345 * u, .62 * u, { t, look: Math.sin(t) });
    tiles.forEach(b => tileIcon(b, cur[b.row] === b.v));
    const dg = ctx.createLinearGradient(0, doneBtn.y, 0, doneBtn.y + doneBtn.h); dg.addColorStop(0, '#ffe38a'); dg.addColorStop(1, '#f0b020'); ctx.fillStyle = state === 'play' ? dg : '#6a4a7a'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(doneBtn.x, doneBtn.y, doneBtn.w, doneBtn.h, 16); ctx.fill(); ctx.stroke(); Food.text(ctx, 'Done!', W / 2, doneBtn.y + doneBtn.h / 2, 26 * u, '#2a0a3a', { stroke: false });
    if (result) { const r = result; Food.text(ctx, r.stars >= 3 ? 'PERFECT!' : r.stars === 2 ? 'Great!' : r.stars === 1 ? 'Meh...' : 'Oh no!', cx, cy + 150 * u, 26 * u, r.stars ? '#ffe066' : '#ff9a8a'); for (let i = 0; i < 3; i++) Food.emoji(ctx, 'star', cx - 40 * u + i * 40 * u, cy + 182 * u, 30 * u, { alpha: i < r.stars ? 1 : .25, shadow: false }); }
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (stage === 1 && servedTotal === 0 && state === 'play') Food.text(ctx, 'Match the card, then tap Done', W / 2, 98 * u, 14 * u + 1, '#fff');
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Salon closed!', [['Score', score.toLocaleString(), nb], ['Clients styled', servedTotal], ['Perfect looks', perfects], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'curly', onStart() { stage = 1; score = 0; strikes = 0; servedTotal = 0; perfects = 0; combo = 0; FX.clear(); newStage(); } });
  $('game').addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY));
  cfg = stg(); opts = { sty: ALLSTY.slice(0, 3), col: ALLCOL.slice(0, 3), acc: ALLACC.slice(0, 2) }; client = { skin: Fashion.SKIN[1], mood: 1 }; cur = { sty: 'bun', col: 'brown', acc: null }; target = cur; layout();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__u = { get s() { return { mode: F.mode, stage, score, strikes, served, goal: cfg.goal, state, cur, target, tiles: tiles.map(b => ({ row: b.row, v: b.v, x: b.x + b.w / 2, y: b.y + b.h / 2 })), done: { x: doneBtn.x + 10, y: doneBtn.y + 10 } }; }, tapAt };
})();
