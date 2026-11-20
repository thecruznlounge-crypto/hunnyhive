/* Air Rescue - winch survivors, deliver them to the helipad. */
(function () {
  'use strict';
  Kit.ns('air-rescue');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  let W, H, u, gy;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); gy = H * 0.9; }
  S.onresize = layout; layout();
  const THEMES = [
    { name: 'Flood City', sky: ['#7ec8ff', '#d8f0ff'], gnd: '#3a7aa8', plat: ['#8a6a4a', '#5a4430'], kind: 'roof', water: true },
    { name: 'Blizzard Peaks', sky: ['#a8c0d8', '#eef4fa'], gnd: '#dfe8f2', plat: ['#6a7a90', '#445064'], kind: 'rock', snow: true },
    { name: 'Wildfire Canyon', sky: ['#ff8a4a', '#ffd88a'], gnd: '#6a3a22', plat: ['#a85a32', '#6a3418'], kind: 'rock', fire: true },
    { name: 'Ocean Storm', sky: ['#3a4a68', '#6a7a98'], gnd: '#1a4a7a', plat: ['#c8d0dc', '#8a94a4'], kind: 'ice', rain: true },
    { name: 'Volcano Island', sky: ['#4a2a3a', '#d8683a'], gnd: '#3a2a2a', plat: ['#4a3a38', '#2a1e1c'], kind: 'rock', ash: true }
  ];
  let mode = 'title', stage = 1, score = 0, hp = 3, fuel = 100, t = 0, heli = { x: 0, y: 0, vx: 0, vy: 0, tilt: 0 }, target = null, plats = [], surv = [], carry = 0, birds = [], bolts = [], gust = { v: 0, t: 0, next: 8 }, parts = [], saved = 0, goal = 4, flash = 0, shake = 0, invul = 0, stageT = 0, state = 'play', rescuedTotal = 0, pad = { x: 0, y: 0 }, spawnT = 0, birdT = 3, boltT = 6, lost = 0;
  const best = () => Kit.get('best', 0), th = () => THEMES[(stage - 1) % THEMES.length];
  const CAP = 3;

  function buildStage() {
    pad = { x: W * (Math.random() < 0.5 ? 0.16 : 0.84), y: gy - 6 * u };
    plats = []; const n = 4 + Math.min(2, Math.floor(stage / 2)); const slots = []; for (let i = 0; i < n; i++) slots.push((i + 0.5) / n); slots.sort(() => Math.random() - 0.5);
    slots.forEach(s => { const x = clamp(W * s + rnd(-20, 20), 50 * u, W - 50 * u); if (Math.abs(x - pad.x) < 60 * u) return; plats.push({ x, y: H * rnd(0.48, 0.84), w: rnd(70, 100) * u, s: null, busy: false }); });
    surv = []; carry = 0; saved = 0; goal = 3 + stage; birds = []; bolts = []; spawnT = 0.3; heli.x = pad.x; heli.y = gy - 120 * u; heli.vx = heli.vy = 0; target = null; fuel = 100; syncHud();
  }
  function spawnSurv() {
    const free = plats.filter(p => !p.busy); const active = surv.filter(s => s.state === 'wait').length; if (!free.length || active >= Math.min(3, 1 + Math.ceil(stage / 2))) return;
    const p = pick(free); p.busy = true; surv.push({ p, x: p.x + rnd(-p.w * 0.3, p.w * 0.3), y: p.y, state: 'wait', prog: 0, patience: Math.max(18, 34 - stage * 2), age: 0, rise: 0, ph: rnd(0, 6) });
  }
  function hurt(msg) { if (invul > 0 || state !== 'play') return; hp--; invul = 1.4; flash = 0.5; shake = 0.7; Kit.tone(150, 0.4, 'sawtooth', 0.2, -90); Kit.noise(0.25, 0.25, null, 400); Kit.vibe(80); parts.push({ txt: msg || 'Hit!', x: heli.x, y: heli.y - 40, age: 0, life: 1 }); if (carry > 0 && Math.random() < 0.5) { carry--; } syncHud(); if (hp <= 0) { state = 'crash'; stateT = 0; } }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + saved + '/' + goal; $('hudC').textContent = score.toLocaleString() + (carry ? ' · 🧍' + carry : ''); $('hudR').textContent = '♥'.repeat(Math.max(0, hp)) + '♡'.repeat(Math.max(0, 3 - hp)); $('crowdFill').style.width = clamp(fuel, 0, 100) + '%'; }
  let stateT2 = 0, stateT = 0;
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; } else q.y -= 28 * dt; }); parts = parts.filter(q => q.age < q.life); flash = Math.max(0, flash - dt * 2); shake = Math.max(0, shake - dt * 2.5); invul = Math.max(0, invul - dt);
    if (mode !== 'play') return; stageT += dt;
    if (state === 'crash') { stateT += dt; heli.vy += 500 * dt; heli.y += heli.vy * dt; heli.tilt += dt * 6; if (stateT > 1.5) gameOver(); return; }
    if (state === 'clear') { stateT += dt; if (stateT > 2) { stage++; buildStage(); state = 'play'; Kit.banner('Stage ' + stage, th().name); } return; }
    /* heli */
    if (target) { const k = Math.min(1, dt * 5); const nx = heli.x + (target.x - heli.x) * k, ny = heli.y + (target.y - heli.y) * k; heli.vx = (nx - heli.x) / dt; heli.vy = (ny - heli.y) / dt; heli.x = nx; heli.y = ny; } else { heli.vx *= 0.9; heli.vy *= 0.9; heli.x += heli.vx * dt; heli.y += heli.vy * dt; }
    heli.x += gust.v * dt; heli.x = clamp(heli.x, 30 * u, W - 30 * u); heli.y = clamp(heli.y, 110, gy - 20 * u);
    plats.forEach(p => { if (Math.abs(heli.x - p.x) < p.w / 2 + 20 * u && heli.y > p.y - 34 * u && heli.y < p.y + 20) heli.y = p.y - 34 * u; });
    heli.tilt += (clamp(heli.vx / 400, -0.3, 0.3) - heli.tilt) * Math.min(1, dt * 6);
    fuel -= dt * (100 / (75 - Math.min(20, stage * 3))); if (fuel <= 0) { fuel = 0; hp = 0; state = 'crash'; stateT = 0; parts.push({ txt: 'Out of fuel!', x: W / 2, y: H * 0.4, age: 0, life: 1.4 }); }
    /* survivors + winch */
    spawnT -= dt; if (spawnT <= 0) { spawnSurv(); spawnT = 2.5; }
    surv.forEach(s => {
      s.age += dt; if (s.state === 'wait') {
        s.patience -= dt; const dx = Math.abs(heli.x - s.x), above = heli.y < s.y - 30 * u && s.y - heli.y < 190 * u;
        if (dx < 34 * u && above && carry < CAP) { s.prog = Math.min(1, s.prog + dt / 1.1); if (s.prog >= 1) { s.state = 'up'; s.rise = 0; } } else s.prog = Math.max(0, s.prog - dt * 0.8);
        if (s.patience <= 0) { s.state = 'lost'; s.p.busy = false; lost++; parts.push({ txt: 'Too late', x: s.x, y: s.y - 40, age: 0, life: 1 }); hurt('Lost one'); }
      } else if (s.state === 'up') { s.rise += dt * 3; const k = Math.min(1, s.rise); s.y2 = s.y + (heli.y - s.y) * k; if (k >= 1) { s.state = 'done'; s.p.busy = false; carry++; Kit.tone(660, 0.1, 'triangle', 0.2); syncHud(); } }
    });
    surv = surv.filter(s => s.state === 'wait' || s.state === 'up');
    /* helipad */
    if (carry > 0 && Math.abs(heli.x - pad.x) < 46 * u && heli.y > pad.y - 130 * u) { const n = carry; carry = 0; saved += n; rescuedTotal += n; const pts = n * 200 + (n > 1 ? (n - 1) * 100 : 0); score += pts; fuel = Math.min(100, fuel + 22 * n); parts.push({ txt: '+' + pts, x: pad.x, y: pad.y - 80 * u, age: 0, life: 1.2 }); Kit.tone(784, 0.12, 'triangle', 0.22); Kit.tone(1046, 0.2, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); for (let i = 0; i < 14; i++) parts.push({ x: pad.x, y: pad.y - 30, vx: rnd(-100, 100), vy: rnd(-180, -30), age: 0, life: rnd(0.4, 0.9), r: rnd(2, 4), cc: '#ffe066' }); syncHud(); if (saved >= goal) { state = 'clear'; stateT = 0; const b = 500 + Math.round(fuel) * 5; score += b; parts.push({ txt: 'Stage clear! +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.8 }); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.15 : 0); syncHud(); } }
    /* hazards */
    birdT -= dt; if (birdT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; birds.push({ x: dir > 0 ? -30 : W + 30, y: rnd(130, gy - 90 * u), vx: dir * (90 + stage * 18) * u, ph: 0 }); birdT = Math.max(1.4, 5 - stage * 0.5) * rnd(0.7, 1.2); }
    birds.forEach(b => { b.x += b.vx * dt; b.ph += dt * 12; if (Math.hypot(b.x - heli.x, b.y - heli.y) < 26 * u) { hurt('Bird strike!'); b.x = -999; } }); birds = birds.filter(b => b.x > -100 && b.x < W + 100);
    if (stage >= 3) { boltT -= dt; if (boltT <= 0) { bolts.push({ x: clamp(heli.x + rnd(-120, 120), 30, W - 30), t: 0 }); boltT = Math.max(2.2, 6 - stage * 0.5); } bolts.forEach(b => { b.t += dt; if (b.t > 0.9 && b.t < 1.15 && Math.abs(heli.x - b.x) < 24 * u) { hurt('Lightning!'); b.t = 2; } }); bolts = bolts.filter(b => b.t < 1.3); }
    if (stage >= 4) { gust.next -= dt; if (gust.next <= 0 && gust.t <= 0) { gust.t = 3; gust.v = (Math.random() < 0.5 ? -1 : 1) * (50 + stage * 6) * u; gust.next = rnd(6, 10); parts.push({ txt: 'Gust!', x: W / 2, y: H * 0.3, age: 0, life: 1.2 }); } if (gust.t > 0) { gust.t -= dt; if (gust.t <= 0) gust.v = 0; } }
    $('crowdFill').style.width = clamp(fuel, 0, 100) + '%';
  }

  function drawHeli() {
    ctx.save(); ctx.translate(heli.x, heli.y); ctx.rotate(heli.tilt + (state === 'crash' ? heli.tilt : 0)); if (invul > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.5; const s = u;
    ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.roundRect(-52 * s, -8 * s, 48 * s, 9 * s, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8433a'; ctx.beginPath(); ctx.roundRect(-58 * s, -22 * s, 12 * s, 24 * s, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8433a'; ctx.beginPath(); ctx.ellipse(0, 0, 34 * s, 22 * s, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 6 * s, 30 * s, 8 * s, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#a8ddff'; ctx.beginPath(); ctx.ellipse(10 * s, -4 * s, 20 * s, 15 * s, 0, 0, TAU); ctx.fill(); ctx.stroke(); Heroes.draw(ctx, 'pilot', 11 * s, 11 * s, 0.26 * s, { look: 1 });
    ctx.strokeStyle = '#14141e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18 * s, 22 * s); ctx.lineTo(24 * s, 22 * s); ctx.moveTo(-10 * s, 14 * s); ctx.lineTo(-10 * s, 22 * s); ctx.moveTo(14 * s, 14 * s); ctx.lineTo(14 * s, 22 * s); ctx.stroke();
    ctx.fillStyle = '#14141e'; ctx.fillRect(-2 * s, -26 * s, 4 * s, 6 * s); const ph = t * 40; ctx.fillStyle = 'rgba(40,40,60,.7)'; ctx.beginPath(); ctx.ellipse(0, -28 * s, Math.abs(Math.cos(ph)) * 64 * s + 6, 3 * s, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function render() {
    const T = th(), g = ctx.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 6);
    /* clouds */
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 5; i++) { const cx = ((i * 140 + t * 8 * (1 + i * 0.3)) % (W + 160)) - 80, cy = 110 + i * 50; ctx.beginPath(); ctx.ellipse(cx, cy, 42 * u, 12 * u, 0, 0, TAU); ctx.ellipse(cx + 22 * u, cy - 6, 28 * u, 11 * u, 0, 0, TAU); ctx.fill(); }
    if (T.fire) { ctx.fillStyle = 'rgba(255,120,30,.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); const fx = i * W / 5, fh = 40 + 30 * Math.sin(t * 5 + i); ctx.moveTo(fx - 26, gy); ctx.quadraticCurveTo(fx, gy - fh * 2.4, fx + 26, gy); ctx.fill(); } }
    /* ground */
    const gg = ctx.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, T.gnd); gg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = T.gnd; ctx.fillRect(0, gy, W, H - gy); if (T.water) { ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 8; i++) ctx.fillRect(((i * 60 + t * 20) % W), gy + 6 + (i % 3) * 6, 26, 2); }
    /* platforms */
    plats.forEach(p => { const x = p.x - p.w / 2; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 3, p.y + 4, p.w, gy - p.y); const pg = ctx.createLinearGradient(x, 0, x + p.w, 0); pg.addColorStop(0, T.plat[0]); pg.addColorStop(1, T.plat[1]); ctx.fillStyle = pg; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.4; if (T.kind === 'roof') { ctx.fillRect(x, p.y, p.w, gy - p.y); ctx.strokeRect(x, p.y, p.w, gy - p.y); ctx.fillStyle = '#c8b898'; ctx.fillRect(x - 5, p.y - 6, p.w + 10, 8); ctx.fillStyle = 'rgba(255,240,170,.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 8 + k * 24 * u, p.y + 18, 12 * u, 14 * u); } else { ctx.beginPath(); ctx.moveTo(x - 10, gy); ctx.lineTo(x + 8, p.y + 10); ctx.lineTo(x + p.w - 8, p.y + 10); ctx.lineTo(x + p.w + 10, gy); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = T.snow || T.kind === 'ice' ? '#fff' : 'rgba(255,255,255,.12)'; ctx.fillRect(x + 4, p.y + 4, p.w - 8, 8); } });
    /* pad */
    ctx.fillStyle = '#4a4e5c'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(pad.x - 44 * u, pad.y - 8, 88 * u, 14 * u, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffcf4a'; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('H', pad.x, pad.y + 2); if (carry > 0) { ctx.strokeStyle = 'rgba(255,230,90,' + (0.5 + 0.5 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(pad.x, pad.y - 4, 52 * u, 12 * u, 0, 0, TAU); ctx.stroke(); }
    /* survivors */
    surv.forEach(s => { const x = s.x, y = s.state === 'up' ? s.y2 : s.y, wave = Math.sin(t * 8 + s.ph); ctx.save(); ctx.translate(x, y); const k = u * 0.9; ctx.fillStyle = '#ff8a2a'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-7 * k, -22 * k, 14 * k, 20 * k, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f2c08a'; ctx.beginPath(); ctx.arc(0, -29 * k, 7 * k, 0, TAU); ctx.fill(); ctx.stroke(); Heroes.eye(ctx, -2.5 * k, -30 * k, 2 * k, {}); Heroes.eye(ctx, 2.5 * k, -30 * k, 2 * k, {}); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(7 * k, -20 * k); ctx.lineTo(14 * k, (-34 - wave * 5) * k); ctx.moveTo(-7 * k, -20 * k); ctx.lineTo(-14 * k, (-34 + wave * 5) * k); ctx.stroke(); ctx.restore();
      if (s.state === 'wait') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(x - 18, y + 6, 36, 5, 2); ctx.fill(); ctx.fillStyle = s.patience < 8 ? '#ff5a4a' : '#7dea8a'; ctx.beginPath(); ctx.roundRect(x - 18, y + 6, Math.max(3, 36 * s.patience / 34), 5, 2); ctx.fill(); if (s.patience < 8) { ctx.fillStyle = '#ff5a4a'; ctx.font = '700 ' + Math.round(18 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HELP!', x, y - 48 * u); } if (s.prog > 0) { ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(heli.x, heli.y + 20 * u); ctx.lineTo(x, heli.y + 20 * u + (y - 30 * u - heli.y - 20 * u) * s.prog); ctx.stroke(); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.5; ctx.stroke(); } }
      else if (s.state === 'up') { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(heli.x, heli.y + 20 * u); ctx.lineTo(x, y2c(s)); ctx.stroke(); } });
    function y2c(s) { return s.y2 - 30 * u; }
    /* hazards */
    birds.forEach(b => { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(Math.sign(b.vx) * u, u); ctx.fillStyle = '#2a2e3c'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, TAU); ctx.fill(); const w = Math.sin(b.ph) * 12; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-8, -16 - w, -18, -10 - w); ctx.quadraticCurveTo(-8, -6, 0, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffb02a'; ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(18, 1); ctx.lineTo(10, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -2, 2, 0, TAU); ctx.fill(); ctx.restore(); });
    bolts.forEach(b => { if (b.t < 0.9) { ctx.strokeStyle = 'rgba(255,230,90,' + (0.3 + 0.3 * Math.sin(b.t * 30)) + ')'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(b.x, 100); ctx.lineTo(b.x, gy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,230,90,.3)'; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', b.x, 130); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#ffe566'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(b.x, 90); for (let y = 90; y < gy; y += 40) ctx.lineTo(b.x + rnd(-14, 14), y + 40); ctx.stroke(); ctx.shadowBlur = 0; } });
    if (gust.t > 0) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const y = 130 + i * 50, x = ((t * gust.v * 3 + i * 97) % W + W) % W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(gust.v) * 40, y); ctx.stroke(); } }
    drawHeli();
    if (T.rain) { ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 1.4; for (let i = 0; i < 50; i++) { const x = (i * 71 + t * 90) % W, y = (i * 53 + t * 560) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke(); } }
    if (T.snow) { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 71 + Math.sin(t + i) * 20) % W, (i * 53 + t * 60) % H, 2.4, 0, TAU); ctx.fill(); } }
    if (T.ash) { ctx.fillStyle = 'rgba(255,170,90,.7)'; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc((i * 83 + Math.sin(t + i) * 16) % W, H - ((i * 47 + t * 50) % H), 1.8, 0, TAU); ctx.fill(); } }
    ctx.restore();
    parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(26 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = q.cc; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (mode === 'play' && target === null && stageT < 6) { ctx.font = '700 ' + Math.round(16 * u + 1) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; ctx.strokeText('Drag to fly. Hover over survivors.', W / 2, H * 0.3); ctx.fillText('Drag to fly. Hover over survivors.', W / 2, H * 0.3); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Helicopter down!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('People rescued', rescuedTotal) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'pilot', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; hp = 3; rescuedTotal = 0; lost = 0; parts = []; gust = { v: 0, t: 0, next: 8 }; mode = 'play'; state = 'play'; stageT = 0; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); buildStage(); Kit.banner('Stage 1', th().name); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; target = null; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const cv = $('game'); const setT = e => { target = { x: e.clientX, y: e.clientY - 70 * u }; };
  cv.addEventListener('pointerdown', e => { if (mode === 'play') { Kit.ac(); setT(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); } }); cv.addEventListener('pointermove', e => { if (target && e.buttons !== 0 || (target && e.pointerType === 'touch')) setT(e); });
  const up = () => { target = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__air = { get state() { return { mode, stage, score, hp, fuel, carry, saved, goal, state, heli: [heli.x, heli.y], surv: surv.map(s => ({ x: s.x, y: s.y, st: s.state })), pad }; }, fly(x, y) { target = { x, y }; }, setStage(n) { stage = n; buildStage(); state = 'play'; } };
})();
