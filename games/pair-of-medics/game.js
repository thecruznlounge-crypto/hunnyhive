/* Pair of Medics - two thumbs, one stretcher. Keep the patient on board. */
(function () {
  'use strict';
  Kit.ns('pair-of-medics');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  let W, H, u, baseY, x1, x2;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); baseY = H * 0.66; x1 = W * 0.3; x2 = W * 0.7; }
  S.onresize = layout; layout();
  const THEMES = [
    { name: 'Morning Streets', sky: ['#7ec8ff', '#ffe9c0'], bld: ['#9ab4d8', '#7a94b8'], road: '#4a4e5c' },
    { name: 'Rainy Avenue', sky: ['#6a7a98', '#a8b4c8'], bld: ['#6a7890', '#4a5870'], road: '#3a3e4c', rain: true },
    { name: 'Sunset Bridge', sky: ['#ff8a5a', '#ffd88a'], bld: ['#b8587a', '#8a3e62'], road: '#4a3a4a' },
    { name: 'Night Shift', sky: ['#0a1030', '#2a2a68'], bld: ['#1c2650', '#121a3c'], road: '#222638', stars: true },
    { name: 'Snowy Hills', sky: ['#c8e0f6', '#f2f8ff'], bld: ['#a8c0d8', '#88a4c0'], road: '#8a96a8', snow: true }
  ];
  let mode = 'title', stage = 1, score = 0, drops = 0, t = 0, dist = 0, runLen = 0, o1 = 0, o2 = 0, hold = { l: false, r: false }, p = 0, pv = 0, state = 'run', stateT = 0, parts = [], flash = 0, perfect = 0, cleared = 0, tiltT = 0, shake = 0;
  const best = () => Kit.get('best', 0);
  const th = () => THEMES[(stage - 1) % THEMES.length];
  const amp = () => Math.min(46, 10 + stage * 5) * u, spd = () => (88 + Math.min(10, stage) * 9) * u;
  const G = d => { const a = amp(), env = Math.min(1, d / 500); return env * a * (Math.sin(d * 0.011) + 0.55 * Math.sin(d * 0.029 + 1.3) + (stage > 3 ? 0.4 * Math.sin(d * 0.05 + 0.4) : 0)) / 1.6; };
  const gy = x => baseY - G(dist + x - x1);
  function newRun() { dist = 0; runLen = 1400 + stage * 420; o1 = o2 = 0; p = 0; pv = 0; state = 'run'; stateT = 0; perfect = 0; syncHud(); }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + th().name; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '♥'.repeat(Math.max(0, 3 - drops)) + '♡'.repeat(Math.min(3, drops)); }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; } else q.y -= 26 * dt; }); parts = parts.filter(q => q.age < q.life); flash = Math.max(0, flash - dt * 2); shake = Math.max(0, shake - dt * 3);
    if (mode !== 'play') return; stateT += dt;
    if (state === 'run') {
      dist += spd() * dt;
      const R = 34 * u; o1 = clamp(o1 + (hold.l ? 1 : -1) * 120 * u * dt, -R, R); o2 = clamp(o2 + (hold.r ? 1 : -1) * 120 * u * dt, -R, R);
      const y1 = gy(x1) - o1, y2 = gy(x2) - o2, L = x2 - x1, tilt = Math.atan2(y2 - y1, L);
      /* y smaller = higher. tilt>0 means front (x2) end lower -> patient slides toward x2 */
      pv += Math.sin(tilt) * 560 * u * dt; pv *= 1 - 0.7 * dt; p += pv * dt;
      tiltT = tilt; if (Math.abs(tilt) < 0.1) perfect += dt;
      if (Math.abs(p) > L / 2 - 6 * u) { drops++; state = 'drop'; stateT = 0; flash = 0.5; shake = 0.7; parts.push({ txt: 'Oh no!', x: W / 2, y: H * 0.4, age: 0, life: 1.1 }); Kit.tone(200, 0.5, 'sawtooth', 0.18, -110); Kit.vibe(80); syncHud(); }
      if (dist >= runLen) { state = 'done'; stateT = 0; const b = Math.round(500 + perfect * 60 + (3 - drops) * 100); score += b; cleared++; flash = 0.4; parts.push({ txt: 'Delivered! +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.4 }); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.12, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); syncHud(); }
    } else if (state === 'drop') { if (stateT > 1.2) { if (drops >= 3) return gameOver(); p = 0; pv = 0; state = 'run'; stateT = 0; } }
    else if (state === 'done') { o1 *= 0.9; o2 *= 0.9; if (stateT > 1.8) { stage++; newRun(); Kit.banner('Stage ' + stage, th().name); } }
  }
  function drawMedic(x, fy, alt, ph, o) {
    ctx.save(); const s = 0.66 * u * 1.15; Heroes.draw(ctx, 'medic', x, fy, s, { alt, bob: ph, look: 1 }); ctx.restore();
  }
  function render() {
    const T = th(), g = ctx.createLinearGradient(0, 0, 0, baseY); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (T.stars) { ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.arc((i * 83) % W, 70 + ((i * 47) % 220), 1.4, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    /* parallax buildings */
    for (let layer = 0; layer < 2; layer++) { const sp = layer ? 0.5 : 0.25, bw = 70 * u + layer * 20, off = (dist * sp) % (bw * 5); ctx.fillStyle = T.bld[layer]; for (let i = -1; i < W / bw + 6; i++) { const bx = i * bw - off, hh = (80 + ((i * 37 + 11) % 5 + 5) % 5 * 30 + layer * 40) * u; ctx.fillRect(bx, baseY - hh - 40 * layer, bw - 6, hh + 40 * layer); ctx.fillStyle = 'rgba(255,240,170,.35)'; for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 2; wx++) ctx.fillRect(bx + 10 + wx * 24 * u, baseY - hh - 40 * layer + 12 + wy * 22 * u, 12 * u, 12 * u); ctx.fillStyle = T.bld[layer]; } }
    /* road */
    ctx.fillStyle = T.road; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, gy(x)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = gy(x); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,120,.8)'; ctx.lineWidth = 3; ctx.setLineDash([22 * u, 18 * u]); ctx.lineDashOffset = dist % (40 * u); ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = gy(x) + 26 * u; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
    /* hospital near the end */
    const hx = x2 + 110 * u + (runLen - dist); if (hx < W + 200) { const hy = gy(clamp(hx, 0, W)) || baseY; ctx.fillStyle = '#f2f4f8'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(hx - 60 * u, baseY - 120 * u, 120 * u, 120 * u, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8433a'; ctx.fillRect(hx - 8 * u, baseY - 100 * u, 16 * u, 48 * u); ctx.fillRect(hx - 24 * u, baseY - 84 * u, 48 * u, 16 * u); ctx.fillStyle = '#14141e'; ctx.font = '700 ' + Math.round(12 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HOSPITAL', hx, baseY - 30 * u); }
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    const bob = Math.abs(Math.sin(dist * 0.06)) * 2 * u;
    const f1 = gy(x1) - o1, f2 = gy(x2) - o2, hh = 34 * u, y1 = f1 - hh, y2 = f2 - hh;
    drawMedic(x1, f1 - bob, false, dist * 0.06); drawMedic(x2, f2 - bob, true, dist * 0.06 + 1.5);
    /* stretcher + patient */
    ctx.save(); const ang = Math.atan2(y2 - y1, x2 - x1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2; ctx.translate(mx, my - bob); ctx.rotate(ang);
    const L = x2 - x1; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-L / 2 - 8 * u, 0); ctx.lineTo(L / 2 + 8 * u, 0); ctx.stroke(); ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.fillStyle = '#5a6a8a'; ctx.beginPath(); ctx.roundRect(-L / 2, -8 * u, L, 8 * u, 3); ctx.fill(); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.stroke();
    const pp = state === 'drop' ? clamp(p, -L, L) : p, py = state === 'drop' ? Math.min(60 * u, stateT * stateT * 400 * u) : 0;
    ctx.save(); ctx.translate(pp, -8 * u + py); ctx.rotate(state === 'drop' ? stateT * 8 * Math.sign(p || 1) : Math.sin(t * 3) * 0.02);
    ctx.fillStyle = '#7ec8ff'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(-30 * u, -16 * u, 60 * u, 18 * u, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(-14 * u + i * 16 * u, -16 * u, 5 * u, 18 * u);
    ctx.fillStyle = '#f2c08a'; ctx.beginPath(); ctx.arc(-28 * u, -14 * u, 12 * u, 0, TAU); ctx.fill(); ctx.stroke(); Heroes.eye(ctx, -31 * u, -16 * u, 3.6 * u, { look: Math.sign(tiltT) * 0.8 }); Heroes.eye(ctx, -22 * u, -16 * u, 3.6 * u, { look: Math.sign(tiltT) * 0.8 }); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-27 * u, -9 * u, 3 * u, 0.2, Math.PI - 0.2, state === 'drop' ? true : false); ctx.stroke();
    ctx.restore(); ctx.restore();
    /* hands */
    ctx.strokeStyle = '#14141e'; ctx.lineWidth = 7; ctx.lineCap = 'round'; [[x1, f1, y1], [x2, f2, y2]].forEach(a => { ctx.beginPath(); ctx.moveTo(a[0] + 4, a[1] - 38 * u); ctx.lineTo(a[0] + 10 * u, a[2] - bob); ctx.stroke(); });
    ctx.restore();
    /* level indicator */
    const iw = 120 * u, ix = W / 2 - iw / 2, iy = 112; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(ix, iy, iw, 14, 7); ctx.fill(); ctx.fillStyle = Math.abs(tiltT) < 0.1 ? '#7dea8a' : Math.abs(tiltT) < 0.22 ? '#ffcf4a' : '#ff5a4a'; const kx = ix + iw / 2 + clamp(tiltT / 0.5, -1, 1) * (iw / 2 - 7); ctx.beginPath(); ctx.arc(kx, iy + 7, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.stroke();
    /* progress */
    const pw = Math.min(W - 40, 300), px = W / 2 - pw / 2; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(px, 82, pw, 10, 5); ctx.fill(); ctx.fillStyle = '#5ec8ff'; ctx.beginPath(); ctx.roundRect(px, 82, Math.max(10, pw * dist / runLen), 10, 5); ctx.fill();
    if (T.rain || T.snow) { ctx.strokeStyle = T.snow ? 'rgba(255,255,255,.9)' : 'rgba(200,220,255,.6)'; ctx.lineWidth = T.snow ? 3 : 1.4; for (let i = 0; i < 40; i++) { const x = (i * 71 + t * (T.snow ? 30 : 140)) % W, y = (i * 53 + t * (T.snow ? 70 : 520)) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (T.snow ? 0 : 4), y + (T.snow ? 2 : 14)); ctx.stroke(); } }
    ['bL', 'bR'].forEach(id => $(id).classList.toggle('down', id === 'bL' ? hold.l : hold.r));
    parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(30 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = (state === 'done' ? 'rgba(120,255,160,' : 'rgba(255,60,60,') + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Shift over!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Patients delivered', cleared) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'medic', cw / 2 - 30, ch - 8, Math.min(cw / 200, ch / 140), {}); Heroes.draw(g, 'medic', cw / 2 + 30, ch - 8, Math.min(cw / 200, ch / 140), { alt: true });
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; drops = 0; cleared = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRun(); Kit.banner('Stage 1', th().name); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; hold.l = hold.r = false; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const ptr = new Map();
  function sync() { hold.l = hold.r = false; ptr.forEach(v => { if (v < W / 2) hold.l = true; else hold.r = true; }); }
  window.addEventListener('pointerdown', e => { if (mode !== 'play' || e.target.closest('.sq')) return; Kit.ac(); ptr.set(e.pointerId, e.clientX); sync(); });
  window.addEventListener('pointermove', e => { if (ptr.has(e.pointerId)) { ptr.set(e.pointerId, e.clientX); sync(); } });
  const up = e => { ptr.delete(e.pointerId); sync(); }; window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'a') hold.l = true; if (e.key === 'ArrowRight' || e.key === 'd') hold.r = true; }); window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') hold.l = false; if (e.key === 'ArrowRight' || e.key === 'd') hold.r = false; });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__medic = { get state() { return { mode, stage, score, drops, state, dist, runLen, p, tilt: tiltT, o1, o2 }; }, setStage(n) { stage = n; newRun(); }, hold(l, r) { hold.l = l; hold.r = r; }, finish() { dist = runLen; } };
})();
