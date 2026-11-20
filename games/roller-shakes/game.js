/* Roller Shakes - skate a diner floor, grab shakes at the counter, deliver the right flavor, don't spill. */
(function () {
  'use strict';
  Kit.ns('roller-shakes');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const STAGES = [
    { name: 'Soda Fountain', fl: ['vanilla', 'choco'], tables: 3, pat: 26, gap: 5, mops: 0, kids: 0, goal: 6, floor: ['#f4ecd8', '#e0d4b0'] },
    { name: 'Drive-In', fl: ['vanilla', 'choco', 'berry'], tables: 4, pat: 24, gap: 4.2, mops: 1, kids: 0, goal: 8, floor: ['#d8ecf4', '#b4d4e4'] },
    { name: 'Rink Night', fl: ['vanilla', 'choco', 'berry', 'mint'], tables: 5, pat: 22, gap: 3.6, mops: 2, kids: 1, goal: 10, floor: ['#2a2050', '#1a1438'], dark: 1 },
    { name: 'Beach Boardwalk', fl: ['vanilla', 'choco', 'berry', 'mint', 'banana'], tables: 6, pat: 21, gap: 3.2, mops: 2, kids: 2, goal: 12, floor: ['#f4dca0', '#e4c070'] },
    { name: 'Grand Gala', fl: ['vanilla', 'choco', 'berry', 'mint', 'banana', 'blue'], tables: 6, pat: 19, gap: 2.8, mops: 3, kids: 3, goal: 14, floor: ['#f0e4f4', '#d4bce0'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { pat: Math.max(12, b.pat - x * 1.5), gap: Math.max(2, b.gap - x * 0.2), goal: b.goal + x * 2, name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  const COLORS = { vanilla: '#fff3c8', choco: '#8a5a3a', berry: '#ff8ab4', mint: '#8aeec8', banana: '#ffe066', blue: '#7ac0ff' };
  let W, H, u, counterY, tablePos, pl, tgt = null;
  let stage = 1, score = 0, strikes = 0, served = 0, servedTotal = 0, combo = 0, bestCombo = 0, spills = 0, t = 0, cfg, tray = [], tables = [], mops = [], kids = [], disp = [], parts = [], wob = 0, wobDir = 0, spawnT = 0, state = 'play', stateT = 0, shake = 0, flash = 0, stun = 0;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); counterY = 160 * u;
    const n = cfg ? cfg.tables : 3, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), top = counterY + 100 * u, bot = H - 90 * u;
    tablePos = Array.from({ length: n }, (_, i) => { const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols); return { x: W / (inRow + 1) * (c + 1), y: top + (bot - top) * (rows === 1 ? 0.5 : (r + 0.5) / rows) }; });
    if (cfg) { const fl = cfg.fl, n2 = fl.length; disp = fl.map((f, i) => ({ f, x: W / (n2 + 1) * (i + 1), y: counterY - 6 * u, cd: 0 })); }
    if (!pl) pl = { x: W / 2, y: H - 120 * u, vx: 0, vy: 0, face: 1 };
  }
  S.onresize = layout; layout();
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + served + '/' + (cfg ? cfg.goal : 0); $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function say(txt, x, y, col) { parts.push({ txt, x, y, age: 0, life: 1.0, col }); }
  function newStage() {
    cfg = stg(); pl = null; layout(); tray = []; tables = tablePos.map((p, i) => ({ i, want: null, age: 0, pat: 0, seat: Math.random() * 6 })); mops = []; kids = []; served = 0; spawnT = 1.2; wob = 0; stun = 0;
    for (let i = 0; i < cfg.mops; i++) { let p; for (let k = 0; k < 20; k++) { p = { x: rnd(50 * u, W - 50 * u), y: rnd(counterY + 120 * u, H - 100 * u) }; if (!tablePos.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 90 * u) && Math.hypot(p.x - W / 2, p.y - (H - 120 * u)) > 90 * u) break; } mops.push(p); }
    for (let i = 0; i < cfg.kids; i++) kids.push({ x: rnd(40 * u, W - 40 * u), y: rnd(counterY + 130 * u, H - 100 * u), vx: (Math.random() < .5 ? -1 : 1) * rnd(50, 90) * u, vy: rnd(-30, 30) * u, e: pick(['\u{1F9D2}', '\u{1F466}', '\u{1F467}']) });
    Kit.banner('Stage ' + stage, cfg.name); state = 'play'; stateT = 0; syncHud();
  }
  function spawnOrder() {
    const free = tables.filter(x => !x.want); if (!free.length) return; const tb = pick(free); tb.want = pick(cfg.fl); tb.age = 0; tb.pat = cfg.pat; tb.seat = Math.random() * 6;
  }
  function spill(why) { if (!tray.length) return; const f = tray.pop(); spills++; combo = 0; flash = 0.25; shake = 0.25; say(why || 'Spilled!', pl.x, pl.y - 50 * u, '#ff9a8a'); for (let i = 0; i < 10; i++) parts.push({ x: pl.x, y: pl.y - 30 * u, vx: rnd(-120, 120), vy: rnd(-200, -40), age: 0, life: 0.7, c: COLORS[f] }); Kit.tone(240, 0.2, 'sawtooth', 0.12, -100); Kit.vibe(30); }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; } else q.y -= 34 * dt; }); parts = parts.filter(q => q.age < q.life);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    if (state === 'play') {
      stun = Math.max(0, stun - dt);
      const ox = pl.vx, oy = pl.vy, MAX = 320 * u;
      if (tgt && stun <= 0) { const dx = tgt.x - pl.x, dy = tgt.y - pl.y, d = Math.hypot(dx, dy); if (d > 6) { const a = 900 * u; pl.vx += dx / d * a * dt * Math.min(1, d / (60 * u)); pl.vy += dy / d * a * dt * Math.min(1, d / (60 * u)); } }
      const fr = Math.pow(0.5, dt * 2.2); pl.vx *= fr; pl.vy *= fr; const sp = Math.hypot(pl.vx, pl.vy); if (sp > MAX) { pl.vx *= MAX / sp; pl.vy *= MAX / sp; }
      const dv = Math.hypot(pl.vx - ox, pl.vy - oy) / dt; /* acceleration */
      wob += (dv > 1100 * u ? (dv - 1100 * u) / (900 * u) : 0) * dt * tray.length * 1.4; wob = Math.max(0, wob - dt * 0.55); wobDir += dt * 9 * (1 + wob * 2);
      if (wob >= 1 && tray.length) { wob = 0.35; spill('Spilled!'); }
      pl.x += pl.vx * dt; pl.y += pl.vy * dt; if (Math.abs(pl.vx) > 8) pl.face = pl.vx > 0 ? 1 : -1;
      pl.x = clamp(pl.x, 26 * u, W - 26 * u); pl.y = clamp(pl.y, counterY + 40 * u, H - 40 * u);
      /* dispensers */
      disp.forEach(d => { d.cd = Math.max(0, d.cd - dt); if (d.cd <= 0 && pl.y < counterY + 70 * u && Math.abs(pl.x - d.x) < 38 * u && tray.length < 3) { tray.push(d.f); d.cd = 0.45; Kit.tone(500 + tray.length * 120, 0.08, 'triangle', 0.16); say('+' + d.f, d.x, d.y + 50 * u, COLORS[d.f]); } });
      /* tables */
      tables.forEach(tb => {
        if (!tb.want) return; tb.age += dt; tb.pat -= dt;
        const p = tablePos[tb.i];
        if (Math.hypot(pl.x - p.x, pl.y - p.y) < 62 * u) { const j = tray.indexOf(tb.want); if (j >= 0) { tray.splice(j, 1); combo++; bestCombo = Math.max(bestCombo, combo); const k = clamp(tb.pat / cfg.pat, 0, 1), pts = Math.round((100 + 100 * k) * (1 + Math.min(6, combo - 1) * 0.2)); score += pts; served++; servedTotal++; say('+' + pts, p.x, p.y - 40 * u, '#ffe066'); for (let i = 0; i < 10; i++) parts.push({ x: p.x, y: p.y, vx: rnd(-140, 140), vy: rnd(-220, -40), age: 0, life: 0.8, c: pick(['#ffe066', '#ff8ab4', '#8aeec8']) }); tb.want = null; Kit.tone(660, 0.1, 'triangle', 0.2); Kit.tone(990, 0.18, 'triangle', 0.16, 0, Kit.ac().currentTime + 0.09); syncHud(); } }
        if (tb.want && tb.pat <= 0) { tb.want = null; strikes++; combo = 0; flash = 0.4; shake = 0.3; say('Left angry!', p.x, p.y - 40 * u, '#ff8a7a'); Kit.tone(150, 0.4, 'sawtooth', 0.18, -80); Kit.vibe(50); syncHud(); if (strikes >= 3) { state = 'lost'; stateT = 0; } }
      });
      /* hazards */
      mops.forEach(m => { if (stun <= 0 && Math.hypot(pl.x - m.x, pl.y - m.y) < 40 * u) { stun = 0.7; pl.vx *= -0.6; pl.vy *= -0.6; spill('Slipped!'); Kit.noise(0.2, 0.2); } });
      kids.forEach(k => { k.x += k.vx * dt; k.y += k.vy * dt; if (k.x < 30 * u || k.x > W - 30 * u) k.vx *= -1; if (k.y < counterY + 120 * u || k.y > H - 70 * u) k.vy *= -1; if (Math.random() < dt * 0.4) { k.vx = (Math.random() < .5 ? -1 : 1) * rnd(50, 90) * u; k.vy = rnd(-40, 40) * u; } if (stun <= 0 && Math.hypot(pl.x - k.x, pl.y - k.y) < 36 * u) { stun = 0.6; const a = Math.atan2(pl.y - k.y, pl.x - k.x); pl.vx = Math.cos(a) * 260 * u; pl.vy = Math.sin(a) * 260 * u; spill('Bumped!'); k.vx *= -1; } });
      spawnT -= dt; if (spawnT <= 0) { spawnOrder(); spawnT = cfg.gap * rnd(0.8, 1.2); }
      if (served >= cfg.goal) { state = 'clear'; stateT = 0; const b = 400 + (3 - strikes) * 150; score += b; say('Stage clear! +' + b, W / 2, H * 0.4, '#fff'); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.24, 'triangle', 0.22, 0, Kit.ac().currentTime + 0.12); syncHud(); }
    } else if (state === 'clear') { if (stateT > 1.9) { stage++; newStage(); } }
    else if (state === 'lost' && stateT > 0.8) gameOver();
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    /* checker floor */
    ctx.fillStyle = cfg.floor[0]; ctx.fillRect(-20, 0, W + 40, H); ctx.fillStyle = cfg.floor[1]; const cs = 56 * u; for (let y = counterY, r = 0; y < H; y += cs, r++) for (let x = (r % 2) * cs; x < W; x += cs * 2) ctx.fillRect(x, y, cs, cs);
    if (cfg.dark) { for (let i = 0; i < 12; i++) { const a = t * 0.6 + i; ctx.fillStyle = 'hsla(' + (i * 40 + t * 60) % 360 + ',90%,60%,0.10)'; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * W * 0.4, H * 0.6 + Math.sin(a * 1.3) * H * 0.3, 70 * u, 0, TAU); ctx.fill(); } }
    /* counter */
    const cg = ctx.createLinearGradient(0, 70 * u, 0, counterY + 18 * u); cg.addColorStop(0, '#e8453a'); cg.addColorStop(1, '#a82a22'); ctx.fillStyle = cg; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 4; ctx.fillRect(0, 96 * u, W, counterY - 96 * u + 14 * u); ctx.strokeRect(-4, 96 * u, W + 8, counterY - 96 * u + 14 * u);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, counterY + 6 * u, W, 8 * u);
    disp.forEach(d => { Food.shake(ctx, d.f, d.x, d.y - 4 * u, 0.62 * u * (d.cd > 0 ? 0.9 : 1)); });
    tables.forEach(tb => {
      const p = tablePos[tb.i]; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 8 * u, 42 * u, 30 * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c85a3a'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, 40 * u, 28 * u, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f8e4c8'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 28 * u, 18 * u, 0, 0, TAU); ctx.fill();
      if (tb.want) { const k = clamp(tb.pat / cfg.pat, 0, 1), wob_ = Math.sin(t * 12) * (k < 0.3 ? 3 : 0); ctx.font = (34 * u) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(k > 0.6 ? '\u{1F600}' : k > 0.3 ? '\u{1F610}' : '\u{1F621}', p.x + wob_, p.y - 30 * u);
        Food.bubble(ctx, p.x + 40 * u, p.y - 52 * u, 44 * u, 50 * u, 'bl', '#fff'); Food.shake(ctx, tb.want, p.x + 40 * u, p.y - 44 * u, 0.48 * u); Food.meter(ctx, p.x - 30 * u, p.y + 32 * u, 60 * u, 8 * u, k, k > 0.5 ? '#7dea8a' : k > 0.25 ? '#ffd23a' : '#ff5a4a'); }
    });
    mops.forEach(m => { ctx.fillStyle = 'rgba(120,180,240,.45)'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 8 * u, 40 * u, 24 * u, 0, 0, TAU); ctx.fill(); Food.emoji(ctx, 'mop', m.x, m.y, 40 * u, {}); });
    kids.forEach(k => { ctx.font = (34 * u) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(k.e, k.x, k.y); });
    /* player */
    if (pl) {
      const lean = clamp(pl.vx / (320 * u), -1, 1) * 0.18; ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(lean + (stun > 0 ? Math.sin(t * 30) * 0.2 : 0)); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 22 * u, 24 * u, 8 * u, 0, 0, TAU); ctx.fill();
      Heroes.draw(ctx, 'shaky', 0, -4 * u, 0.3 * u, { t, look: pl.face });
      tray.forEach((f, i) => { const sw = Math.sin(wobDir + i) * wob * 14 * u; Food.shake(ctx, f, sw + (i - (tray.length - 1) / 2) * 22 * u, -58 * u - i * 4 * u, 0.5 * u); });
      if (wob > 0.05 && tray.length) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-24 * u, -102 * u, 48 * u, 6 * u); ctx.fillStyle = wob > 0.7 ? '#ff5a4a' : '#ffd23a'; ctx.fillRect(-24 * u, -102 * u, 48 * u * clamp(wob, 0, 1), 6 * u); }
      ctx.restore();
    }
    if (tgt && F.mode === 'play') { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 16 * u, 0, TAU); ctx.stroke(); }
    parts.forEach(q => { const kk = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, kk * 2); Food.text(ctx, q.txt, q.x, q.y, 18 * u + 2, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(kk, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,40,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (stage === 1 && servedTotal < 1) Food.text(ctx, tray.length ? 'Skate to the table with that flavor!' : 'Drag to skate. Grab a shake at the counter!', W / 2, H - 36 * u, 14 * u + 1, '#fff');
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); F.over(nb ? 'New best!' : 'Diner closed!', [['Score', score.toLocaleString(), nb], ['Shakes served', servedTotal], ['Best combo', 'x' + bestCombo], ['Spills', spills], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'shaky', onStart() { stage = 1; score = 0; strikes = 0; servedTotal = 0; combo = 0; bestCombo = 0; spills = 0; parts = []; tgt = null; newStage(); } });
  const cv = $('game'), setT = e => { tgt = { x: e.clientX, y: e.clientY - 30 * u }; };
  cv.addEventListener('pointerdown', e => { Kit.ac(); setT(e); }); cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') setT(e); }); cv.addEventListener('pointerup', () => { tgt = null; }); cv.addEventListener('pointercancel', () => { tgt = null; });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); if (cfg) render(); else { ctx.fillStyle = '#2a0e0a'; ctx.fillRect(0, 0, W, H); } });
  cfg = stg(); layout();
  window.__r = { get s() { return { mode: F.mode, stage, score, strikes, served, goal: cfg.goal, tray, tables: tables.map(x => x.want), pl: pl && { x: pl.x, y: pl.y }, state }; }, setT(x, y) { tgt = { x, y }; }, tablePos: () => tablePos, disp: () => disp.map(d => ({ f: d.f, x: d.x, y: d.y })) };
})();
