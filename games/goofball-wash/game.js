/* Goofball Wash - scrub the muddy golf balls clean. */
(function () {
  'use strict';
  Kit.ns('goofball-wash');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let W, H, u, cx, cy, R;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); cx = W / 2; cy = H * 0.46; R = Math.min(W * 0.36, H * 0.22); }
  S.onresize = layout; layout();

  const D = 160, STAINS = [[60, 140, 40, 0.12], [40, 40, 52, 0.07], [170, 60, 160, 0.1], [230, 170, 30, 0.09], [30, 110, 200, 0.1]]; let stainRate = 0.11;
  const mud = document.createElement('canvas'), stain = document.createElement('canvas'); mud.width = mud.height = stain.width = stain.height = D;
  const mctx = mud.getContext('2d'), sctx = stain.getContext('2d');
  const scan = document.createElement('canvas'); scan.width = scan.height = 64; const xctx = scan.getContext('2d', { willReadFrequently: true });

  let bcx = 0, mode = 'title', t = 0, ballN = 1, score = 0, timeLeft = 30, clean = 0, scanT = 0, ptr = null, last = null, bubbles = [], sparkles = [], floats = [], giggle = 0, doneT = -1, wob = 0, combo = 0, scrubV = 0, blink = 0, mood = 'happy', total0 = 1, cleaned = 0;

  function makeDirt() {
    mctx.clearRect(0, 0, D, D); sctx.clearRect(0, 0, D, D);
    const nm = 5 + Math.min(9, ballN * 1.2), ns = ballN >= 2 ? Math.min(8, ballN) : 0, pal = STAINS[(ballN - 2 + 8) % STAINS.length]; stainRate = pal[3];
    for (let i = 0; i < nm; i++) {
      const a = rnd(0, TAU), d = rnd(0, D * 0.36), x = D / 2 + Math.cos(a) * d, y = D / 2 + Math.sin(a) * d, r = rnd(14, 30);
      const g = mctx.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, 'rgba(92,60,30,1)'); g.addColorStop(0.75, 'rgba(110,74,38,1)'); g.addColorStop(1, 'rgba(110,74,38,0)'); mctx.fillStyle = g; mctx.beginPath(); mctx.arc(x, y, r, 0, TAU); mctx.fill();
      mctx.fillStyle = 'rgba(60,36,16,.6)'; for (let k = 0; k < 4; k++) { mctx.beginPath(); mctx.arc(x + rnd(-r, r) * 0.6, y + rnd(-r, r) * 0.6, rnd(1.5, 3.5), 0, TAU); mctx.fill(); }
    }
    for (let i = 0; i < ns; i++) {
      const a = rnd(0, TAU), d = rnd(0, D * 0.33), x = D / 2 + Math.cos(a) * d, y = D / 2 + Math.sin(a) * d, r = rnd(10, 22);
      const g = sctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(' + pal[0] + ',' + pal[1] + ',' + pal[2] + ',.95)'); g.addColorStop(1, 'rgba(' + pal[0] + ',' + pal[1] + ',' + pal[2] + ',0)'); sctx.fillStyle = g; sctx.beginPath(); sctx.arc(x, y, r, 0, TAU); sctx.fill();
    }
    measure(true);
  }
  function measure(init) {
    xctx.clearRect(0, 0, 64, 64); xctx.drawImage(mud, 0, 0, 64, 64); xctx.drawImage(stain, 0, 0, 64, 64);
    const d = xctx.getImageData(0, 0, 64, 64).data; let dirty = 0, tot = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = x - 31.5, dy = y - 31.5; if (dx * dx + dy * dy > 31 * 31) continue; tot++; if (d[(y * 64 + x) * 4 + 3] > 45) dirty++; }
    if (init) total0 = Math.max(1, dirty);
    clean = 1 - dirty / Math.max(1, total0);
    return clean;
  }
  function newBall() { bcx = cx; ballN = ballN; makeDirt(); doneT = -1; clean = 0; mood = 'happy'; sync(); }
  function sync() { $('hudL').textContent = 'Lv ' + (Math.floor((ballN - 1) / 3) + 1) + ' \u00B7 Ball ' + ballN; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = Math.ceil(timeLeft) + 's'; }

  /* input */
  function p2d(e) { return { x: (e.clientX - bcx) / (2 * R) * D + D / 2, y: (e.clientY - cy) / (2 * R) * D + D / 2, sx: e.clientX, sy: e.clientY }; }
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); ptr = p2d(e); last = null; try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {} scrub(ptr); });
  S.canvas.addEventListener('pointermove', e => { if (!ptr) return; ptr = p2d(e); scrub(ptr); });
  const up = () => { ptr = null; last = null; }; S.canvas.addEventListener('pointerup', up); S.canvas.addEventListener('pointercancel', up);
  function scrub(p) {
    if (mode !== 'play' || doneT >= 0) return;
    const dx0 = p.sx - bcx, dy0 = p.sy - cy; if (dx0 * dx0 + dy0 * dy0 > (R * 1.15) * (R * 1.15)) { last = null; return; }
    const l = last || p, dist = Math.hypot(p.x - l.x, p.y - l.y), br = D * 0.075;
    mctx.globalCompositeOperation = 'destination-out'; mctx.strokeStyle = '#000'; mctx.lineCap = 'round'; mctx.lineWidth = br * 2; mctx.beginPath(); mctx.moveTo(l.x, l.y); mctx.lineTo(p.x, p.y); mctx.stroke();
    sctx.globalCompositeOperation = 'destination-out'; sctx.strokeStyle = 'rgba(0,0,0,' + stainRate + ')'; sctx.lineWidth = br * 2; sctx.beginPath(); sctx.moveTo(l.x, l.y); sctx.lineTo(p.x, p.y); sctx.stroke();
    mctx.globalCompositeOperation = sctx.globalCompositeOperation = 'source-over';
    scrubV = Math.min(1, scrubV + dist * 0.01); giggle = 0.4; wob += dist * 0.02;
    if (Math.random() < Math.min(1, dist * 0.08)) bubbles.push({ x: p.sx + rnd(-14, 14), y: p.sy + rnd(-14, 14), r: rnd(4, 11), vy: rnd(-40, -90), age: 0, life: rnd(0.6, 1.2) });
    if (Math.random() < 0.08) Kit.noise(0.06, 0.04, null, 3000 + Math.random() * 2000);
    last = p;
  }

  function update(dt) {
    if (mode !== 'play') return;
    bcx = cx + (ballN >= 4 ? Math.sin(t * (0.8 + ballN * 0.08)) * Math.min(1, (ballN - 3) / 3) * W * 0.07 : 0); scrubV = Math.max(0, scrubV - dt * 2); giggle = Math.max(0, giggle - dt); blink = Math.max(0, blink - dt); if (Math.random() < dt * 0.4) blink = 0.12;
    mood = giggle > 0 ? 'happy' : 'happy';
    if (doneT < 0) {
      timeLeft -= dt; scanT += dt; if (scanT > 0.12) { scanT = 0; measure(); if (clean >= 0.96) finishBall(); }
      if (timeLeft <= 0) { timeLeft = 0; return end(); }
    } else { doneT += dt; if (doneT > 1.2) { ballN++; timeLeft += 7; newBall(); if ((ballN - 1) % 3 === 0) Kit.banner('Level ' + (Math.floor((ballN - 1) / 3) + 1), bgNow().name); } }
    sync();
    bubbles.forEach(b => { b.age += dt; b.y += b.vy * dt; }); bubbles = bubbles.filter(b => b.age < b.life);
    sparkles.forEach(s => { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }); sparkles = sparkles.filter(s => s.age < s.life);
    floats.forEach(f => f.age += dt); floats = floats.filter(f => f.age < 1.2);
  }
  function finishBall() {
    doneT = 0; combo++; const bonus = Math.round(clamp(timeLeft, 0, 30) * 3), pts = 100 + ballN * 20 + bonus; score += pts; cleaned++;
    for (let i = 0; i < 30; i++) { const a = rnd(0, TAU); sparkles.push({ x: bcx + Math.cos(a) * R * rnd(0.2, 1), y: cy + Math.sin(a) * R * rnd(0.2, 1), vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, age: 0, life: rnd(0.6, 1.2) }); }
    floats.push({ x: cx, y: cy - R - 20, txt: '+' + pts, age: 0 }); Kit.tone(660, 0.12, 'triangle', 0.2); Kit.tone(990, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.vibe(20); Kit.banner('Squeaky clean!', '+7s'); sync();
  }
  function end() {
    mode = 'over'; const nb = score > Kit.get('best', 0); if (nb) Kit.set('best', score);
    $('hud').classList.remove('show'); Kit.tone(200, 0.6, 'sawtooth', 0.15, -100);
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : "Time's up!"; $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Balls cleaned', cleaned) + row('Best', Math.max(score, Kit.get('best', 0)).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Golf.ball(g, cw / 2, ch / 2, Math.min(cw, ch) * 0.38, { mood: 'dizzy' }); Kit.show('over');
  }

  const BGS = [
    { name: 'Sink', a: '#7fd6f0', b: '#bff0ff', line: 'rgba(255,255,255,.35)', tile: 60 },
    { name: 'Garage', a: '#8d97a3', b: '#c8ced6', line: 'rgba(0,0,0,.12)', tile: 90 },
    { name: 'Spa', a: '#ffd6e8', b: '#fff1f7', line: 'rgba(255,255,255,.6)', tile: 50 },
    { name: 'Car Wash', a: '#2a5fb0', b: '#6fa8f0', line: 'rgba(255,255,255,.18)', tile: 70 }
  ];
  function bgNow() { return BGS[Math.floor((ballN - 1) / 3) % BGS.length]; }
  function drawBg() {
    const th = bgNow(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.a); g.addColorStop(1, th.b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = th.line; ctx.lineWidth = 2; const ts = th.tile * u; for (let x = 0; x < W; x += ts) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += ts) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (th.name === 'Garage') { ctx.fillStyle = '#d33a2a'; ctx.beginPath(); ctx.roundRect(W * 0.05, H * 0.08, W * 0.34, 28 * u, 6); ctx.fill(); ctx.fillStyle = '#444'; for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.08 + i * W * 0.08, H * 0.08 + 6, 4, 18 * u); ctx.fillStyle = '#ffcf3a'; ctx.fillRect(W * 0.62, H * 0.09, W * 0.3, 8 * u); ctx.fillRect(W * 0.62, H * 0.09 + 18 * u, W * 0.2, 8 * u); }
    else if (th.name === 'Spa') { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.roundRect(W * 0.06, H * 0.08, 60 * u, 40 * u, 8); ctx.fill(); ctx.fillStyle = '#7ad0a0'; ctx.beginPath(); ctx.ellipse(W * 0.84, H * 0.1, 34 * u, 14 * u, -0.3, 0, TAU); ctx.ellipse(W * 0.8, H * 0.1 + 10, 30 * u, 12 * u, 0.6, 0, TAU); ctx.fill(); }
    else if (th.name === 'Car Wash') { for (let i = 0; i < 6; i++) { const k = ((t * 0.4 + i * 0.17) % 1); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc((i * 71) % W, H - k * H, 6 + (i % 3) * 5, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffd23a'; for (let x = 0; x < W; x += 60 * u) ctx.fillRect(x, H * 0.04, 30 * u, 8 * u); }
    else { ctx.fillStyle = '#c8d0d8'; ctx.beginPath(); ctx.roundRect(W / 2 - 14 * u, 0, 28 * u, H * 0.07, 6); ctx.fill(); ctx.fillStyle = '#9fb0bc'; ctx.fillRect(W / 2 - 4, H * 0.07, 8, 10 * u); for (let i = 0; i < 3; i++) { const k = ((t * 1.6 + i * 0.33) % 1); ctx.fillStyle = 'rgba(160,220,255,.8)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.07 + 14 * u + k * H * 0.12, 3, 5, 0, 0, TAU); ctx.fill(); } }
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7fd6f0'); g.addColorStop(1, '#bff0ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawBg();
    /* sink bucket */
    ctx.fillStyle = '#4bb3e0'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.95, R * 1.25, R * 0.28, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9ee3ff'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.9, R * 1.12, R * 0.2, 0, 0, TAU); ctx.fill();
    const sq = 1 + Math.sin(wob * 1.4) * 0.025 * scrubV * 6, tilt = Math.sin(wob * 0.9) * 0.06 * Math.min(1, scrubV * 3);
    ctx.save(); ctx.translate(bcx, cy); ctx.rotate(tilt); ctx.scale(sq, 2 - sq);
    Golf.ball(ctx, 0, 0, R, { mood: doneT >= 0 ? 'happy' : (giggle > 0 ? 'happy' : 'happy'), blink: blink > 0 || giggle > 0.1 && Math.random() < 0.3, face: true });
    /* dirt clipped to ball */
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 0.98, 0, TAU); ctx.clip(); ctx.drawImage(stain, -R, -R, R * 2, R * 2); ctx.drawImage(mud, -R, -R, R * 2, R * 2); ctx.restore();
    ctx.restore();
    /* sponge */
    if (ptr && mode === 'play') { ctx.save(); ctx.translate(ptr.sx, ptr.sy); ctx.rotate(-0.4 + Math.sin(t * 20) * 0.08 * (scrubV > 0.05 ? 1 : 0)); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.roundRect(-30 * u, -20 * u, 60 * u, 40 * u, 10 * u); ctx.fill(); ctx.fillStyle = '#4fbf5a'; ctx.beginPath(); ctx.roundRect(-30 * u, 8 * u, 60 * u, 12 * u, [0, 0, 10 * u, 10 * u]); ctx.fill(); ctx.fillStyle = 'rgba(160,110,0,.5)'; [[-14, -6], [4, -10], [16, 0], [-4, 2]].forEach(a => { ctx.beginPath(); ctx.arc(a[0] * u, a[1] * u, 3 * u, 0, TAU); ctx.fill(); }); ctx.restore(); }
    bubbles.forEach(b => { ctx.globalAlpha = 1 - b.age / b.life; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke(); }); ctx.globalAlpha = 1;
    sparkles.forEach(s => { ctx.globalAlpha = 1 - s.age / s.life; ctx.fillStyle = '#fff7b0'; const z = 5; ctx.beginPath(); ctx.moveTo(s.x, s.y - z); ctx.lineTo(s.x + 1.5, s.y - 1.5); ctx.lineTo(s.x + z, s.y); ctx.lineTo(s.x + 1.5, s.y + 1.5); ctx.lineTo(s.x, s.y + z); ctx.lineTo(s.x - 1.5, s.y + 1.5); ctx.lineTo(s.x - z, s.y); ctx.lineTo(s.x - 1.5, s.y - 1.5); ctx.fill(); }); ctx.globalAlpha = 1;
    floats.forEach(f => { ctx.globalAlpha = 1 - f.age / 1.2; ctx.font = '700 28px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,70,110,.7)'; ctx.lineWidth = 5; ctx.strokeText(f.txt, f.x, f.y - f.age * 40); ctx.fillText(f.txt, f.x, f.y - f.age * 40); ctx.globalAlpha = 1; });
    if (mode === 'play') {
      const bw = Math.min(W - 60, 300), bx = (W - bw) / 2, by = cy + R + 54 * u; ctx.fillStyle = 'rgba(0,50,90,.35)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 18, 9); ctx.fill(); ctx.fillStyle = clean > 0.8 ? '#ffe066' : '#5fe08a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(18, bw * clamp(clean / 0.96, 0, 1)), 18, 9); ctx.fill();
      ctx.font = '700 13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,60,100,.6)'; ctx.lineWidth = 3; const m = Math.round(clamp(clean / 0.96, 0, 1) * 100) + '% clean'; ctx.strokeText(m, W / 2, by + 36); ctx.fillText(m, W / 2, by + 36);
      if (ballN === 1 && clean < 0.1) { ctx.font = '700 16px Fredoka, sans-serif'; ctx.strokeText('Scrub the mud off!', W / 2, cy - R - 28 * u); ctx.fillText('Scrub the mud off!', W / 2, cy - R - 28 * u); }
    }
  }
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const r = Math.min(h * 0.4, w * 0.2); Golf.ball(c, w * 0.32, h * 0.52, r, { mood: 'happy', blink: Math.sin(t * 2) > 0.97 });
    c.fillStyle = 'rgba(110,74,38,.95)'; c.beginPath(); c.arc(w * 0.32 + r * 0.3, h * 0.52 - r * 0.2, r * 0.3, 0, TAU); c.arc(w * 0.32 - r * 0.4, h * 0.52 + r * 0.4, r * 0.22, 0, TAU); c.fill();
    c.save(); c.translate(w * 0.66, h * 0.55); c.rotate(-0.3 + Math.sin(t * 5) * 0.1); c.fillStyle = '#ffd84a'; c.beginPath(); c.roundRect(-34, -22, 68, 44, 10); c.fill(); c.fillStyle = '#4fbf5a'; c.beginPath(); c.roundRect(-34, 8, 68, 14, [0, 0, 10, 10]); c.fill(); c.restore();
    for (let i = 0; i < 4; i++) { const k = ((t * 0.5 + i * 0.25) % 1); c.globalAlpha = 1 - k; c.strokeStyle = '#fff'; c.beginPath(); c.arc(w * 0.5 + Math.sin(i * 3 + t) * 20, h * 0.4 - k * 40, 5 + i, 0, TAU); c.stroke(); } c.globalAlpha = 1;
  }
  function start() { mode = 'play'; ballN = 1; score = 0; timeLeft = 30; cleaned = 0; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); bubbles = []; sparkles = []; floats = []; newBall(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  makeDirt();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.05)); render(); drawTitleArt(); });
  window.__wash = { setBall(n) { ballN = n; newBall(); }, get state() { return { mode, ballN, score, timeLeft, clean, doneT, cx, cy, R }; } };
})();
