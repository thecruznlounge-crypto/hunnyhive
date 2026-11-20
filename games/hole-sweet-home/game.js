/* Hole Sweet Home - mini golf around the house. */
(function () {
  'use strict';
  Kit.ns('hole-sweet-home');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const AW = 300, AH = 460, BR = 6, HR = 11;
  let W, H, sc, ox, oy;
  function layout() { W = S.W; H = S.H; sc = Math.min((W - 24) / AW, (H - 190) / AH); ox = (W - AW * sc) / 2; oy = 84 + ((H - 190) - AH * sc) / 2; }
  S.onresize = layout; layout();

  /* wall rect: [x,y,w,h]. kinds: wall (furniture), sofa (bouncy), rug (slow), water (hazard), roomba (moving wall) */
  const R = (k, x, y, w, h, extra) => Object.assign({ k, x, y, w, h }, extra || {});
  const LEVELS = [
    { name: 'Living Room', par: 2, s: [150, 410], h: [150, 60], o: [R('rug', 70, 150, 160, 160), R('wall', 115, 215, 70, 36, { n: 'table' })] },
    { name: 'Hallway', par: 3, s: [50, 410], h: [250, 60], o: [R('wall', 0, 200, 220, 26), R('wall', 80, 300, 220, 26), R('rug', 100, 100, 100, 70)] },
    { name: 'Kitchen', par: 3, s: [40, 420], h: [260, 50], o: [R('wall', 80, 180, 140, 90, { n: 'island' }), R('rug', 20, 300, 120, 80), R('wall', 0, 80, 100, 40), R('wall', 200, 330, 100, 40)] },
    { name: 'Bathroom', par: 3, s: [150, 420], h: [150, 50], o: [R('water', 70, 190, 160, 100, { n: 'tub' }), R('wall', 0, 100, 60, 30), R('wall', 240, 100, 60, 30)] },
    { name: 'Bedroom', par: 3, s: [40, 420], h: [255, 55], o: [R('sofa', 90, 100, 150, 90, { n: 'bed' }), R('wall', 0, 250, 90, 36, { n: 'dresser' }), R('rug', 150, 270, 130, 90)] },
    { name: 'Kids Room', par: 3, s: [250, 420], h: [60, 60], o: [R('sofa', 160, 280, 40, 40), R('sofa', 70, 330, 40, 40), R('wall', 100, 200, 100, 24), R('sofa', 230, 140, 40, 40), R('water', 20, 120, 60, 50, { n: 'toys' })] },
    { name: 'Home Office', par: 4, s: [150, 425], h: [150, 45], o: [R('wall', 40, 170, 90, 50, { n: 'desk' }), R('wall', 170, 170, 90, 50, { n: 'desk' }), R('roomba', 20, 290, 40, 22, { x1: 240, y1: 290, sp: 0.6 }), R('rug', 100, 330, 100, 60)] },
    { name: 'Dining Room', par: 4, s: [40, 425], h: [260, 50], o: [R('wall', 70, 140, 160, 120, { n: 'dining' }), R('sofa', 20, 270, 36, 36), R('sofa', 244, 270, 36, 36), R('rug', 0, 330, 300, 40), R('water', 110, 290, 80, 30, { n: 'spill' })] },
    { name: 'Front Door', par: 4, s: [150, 430], h: [150, 36], o: [R('wall', 0, 90, 110, 30), R('wall', 190, 90, 110, 30), R('roomba', 20, 220, 40, 22, { x1: 240, y1: 220, sp: 0.8 }), R('sofa', 70, 300, 50, 50), R('sofa', 180, 330, 50, 50), R('water', 120, 150, 60, 30)] }
  ];

  [
    { name: 'Library', f: 'carpet', par: 3, s: [40, 425], h: [255, 50], o: [R('wall', 0, 150, 200, 30, { n: 'shelf' }), R('wall', 100, 270, 200, 30, { n: 'shelf' }), R('sofa', 220, 340, 50, 50), R('rug', 20, 320, 90, 80)] },
    { name: 'Laundry', f: 'tile', par: 3, s: [150, 430], h: [150, 45], o: [R('water', 50, 190, 200, 50, { n: 'suds' }), R('wall', 0, 300, 100, 40, { n: 'washer' }), R('wall', 200, 300, 100, 40, { n: 'washer' }), R('roomba', 20, 370, 40, 22, { x1: 240, y1: 370, sp: 0.7 })] },
    { name: 'Garage', f: 'concrete', par: 3, s: [40, 430], h: [255, 45], o: [R('wall', 80, 380, 140, 30, { n: 'bench' }), R('wall', 0, 200, 200, 24, { n: 'bench' }), R('warp', 30, 300, 30, 30, { id: 'a', pair: 'b' }), R('warp', 240, 110, 30, 30, { id: 'b', pair: 'a' })] },
    { name: 'Nursery', f: 'carpet', par: 3, s: [150, 430], h: [150, 40], o: [R('sofa', 30, 340, 44, 44), R('sofa', 226, 340, 44, 44), R('sofa', 128, 250, 44, 44), R('sofa', 60, 160, 44, 44), R('sofa', 196, 160, 44, 44), R('rug', 90, 90, 120, 50)] },
    { name: 'Home Gym', f: 'rubber', par: 4, s: [40, 430], h: [260, 45], o: [R('rug', 0, 330, 300, 80), R('roomba', 20, 250, 40, 22, { x1: 240, y1: 250, sp: 0.8 }), R('roomba', 20, 160, 40, 22, { x1: 240, y1: 160, sp: 0.55 }), R('wall', 130, 60, 40, 80, { n: 'rack' })] },
    { name: 'Game Room', f: 'carpet', par: 4, s: [150, 430], h: [60, 50], o: [R('sofa', 100, 300, 100, 40), R('warp', 30, 380, 30, 30, { id: 'a', pair: 'b' }), R('warp', 240, 160, 30, 30, { id: 'b', pair: 'a' }), R('wall', 100, 120, 100, 28, { n: 'desk' }), R('water', 20, 230, 70, 40, { n: 'soda' })] },
    { name: 'Attic', f: 'wood', par: 4, s: [40, 430], h: [260, 40], o: [R('wall', 0, 340, 220, 24), R('wall', 80, 240, 220, 24), R('wall', 0, 140, 220, 24), R('roomba', 20, 80, 40, 22, { x1: 240, y1: 80, sp: 0.6 })] },
    { name: 'Pool Deck', f: 'tile', par: 4, s: [150, 430], h: [150, 40], o: [R('water', 0, 140, 120, 230, { n: 'pool' }), R('water', 180, 140, 120, 230, { n: 'pool' }), R('rug', 120, 380, 60, 40), R('sofa', 140, 230, 20, 20)] },
    { name: 'Penthouse', f: 'wood', par: 5, s: [150, 435], h: [150, 36], o: [R('wall', 0, 320, 110, 26), R('wall', 190, 320, 110, 26), R('roomba', 20, 380, 40, 22, { x1: 240, y1: 380, sp: 0.9 }), R('warp', 20, 240, 30, 30, { id: 'a', pair: 'b' }), R('warp', 250, 130, 30, 30, { id: 'b', pair: 'a' }), R('sofa', 120, 220, 60, 36), R('water', 100, 80, 100, 30, { n: 'fountain' }), R('rug', 0, 150, 90, 60)] }
  ].forEach(l => LEVELS.push(l));

  function pos(o, tt) { if (o.k !== 'roomba') return { x: o.x, y: o.y }; const k = 0.5 - 0.5 * Math.cos(tt * o.sp * TAU * 0.5); return { x: o.x + (o.x1 - o.x) * k, y: o.y + (o.y1 - o.y) * k }; }

  let mode = 'title', t = 0, li = 0, L, b, strokes = 0, total = 0, parTotal = 0, stars = 0, results = [], aim = null, state = 'aim', sinkT = 0, last = { x: 0, y: 0 }, parts = [], msg = null, trail = [];
  function loadLevel(i) {
    li = i; L = LEVELS[i]; b = { x: L.s[0], y: L.s[1], vx: 0, vy: 0, sunk: false }; last = { x: b.x, y: b.y }; strokes = 0; state = 'aim'; aim = null; trail = []; msg = null; parts = []; sync();
  }
  function sync() { $('hudL').textContent = 'Hole ' + (li + 1) + '/' + LEVELS.length; $('hudC').textContent = 'Par ' + (L ? L.par : 0); $('hudR').textContent = 'Putts ' + strokes; }

  /* physics core (also used by tests) */
  function stepBall(b, dt, L, tt) {
    const sp = Math.hypot(b.vx, b.vy);
    let fr = 0.9; // per-second decay constant
    let slow = false;
    L.o.forEach(o => { if (o.k === 'rug' && b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) slow = true; });
    const decel = slow ? 260 : 70;
    if (sp > 0) { const ns = Math.max(0, sp - (decel + sp * (slow ? 1.2 : 0.35)) * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const res = { hit: false, water: false, sunk: false };
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * 0.8; res.hit = true; } if (b.x > AW - BR) { b.x = AW - BR; b.vx = -Math.abs(b.vx) * 0.8; res.hit = true; }
    if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy) * 0.8; res.hit = true; } if (b.y > AH - BR) { b.y = AH - BR; b.vy = -Math.abs(b.vy) * 0.8; res.hit = true; }
    L.o.forEach(o => {
      const p = pos(o, tt);
      if (o.k === 'rug' || o.k === 'warp') return;
      if (o.k === 'water') { if (b.x > p.x + 4 && b.x < p.x + o.w - 4 && b.y > p.y + 4 && b.y < p.y + o.h - 4) res.water = true; return; }
      const cx = clamp(b.x, p.x, p.x + o.w), cy = clamp(b.y, p.y, p.y + o.h); let dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
      if (d < BR) {
        let nx, ny;
        if (d < 1e-4) { const l = b.x - p.x, r = p.x + o.w - b.x, tp = b.y - p.y, bt = p.y + o.h - b.y, m = Math.min(l, r, tp, bt); nx = m === l ? -1 : m === r ? 1 : 0; ny = m === tp ? -1 : m === bt ? 1 : 0; if (!nx && !ny) ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
        b.x = cx + nx * BR + (d === 0 ? nx * BR : 0); b.y = cy + ny * BR + (d === 0 ? ny * BR : 0);
        const vn = b.vx * nx + b.vy * ny; if (vn < 0) { const e = o.k === 'sofa' ? 1.18 : 0.78; b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (o.k === 'roomba') { b.vx += (o.x1 - o.x) * 0.3 * o.sp * 0; } res.hit = true; if (o.k === 'sofa') res.boing = true; }
      }
    });
    if (b.cd > 0) b.cd -= dt; else L.o.forEach(o => { if (o.k !== 'warp') return; const wx = o.x + o.w / 2, wy = o.y + o.h / 2; if (Math.hypot(b.x - wx, b.y - wy) < 11) { const q = L.o.find(z => z.id === o.pair); if (q) { b.x = q.x + q.w / 2; b.y = q.y + q.h / 2; b.cd = 0.6; res.warp = true; } } });
    const hd = Math.hypot(b.x - L.h[0], b.y - L.h[1]), spd = Math.hypot(b.vx, b.vy);
    if (hd < HR - 1 && spd < 300) res.sunk = true;
    else if (hd < HR + 4 && spd < 300) { b.vx += (L.h[0] - b.x) * 6 * dt; b.vy += (L.h[1] - b.y) * 6 * dt; }
    return res;
  }
  function simShot(L, x, y, ang, pw) {
    const bb = { x, y, vx: Math.cos(ang) * pw, vy: Math.sin(ang) * pw }; let tt = 0;
    for (let i = 0; i < 3600; i++) { tt += 1 / 240; const r = stepBall(bb, 1 / 240, L, tt); if (r.sunk) return { x: bb.x, y: bb.y, sunk: true }; if (r.water) return { x: x, y: y, water: true }; if (Math.hypot(bb.vx, bb.vy) < 3) break; }
    return { x: bb.x, y: bb.y, sunk: false };
  }

  /* input */
  const MAXPULL = 90;
  function wp(e) { return { x: (e.clientX - ox) / sc, y: (e.clientY - oy) / sc }; }
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); if (mode !== 'play' || state !== 'aim') return; const p = wp(e); if (Math.hypot(p.x - b.x, p.y - b.y) < 46) { aim = { x: p.x, y: p.y }; try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {} } });
  S.canvas.addEventListener('pointermove', e => { if (aim) { const p = wp(e); aim = { x: p.x, y: p.y }; } });
  const rel = () => { if (!aim) return; const dx = b.x - aim.x, dy = b.y - aim.y, d = Math.hypot(dx, dy); aim = null; if (d < 8) return; const pw = Math.min(1, d / MAXPULL), sp = 60 + pw * 520; b.vx = dx / d * sp; b.vy = dy / d * sp; last = { x: b.x, y: b.y }; strokes++; state = 'roll'; trail = []; Kit.noise(0.08, 0.15, null, 2500); Kit.tone(220 + pw * 200, 0.08, 'triangle', 0.15); sync(); };
  S.canvas.addEventListener('pointerup', rel); S.canvas.addEventListener('pointercancel', () => { aim = null; });

  let acc = 0;
  function update(dt) {
    if (mode !== 'play') return;
    if (state === 'roll') {
      acc += dt; while (acc > 1 / 240) {
        acc -= 1 / 240; const r = stepBall(b, 1 / 240, L, t);
        if (r.hit && Math.random() < 0.08) Kit.tone(r.boing ? 500 : 140, 0.05, r.boing ? 'sine' : 'square', 0.1);
        if (r.water) { Kit.tone(200, 0.3, 'sine', 0.2, -100); Kit.noise(0.2, 0.15, null, 900); msg = { txt: 'Splash! +1', age: 0 }; strokes++; b.x = last.x; b.y = last.y; b.vx = b.vy = 0; state = 'aim'; sync(); break; }
        if (r.sunk) { sink(); break; }
        if (Math.hypot(b.vx, b.vy) < 3) { b.vx = b.vy = 0; state = 'aim'; break; }
      }
      trail.push({ x: b.x, y: b.y }); if (trail.length > 30) trail.shift();
      if (strokes >= 9 && state === 'aim') { /* too many */ }
    } else if (state === 'sink') { sinkT += dt; if (sinkT > 1.6) next(); }
    if (strokes >= 9 && state === 'aim') { msg = { txt: 'Pick up! Max 9', age: 0 }; sinkT = 0; state = 'sink'; }
    if (msg) { msg.age += dt; if (msg.age > 1.4 && state !== 'sink') msg = null; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
  }
  function sink() {
    state = 'sink'; sinkT = 0; b.x = L.h[0]; b.y = L.h[1]; b.vx = b.vy = 0; b.sunk = true;
    const d = strokes - L.par, st = strokes === 1 ? 3 : d < 0 ? 3 : d === 0 ? 2 : d <= 2 ? 1 : 0; stars = st; results.push({ strokes, par: L.par, st }); total += strokes; parTotal += L.par;
    const name = strokes === 1 ? 'Hole in one!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : '+' + d;
    msg = { txt: name, age: 0 }; Kit.banner(name, '★'.repeat(st) || null); Kit.tone(660, 0.12, 'triangle', 0.2); Kit.tone(990, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.vibe(25);
    for (let i = 0; i < 24; i++) parts.push({ x: L.h[0], y: L.h[1], vx: rnd(-90, 90), vy: rnd(-200, -40), age: 0, life: rnd(0.6, 1.1), c: ['#ffe066', '#7be07b', '#fff'][i % 3] });
  }
  function next() { if (li + 1 >= LEVELS.length) return end(); loadLevel(li + 1); }
  function end() {
    mode = 'over'; $('hud').classList.remove('show'); const rel = total - parTotal, starsAll = results.reduce((a, r) => a + r.st, 0), bs = Kit.get('best', 0), nb = starsAll > bs; if (nb) Kit.set('best', starsAll);
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = rel < 0 ? 'Under par!' : rel === 0 ? 'Right on par' : 'Round done';
    $('resStats').innerHTML = row('Strokes', total + ' (' + (rel > 0 ? '+' : '') + rel + ')') + row('Stars', starsAll + ' / ' + LEVELS.length * 3, nb) + row('Best stars', Math.max(bs, starsAll));
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Golf.ball(g, cw / 2, ch / 2, Math.min(cw, ch) * 0.38, { mood: 'happy' }); Kit.show('over');
  }

  /* render */
  function drawObj(o) {
    const p = pos(o, t), x = ox + p.x * sc, y = oy + p.y * sc, w = o.w * sc, h = o.h * sc, c = ctx;
    if (o.k === 'warp') { const cx2 = x + w / 2, cy2 = y + h / 2, r = w / 2; const g = c.createRadialGradient(cx2, cy2, 1, cx2, cy2, r); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#c070ff'); g.addColorStop(1, '#5020a0'); c.fillStyle = g; c.beginPath(); c.arc(cx2, cy2, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx2, cy2, r * (0.3 + i * 0.25), t * 4 + i, t * 4 + i + 3.6); c.stroke(); } return; }
    if (o.k === 'rug') { c.fillStyle = '#c0504d'; c.beginPath(); c.roundRect(x, y, w, h, 10); c.fill(); c.strokeStyle = '#f0d9a0'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.roundRect(x + 6, y + 6, w - 12, h - 12, 6); c.stroke(); c.setLineDash([]); return; }
    if (o.k === 'water') { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9fe6ff'); g.addColorStop(1, '#3a9ee0'); c.fillStyle = o.n === 'tub' ? '#f4f4f4' : 'rgba(0,0,0,0)'; if (o.n === 'tub') { c.beginPath(); c.roundRect(x - 6, y - 6, w + 12, h + 12, 22); c.fill(); } c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, o.n === 'tub' ? 18 : 12); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 10, y + h * (0.25 + i * 0.25)); c.quadraticCurveTo(x + w / 2, y + h * (0.15 + i * 0.25) + Math.sin(t * 2 + i) * 4, x + w - 10, y + h * (0.25 + i * 0.25)); c.stroke(); } return; }
    if (o.k === 'sofa') { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.roundRect(x + 3, y + 5, w, h, 14); c.fill(); c.fillStyle = o.n === 'bed' ? '#7ab0e8' : '#ff9a4d'; c.beginPath(); c.roundRect(x, y, w, h, 14); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.roundRect(x + 5, y + 5, w - 10, h * 0.45, 9); c.fill(); if (o.n === 'bed') { c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x + 8, y + 8, w * 0.4, h * 0.32, 8); c.roundRect(x + w * 0.52, y + 8, w * 0.4, h * 0.32, 8); c.fill(); } return; }
    if (o.k === 'roomba') { const r = o.h * sc / 2 + 4; const cx2 = x + w / 2, cy2 = y + h / 2; c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(cx2 + 2, cy2 + 4, w / 2, h / 2, 0, 0, TAU); c.fill(); c.fillStyle = '#3b3f48'; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill(); c.fillStyle = '#7be07b'; c.beginPath(); c.arc(cx2, cy2, 4 * sc, 0, TAU); c.fill(); return; }
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.roundRect(x + 3, y + 5, w, h, 6); c.fill();
    c.fillStyle = o.n === 'desk' ? '#8a5a34' : o.n === 'island' ? '#e8e0d0' : o.n === 'dining' ? '#a0693a' : o.n === 'dresser' ? '#7a4e2c' : o.n === 'shelf' ? '#6a4020' : o.n === 'washer' ? '#e8eef2' : o.n === 'bench' ? '#b8864a' : o.n === 'rack' ? '#555' : '#8a5a34'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.roundRect(x + 3, y + 3, w - 6, h * 0.3, 4); c.fill();
    if (o.n === 'dining') { c.fillStyle = '#c0504d'; c.beginPath(); c.roundRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.4, 6); c.fill(); }
  }
  function floorDraw(fx, fy, fw, fh, k) {
    const c = ctx;
    if (k === 'tile') { c.fillStyle = '#e8f1f4'; c.fillRect(fx, fy, fw, fh); const n = 8, ts = fw / n; for (let i = 0; i < n; i++) for (let j = 0; j < Math.ceil(fh / ts); j++) { if ((i + j) % 2) { c.fillStyle = '#c4dde6'; c.fillRect(fx + i * ts, fy + j * ts, ts, ts); } } c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(fx + i * ts, fy); c.lineTo(fx + i * ts, fy + fh); c.stroke(); } for (let j = 0; j * ts <= fh; j++) { c.beginPath(); c.moveTo(fx, fy + j * ts); c.lineTo(fx + fw, fy + j * ts); c.stroke(); } }
    else if (k === 'carpet') { c.fillStyle = '#7a8fc8'; c.fillRect(fx, fy, fw, fh); c.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 300; i++) c.fillRect(fx + (i * 53) % fw, fy + (i * 97) % fh, 2, 2); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.strokeRect(fx + 10, fy + 10, fw - 20, fh - 20); c.setLineDash([]); }
    else if (k === 'concrete') { c.fillStyle = '#9aa2aa'; c.fillRect(fx, fy, fw, fh); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy + fh * 0.5); c.lineTo(fx + fw, fy + fh * 0.5); c.moveTo(fx + fw * 0.5, fy); c.lineTo(fx + fw * 0.5, fy + fh); c.stroke(); c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 120; i++) c.fillRect(fx + (i * 71) % fw, fy + (i * 131) % fh, 3, 2); c.strokeStyle = '#ffcf3a'; c.setLineDash([16, 10]); c.lineWidth = 4; c.strokeRect(fx + 14, fy + 14, fw - 28, fh - 28); c.setLineDash([]); }
    else if (k === 'rubber') { c.fillStyle = '#3c4048'; c.fillRect(fx, fy, fw, fh); c.fillStyle = 'rgba(255,255,255,.07)'; const ts = fw / 10; for (let i = 0; i < 10; i++) for (let j = 0; j * ts < fh; j++) if ((i + j) % 2) c.fillRect(fx + i * ts, fy + j * ts, ts, ts); }
    else { c.fillStyle = '#d9a566'; c.fillRect(fx, fy, fw, fh); for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'; c.fillRect(fx, fy + i * fh / 20, fw, fh / 20); } c.strokeStyle = 'rgba(90,50,20,.25)'; c.lineWidth = 1; for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(fx, fy + i * fh / 20); c.lineTo(fx + fw, fy + i * fh / 20); c.stroke(); } }
    const sh = c.createLinearGradient(fx, fy, fx, fy + 18); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(fx, fy, fw, 18);
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(0, 0, W, H);
    if (mode === 'title' || !L) return;
    /* floor boards */
    const fx = ox, fy = oy, fw = AW * sc, fh = AH * sc; ctx.save(); ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 10); ctx.clip();
    floorDraw(fx, fy, fw, fh, L.f || 'wood');
    ctx.restore();
    ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(fx - 4, fy - 4, fw + 8, fh + 8, 12); ctx.stroke();
    L.o.forEach(o => { if (o.k === 'rug' || o.k === 'water' || o.k === 'warp') drawObj(o); }); L.o.forEach(o => { if (o.k !== 'rug' && o.k !== 'water' && o.k !== 'warp') drawObj(o); });
    const hx = ox + L.h[0] * sc, hy = oy + L.h[1] * sc;
    ctx.fillStyle = '#1b1208'; ctx.beginPath(); ctx.ellipse(hx, hy, HR * sc, HR * sc * 0.8, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 2; ctx.stroke();
    Golf.flag(ctx, hx, hy, 46 * sc, t);
    /* aim guide */
    if (aim && state === 'aim') {
      const dx = b.x - aim.x, dy = b.y - aim.y, d = Math.hypot(dx, dy), pw = Math.min(1, d / MAXPULL); if (d > 4) { const nx = dx / d, ny = dy / d;
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox + b.x * sc, oy + b.y * sc); ctx.lineTo(ox + (b.x + nx * (40 + pw * 120)) * sc, oy + (b.y + ny * (40 + pw * 120)) * sc); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = pw > 0.8 ? '#ff5a3a' : '#7be07b'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ox + b.x * sc, oy + b.y * sc); ctx.lineTo(ox + (b.x - nx * Math.min(d, MAXPULL)) * sc, oy + (b.y - ny * Math.min(d, MAXPULL)) * sc); ctx.stroke(); }
    }
    trail.forEach((p, i) => { ctx.globalAlpha = i / trail.length * 0.3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + p.x * sc, oy + p.y * sc, BR * sc * 0.7, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    const sp = Math.hypot(b.vx, b.vy), scl = state === 'sink' ? clamp(1 - sinkT * 3, 0.1, 1) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ox + b.x * sc + 2, oy + b.y * sc + 3, BR * sc * scl, BR * sc * 0.6 * scl, 0, 0, TAU); ctx.fill();
    Golf.ball(ctx, ox + b.x * sc, oy + b.y * sc, BR * sc * 1.25 * scl, { rot: 0, mood: sp > 60 ? 'scared' : 'happy', blink: Math.sin(t * 2.3) > 0.98 });
    parts.forEach(p => { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.c; ctx.fillRect(ox + p.x * sc - 3, oy + p.y * sc - 3, 6, 6); }); ctx.globalAlpha = 1;
    ctx.font = '700 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,20,5,.8)'; ctx.lineWidth = 4;
    ctx.strokeText(L.name, W / 2, oy - 14); ctx.fillText(L.name, W / 2, oy - 14);
    if (msg) { ctx.globalAlpha = Math.min(1, 1.6 - msg.age); ctx.font = '700 26px Fredoka, sans-serif'; ctx.strokeText(msg.txt, W / 2, oy + AH * sc * 0.5); ctx.fillText(msg.txt, W / 2, oy + AH * sc * 0.5); ctx.globalAlpha = 1; }
    if (li === 0 && strokes === 0 && state === 'aim') { ctx.font = '700 14px Fredoka, sans-serif'; const m = 'Drag back from the ball, let go to putt'; ctx.strokeText(m, W / 2, oy + AH * sc + 26); ctx.fillText(m, W / 2, oy + AH * sc + 26); }
  }
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const s = Math.min(w / 220, h / 150); c.save(); c.translate(w / 2, h - 10); c.scale(s, s);
    c.fillStyle = '#e8c9a0'; c.fillRect(-80, -80, 160, 80); c.fillStyle = '#c0504d'; c.beginPath(); c.moveTo(-96, -78); c.lineTo(0, -140); c.lineTo(96, -78); c.fill(); c.fillStyle = '#7a4e2c'; c.fillRect(-14, -48, 28, 48); c.fillStyle = '#fff3b0'; c.fillRect(-62, -62, 28, 24); c.fillRect(34, -62, 28, 24);
    c.fillStyle = '#2fa84a'; c.beginPath(); c.ellipse(0, 0, 110, 12, 0, 0, TAU); c.fill(); c.fillStyle = '#1b1208'; c.beginPath(); c.ellipse(60, 0, 12, 4, 0, 0, TAU); c.fill(); Golf.flag(c, 60, 0, 40, t);
    Golf.ball(c, -50 + Math.sin(t * 2) * 6, -10, 11, { mood: 'happy' }); c.restore();
  }
  function start() { mode = 'play'; total = 0; parTotal = 0; results = []; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); loadLevel(0); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  loadLevel(0);
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.05)); render(); drawTitleArt(); });
  window.__home = { go(n) { loadLevel(n); }, get state() { return { mode, li, strokes, state, b: { x: b.x, y: b.y }, total, results, ox, oy, sc }; }, LEVELS, simShot, shoot(ang, pw) { b.vx = Math.cos(ang) * pw; b.vy = Math.sin(ang) * pw; last = { x: b.x, y: b.y }; strokes++; state = 'roll'; sync(); } };
})();
