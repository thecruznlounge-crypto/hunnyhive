/* Tee Launch - long drive stages. */
(function () {
  'use strict';
  Kit.ns('tee-launch');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  let W, H, u, gy;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); gy = H * 0.6; }
  S.onresize = layout; layout();

  const THEMES = [
    { name: 'Sunny Meadow', sky: ['#4aa3ff', '#bfe6ff'], hill: ['#9ad88b', '#6cbf6a'], fair: ['#4cc15f', '#3fae55'], rough: '#2c8a40', deco: 'oak', sun: '#fff6c0', clouds: 0.9 },
    { name: 'Dune Links', sky: ['#ff9d5c', '#ffe2a8'], hill: ['#e9b476', '#d49a5a'], fair: ['#7ac060', '#69ae52'], rough: '#c8934f', deco: 'cactus', sun: '#fffbe0', clouds: 0.3 },
    { name: 'Seaside Cliffs', sky: ['#3d8fe0', '#c4ecff'], hill: ['#7fc6d8', '#4fa3c4'], fair: ['#55c46a', '#47b25c'], rough: '#2f8f5a', deco: 'palm', sun: '#fffbd8', clouds: 0.7, sea: true },
    { name: 'Frost Fairway', sky: ['#7fa9d8', '#eaf6ff'], hill: ['#dfeef8', '#bcd8ea'], fair: ['#9ad6b0', '#86c8a0'], rough: '#e8f4fb', deco: 'pine', sun: '#ffffff', clouds: 0.8, snow: true },
    { name: 'Midnight Neon', sky: ['#0a0f3a', '#5a2f8a'], hill: ['#2b2060', '#1c1650'], fair: ['#2fae8a', '#25997a'], rough: '#14403f', deco: 'lamp', sun: '#e8e8ff', clouds: 0.2, night: true }
  ];
  const TOTALD = 3;
  let mode = 'title', t = 0, stage = 1, drive = 1, total = 0, st = 'idle', mt = 0, power = 0, acc = 0, wind = { s: 0, a: 1, cross: 0 }, ball = null, camX = 0, msg = null, swingT = 0, results = [], zone = { a: 200, b: 250 }, trail = [], shake = 0, haz = [], parts = [], score = 0, bestStage = 0, hitFx = 0, clouds = [], stars = [];
  const PX = 1.25, PY = 2.6;
  const TH = () => THEMES[(stage - 1) % THEMES.length];
  const target = () => 470 + stage * 70;
  function pw() { return 0.5 - 0.5 * Math.cos(mt * TAU / Math.max(0.8, 1.25 - stage * 0.03)); }
  function ac() { return Math.sin(mt * TAU / Math.max(0.5, 0.95 - stage * 0.04 - drive * 0.02)); }
  for (let i = 0; i < 8; i++) clouds.push({ x: Math.random() * 1000, y: Math.random() * 0.35, s: rnd(0.6, 1.4), v: rnd(3, 9) });
  for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.5, p: Math.random() * 6 });

  function genHaz() {
    haz = []; if (stage < 2) return;
    const n = Math.min(3, 1 + Math.floor(stage / 2));
    let x = rnd(120, 190);
    for (let i = 0; i < n; i++) { const w = rnd(28, 52); haz.push({ a: x, b: x + w, k: (i + stage) % 3 === 0 ? 'sand' : 'water' }); x += w + rnd(50, 110); }
  }
  function hazAt(x) { for (const h of haz) if (x >= h.a && x <= h.b) return h; return null; }
  function startStage() { drive = 1; total = 0; results = []; genHaz(); newDrive(true); Kit.banner('Stage ' + stage, TH().name); }
  function newDrive(first) {
    st = 'idle'; ball = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, lat: 0, air: true, bounces: 0, firstLand: null }; camX = 0; trail = []; msg = null; parts = [];
    const s = rnd(0, 4 + stage * 2.4); wind = { s, a: Math.random() < 0.5 ? -1 : 1, cross: rnd(-1, 1) };
    const z0 = rnd(190, 270); zone = { a: z0, b: z0 + 40 };
    $('bSwing').disabled = false; setBtn('SWING', 'TAP TO START'); sync();
  }
  function setBtn(a, b) { $('bSwing').innerHTML = a + '<small>' + b + '</small>'; }
  function sync() { $('hudL').textContent = 'Stage ' + stage + ' · ' + drive + '/' + TOTALD; $('hudC').textContent = total + '/' + target(); $('hudR').textContent = wind.s < 0.5 ? 'Calm' : (wind.a > 0 ? '→ ' : '← ') + Math.round(wind.s) + ' mph'; }

  function tap() {
    if (mode !== 'play') return; Kit.ac();
    if (st === 'idle') { st = 'power'; mt = 0; setBtn('POWER', 'TAP AT THE PEAK'); Kit.tone(500, 0.06, 'triangle', 0.15); }
    else if (st === 'power') { power = pw(); st = 'acc'; mt = 0; setBtn('SNAP', 'TAP IN THE MIDDLE'); Kit.tone(620, 0.06, 'triangle', 0.15); }
    else if (st === 'acc') { acc = ac(); st = 'swing'; swingT = 0; setBtn('...', ''); $('bSwing').disabled = true; Kit.tone(300, 0.1, 'sawtooth', 0.15, 200); }
  }
  const sw = $('bSwing');
  sw.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
  window.addEventListener('keydown', e => { if (e.code === 'Space') tap(); });

  function launch() {
    const crit = power > 0.93, p = power;
    const v = 0.8 * (34 + p * 38) * (1 - Math.abs(acc) * 0.06) * (crit ? 1.04 : 1), ang = 0.30 + (1 - p) * 0.05;
    ball.vx = v * Math.cos(ang); ball.vy = v * Math.sin(ang); ball.air = true; ball.hit = { crit, perfectAcc: Math.abs(acc) < 0.12, p, acc }; ball.flight = 0; st = 'fly'; shake = 0.4; hitFx = 0.3;
    for (let i = 0; i < 14; i++) parts.push({ x: 0, y: 2, vx: rnd(5, 40), vy: rnd(5, 30), age: 0, life: rnd(0.4, 0.9), c: 'g' });
    Kit.noise(0.12, 0.2, null, 3000); Kit.tone(900, 0.1, 'triangle', 0.2, 300); Kit.vibe(25);
  }
  function splash(x) { for (let i = 0; i < 22; i++) parts.push({ x, y: 0, vx: rnd(-14, 14), vy: rnd(10, 40), age: 0, life: rnd(0.5, 1), c: 'w' }); Kit.noise(0.25, 0.2, null, 900); }
  function stepBall(dt) {
    const b = ball, wy = wind.a * wind.s * 0.28;
    if (b.air) {
      b.flight += dt; b.vx += (wy - b.vx * 0.0144) * dt - b.vx * 0.006 * dt; b.vy -= 9.8 * dt; b.vy *= (1 - 0.01 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vx * dt * 0.3; b.lat += (acc * 7 + wind.cross * wind.s * 0.9) * dt * (b.flight < 3.5 ? 1 : 0.2);
      if (b.y <= 0) {
        b.y = 0; if (b.firstLand == null) { b.firstLand = b.x; }
        const h = hazAt(b.x), rough = Math.abs(b.lat) > 16, trees = Math.abs(b.lat) > 30;
        if (h && h.k === 'water') { b.vx = 0; b.vy = 0; b.air = false; b.water = true; splash(b.x); }
        else if (trees) { b.vx = 0; b.vy = 0; b.air = false; b.trees = true; }
        else if (h && h.k === 'sand') { b.vx *= 0.15; b.vy = 0; b.air = false; b.rollv = b.vx; b.sand = true; for (let i = 0; i < 12; i++) parts.push({ x: b.x, y: 0, vx: rnd(-10, 10), vy: rnd(5, 25), age: 0, life: 0.7, c: 's' }); }
        else if (b.vy < -3.2 && b.bounces < 4) { b.vy = -b.vy * (rough ? 0.22 : 0.42); b.vx *= rough ? 0.45 : 0.68; b.bounces++; Kit.tone(160, 0.06, 'sine', 0.12); }
        else { b.air = false; b.rollv = b.vx; b.rough = rough; }
      }
    } else if (!b.stopped && !b.water && !b.trees) {
      b.rollv = Math.max(0, b.rollv - (b.rough ? 18 : 7) * dt - b.rollv * (b.rough ? 1.2 : 0.35) * dt); b.x += b.rollv * dt; b.rot += b.rollv * dt * 0.8;
      const h = hazAt(b.x); if (h && h.k === 'water' && b.rollv > 0) { b.water = true; splash(b.x); } else if (h && h.k === 'sand') b.rollv *= (1 - 4 * dt);
      if (b.rollv < 0.4) b.stopped = true;
    }
    trail.push({ x: b.x, y: b.y }); if (trail.length > 90) trail.shift();
    return b.stopped || b.trees || b.water;
  }
  function finishDrive() {
    const b = ball; let yd = Math.max(0, Math.round(b.x)), bonus = 0, notes = [];
    if (b.hit.crit) notes.push('Power!'); if (b.hit.perfectAcc) { bonus += 12; notes.push('Pure!'); }
    if (!b.water && b.firstLand >= zone.a && b.firstLand <= zone.b) { bonus += 30; notes.push('Zone +30'); }
    if (b.water) { yd = Math.round(yd * 0.5); bonus = 0; notes = ['Splash! Water hazard']; } else if (b.trees) { yd = Math.round(yd * 0.7); notes.push('In the trees!'); } else if (b.sand) notes.push('Bunker'); else if (b.rough) notes.push('Rough'); else notes.push('Fairway');
    const gain = yd + bonus; total += gain; results.push(gain); msg = { yd, text: notes.join('  '), age: 0 }; st = 'result';
    Kit.banner(yd + ' yards', notes[0]); Kit.tone(b.water || b.trees ? 180 : 600, 0.2, 'triangle', 0.2); sync();
    setTimeout(() => {
      if (mode !== 'play') return;
      if (drive >= TOTALD) return endStage();
      drive++; newDrive();
    }, 2000);
  }
  function endStage() {
    if (total >= target()) {
      const margin = total - target(), pts = 200 + stage * 50 + margin; score += pts; bestStage = Math.max(bestStage, stage);
      st = 'stagewin'; Kit.banner('Stage clear!', '+' + pts); Kit.tone(523, 0.15, 'triangle', 0.2); Kit.tone(784, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.12 : 0); Kit.vibe(30);
      setTimeout(() => { if (mode !== 'play') return; stage++; startStage(); }, 2200);
    } else end();
  }
  function end() {
    mode = 'over'; const nb = stage > Kit.get('best', 0); if (nb) Kit.set('best', stage);
    $('hud').classList.remove('show'); $('bSwing').disabled = false;
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb && stage > 1 ? 'New record!' : 'Missed the cut';
    $('resStats').innerHTML = row('Stage reached', stage, nb) + row('Last round', total + ' / ' + target() + ' yd') + row('Score', score.toLocaleString()) + row('Best stage', Math.max(stage, Kit.get('best', 0)));
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Golf.ball(g, cw / 2, ch / 2, Math.min(cw, ch) * 0.38, { mood: 'dizzy' }); Kit.show('over');
  }

  function update(dt) {
    shake = Math.max(0, shake - dt * 2.5); hitFx = Math.max(0, hitFx - dt);
    clouds.forEach(c => { c.x += c.v * dt; });
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 60 * dt; }
    if (mode !== 'play') return;
    if (st === 'power' || st === 'acc') mt += dt;
    if (st === 'swing') { swingT += dt; if (swingT > 0.35) launch(); }
    if (st === 'fly') { const d = stepBall(dt); camX += (Math.max(0, ball.x - 60) - camX) * Math.min(1, dt * 4); if (d) { camX = Math.max(0, ball.x - 140); finishDrive(); st = 'result'; } }
    if (msg) msg.age += dt;
  }

  function X(x) { return (x - camX) * PX * u + W * 0.22; }
  function cloud(x, y, s, a) { ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; [[0, 0, 26], [24, -8, 22], [-24, -4, 18], [46, 2, 16], [-44, 4, 14]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * s, y + c[1] * s, c[2] * s, 0, TAU); ctx.fill(); }); ctx.fillRect(x - 44 * s, y, 90 * s, 18 * s); }
  function deco(kind, x, y, s, th) {
    if (kind === 'oak') { ctx.fillStyle = '#6b4423'; ctx.fillRect(x - s * 0.07, y - s * 0.45, s * 0.14, s * 0.45); [['#1d6e32', 0, -0.62, 0.34], ['#2c9a45', -0.18, -0.5, 0.26], ['#2c9a45', 0.18, -0.5, 0.26], ['#3cb258', 0.02, -0.8, 0.24]].forEach(a => { ctx.fillStyle = a[0]; ctx.beginPath(); ctx.arc(x + a[1] * s, y + a[2] * s, a[3] * s, 0, TAU); ctx.fill(); }); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(x - 0.08 * s, y - 0.86 * s, 0.1 * s, 0, TAU); ctx.fill(); }
    else if (kind === 'cactus') { ctx.fillStyle = '#3a8f4a'; ctx.beginPath(); ctx.roundRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 0.7, s * 0.08); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - s * 0.3, y - s * 0.5, s * 0.1, s * 0.3, s * 0.05); ctx.fill(); ctx.fillRect(x - s * 0.3, y - s * 0.26, s * 0.24, s * 0.08); ctx.beginPath(); ctx.roundRect(x + s * 0.2, y - s * 0.58, s * 0.1, s * 0.3, s * 0.05); ctx.fill(); ctx.fillRect(x + s * 0.06, y - s * 0.34, s * 0.24, s * 0.08); ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.arc(x, y - s * 0.72, s * 0.05, 0, TAU); ctx.fill(); }
    else if (kind === 'palm') { ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.4, x + s * 0.05, y - s * 0.8); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; ctx.strokeStyle = i % 2 ? '#2f9a4c' : '#46b862'; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(x + s * 0.05, y - s * 0.8); ctx.quadraticCurveTo(x + s * 0.05 + Math.cos(a) * s * 0.3, y - s * 0.8 + Math.sin(a) * s * 0.3 - s * 0.1, x + s * 0.05 + Math.cos(a) * s * 0.45, y - s * 0.78 + Math.sin(a) * s * 0.3 + s * 0.15); ctx.stroke(); } }
    else if (kind === 'pine') { ctx.fillStyle = '#5a3d20'; ctx.fillRect(x - s * 0.05, y - s * 0.2, s * 0.1, s * 0.2); [[0.0, 0.5], [0.15, 0.4], [0.3, 0.3]].forEach((l, i) => { ctx.fillStyle = i % 2 ? '#2e7a5a' : '#38906a'; ctx.beginPath(); ctx.moveTo(x - s * (0.3 - l[0] * 0.5), y - s * (0.2 + i * 0.22)); ctx.lineTo(x, y - s * (0.55 + i * 0.22)); ctx.lineTo(x + s * (0.3 - l[0] * 0.5), y - s * (0.2 + i * 0.22)); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * (0.42 + i * 0.22)); ctx.lineTo(x, y - s * (0.55 + i * 0.22)); ctx.lineTo(x + s * 0.1, y - s * (0.42 + i * 0.22)); ctx.fill(); }); }
    else if (kind === 'lamp') { ctx.fillStyle = '#2a2a50'; ctx.fillRect(x - s * 0.03, y - s * 0.8, s * 0.06, s * 0.8); const g = ctx.createRadialGradient(x, y - s * 0.82, 2, x, y - s * 0.82, s * 0.5); g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(1, 'rgba(255,240,160,0)'); ctx.fillStyle = g; ctx.fillRect(x - s * 0.5, y - s * 1.3, s, s); ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(x, y - s * 0.82, s * 0.07, 0, TAU); ctx.fill(); }
  }
  function backdrop(th) {
    const sk = ctx.createLinearGradient(0, 0, 0, gy); sk.addColorStop(0, th.sky[0]); sk.addColorStop(1, th.sky[1]); ctx.fillStyle = sk; ctx.fillRect(0, 0, W, gy + 4);
    if (th.night) { stars.forEach(s => { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x * W, s.y * gy, 2, 2); }); ctx.globalAlpha = 1; }
    const sx = W * 0.75, sy = gy * 0.3, sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 140 * u); sg.addColorStop(0, th.night ? 'rgba(220,220,255,.5)' : 'rgba(255,250,200,.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, gy);
    ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sx, sy, 28 * u, 0, TAU); ctx.fill();
    if (th.night) { ctx.fillStyle = 'rgba(40,30,90,.5)'; ctx.beginPath(); ctx.arc(sx + 8 * u, sy - 4 * u, 24 * u, 0, TAU); ctx.fill(); }
    clouds.forEach(c => { const x = ((c.x - camX * 0.05) % (W + 200)) - 100; cloud(x, c.y * gy + 20, c.s * u, th.clouds * 0.8); });
    /* far hills */
    [[0.12, th.hill[0], 52, 0.7], [0.3, th.hill[1], 34, 0.45]].forEach(([p, col, amp, k]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, gy); for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, gy - 8 - amp * u * (0.5 + 0.5 * Math.sin((x + camX * p * PX * u) / (110 * u) + p * 9)) * k - 12 * u); ctx.lineTo(W, gy); ctx.fill(); });
    if (th.sea) { const sg2 = ctx.createLinearGradient(0, gy - 40 * u, 0, gy); sg2.addColorStop(0, '#2f86d0'); sg2.addColorStop(1, '#6ac4ee'); ctx.fillStyle = sg2; ctx.fillRect(0, gy - 36 * u, W, 36 * u); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { const yy = gy - 30 * u + (i % 3) * 10 * u, xx = ((i * 97 - camX * 0.3 + t * 8) % (W + 80)) - 40; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 10, yy - 3, xx + 20, yy); ctx.stroke(); } }
    if (th.deco === 'cactus') { ctx.fillStyle = '#c07a4a'; ctx.beginPath(); ctx.moveTo(W * 0.1, gy - 20 * u); ctx.lineTo(W * 0.18, gy - 70 * u); ctx.lineTo(W * 0.3, gy - 70 * u); ctx.lineTo(W * 0.36, gy - 20 * u); ctx.fill(); }
  }
  function ground(th) {
    const g = ctx.createLinearGradient(0, gy, 0, H); g.addColorStop(0, th.fair[0]); g.addColorStop(1, th.fair[1]); ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
    for (let i = -2; i < 60; i++) { const x0 = i * 30; if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(X(x0), gy, 30 * PX * u, H - gy); } }
    ctx.fillStyle = th.rough; ctx.fillRect(0, gy, W, 6 * u); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, gy + 6 * u, W, 4 * u);
    /* grass tufts */
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const x = (((i * 71) - camX * PX * u) % (W + 40) + W + 40) % (W + 40) - 20, y = gy + 20 * u + (i * 37) % (H - gy - 80 * u); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 7); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 8); ctx.stroke(); }
  }
  function drawGolfer(tx, th) {
    const sp = st === 'swing' ? swingT / 0.35 : st === 'acc' ? -0.4 : st === 'power' ? -0.2 * pw() - 0.1 : 0, gx = tx - 34 * u, gh = 70 * u;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(gx + 4 * u, gy + 2, 24 * u, 5 * u, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = 7 * u; ctx.strokeStyle = '#2e3a5c'; ctx.beginPath(); ctx.moveTo(gx + 2 * u, gy - 30 * u); ctx.lineTo(gx - 10 * u, gy - 2); ctx.moveTo(gx + 4 * u, gy - 30 * u); ctx.lineTo(gx + 14 * u, gy - 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(gx - 12 * u, gy - 1, 8 * u, 4 * u, 0, 0, TAU); ctx.ellipse(gx + 16 * u, gy - 1, 8 * u, 4 * u, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.roundRect(gx - 11 * u, gy - gh + 6 * u, 24 * u, 42 * u, 9 * u); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(gx - 9 * u, gy - gh + 16 * u, 20 * u, 4 * u);
    ctx.fillStyle = '#ffd2a8'; ctx.beginPath(); ctx.arc(gx + 1 * u, gy - gh - 5 * u, 10 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + 1 * u, gy - gh - 8 * u, 10.5 * u, Math.PI, TAU); ctx.fill(); ctx.fillRect(gx - 9 * u, gy - gh - 9 * u, 28 * u, 4 * u);
    ctx.fillStyle = '#16202a'; ctx.beginPath(); ctx.arc(gx + 6 * u, gy - gh - 4 * u, 1.5 * u, 0, TAU); ctx.fill();
    const ang = -2.3 + (sp > 0 ? sp * 3.8 : sp * 1.2), hx = gx + 4 * u, hy = gy - gh * 0.72, ex = hx + Math.cos(ang) * 9 * u, ey = hy + Math.sin(ang) * 9 * u;
    ctx.strokeStyle = '#ffd2a8'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(gx + 1 * u, gy - gh + 12 * u); ctx.lineTo(ex, ey); ctx.stroke();
    const tx2 = hx + Math.cos(ang) * 58 * u, ty2 = hy + Math.sin(ang) * 58 * u; ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx2, ty2); ctx.stroke(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(tx2, ty2, 5 * u, 0, TAU); ctx.fill();
  }
  function render() {
    const th = TH(); ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 5, rnd(-1, 1) * shake * 5);
    backdrop(th); 
    for (let i = 0; i < 22; i++) { const wx = i * 58 - camX * 0.55; deco(th.deco, ((wx * PX * u * 0.8) % (W + 240) + W + 240) % (W + 240) - 40, gy - 6, (th.deco === 'lamp' ? 110 : 66) * u, th); }
    ground(th);
    if (mode !== 'title') {
      /* hazards */
      haz.forEach(h => { const x0 = X(h.a), x1 = X(h.b); if (x1 < -10 || x0 > W + 10) return; if (h.k === 'water') { const g = ctx.createLinearGradient(0, gy, 0, gy + 18 * u); g.addColorStop(0, '#5fc8ff'); g.addColorStop(1, '#2a7fd0'); ctx.fillStyle = g; ctx.fillRect(x0, gy + 2 * u, x1 - x0, 16 * u); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x0 + 4, gy + (6 + k * 4) * u); ctx.quadraticCurveTo((x0 + x1) / 2, gy + (3 + k * 4) * u + Math.sin(t * 3 + k) * 2, x1 - 4, gy + (6 + k * 4) * u); ctx.stroke(); } } else { ctx.fillStyle = '#f0d890'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, gy + 6 * u, (x1 - x0) / 2, 9 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(180,140,70,.4)'; for (let k = 0; k < 8; k++) ctx.fillRect(x0 + (k * 13) % (x1 - x0), gy + 4 * u + (k % 3) * 3, 2, 2); } ctx.fillStyle = '#fff'; ctx.font = '700 10px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h.k === 'water' ? 'WATER' : 'BUNKER', (x0 + x1) / 2, gy + 30 * u); });
      ctx.fillStyle = 'rgba(255,224,102,.4)'; ctx.fillRect(X(zone.a), gy, (zone.b - zone.a) * PX * u, 10 * u); ctx.fillStyle = '#ffe066'; ctx.font = '700 11px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BONUS +30', (X(zone.a) + X(zone.b)) / 2, gy + 44 * u);
    }
    ctx.fillStyle = '#fff'; ctx.font = '700 12px Nunito, sans-serif'; ctx.textAlign = 'center';
    for (let y = 50; y <= 450; y += 50) { const x = X(y); if (x < -20 || x > W + 20) continue; ctx.fillRect(x - 1, gy, 2, 14 * u); ctx.fillText(y, x, gy + 32 * u); }
    const tx = X(0); ctx.fillStyle = '#f2b056'; ctx.fillRect(tx - 2, gy - 8 * u, 4, 8 * u); drawGolfer(tx, th);
    if (ball) {
      const g2 = ctx.createLinearGradient(X(trail[0] ? trail[0].x : 0), 0, X(ball.x), 0); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(255,255,255,.7)'); ctx.strokeStyle = g2; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); trail.forEach((p, i) => { const x = X(p.x), y = gy - p.y * PY * u - 7 * u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      const bx = X(ball.x), by = gy - ball.y * PY * u - 7 * u; ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(bx, gy + 3, 7 * u * (1 - Math.min(0.6, ball.y / 80)), 2.4 * u, 0, 0, TAU); ctx.fill();
      if (ball.water) { ctx.globalAlpha = 0.4; }
      Golf.ball(ctx, bx, by, 7.5 * u, { rot: ball.rot, mood: ball.air && st === 'fly' ? 'scared' : ball.trees || ball.water ? 'dizzy' : 'happy' }); ctx.globalAlpha = 1;
    } else { Golf.ball(ctx, tx, gy - 15 * u, 7.5 * u, {}); }
    if (hitFx > 0) { ctx.strokeStyle = 'rgba(255,255,255,' + hitFx * 3 + ')'; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r1 = 10 * u, r2 = (14 + (0.3 - hitFx) * 120) * u; ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * r1, gy - 14 * u + Math.sin(a) * r1); ctx.lineTo(tx + Math.cos(a) * r2, gy - 14 * u + Math.sin(a) * r2); ctx.stroke(); } }
    parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = p.c === 'w' ? '#bfe9ff' : p.c === 's' ? '#e8cf90' : '#7be07b'; ctx.beginPath(); ctx.arc(X(p.x), gy - p.y * PY * u, 3 * u, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    if (st === 'power' || st === 'acc') {
      const mw = Math.min(W - 60, 320), mx = (W - mw) / 2, my = H * 0.2; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(mx - 8, my - 8, mw + 16, 44, 16); ctx.fill();
      ctx.fillStyle = '#26352b'; ctx.beginPath(); ctx.roundRect(mx, my, mw, 28, 10); ctx.fill();
      if (st === 'power') { const g = ctx.createLinearGradient(mx, 0, mx + mw, 0); g.addColorStop(0, '#7be07b'); g.addColorStop(0.7, '#ffe066'); g.addColorStop(1, '#ff5a3a'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(mx, my, Math.max(8, mw * pw()), 28, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw * 0.93 - 2, my - 5, 4, 38); }
      else { ctx.fillStyle = 'rgba(123,224,123,.75)'; ctx.fillRect(mx + mw * 0.44, my, mw * 0.12, 28); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(mx + mw * (0.5 + ac() * 0.5) - 4, my - 5, 8, 38, 4); ctx.fill(); }
    }
    if (mode !== 'title') { const wx = W - 52 * u, wyy = H * 0.15 + 60; ctx.save(); ctx.translate(wx, wyy); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.stroke(); if (wind.s > 0.5) { ctx.scale(wind.a, 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 + wind.s * 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.moveTo(4, -7); ctx.lineTo(12, 0); ctx.lineTo(4, 7); ctx.stroke(); } ctx.restore(); }
    if (mode === 'play') { const bw = Math.min(160, W * 0.4), bx = W / 2 - bw / 2, by = 54 * u + 6; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(bx, by, bw, 7); ctx.fillStyle = total >= target() ? '#ffe066' : '#7be07b'; ctx.fillRect(bx, by, bw * clamp(total / target(), 0, 1), 7); }
    if (msg && st === 'result') { ctx.globalAlpha = Math.min(1, msg.age * 3); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,40,0,.75)'; ctx.lineWidth = 5; ctx.textAlign = 'center'; ctx.font = '700 22px Fredoka, sans-serif'; ctx.strokeText(msg.text, W / 2, H * 0.32); ctx.fillText(msg.text, W / 2, H * 0.32); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const k = (t * 0.5) % 1, bx = w * 0.15 + k * w * 0.7, by = h * 0.8 - Math.sin(k * Math.PI) * h * 0.65;
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.setLineDash([5, 6]); c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 20; i++) { const kk = i / 20, x = w * 0.15 + kk * w * 0.7, y = h * 0.8 - Math.sin(kk * Math.PI) * h * 0.65; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
    Golf.flag(c, w * 0.88, h * 0.82, h * 0.5, t); Golf.ball(c, bx, by, 18, { rot: t * 6, mood: 'scared' });
  }
  function start() { mode = 'play'; stage = 1; score = 0; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); startStage(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  newDrive();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.05)); render(); drawTitleArt(); });
  window.__tee = { get state() { return { mode, st, stage, drive, total, target: target(), pw: pw(), ac: ac(), x: ball && ball.x, results, score }; }, tap, setStage(n) { stage = n; startStage(); } };
})();
