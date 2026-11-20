/* Calling All Cars - dispatch the right unit to every emergency. */
(function () {
  'use strict';
  Kit.ns('calling-all-cars');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const COLS = 4, ROWS = 5;
  let W, H, u, mx, my, sx, sy, rosterY;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); rosterY = H - 112 * u - 14; mx = 44; const top = 78, bot = rosterY - 12; sx = (W - mx * 2) / (COLS - 1); sy = (bot - top - 30) / (ROWS - 1); my = top + 30; }
  S.onresize = layout; layout();
  const nodeXY = n => ({ x: mx + n.c * sx, y: my + n.r * sy });
  const TYPES = { police: { n: 'Police', c: ['#f2f6ff', '#2a62d8'], inc: 'Crime', ic: '★' }, medic: { n: 'Ambulance', c: ['#ffffff', '#e8433a'], inc: 'Injury', ic: '✚' }, fire: { n: 'Fire Truck', c: ['#ff6a52', '#c42f2f'], inc: 'Fire', ic: '▲' } };
  const THEMES = [{ name: 'Downtown', bg: '#26304a', blk: '#323e5c', rd: '#10131c' }, { name: 'Harbor', bg: '#1a3a52', blk: '#264a66', rd: '#0c1824' }, { name: 'Suburbs', bg: '#2a4a32', blk: '#386044', rd: '#142018' }, { name: 'Snowy Town', bg: '#4a5a72', blk: '#6a7a92', rd: '#2a323f' }, { name: 'Night City', bg: '#140a2a', blk: '#241444', rd: '#08040f' }];
  const BASE = { police: { c: 0, r: 0 }, medic: { c: COLS - 1, r: 0 }, fire: { c: 0, r: ROWS - 1 } };
  let mode = 'title', stage = 1, score = 0, strikes = 0, t = 0, units = [], incs = [], sel = -1, spawnT = 1, resolvedStage = 0, goal = 6, blocks = [], blockT = 8, parts = [], flash = 0, state = 'play', stateT = 0, resolvedTotal = 0, nextId = 1;
  const best = () => Kit.get('best', 0), th = () => THEMES[(stage - 1) % THEMES.length];

  function makeUnits() {
    units = []; const per = { police: 1 + (stage >= 2 ? 1 : 0), medic: 1 + (stage >= 3 ? 1 : 0), fire: 1 + (stage >= 4 ? 1 : 0) };
    Object.keys(per).forEach(k => { for (let i = 0; i < per[k]; i++) units.push({ type: k, base: BASE[k], at: { c: BASE[k].c, r: BASE[k].r }, st: 'idle', path: [], px: 0, py: 0, x: 0, y: 0, ang: 0, target: null, id: nextId++ }); });
    units.forEach(un => { const p = nodeXY(un.at); un.x = p.x; un.y = p.y; });
  }
  function edgeBlocked(a, b) { return blocks.some(k => (k.a.c === a.c && k.a.r === a.r && k.b.c === b.c && k.b.r === b.r) || (k.a.c === b.c && k.a.r === b.r && k.b.c === a.c && k.b.r === a.r)); }
  function bfs(from, to) {
    const q = [from], prev = {}, key = n => n.c + ',' + n.r; prev[key(from)] = null;
    while (q.length) { const n = q.shift(); if (n.c === to.c && n.r === to.r) break; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const m = { c: n.c + d[0], r: n.r + d[1] }; if (m.c < 0 || m.r < 0 || m.c >= COLS || m.r >= ROWS || key(m) in prev || edgeBlocked(n, m)) return; prev[key(m)] = n; q.push(m); }); }
    if (!(key(to) in prev)) return null; const path = []; let n = to; while (n) { path.unshift(n); n = prev[key(n)]; } return path;
  }
  function spawn() {
    const used = incs.map(i => i.c + ',' + i.r), bases = Object.values(BASE).map(b => b.c + ',' + b.r); const free = []; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const k = c + ',' + r; if (!used.includes(k) && !bases.includes(k)) free.push({ c, r }); } if (!free.length) return;
    const n = pick(free), type = pick(['police', 'medic', 'fire']); let need = [type]; if (stage >= 4 && Math.random() < 0.3) need = [type, type === 'fire' ? 'medic' : type === 'medic' ? 'police' : 'fire'];
    const pat = Math.max(11, 22 - stage * 1.6); incs.push({ id: nextId++, c: n.c, r: n.r, need, got: [], pat, pmax: pat, state: 'wait', prog: 0, age: 0 });
  }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + resolvedStage + '/' + goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function strike(msg, x, y) { strikes++; flash = 0.5; parts.push({ txt: msg, x, y, age: 0, life: 1.1 }); Kit.tone(160, 0.4, 'sawtooth', 0.18, -80); Kit.vibe(60); syncHud(); if (strikes >= 3) { state = 'lost'; stateT = 0; } }
  function dispatch(ui, inc) {
    const un = units[ui]; if (!un || un.st !== 'idle' || !inc || inc.state === 'done') return false; const need = inc.need.filter(n => !inc.got.includes(n) && !units.some(o => o.target === inc && o.type === n)); const p = nodeXY(inc);
    if (!inc.need.includes(un.type) || !need.includes(un.type)) { strike('Wrong unit!', p.x, p.y - 30); sel = -1; return false; }
    const path = bfs(un.at, { c: inc.c, r: inc.r }); if (!path) { parts.push({ txt: 'Road blocked', x: p.x, y: p.y - 30, age: 0, life: 1 }); return false; }
    un.path = path.slice(1); un.st = 'go'; un.target = inc; sel = -1; Kit.tone(660 + ui * 40, 0.08, 'square', 0.1); return true;
  }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; } else q.y -= 24 * dt; }); parts = parts.filter(q => q.age < q.life); flash = Math.max(0, flash - dt * 2);
    if (mode !== 'play') return; stateT += dt;
    if (state === 'lost') { if (stateT > 1.2) gameOver(); return; } if (state === 'clear') { if (stateT > 1.6) { stage++; newStage(); } return; }
    spawnT -= dt; if (spawnT <= 0 && incs.filter(i => i.state !== 'done').length < Math.min(5, 2 + Math.floor(stage / 2))) { spawn(); spawnT = Math.max(1.6, 4.2 - stage * 0.4) * rnd(0.8, 1.2); } else if (spawnT <= 0) spawnT = 0.6;
    if (stage >= 3) { blockT -= dt; if (blockT <= 0) { const c = rint(0, COLS - 2), r = rint(0, ROWS - 1), horiz = Math.random() < 0.5; blocks.push(horiz ? { a: { c, r }, b: { c: c + 1, r }, t: 9 } : { a: { c: Math.min(c, COLS - 1), r: Math.min(r, ROWS - 2) }, b: { c: Math.min(c, COLS - 1), r: Math.min(r, ROWS - 2) + 1 }, t: 9 }); blockT = rnd(6, 11); } blocks.forEach(b => b.t -= dt); blocks = blocks.filter(b => b.t > 0); }
    units.forEach(un => {
      if (un.st === 'go' || un.st === 'back') {
        const nxt = un.path[0]; if (!nxt) { if (un.st === 'go') { un.st = 'work'; arrive(un); } else { un.st = 'idle'; } return; }
        const p = nodeXY(nxt), dx = p.x - un.x, dy = p.y - un.y, d = Math.hypot(dx, dy), sp = (un.st === 'go' ? 190 : 150) * u * dt; un.ang = Math.atan2(dy, dx);
        if (d <= sp) { un.x = p.x; un.y = p.y; un.at = nxt; un.path.shift(); } else { un.x += dx / d * sp; un.y += dy / d * sp; }
      }
    });
    incs.forEach(i => { i.age += dt; if (i.state === 'wait') { i.pat -= dt; if (i.pat <= 0) { i.state = 'done'; const p = nodeXY(i); strike('Too late!', p.x, p.y - 30); units.forEach(un => { if (un.target === i) { un.target = null; if (un.st === 'go') { un.st = 'back'; un.path = bfs(un.at, un.base) || []; } } }); } } else if (i.state === 'work') { i.prog += dt / 1.3; if (i.prog >= 1) resolve(i); } });
    incs = incs.filter(i => i.state !== 'done' || i.fade > 0 || (i.fade = i.fade == null ? 0.5 : i.fade - dt) > 0 && false);
    incs = incs.filter(i => i.state !== 'done');
    units.forEach(un => { if (un.st === 'work' && (!un.target || un.target.state === 'done')) { un.st = 'back'; un.path = bfs(un.at, un.base) || []; un.target = null; } });
  }
  function arrive(un) { const i = un.target; if (!i || i.state === 'done') { un.st = 'back'; un.path = bfs(un.at, un.base) || []; return; } i.got.push(un.type); if (i.need.every(n => i.got.includes(n))) { i.state = 'work'; i.prog = 0; } }
  function resolve(i) {
    i.state = 'done'; const p = nodeXY(i), bonus = Math.round(100 * i.pat / i.pmax), pts = 150 * i.need.length + bonus; score += pts; resolvedStage++; resolvedTotal++; parts.push({ txt: '+' + pts, x: p.x, y: p.y - 30, age: 0, life: 1 }); for (let k = 0; k < 12; k++) parts.push({ x: p.x, y: p.y, vx: rnd(-100, 100), vy: rnd(-160, -20), age: 0, life: rnd(0.4, 0.8), r: rnd(2, 4), cc: '#7dea8a' }); Kit.tone(784, 0.1, 'triangle', 0.2); Kit.tone(1046, 0.15, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.09 : 0);
    units.forEach(un => { if (un.target === i) { un.target = null; un.st = 'back'; un.path = bfs(un.at, un.base) || []; } }); syncHud();
    if (resolvedStage >= goal) { state = 'clear'; stateT = 0; const b = 400 + (3 - strikes) * 100; score += b; parts.push({ txt: 'Shift clear! +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.6 }); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.15 : 0); syncHud(); }
  }
  function newStage() { makeUnits(); incs = []; blocks = []; sel = -1; resolvedStage = 0; goal = 5 + stage; spawnT = 0.6; blockT = 8; state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, th().name); syncHud(); }

  function drawVeh(x, y, ang, type, flashy, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); const c = TYPES[type].c, w = type === 'fire' ? 30 : 24;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(1, 3, w / 2 + 2, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c[0]; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-w / 2, -8, w, 16, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = c[1]; ctx.fillRect(-w / 2 + 3, -8, 6, 16); ctx.fillStyle = '#a8ddff'; ctx.fillRect(w / 2 - 9, -6, 6, 12); ctx.strokeRect(w / 2 - 9, -6, 6, 12);
    if (type === 'medic') { ctx.fillStyle = '#e8433a'; ctx.fillRect(-2, -5, 4, 10); ctx.fillRect(-5, -2, 10, 4); } if (type === 'fire') { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -3); ctx.lineTo(w / 2 - 10, -3); ctx.moveTo(-w / 2 + 4, 3); ctx.lineTo(w / 2 - 10, 3); ctx.stroke(); }
    if (flashy) { const r = Math.sin(t * 16) > 0; ctx.fillStyle = r ? '#ff3a2a' : '#3a7aff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; } ctx.restore();
  }
  function render() {
    const T = th(); ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    /* blocks and roads */
    ctx.fillStyle = T.blk; for (let c = 0; c < COLS - 1; c++) for (let r = 0; r < ROWS - 1; r++) { const a = nodeXY({ c, r }); ctx.beginPath(); ctx.roundRect(a.x + 12, a.y + 12, sx - 24, sy - 24, 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 3; k++) ctx.fillRect(a.x + 22 + k * 18 * u, a.y + 22, 10 * u, 8); ctx.fillStyle = T.blk; }
    ctx.lineCap = 'round'; ctx.strokeStyle = T.rd; ctx.lineWidth = 22 * u; for (let c = 0; c < COLS; c++) { const a = nodeXY({ c, r: 0 }), b = nodeXY({ c, r: ROWS - 1 }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } for (let r = 0; r < ROWS; r++) { const a = nodeXY({ c: 0, r }), b = nodeXY({ c: COLS - 1, r }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,230,120,.45)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]); for (let c = 0; c < COLS; c++) { const a = nodeXY({ c, r: 0 }), b = nodeXY({ c, r: ROWS - 1 }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } for (let r = 0; r < ROWS; r++) { const a = nodeXY({ c: 0, r }), b = nodeXY({ c: COLS - 1, r }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } ctx.setLineDash([]);
    blocks.forEach(k => { const a = nodeXY(k.a), b = nodeXY(k.b); ctx.strokeStyle = 'rgba(255,140,30,.9)'; ctx.lineWidth = 12 * u; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ff8a1c'; ctx.font = '700 ' + Math.round(16 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🚧', (a.x + b.x) / 2, (a.y + b.y) / 2 + 6); });
    /* stations */
    Object.keys(BASE).forEach(k => { const p = nodeXY(BASE[k]), c = TYPES[k].c; ctx.fillStyle = c[1]; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.roundRect(p.x - 26 * u, p.y - 24 * u, 52 * u, 48 * u, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(11 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k === 'medic' ? 'HOSPITAL' : k === 'fire' ? 'FIRE ST.' : 'POLICE', p.x, p.y - 12 * u); ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.fillText(TYPES[k].ic, p.x, p.y + 12 * u); });
    /* path preview of selected unit hover omitted; incidents */
    incs.forEach(i => { const p = nodeXY(i), pulse = 0.5 + 0.5 * Math.sin(t * 8 + i.id), tp = i.need[0], c = TYPES[tp].c; const r = 21 * u; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(p.x, p.y, r + 8 + pulse * 5, 0, TAU); ctx.fill();
      const rg = ctx.createRadialGradient(p.x - 6, p.y - 6, 2, p.x, p.y, r); rg.addColorStop(0, tp === 'fire' ? '#ffb04a' : tp === 'medic' ? '#ff8a8a' : '#8ab4ff'); rg.addColorStop(1, c[1]); ctx.fillStyle = rg; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(TYPES[tp].ic, p.x, p.y + 1); ctx.textBaseline = 'alphabetic';
      if (i.need.length > 1) { i.need.forEach((n, k) => { const px = p.x + (k - 0.5) * 18, py = p.y + r + 10; ctx.fillStyle = i.got.includes(n) ? '#7dea8a' : TYPES[n].c[1]; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 9px Nunito'; ctx.fillText(TYPES[n].ic, px, py + 3); }); }
      ctx.strokeStyle = i.pat < 6 ? '#ff5a4a' : '#ffe066'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(i.pat / i.pmax, 0, 1)); ctx.stroke();
      if (i.state === 'work') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(p.x - 22, p.y - r - 14, 44, 7, 3); ctx.fill(); ctx.fillStyle = '#7dea8a'; ctx.beginPath(); ctx.roundRect(p.x - 22, p.y - r - 14, Math.max(4, 44 * i.prog), 7, 3); ctx.fill(); } });
    units.forEach(un => drawVeh(un.x + (un.st === 'idle' ? (units.filter(o => o.type === un.type).indexOf(un) - 0.5) * 14 : 0), un.y + (un.st === 'idle' ? 30 * u : 0), un.st === 'idle' ? -Math.PI / 2 : un.ang, un.type, un.st !== 'idle', u * 1.15));
    /* roster */
    ctx.fillStyle = 'rgba(8,12,28,.92)'; ctx.fillRect(0, rosterY - 8, W, H - rosterY + 8); ctx.strokeStyle = '#5ec8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, rosterY - 8); ctx.lineTo(W, rosterY - 8); ctx.stroke();
    Heroes.draw(ctx, 'dispatch', 40 * u, H - 8, 0.62 * u, { t, look: Math.sin(t) }); const n = units.length, cw0 = (W - 90 * u - 12) / Math.max(n, 1), cw = Math.min(64 * u, cw0 - 6);
    units.forEach((un, i) => { const x = 84 * u + i * cw0 + (cw0 - cw) / 2, y = rosterY + 4, h = H - rosterY - 14 - 6; const on = sel === i, idle = un.st === 'idle'; ctx.fillStyle = on ? '#ffe066' : idle ? '#1c2a58' : '#141a30'; ctx.strokeStyle = on ? '#fff' : idle ? TYPES[un.type].c[1] : '#2a3050'; ctx.lineWidth = on ? 4 : 2.6; ctx.beginPath(); ctx.roundRect(x, y, cw, h, 12); ctx.fill(); ctx.stroke(); drawVeh(x + cw / 2, y + h * 0.4, -Math.PI / 2, un.type, idle && on, 1.4 * u); ctx.fillStyle = on ? '#14141e' : idle ? '#fff' : '#6a7090'; ctx.font = '700 ' + Math.round(10 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(idle ? (cw < 56 ? {police:'COP',medic:'AMBU',fire:'FIRE'}[un.type] : TYPES[un.type].n.toUpperCase()) : (un.st === 'back' ? 'BACK' : 'BUSY'), x + cw / 2, y + h - 10); });
    parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(20 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = q.cc; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (mode === 'play' && sel < 0 && stage === 1 && resolvedStage === 0) { ctx.font = '700 ' + Math.round(15 * u + 1) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; ctx.strokeText('Tap a unit below, then tap the emergency', W / 2, rosterY - 26); ctx.fillText('Tap a unit below, then tap the emergency', W / 2, rosterY - 26); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Shift over!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Emergencies handled', resolvedTotal) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'dispatch', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; strikes = 0; resolvedTotal = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newStage(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => {
    if (mode !== 'play' || state !== 'play') return; Kit.ac(); const x = e.clientX, y = e.clientY;
    if (y > rosterY - 8) { const n = units.length, cw0 = (W - 90 * u - 12) / Math.max(n, 1); for (let i = 0; i < n; i++) { const x0 = 84 * u + i * cw0; if (x >= x0 && x <= x0 + cw0) { if (units[i].st === 'idle') { sel = sel === i ? -1 : i; Kit.tone(520, 0.05, 'square', 0.08); } break; } } return; }
    let hit = null, bd = 34 * u; incs.forEach(i => { const p = nodeXY(i), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; hit = i; } });
    if (hit) { if (sel >= 0) dispatch(sel, hit); else { const free = units.findIndex(un => un.st === 'idle' && hit.need.includes(un.type) && !hit.got.includes(un.type)); if (free >= 0) dispatch(free, hit); } }
  });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__cars = { get state() { return { mode, stage, score, strikes, state, resolvedStage, goal, units: units.map(u2 => ({ type: u2.type, st: u2.st })), incs: incs.map(i => ({ id: i.id, need: i.need, state: i.state, c: i.c, r: i.r, pat: i.pat })) }; }, dispatch(ui, id) { return dispatch(ui, incs.find(i => i.id === id)); }, setStage(n) { stage = n; newStage(); } };
})();
