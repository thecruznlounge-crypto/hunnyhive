/* Hump Jump - bounce from hump to hump all the way to the stars. */
(function () {
  'use strict';
  Kit.ns('hump-jump');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); }
  S.onresize = layout; layout();

  let curStage = 0, mode = 'title', t = 0, camY = 0, plats = [], drops = [], birds = [], parts = [], floats = [], P, score = 0, dropCount = 0, topY = 0, startY = 0, hiPlat = 0, dir = 1, shake = 0, lastBird = 0, dragX = null, dead = false, deadT = 0;
  const G = 2000, V0 = 960, VS = 1750;
  const PW = () => 78 * u;

  function mkPlat(y, kind) {
    const w = PW(), x = rnd(w / 2 + 6, W - w / 2 - 6);
    const p = { x, y, kind, w, ox: x, ph: rnd(0, 6.3), amp: rnd(50, 110) * u, gone: false, crumble: 0, seed: Math.random(), skin: Math.min(3, Math.floor(mOf(y) / STAGE_H)) % 4 };
    return p;
  }
  function reset() { curStage = 0;
    plats = []; drops = []; birds = []; parts = []; floats = []; score = 0; dropCount = 0; dead = false; deadT = 0; shake = 0; lastBird = 0;
    startY = H * 0.86; camY = 0;
    plats.push({ x: W / 2, y: startY, kind: 'base', w: W * 1.2, ox: W / 2, ph: 0, amp: 0, gone: false, crumble: 0, seed: 0 });
    P = { x: W / 2, y: startY, vy: -V0 * u, vx: 0, sq: 0 };
    hiPlat = startY; topY = startY;
    fill(); syncHud();
  }
  function fill() {
    while (hiPlat > camY - H * 0.5) {
      const height = (startY - hiPlat) / u, d = clamp(height / 7000, 0, 1);
      const gap = rnd(78, 118 + 78 * d) * u; hiPlat -= gap;
      const r = Math.random(); let kind = 'camel';
      if (r < 0.14 + 0.22 * d) kind = 'move'; else if (r < 0.14 + 0.22 * d + 0.1 + 0.22 * d) kind = 'dune';
      const p = mkPlat(hiPlat, kind); plats.push(p);
      if (Math.random() < 0.09 && kind !== 'dune') drops.push({ x: p.x, y: p.y - 44 * u, p, got: false, ph: rnd(0, 6) });
      if (height > 700 && hiPlat < lastBird - 520 * u && Math.random() < 0.4 + 0.3 * d) { lastBird = hiPlat; birds.push({ x: rnd(40, W - 40), y: hiPlat - gap * 0.5, ph: rnd(0, 6), sp: rnd(70, 130) * u, dir: Math.random() < 0.5 ? -1 : 1, bx: rnd(40, W - 40) }); }
    }
  }
  function syncHud() { $('hudL').textContent = 'S' + (curStage + 1) + ' \u00B7 ' + Math.max(0, Math.round((startY - topY) / u / 10)) + ' m'; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = dropCount ? '\u{1F4A7} ' + dropCount : ''; }

  /* ---------- input ---------- */
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); dragX = e.clientX; try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {} });
  S.canvas.addEventListener('pointermove', e => { if (dragX == null || mode !== 'play' || dead) return; const dx = e.clientX - dragX; dragX = e.clientX; P.x += dx * 1.25; if (dx) dir = dx > 0 ? 1 : -1; });
  const up = () => { dragX = null; }; S.canvas.addEventListener('pointerup', up); S.canvas.addEventListener('pointercancel', up);
  window.addEventListener('deviceorientation', e => { if (mode === 'play' && !dead && e.gamma != null && Math.abs(e.gamma) > 3 && dragX == null) { P.x += e.gamma * 0.35; dir = e.gamma > 0 ? 1 : -1; } });
  const keys = {}; window.addEventListener('keydown', e => keys[e.key] = 1); window.addEventListener('keyup', e => keys[e.key] = 0);

  /* ---------- update ---------- */
  function bounce(v) { P.vy = -v * u; P.sq = 1; }
  function update(dt) {
    if (mode !== 'play') return;
    if (keys.ArrowLeft) { P.x -= 380 * dt; dir = -1; } if (keys.ArrowRight) { P.x += 380 * dt; dir = 1; }
    if (P.x < -10) P.x += W + 20; if (P.x > W + 10) P.x -= W + 20;
    if (!dead) {
      const oy = P.y; P.vy += G * u * dt; P.y += P.vy * dt; P.sq = Math.max(0, P.sq - dt * 4);
      if (P.vy > 0) plats.forEach(p => {
        if (p.gone) return; const hw = (p.kind === 'camel' || p.kind === 'move' ? 40 : p.w / 2 + 6) * u; const px = p.x;
        if (Math.abs(P.x - px) < (p.kind === 'base' ? 1e9 : hw) && oy <= p.y + 2 && P.y >= p.y) {
          P.y = p.y; bounce(V0); Kit.tone(380 + Math.random() * 60, 0.12, 'triangle', 0.14, 160);
          if (p.kind === 'dune') { p.crumble = 0.01; for (let i = 0; i < 14; i++) parts.push({ x: p.x + rnd(-30, 30) * u, y: p.y, vx: rnd(-60, 60), vy: rnd(-40, 60), age: 0, life: 0.8, c: '#e8b866' }); Kit.noise(0.15, 0.08, null, 1200); }
          else Kit.vibe(4);
        }
      });
      drops.forEach(d => { if (d.got) return; const dx = d.x - P.x, dy = d.y - (P.y - 26 * u); if (dx * dx + dy * dy < (30 * u) * (30 * u)) { d.got = true; dropCount++; score += 50; bounce(VS); shake = 0.4; floats.push({ x: d.x, y: d.y, txt: 'Super!', age: 0 }); Kit.tone(660, 0.2, 'triangle', 0.2, 500); Kit.vibe(15); for (let i = 0; i < 18; i++) parts.push({ x: d.x, y: d.y, vx: rnd(-120, 120), vy: rnd(-120, 120), age: 0, life: 0.6, c: '#8fe6ff' }); } });
      birds.forEach(b => { const dx = b.x - P.x, dy = b.y - (P.y - 30 * u); if (dx * dx + dy * dy < (30 * u) * (30 * u)) die(); });
      if (P.y < topY) { { const sn = Math.floor(mOf(P.y) / STAGE_H); if (sn !== curStage) { curStage = sn; if (sn > 0) { Kit.banner('Stage ' + (sn + 1), STAGES[sn % STAGES.length].name); Kit.tone(660, 0.2, 'triangle', 0.2, 300); } } } topY = P.y; score = Math.max(score, Math.round((startY - topY) / u / 10) * 1 + dropCount * 50); }
      if (P.y - camY > H + 40 * u) die();
    } else { deadT += dt; P.vy += G * u * dt; P.y += P.vy * dt; }
    camY = Math.min(camY, P.y - H * 0.42);
    plats.forEach(p => { if (p.kind === 'move') p.x = p.ox + Math.sin(t * 1.4 + p.ph) * p.amp * 0.6; if (p.crumble) { p.crumble += dt; if (p.crumble > 0.25) p.gone = true; } });
    plats = plats.filter(p => !p.gone && p.y < camY + H + 120); drops = drops.filter(d => !d.got && d.y < camY + H + 80);
    birds.forEach(b => { b.x = b.bx + Math.sin(t * 0.9 + b.ph) * 110 * u; }); birds = birds.filter(b => b.y < camY + H + 100);
    fill(); syncHud();
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 1) floats.splice(i, 1); }
    shake = Math.max(0, shake - dt * 2.5);
    if (dead && deadT > 1.1) finish();
  }
  function die() { if (dead) return; dead = true; deadT = 0; P.vy = -600 * u; Kit.tone(220, 0.6, 'sawtooth', 0.18, -150); Kit.vibe(50); }
  function finish() {
    mode = 'over'; const nb = score > Kit.get('best', 0); if (nb) Kit.set('best', score);
    $('hud').classList.remove('show');
    const m = Math.round((startY - topY) / u / 10), row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Splat!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Stage', curStage + 1) + row('Height', m + ' m') + row('Water drops', dropCount) + row('Best', Math.max(score, Kit.get('best', 0)).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    Desert.camel(g, cw / 2, ch - 8, Math.min(cw / 160, ch / 140), { mood: 'dizzy' });
    Kit.show('over');
  }

  /* ---------- render ---------- */
  const STAGES = [
    { name: 'Dune Sea', top: [74, 143, 216], bot: [255, 224, 170] },
    { name: 'Red Canyon', top: [60, 100, 190], bot: [255, 170, 120] },
    { name: 'Sky Road', top: [40, 90, 200], bot: [200, 230, 255] },
    { name: 'Dusk Peaks', top: [50, 30, 110], bot: [240, 130, 130] },
    { name: 'Star Trail', top: [6, 8, 36], bot: [70, 50, 120] }
  ];
  const STAGE_H = 80;
  function mOf(y) { return Math.max(0, (startY - y) / u / 10); }
  function stageAt(m) { return Math.min(STAGES.length * 99, Math.floor(m / STAGE_H)); }
  function sky() {
    const m = mOf(camY + H * 0.5), f = m / STAGE_H, i0 = Math.floor(f) % STAGES.length, i1 = (i0 + 1) % STAGES.length, k = f - Math.floor(f), kk = k * k * (3 - 2 * k);
    const A = STAGES[i0], B = STAGES[i1], mx = (a, b) => Math.round(a + (b - a) * kk);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + mx(A.top[0], B.top[0]) + ',' + mx(A.top[1], B.top[1]) + ',' + mx(A.top[2], B.top[2]) + ')'); g.addColorStop(1, 'rgb(' + mx(A.bot[0], B.bot[0]) + ',' + mx(A.bot[1], B.bot[1]) + ',' + mx(A.bot[2], B.bot[2]) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const night = (i0 === 4 ? 1 - kk : 0) + (i0 === 3 ? kk * 0.6 : 0) + (i1 === 4 && i0 === 3 ? kk * 0.4 : 0);
    if (night > 0.05) { ctx.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { const sx = (i * 137.5) % W, sy = ((i * 91.7 + camY * 0.12) % H + H) % H; ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))); ctx.fillRect(sx, sy, 2, 2); } ctx.globalAlpha = 1; }
    /* sun / moon */
    const sy0 = H * 0.16 + clamp(camY * 0.02, -80, 0) * 0 ; const sg = ctx.createRadialGradient(W * 0.78, sy0, 4, W * 0.78, sy0, 120 * u); sg.addColorStop(0, night > 0.5 ? 'rgba(220,220,255,.55)' : 'rgba(255,245,200,.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.5);
    ctx.fillStyle = night > 0.5 ? '#e8e8ff' : '#fff8d8'; ctx.beginPath(); ctx.arc(W * 0.78, sy0, 24 * u, 0, TAU); ctx.fill();
    /* parallax far silhouettes (only visible when low) */
    const lowK = clamp(1 - (startY - camY - H) / (u * 900), 0, 1);
    if (lowK > 0) { const by = H * 0.9 + (camY < 0 ? -camY * 0.3 : 0) * 0 + (startY - camY - H) * 0.35; ctx.fillStyle = 'rgba(205,150,90,' + lowK + ')'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 14) ctx.lineTo(x, by - 26 * u - Math.sin(x * 0.02 + 1) * 18 * u); ctx.lineTo(W, H); ctx.fill(); ctx.fillStyle = 'rgba(190,130,76,' + lowK + ')'; ctx.beginPath(); ctx.moveTo(W * 0.1, by - 22 * u); ctx.lineTo(W * 0.24, by - 96 * u); ctx.lineTo(W * 0.38, by - 22 * u); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * (1 - night)) + ')';
    for (let i = 0; i < 6; i++) { const cy = ((i * 190 + camY * 0.35) % (H + 100) + H + 100) % (H + 100) - 40, cxp = (i * 173 + 60 + t * (6 + i)) % (W + 160) - 80; [[0, 0, 24], [26, -7, 20], [-26, -3, 17], [48, 2, 14]].forEach(c => { ctx.beginPath(); ctx.arc(cxp + c[0] * u, cy + c[1] * u, c[2] * u, 0, TAU); ctx.fill(); }); }
  }
  function drawPlat(p) {
    const y = p.y - camY, x = p.x;
    if (p.kind === 'base') { ctx.fillStyle = '#d99a52'; ctx.fillRect(0, y, W, H - y + 100); ctx.fillStyle = '#e8b66c'; ctx.beginPath(); ctx.ellipse(W / 2, y + 4, W * 0.7, 26 * u, 0, Math.PI, TAU); ctx.fill(); return; }
    if (p.kind === 'dune') {
      const k = p.crumble ? clamp(1 - p.crumble / 0.25, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(x + (p.crumble ? Math.sin(t * 60) * 2 : 0), y);
      ctx.fillStyle = '#c98f45'; ctx.beginPath(); ctx.ellipse(0, 4, p.w / 2 + 8 * u, 10 * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#efc57a'; ctx.beginPath(); ctx.moveTo(-p.w / 2 - 6 * u, 4); ctx.quadraticCurveTo(0, -30 * u, p.w / 2 + 6 * u, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,90,30,.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(-p.w / 2, 4); ctx.quadraticCurveTo(0, -24 * u, p.w / 2, 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore(); return;
    }
    if (p.skin === 1) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(3, 8, p.w / 2 + 6, 7 * u, 0, 0, TAU); ctx.fill(); const rg = ctx.createLinearGradient(0, -6, 0, 14 * u); rg.addColorStop(0, '#d9774a'); rg.addColorStop(1, '#a24a2a'); ctx.fillStyle = rg; ctx.beginPath(); ctx.roundRect(-p.w / 2 - 6, -4, p.w + 12, 16 * u, 6); ctx.fill(); ctx.fillStyle = '#6fbf5a'; ctx.beginPath(); ctx.roundRect(-p.w / 2 - 6, -6, p.w + 12, 7, 4); ctx.fill(); ctx.restore(); return; }
    if (p.skin === 2) { ctx.save(); ctx.translate(x, y + 4); ctx.fillStyle = 'rgba(255,255,255,.95)'; [[-22, 0, 16], [-6, -8, 20], [14, -4, 18], [28, 2, 13]].forEach(c => { ctx.beginPath(); ctx.arc(c[0] * u, c[1] * u, c[2] * u, 0, TAU); ctx.fill(); }); ctx.fillStyle = 'rgba(180,210,240,.5)'; ctx.fillRect(-30 * u, 4 * u, 62 * u, 6 * u); ctx.restore(); return; }
    if (p.skin === 3) { ctx.save(); ctx.translate(x, y); const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 44 * u); gl.addColorStop(0, 'rgba(255,240,150,.6)'); gl.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = gl; ctx.fillRect(-44 * u, -44 * u, 88 * u, 88 * u); ctx.fillStyle = '#ffe066'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 11 : 25) * u; ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.55 - 2); } ctx.closePath(); ctx.fill(); ctx.restore(); return; }
    const s = 0.5 * u, bob = Math.sin(t * 2 + p.seed * 9) * 1.5;
    Desert.camel(ctx, x, y + 118 * s * 0.95 + bob, s, { t, flip: p.seed > 0.5, blink: 0, hump: 1, mood: 'neutral', walk: p.kind === 'move' ? 1 : 0 });
    if (p.kind === 'move') { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '700 11px Nunito, sans-serif'; ctx.textAlign = 'center'; }
  }
  function drawBird(b) {
    const x = b.x, y = b.y - camY, f = Math.sin(t * 12 + b.ph), s = u;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#2b1d26'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-30, -26 * f - 6, -46, -8 * f + 4); ctx.quadraticCurveTo(-28, 4, -8, 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(30, -26 * f - 6, 46, -8 * f + 4); ctx.quadraticCurveTo(28, 4, 8, 6); ctx.fill();
    ctx.fillStyle = '#d8b0a0'; ctx.beginPath(); ctx.arc(0, -10, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6a020'; ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(0, -2); ctx.lineTo(3, -9); ctx.fill();
    ctx.fillStyle = '#d33'; ctx.fillRect(-4, -12, 2, 2); ctx.fillRect(2, -12, 2, 2);
    ctx.restore();
  }
  function drawDrop(d) {
    const y = d.y - camY + Math.sin(t * 4 + d.ph) * 4 * u, x = d.x, s = 12 * u, glow = ctx.createRadialGradient(x, y, 2, x, y, 26 * u); glow.addColorStop(0, 'rgba(160,230,255,.7)'); glow.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 26 * u, y - 26 * u, 52 * u, 52 * u);
    ctx.fillStyle = '#4cc3ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.quadraticCurveTo(x + s * 1.1, y + s * 0.2, x, y + s); ctx.quadraticCurveTo(x - s * 1.1, y + s * 0.2, x, y - s * 1.4); ctx.fill(); ctx.stroke();
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 5, rnd(-1, 1) * shake * 5);
    sky();
    if (mode !== 'title') {
      plats.forEach(drawPlat); drops.forEach(drawDrop); birds.forEach(drawBird);
      parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - 3, p.y - camY - 3, 6, 6); }); ctx.globalAlpha = 1;
      const s = 0.42 * u, sq = P.sq, rising = P.vy < 0;
      [-W, 0, W].forEach(off => { const px = P.x + off; if (px < -80 || px > W + 80) return; Desert.camel(ctx, px, P.y - camY, s, { t, flip: dir < 0, tuck: rising ? 1 : 0, sy: 1 - sq * 0.12 + (rising ? 0.06 : 0), sx: 1 + sq * 0.12, mood: dead ? 'dizzy' : 'neutral', walk: 0 }); });
      floats.forEach(f => { ctx.globalAlpha = 1 - f.age; ctx.font = '700 20px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(30,60,120,.7)'; ctx.lineWidth = 4; ctx.fillStyle = '#e6fbff'; ctx.strokeText(f.txt, f.x, f.y - camY - f.age * 40); ctx.fillText(f.txt, f.x, f.y - camY - f.age * 40); ctx.globalAlpha = 1; });
      if (mode === 'play' && !dead && topY > startY - 300 * u) { ctx.font = '700 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a2a12'; ctx.fillText('Drag left and right to steer', W / 2, H * 0.3); }
    }
    ctx.restore();
  }

  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const bob = Math.abs(Math.sin(t * 2.4)), s = Math.min(w / 260, h / 170) * 0.75, y = h - 8 - bob * 55 * s;
    Desert.camel(c, w * 0.5, y, s * 0.55 * 1.3, { t, tuck: 1, sy: 1.05 });
    Desert.camel(c, w * 0.22, h - 8, s * 0.55, { t, hump: 1 }); Desert.camel(c, w * 0.78, h - 8, s * 0.55, { t, hump: 1, flip: true });
  }

  function start() { mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); reset(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  reset();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(Math.min(dt, 0.033)); render(); drawTitleArt(); });

  window.__hump = { tp(mm) { P.y = startY - mm * 10 * u; P.vy = -400 * u; topY = P.y; camY = P.y - H * 0.42; plats = []; drops = []; birds = []; hiPlat = P.y + 40 * u; plats.push({ x: P.x, y: P.y + 30 * u, kind: 'camel', w: PW(), ox: P.x, ph: 0, amp: 0, gone: false, crumble: 0, seed: 0.3, skin: Math.min(3, Math.floor(mm / STAGE_H)) }); fill(); }, get state() { return { mode, dead, score, h: Math.round((startY - topY) / u / 10), x: P.x, y: P.y, camY, W, H }; }, steer() { const tgt = plats.filter(p => !p.gone && p.kind !== 'base' && p.y < P.y - 10 && p.y > P.y - 220 * u).sort((a, b) => b.y - a.y)[0]; if (tgt) P.x += clamp(tgt.x - P.x, -14, 14); } };
})();
