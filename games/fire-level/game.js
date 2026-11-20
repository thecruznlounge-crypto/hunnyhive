/* Fire Level - soak the flames before the building burns. */
(function () {
  'use strict';
  Kit.ns('fire-level');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const THEMES = [{ name: 'Apartments', sky: ['#1b2a52', '#3a2a50'], wall: '#8a5a48', win: '#2a3350' }, { name: 'Office Tower', sky: ['#14223a', '#2a3a5a'], wall: '#5a6a84', win: '#1c2a44' }, { name: 'Warehouse', sky: ['#2a1a2a', '#503030'], wall: '#7a6a58', win: '#2a2a30' }, { name: 'Hotel', sky: ['#101a3a', '#3a1a4a'], wall: '#a07a60', win: '#2a2038' }, { name: 'Skyscraper', sky: ['#080c1c', '#1a2040'], wall: '#44506a', win: '#101830' }];
  let W, H, u, bx, by, bw, bh, cols, rows, cw, chh;
  let mode = 'title', stage = 1, score = 0, t = 0, fires = [], water = 100, integrity = 100, aim = null, spraying = false, hyd = [], hydT = 6, spawnT = 1, parts = [], steam = [], state = 'play', stateT = 0, outCount = 0, goal = 8, spread = 0, outTotal = 0, smoke = [];
  const best = () => Kit.get('best', 0), th = () => THEMES[(stage - 1) % THEMES.length];
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); bx = 22; bw = W - 44; by = 92; bh = H - by - 170 * u; cols = 3 + (stage >= 3 ? 1 : 0); rows = 3 + Math.min(3, Math.floor(stage / 2)); cw = bw / cols; chh = bh / rows; }
  S.onresize = layout; layout();
  const wpos = (c, r) => ({ x: bx + (c + 0.5) * cw, y: by + (r + 0.5) * chh });
  const nozzle = () => ({ x: W / 2, y: H - 120 * u });
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + outCount + '/' + goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '💧' + Math.round(water) + '%'; $('crowdFill').style.width = clamp(integrity, 0, 100) + '%'; }
  function ignite() { const free = []; for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (!fires.some(f => f.c === c && f.r === r)) free.push({ c, r }); if (!free.length) return; const n = pick(free); fires.push({ c: n.c, r: n.r, hp: 1, size: 0.3, age: 0, big: stage >= 2 && Math.random() < 0.25, st: 0 }); fires[fires.length - 1].mhp = fires[fires.length - 1].big ? 2.2 : 1.1; fires[fires.length - 1].hp = fires[fires.length - 1].mhp; }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.txt) q.y -= 28 * dt; else { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 220 * dt; } }); parts = parts.filter(q => q.age < q.life); steam.forEach(q => { q.age += dt; q.x += q.vx * dt; q.y -= 30 * dt; }); steam = steam.filter(q => q.age < q.life);
    if (mode !== 'play') return; stateT += dt;
    if (state === 'lost') { if (stateT > 1.4) gameOver(); return; } if (state === 'clear') { if (stateT > 1.6) { stage++; newStage(); } return; }
    spawnT -= dt; if (spawnT <= 0) { if (fires.length < 3 + stage) ignite(); spawnT = Math.max(0.9, 3 - stage * 0.3) * rnd(0.8, 1.2); }
    spread += dt; if (spread > Math.max(2.4, 5.5 - stage * 0.5)) { spread = 0; const src = pick(fires.filter(f => f.size > 0.8)); if (src && fires.length < cols * rows) { const d = pick([[1, 0], [-1, 0], [0, -1], [0, 1]]), c = src.c + d[0], r = src.r + d[1]; if (c >= 0 && r >= 0 && c < cols && r < rows && !fires.some(f => f.c === c && f.r === r)) { fires.push({ c, r, size: 0.3, age: 0, big: false, mhp: 1.1, hp: 1.1 }); } } }
    fires.forEach(f => { f.age += dt; f.size = Math.min(1, f.size + dt * 0.25); integrity -= dt * (0.28 + stage * 0.03) * f.size * (f.big ? 1.6 : 1); });
    /* spraying */
    const nz = nozzle(); if (spraying && aim && water > 0) {
      water = Math.max(0, water - dt * 11); for (let k = 0; k < 3; k++) { const a = Math.atan2(aim.y - nz.y, aim.x - nz.x) + rnd(-0.03, 0.03), d = Math.hypot(aim.x - nz.x, aim.y - nz.y) * rnd(0.85, 1); parts.push({ x: nz.x + Math.cos(a) * d, y: nz.y + Math.sin(a) * d, vx: rnd(-40, 40), vy: rnd(-60, 10), age: 0, life: rnd(0.2, 0.4), r: rnd(2, 4), cc: '#9fe0ff' }); }
      fires.forEach(f => { const p = wpos(f.c, f.r); if (Math.hypot(aim.x - p.x, aim.y - p.y) < Math.min(cw, chh) * 0.55) { f.hp -= dt * (1 + 0.15 * stage * 0); if (Math.random() < 0.3) steam.push({ x: p.x + rnd(-14, 14), y: p.y + rnd(-10, 10), vx: rnd(-14, 14), age: 0, life: 0.8 }); } });
      hyd.forEach(h => { if (Math.hypot(aim.x - h.x, aim.y - h.y) < 36 * u) { h.fill += dt; if (h.fill > 0.35) { h.done = true; water = Math.min(100, water + 40); parts.push({ txt: '+WATER', x: h.x, y: h.y - 20, age: 0, life: 0.9 }); Kit.tone(880, 0.12, 'triangle', 0.15); } } else h.fill = Math.max(0, h.fill - dt); });
      if (Math.random() < 0.2) Kit.noise(0.04, 0.03);
    }
    hyd = hyd.filter(h => !h.done && (h.life -= dt) > 0); hydT -= dt; if (hydT <= 0 && water < 85) { hyd.push({ x: rnd(40, W - 40), y: by + bh + 14 * u + rnd(0, 20), fill: 0, life: 9 }); hydT = rnd(5, 8); } else if (hydT <= 0) hydT = 2;
    if (spraying && water <= 0 && Math.random() < 0.02) parts.push({ txt: 'Out of water!', x: nz.x, y: nz.y - 60, age: 0, life: 0.9 });
    const before = fires.length; fires = fires.filter(f => { if (f.hp <= 0) { const p = wpos(f.c, f.r), pts = f.big ? 200 : 100; score += pts; outCount++; outTotal++; parts.push({ txt: '+' + pts, x: p.x, y: p.y, age: 0, life: 0.9 }); for (let k = 0; k < 8; k++) steam.push({ x: p.x + rnd(-16, 16), y: p.y + rnd(-10, 10), vx: rnd(-20, 20), age: 0, life: 1 }); Kit.tone(660, 0.1, 'triangle', 0.18); return false; } return true; });
    if (fires.length !== before) syncHud();
    if (outCount >= goal) { state = 'clear'; stateT = 0; const b = 300 + Math.round(integrity) * 5; score += b; parts.push({ txt: 'Building saved! +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.6 }); Kit.tone(523, 0.12, 'triangle', 0.22); syncHud(); }
    if (integrity <= 0) { integrity = 0; state = 'lost'; stateT = 0; Kit.tone(120, 0.8, 'sawtooth', 0.2, -60); Kit.vibe(120); }
    syncHud();
  }
  function drawFire(x, y, s, big) { const k = Math.min(cw, chh) * 0.5 * s * (big ? 1.25 : 1); for (let i = 0; i < 3; i++) { const w = k * (1 - i * 0.27), h = k * 1.45 * (1 - i * 0.2) * (0.9 + 0.12 * Math.sin(t * 11 + i * 2 + x)); ctx.fillStyle = ['#ff4a1c', '#ff9a1c', '#ffe066'][i]; ctx.beginPath(); ctx.moveTo(x - w * 0.6, y + k * 0.5); ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.2, x + Math.sin(t * 9 + i) * 4, y - h * 0.7); ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.2, x + w * 0.6, y + k * 0.5); ctx.closePath(); ctx.fill(); } }
  function render() {
    const T = th(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect((i * 97) % W, (i * 53) % 90, 2, 2); }
    ctx.fillStyle = T.wall; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(bx - 8, by - 12, bw + 16, bh + 14, 8); ctx.fill(); ctx.stroke();
    const glow = clamp(fires.length / 6, 0, 1); ctx.fillStyle = 'rgba(255,90,20,' + glow * 0.28 + ')'; ctx.fillRect(bx - 8, by - 12, bw + 16, bh + 14);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const p = wpos(c, r), ww = cw * 0.62, wh = chh * 0.62; ctx.fillStyle = fires.some(f => f.c === c && f.r === r) ? '#2a0c08' : T.win; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(p.x - ww / 2, p.y - wh / 2, ww, wh, 6); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(p.x, p.y - wh / 2); ctx.lineTo(p.x, p.y + wh / 2); ctx.stroke(); }
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(0, by + bh + 2, W, H - by - bh); ctx.fillStyle = '#3a3a48'; ctx.fillRect(0, by + bh + 2, W, 8);
    fires.forEach(f => { const p = wpos(f.c, f.r); drawFire(p.x, p.y + 6, f.size, f.big); if (f.hp < f.mhp) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.roundRect(p.x - 20, p.y + chh * 0.34, 40, 6, 3); ctx.fill(); ctx.fillStyle = '#5ec8ff'; ctx.beginPath(); ctx.roundRect(p.x - 20, p.y + chh * 0.34, Math.max(3, 40 * f.hp / f.mhp), 6, 3); ctx.fill(); } });
    hyd.forEach(h => { const pulse = 0.5 + 0.5 * Math.sin(t * 8); ctx.fillStyle = 'rgba(94,200,255,' + (0.2 + pulse * 0.2) + ')'; ctx.beginPath(); ctx.arc(h.x, h.y, 30 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#e8433a'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(h.x - 10 * u, h.y - 14 * u, 20 * u, 26 * u, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd23a'; ctx.fillRect(h.x - 14 * u, h.y - 8 * u, 28 * u, 6 * u); ctx.strokeStyle = '#5ec8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, 32 * u, -Math.PI / 2, -Math.PI / 2 + TAU * h.fill / 0.35); ctx.stroke(); });
    const nz = nozzle(); if (spraying && aim && water > 0) { ctx.strokeStyle = 'rgba(159,224,255,.75)'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(nz.x, nz.y); ctx.quadraticCurveTo((nz.x + aim.x) / 2, Math.min(nz.y, aim.y) - 30, aim.x, aim.y); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
    parts.forEach(q => { if (q.txt) { ctx.globalAlpha = Math.min(1, (1 - q.age / q.life) * 2); ctx.font = '700 ' + Math.round(20 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = 1 - q.age / q.life; ctx.fillStyle = q.cc; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    steam.forEach(q => { ctx.globalAlpha = 0.5 * (1 - q.age / q.life); ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.arc(q.x, q.y, 6 + q.age * 10, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; });
    /* truck + mascot */
    ctx.fillStyle = '#d83a30'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(W / 2 - 110 * u, H - 100 * u, 220 * u, 60 * u, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd23a'; ctx.fillRect(W / 2 - 100 * u, H - 78 * u, 200 * u, 6 * u); ctx.fillStyle = '#333'; [-70, 70].forEach(o => { ctx.beginPath(); ctx.arc(W / 2 + o * u, H - 40 * u, 16 * u, 0, TAU); ctx.fill(); ctx.stroke(); });
    Heroes.draw(ctx, 'firepup', W / 2 - 60 * u, H - 96 * u, 0.62 * u, { t });
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(W / 2 + 10 * u, H - 144 * u, 100 * u, 12, 6); ctx.fill(); ctx.fillStyle = water < 25 ? '#ff6a52' : '#5ec8ff'; ctx.beginPath(); ctx.roundRect(W / 2 + 10 * u, H - 144 * u, Math.max(4, 100 * u * water / 100), 12, 6); ctx.fill();
    if (mode === 'play' && stage === 1 && outCount === 0) { ctx.font = '700 ' + Math.round(15 * u + 1) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; ctx.strokeText('Hold and drag onto the flames', W / 2, by - 24); ctx.fillText('Hold and drag onto the flames', W / 2, by - 24); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Building lost!'; $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Fires put out', outTotal) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw2 = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw2 * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'firepup', cw2 / 2, ch - 8, Math.min(cw2 / 130, ch / 125), {}); Kit.show('over');
  }
  function newStage() { layout(); fires = []; hyd = []; water = 100; integrity = 100; outCount = 0; goal = 6 + stage * 2; spawnT = 0.5; spread = 0; state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, th().name); ignite(); syncHud(); }
  function start() { stage = 1; score = 0; outTotal = 0; parts = []; steam = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newStage(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; spraying = false; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const g$ = $('game'); g$.addEventListener('pointerdown', e => { if (mode !== 'play') return; Kit.ac(); spraying = true; aim = { x: e.clientX, y: e.clientY }; try { g$.setPointerCapture(e.pointerId); } catch (x) { } });
  g$.addEventListener('pointermove', e => { if (spraying) aim = { x: e.clientX, y: e.clientY }; }); const up = () => { spraying = false; }; g$.addEventListener('pointerup', up); g$.addEventListener('pointercancel', up);
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); if (mode !== 'title') render(); else { ctx.fillStyle = '#0c1530'; ctx.fillRect(0, 0, W, H); } });
  window.__fire = { get state() { return { mode, stage, score, state, integrity, water, outCount, goal, fires: fires.map(f => ({ ...wpos(f.c, f.r), hp: f.hp })), hyd: hyd.map(h => ({ x: h.x, y: h.y })) }; }, aim(x, y, on) { aim = { x, y }; spraying = on; }, setStage(n) { stage = n; newStage(); } };
})();
