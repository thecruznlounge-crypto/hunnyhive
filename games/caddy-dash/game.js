/* Caddy Dash - carry the bag, dodge the course. */
(function () {
  'use strict';
  Kit.ns('caddy-dash');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let W, H, u, hz, py, laneW;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); hz = H * 0.34; py = H * 0.82; laneW = W * 0.27; }
  S.onresize = layout; layout();

  const ZFAR = 16;
  let mode = 'title', t = 0, lane = 0, laneX = 0, jumpT = -1, slideT = -1, objs = [], speed = 4, dist = 0, balls = 0, lives = 3, inv = 0, spawnZ = 0, parts = [], shake = 0, stripe = 0, floats = [], dead = false, deadT = 0;
  const proj = z => 1 / z;
  const sx = (x, z) => W / 2 + x * laneW * proj(z);
  const sy = z => hz + (py - hz) * proj(z);

  function reset() { stage = 1; stageFlash = 0; lane = 0; laneX = 0; jumpT = -1; slideT = -1; objs = []; speed = 4.2; dist = 0; balls = 0; lives = 3; inv = 0; spawnZ = 6; parts = []; floats = []; dead = false; deadT = 0; sync(); }
  function sync() { $('hudL').textContent = 'S' + stage + ' \u00B7 ' + Math.floor(dist) + ' m'; $('hudC').textContent = '● ' + balls; $('hudR').textContent = '♥'.repeat(Math.max(0, lives)); }
  function spawnRow() {
    const free = Math.floor(Math.random() * 3) - 1, kinds = stage >= 3 ? ['sprinkler', 'gopher', 'branch', 'pond'] : stage >= 2 ? ['sprinkler', 'gopher', 'branch'] : ['sprinkler', 'gopher'];
    const d = clamp(dist / 1300, 0, 1);
    for (let l = -1; l <= 1; l++) {
      if (l === free || Math.random() > 0.35 + 0.4 * d) {
        if (Math.random() < 0.6) objs.push({ k: 'ball', lane: l, z: ZFAR, ph: Math.random() * 6 });
        continue;
      }
      const k = (stage >= 2 && Math.random() < 0.18 + 0.12 * d) ? 'cart' : kinds[Math.floor(Math.random() * kinds.length)];
      objs.push({ k, lane: l, z: ZFAR, ph: Math.random() * 6 });
    }
    if (Math.random() < 0.5) for (let i = 1; i <= 3; i++) objs.push({ k: 'ball', lane: free, z: ZFAR + i * 0.7, ph: i });
  }

  /* input */
  let sx0 = null, sy0 = null;
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); sx0 = e.clientX; sy0 = e.clientY; });
  S.canvas.addEventListener('pointermove', e => { if (sx0 == null) return; const dx = e.clientX - sx0, dy = e.clientY - sy0; if (Math.abs(dx) > 28 || Math.abs(dy) > 28) { gesture(dx, dy); sx0 = e.clientX; sy0 = e.clientY; } });
  const up = () => { sx0 = null; }; S.canvas.addEventListener('pointerup', up); S.canvas.addEventListener('pointercancel', up);
  function gesture(dx, dy) {
    if (mode !== 'play' || dead) return;
    if (Math.abs(dx) > Math.abs(dy)) { lane = clamp(lane + (dx > 0 ? 1 : -1), -1, 1); Kit.tone(420, 0.05, 'triangle', 0.1); }
    else if (dy < 0) { if (jumpT < 0 && slideT < 0) { jumpT = 0; Kit.tone(500, 0.12, 'triangle', 0.15, 250); } }
    else { if (slideT < 0) { slideT = 0; jumpT = -1; Kit.noise(0.1, 0.08, null, 800); } }
  }
  window.addEventListener('keydown', e => { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (m) gesture(m[0] * 40, m[1] * 40); });

  const JH = 0.75, SL = 0.6;
  function jumpH() { if (jumpT < 0) return 0; const k = jumpT / JH; return Math.sin(k * Math.PI) * 120 * u; }
  function hit(o) {
    if (inv > 0) return; lives--; inv = 1.6; shake = 0.6; Kit.vibe(40); Kit.tone(150, 0.3, 'sawtooth', 0.2, -60); Kit.noise(0.2, 0.15, null, 500);
    for (let i = 0; i < 12; i++) parts.push({ x: W / 2 + laneX * laneW, y: py - 50 * u, vx: rnd(-150, 150), vy: rnd(-300, -50), age: 0, life: 0.8, c: '#fff' });
    balls = Math.max(0, balls - 3); sync(); if (lives <= 0) { dead = true; deadT = 0; }
  }
  function update(dt) {
    shake = Math.max(0, shake - dt * 2); if (mode !== 'play') return;
    laneX += (lane - laneX) * Math.min(1, dt * 14);
    if (jumpT >= 0) { jumpT += dt; if (jumpT > JH) jumpT = -1; } if (slideT >= 0) { slideT += dt; if (slideT > SL) slideT = -1; }
    inv = Math.max(0, inv - dt);
    if (dead) { deadT += dt; if (deadT > 1.0) finish(); return; }
    speed = Math.min(12, speed + dt * 0.08); dist += speed * dt * 2.2; stageFlash = Math.max(0, stageFlash - dt * 2); if (dist >= stage * STAGE_LEN) { stage++; stageFlash = 0.8; speed = Math.max(speed - 0.8, 4.2); if (lives < 3) lives++; Kit.banner('Stage ' + stage, TH().name); Kit.tone(660, 0.2, 'triangle', 0.2, 300); } stripe = (stripe + speed * dt) % 2.2;
    spawnZ -= speed * dt; if (spawnZ <= 0) { spawnRow(); spawnZ = rnd(5.5, 8) - dist / 400; if (spawnZ < 3.2) spawnZ = 3.2; }
    const jh = jumpH();
    objs.forEach(o => {
      o.z -= speed * dt;
      if (o.done) return;
      if (o.z < 1.12 && o.z > 0.8 && Math.abs(o.lane - laneX) < 0.55) {
        if (o.k === 'ball') { o.done = true; balls++; score(); Kit.tone(900 + (balls % 5) * 80, 0.08, 'triangle', 0.14); floats.push({ x: sx(o.lane, 1), y: py - 80 * u, txt: '+1', age: 0 }); }
        else if ((o.k === 'sprinkler' || o.k === 'gopher' || o.k === 'pond') && jh < 42 * u) { o.done = true; hit(o); }
        else if (o.k === 'branch' && slideT < 0) { o.done = true; hit(o); }
        else if (o.k === 'cart') { o.done = true; hit(o); }
      }
    });
    objs = objs.filter(o => o.z > 0.4 && !(o.done && o.k === 'ball'));
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 0.8) floats.splice(i, 1); }
    sync();
  }
  function score() { return Math.floor(dist) + balls * 5; }
  function finish() {
    mode = 'over'; const sc = score(), nb = sc > Kit.get('best', 0); if (nb) Kit.set('best', sc);
    $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Bag dropped!';
    $('resStats').innerHTML = row('Score', sc, nb) + row('Stage', stage) + row('Distance', Math.floor(dist) + ' m') + row('Balls', balls) + row('Best', Math.max(sc, Kit.get('best', 0)));
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Golf.ball(g, cw / 2, ch / 2, Math.min(cw, ch) * 0.38, { mood: 'dizzy' }); Kit.show('over');
  }

  /* draw */
  function drawObj(o) {
    const d = proj(o.z), x = sx(o.lane, o.z), y = sy(o.z), s = d * u;
    if (d < 0.05) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (o.k === 'ball') { const bob = Math.sin(t * 6 + o.ph) * 6; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, TAU); ctx.fill(); Golf.ball(ctx, 0, -26 + bob, 14, { face: false }); }
    else if (o.k === 'sprinkler') { ctx.fillStyle = '#777'; ctx.beginPath(); ctx.roundRect(-14, -22, 28, 22, 5); ctx.fill(); ctx.fillStyle = '#444'; ctx.fillRect(-6, -34, 12, 12); ctx.strokeStyle = 'rgba(120,200,255,.8)'; ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(i * 24, -70 - Math.sin(t * 10 + i) * 4, i * 40, -20); ctx.stroke(); } }
    else if (o.k === 'gopher') { ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 14, 0, Math.PI, TAU); ctx.fill(); const up = Math.max(0, Math.sin(t * 3 + o.ph)) * 18; ctx.fillStyle = '#b07a4a'; ctx.beginPath(); ctx.arc(0, -12 - up * 0.3, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-7, -16 - up * 0.3, 3, 5); ctx.fillRect(4, -16 - up * 0.3, 3, 5); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -8 - up * 0.3, 6, 5); }
    else if (o.k === 'branch') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-60, -118, 120, 14); ctx.fillStyle = '#2c9a45'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 24, -104, 17, 0, TAU); ctx.fill(); } ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.stroke(); }
    else if (o.k === 'pond') { const gr = ctx.createLinearGradient(0, -22, 0, 4); gr.addColorStop(0, '#8fe0ff'); gr.addColorStop(1, '#2f86d0'); ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.ellipse(0, -4, 62, 20, 0, 0, TAU); ctx.fill(); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, -5, 56, 16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.sin(t * 3) * 8, -6, 18, 5, 0, 0, TAU); ctx.stroke(); }
    else if (o.k === 'cart') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 48, 10, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.roundRect(-44, -48, 88, 40, 8); ctx.fill(); ctx.fillStyle = '#2a8a40'; ctx.fillRect(-40, -78, 80, 8); ctx.fillRect(-38, -78, 4, 32); ctx.fillRect(34, -78, 4, 32); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-30, -8, 11, 0, TAU); ctx.arc(30, -8, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe066'; ctx.fillRect(-30, -40, 12, 8); ctx.fillRect(18, -40, 12, 8); }
    ctx.restore();
  }
  function drawCaddy(x, y) {
    const run = t * 12, jh = jumpH(), sl = slideT >= 0 ? Math.sin(slideT / SL * Math.PI) : 0; if (inv > 0 && Math.floor(t * 20) % 2) return;
    ctx.save(); ctx.translate(x, y - jh); ctx.scale(u, u * (1 - sl * 0.45)); if (dead) ctx.rotate(Math.min(1.4, deadT * 2));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, jh / u, 30, 8, 0, 0, TAU); ctx.fill();
    const lg = jh > 0 ? 0 : Math.sin(run) * 12;
    ctx.strokeStyle = '#2a4b8a'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, -44); ctx.lineTo(-9 + lg, -4); ctx.moveTo(9, -44); ctx.lineTo(9 - lg, -4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-9 + lg, -2, 8, 4, 0, 0, TAU); ctx.ellipse(9 - lg, -2, 8, 4, 0, 0, TAU); ctx.fill();
    Golf.bag(ctx, 0, -48, 1.3, Math.sin(run) * 0.04);
    ctx.fillStyle = '#ffb454'; ctx.beginPath(); ctx.roundRect(-20, -98, 40, 56, 14); ctx.fill(); ctx.fillStyle = '#2fa84a'; ctx.beginPath(); ctx.roundRect(-20, -98, 40, 24, 12); ctx.fill();
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-18, -88); ctx.lineTo(-30, -62 + Math.sin(run) * 6); ctx.moveTo(18, -88); ctx.lineTo(30, -62 - Math.sin(run) * 6); ctx.stroke();
    ctx.fillStyle = '#ffd2a8'; ctx.beginPath(); ctx.arc(0, -116, 17, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -120, 17, Math.PI, TAU); ctx.fill(); ctx.fillRect(-17, -122, 34, 5); ctx.fillStyle = '#2fa84a'; ctx.fillRect(-20, -124, 40, 4);
    ctx.restore();
  }
  const THEMES = [
    { name: 'Sunny Meadow', sky: ['#4aa3ff', '#cdeeff'], hill: ['#9ad88b', '#6cbf6a'], fair: ['#4cc15f', '#43b259'], rough: '#2c8a40', deco: 'oak', night: false },
    { name: 'Dune Links', sky: ['#ff9d5c', '#ffe2a8'], hill: ['#e9b476', '#d49a5a'], fair: ['#7ac060', '#6cb258'], rough: '#d1a060', deco: 'cactus', night: false },
    { name: 'Seaside Cliffs', sky: ['#3d8fe0', '#c4ecff'], hill: ['#7fc6d8', '#4fa3c4'], fair: ['#55c46a', '#49b45e'], rough: '#e8d8a0', deco: 'palm', night: false },
    { name: 'Frost Fairway', sky: ['#7fa9d8', '#eaf6ff'], hill: ['#dfeef8', '#bcd8ea'], fair: ['#9ad6b0', '#8ccaa4'], rough: '#f0f8fc', deco: 'pine', night: false },
    { name: 'Midnight Neon', sky: ['#0a0f3a', '#5a2f8a'], hill: ['#2b2060', '#1c1650'], fair: ['#2fae8a', '#27a081'], rough: '#14403f', deco: 'lamp', night: true }
  ];
  const STAGE_LEN = 260; let stage = 1, stageFlash = 0;
  const TH = () => THEMES[(stage - 1) % THEMES.length];
  function deco(kind, x, y, s) {
    const c = ctx;
    if (kind === 'oak') { c.fillStyle = '#6b4423'; c.fillRect(x - s * 0.07, y - s * 0.45, s * 0.14, s * 0.45); [['#1d6e32', 0, -0.62, 0.34], ['#2c9a45', -0.18, -0.5, 0.26], ['#2c9a45', 0.18, -0.5, 0.26], ['#3cb258', 0.02, -0.8, 0.24]].forEach(a => { c.fillStyle = a[0]; c.beginPath(); c.arc(x + a[1] * s, y + a[2] * s, a[3] * s, 0, TAU); c.fill(); }); }
    else if (kind === 'cactus') { c.fillStyle = '#3a8f4a'; c.beginPath(); c.roundRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 0.7, s * 0.08); c.fill(); c.beginPath(); c.roundRect(x - s * 0.3, y - s * 0.5, s * 0.1, s * 0.3, s * 0.05); c.fill(); c.fillRect(x - s * 0.3, y - s * 0.26, s * 0.24, s * 0.08); c.beginPath(); c.roundRect(x + s * 0.2, y - s * 0.58, s * 0.1, s * 0.3, s * 0.05); c.fill(); c.fillRect(x + s * 0.06, y - s * 0.34, s * 0.24, s * 0.08); c.fillStyle = '#ff7a9a'; c.beginPath(); c.arc(x, y - s * 0.72, s * 0.05, 0, TAU); c.fill(); }
    else if (kind === 'palm') { c.strokeStyle = '#8a5a30'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.12, y - s * 0.4, x + s * 0.05, y - s * 0.8); c.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; c.strokeStyle = i % 2 ? '#2f9a4c' : '#46b862'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x + s * 0.05, y - s * 0.8); c.quadraticCurveTo(x + s * 0.05 + Math.cos(a) * s * 0.3, y - s * 0.8 + Math.sin(a) * s * 0.3 - s * 0.1, x + s * 0.05 + Math.cos(a) * s * 0.45, y - s * 0.78 + Math.sin(a) * s * 0.3 + s * 0.15); c.stroke(); } }
    else if (kind === 'pine') { c.fillStyle = '#5a3d20'; c.fillRect(x - s * 0.05, y - s * 0.2, s * 0.1, s * 0.2); [0, 1, 2].forEach(i => { c.fillStyle = i % 2 ? '#2e7a5a' : '#38906a'; c.beginPath(); c.moveTo(x - s * (0.3 - i * 0.07), y - s * (0.2 + i * 0.22)); c.lineTo(x, y - s * (0.55 + i * 0.22)); c.lineTo(x + s * (0.3 - i * 0.07), y - s * (0.2 + i * 0.22)); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * (0.42 + i * 0.22)); c.lineTo(x, y - s * (0.55 + i * 0.22)); c.lineTo(x + s * 0.1, y - s * (0.42 + i * 0.22)); c.fill(); }); }
    else if (kind === 'lamp') { c.fillStyle = '#2a2a50'; c.fillRect(x - s * 0.03, y - s * 0.8, s * 0.06, s * 0.8); const g = c.createRadialGradient(x, y - s * 0.82, 2, x, y - s * 0.82, s * 0.5); g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(1, 'rgba(255,240,160,0)'); c.fillStyle = g; c.fillRect(x - s * 0.5, y - s * 1.3, s, s); c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(x, y - s * 0.82, s * 0.07, 0, TAU); c.fill(); }
  }
  function render() {
    const th = TH(); ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 6);
    const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
    if (th.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t + i)); ctx.fillRect((i * 83) % W, (i * 37) % hz, 2, 2); } ctx.globalAlpha = 1; }
    const sg = ctx.createRadialGradient(W * 0.72, hz * 0.55, 6, W * 0.72, hz * 0.55, 130 * u); sg.addColorStop(0, th.night ? 'rgba(220,220,255,.6)' : 'rgba(255,250,200,.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = th.night ? '#e8e8ff' : '#fffbe0'; ctx.beginPath(); ctx.arc(W * 0.72, hz * 0.55, 26 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (th.night ? 0.15 : 0.75) + ')'; for (let i = 0; i < 4; i++) { const x = ((i * 190 + t * 6) % (W + 160)) - 80, y = 40 * u + (i * 41) % (hz * 0.5); [[0, 0, 22], [20, -6, 18], [-20, -2, 15]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * u, y + c[1] * u, c[2] * u, 0, TAU); ctx.fill(); }); }
    [[th.hill[0], 36, 0.02, 26], [th.hill[1], 22, 0.05, 14]].forEach(([col, a, f, o]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, hz); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, hz - o * u - Math.abs(Math.sin(x * f + 1.5)) * a * u); ctx.lineTo(W, hz); ctx.fill(); });
    ctx.fillStyle = th.rough; ctx.fillRect(0, hz, W, H - hz);
    const wide = laneW * 1.75, edge = laneW * 1.95;
    for (let i = 0; i < 16; i++) {
      const z0 = 0.4 + (i * 1.1 - stripe % 2.2), z1 = z0 + 1.1, y0 = sy(Math.max(0.4, z0)), y1 = sy(Math.max(0.4, z1)); const a = proj(Math.max(0.4, z0)), b2 = proj(Math.max(0.4, z1));
      ctx.fillStyle = (i % 2) ? th.rough : 'rgba(0,0,0,.06)'; ctx.beginPath(); ctx.moveTo(W / 2 - edge * a - 600, y0); ctx.lineTo(W / 2 + edge * a + 600, y0); ctx.lineTo(W / 2 + edge * b2 + 600, y1); ctx.lineTo(W / 2 - edge * b2 - 600, y1); ctx.fill();
      ctx.fillStyle = (i % 2) ? th.fair[0] : th.fair[1]; ctx.beginPath(); ctx.moveTo(W / 2 - wide * a, y0); ctx.lineTo(W / 2 + wide * a, y0); ctx.lineTo(W / 2 + wide * b2, y1); ctx.lineTo(W / 2 - wide * b2, y1); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; [-0.5, 0.5].forEach(l => { ctx.beginPath(); ctx.moveTo(sx(l, 12), sy(12)); ctx.lineTo(sx(l, 0.4), sy(0.4)); ctx.stroke(); });
    const dl = []; for (let i = 0; i < 12; i++) { const z = ((i * 1.4 - (t * speed) % 16.8) % 16.8 + 16.8) % 16.8 + 1; [-1, 1].forEach(s2 => dl.push({ z, s: s2 })); }
    dl.sort((a, b) => b.z - a.z).forEach(d => deco(th.deco, W / 2 + d.s * laneW * 2.4 * proj(d.z), sy(d.z), (th.deco === 'lamp' ? 190 : 120) * u * proj(d.z)));
    const list = objs.slice().sort((a, b) => b.z - a.z); const pz = 1;
    let drawn = false;
    list.forEach(o => { if (!drawn && o.z < pz) { drawCaddy(sx(laneX, 1), py); drawn = true; } drawObj(o); }); if (!drawn) drawCaddy(sx(laneX, 1), py);
    parts.forEach(p => { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    floats.forEach(f => { ctx.globalAlpha = 1 - f.age / 0.8; ctx.font = '700 22px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,60,0,.7)'; ctx.lineWidth = 4; ctx.strokeText(f.txt, f.x, f.y - f.age * 50); ctx.fillText(f.txt, f.x, f.y - f.age * 50); ctx.globalAlpha = 1; });
    if (mode === 'play') { const k = (dist - (stage - 1) * STAGE_LEN) / STAGE_LEN, bw = Math.min(150, W * 0.4); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - bw / 2, 54 * u + 6, bw, 7); ctx.fillStyle = '#ffe066'; ctx.fillRect(W / 2 - bw / 2, 54 * u + 6, bw * clamp(k, 0, 1), 7); }
    if (mode === 'play' && dist < 40) { ctx.font = '700 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,60,0,.7)'; ctx.lineWidth = 4; const m = 'Swipe to dodge: sides, up to jump, down to slide'; ctx.strokeText(m, W / 2, H * 0.46); ctx.fillText(m, W / 2, H * 0.46); }
    if (stageFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + stageFlash * 0.5 + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const k = ((t * 0.6 + i * 0.25) % 1); Golf.ball(c, w * (0.2 + k * 0.6), h * 0.78 - Math.abs(Math.sin(k * Math.PI * 2)) * 14, 12, { face: false }); }
    c.save(); c.translate(w * 0.5, h - 6); c.scale(h / 190, h / 190); Golf.bag(c, 0, -20, 1.8, Math.sin(t * 8) * 0.06); c.restore();
  }
  function start() { mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); reset(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  reset();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.05)); render(); drawTitleArt(); });
  window.__caddy = { get state() { return { mode, dead, dist, balls, lives, lane, stage, objs: objs.map(o => ({ k: o.k, lane: o.lane, z: o.z })) }; }, gesture };
})();
