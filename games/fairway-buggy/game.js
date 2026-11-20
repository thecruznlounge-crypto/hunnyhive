/* Fairway Buggy - hill climb golf cart. */
(function () {
  'use strict';
  Kit.ns('fairway-buggy');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); }
  S.onresize = layout; layout();

  /* terrain: y positive down, design units */
  function amp(x) { return clamp((x - 500) / 5500, 0, 1); }
  function ter(x) {
    const a = 0.35 + 0.65 * amp(x), ramp = clamp((x - 80) / 500, 0, 1);
    return -x * 0.05 - ramp * a * (Math.sin(x / 190) * 55 + Math.sin(x / 83 + 1) * 16 + Math.sin(x / 470 + 2) * 80) + ramp * 70 * 0;
  }
  function slopeAt(x) { return (ter(x + 1) - ter(x - 1)) / 2; }

  const WB = 36, WR = 15, SPR = 5200, DMP = 90, G = 1000, MASS = 1, INERT = 1500;
  let mode = 'title', t = 0, car, camX = 0, camY = 0, items = [], nextItem = 400, gas = 0, brake = 0, battery = 100, balls = 0, maxX = 0, parts = [], floats = [], flipT = 0, stallT = 0, dead = false, deadT = 0, why = '', lastGround = 0, airT = 0, trick = 0, wheelRot = 0;
  function reset() { lastStage = 1;
    const x = 60; car = { x, y: ter(x) - 40, a: slopeAt(x) * 0.5, vx: 0, vy: 0, w: 0 };
    battery = 100; balls = 0; maxX = 0; items = []; nextItem = 300; parts = []; floats = []; flipT = 0; stallT = 0; dead = false; deadT = 0; airT = 0; trick = 0; camX = car.x; camY = car.y; sync();
  }
  function sync() { $('hudL').textContent = 'S' + stageNow() + ' \u00B7 ' + Math.floor(maxX / 40) + ' m'; $('hudC').textContent = '● ' + balls; $('hudR').textContent = Math.round(battery) + '%'; }
  function genItems() {
    while (nextItem < car.x + W / u + 600) {
      const x = nextItem, r = Math.random();
      if (x > 900 && r < 0.12) items.push({ k: 'bat', x, y: ter(x) - 46, got: false });
      else if (r < 0.7) { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) items.push({ k: 'ball', x: x + i * 34, y: ter(x + i * 34) - 36 - (i === 1 ? 6 : 0), got: false }); }
      nextItem += rnd(110, 210);
    }
    items = items.filter(i => !i.got && i.x > car.x - 400);
  }

  function pressBtn(id, f) { const b = $(id); const on = e => { e.preventDefault(); f(1); b.classList.add('down'); }, off = () => { f(0); b.classList.remove('down'); }; b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => b.addEventListener(n, off)); }
  pressBtn('bGas', v => { gas = v; Kit.ac(); }); pressBtn('bBrake', v => { brake = v; Kit.ac(); });
  window.addEventListener('keydown', e => { if (e.key === 'ArrowRight') gas = 1; if (e.key === 'ArrowLeft') brake = 1; }); window.addEventListener('keyup', e => { if (e.key === 'ArrowRight') gas = 0; if (e.key === 'ArrowLeft') brake = 0; });

  function physics(dt) {
    const c = car, ca = Math.cos(c.a), sa = Math.sin(c.a);
    let fx = 0, fy = G * MASS, tq = 0, grounded = 0;
    for (let i = 0; i < 2; i++) {
      const lx = i ? WB : -WB, ly = 14;
      const rx = lx * ca - ly * sa, ry = lx * sa + ly * ca, wx = c.x + rx, wy = c.y + ry;
      const gy = ter(wx), pen = wy + WR - gy;
      if (pen > 0) {
        grounded++;
        const sl = slopeAt(wx), tl = Math.hypot(1, sl), tx = 1 / tl, ty = sl / tl, nx = sl / tl, ny = -1 / tl;
        const vwx = c.vx - c.w * ry, vwy = c.vy + c.w * rx, vn = vwx * nx + vwy * ny, vt = vwx * tx + vwy * ty;
        let fn = Math.max(0, SPR * Math.min(pen, 20) - DMP * vn * (vn < 0 ? 1 : 0.4));
        let ft = -vt * 3.5;
        if (i === 0 || i === 1) { if (battery > 0) ft += gas * 520 * (i === 0 ? 1 : 0.6) * (dead ? 0 : 1); ft -= brake * (vt > 8 ? 380 : 0); if (brake && vt < 20) ft -= 220 * (battery > 0 ? 1 : 0.4); }
        ft = clamp(ft, -fn * 1.8 - 200, fn * 1.8 + 520);
        const Fx = nx * fn + tx * ft, Fy = ny * fn + ty * ft;
        fx += Fx; fy += Fy; tq += rx * Fy - ry * Fx;
      }
    }
    if (grounded) { lastGround = t; airT = 0; if (gas && battery > 0) tq -= 0; } else { airT += dt; if (battery > 0) tq += (gas ? -1 : 0) * 520 * 0; tq += (brake ? 1 : 0) * 900 + (gas ? -1 : 0) * 900; }
    /* angular damping (stronger on ground) */
    tq -= c.w * (grounded ? 140 : 40);
    c.vx += fx / MASS * dt; c.vy += fy / MASS * dt; c.w += tq / INERT * dt; c.vx *= (1 - 0.05 * dt); 
    c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt; wheelRot += c.vx * dt / WR;
    /* roof contact: body corners */
    let roof = false;
    [[-34, -34], [34, -34], [0, -46]].forEach(p => { const rx = p[0] * ca - p[1] * sa, ry = p[0] * sa + p[1] * ca; if (c.y + ry > ter(c.x + rx) - 2) roof = true; });
    return { grounded, roof };
  }
  function step(dt) {
    const N = 4; let res;
    for (let i = 0; i < N; i++) res = physics(dt / N);
    return res;
  }
  function update(dt) {
    if (mode !== 'play') return;
    const r = step(dt);
    if (!dead) {
      if (gas && battery > 0) battery = Math.max(0, battery - dt * 2.8); else battery = Math.max(0, battery - dt * 0.4);
      maxX = Math.max(maxX, car.x); { const sn = stageNow(); if (sn !== lastStage) { lastStage = sn; battery = Math.min(100, battery + 35); Kit.banner('Stage ' + sn, THEMES[(sn - 1) % THEMES.length].name); Kit.tone(660, 0.2, 'triangle', 0.2, 300); } }
      flipT = r.roof ? flipT + dt : 0; if (flipT > 0.6) die('Flipped!');
      if (battery <= 0 && Math.hypot(car.vx, car.vy) < 14) { stallT += dt; if (stallT > 1.5) die('Out of juice!'); } else stallT = 0;
      if (car.x < 20 && car.vx < 0) { car.x = 20; car.vx = 0; }
      /* flips / air time bonus */
      if (!r.grounded) trick += car.w * dt; else { if (Math.abs(trick) > 5.5) { balls += 5; floats.push({ x: car.x, y: car.y - 60, txt: 'Flip! +5', age: 0 }); Kit.tone(800, 0.2, 'triangle', 0.2, 500); } trick = 0; }
      items.forEach(i => { if (i.got) return; if (Math.hypot(i.x - car.x, i.y - (car.y - 10)) < 40) { i.got = true; if (i.k === 'ball') { balls++; floats.push({ x: i.x, y: i.y - 14, txt: '+1', age: 0 }); Kit.tone(900, 0.07, 'triangle', 0.12); } else { battery = Math.min(100, battery + 40); floats.push({ x: i.x, y: i.y - 14, txt: 'Charge!', age: 0 }); Kit.tone(500, 0.3, 'square', 0.12, 400); } } });
      genItems(); sync();
    } else { deadT += dt; if (deadT > 1.1) finish(); }
    camX += (car.x + car.vx * 0.25 - camX) * Math.min(1, dt * 4); camY += (car.y - camY) * Math.min(1, dt * 3);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 0.9) floats.splice(i, 1); }
    if (gas && Math.random() < 0.5 && r.grounded) parts.push({ x: car.x - 40, y: car.y + 20, vx: rnd(-60, -20), vy: rnd(-40, -10), age: 0, life: 0.5 });
  }
  function die(w) { if (dead) return; dead = true; deadT = 0; why = w; Kit.tone(180, 0.7, 'sawtooth', 0.18, -120); Kit.vibe(50); }
  function finish() {
    mode = 'over'; const m = Math.floor(maxX / 40), sc = m + balls * 2, nb = sc > Kit.get('best', 0); if (nb) Kit.set('best', sc);
    $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = why || 'Game over'; $('resStats').innerHTML = row('Score', sc, nb) + row('Stage', stageNow()) + row('Distance', m + ' m') + row('Balls', balls) + row('Best', Math.max(sc, Kit.get('best', 0)));
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Golf.ball(g, cw / 2, ch / 2, Math.min(cw, ch) * 0.38, { mood: 'dizzy' }); Kit.show('over');
  }

  /* render */
  function drawBuggy(c, x, y, a, o) {
    c.save(); c.translate(x, y); c.rotate(a);
    [-WB, WB].forEach(wx => { c.save(); c.translate(wx, 14); c.fillStyle = '#222'; c.beginPath(); c.arc(0, 0, WR, 0, TAU); c.fill(); c.rotate(o.wr); c.fillStyle = '#ddd'; c.beginPath(); c.arc(0, 0, WR * 0.55, 0, TAU); c.fill(); c.strokeStyle = '#999'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.rotate(TAU / 6); c.beginPath(); c.moveTo(-WR * 0.5, 0); c.lineTo(WR * 0.5, 0); c.stroke(); } c.restore(); });
    c.fillStyle = '#f6f6f2'; c.beginPath(); c.roundRect(-52, -22, 104, 34, 10); c.fill(); c.fillStyle = '#2a8a40'; c.fillRect(-52, -2, 104, 6);
    c.fillStyle = '#d0d0cc'; c.beginPath(); c.roundRect(-40, -26, 38, 8, 3); c.fill();
    c.fillStyle = '#f6f6f2'; c.beginPath(); c.roundRect(-30, -50, 6, 28, 2); c.fill(); c.beginPath(); c.roundRect(24, -50, 6, 28, 2); c.fill();
    c.fillStyle = '#2fa84a'; c.beginPath(); c.roundRect(-38, -56, 76, 9, 4); c.fill();
    Golf.ball(c, -2, -31, 11, { mood: o.mood, face: true }); c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(-2, -39, 11, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    Golf.bag(c, -46, -4, 0.55, -0.2);
    c.fillStyle = '#ffe066'; c.fillRect(46, -14, 6, 7);
    c.restore();
  }

  const THEMES = [
    { name: 'Sunny Meadow', sky: ['#4aa3ff', '#d8f2ff'], hill: ['#a9dd96', '#86cc7a'], dirt: ['#6b8f3c', '#4a6a2a'], top: '#58cf6a', top2: '#7be07b', deco: 'oak', night: false },
    { name: 'Dune Links', sky: ['#ff9d5c', '#ffe9b8'], hill: ['#efc080', '#dca565'], dirt: ['#d9a35a', '#a8743a'], top: '#8cc060', top2: '#a8d878', deco: 'cactus', night: false },
    { name: 'Seaside Cliffs', sky: ['#3d8fe0', '#c4ecff'], hill: ['#86cde0', '#5fb0cc'], dirt: ['#9a8a6a', '#6a5a40'], top: '#55c46a', top2: '#7be07b', deco: 'palm', night: false },
    { name: 'Frost Fairway', sky: ['#7fa9d8', '#eaf6ff'], hill: ['#e6f2fa', '#c4dcec'], dirt: ['#a8c0d0', '#7a98ae'], top: '#f4fbff', top2: '#ffffff', deco: 'pine', night: false },
    { name: 'Midnight Neon', sky: ['#0a0f3a', '#5a2f8a'], hill: ['#2b2060', '#1c1650'], dirt: ['#1e5a58', '#103a3a'], top: '#3ce0b0', top2: '#7fffd8', deco: 'lamp', night: true }
  ];
  const STAGE_M = 120; let lastStage = 1;
  function stageNow() { return Math.floor(Math.max(maxX, 0) / 40 / STAGE_M) + 1; }
  function TH() { return THEMES[(Math.floor(camX / 40 / STAGE_M)) % THEMES.length]; }
  function skyFx(th) {
    if (th.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t + i)); ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.5), 2, 2); } ctx.globalAlpha = 1; }
    const sg = ctx.createRadialGradient(W * 0.78, H * 0.14, 6, W * 0.78, H * 0.14, 150 * u); sg.addColorStop(0, th.night ? 'rgba(220,220,255,.6)' : 'rgba(255,250,200,.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.5);
    ctx.fillStyle = th.night ? '#e8e8ff' : '#fffbe0'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.14, 26 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (th.night ? 0.15 : 0.8) + ')'; for (let i = 0; i < 5; i++) { const x = (((i * 170 - camX * 0.1 * u + t * 5) % (W + 200)) + W + 200) % (W + 200) - 100, y = 50 * u + (i * 53) % (H * 0.25); [[0, 0, 22], [22, -6, 18], [-22, -2, 15], [40, 2, 13]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * u, y + c[1] * u, c[2] * u, 0, TAU); ctx.fill(); }); }
  }
  function deco(kind, x, y, s) {
    const c = ctx;
    if (kind === 'oak') { c.fillStyle = '#6b4423'; c.fillRect(x - s * 0.07, y - s * 0.45, s * 0.14, s * 0.45); [['#1d6e32', 0, -0.62, 0.34], ['#2c9a45', -0.18, -0.5, 0.26], ['#2c9a45', 0.18, -0.5, 0.26], ['#3cb258', 0.02, -0.8, 0.24]].forEach(a => { c.fillStyle = a[0]; c.beginPath(); c.arc(x + a[1] * s, y + a[2] * s, a[3] * s, 0, TAU); c.fill(); }); }
    else if (kind === 'cactus') { c.fillStyle = '#3a8f4a'; c.beginPath(); c.roundRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 0.7, s * 0.08); c.fill(); c.beginPath(); c.roundRect(x - s * 0.3, y - s * 0.5, s * 0.1, s * 0.3, s * 0.05); c.fill(); c.fillRect(x - s * 0.3, y - s * 0.26, s * 0.24, s * 0.08); c.beginPath(); c.roundRect(x + s * 0.2, y - s * 0.58, s * 0.1, s * 0.3, s * 0.05); c.fill(); c.fillRect(x + s * 0.06, y - s * 0.34, s * 0.24, s * 0.08); }
    else if (kind === 'palm') { c.strokeStyle = '#8a5a30'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.12, y - s * 0.4, x + s * 0.05, y - s * 0.8); c.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; c.strokeStyle = i % 2 ? '#2f9a4c' : '#46b862'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x + s * 0.05, y - s * 0.8); c.quadraticCurveTo(x + s * 0.05 + Math.cos(a) * s * 0.3, y - s * 0.8 + Math.sin(a) * s * 0.3 - s * 0.1, x + s * 0.05 + Math.cos(a) * s * 0.45, y - s * 0.78 + Math.sin(a) * s * 0.3 + s * 0.15); c.stroke(); } }
    else if (kind === 'pine') { c.fillStyle = '#5a3d20'; c.fillRect(x - s * 0.05, y - s * 0.2, s * 0.1, s * 0.2); [0, 1, 2].forEach(i => { c.fillStyle = i % 2 ? '#2e7a5a' : '#38906a'; c.beginPath(); c.moveTo(x - s * (0.3 - i * 0.07), y - s * (0.2 + i * 0.22)); c.lineTo(x, y - s * (0.55 + i * 0.22)); c.lineTo(x + s * (0.3 - i * 0.07), y - s * (0.2 + i * 0.22)); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - s * 0.1, y - s * (0.42 + i * 0.22)); c.lineTo(x, y - s * (0.55 + i * 0.22)); c.lineTo(x + s * 0.1, y - s * (0.42 + i * 0.22)); c.fill(); }); }
    else if (kind === 'lamp') { c.fillStyle = '#2a2a50'; c.fillRect(x - s * 0.03, y - s * 0.8, s * 0.06, s * 0.8); const g = c.createRadialGradient(x, y - s * 0.82, 2, x, y - s * 0.82, s * 0.5); g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(1, 'rgba(255,240,160,0)'); c.fillStyle = g; c.fillRect(x - s * 0.5, y - s * 1.3, s, s); c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(x, y - s * 0.82, s * 0.07, 0, TAU); c.fill(); }
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    const th = TH(); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(0.7, th.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); skyFx(th);
    /* parallax hills */
    [[0.15, th.hill[0], 0.5], [0.3, th.hill[1], 0.65]].forEach(([p, col, hh]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 14) ctx.lineTo(x, H * hh - camY * p * 0.4 * u + Math.sin((x + camX * p * u) / (110 * u) + p * 9) * 28 * u); ctx.lineTo(W, H); ctx.fill(); });
    const ox = W * 0.32 - camX * u, oy = H * 0.55 - camY * u;
    const X = x => x * u + ox, Y = y => y * u + oy;
    /* terrain */
    const x0 = camX - 0.32 * W / u - 20, x1 = camX + 0.68 * W / u + 20;
    const dg = ctx.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, th.dirt[0]); dg.addColorStop(1, th.dirt[1]); ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(X(x0), H + 10); for (let x = x0; x <= x1; x += 8) ctx.lineTo(X(x), Y(ter(x))); ctx.lineTo(X(x1), H + 10); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let k = Math.floor(x0 / 60); k < x1 / 60; k++) { const rx = k * 60 + (k * 37 % 40), ry = ter(rx) + 30 + (k * 53 % 70); ctx.beginPath(); ctx.ellipse(X(rx), Y(ry), (6 + k % 5) * u, (4 + k % 3) * u, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = th.top; ctx.lineWidth = 9 * u; ctx.lineCap = 'round'; ctx.beginPath(); for (let x = x0; x <= x1; x += 8) { const px = X(x), py2 = Y(ter(x)) + 3 * u; x === x0 ? ctx.moveTo(px, py2) : ctx.lineTo(px, py2); } ctx.stroke();
    ctx.strokeStyle = th.top2; ctx.lineWidth = 2 * u; for (let k = Math.floor(x0 / 14); k < x1 / 14; k++) { const gx = k * 14 + (k * 7 % 9), gyy = ter(gx); ctx.beginPath(); ctx.moveTo(X(gx), Y(gyy) - 1 * u); ctx.lineTo(X(gx) + 2 * u, Y(gyy) - 7 * u); ctx.stroke(); }
    for (let k = Math.floor((x0 - 100) / 170); k < (x1 + 100) / 170; k++) { const dx = k * 170 + (k * 91 % 100); if (dx > 160) deco(th.deco, X(dx), Y(ter(dx)) + 4 * u, (th.deco === 'lamp' ? 120 : 72) * u); }
    /* flags every 100 m */
    for (let m = Math.ceil(x0 / 4000) * 100; m * 40 < x1; m += 100) { const x = m * 40; Golf.flag(ctx, X(x), Y(ter(x)), 70 * u, t); ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(14 * u) + 'px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(m + ' m', X(x), Y(ter(x)) + 24 * u); }
    /* items */
    items.forEach(i => { if (i.got) return; const x = X(i.x), y = Y(i.y) + Math.sin(t * 5 + i.x) * 3 * u; if (x < -30 || x > W + 30) return; if (i.k === 'ball') Golf.ball(ctx, x, y, 8 * u, { face: false }); else { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.roundRect(x - 12 * u, y - 10 * u, 24 * u, 20 * u, 4 * u); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(x - 3 * u, y - 15 * u, 6 * u, 5 * u); ctx.fillStyle = '#333'; ctx.font = '700 ' + Math.round(14 * u) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', x, y + 5 * u); } });
    parts.forEach(p => { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = '#e8d9a8'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3 * u, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    if (car) { ctx.save(); ctx.translate(X(car.x), Y(car.y)); ctx.scale(u, u); drawBuggy(ctx, 0, 0, car.a, { wr: wheelRot, mood: dead ? 'dizzy' : (car.vy < -80 ? 'scared' : 'happy') }); ctx.restore(); }
    floats.forEach(f => { ctx.globalAlpha = 1 - f.age / 0.9; ctx.font = '700 ' + Math.round(20 * u) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,60,0,.7)'; ctx.lineWidth = 4; ctx.strokeText(f.txt, X(f.x), Y(f.y) - f.age * 40); ctx.fillText(f.txt, X(f.x), Y(f.y) - f.age * 40); ctx.globalAlpha = 1; });
    if (mode === 'play' && maxX < 400) { ctx.font = '700 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,60,0,.7)'; ctx.lineWidth = 4; const m = 'Hold GAS. In the air, tilt with GAS and BRAKE'; ctx.strokeText(m, W / 2, H * 0.28); ctx.fillText(m, W / 2, H * 0.28); }
    if (mode !== 'title') { const bw = Math.min(140, W * 0.36); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - bw / 2, 56 * u + 8, bw, 8); ctx.fillStyle = battery < 25 ? '#ff5a3a' : '#7be07b'; ctx.fillRect(W / 2 - bw / 2, 56 * u + 8, bw * battery / 100, 8); }
  }
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = '#2c8f45'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.85); c.quadraticCurveTo(w * 0.5, h * 0.45, w, h * 0.7); c.lineTo(w, h); c.fill();
    const s = Math.min(w / 220, h / 140); c.save(); c.translate(w * 0.5, h * 0.58 + Math.sin(t * 5) * 2); c.scale(s * 1.3, s * 1.3); c.rotate(-0.15); drawBuggy(c, 0, 0, 0, { wr: t * 8, mood: 'happy' }); c.restore();
  }
  function start() { mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); reset(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  reset();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.033)); render(); drawTitleArt(); });
  window.__buggy = { get state() { return { mode, dead, why, x: car.x, y: car.y, a: car.a, vx: car.vx, battery, balls, maxX }; }, setGas(v) { gas = v; }, setBrake(v) { brake = v; } };
})();
