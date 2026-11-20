/* N0N07 - Double NO 7. Sneak in, steal the intel, slip out. */
(function () {
  'use strict';
  Kit.ns('n0n07');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const WW = 360, WH = 600;
  let W, H, K, ox, oy;
  function layout() { W = S.W; H = S.H; K = Math.min(W / WW, (H - 150) / WH); ox = (W - WW * K) / 2; oy = 66 + (H - 150 - WH * K) / 2; }
  S.onresize = layout; layout();

  const THEMES = [
    { name: 'Embassy', floor: ['#2a3350', '#222a44'], wall: ['#7a8cb8', '#4a5680'], line: 'rgba(255,255,255,.04)' },
    { name: 'Casino', floor: ['#4a1a2a', '#3a1422'], wall: ['#d8a84a', '#8a5a1a'], line: 'rgba(255,200,120,.06)' },
    { name: 'Laboratory', floor: ['#1c4a52', '#163a42'], wall: ['#8ae0e8', '#3a8a96'], line: 'rgba(160,255,255,.06)' },
    { name: 'Superyacht', floor: ['#7a5a38', '#6a4c2e'], wall: ['#f2ead8', '#b8a888'], line: 'rgba(0,0,0,.08)' },
    { name: 'Volcano Lair', floor: ['#3a1a14', '#2c120e'], wall: ['#c8604a', '#7a2a1c'], line: 'rgba(255,120,60,.08)' }
  ];
  const LV = [
    { t: 0, start: [40, 560], intel: [310, 320], exit: [320, 54],
      walls: [[0, 400, 230, 14], [130, 220, 230, 14]],
      guards: [{ p: [[50, 480], [320, 480]], v: 38 }, { p: [[320, 150], [50, 150]], v: 38 }], cams: [], lasers: [] },
    { t: 1, start: [330, 560], intel: [60, 104], exit: [322, 44],
      walls: [[100, 480, 260, 14], [0, 330, 260, 14], [100, 180, 260, 14]],
      guards: [{ p: [[30, 540], [330, 540]], v: 40 }, { p: [[30, 405], [330, 405]], v: 42, ph: 0.5 }, { p: [[330, 255], [30, 255]], v: 42 }], cams: [], lasers: [] },
    { t: 2, start: [40, 560], intel: [320, 130], exit: [40, 50],
      walls: [[0, 420, 200, 14], [160, 260, 200, 14]],
      guards: [{ p: [[40, 520], [320, 520]], v: 42 }, { p: [[320, 340], [40, 340]], v: 36 }],
      cams: [{ x: 350, y: 440, c: 3.5, a: 0.7, s: 0.8 }],
      lasers: [{ a: [200, 427], b: [360, 427], on: 1.3, off: 1.4, ph: 0 }, { a: [0, 267], b: [160, 267], on: 1.3, off: 1.4, ph: 1.2 }] },
    { t: 3, start: [40, 560], intel: [300, 240], exit: [40, 40],
      walls: [[180, 100, 14, 300], [0, 300, 120, 14], [250, 420, 110, 14], [60, 150, 120, 14]],
      guards: [{ p: [[60, 490], [300, 490]], v: 44 }, { p: [[240, 60], [330, 60]], v: 36 }, { p: [[100, 380], [100, 200]], v: 40 }],
      cams: [{ x: 345, y: 200, c: 3.4, a: 0.8, s: 0.9 }, { x: 15, y: 100, c: 0.5, a: 0.7, s: 1.0 }], lasers: [] },
    { t: 4, start: [180, 570], intel: [320, 60], exit: [40, 60],
      walls: [[0, 440, 140, 14], [220, 440, 140, 14], [100, 300, 160, 14], [0, 170, 110, 14], [250, 170, 110, 14]],
      guards: [{ p: [[40, 520], [320, 520]], v: 46 }, { p: [[40, 370], [320, 370]], v: 44, ph: 0.4 }, { p: [[40, 110], [320, 110]], v: 40 }],
      cams: [{ x: 180, y: 12, c: 1.57, a: 1.0, s: 0.9 }],
      lasers: [{ a: [140, 447], b: [220, 447], on: 1.2, off: 1.2, ph: 0 }, { a: [110, 177], b: [250, 177], on: 1.2, off: 1.2, ph: 0.6 }] }
  ];

  let mode = 'title', level = 1, score = 0, lives = 3, t = 0, levelT = 0, hasIntel = false, alert = 0, flash = 0, caught = 0, doneT = 0, shake = 0;
  let L, walls, guards, cams, lasers, P, parts = [], joy = null, keys = {};
  const best = () => Kit.get('best', 0);
  const person = Spy.make({ skin: '#e8b88a', coat: '#232838', hair: '#1a1208', hat: 'fedora', glasses: 'shades', stache: false, item: 'none', tie: '#e8433a' });
  const guardLook = Spy.make({ skin: '#c68a58', coat: '#3a3a44', hair: '#1a1208', hat: 'cap', glasses: 'none', stache: true, item: 'none', tie: '#2a2a30' });

  function tier() { return Math.floor((level - 1) / 5); }
  function load() {
    L = LV[(level - 1) % LV.length]; const tr = tier();
    walls = L.walls.concat([[-30, -30, WW + 60, 30], [-30, WH, WW + 60, 30], [-30, 0, 30, WH], [WW, 0, 30, WH]]);
    guards = L.guards.map(g => ({ p: g.p, v: g.v * (1 + tr * 0.12), i: 0, x: g.p[0][0], y: g.p[0][1], dir: 0, hold: 0, wait: g.ph || 0, cone: 118 + tr * 10, half: 0.5 }));
    if (tr > 0) { const g0 = L.guards[0]; guards.push({ p: g0.p.slice().reverse(), v: g0.v * (1 + tr * 0.12), i: 0, x: g0.p[1][0], y: g0.p[1][1] - 20, dir: 0, hold: 0, wait: 0, cone: 118 + tr * 10, half: 0.5 }); guards[guards.length - 1].p = [[g0.p[1][0], g0.p[1][1] - 20], [g0.p[0][0], g0.p[0][1] - 20]]; }
    cams = L.cams.map(c => Object.assign({ range: 140, half: 0.42 }, c));
    lasers = L.lasers.map(l => Object.assign({}, l));
    P = { x: L.start[0], y: L.start[1], vx: 0, vy: 0, face: 1, walk: 0 };
    hasIntel = false; alert = 0; levelT = 0; doneT = 0; caught = 0; joy = null; parts = [];
  }
  function circleRect(px, py, r, w) { const cx = clamp(px, w[0], w[0] + w[2]), cy = clamp(py, w[1], w[1] + w[3]), dx = px - cx, dy = py - cy; return dx * dx + dy * dy < r * r; }
  function hitsWall(x, y, r) { for (const w of walls) if (circleRect(x, y, r, w)) return true; return false; }
  function segRect(x1, y1, x2, y2, w) {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1, p = [-dx, dx, -dy, dy], q = [x1 - w[0], w[0] + w[2] - x1, y1 - w[1], w[1] + w[3] - y1];
    for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; } else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } }
    return true;
  }
  function los(x1, y1, x2, y2) { for (const w of walls) if (segRect(x1, y1, x2, y2, w)) return false; return true; }
  function rayDist(x, y, a, max) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = max;
    for (const w of walls) {
      let tmin = 0, tmax = best, ok = true;
      [[x, dx, w[0], w[0] + w[2]], [y, dy, w[1], w[1] + w[3]]].forEach(s => { if (!ok) return; if (Math.abs(s[1]) < 1e-9) { if (s[0] < s[2] || s[0] > s[3]) ok = false; } else { let a1 = (s[2] - s[0]) / s[1], a2 = (s[3] - s[0]) / s[1]; if (a1 > a2) { const tt = a1; a1 = a2; a2 = tt; } tmin = Math.max(tmin, a1); tmax = Math.min(tmax, a2); if (tmin > tmax) ok = false; } });
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  function sees(sx, sy, dir, half, range) { const dx = P.x - sx, dy = P.y - sy, d = Math.hypot(dx, dy); if (d > range) return false; if (Math.abs(angDiff(Math.atan2(dy, dx), dir)) > half) return false; return los(sx, sy, P.x, P.y); }
  function laserOn(l) { const c = l.on + l.off, k = ((t + (l.ph || 0)) % c); return k < l.on; }

  function say(txt, x, y) { parts.push({ txt, x, y, age: 0, life: 1 }); }
  function burst(x, y, col, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-80, 80), vy: rnd(-90, 20), age: 0, life: rnd(0.4, 0.9), col, r: rnd(1.5, 3) }); }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode !== 'play') { parts.forEach(p => { p.age += dt; }); parts = parts.filter(p => p.age < p.life); return; }
    levelT += dt;
    if (doneT > 0) { doneT += dt; if (doneT > 1.4) { level++; load(); syncHud(); const th = THEMES[L.t]; Kit.banner('Stage ' + level, th.name + (tier() ? ' · Hard' : '')); } return; }
    if (caught > 0) { caught += dt; if (caught > 1.0) { if (lives <= 0) return gameOver(); P.x = L.start[0]; P.y = L.start[1]; alert = 0; caught = 0; } return; }
    /* player */
    let ix = 0, iy = 0;
    if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d > 6) { const m = Math.min(1, d / 46); ix = dx / d * m; iy = dy / d * m; } }
    if (keys.ArrowLeft || keys.a) ix -= 1; if (keys.ArrowRight || keys.d) ix += 1; if (keys.ArrowUp || keys.w) iy -= 1; if (keys.ArrowDown || keys.s) iy += 1;
    const sp = 92, nx = P.x + ix * sp * dt, ny = P.y + iy * sp * dt;
    if (!hitsWall(nx, P.y, 6)) P.x = nx; if (!hitsWall(P.x, ny, 6)) P.y = ny;
    if (Math.abs(ix) > 0.1) P.face = ix > 0 ? 1 : -1; P.walk += (Math.hypot(ix, iy) > 0.1 ? dt * 11 : 0);
    /* guards */
    let seen = false;
    guards.forEach(g => {
      if (g.wait > 0) { g.wait -= dt; } else {
        const tgt = g.p[(g.i + 1) % g.p.length], dx = tgt[0] - g.x, dy = tgt[1] - g.y, d = Math.hypot(dx, dy);
        if (d < 2) { g.hold = 0.7; g.i = (g.i + 1) % g.p.length; g.wait = 0.5; }
        else { g.x += dx / d * g.v * dt; g.y += dy / d * g.v * dt; const a = Math.atan2(dy, dx); g.dir += angDiff(a, g.dir) * Math.min(1, dt * 8); g.walk = (g.walk || 0) + dt * 9; }
      }
      if (sees(g.x, g.y - 0, g.dir, g.half, g.cone)) seen = true;
    });
    cams.forEach(c => { c.dir = c.c + Math.sin(t * c.s) * c.a; if (sees(c.x, c.y, c.dir, c.half, c.range)) seen = true; });
    lasers.forEach(l => { if (laserOn(l)) { const ax = l.a[0], ay = l.a[1], bx = l.b[0], by = l.b[1], dx = bx - ax, dy = by - ay, tt = clamp(((P.x - ax) * dx + (P.y - ay) * dy) / (dx * dx + dy * dy), 0, 1), px = ax + dx * tt, py = ay + dy * tt; if (Math.hypot(P.x - px, P.y - py) < 8) { alert = 1; seen = true; } } });
    alert = seen ? Math.min(1, alert + dt * 2.0) : Math.max(0, alert - dt * 1.1);
    if (seen) { shake = 0.1; if (Math.floor(t * 8) % 2 === 0) Kit.tone(880, 0.05, 'square', 0.04); }
    if (alert >= 1) { lives--; caught = 0.001; flash = 1; shake = 0.8; Kit.tone(160, 0.5, 'sawtooth', 0.2, -90); Kit.vibe(80); say('SPOTTED!', P.x, P.y - 40); syncHud(); }
    /* pickups */
    if (!hasIntel && Math.hypot(P.x - L.intel[0], P.y - L.intel[1]) < 16) { hasIntel = true; burst(L.intel[0], L.intel[1], '255,220,90', 18); say('Intel!', P.x, P.y - 40); Kit.tone(660, 0.1, 'triangle', 0.2); Kit.tone(990, 0.2, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.09 : 0); Kit.vibe(20); }
    if (hasIntel && Math.hypot(P.x - L.exit[0], P.y - L.exit[1]) < 18) { const bonus = Math.max(0, Math.round((60 - levelT) * 10)); score += 1000 + bonus; doneT = 0.001; burst(P.x, P.y, '120,255,160', 24); say('Escaped! +' + (1000 + bonus), P.x, P.y - 40); Kit.tone(523, 0.12, 'triangle', 0.2); Kit.tone(784, 0.12, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); syncHud(); }
    shake = Math.max(0, shake - dt * 2); flash = Math.max(0, flash - dt * 2);
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; } else p.y -= 22 * dt; }); parts = parts.filter(p => p.age < p.life);
  }
  function syncHud() { $('hudL').textContent = 'S' + level + ' · ' + THEMES[L.t].name; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)); }

  /* ---------------- render ---------------- */
  const X = x => ox + x * K, Y = y => oy + y * K;
  function drawCone(x, y, dir, half, range, a) {
    const n = 22, pts = []; for (let i = 0; i <= n; i++) { const an = dir - half + (half * 2) * i / n; const d = rayDist(x, y, an, range); pts.push([x + Math.cos(an) * d, y + Math.sin(an) * d]); }
    const g = ctx.createRadialGradient(X(x), Y(y), 4, X(x), Y(y), range * K);
    const hot = a > 0.01 ? 255 : 255; g.addColorStop(0, 'rgba(255,' + Math.round(240 - 150 * a) + ',' + Math.round(130 - 100 * a) + ',' + (0.55 + 0.2 * a) + ')'); g.addColorStop(1, 'rgba(255,' + Math.round(220 - 120 * a) + ',90,0.04)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); pts.forEach(p => ctx.lineTo(X(p[0]), Y(p[1]))); ctx.closePath(); ctx.fill();
  }
  function render() {
    ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, W, H);
    if (!L || mode === 'title') return;
    const th = THEMES[L.t];
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 5, rnd(-1, 1) * shake * 5);
    const g = ctx.createLinearGradient(0, oy, 0, oy + WH * K); g.addColorStop(0, th.floor[0]); g.addColorStop(1, th.floor[1]); ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), WW * K, WH * K);
    ctx.strokeStyle = th.line; ctx.lineWidth = 1; for (let x = 0; x <= WW; x += 30) { ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(WH)); ctx.stroke(); } for (let y = 0; y <= WH; y += 30) { ctx.beginPath(); ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(WW), Y(y)); ctx.stroke(); }
    /* exit & intel */
    const ex = L.exit[0], ey = L.exit[1], glow = hasIntel ? 0.6 + 0.4 * Math.sin(t * 6) : 0.18;
    ctx.fillStyle = 'rgba(80,255,150,' + glow * 0.5 + ')'; ctx.beginPath(); ctx.ellipse(X(ex), Y(ey + 6), 26 * K, 14 * K, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2a22'; ctx.strokeStyle = '#6aff9e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(X(ex - 13), Y(ey - 22), 26 * K, 30 * K, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#6aff9e'; ctx.font = '700 ' + Math.round(10 * K + 3) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', X(ex), Y(ey - 4));
    if (!hasIntel) { const ix = L.intel[0], iy = L.intel[1], bob = Math.sin(t * 4) * 3; ctx.fillStyle = 'rgba(255,220,90,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')'; ctx.beginPath(); ctx.arc(X(ix), Y(iy), 22 * K, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a4a1a'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(X(ix - 11), Y(iy - 8 + bob * 0.3), 22 * K, 16 * K, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd24a'; ctx.fillRect(X(ix - 3), Y(iy - 11 + bob * 0.3), 6 * K, 4 * K); }
    /* cones under walls */
    guards.forEach(gd => drawCone(gd.x, gd.y, gd.dir, gd.half, gd.cone, alert));
    cams.forEach(c => drawCone(c.x, c.y, c.dir || c.c, c.half, c.range, alert));
    /* lasers */
    lasers.forEach(l => { const on = laserOn(l); ctx.strokeStyle = on ? 'rgba(255,60,60,.95)' : 'rgba(255,90,90,.18)'; ctx.lineWidth = on ? 3 : 1; if (!on) ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(X(l.a[0]), Y(l.a[1])); ctx.lineTo(X(l.b[0]), Y(l.b[1])); ctx.stroke(); ctx.setLineDash([]); if (on) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0; } ctx.fillStyle = '#444'; [l.a, l.b].forEach(p => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 4, 0, TAU); ctx.fill(); }); });
    /* entities sorted with walls */
    const ents = [];
    L.walls.forEach(w => ents.push({ y: w[1] + w[3], d: () => drawWall(w, th) }));
    guards.forEach(gd => ents.push({ y: gd.y, d: () => { Spy.person(ctx, guardLook, X(gd.x), Y(gd.y) + 10 * K, 0.5 * K + 0.12, { walk: gd.walk || 0, flip: Math.cos(gd.dir) < 0, mood: alert > 0.2 ? 'angry' : 'neutral' }); } }));
    ents.push({ y: P.y, d: () => { if (caught > 0) ctx.globalAlpha = 0.5; Spy.person(ctx, person, X(P.x), Y(P.y) + 10 * K, 0.52 * K + 0.12, { walk: P.walk, flip: P.face < 0, mood: alert > 0.4 ? 'scared' : 'neutral' }); if (hasIntel) { ctx.fillStyle = '#7a4a1a'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(X(P.x) + (P.face > 0 ? 8 : -22) * K, Y(P.y) - 2 * K, 14 * K, 10 * K, 2); ctx.fill(); ctx.stroke(); } ctx.globalAlpha = 1; } });
    cams.forEach(c => ents.push({ y: c.y, d: () => { ctx.save(); ctx.translate(X(c.x), Y(c.y)); ctx.rotate(c.dir || c.c); ctx.fillStyle = '#2a2e3c'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-8, -6, 18, 12, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = alert > 0.3 ? '#ff4040' : '#5cff9a'; ctx.beginPath(); ctx.arc(6, 0, 3, 0, TAU); ctx.fill(); ctx.restore(); } }));
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    /* particles */
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(17 * K + 4) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(p.txt, X(p.x), Y(p.y)); ctx.fillText(p.txt, X(p.x), Y(p.y)); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgba(' + p.col + ',1)'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (joy) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 40, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.25)'; const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy) || 1, m = Math.min(40, d); ctx.beginPath(); ctx.arc(joy.ox + dx / d * m, joy.oy + dy / d * m, 16, 0, TAU); ctx.fill(); }
    ctx.restore();
    /* alert bar + vignette */
    if (mode === 'play') {
      const bw = Math.min(220, W * 0.55), bx = W / 2 - bw / 2, by = H - 34 - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill(); ctx.fillStyle = alert > 0.6 ? '#ff4040' : '#ffcf4a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(12, bw * alert), 12, 6); ctx.fill();
      ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8ecf8'; ctx.fillText(hasIntel ? 'GET TO THE EXIT' : 'GRAB THE BRIEFCASE', W / 2, by - 8);
      if (alert > 0.01) { const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); v.addColorStop(0, 'rgba(255,0,0,0)'); v.addColorStop(1, 'rgba(255,30,30,' + alert * 0.5 + ')'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function drawWall(w, th) {
    const x = X(w[0]), y = Y(w[1]), ww = w[2] * K, hh = w[3] * K, ht = 14 * K;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 3, y + 3, ww, hh + ht * 0.4);
    const sg = ctx.createLinearGradient(0, y, 0, y + hh + ht); sg.addColorStop(0, th.wall[1]); sg.addColorStop(1, '#14141e'); ctx.fillStyle = sg; ctx.fillRect(x, y - ht + hh, ww, ht);
    const tg = ctx.createLinearGradient(0, y - ht, 0, y - ht + hh); tg.addColorStop(0, th.wall[0]); tg.addColorStop(1, th.wall[1]); ctx.fillStyle = tg; ctx.fillRect(x, y - ht, ww, hh);
    ctx.strokeStyle = '#14141e'; ctx.lineWidth = 1.6; ctx.strokeRect(x, y - ht, ww, hh + ht);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 1, y - ht + 1, ww - 2, 2);
  }

  /* title art + flow */
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150);
    $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Cover blown!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Stage reached', level) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'tux', cw / 2, ch - 8, Math.min(cw / 140, ch / 125), { look: 0 });
    Kit.show('over');
  }
  function start() { level = 1; score = 0; lives = 3; mode = 'play'; load(); Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); syncHud(); Kit.banner('Stage 1', THEMES[0].name); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; joy = null; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const cv = $('game');
  cv.addEventListener('pointerdown', e => { if (mode !== 'play') return; Kit.ac(); joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (joy && joy.id === e.pointerId) { joy.x = e.clientX; joy.y = e.clientY; } });
  const up = e => { if (joy && joy.id === e.pointerId) joy = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => { keys[e.key] = true; }); window.addEventListener('keyup', e => { keys[e.key] = false; });
  L = LV[0]; load();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(dt); render(); });
  window.__n0n07 = { get state() { return { mode, level, score, lives, hasIntel, alert, p: [P.x, P.y], doneT }; }, setLevel(n) { level = n; load(); syncHud(); }, tp(x, y) { P.x = x; P.y = y; }, get L() { return L; } };
})();
