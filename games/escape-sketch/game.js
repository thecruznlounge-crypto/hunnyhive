/* Escape Sketch: sketch ladders, ropes, planks, tunnels, cutters and vehicles to get the prisoner out. */
(function () {
  'use strict';
  Kit.ns('escape-sketch');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const WW = 800, WH = 420, CS = 5, GW = WW / CS, GH = WH / CS;
  const ROCK = 1, BARS = 2, SPIKE = 3, PLANK = 4, WATER = 5;
  const TOOLS = { ladder: { n: 'Ladder', i: '🪜', k: 1 }, rope: { n: 'Rope', i: '➰', k: 1 }, plank: { n: 'Plank', i: '🟫', k: 1 }, dig: { n: 'Tunnel', i: '⛏', k: .8, r: 14 }, cut: { n: 'Cutters', i: '✂', k: .8, r: 14 }, car: { n: 'Vehicle', i: '🚗', k: .8 } };
  /* ---------- levels (cells of 20px, x0,y0,x1,y1 exclusive) ---------- */
  function base(f) { f(0, 19, 40, 21, ROCK); f(0, 0, 40, 1, ROCK); }
  const LEVELS = [
    { name: 'Over the wall', hint: 'A wall blocks the way. Sketch a ladder or hang a rope beside it.', ink: 380, tools: ['ladder', 'rope'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { base(f); f(18, 5, 20, 19, ROCK); } },
    { name: 'Crocodile moat', hint: 'Bridge the water with a plank, or sketch a vehicle to carry you across.', ink: 360, tools: ['plank', 'car'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { f(0, 19, 12, 21, ROCK); f(28, 19, 40, 21, ROCK); f(12, 19, 28, 21, WATER); f(0, 0, 40, 1, ROCK); } },
    { name: 'Cell bars', hint: 'Cutters clear the bars. Scribble over them at the height of the prisoner.', ink: 240, tools: ['cut'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { base(f); f(18, 1, 20, 19, BARS); } },
    { name: 'Dig it out', hint: 'Solid rock. Tunnel straight through it at floor height.', ink: 170, tools: ['dig'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { base(f); f(17, 1, 20, 19, ROCK); } },
    { name: 'Spike field', hint: 'The gap is too wide for a plank and your ink. A vehicle can carry you over.', ink: 270, tools: ['plank', 'car'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { f(0, 19, 8, 21, ROCK); f(32, 19, 40, 21, ROCK); f(8, 19, 32, 21, SPIKE); f(0, 0, 40, 1, ROCK); } },
    { name: 'Great escape', hint: 'Cut the bars, then bridge the water.', ink: 340, tools: ['cut', 'plank', 'car'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { base(f); f(7, 1, 9, 19, BARS); f(20, 19, 28, 21, WATER); } },
    { name: 'Everything', hint: 'Climb the wall, then cross the spikes. Spend your ink wisely.', ink: 560, tools: ['ladder', 'rope', 'plank', 'car'], start: [50, 380], exit: [725, 336, 36, 44], build: f => { f(0, 19, 20, 21, ROCK); f(34, 19, 40, 21, ROCK); f(20, 19, 34, 21, SPIKE); f(0, 0, 40, 1, ROCK); f(9, 6, 11, 19, ROCK); } }
  ];
  /* ---------- state ---------- */
  let li = 0, L, grid, cgrid, base0, bg, strokes = [], tool = 'ladder', ink = 0, mode = 'plan', t = 0, simT = 0, hero, cars = [], msg = '', drawing = null, best = Kit.get('stars', {}), ended = false;
  const cellsOf = (x0, y0, x1, y1, v, g) => { for (let y = y0 * 4; y < y1 * 4; y++) for (let x = x0 * 4; x < x1 * 4; x++) g[y * GW + x] = v; };
  function load(i) {
    li = clamp(i, 0, LEVELS.length - 1); L = LEVELS[li]; base0 = new Uint8Array(GW * GH); L.build((a, b, c, d, v) => cellsOf(a, b, c, d, v, base0));
    strokes = []; mode = 'plan'; ended = false; tool = L.tools[0]; rebuild(); buildTools(); updateInk(); setMsg(L.hint); $('lvl').textContent = 'Level ' + (li + 1) + ' · ' + L.name; Kit.hideScreens(); $('bar').classList.add('show'); $('hud').classList.add('show');
  }
  const at = (g, x, y) => (x < 0 || x >= WW || y < 0) ? (g === cgrid ? 0 : ROCK) : y >= WH ? 0 : g[((y / CS) | 0) * GW + ((x / CS) | 0)];
  const setCell = (g, x, y, v) => { const cx = (x / CS) | 0, cy = (y / CS) | 0; if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) g[cy * GW + cx] = v; };
  function brush(g, x, y, r, v, only) { for (let yy = y - r; yy <= y + r; yy += CS) for (let xx = x - r; xx <= x + r; xx += CS) if ((xx - x) * (xx - x) + (yy - y) * (yy - y) <= r * r) { const c = at(g, xx, yy); if (xx > 2 && xx < WW - 2 && yy > 2 && yy < WH - 2 && (!only || only.includes(c))) setCell(g, xx, yy, v); } }
  function seg(a, b, fn) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 2)); for (let i = 0; i <= n; i++) fn(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); }
  const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
  const costOf = s => plen(s.pts) * TOOLS[s.tool].k;
  function updateInk() { ink = strokes.reduce((a, s) => a + costOf(s), 0); $('inkFill').style.width = clamp(1 - ink / L.ink, 0, 1) * 100 + '%'; $('inkTxt').textContent = Math.max(0, Math.round(L.ink - ink)) + ' ink'; }
  function setMsg(m) { $('msg').textContent = m; }
  /* build the live world from base + sketches (done on GO) */
  function applySketches() {
    grid = base0.slice(); cgrid = new Uint8Array(GW * GH); cars = [];
    strokes.forEach(s => {
      const p = s.pts;
      if (s.tool === 'plank') p.forEach((q, i) => { if (i) seg(p[i - 1], q, (x, y) => brush(grid, x, y, 4, PLANK, [0])); });
      else if (s.tool === 'ladder') p.forEach((q, i) => { if (i) seg(p[i - 1], q, (x, y) => brush(cgrid, x, y, 3, 1)); });
      else if (s.tool === 'rope') { const x = p[0][0]; let y = p[0][1]; const len = plen(p); for (let k = 0; k < len; k += 3) { if (at(grid, x, y + k) === ROCK) break; brush(cgrid, x, y + k, 2, 1); } }
      else if (s.tool === 'dig') p.forEach((q, i) => { if (i) seg(p[i - 1], q, (x, y) => brush(grid, x, y, TOOLS.dig.r, 0, [ROCK, PLANK])); });
      else if (s.tool === 'cut') p.forEach((q, i) => { if (i) seg(p[i - 1], q, (x, y) => brush(grid, x, y, TOOLS.cut.r, 0, [BARS])); });
      else if (s.tool === 'car') { const b = bbox(p), w = Math.max(44, b.x1 - b.x0), h = clamp(b.y1 - b.y0, 20, 60); cars.push({ x0: (b.x0 + b.x1) / 2 - w / 2, y1: b.y1, w, h, on: false, pts: p }); }
    });
    paintBase();
  }
  const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); return { x0, y0, x1, y1 }; };
  function rebuild() { grid = base0.slice(); cgrid = new Uint8Array(GW * GH); cars = []; paintBase(); resetHero(); }
  function paintBase() {
    bg = document.createElement('canvas'); bg.width = WW; bg.height = WH; const c = bg.getContext('2d');
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const v = grid[y * GW + x]; if (!v || v === PLANK) continue; const px = x * CS, py = y * CS;
      if (v === ROCK) { c.fillStyle = ((x >> 2) + (y >> 2)) % 2 ? '#4d4668' : '#554d73'; c.fillRect(px, py, CS, CS); if (!grid[(y - 1) * GW + x] && y > 0) { c.fillStyle = '#8a82b0'; c.fillRect(px, py, CS, 2); } }
      else if (v === BARS) { if ((x & 3) < 1) { c.fillStyle = '#c0c8d8'; c.fillRect(px, py, CS, CS); } else if (!grid[(y - 1) * GW + x] || !grid[(y + 1) * GW + x]) { c.fillStyle = '#98a2b8'; c.fillRect(px, py, CS, CS); } }
      else if (v === WATER) { c.fillStyle = (y - 76) % 8 < 4 ? '#3a86ff' : '#2a6fe0'; c.fillRect(px, py, CS, CS); }
      else if (v === SPIKE) { c.fillStyle = '#cfd6e6'; const k = (x & 3); if (!grid[(y - 1) * GW + x]) { c.fillRect(px, py + 3 - k * 0, CS, CS); } else c.fillStyle = '#1a1330', c.fillRect(px, py, CS, CS); }
    }
    /* spike teeth */ c.fillStyle = '#e8edf8'; c.strokeStyle = '#1b1b2f'; c.lineWidth = 1.5; for (let x = 0; x < GW; x += 4) for (let y = 1; y < GH; y++) if (grid[y * GW + x] === SPIKE && grid[(y - 1) * GW + x] !== SPIKE) { c.beginPath(); c.moveTo(x * CS, y * CS + 8); c.lineTo(x * CS + 10, y * CS - 8); c.lineTo(x * CS + 20, y * CS + 8); c.closePath(); c.fill(); c.stroke(); }
  }
  /* ---------- hero ---------- */
  function resetHero() { hero = { x: L.start[0], y: L.start[1], vy: 0, dir: 1, st: 'walk', mantle: 0, turns: 0, ride: null, anim: 0, dead: false }; simT = 0; }
  const HW = 6, HH = 22;
  function blocked(x, y) { for (let yy = y - HH; yy < y; yy += 4) for (let xx = x - HW; xx <= x + HW; xx += 4) { const c = at(grid, xx, yy); if (c === ROCK || c === BARS || c === PLANK) return true; } return false; }
  const hazardAt = (x, y) => { const c = at(grid, x, y - 1); return c === SPIKE || c === WATER; };
  function climbNear(x, y) { for (let dx = -28; dx <= 28; dx += 2) for (let yy = y - HH; yy < y; yy += 4) if (at(cgrid, x + dx, yy)) return x + dx; return null; }
  function carOverlap(h) { return cars.find(c => !c.on && h.x + HW > c.x0 && h.x - HW < c.x0 + c.w && h.y > c.y1 - c.h - 4 && h.y - HH < c.y1 + 6); }
  function simStep(dt) {
    const h = hero; if (h.dead || mode !== 'sim') return; simT += dt; h.anim += dt;
    if (simT > 40) return fail('Stuck. The prisoner ran out of time.');
    if (h.st === 'ride') {
      const c = h.ride, nx = c.x0 + 50 * dt; let ok = nx + c.w < WW - 2; for (let yy = c.y1 - c.h; yy < c.y1 - 6 && ok; yy += 4) { const e = at(grid, nx + c.w, yy); if (e === ROCK || e === BARS || e === PLANK) ok = false; }
      if (ok) c.x0 = nx; else { h.st = 'walk'; h.y = c.y1 - 2; c.on = false; c.done = true; h.ride = null; h.vy = 0; }
      if (h.ride) { h.x = c.x0 + c.w / 2; h.y = c.y1 - 2; }
    } else if (h.st === 'climb') {
      h.y -= 46 * dt; const col = at(cgrid, h.x, h.y - 6) || at(cgrid, h.x, h.y - 16);
      if (!blocked(h.x + h.dir * 12, h.y) && !blocked(h.x, h.y) && blocked(h.x + h.dir * 12, h.y + 3) && h.y < h.cy0 - 12) { h.st = 'walk'; h.vy = 0; h.x += h.dir * 9; h.y -= 3; }
      else if (!col) { h.mantle += 46 * dt; if (h.mantle > 16) { h.st = 'walk'; h.mantle = 0; } }
      else h.mantle = 0;
      if (h.y < 24) h.y = 24;
    } else {
      const c = carOverlap(h); if (c) { c.on = true; h.st = 'ride'; h.ride = c; return; }
      const sup = blocked(h.x, h.y + 1);
      if (!sup) { const fx = h.x + h.dir * 28 * dt; if (!blocked(fx, h.y)) h.x = fx; h.vy += 900 * dt; let dy = h.vy * dt; while (dy > 0) { const s = Math.min(dy, 2); if (blocked(h.x, h.y + s)) { h.vy = 0; break; } h.y += s; dy -= s; if (hazardAt(h.x, h.y)) return fail(at(grid, h.x, h.y - 1) === WATER ? 'Splash! The prisoner fell in the water.' : 'Ouch! Spikes.'); } if (h.y > WH + 10) return fail('The prisoner fell out of the level.'); }
      else {
        h.vy = 0; const nx = h.x + h.dir * 40 * dt;
        if (!blocked(nx, h.y)) h.x = nx;
        else { let up = 0; for (let k = 1; k <= 6; k++) if (!blocked(nx, h.y - k)) { up = k; break; } if (up) { h.x = nx; h.y -= up; } else { const cx = climbNear(h.x + h.dir * 4, h.y); if (cx !== null) { h.st = 'climb'; h.x = cx; h.mantle = 0; h.cy0 = h.y; } else { h.dir = -h.dir; h.turns++; if (h.turns > 6) return fail('Dead end. Think about what is in the way.'); } } }
      }
    }
    const e = L.exit; if (h.x + HW > e[0] && h.x - HW < e[0] + e[2] && h.y > e[1] && h.y - HH < e[1] + e[3]) win();
  }
  function stars() { const left = 1 - ink / L.ink; return left > .45 ? 3 : left > .2 ? 2 : 1; }
  function win() { if (ended) return; ended = true; mode = 'done'; const s = stars(); best[li] = Math.max(best[li] || 0, s); Kit.set('stars', best); $('rTitle').textContent = 'Escaped!'; $('rStars').textContent = '★'.repeat(s) + '☆'.repeat(3 - s); $('rSub').textContent = s === 3 ? 'Barely any ink used.' : 'Use less ink for more stars.'; $('btnRNext').style.display = li < LEVELS.length - 1 ? '' : 'none'; Kit.show('res'); Kit.tone(600, .3, 'triangle', .1, 400); Kit.vibe(30); }
  function fail(m) { if (ended) return; ended = true; hero.dead = true; mode = 'done'; $('rTitle').textContent = 'Caught!'; $('rStars').textContent = ''; $('rSub').textContent = m; $('btnRNext').style.display = 'none'; Kit.show('res'); Kit.tone(160, .4, 'sawtooth', .1, -80); }
  function go() { if (mode !== 'plan') return; if (!strokes.length) { Kit.toast('Sketch something first'); return; } applySketches(); resetHero(); mode = 'sim'; ended = false; $('btnGo').textContent = '⟲ Reset'; setMsg(''); }
  function back() { mode = 'plan'; ended = false; Kit.hideScreens(); rebuild(); $('btnGo').textContent = '▶ Go'; setMsg(L.hint); }
  /* ---------- input ---------- */
  let sc = 1, ox = 0, oy = 0;
  S.onresize = () => { const land = S.W > S.H * 1.15, barW = land ? 168 : 0, barH = land ? 0 : 150, top = land ? 40 : 70, aw = S.W - barW, ah = S.H - barH - top; sc = Math.min(aw / WW, ah / WH); ox = (aw - WW * sc) / 2; oy = top + (ah - WH * sc) / 2; }; S.onresize();
  const wp = e => { const r = ctx.canvas.getBoundingClientRect(); return [(e.clientX - r.left - ox) / sc, (e.clientY - r.top - oy) / sc]; };
  const cv = $('game');
  cv.addEventListener('pointerdown', e => { if (mode !== 'plan') return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} drawing = { tool, pts: [wp(e)] }; });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const p = wp(e), l = drawing.pts[drawing.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 3) { drawing.pts.push([clamp(p[0], 0, WW), clamp(p[1], 0, WH)]); const c = costOf(drawing); if (ink + c > L.ink) { drawing.pts.pop(); } } });
  const endDraw = () => {
    if (!drawing) return; const d = drawing; drawing = null; if (d.pts.length < 2 || plen(d.pts) < 12) return;
    if (d.tool === 'rope') { const p = d.pts[0], ok = p[1] < 26 || [[0, -8], [0, -14], [-8, -8], [8, -8]].some(o => at(base0, p[0] + o[0], p[1] + o[1]) === ROCK); if (!ok) { Kit.toast('A rope has to hang from something'); return; } }
    strokes.push(d); updateInk();
  };
  cv.addEventListener('pointerup', endDraw); cv.addEventListener('pointercancel', endDraw);
  /* ---------- render ---------- */
  function drawHero(h) {
    ctx.save(); ctx.translate(h.x, h.y); const walk = h.st === 'walk' && Math.abs(h.vy) < 1, sw = walk ? Math.sin(h.anim * 12) : 0, climb = h.st === 'climb';
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(-4 - (climb ? Math.sin(h.anim * 10) * 3 : sw * 4), 0); ctx.moveTo(1, -9); ctx.lineTo(4 + (climb ? Math.sin(h.anim * 10) * 3 : sw * 4), 0); ctx.stroke();
    ctx.fillStyle = '#ff9f1c'; Art.rr(ctx, -6, -19, 12, 12, 4); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 1.6; for (let i = -14; i < -8; i += 4) { ctx.beginPath(); ctx.moveTo(-6, i); ctx.lineTo(6, i); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.beginPath(); if (climb) { ctx.moveTo(-5, -16); ctx.lineTo(-7, -26); ctx.moveTo(5, -16); ctx.lineTo(7, -24); } else { ctx.moveTo(-5, -16); ctx.lineTo(-8, -9 + sw * 2); ctx.moveTo(5, -16); ctx.lineTo(8, -9 - sw * 2); } ctx.stroke();
    ctx.fillStyle = '#ffd9c0'; ctx.beginPath(); ctx.arc(0, -25, 6.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1b1b2f'; ctx.beginPath(); ctx.arc(h.dir * 2.5, -26, 1.4, 0, TAU); ctx.fill(); ctx.restore();
  }
  function drawStroke(s, live) {
    const p = s.pts; if (p.length < 2) return; ctx.save(); ctx.lineCap = ctx.lineJoin = 'round'; ctx.globalAlpha = live ? .8 : 1;
    const path = () => { ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
    if (s.tool === 'plank') { path(); ctx.strokeStyle = '#6b3f1d'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = 'rgba(80,40,10,.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.stroke(); }
    else if (s.tool === 'ladder') { const n = p.length; for (let i = 1; i < n; i++) { const a = p[i - 1], b = p[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d * 5, ny = (b[0] - a[0]) / d * 5; ctx.strokeStyle = '#b87333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0] + nx, a[1] + ny); ctx.lineTo(b[0] + nx, b[1] + ny); ctx.moveTo(a[0] - nx, a[1] - ny); ctx.lineTo(b[0] - nx, b[1] - ny); ctx.stroke(); } let acc = 0; ctx.lineWidth = 2.5; for (let i = 1; i < n; i++) { const a = p[i - 1], b = p[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += d; if (acc > 9) { acc = 0; const dd = d || 1, nx = -(b[1] - a[1]) / dd * 5, ny = (b[0] - a[0]) / dd * 5; ctx.beginPath(); ctx.moveTo(b[0] + nx, b[1] + ny); ctx.lineTo(b[0] - nx, b[1] - ny); ctx.stroke(); } } }
    else if (s.tool === 'rope') { const x = p[0][0], y0 = p[0][1], len = plen(p); let yy = y0; for (let k = 0; k < len; k += 3) { if (at(grid, x, y0 + k) === ROCK) break; yy = y0 + k; } ctx.strokeStyle = '#d9b36c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, yy); ctx.stroke(); ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]); ctx.stroke(); }
    else if (s.tool === 'dig' || s.tool === 'cut') { path(); ctx.strokeStyle = s.tool === 'dig' ? 'rgba(255,210,63,.55)' : 'rgba(123,224,195,.6)'; ctx.lineWidth = 28; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.stroke(); }
    else if (s.tool === 'car') { const b = bbox(p), w = Math.max(44, b.x1 - b.x0), h = clamp(b.y1 - b.y0, 20, 60), x0 = (b.x0 + b.x1) / 2 - w / 2; ctx.fillStyle = 'rgba(255,255,255,.85)'; Art.rr(ctx, x0, b.y1 - h, w, h - 4, 6); ctx.fill(); ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 2.5; ctx.stroke(); path(); ctx.strokeStyle = '#e63946'; ctx.lineWidth = 3; ctx.stroke(); [x0 + 11, x0 + w - 11].forEach(wx => { ctx.fillStyle = '#1b1b2f'; ctx.beginPath(); ctx.arc(wx, b.y1 - 4, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#c0c8d8'; ctx.beginPath(); ctx.arc(wx, b.y1 - 4, 3, 0, TAU); ctx.fill(); }); }
    ctx.restore();
  }
  function drawCar(c) { const x0 = c.x0, w = c.w, h = c.h, y1 = c.y1; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.92)'; Art.rr(ctx, x0, y1 - h, w, h - 4, 6); ctx.fill(); ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 2.5; ctx.stroke(); [x0 + 11, x0 + w - 11].forEach(wx => { ctx.fillStyle = '#1b1b2f'; ctx.beginPath(); ctx.arc(wx, y1 - 4, 7, 0, TAU); ctx.fill(); }); ctx.restore(); }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.fillStyle = '#10091f'; ctx.fillRect(0, 0, S.W, S.H); if (!L) return;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc); ctx.beginPath(); ctx.rect(0, 0, WW, WH); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, '#fff6df'); g.addColorStop(1, '#ecd9a8'); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH); ctx.strokeStyle = 'rgba(80,120,200,.16)'; ctx.lineWidth = 1; for (let y = 20; y < WH; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WW, y); ctx.stroke(); }
    ctx.drawImage(bg, 0, 0);
    const e = L.exit; ctx.fillStyle = '#2ec4b6'; Art.rr(ctx, e[0], e[1], e[2], e[3], 6); ctx.fill(); ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 11px Fredoka,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', e[0] + e[2] / 2, e[1] + 14); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(e[0] + e[2] - 7, e[1] + e[3] / 2 + 6, 2.5, 0, TAU); ctx.fill();
    if (mode === 'plan') strokes.forEach(s => drawStroke(s)); else { strokes.forEach(s => { if (s.tool !== 'dig' && s.tool !== 'cut' && s.tool !== 'car') drawStroke(s); }); cars.forEach(drawCar); }
    if (drawing) drawStroke(drawing, true);
    drawHero(hero); ctx.restore();
  }
  let acc = 0;
  Kit.loop(dt => { S.watch(dt); t += dt; if (mode === 'sim') { acc += dt; while (acc > 1 / 120) { simStep(1 / 120); acc -= 1 / 120; } } else hero && (hero.anim += dt * .4); render(); });
  /* ---------- UI ---------- */
  function buildTools() {
    const row = $('tools'); row.innerHTML = '';
    L.tools.forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tool' + (k === tool ? ' on' : ''); b.innerHTML = '<span>' + TOOLS[k].i + '</span>' + TOOLS[k].n; b.onclick = () => { tool = k; row.querySelectorAll('.tool').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; row.appendChild(b); });
  }
  $('btnGo').onclick = () => { if (mode === 'plan') go(); else back(); };
  $('btnUndo').onclick = () => { if (mode !== 'plan') return; strokes.pop(); updateInk(); }; $('btnClear').onclick = () => { if (mode !== 'plan') return; strokes = []; updateInk(); };
  $('btnRetry').onclick = back; $('btnRNext').onclick = () => load(li + 1);
  $('btnPlay').onclick = () => { Kit.hideScreens(); load(Math.min(LEVELS.length - 1, Object.keys(best).length)); };
  $('btnLevels').onclick = () => { buildLevelGrid(); Kit.show('levels'); };
  $('btnLvlBack').onclick = () => Kit.show('title'); $('btnMenuQ').onclick = () => { mode = 'menu'; $('bar').classList.remove('show'); $('hud').classList.remove('show'); Kit.show('title'); };
  function buildLevelGrid() { const g = $('lvGrid'); g.innerHTML = ''; LEVELS.forEach((l, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lv'; b.innerHTML = '<b>' + (i + 1) + '</b><small>' + l.name + '</small><i>' + ('★'.repeat(best[i] || 0) + '☆'.repeat(3 - (best[i] || 0))) + '</i>'; b.onclick = () => load(i); g.appendChild(b); }); }
  Kit.wire({ onPause: () => { }, onQuit: () => { } });
  hero = { x: -50, y: 0, dir: 1, anim: 0, st: 'walk' }; L = null; Kit.show('title');
  window.__es = { blk: (x,y)=>blocked(x,y), dbg: (x,y)=>[at(cgrid,x,y),at(grid,x,y)], LEVELS, load, go, strokes: () => strokes, add: (tool, pts) => { strokes.push({ tool, pts }); updateInk(); }, sim: s => { for (let i = 0; i < s * 120 && mode === 'sim'; i++) simStep(1 / 120); }, mode: () => mode, hero: () => hero, ink: () => ink, back, msg: () => $('rSub').textContent };
})();
