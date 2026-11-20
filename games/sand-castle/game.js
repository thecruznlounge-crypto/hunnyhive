/* Sand Castle - pour, pack, plant a flag, survive the tide. */
(function () {
  'use strict';
  Kit.ns('sand-castle');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const GW = 84;
  let W, H, cs, GH, floorRow, lineRow, grid, hp, off, octx, img;
  function layout() {
    W = S.W; H = S.H; cs = W / GW; GH = Math.ceil(H / cs); floorRow = GH - Math.ceil(96 / cs) - 1;
    off = document.createElement('canvas'); off.width = GW; off.height = GH; octx = off.getContext('2d'); img = octx.createImageData(GW, GH);
  }
  S.onresize = () => { layout(); resetGrid(); };

  let mode = 'title', phase = 'build', t = 0, level = 1, score = 0, grains = 0, wetL = 0, tool = 'pour', flag = null, waves = [], waveIdx = 0, waveCount = 0, settle = 0, ptr = null, stars = 0, shake = 0, parts = [], floats = [], flip = 0;
  const EMPTY = 0, SAND = 1, PACK = 2, ROCK = 4;

  function resetGrid() {
    grid = new Uint8Array(GW * GH); hp = new Uint8Array(GW * GH);
    for (let y = floorRow; y < GH; y++) for (let x = 0; x < GW; x++) grid[y * GW + x] = ROCK;
  }
  layout(); resetGrid();

  function lvlParams(L) { return { grains: Math.round(900 + L * 160), wet: 700 + L * 80, line: Math.min(44, 14 + L * 3), waves: Math.min(5, 2 + Math.floor((L - 1) / 2)), hMax: 15 + L * 2.2 }; }

  function startLevel() {
    if (level > 1) Kit.banner('Level ' + level, TH().name);
    const P = lvlParams(level); resetGrid();
    grains = P.grains; wetL = P.wet; lineRow = floorRow - P.line; flag = null; waves = []; waveIdx = 0; waveCount = P.waves; phase = 'build'; settle = 0; parts = []; floats = [];
    setTool('pour'); $('bTide').disabled = true; sync();
  }
  function sync() { $('hudL').textContent = 'Lv ' + level; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = phase === 'tide' ? 'Wave ' + Math.min(waveIdx + 1, waveCount) + '/' + waveCount : '● ' + grains; }
  function setTool(k) { tool = k; ['Pour', 'Pack', 'Flag'].forEach(n => $('t' + n).classList.toggle('on', n.toLowerCase() === k)); }
  ['Pour', 'Pack', 'Flag'].forEach(n => $('t' + n).addEventListener('click', () => { if (phase === 'build') setTool(n.toLowerCase()); }));
  $('bTide').addEventListener('click', () => { if (phase !== 'build' || !flag) return; phase = 'tide'; waves = []; waveIdx = 0; spawnWave(); ['tPour', 'tPack', 'tFlag', 'bTide'].forEach(i => $(i).disabled = true); Kit.banner('Tide is coming!'); Kit.tone(160, 0.6, 'sine', 0.15, 80); sync(); });

  function topSolid(x) { for (let y = 0; y < GH; y++) if (grid[y * GW + x]) return y; return GH; }
  function solid(x, y) { return x >= 0 && x < GW && y >= 0 && y < GH && grid[y * GW + x] !== EMPTY; }

  /* ---------- input ---------- */
  function cellOf(e) { return { x: clamp(Math.floor(e.clientX / cs), 0, GW - 1), y: clamp(Math.floor(e.clientY / cs), 0, GH - 1) }; }
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); if (mode !== 'play' || phase !== 'build') return; ptr = cellOf(e); if (tool === 'flag') plant(ptr.x); try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {} });
  S.canvas.addEventListener('pointermove', e => { if (ptr) { ptr = cellOf(e); if (tool === 'flag') plant(ptr.x); } });
  const up = () => { ptr = null; }; S.canvas.addEventListener('pointerup', up); S.canvas.addEventListener('pointercancel', up);
  function plant(x) {
    const ty = topSolid(x); if (ty >= GH) return;
    flag = { x, y: ty - 1, vy: 0, fall: false }; $('bTide').disabled = false; Kit.tone(660, 0.08, 'triangle', 0.12);
  }
  function inputTick() {
    if (!ptr) return;
    if (tool === 'pour' && grains > 0) {
      const n = Math.min(grains, 9);
      for (let i = 0; i < n; i++) { const x = clamp(ptr.x + Math.round(rnd(-2, 2)), 0, GW - 1), y = Math.max(1, ptr.y); if (grid[y * GW + x] === EMPTY) { grid[y * GW + x] = SAND; grains--; } }
      if (Math.random() < 0.3) Kit.noise(0.05, 0.03, null, 2500);
      sync();
    } else if (tool === 'pack' && wetL > 0) {
      const r = 5; let c = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const x = ptr.x + dx, y = ptr.y + dy; if (x < 0 || x >= GW || y < 0 || y >= GH) continue; const i = y * GW + x; if (grid[i] === SAND && wetL > 0) { grid[i] = PACK; hp[i] = 70; wetL--; c++; } }
      if (c && Math.random() < 0.4) Kit.noise(0.06, 0.04, null, 900);
    }
  }

  /* ---------- sand sim ---------- */
  function simSand() {
    flip ^= 1;
    for (let y = floorRow - 1; y >= 0; y--) {
      for (let k = 0; k < GW; k++) {
        const x = flip ? k : GW - 1 - k, i = y * GW + x;
        if (grid[i] !== SAND) continue;
        const b = i + GW;
        if (grid[b] === EMPTY) { grid[b] = SAND; grid[i] = EMPTY; continue; }
        const d = Math.random() < 0.5 ? -1 : 1, x1 = x + d, x2 = x - d;
        if (x1 >= 0 && x1 < GW && grid[b + d] === EMPTY && grid[i + d] === EMPTY) { grid[b + d] = SAND; grid[i] = EMPTY; }
        else if (x2 >= 0 && x2 < GW && grid[b - d] === EMPTY && grid[i - d] === EMPTY && Math.random() < 0.6) { grid[b - d] = SAND; grid[i] = EMPTY; }
      }
    }
  }

  /* ---------- tide ---------- */
  function spawnWave() {
    const P = lvlParams(level), f = waveCount > 1 ? waveIdx / (waveCount - 1) : 1;
    waves.push({ x: -12, h: Math.max(9, P.hMax * (0.55 + 0.45 * f)), sp: 24 + level * 1.2 + waveIdx * 2 });
  }
  function updateTide(dt) {
    const w = waves[waves.length - 1];
    if (!w) return;
    w.x += w.sp * dt;
    const band = 9, hCells = Math.round(w.h), y0 = floorRow - hCells;
    for (let x = Math.max(0, Math.floor(w.x - band)); x <= Math.min(GW - 1, Math.floor(w.x)); x++) {
      for (let y = Math.max(0, y0); y < floorRow; y++) {
        const i = y * GW + x, c = grid[i];
        if (c === SAND) { if (Math.random() < 0.28) { grid[i] = EMPTY; if (Math.random() < 0.15) parts.push({ x: x * cs, y: y * cs, vx: rnd(10, 60), vy: rnd(-40, 0), age: 0 }); } }
        else if (c === PACK) { const dmg = 140 * dt * (1 + 0.04 * level); hp[i] = Math.max(0, hp[i] - Math.max(1, Math.round(dmg * 0.5))); if (hp[i] <= 0) grid[i] = EMPTY; }
      }
    }
    if (Math.random() < 0.3) Kit.noise(0.08, 0.04, null, 700);
    if (w.x > GW + band + 4) {
      if (waveIdx + 1 < waveCount) { waveIdx++; spawnWave(); sync(); } else { phase = 'settle'; settle = 0; }
    }
  }
  function updateFlag(dt) {
    if (!flag) return;
    const below = solid(flag.x, flag.y + 1);
    if (!below) { flag.fall = true; flag.vy += 60 * dt; flag.y += flag.vy * dt; if (solid(flag.x, Math.ceil(flag.y) + 1)) { flag.y = Math.ceil(flag.y); flag.vy = 0; flag.fall = false; } }
    else { flag.vy = 0; flag.fall = false; }
    if (flag.y > floorRow - 1) flag.y = floorRow - 1;
    if (solid(flag.x, Math.floor(flag.y))) { flag.y = Math.floor(flag.y) - 1; }
  }

  function endLevel() {
    const h = lineRow - flag.y, ok = flag.y <= lineRow;
    if (ok) {
      stars = h >= 14 ? 3 : h >= 6 ? 2 : 1; const pts = 100 * level + stars * 50; score += pts;
      floats.push({ x: W / 2, y: H * 0.4, txt: '+' + pts, age: 0 }); Kit.banner('Castle holds!', '★'.repeat(stars)); Kit.tone(523, 0.15, 'triangle', 0.2); Kit.tone(784, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.12 : 0); Kit.vibe(20);
      phase = 'won'; settle = 0; sync();
    } else { gameOver(); }
  }
  function gameOver() {
    phase = 'lost'; mode = 'over'; Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); Kit.vibe(50);
    const nb = level > Kit.get('best', 0); if (nb) Kit.set('best', level);
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      $('resTitle').textContent = nb ? 'New best!' : 'Washed away!';
      $('resStats').innerHTML = row('Level reached', level, nb) + row('Score', score.toLocaleString()) + row('Best level', Math.max(level, Kit.get('best', 0)));
      const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
      c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      Desert.camel(g, cw / 2, ch - 8, Math.min(cw / 160, ch / 140), { mood: 'scared' });
      Kit.show('over');
    }, 1300);
  }

  function update(dt) {
    if (mode !== 'play') return;
    if (phase === 'build') inputTick();
    simSand();
    if (phase === 'tide') updateTide(dt);
    if (phase === 'tide' || phase === 'settle') updateFlag(dt);
    if (phase === 'settle') { settle += dt; if (settle > 1.2) endLevel(); }
    if (phase === 'won') { settle += dt; if (settle > 2.2) { level++; startLevel(); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > 0.8) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 1.2) floats.splice(i, 1); }
  }

  /* ---------- render ---------- */
  function paintGrid() {
    const d = img.data;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, c = grid[i], o = i * 4;
      if (c === EMPTY) { d[o + 3] = 0; continue; }
      const n = ((x * 7 + y * 13) % 5) * 3;
      let r, g, b;
      if (c === SAND) { r = 236 - n; g = 196 - n; b = 118 - n; }
      else if (c === PACK) { const f = hp[i] / 70; r = 196 * (0.7 + 0.3 * f) - n; g = 140 * (0.7 + 0.3 * f) - n; b = 78 * (0.7 + 0.3 * f) - n; }
      else { r = 176 - n; g = 120 - n; b = 62 - n; }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
  }
  function drawFlag(c, fx, fy, k) {
    const px = (fx + 0.5) * cs, py = (fy + 1) * cs, ph = 8 * cs;
    c.strokeStyle = '#5a3a1a'; c.lineWidth = Math.max(2, cs * 0.7); c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - ph); c.stroke();
    c.fillStyle = '#ff4d3a'; c.beginPath(); c.moveTo(px, py - ph); const w = 4.5 * cs, wv = Math.sin(t * 6) * cs * 0.5; c.quadraticCurveTo(px + w * 0.5, py - ph - cs * 1.2 + wv, px + w, py - ph + cs * 0.3 + wv); c.lineTo(px, py - ph + 3.2 * cs); c.closePath(); c.fill();
  }
  const THEMES = [
    { name: 'Sunny Shore', sky: ['#59a8e8', '#ffe2a8', '#f6cf8a'], sea: '#3aa3de', sun: '#fff6d0', night: false, deco: 'gulls' },
    { name: 'Golden Hour', sky: ['#7a5ac8', '#ff9a6a', '#ffd89a'], sea: '#c8688a', sun: '#fff0c0', night: false, deco: 'boat' },
    { name: 'Storm Front', sky: ['#4a5a78', '#8898b0', '#c8c0a8'], sea: '#4a7090', sun: '#d8dce0', night: false, deco: 'storm' },
    { name: 'Tropical Cove', sky: ['#2aa8e0', '#9ae8e0', '#fff0b8'], sea: '#1ac0c8', sun: '#fffbe0', night: false, deco: 'palm' },
    { name: 'Moonlit Beach', sky: ['#0a1040', '#2a3a8a', '#8a7aa8'], sea: '#2a5aa0', sun: '#eef0ff', night: true, deco: 'stars' }
  ];
  const TH = () => THEMES[(level - 1) % THEMES.length];
  function drawBackdrop() {
    const th = TH(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (th.night || th.deco === 'stars') { ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + i)); ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.5), 2, 2); } ctx.globalAlpha = 1; }
    const sx = W * 0.8, sy = H * 0.14, sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130); sg.addColorStop(0, th.night ? 'rgba(220,230,255,.6)' : 'rgba(255,250,210,.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.45);
    ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sx, sy, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (th.night ? 0.12 : th.deco === 'storm' ? 0.7 : 0.7) + ')'; for (let i = 0; i < 4; i++) { const x = ((i * 150 + t * (6 + i * 2)) % (W + 160)) - 80, y = 50 + (i * 61) % (H * 0.28); [[0, 0, 22], [22, -6, 18], [-22, -2, 15], [42, 2, 13]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0], y + c[1], c[2], 0, TAU); ctx.fill(); }); }
    const hy = floorRow * cs - 90;
    { const top = floorRow * cs - 90, sg2 = ctx.createLinearGradient(0, top, 0, floorRow * cs); sg2.addColorStop(0, th.sea); sg2.addColorStop(1, 'rgba(255,255,255,.55)'); ctx.globalAlpha = 0.85; ctx.fillStyle = sg2; ctx.fillRect(0, top, W, 90); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const wy = top + 12 + (i % 4) * 18, wx = ((i * 71 + t * 12) % (W + 60)) - 30; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 12, wy - 4, wx + 24, wy); ctx.stroke(); } }
    if (th.deco === 'boat') { ctx.fillStyle = '#6a3a28'; ctx.beginPath(); ctx.moveTo(W * 0.3, hy + 8); ctx.lineTo(W * 0.3 + 40, hy + 8); ctx.lineTo(W * 0.3 + 32, hy + 18); ctx.lineTo(W * 0.3 + 8, hy + 18); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W * 0.3 + 20, hy - 22); ctx.lineTo(W * 0.3 + 20, hy + 6); ctx.lineTo(W * 0.3 + 36, hy + 6); ctx.fill(); }
    if (th.deco === 'gulls') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; for (let i = 0; i < 3; i++) { const x = ((t * 30 + i * 120) % (W + 60)) - 30, y = H * 0.22 + i * 24 + Math.sin(t * 3 + i) * 5, f = Math.sin(t * 8 + i) * 5; ctx.beginPath(); ctx.moveTo(x - 10, y + f); ctx.quadraticCurveTo(x - 5, y - 6, x, y); ctx.quadraticCurveTo(x + 5, y - 6, x + 10, y + f); ctx.stroke(); } }
    if (th.deco === 'palm') { const px = W * 0.9, py = floorRow * cs - 10; ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - 16, py - 70, px - 6, py - 130); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; ctx.strokeStyle = i % 2 ? '#2f8a44' : '#43a85a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(px - 6, py - 130); ctx.quadraticCurveTo(px - 6 + Math.cos(a) * 36, py - 130 + Math.sin(a) * 30 - 8, px - 6 + Math.cos(a) * 52, py - 122 + Math.sin(a) * 30 + 16); ctx.stroke(); } }
    if (th.deco === 'storm') { ctx.strokeStyle = 'rgba(200,220,255,.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const x = (i * 83 + t * 220) % (W + 40), y = (i * 47 + t * 520) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke(); } }
    const sy2 = floorRow * cs - 3 * cs; ctx.fillStyle = th.sea; ctx.fillRect(0, sy2, 14, H - sy2); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(12, sy2, 3, H - sy2);
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    drawBackdrop();
    if (mode === 'title') return;
    if (mode !== 'title') {
      /* line */
      ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, (lineRow + 1) * cs); ctx.lineTo(W, (lineRow + 1) * cs); ctx.stroke(); ctx.restore();
      ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText('FLAG MUST STAND ABOVE', W - 8, lineRow * cs + 2 * cs - 8 - 14 * 0);
      paintGrid(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, GH * cs);
      if (flag) drawFlag(ctx, flag.x, flag.y);
      if (ptr && phase === 'build') { ctx.strokeStyle = tool === 'pack' ? 'rgba(80,170,255,.9)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((ptr.x + 0.5) * cs, (ptr.y + 0.5) * cs, tool === 'pack' ? 5 * cs : 2.5 * cs, 0, TAU); ctx.stroke(); }
      if (phase === 'tide') {
        const w = waves[waves.length - 1];
        if (w) {
          const x1 = w.x * cs, x0 = Math.max(0, (w.x - 9) * cs), top = (floorRow - Math.round(w.h)) * cs, fl = floorRow * cs;
          const wg = ctx.createLinearGradient(0, top, 0, fl); wg.addColorStop(0, 'rgba(120,210,255,.75)'); wg.addColorStop(1, 'rgba(30,120,200,.8)');
          ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(x0, fl); ctx.lineTo(x0, top + 14); ctx.quadraticCurveTo((x0 + x1) / 2, top - 8 + Math.sin(t * 9) * 3, x1, top); ctx.quadraticCurveTo(x1 + 10, (top + fl) / 2, x1, fl); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, top + 14); ctx.quadraticCurveTo((x0 + x1) / 2, top - 8, x1, top); ctx.stroke();
        }
      }
      parts.forEach(p => { ctx.globalAlpha = 1 - p.age / 0.8; ctx.fillStyle = '#e0b46a'; ctx.fillRect(p.x, p.y, cs, cs); }); ctx.globalAlpha = 1;
      floats.forEach(f => { ctx.globalAlpha = 1 - f.age / 1.2; ctx.font = '700 28px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(90,40,10,.7)'; ctx.lineWidth = 5; ctx.fillStyle = '#fff6d0'; ctx.strokeText(f.txt, f.x, f.y - f.age * 50); ctx.fillText(f.txt, f.x, f.y - f.age * 50); ctx.globalAlpha = 1; });
      if (phase === 'build' && level === 1 && !flag) { ctx.font = '700 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a2a12'; ctx.fillText('Pour sand, Pack it, then plant the Flag', W / 2, H * 0.3); }
    }
  }

  /* title art: castle with flag */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const s = Math.min(w / 260, h / 140), cx = w / 2, by = h - 6;
    c.save(); c.translate(cx, by); c.scale(s, s);
    c.fillStyle = '#d9a35a'; c.beginPath(); c.moveTo(-110, 0); c.lineTo(110, 0); c.lineTo(80, -18); c.lineTo(-80, -18); c.fill();
    c.fillStyle = '#e8b866'; c.fillRect(-60, -70, 120, 55);
    [[-70, -90], [-35, -105], [0, -90], [35, -105], [70, -90]].forEach(([x, y]) => { c.fillRect(x - 17, y, 34, 75); });
    c.fillStyle = '#e8b866'; for (let i = -3; i <= 3; i++) c.fillRect(i * 17 - 6, -118, 12, 12);
    c.fillStyle = '#b87f3a'; c.beginPath(); c.arc(0, -15, 15, Math.PI, 0); c.fill(); c.fillRect(-15, -15, 30, 15);
    c.strokeStyle = '#5a3a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -118); c.lineTo(0, -150); c.stroke();
    c.fillStyle = '#ff4d3a'; c.beginPath(); c.moveTo(0, -150); c.quadraticCurveTo(10, -158 + Math.sin(t * 6) * 2, 22, -146 + Math.sin(t * 6) * 2); c.lineTo(0, -138); c.fill();
    c.restore();
  }

  function start() { level = 1; score = 0; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); ['tPour', 'tPack', 'tFlag'].forEach(i => $(i).disabled = false); startLevel(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const origStart = startLevel;
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode === 'play') update(Math.min(dt, 0.05)); render(); drawTitleArt(); });

  window.__sand = { setLevel(n) { level = n; startLevel(); }, get state() { return { mode, phase, level, score, grains, wetL, flag: flag && { x: flag.x, y: flag.y }, lineRow, floorRow, GW, GH, waveIdx, waveCount, cs }; }, pour(x, y, n) { for (let k = 0; k < n; k++) { const xx = clamp(x + Math.round(rnd(-2, 2)), 0, GW - 1); if (grid[y * GW + xx] === EMPTY) { grid[y * GW + xx] = SAND; } } }, packAll() { for (let i = 0; i < grid.length; i++) if (grid[i] === SAND) { grid[i] = PACK; hp[i] = 70; } }, plant, tide() { $('bTide').click(); } };
})();
