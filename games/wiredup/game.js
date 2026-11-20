/* Wiredup - read the clue, cut the right wire. */
(function () {
  'use strict';
  Kit.ns('wiredup');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); }
  S.onresize = layout; layout();

  const COL = { RED: ['#ff6a5a', '#d8281c', '#8a1008', 'R'], BLUE: ['#6ab4ff', '#2a74d8', '#143c8a', 'B'], GREEN: ['#6aea7a', '#26a83c', '#0e5a1c', 'G'], YELLOW: ['#fff08a', '#ecc81c', '#9a7a00', 'Y'], WHITE: ['#ffffff', '#d8dce6', '#8a90a0', 'W'], BLACK: ['#6a6e7e', '#2a2e3a', '#0a0c12', 'K'] };
  const CN = Object.keys(COL), ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
  const THEMES = [{ name: 'Warehouse', bg: ['#3a4a3a', '#1a241a'] }, { name: 'Metro Station', bg: ['#3a3a52', '#181828'] }, { name: 'Bank Vault', bg: ['#52483a', '#241e14'] }, { name: 'Submarine', bg: ['#1a4a5a', '#0a2430'] }, { name: 'Rocket Pad', bg: ['#5a3a3a', '#241414'] }];

  let mode = 'title', stage = 1, bombNo = 0, score = 0, strikes = 0, t = 0, B = null, phase = 'idle', phaseT = 0, flash = 0, shake = 0, parts = [], defused = 0, streak = 0;
  const best = () => Kit.get('best', 0);
  const cnt = (w, c) => w.filter(x => x === c).length;

  function genBomb() {
    const nW = [3, 4, 4, 5, 5, 6, 6, 7][Math.min(7, stage - 1)] + (stage > 8 ? 0 : 0);
    const kinds = ['color']; if (stage >= 1) kinds.push('nth'); if (stage >= 2) kinds.push('after'); if (stage >= 3) kinds.push('nthcolor'); if (stage >= 4) kinds.push('serial'); if (stage >= 5) kinds.push('between'); if (stage >= 6) kinds.push('count');
    for (let tries = 0; tries < 400; tries++) {
      const w = []; const pal = CN.slice().sort(() => Math.random() - 0.5).slice(0, stage < 3 ? 4 : 6); for (let i = 0; i < nW; i++) w.push(pick(pal));
      const kind = stage < 3 && tries < 50 ? pick(kinds.slice(-2)) : pick(kinds); const sn = String.fromCharCode(65 + rint(0, 25)) + String(rint(100, 999)) + String.fromCharCode(65 + rint(0, 25)) + String(rint(0, 9)); let txt, ans = -1;
      if (kind === 'color') { const c = pick(w); if (cnt(w, c) !== 1) continue; txt = 'Cut the ' + c + ' wire.'; ans = w.indexOf(c); }
      else if (kind === 'nth') { ans = rint(0, nW - 1); txt = 'Cut the ' + ORD[ans] + ' wire from the left.'; if (Math.random() < 0.3) { ans = nW - 1 - ans; txt = 'Cut the ' + ORD[nW - 1 - ans] + ' wire from the right.'; ans = nW - 1 - (nW - 1 - ans); txt = 'Cut the ' + ORD[nW - 1 - ans] + ' wire from the right.'; } }
      else if (kind === 'after') { const c = pick(w); if (cnt(w, c) !== 1 || w.indexOf(c) === nW - 1) continue; ans = w.indexOf(c) + 1; txt = 'Cut the wire right after the ' + c + ' wire.'; }
      else if (kind === 'nthcolor') { const c = pick(w); const k = cnt(w, c); if (k < 2) continue; const j = rint(1, k); let seen = 0; for (let i = 0; i < nW; i++) if (w[i] === c && ++seen === j) ans = i; txt = 'Cut the ' + ORD[j - 1] + ' ' + c + ' wire.'; }
      else if (kind === 'serial') { const odd = parseInt(sn.replace(/\D/g, '').slice(-1), 10) % 2 === 1; let d = sn.match(/\d/g), last = parseInt(d[d.length - 1], 10); const j = rint(0, nW - 2); ans = last % 2 === 1 ? j : nW - 1; txt = 'If the serial number ends in an ODD digit, cut the ' + ORD[j] + ' wire. Otherwise cut the LAST wire.'; }
      else if (kind === 'between') { const c = pick(w); const idx = []; w.forEach((x, i) => { if (x === c) idx.push(i); }); if (idx.length !== 2 || idx[1] - idx[0] !== 2) continue; ans = idx[0] + 1; txt = 'Cut the wire between the two ' + c + ' wires.'; }
      else { const c = pick(w), c2 = pick(w); if (c === c2) continue; const k = rint(1, 2); if (cnt(w, c) < 1 || cnt(w, c2) < 1) continue; if (cnt(w, c) > k) { ans = w.lastIndexOf(c); } else { ans = w.indexOf(c2); } txt = 'If there are more than ' + k + ' ' + c + ' wires, cut the last ' + c + ' wire. Otherwise cut the first ' + c2 + ' wire.'; }
      if (ans < 0 || ans >= nW) continue;
      const limit = Math.max(12, 26 - stage * 1.4 + nW * 0.6);
      return { w, txt, ans, sn, kind, cut: -1, limit, left: limit, amp: w.map(() => rnd(6, 14)), ph: w.map(() => rnd(0, TAU)) };
    }
    return genBomb();
  }
  function nextBomb() { if (bombNo > 0 && bombNo % 4 === 0) { stage++; Kit.banner('Stage ' + stage, THEMES[(stage - 1) % THEMES.length].name); } bombNo++; B = genBomb(); phase = 'live'; phaseT = 0; syncHud(); }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · Bomb ' + (((bombNo - 1) % 4) + 1) + '/4'; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }

  function geom() { const bw = Math.min(W - 24, 366), bx = W / 2 - bw / 2, by = 66, bh = H - by - 18 - 0; const clueH = 118 * u + 10; const panelY = by + 78 * u + clueH + 14, panelH = by + bh - 14 - panelY; return { bw, bx, by, bh, clueH, panelY, panelH }; }
  function wirePts(i, n, g, cutHalf) {
    const x0 = g.bx + 38, x1 = g.bx + g.bw - 38, y = g.panelY + 26 + (g.panelH - 52) * (n === 1 ? 0.5 : i / (n - 1)), pts = [];
    for (let k = 0; k <= 20; k++) { const f = k / 20; pts.push([x0 + (x1 - x0) * f, y + Math.sin(f * Math.PI * 2 + B.ph[i]) * B.amp[i] * Math.sin(f * Math.PI)]); }
    return pts;
  }
  function tap(x, y) {
    if (mode !== 'play' || phase !== 'live') return;
    const g = geom(), n = B.w.length; let bestI = -1, bd = 22;
    for (let i = 0; i < n; i++) { const pts = wirePts(i, n, g); for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], tt = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1), d = Math.hypot(x - (a[0] + dx * tt), y - (a[1] + dy * tt)); if (d < bd) { bd = d; bestI = i; } } }
    if (bestI >= 0) cutWire(bestI, x, y);
  }
  function cutWire(i, x, y) {
    B.cut = i; phaseT = 0; const g = geom(), pts = wirePts(i, B.w.length, g), mid = pts[10];
    for (let k = 0; k < 18; k++) parts.push({ x: mid[0], y: mid[1], vx: rnd(-160, 160), vy: rnd(-200, 20), age: 0, life: rnd(0.3, 0.7), c: '255,230,120', r: rnd(1.5, 3) });
    Kit.noise(0.12, 0.2, null, 2500);
    if (i === B.ans) { phase = 'win'; const pts2 = 300 + Math.round(B.left * 20) + streak * 50; score += pts2; streak++; defused++; Kit.tone(660, 0.1, 'triangle', 0.22); Kit.tone(990, 0.12, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1318, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); parts.push({ txt: 'DEFUSED! +' + pts2, x: W / 2, y: H * 0.5, age: 0, life: 1.3 }); Kit.vibe(25); }
    else { boom('Wrong wire!'); }
    syncHud();
  }
  function boom(msg) { phase = 'boom'; phaseT = 0; strikes++; streak = 0; flash = 1; shake = 1; Kit.noise(0.6, 0.45, null, 200); Kit.tone(70, 0.6, 'sawtooth', 0.3, -40); Kit.vibe(150); parts.push({ txt: msg, x: W / 2, y: H * 0.5, age: 0, life: 1.4 }); for (let k = 0; k < 40; k++) parts.push({ x: W / 2, y: H * 0.5, vx: rnd(-320, 320), vy: rnd(-320, 120), age: 0, life: rnd(0.4, 1), c: pick(['255,160,40', '255,90,30', '255,230,120']), r: rnd(3, 7) }); syncHud(); }
  function update(dt) {
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; } else p.y -= 24 * dt; }); parts = parts.filter(p => p.age < p.life); flash = Math.max(0, flash - dt * 1.6); shake = Math.max(0, shake - dt * 1.8);
    if (mode !== 'play' || !B) return; phaseT += dt;
    if (phase === 'live') { const prev = Math.ceil(B.left); B.left -= dt; const cur = Math.ceil(B.left); if (cur !== prev && B.left < 6 && B.left > 0) Kit.tone(1200, 0.04, 'square', 0.06); if (B.left <= 0) { B.left = 0; boom("Time's up!"); } }
    else if (phase === 'win') { if (phaseT > 1.5) nextBomb(); }
    else if (phase === 'boom') { if (phaseT > 1.6) { if (strikes >= 3) return gameOver(); nextBomb(); } }
  }

  function render() {
    const th = THEMES[(stage - 1) % THEMES.length], g0 = ctx.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, th.bg[0]); g0.addColorStop(1, th.bg[1]); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    if (!B || mode === 'title') return; const g = geom(); ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 8, rnd(-1, 1) * shake * 8);
    /* body */
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(g.bx + 5, g.by + 8, g.bw, g.bh, 22); ctx.fill();
    const bg = ctx.createLinearGradient(g.bx, g.by, g.bx + g.bw, g.by + g.bh); bg.addColorStop(0, '#8a90a0'); bg.addColorStop(0.5, '#5a6070'); bg.addColorStop(1, '#3a404e'); ctx.fillStyle = bg; ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(g.bx, g.by, g.bw, g.bh, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2e3a'; [[14, 14], [g.bw - 14, 14], [14, g.bh - 14], [g.bw - 14, g.bh - 14]].forEach(p => { ctx.beginPath(); ctx.arc(g.bx + p[0], g.by + p[1], 5, 0, TAU); ctx.fill(); });
    /* timer LCD */
    const lw = 156 * u + 10, lh = 54 * u; ctx.fillStyle = '#0a0f0a'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(g.bx + 18, g.by + 16, lw, lh, 8); ctx.fill(); ctx.stroke();
    const sec = Math.max(0, B.left), mm = Math.floor(sec / 60), ss = Math.floor(sec % 60), ds = Math.floor((sec * 10) % 10); const low = sec < 6; ctx.fillStyle = low ? (Math.sin(t * 16) > 0 ? '#ff4a3a' : '#a02a20') : '#5aff7a'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.font = '700 ' + Math.round(38 * u) + 'px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + '.' + ds, g.bx + 18 + lw / 2, g.by + 16 + lh / 2 + 2); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
    /* strike LEDs + serial */
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < strikes ? '#ff3a2a' : '#3a1410'; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = i < strikes ? 12 : 0; ctx.beginPath(); ctx.arc(g.bx + g.bw - 30 - i * 26, g.by + 32, 9, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.roundRect(g.bx + g.bw - 110 * u - 20, g.by + 50 * u + 4, 110 * u + 4, 22 * u, 4); ctx.fill(); ctx.fillStyle = '#14141e'; ctx.font = '700 ' + Math.round(12 * u + 1) + 'px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('SN ' + B.sn, g.bx + g.bw - 55 * u - 18, g.by + 50 * u + 4 + 15 * u);
    /* clue paper */
    const cx = g.bx + 16, cy = g.by + 82 * u, cw = g.bw - 32; ctx.save(); ctx.translate(cx + cw / 2, cy + g.clueH / 2); ctx.rotate(-0.008); ctx.fillStyle = '#f6f0d8'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(-cw / 2, -g.clueH / 2, cw, g.clueH, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(220,200,140,.9)'; ctx.fillRect(-26, -g.clueH / 2 - 6, 52, 14); ctx.fillStyle = '#a02a20'; ctx.font = '700 ' + Math.round(11 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DEFUSAL MANUAL', 0, -g.clueH / 2 + 22);
    ctx.fillStyle = '#14141e'; const fs = Math.round(clamp(cw / 17, 15, 21)); ctx.font = '700 ' + fs + 'px Fredoka, system-ui, sans-serif'; const words = B.txt.split(' '), lines = []; let cur = ''; words.forEach(w => { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > cw - 30 && cur) { lines.push(cur); cur = w; } else cur = tt; }); lines.push(cur); lines.forEach((ln, i) => ctx.fillText(ln, 0, -g.clueH / 2 + 46 * u + i * fs * 1.22 + (lines.length > 3 ? -4 : 6))); ctx.restore();
    /* wire panel */
    ctx.fillStyle = '#12141c'; ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(g.bx + 12, g.panelY, g.bw - 24, g.panelH, 14); ctx.fill(); ctx.stroke();
    const n = B.w.length;
    for (let i = 0; i < n; i++) {
      const pts = wirePts(i, n, g), cl = COL[B.w[i]], cut = B.cut === i, ev = (phase === 'win' || phase === 'boom') && i === B.ans && B.cut !== i && phase === 'boom';
      /* terminals */
      ctx.fillStyle = '#6a7080'; ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 2; [[g.bx + 26, pts[0][1]], [g.bx + g.bw - 26, pts[20][1]]].forEach(p => { ctx.beginPath(); ctx.roundRect(p[0] - 12, p[1] - 11, 24, 22, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b8c0d0'; ctx.beginPath(); ctx.arc(p[0], p[1], 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a7080'; });
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const strokeRange = (a, b, off) => { ctx.beginPath(); for (let k = a; k <= b; k++) { const p = pts[k]; const dy = off ? (k < 10 ? -off * (k / 10) : off * ((20 - k) / 10)) : 0; k === a ? ctx.moveTo(p[0], p[1] + dy) : ctx.lineTo(p[0], p[1] + dy); } };
      const gap = cut ? Math.min(1, phaseT * 6) : 0;
      [[0, cut ? 9 : 20, -gap * 10], [cut ? 11 : 20, 20, gap * 10]].forEach((rg, ri) => { if (ri === 1 && !cut) return; ctx.save(); ctx.translate(0, rg[2]); ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 11; strokeRange(rg[0], rg[1]); ctx.stroke(); ctx.strokeStyle = cl[1]; ctx.lineWidth = 8; strokeRange(rg[0], rg[1]); ctx.stroke(); ctx.strokeStyle = cl[0]; ctx.lineWidth = 3; ctx.save(); ctx.translate(0, -2); strokeRange(rg[0], rg[1]); ctx.stroke(); ctx.restore(); ctx.restore(); });
      if (cut) { ctx.fillStyle = '#d89a4a'; [[pts[9], -gap * 10], [pts[11], gap * 10]].forEach(p => { ctx.beginPath(); ctx.arc(p[0][0], p[0][1] + p[1], 4.5, 0, TAU); ctx.fill(); }); }
      ctx.fillStyle = cl[1]; ctx.strokeStyle = '#0a0c12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(g.bx + 46, pts[0][1] - 8 - 0, 0, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 11px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(cl[3], g.bx + 26, pts[0][1] + 4); ctx.fillStyle = '#14141e'; ctx.fillText(cl[3], g.bx + g.bw - 26, pts[20][1] + 4);
      if (phase === 'boom' && i === B.ans) { ctx.strokeStyle = 'rgba(120,255,160,' + (0.6 + 0.4 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(g.bx + 14, pts[10][1] - 17, g.bw - 28, 34, 10); ctx.stroke(); }
    }
    ctx.restore();
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(34 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = phase === 'win' ? '#7dea8a' : '#ff7a4a'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgb(' + p.c + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,200,100,' + flash * 0.7 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Mission failed!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Bombs defused', defused) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'bomb', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; bombNo = 0; score = 0; strikes = 0; streak = 0; defused = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); nextBomb(); Kit.banner('Stage 1', THEMES[0].name); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => { Kit.ac(); tap(e.clientX, e.clientY); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__wire = { get state() { return { mode, stage, bombNo, score, strikes, phase, ans: B && B.ans, txt: B && B.txt, w: B && B.w, left: B && B.left }; }, cut(i) { cutWire(i); }, setStage(n) { stage = n; bombNo = (n - 1) * 4; nextBomb(); bombNo = (n - 1) * 4 + 1; syncHud(); }, tapWire(i) { const g = geom(), p = wirePts(i, B.w.length, g)[10]; tap(p[0], p[1]); } };
})();
