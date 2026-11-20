/* Corner in One - pool meets mini-golf. Sink it in the flagged corner pocket in as few shots as possible. */
(function () {
  'use strict';
  Kit.ns('corner-in-one');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- table + holes ---------------- */
  const TW = 360, TH = 560, BR = 11, PR = 26, RAIL = 34, GAP = 36;
  const POCKETS = [[0, 0], [TW, 0], [0, TH], [TW, TH]];
  const PNAME = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const BALLCOL = ['#ffd23f', '#2f6fe0', '#e5383b', '#7b3fb8', '#ff8a2b', '#1f9d55', '#8b2d2d', '#111111'];

  const HOLES = [
    { name: 'Warm-up', par: 2, target: 0, cue: [180, 450], hint: 'Drag back and let go to shoot' },
    { name: 'The Pillar', par: 3, target: 1, cue: [180, 470], rects: [[145, 225, 70, 110]] },
    { name: 'Bumper Alley', par: 3, target: 0, cue: [180, 485], bumpers: [[95, 330, 21], [265, 330, 21], [180, 230, 22], [90, 140, 20], [270, 140, 20]] },
    { name: 'Sand Trap', par: 3, target: 1, cue: [80, 490], sand: [[0, 235, 360, 80]], boost: [[262, 330, 70, 120, 0, -1]], rects: [[200, 80, 130, 18]] },
    { name: 'Eight Ball', par: 2, target: 3, cue: [70, 80], objs: [[180, 280, 7]], hint: 'Pot the 8 ball, keep the white out' },
    { name: 'The Moat', par: 3, target: 0, cue: [180, 490], water: [[0, 255, 125, 60], [235, 255, 125, 60]] },
    { name: 'Windmill', par: 3, target: 1, cue: [180, 495], mill: [180, 285, 100, 1.7], bumpers: [[48, 285, 18], [312, 285, 18]] },
    { name: 'Wormhole', par: 3, target: 0, cue: [180, 490], rects: [[0, 268, 296, 24]], tele: [[[85, 395], [85, 150]], [[285, 420], [285, 70]]] },
    { name: 'Rack Attack', par: 6, target: 1, cue: [180, 490], objs: [[150, 190, 2], [180, 190, 4], [210, 190, 0], [165, 163, 5], [195, 163, 1]], bumpers: [[180, 340, 20]] }
  ];

  function segsFromRect(r) { const [x, y, w, h] = r; return [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]]; }

  /* ---------------- world ---------------- */
  let world = null;
  function build(i) {
    const h = HOLES[i], w = { idx: i, h, balls: [], segs: [], rects: h.rects || [], bumpers: (h.bumpers || []).map(b => ({ x: b[0], y: b[1], r: b[2], pulse: 0 })), sand: h.sand || [], water: h.water || [],
      boost: (h.boost || []).map(b => ({ x: b[0], y: b[1], w: b[2], h: b[3], dx: b[4], dy: b[5] })), tele: [], mill: null, strokes: 0, t: 0, events: [], sunkObjs: 0 };
    /* cushions (with pocket gaps) and outer bay */
    const G = GAP;
    w.segs.push([G, 0, TW - G, 0], [G, TH, TW - G, TH], [0, G, 0, TH - G], [TW, G, TW, TH - G]);
    const B = -17;
    w.segs.push([B, B, TW - B, B], [TW - B, B, TW - B, TH - B], [TW - B, TH - B, B, TH - B], [B, TH - B, B, B]);
    w.rects.forEach(r => segsFromRect(r).forEach(s => w.segs.push(s)));
    (h.tele || []).forEach(p => { w.tele.push({ a: { x: p[0][0], y: p[0][1] }, b: { x: p[1][0], y: p[1][1] } }); });
    if (h.mill) w.mill = { cx: h.mill[0], cy: h.mill[1], L: h.mill[2], om: h.mill[3], th: 0 };
    w.balls.push(mk('cue', h.cue[0], h.cue[1]));
    (h.objs || []).forEach(o => w.balls.push(mk('obj', o[0], o[1], o[2])));
    return w;
  }
  function mk(kind, x, y, n) { return { kind, x, y, vx: 0, vy: 0, n: n == null ? 0 : n, sunk: false, spawn: { x, y }, rest: { x, y }, cool: 0, fall: 0 }; }

  /* ---------------- physics ---------------- */
  const FRIC = 190, SAND = 1100, VMAX = 1250, SINKV = 720;
  function inRect(x, y, r) { return x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3]; }
  function closest(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    return [ax + dx * t, ay + dy * t];
  }
  function millSeg(m) { const c = Math.cos(m.th) * m.L, s = Math.sin(m.th) * m.L; return [m.cx - c, m.cy - s, m.cx + c, m.cy + s]; }
  function hitSeg(b, s, om, cx, cy, silent) {
    const [px, py] = closest(s[0], s[1], s[2], s[3], b.x, b.y);
    let dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
    const rad = om ? BR + 4 : BR;
    if (d >= rad) return;
    if (d < 1e-6) { const sx = s[2] - s[0], sy = s[3] - s[1], l = Math.hypot(sx, sy) || 1; dx = -sy / l; dy = sx / l; d = 1; }
    const nx = dx / d, ny = dy / d;
    b.x = px + nx * rad; b.y = py + ny * rad;
    let svx = 0, svy = 0; if (om) { svx = -om * (py - cy); svy = om * (px - cx); }
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = om ? 1.05 : 0.8;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      b.vx *= 0.996; b.vy *= 0.996;
      if (!silent && -vn > 60) world.events.push({ t: 'wall', v: -vn });
    }
  }
  function step(w, dt) {
    w.t += dt;
    if (w.mill) w.mill.th += w.mill.om * dt;
    const balls = w.balls;
    for (const b of balls) {
      if (b.sunk) continue;
      b.cool = Math.max(0, b.cool - dt);
      let sp = Math.hypot(b.vx, b.vy);
      /* zones */
      let dec = FRIC, inSand = false;
      for (const r of w.sand) if (inRect(b.x, b.y, r)) { dec = SAND; inSand = true; }
      for (const bo of w.boost) if (b.x > bo.x && b.x < bo.x + bo.w && b.y > bo.y && b.y < bo.y + bo.h) { b.vx += bo.dx * 1500 * dt; b.vy += bo.dy * 1500 * dt; sp = Math.hypot(b.vx, b.vy); if (sp > 0) w.events.push({ t: 'boost' }); }
      for (const r of w.water) if (inRect(b.x, b.y, r)) { b.sunk = true; w.events.push({ t: 'water', b }); }
      if (b.sunk) continue;
      for (const tp of w.tele) {
        if (b.cool > 0) continue;
        const A = tp.a, B = tp.b;
        if (Math.hypot(b.x - A.x, b.y - A.y) < 15) { b.x = B.x; b.y = B.y; b.cool = 0.5; w.events.push({ t: 'tele', x: B.x, y: B.y, ax: A.x, ay: A.y }); }
        else if (Math.hypot(b.x - B.x, b.y - B.y) < 15) { b.x = A.x; b.y = A.y; b.cool = 0.5; w.events.push({ t: 'tele', x: A.x, y: A.y, ax: B.x, ay: B.y }); }
      }
      if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; sp = VMAX; }
      if (sp > 0) {
        const ns = Math.max(0, sp - dec * dt) * (1 - 0.18 * dt);
        b.vx *= ns / sp; b.vy *= ns / sp;
        if (ns < 7 && !inSand) { b.vx = 0; b.vy = 0; } else if (ns < 22 && inSand) { b.vx = 0; b.vy = 0; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      /* walls */
      for (const s of w.segs) hitSeg(b, s, 0);
      if (w.mill) { const m = w.mill; hitSeg(b, millSeg(m), m.om, m.cx, m.cy); }
      /* bumpers */
      for (const bu of w.bumpers) {
        const dx = b.x - bu.x, dy = b.y - bu.y, d = Math.hypot(dx, dy), R = bu.r + BR;
        if (d < R && d > 0) {
          const nx = dx / d, ny = dy / d; b.x = bu.x + nx * R; b.y = bu.y + ny * R;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 2.25 * vn * nx; b.vy -= 2.25 * vn * ny; const s2 = Math.hypot(b.vx, b.vy); if (s2 < 230) { b.vx *= 230 / s2; b.vy *= 230 / s2; } bu.pulse = 1; w.events.push({ t: 'bumper' }); }
        }
      }
    }
    /* ball vs ball */
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], c = balls[j]; if (a.sunk || c.sunk) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d < BR * 2 && d > 0) {
        const nx = dx / d, ny = dy / d, ov = BR * 2 - d;
        a.x -= nx * ov / 2; a.y -= ny * ov / 2; c.x += nx * ov / 2; c.y += ny * ov / 2;
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn > 0) { const k = vn * 0.97; a.vx -= k * nx; a.vy -= k * ny; c.vx += k * nx; c.vy += k * ny; if (vn > 40) w.events.push({ t: 'ball', v: vn }); }
      }
    }
    /* pockets */
    for (const b of balls) {
      if (b.sunk) continue;
      const sp = Math.hypot(b.vx, b.vy);
      for (let p = 0; p < 4; p++) {
        const dx = POCKETS[p][0] - b.x, dy = POCKETS[p][1] - b.y, d = Math.hypot(dx, dy);
        if (d < PR + 2 && sp < SINKV) {
          if (d < PR * 0.8 || sp < 120) { b.sunk = true; b.vx = b.vy = 0; w.events.push({ t: 'pocket', b, p, x: POCKETS[p][0], y: POCKETS[p][1] }); break; }
          b.vx += dx / d * 1100 * dt; b.vy += dy / d * 1100 * dt;
        } else if (d < PR && sp >= SINKV && !b.lip) { b.lip = 1; w.events.push({ t: 'lip' }); }
      }
      if (b.lip && (Math.hypot(POCKETS[0][0] - b.x, POCKETS[0][1] - b.y) > PR * 1.4 && Math.hypot(POCKETS[1][0] - b.x, POCKETS[1][1] - b.y) > PR * 1.4 && Math.hypot(POCKETS[2][0] - b.x, POCKETS[2][1] - b.y) > PR * 1.4 && Math.hypot(POCKETS[3][0] - b.x, POCKETS[3][1] - b.y) > PR * 1.4)) b.lip = 0;
    }
  }
  const moving = w => w.balls.some(b => !b.sunk && (b.vx || b.vy));

  /* ---------------- game state ---------------- */
  let W, H, u, sc, ox, oy;
  let mode = 'title', t = 0, idx = 0, state = 'aim', aim = null, parts = [], floats = [], shotT = 0, shake = 0, winName = '', hintT = 0, round = [], pendingPen = 0, strikeFlash = 0, hintShown = false, cacheKey = '', cache = null;
  const bestHole = () => Kit.get('best', []);

  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 720);
    const top = 62 + 6, bot = 54;
    const aw = W - 12, ah = H - top - bot;
    sc = Math.min(aw / (TW + RAIL * 2), ah / (TH + RAIL * 2), 1.6);
    ox = (W - (TW + RAIL * 2) * sc) / 2 + RAIL * sc; oy = top + (ah - (TH + RAIL * 2) * sc) / 2 + RAIL * sc;
    cache = null;
  }
  S.onresize = layout; layout();

  function loadHole(i) {
    idx = i; world = build(i); state = 'aim'; aim = null; parts = []; floats = []; pendingPen = 0; hintT = 0; shake = 0;
    syncHud();
  }
  function syncHud() {
    $('hudL').textContent = 'Hole ' + (idx + 1);
    $('hudC').textContent = world.strokes + (world.strokes === 1 ? ' shot' : ' shots');
    $('hudR').textContent = 'Par ' + world.h.par;
  }

  /* ---------------- shooting ---------------- */
  function cueBall() { return world.balls[0]; }
  function shoot(angle, power) {
    const c = cueBall(); if (c.sunk) return;
    const sp = 150 + power * 1100;
    c.vx = Math.cos(angle) * sp; c.vy = Math.sin(angle) * sp;
    c.rest = { x: c.x, y: c.y };
    world.strokes++; world.balls.forEach(b => { if (b.kind === 'obj' && !b.sunk) b.rest = { x: b.x, y: b.y }; });
    state = 'roll'; shotT = 0; strikeFlash = 1;
    Kit.tone(160 + power * 60, 0.09, 'square', 0.14, -60); Kit.noise(0.05, 0.12 + power * 0.15, null, 1800); Kit.vibe(8 + power * 20);
    syncHud();
  }

  function handleEvents() {
    const w = world, ev = w.events; w.events = [];
    let wallCnt = 0, ballCnt = 0;
    for (const e of ev) {
      if (e.t === 'wall' && wallCnt++ < 1) { Kit.tone(120 + Math.min(e.v, 800) * 0.1, 0.06, 'triangle', clamp(e.v / 900, 0.04, 0.22)); }
      else if (e.t === 'ball' && ballCnt++ < 1) { Kit.tone(900 + Math.random() * 200, 0.05, 'triangle', clamp(e.v / 600, 0.05, 0.25)); Kit.noise(0.03, 0.08, null, 3000); }
      else if (e.t === 'bumper') { Kit.tone(520, 0.12, 'square', 0.1, 260); }
      else if (e.t === 'lip') { Kit.tone(300, 0.15, 'triangle', 0.15, -140); float(POCKETS[0][0], POCKETS[0][1], ''); toast('Lipped out!'); }
      else if (e.t === 'tele') { Kit.tone(300, 0.3, 'sine', 0.12, 700); burst(e.ax, e.ay, '190,120,255', 10); burst(e.x, e.y, '190,120,255', 12); }
      else if (e.t === 'water') { splash(e.b); }
      else if (e.t === 'pocket') { pocketed(e); }
    }
  }
  let toastAt = 0;
  function toast(msg) { if (t - toastAt > 1) { toastAt = t; Kit.toast(msg); } }
  function splash(b) {
    burst(b.x, b.y, '170,220,255', 16); Kit.noise(0.3, 0.2, null, 700); Kit.tone(180, 0.3, 'sine', 0.2, -100); Kit.vibe(30);
    float(b.x, b.y, 'Splash! +1'); penalty(b);
  }
  function penalty(b) {
    world.strokes++; pendingPen++; syncHud();
    b.sunk = false; b.vx = b.vy = 0; const r = b.kind === 'cue' ? b.rest : b.spawn; b.x = r.x; b.y = r.y; clearSpot(b);
  }
  function clearSpot(b) {
    for (let k = 0; k < 40; k++) {
      let ok = true;
      for (const o of world.balls) if (o !== b && !o.sunk && Math.hypot(o.x - b.x, o.y - b.y) < BR * 2.1) { ok = false; b.x += rnd(-12, 12); b.y += rnd(-12, 12); break; }
      if (ok) break;
    }
  }
  function pocketed(e) {
    const b = e.b, w = world;
    Kit.tone(240, 0.25, 'sine', 0.22, -120); Kit.noise(0.18, 0.2, null, 900); Kit.vibe(25);
    burst(e.x, e.y, '255,214,94', 12);
    const good = e.p === w.h.target;
    if (b.kind === 'cue') {
      if (good && !(w.h.objs && w.h.objs.length)) { b.sunk = true; return win(); }
      float(e.x, e.y, 'Scratch! +1'); toast('Scratch! The white ball is back'); penalty(b);
    } else {
      if (good) { w.sunkObjs++; float(e.x, e.y, 'Potted!'); Kit.tone(660, 0.2, 'triangle', 0.2, 300); if (w.sunkObjs >= w.h.objs.length) win(); }
      else { float(e.x, e.y, 'Wrong pocket +1'); toast('Wrong pocket! Ball returns'); penalty(b); }
    }
  }

  function win() {
    if (state === 'win') return;
    state = 'win'; const w = world, d = w.strokes - w.h.par;
    winName = w.strokes === 1 ? 'Corner in one!' : d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : '+' + d;
    const bests = bestHole(); if (!bests[idx] || w.strokes < bests[idx]) { bests[idx] = w.strokes; Kit.set('best', bests); }
    round[idx] = w.strokes;
    Kit.banner(winName, w.strokes + (w.strokes === 1 ? ' shot' : ' shots') + ' (par ' + w.h.par + ')');
    [523, 659, 784, 1047].forEach((f, i) => Kit.tone(f, 0.22, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + i * 0.1 : 0));
    for (let i = 0; i < 70; i++) parts.push({ x: S.W / 2 + rnd(-30, 30), y: S.H * 0.4, vx: rnd(-300, 300), vy: rnd(-460, -80), life: rnd(0.9, 1.7), age: 0, c: ['255,176,46', '45,226,197', '255,95,176', '255,255,255', '255,214,94'][i % 5], r: rnd(3, 6), g: 650, screen: true });
    setTimeout(() => { if (state === 'win') showResult(); }, 1500);
  }
  function showResult() {
    $('hud').classList.remove('show');
    const w = world, last = idx === HOLES.length - 1;
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    if (last) {
      let tot = 0, par = 0, rows = '';
      HOLES.forEach((h, i) => { if (round[i] != null) { tot += round[i]; par += h.par; rows += row((i + 1) + '. ' + h.name, round[i] + ' / ' + h.par); } });
      const d = tot - par;
      $('resTitle').textContent = 'Round complete!';
      $('resStats').innerHTML = row('Total', tot + ' shots (' + (d === 0 ? 'even' : (d > 0 ? '+' : '') + d) + ')', true) + rows;
      $('btnAgain').textContent = 'Play again';
    } else {
      $('resTitle').textContent = winName;
      $('resStats').innerHTML = row(w.h.name, w.strokes + ' / par ' + w.h.par, true) + row('Your best', bestHole()[idx] + ' shots') + row('Next up', HOLES[idx + 1].name);
      $('btnAgain').textContent = 'Next hole';
    }
    $('btnMenu').textContent = 'Menu';
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBall(g, cw / 2, ch / 2, 34, 'cue', 0, 0); g.fillStyle = '#ffb02e'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(w.strokes === 1 ? 'ACE' : 'GG', cw / 2, ch - 8);
    Kit.show('over');
  }

  function burst(x, y, c, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-140, 140), vy: rnd(-180, 60), life: rnd(0.3, 0.6), age: 0, c, r: rnd(1.5, 3.5), g: 400 }); }
  function float(x, y, txt) { if (txt) floats.push({ x, y, txt, age: 0 }); }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode === 'play' && world) {
      if (state === 'roll') {
        shotT += dt;
        const n = Math.ceil(dt / (1 / 240));
        for (let i = 0; i < n; i++) { step(world, dt / n); handleEvents(); if (state === 'win') break; }
        if (state === 'roll' && (!moving(world) || shotT > 14)) {
          if (shotT > 14) world.balls.forEach(b => { b.vx = b.vy = 0; });
          if (!moving(world)) { state = 'aim'; pendingPen = 0; }
        }
      } else {
        if (world.mill) world.mill.th += world.mill.om * dt;
        /* dead cue ball guard */
        if (cueBall().sunk && state === 'aim') { const b = cueBall(); b.sunk = false; b.x = b.rest.x; b.y = b.rest.y; }
      }
      world.bumpers.forEach(b => { b.pulse = Math.max(0, b.pulse - dt * 4); });
    }
    strikeFlash = Math.max(0, strikeFlash - dt * 6);
    hintT += dt;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 400) * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 1) floats.splice(i, 1); }
  }

  /* ---------------- aiming ---------------- */
  const toTable = (px, py) => [(px - ox) / sc, (py - oy) / sc];
  let drag = null;
  S.canvas.addEventListener('pointerdown', e => {
    Kit.ac(); if (mode !== 'play' || state !== 'aim') return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; aim = null;
  });
  S.canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX; drag.y = e.clientY;
    const dx = drag.x0 - drag.x, dy = drag.y0 - drag.y, len = Math.hypot(dx, dy), max = 150 * u + 40;
    aim = len < 12 ? null : { angle: Math.atan2(dy, dx), power: clamp((len - 12) / (max - 12), 0, 1) };
  });
  const endDrag = (e, fire) => {
    if (!drag || e.pointerId !== drag.id) return; drag = null;
    if (fire && aim && mode === 'play' && state === 'aim') { shoot(aim.angle, aim.power); }
    aim = null;
  };
  S.canvas.addEventListener('pointerup', e => endDrag(e, true));
  S.canvas.addEventListener('pointercancel', e => endDrag(e, false));

  /* ray preview: first hit of a ball (radius BR) travelling along dir */
  function rayHit(x, y, dx, dy, maxLen) {
    let best = { t: maxLen, kind: null };
    const test = (t, kind, nx, ny, extra) => { if (t > 0.001 && t < best.t) best = { t, kind, nx, ny, extra }; };
    const segs = world.segs.slice(); if (world.mill) segs.push(millSeg(world.mill));
    for (const s of segs) {
      const ex = s[2] - s[0], ey = s[3] - s[1], l = Math.hypot(ex, ey), tx = ex / l, ty = ey / l; let nx = -ty, ny = tx;
      const den = dx * nx + dy * ny;
      for (const sg of [1, -1]) {
        if (Math.abs(den) > 1e-6) {
          const off = BR * sg, tt = (off + (s[0] - x) * nx + (s[1] - y) * ny) / den;
          if (tt > 0) { const hx = x + dx * tt, hy = y + dy * tt, proj = (hx - s[0]) * tx + (hy - s[1]) * ty; if (proj >= 0 && proj <= l) test(tt, 'wall', nx * sg, ny * sg); }
        }
      }
      for (const [cx, cy] of [[s[0], s[1]], [s[2], s[3]]]) {
        const fx = x - cx, fy = y - cy, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - BR * BR, disc = bq * bq - cq;
        if (disc >= 0) { const tt = -bq - Math.sqrt(disc); if (tt > 0) { const hx = x + dx * tt - cx, hy = y + dy * tt - cy, dl = Math.hypot(hx, hy) || 1; test(tt, 'wall', hx / dl, hy / dl); } }
      }
    }
    const circ = (cx, cy, R, kind, obj) => {
      const fx = x - cx, fy = y - cy, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - R * R, disc = bq * bq - cq;
      if (disc >= 0) { const tt = -bq - Math.sqrt(disc); if (tt > 0) { const hx = x + dx * tt - cx, hy = y + dy * tt - cy, dl = Math.hypot(hx, hy) || 1; test(tt, kind, hx / dl, hy / dl, obj); } }
    };
    world.bumpers.forEach(b => circ(b.x, b.y, b.r + BR, 'bump'));
    world.balls.forEach((b, i) => { if (i && !b.sunk) circ(b.x, b.y, BR * 2, 'ball', b); });
    return best;
  }

  /* ---------------- rendering ---------------- */
  function sphere(g, x, y, r, col) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, shade(col, -0.5));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const f = v => Math.round(clamp(a < 0 ? v * (1 + a) : v + (255 - v) * a, 0, 255));
    return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
  }
  function drawBall(g, x, y, r, kind, n, spin) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.35, r * 0.95, r * 0.8, 0, 0, TAU); g.fill();
    if (kind === 'cue') { sphere(g, x, y, r, '#fff6e0'); }
    else {
      sphere(g, x, y, r, BALLCOL[n % BALLCOL.length]);
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(x, y, r * 0.48, 0, TAU); g.fill();
      g.fillStyle = '#111'; g.font = '700 ' + Math.max(7, r * 0.7) + 'px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n + 1), x, y + r * 0.04);
    }
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.15, -0.6, 0, TAU); g.fill();
    g.textBaseline = 'alphabetic';
  }

  function buildCache() {
    const dpr = S.dpr, cw = Math.round((TW + RAIL * 2) * sc * dpr), ch = Math.round((TH + RAIL * 2) * sc * dpr);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.scale(sc * dpr, sc * dpr); g.translate(RAIL, RAIL);
    const w = world;
    /* rails */
    const rg = g.createLinearGradient(-RAIL, -RAIL, TW + RAIL, TH + RAIL); rg.addColorStop(0, '#7a4a2a'); rg.addColorStop(0.5, '#5a341c'); rg.addColorStop(1, '#6e4125');
    g.fillStyle = rg; g.beginPath(); g.roundRect(-RAIL, -RAIL, TW + RAIL * 2, TH + RAIL * 2, 26); g.fill();
    g.strokeStyle = 'rgba(255,220,170,.18)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { g.beginPath(); const y = -RAIL + (TH + RAIL * 2) * (i / 26); g.moveTo(-RAIL + 6, y); g.bezierCurveTo(60, y + 3, 260, y - 3, TW + RAIL - 6, y + 1); g.stroke(); }
    g.strokeStyle = '#2a170b'; g.lineWidth = 3; g.beginPath(); g.roundRect(-RAIL + 1, -RAIL + 1, TW + RAIL * 2 - 2, TH + RAIL * 2 - 2, 25); g.stroke();
    /* felt */
    const fg = g.createRadialGradient(TW / 2, TH / 2, 40, TW / 2, TH / 2, 360); fg.addColorStop(0, '#26a77c'); fg.addColorStop(1, '#136b50');
    g.fillStyle = '#0d4a38'; g.fillRect(-12, -12, TW + 24, TH + 24);
    g.fillStyle = fg; g.fillRect(0, 0, TW, TH);
    let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (rr() < 0.5 ? '255,255,255' : '0,40,30') + ',' + (0.03 + rr() * 0.05) + ')'; g.fillRect(rr() * TW, rr() * TH, 1.6, 1.6); }
    /* head string and spot */
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1.5; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(14, TH * 0.72); g.lineTo(TW - 14, TH * 0.72); g.stroke(); g.setLineDash([]);
    /* sand */
    w.sand.forEach(r => {
      g.fillStyle = '#d9c28a'; g.fillRect(r[0], r[1], r[2], r[3]);
      for (let i = 0; i < r[2] * r[3] / 40; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(150,115,60,.45)' : 'rgba(255,245,210,.5)'; g.fillRect(r[0] + rr() * r[2], r[1] + rr() * r[3], 1.6, 1.6); }
      g.strokeStyle = 'rgba(120,90,40,.6)'; g.lineWidth = 2; g.strokeRect(r[0], r[1], r[2], r[3]);
    });
    /* cushions */
    const cush = (x1, y1, x2, y2) => { g.strokeStyle = '#0f5a43'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    cush(GAP, -3, TW - GAP, -3); cush(GAP, TH + 3, TW - GAP, TH + 3); cush(-3, GAP, -3, TH - GAP); cush(TW + 3, GAP, TW + 3, TH - GAP);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(GAP, 3); g.lineTo(TW - GAP, 3); g.moveTo(GAP, TH - 3); g.lineTo(TW - GAP, TH - 3); g.moveTo(3, GAP); g.lineTo(3, TH - GAP); g.moveTo(TW - 3, GAP); g.lineTo(TW - 3, TH - GAP); g.stroke();
    /* diamonds */
    g.fillStyle = '#f0cf7a';
    for (let i = 1; i < 8; i++) { const x = TW * i / 8, y = TH * i / 8; [[x, -15], [x, TH + 15]].forEach(p => { g.beginPath(); g.moveTo(p[0], p[1] - 4); g.lineTo(p[0] + 3, p[1]); g.lineTo(p[0], p[1] + 4); g.lineTo(p[0] - 3, p[1]); g.fill(); }); [[-15, y], [TW + 15, y]].forEach(p => { g.beginPath(); g.moveTo(p[0], p[1] - 4); g.lineTo(p[0] + 3, p[1]); g.lineTo(p[0], p[1] + 4); g.lineTo(p[0] - 3, p[1]); g.fill(); }); }
    /* pockets */
    POCKETS.forEach(p => {
      g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(p[0], p[1], PR + 5, 0, TAU); g.fill();
      const pg = g.createRadialGradient(p[0], p[1], 3, p[0], p[1], PR); pg.addColorStop(0, '#000'); pg.addColorStop(1, '#16110c');
      g.fillStyle = pg; g.beginPath(); g.arc(p[0], p[1], PR, 0, TAU); g.fill();
    });
    /* wall blocks */
    w.rects.forEach(r => {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(r[0] + 3, r[1] + 5, r[2], r[3], 6); g.fill();
      const wg = g.createLinearGradient(r[0], r[1], r[0], r[1] + r[3]); wg.addColorStop(0, '#f4e3bd'); wg.addColorStop(1, '#c9a46a');
      g.fillStyle = wg; g.beginPath(); g.roundRect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8, 7); g.fill();
      g.fillStyle = '#e0b255'; g.fillRect(r[0] - 4, r[1] - 4, r[2] + 8, 3);
      g.strokeStyle = '#7a5a30'; g.lineWidth = 2; g.beginPath(); g.roundRect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8, 7); g.stroke();
    });
    return c;
  }

  function drawFlag(x, y, tt) {
    /* pin flag planted in the target pocket, drawn toward the table centre */
    const dir = [x < TW / 2 ? 1 : -1, y < TH / 2 ? 1 : -1];
    const fx = x + dir[0] * 20, fy = y + dir[1] * 20;
    ctx.save(); ctx.translate(fx, fy);
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(tt * 4); ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-dir[0] * 20, -dir[1] * 20, PR + 7 + Math.sin(tt * 4) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -44); ctx.stroke();
    ctx.fillStyle = '#e5383b'; ctx.beginPath(); ctx.moveTo(1, -44); ctx.lineTo(24 + Math.sin(tt * 5) * 2, -37 + Math.sin(tt * 6)); ctx.lineTo(1, -29); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 9px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('1', 9, -34);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 6, 2.5, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  function drawDyn(tt) {
    const w = world;
    /* water */
    w.water.forEach(r => {
      const g = ctx.createLinearGradient(r[0], r[1], r[0], r[1] + r[3]); g.addColorStop(0, '#2aa4e8'); g.addColorStop(1, '#1768b8');
      ctx.fillStyle = '#e0b255'; ctx.fillRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6); ctx.fillStyle = g; ctx.fillRect(r[0], r[1], r[2], r[3]);
      ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); const y = r[1] + r[3] * (0.25 + k * 0.28); for (let x = r[0]; x <= r[0] + r[2]; x += 8) { const yy = y + Math.sin(x * 0.08 + tt * 2 + k) * 2.4; x === r[0] ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
      ctx.restore();
    });
    /* boost pads */
    w.boost.forEach(b => {
      ctx.fillStyle = 'rgba(255,176,46,.22)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = 'rgba(255,176,46,.8)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip(); ctx.fillStyle = 'rgba(255,230,140,.9)';
      const ang = Math.atan2(b.dy, b.dx), off = (tt * 60) % 36;
      for (let k = -1; k < 8; k++) { const d = k * 36 + off; ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(ang); const along = (b.dx ? b.w : b.h); const px = -along / 2 + d % (along + 36); ctx.beginPath(); ctx.moveTo(px, -12); ctx.lineTo(px + 14, 0); ctx.lineTo(px, 12); ctx.lineTo(px + 5, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
    });
    /* portals */
    w.tele.forEach((p, i) => [p.a, p.b].forEach((q, j) => {
      const col = i ? '255,120,200' : '120,200,255';
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(' + col + ',' + (0.8 - k * 0.2) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, 17 - k * 4.5, 17 - k * 4.5, 0, tt * (2 + k) + j, tt * (2 + k) + j + 4.2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(' + col + ',.25)'; ctx.beginPath(); ctx.arc(q.x, q.y, 14, 0, TAU); ctx.fill();
    }));
    /* bumpers */
    w.bumpers.forEach(b => {
      const s = 1 + b.pulse * 0.12; ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(b.x + 3, b.y + 5, b.r * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,95,176,' + (0.4 + b.pulse * 0.6) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * s + 4, 0, TAU); ctx.stroke();
      const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, 2, b.x, b.y, b.r * s); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#ff7ac6'); g.addColorStop(1, '#a1186b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.32, 0, TAU); ctx.fill();
    });
    /* windmill */
    if (w.mill) {
      const m = w.mill, s = millSeg(m);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s[0] + 3, s[1] + 5); ctx.lineTo(s[2] + 3, s[3] + 5); ctx.stroke();
      ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
      ctx.strokeStyle = '#f4e3bd'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
      ctx.fillStyle = '#e5383b'; ctx.beginPath(); ctx.arc(m.cx, m.cy, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(m.cx, m.cy, 5, 0, TAU); ctx.fill();
    }
    /* flag */
    drawFlag(POCKETS[w.h.target][0], POCKETS[w.h.target][1], tt);
    /* balls */
    w.balls.forEach(b => { if (!b.sunk) drawBall(ctx, b.x, b.y, BR, b.kind, b.n); });
  }

  function drawAim() {
    const c = cueBall(); if (!aim || c.sunk) return;
    const dx = Math.cos(aim.angle), dy = Math.sin(aim.angle), p = aim.power;
    const len = 80 + p * 300, hit = rayHit(c.x, c.y, dx, dy, len);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.4; ctx.setLineDash([2, 7]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x + dx * BR, c.y + dy * BR); ctx.lineTo(c.x + dx * hit.t, c.y + dy * hit.t); ctx.stroke(); ctx.setLineDash([]);
    if (hit.kind) {
      const gx = c.x + dx * hit.t, gy = c.y + dy * hit.t;
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy, BR, 0, TAU); ctx.stroke();
      const rem = Math.max(0, len - hit.t);
      if (hit.kind === 'ball') { const b = hit.extra, ex = b.x - gx, ey = b.y - gy, el = Math.hypot(ex, ey) || 1; ctx.strokeStyle = 'rgba(255,214,94,.9)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + ex / el * Math.min(70, rem + 30), b.y + ey / el * Math.min(70, rem + 30)); ctx.stroke(); ctx.setLineDash([]); }
      else { const dot = dx * hit.nx + dy * hit.ny, rx = dx - 2 * dot * hit.nx, ry = dy - 2 * dot * hit.ny; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + rx * Math.min(110, rem), gy + ry * Math.min(110, rem)); ctx.stroke(); ctx.setLineDash([]); }
    }
    /* cue stick */
    const back = 14 + p * 54, ang = aim.angle, sx = c.x - dx * (BR + back), sy = c.y - dy * (BR + back);
    ctx.translate(sx, sy); ctx.rotate(ang);
    const L = 260, g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#f2d49b'); g.addColorStop(1, '#a36f33');
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(-L, 7); ctx.lineTo(-L, 12); ctx.lineTo(0, 6); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-L, -5.5); ctx.lineTo(-L, 5.5); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b1d40'; ctx.fillRect(-L * 0.45, -4, L * 0.45 - 40, 8); ctx.fillStyle = '#e0b255'; ctx.fillRect(-L * 0.45 - 6, -4.6, 5, 9.2);
    ctx.fillStyle = '#6db6d6'; ctx.fillRect(-1, -2.2, 6, 4.4); ctx.fillStyle = '#fff'; ctx.fillRect(4, -2.2, 3, 4.4);
    ctx.restore();
    /* power bar */
    ctx.save(); ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    const bw = Math.min(220, W * 0.6), bx = (W - bw) / 2, by = H - 34;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
    const gg = ctx.createLinearGradient(bx, 0, bx + bw, 0); gg.addColorStop(0, '#2de2c5'); gg.addColorStop(0.6, '#ffd45e'); gg.addColorStop(1, '#ff5a5a');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(10, bw * p), 12, 6); ctx.fill(); ctx.restore();
  }

  function background(tt) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1230'); g.addColorStop(1, '#0d0818');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* neon strips and glow */
    const rg = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, H * 0.7); rg.addColorStop(0, 'rgba(255,60,160,.14)'); rg.addColorStop(1, 'rgba(255,60,160,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(45,226,197,.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const y = H * (i / 9) + ((tt * 8) % (H / 9)); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  function render(dt) {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    background(t);
    if (mode === 'title' || !world) return;
    ctx.save();
    if (shake > 0) { ctx.translate(rnd(-1, 1) * shake * 5, rnd(-1, 1) * shake * 4); shake = Math.max(0, shake - dt * 3); }
    if (!cache || cacheKey !== idx + ':' + sc + ':' + S.dpr) { cache = buildCache(); cacheKey = idx + ':' + sc + ':' + S.dpr; }
    ctx.drawImage(cache, ox - RAIL * sc, oy - RAIL * sc, (TW + RAIL * 2) * sc, (TH + RAIL * 2) * sc);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.rect(-RAIL, -RAIL, TW + RAIL * 2, TH + RAIL * 2); ctx.clip();
    drawDyn(t); drawAim();
    parts.filter(p => !p.screen).forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    floats.forEach(f => { const k = f.age; ctx.globalAlpha = 1 - k * k; ctx.font = '700 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; ctx.fillStyle = '#ffd45e'; const fx = clamp(f.x, 60, TW - 60), fy = clamp(f.y, 40, TH - 20) - k * 26; ctx.strokeText(f.txt, fx, fy); ctx.fillText(f.txt, fx, fy); ctx.globalAlpha = 1; });
    ctx.restore(); ctx.restore();
    parts.filter(p => p.screen).forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.fillRect(p.x, p.y, p.r, p.r * 1.6); }); ctx.globalAlpha = 1;
    /* first-hole hint */
    const h = world.h.hint;
    if (mode === 'play' && state === 'aim' && h && !aim && world.strokes === 0) {
      ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.font = '700 ' + Math.round(16 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fdf3e0'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
      ctx.strokeText(h, W / 2, H - 22); ctx.fillText(h, W / 2, H - 22); ctx.restore();
    }
  }

  /* title art: ball rolling into a flagged corner */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const k = (t * 0.45) % 1, px = w - 46, py = h - 34;
    c.fillStyle = '#136b50'; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 16); c.fill();
    c.strokeStyle = '#6e4125'; c.lineWidth = 10; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 18); c.stroke();
    c.fillStyle = '#c99a3a'; c.beginPath(); c.arc(px, py, 27, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(px, py, 22, 0, TAU); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(px - 24, py - 20); c.lineTo(px - 24, py - 62); c.stroke(); c.fillStyle = '#e5383b'; c.beginPath(); c.moveTo(px - 23, py - 62); c.lineTo(px - 2, py - 55); c.lineTo(px - 23, py - 47); c.fill();
    const e = k < 0.8 ? k / 0.8 : 1, bx = 54 + (px - 54) * e * e * 0.0 + (px - 54) * (1 - Math.pow(1 - e, 2)), by = h * 0.3 + (py - h * 0.3) * (1 - Math.pow(1 - e, 2));
    const rs = k > 0.8 ? clamp(1 - (k - 0.8) * 5, 0, 1) : 1;
    if (rs > 0) { c.save(); c.translate(bx, by); c.scale(rs, rs); drawBall(c, 0, 0, 14, 'cue', 0); c.restore(); }
    c.setLineDash([2, 7]); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(54, h * 0.3); c.lineTo(px, py); c.stroke(); c.setLineDash([]);
  }

  /* ---------------- flow ---------------- */
  function startHole(i) { mode = 'play'; loadHole(i); Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); }
  function startRound() { round = []; startHole(0); }
  function pause(auto) { if (mode !== 'play' || state === 'win') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  function openHoles() {
    mode = 'title'; const bests = bestHole(), grid = $('holegrid'); grid.innerHTML = '';
    HOLES.forEach((h, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lv';
      b.innerHTML = (i + 1) + '<small>' + (bests[i] ? 'Best ' + bests[i] : 'Par ' + h.par) + '</small><em>' + h.name + '</em>';
      b.addEventListener('click', () => { round = []; startHole(i); });
      grid.appendChild(b);
    });
    Kit.show('holes');
  }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', startRound);
  $('btnPick').addEventListener('click', openHoles);
  $('btnHolesBack').addEventListener('click', () => Kit.show('title'));
  $('btnAgain').addEventListener('click', () => { if (idx === HOLES.length - 1) startRound(); else startHole(idx + 1); });
  $('btnRestart').addEventListener('click', () => { mode = 'play'; startHole(idx); });
  $('btnMenu').addEventListener('click', toMenu);
  addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'p') (mode === 'play' ? pause() : mode === 'pause' ? resume() : 0); });

  loadHole(0); mode = 'title';
  Kit.loop((dt, tt) => {
    t = tt; S.watch(dt);
    if (mode !== 'pause') update(dt);
    if (mode === 'play' || mode === 'pause') { syncHud(); render(dt); } else { render(dt); }
    drawTitleArt();
  });

  /* test hooks */
  window.__corner = {
    HOLES, build, step,
    sim(i, angle, power) {
      const prev = world, w = build(i); world = w;
      const c = w.balls[0], sp = 150 + power * 1100; c.vx = Math.cos(angle) * sp; c.vy = Math.sin(angle) * sp; c.rest = { x: c.x, y: c.y };
      let res = null, pen = 0;
      for (let k = 0; k < 240 * 14 && !res; k++) {
        step(w, 1 / 240);
        for (const e of w.events) {
          if (e.t === 'pocket') {
            const b = e.b, good = e.p === w.h.target;
            if (b.kind === 'cue') { if (good && !(w.h.objs && w.h.objs.length)) res = 'win'; else { pen++; b.sunk = false; b.x = b.rest.x; b.y = b.rest.y; b.vx = b.vy = 0; } }
            else if (good) { w.sunkObjs++; if (w.sunkObjs >= w.h.objs.length) res = 'win'; } else { pen++; b.sunk = false; b.x = b.spawn.x; b.y = b.spawn.y; b.vx = b.vy = 0; }
          } else if (e.t === 'water') { pen++; const b = e.b; b.sunk = false; b.vx = b.vy = 0; const r = b.kind === 'cue' ? b.rest : b.spawn; b.x = r.x; b.y = r.y; }
        }
        w.events = [];
        if (!res && !w.balls.some(b => !b.sunk && (b.vx || b.vy))) break;
      }
      world = prev;
      return { res, pen, potted: w.sunkObjs };
    },
    start: startHole, get state() { return { mode, state, idx, strokes: world && world.strokes, balls: world && world.balls.map(b => [b.x | 0, b.y | 0, b.sunk]) }; },
    shoot, setAim(a, p) { aim = { angle: a, power: p }; }
  };
})();
