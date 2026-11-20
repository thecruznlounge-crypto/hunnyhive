/* Dune Buddies - drop and merge desert animals. Two of the same kind become the next bigger buddy. */
(function () {
  'use strict';
  Kit.ns('dune-buddies');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const CW = 300, CH = 450, WALL = 16, LINE = 92;
  const R = [13, 18, 24, 30, 37, 45, 54, 66];
  const PTS = [1, 3, 6, 10, 15, 21, 28, 36];
  const G = 1500, DT = 1 / 120;

  let W, H, u, sc, ox, oy;
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 720);
    const top = 66 + 50, bot = 62;
    sc = Math.min((W - 14) / (CW + WALL * 2), (H - top - bot) / (CH + WALL), 1.5);
    ox = (W - CW * sc) / 2; oy = top + (H - top - bot - CH * sc - WALL * sc) / 2 + 10;
  }
  S.onresize = layout; layout();

  let topTier0 = 0, mode = 'title', t = 0, bodies = [], score = 0, cur = 0, next = 0, dropX = CW / 2, dragging = false, cool = 0, over = 0, accum = 0, parts = [], floats = [], shake = 0, topTier = 0, merges = 0, dangerT = 0, id = 1, flash = 0;
  const best = () => Kit.get('best', 0);

  function pickTier() { const r = Math.random(); return r < 0.4 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3; }
  function reset() {
    stage = 1; sphinxM = 0; gust = 0; gustCd = 10; stageFlash = 0;
    bodies = []; score = 0; parts = []; floats = []; cool = 0; over = 0; dangerT = 0; topTier = 0; merges = 0; shake = 0; dropX = CW / 2;
    cur = pickTier(); next = pickTier();
  }
  function addBody(tier, x, y, vx, vy) {
    const b = { id: id++, tier, r: R[tier], x, y, vx: vx || 0, vy: vy || 0, a: rnd(-0.2, 0.2), w: 0, age: 0, pop: 0, rest: 0, dying: false, blink: rnd(1, 4), mood: 'neutral' };
    bodies.push(b); return b;
  }

  /* ---------------- physics ---------------- */
  function physics(dt) {
    for (const b of bodies) {
      b.age += dt; b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      b.w *= 0.995; b.vx *= 0.9995;
    }
    for (let it = 0; it < 5; it++) {
      for (const b of bodies) {
        if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -0.2; }
        if (b.x > CW - b.r) { b.x = CW - b.r; if (b.vx > 0) b.vx *= -0.2; }
        if (b.y > CH - b.r) { b.y = CH - b.r; if (b.vy > 0) { b.vy *= -0.15; b.vx *= 0.97; b.w += (b.vx / b.r) * 0.2; } }
      }
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        const dx = c.x - a.x, dy = c.y - a.y, rr = a.r + c.r;
        if (dx * dx + dy * dy >= rr * rr) continue;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001, nx = dx / d, ny = dy / d, ov = rr - d;
        const ma = a.r * a.r, mc = c.r * c.r, tot = ma + mc;
        a.x -= nx * ov * (mc / tot); a.y -= ny * ov * (mc / tot); c.x += nx * ov * (ma / tot); c.y += ny * ov * (ma / tot);
        const rvx = c.vx - a.vx, rvy = c.vy - a.vy, vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const jn = -(1 + 0.12) * vn / (1 / ma + 1 / mc);
          a.vx -= jn * nx / ma; a.vy -= jn * ny / ma; c.vx += jn * nx / mc; c.vy += jn * ny / mc;
          const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = clamp(-vt * 0.08 / (1 / ma + 1 / mc), -Math.abs(jn) * 0.3, Math.abs(jn) * 0.3);
          a.vx -= jt * tx / ma; a.vy -= jt * ty / ma; c.vx += jt * tx / mc; c.vy += jt * ty / mc;
          a.w -= jt / ma * 0.4 / a.r * 60; c.w += jt / mc * 0.4 / c.r * 60;
          if (-vn > 180) { thud(-vn); }
        }
      }
    }
    for (const b of bodies) { const sp = Math.hypot(b.vx, b.vy); if (sp < 6) { b.vx *= 0.6; b.vy *= 0.6; } }
    /* merges */
    const used = new Set(), add = [];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j];
      if (a.tier !== c.tier || used.has(a.id) || used.has(c.id)) continue;
      const dx = c.x - a.x, dy = c.y - a.y, rr = a.r + c.r + 1.5;
      if (dx * dx + dy * dy < rr * rr) { used.add(a.id); used.add(c.id); add.push([a, c]); }
    }
    for (const [a, c] of add) merge(a, c);
    if (add.length) bodies = bodies.filter(b => !used.has(b.id));
  }
  let thudAt = 0;
  function thud(v) { if (t - thudAt < 0.06) return; thudAt = t; Kit.tone(110 + Math.random() * 40, 0.07, 'triangle', clamp(v / 1500, 0.03, 0.12)); }
  function merge(a, c) {
    merges++;
    const x = (a.x + c.x) / 2, y = (a.y + c.y) / 2, vx = (a.vx + c.vx) / 2, vy = (a.vy + c.vy) / 2;
    if (a.tier >= 7) {
      score += 500; sphinxM++; setTimeout(checkStage, 0); float(x, y, '+500'); shake = 1; flash = 1; Kit.vibe(60);
      for (let i = 0; i < 40; i++) parts.push({ x, y, vx: rnd(-420, 420), vy: rnd(-520, 120), life: rnd(0.7, 1.4), age: 0, c: ['255,207,106', '255,255,255', '255,122,47'][i % 3], r: rnd(3, 6) });
      [523, 659, 784, 1047, 1319].forEach((f, i) => Kit.tone(f, 0.25, 'triangle', 0.18, 0, Kit.ac() ? Kit.ac().currentTime + i * 0.07 : 0));
      return;
    }
    const nt = a.tier + 1, n = addBody(nt, x, y, vx, vy - 60); n.pop = 1; n.mood = 'win';
    score += PTS[nt]; topTier = Math.max(topTier, nt); setTimeout(checkStage, 0); float(x, y - n.r, '+' + PTS[nt]);
    for (let i = 0; i < 8 + nt * 2; i++) parts.push({ x, y, vx: rnd(-200, 200), vy: rnd(-260, 40), life: rnd(0.3, 0.6), age: 0, c: '255,230,160', r: rnd(2, 4) });
    Kit.tone(300 + nt * 70, 0.18, 'triangle', 0.2, 140 + nt * 20); Kit.tone(450 + nt * 105, 0.14, 'sine', 0.12, 0, Kit.ac() ? Kit.ac().currentTime + 0.06 : 0);
    Kit.vibe(8 + nt * 3); shake = Math.max(shake, 0.1 + nt * 0.04);
    $('hudL').textContent = 'Score ' + score;
  }
  function float(x, y, txt) { floats.push({ x, y, txt, age: 0 }); }

  /* ---------------- play ---------------- */
  function drop() {
    if (cool > 0 || mode !== 'play') return;
    const r = R[cur], x = clamp(dropX, r + 1, CW - r - 1);
    addBody(cur, x, 40, 0, 0).age = -0.9;   // young: ignored by the danger line for a moment
    Kit.tone(380, 0.08, 'sine', 0.12, -120); cool = 0.55;
    cur = next; next = pickTier();
  }
  const toX = px => (px - ox) / sc;
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); if (mode !== 'play') return; dragging = true; dropX = toX(e.clientX); });
  S.canvas.addEventListener('pointermove', e => { if (dragging && mode === 'play') dropX = toX(e.clientX); });
  S.canvas.addEventListener('pointerup', e => { if (dragging && mode === 'play') { dropX = toX(e.clientX); drop(); } dragging = false; });
  S.canvas.addEventListener('pointercancel', () => { dragging = false; });
  addEventListener('keydown', e => {
    if (mode !== 'play') { if (e.key === 'Escape' || e.key === 'p') (mode === 'pause' ? resume() : 0); return; }
    if (e.key === 'ArrowLeft') dropX -= 14; else if (e.key === 'ArrowRight') dropX += 14; else if (e.key === ' ' || e.key === 'ArrowDown') drop(); else if (e.key === 'Escape' || e.key === 'p') pause();
  });

  function update(dt) {
    if (mode === 'play') {
      cool = Math.max(0, cool - dt);
      if (stage >= 4) { gustCd -= dt; if (gustCd <= 0 && gust <= 0) { gust = 2.5; gustDir = Math.random() < 0.5 ? -1 : 1; gustCd = rnd(9, 15); Kit.banner('Gust!', gustDir > 0 ? '\u2192' : '\u2190'); } if (gust > 0) { gust -= dt; bodies.forEach(b => { b.vx += gustDir * 380 * dt; }); } }
      stageFlash = Math.max(0, stageFlash - dt * 2);
      accum += dt; let n = 0; while (accum >= DT && n++ < 8) { physics(DT); accum -= DT; }
      let danger = false;
      for (const b of bodies) {
        if (b.age > 0.6 && b.y - b.r < LINE && Math.hypot(b.vx, b.vy) < 90) danger = true;
        b.pop = Math.max(0, b.pop - dt * 4); b.blink -= dt; if (b.blink < -0.12) b.blink = rnd(1.5, 4);
        if (b.mood === 'win' && b.age > 0.8) b.mood = 'neutral';
      }
      dangerT = danger ? dangerT + dt : Math.max(0, dangerT - dt * 2);
      if (dangerT > 2.2) gameOver();
    }
    shake = Math.max(0, shake - dt * 2.5); flash = Math.max(0, flash - dt * 2);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 0.9) floats.splice(i, 1); }
  }

  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score);
    const bt = Kit.get('tier', 0); if (topTier > bt) Kit.set('tier', topTier);
    Kit.tone(260, 0.6, 'sawtooth', 0.18, -180); bodies.forEach(b => { b.mood = 'dizzy'; });
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      $('resTitle').textContent = nb ? 'New best!' : 'The dune is full!';
      $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Biggest buddy', Desert.BUD[topTier].n) + row('Stage', stage) + row('Merges', merges) + row('Best score', Math.max(score, best()).toLocaleString());
      const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
      c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      Desert.buddy(g, topTier, cw / 2, ch / 2 + 4, Math.min(52, 20 + topTier * 6), { mood: 'win' });
      Kit.show('over');
    }, 900);
  }

  /* ---------------- rendering ---------------- */
  const THEMES = [
    { name: 'Sunset Dunes', g: ['#5a3a8c', '#e0658a', '#ffae5a', '#c98a45'], far: 'rgba(180,90,40,.45)', deco: 'dune' },
    { name: 'Palm Oasis', g: ['#3a8fd8', '#9ad8e8', '#ffe0a0', '#d8a860'], far: 'rgba(80,150,90,.5)', deco: 'palm' },
    { name: 'Pyramid Plains', g: ['#2a4a9a', '#d8845a', '#ffc070', '#c88a48'], far: 'rgba(170,100,50,.5)', deco: 'pyramid' },
    { name: 'Sandstorm', g: ['#8a6a48', '#c89a68', '#e0b880', '#b88848'], far: 'rgba(150,100,60,.55)', deco: 'storm' },
    { name: 'Starlit Temple', g: ['#080a30', '#2a2060', '#6a3a8a', '#4a3060'], far: 'rgba(40,30,80,.7)', deco: 'temple' }
  ];
  const GT = [3, 4, 5, 6, 7]; let stage = 1, sphinxM = 0, gust = 0, gustDir = 1, gustCd = 10, stageFlash = 0;
  const TH = () => THEMES[(stage - 1) % THEMES.length];
  function goalText() { return stage <= 5 ? 'Goal: ' + Desert.BUD[GT[stage - 1]].n : 'Goal: ' + (stage - 5) + ' Sphinx merge' + (stage - 5 > 1 ? 's' : ''); }
  function goalMet() { return stage <= 5 ? topTier >= GT[stage - 1] : sphinxM >= stage - 5; }
  function checkStage() {
    if (!goalMet()) return;
    stage++; sphinxM = 0; stageFlash = 1; let n = 0;
    bodies = bodies.filter(b => { if (b.tier <= 1 && n < 6) { n++; for (let i = 0; i < 6; i++) parts.push({ x: b.x, y: b.y, vx: rnd(-160, 160), vy: rnd(-200, 40), life: 0.6, age: 0, c: '255,230,160', r: 3 }); score += 5; return false; } return true; });
    Kit.banner('Stage ' + stage, TH().name); Kit.tone(660, 0.2, 'triangle', 0.2, 300); Kit.vibe(30);
  }
  function background(tt) {
    const th = TH(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.g[0]); g.addColorStop(0.3, th.g[1]); g.addColorStop(0.6, th.g[2]); g.addColorStop(1, th.g[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) { ctx.globalAlpha = (th.deco === 'temple' ? 0.9 : 0.25) * Math.abs(Math.sin(tt + i)); ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.3), 1.8, 1.8); } ctx.globalAlpha = 1;
    const mx = W * 0.2, my = H * 0.12; const sg = ctx.createRadialGradient(mx, my, 3, mx, my, 90 * u); sg.addColorStop(0, th.deco === 'temple' ? 'rgba(220,220,255,.6)' : 'rgba(255,240,190,.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.35);
    ctx.fillStyle = th.deco === 'temple' ? '#e8e8ff' : '#fff2c8'; ctx.beginPath(); ctx.arc(mx, my, 20 * u, 0, TAU); ctx.fill();
    const fy = H * 0.55;
    if (th.deco === 'pyramid') { ctx.fillStyle = 'rgba(190,120,60,.7)'; [[0.7, 130], [0.9, 80]].forEach(([x, h]) => { ctx.beginPath(); ctx.moveTo(W * x - h * u * 0.8, fy + 4); ctx.lineTo(W * x, fy - h * u); ctx.lineTo(W * x + h * u * 0.8, fy + 4); ctx.fill(); }); }
    if (th.deco === 'temple') { ctx.fillStyle = 'rgba(30,20,70,.9)'; ctx.fillRect(W * 0.6, fy - 70 * u, 14 * u, 74 * u); ctx.fillRect(W * 0.78, fy - 70 * u, 14 * u, 74 * u); ctx.fillRect(W * 0.58, fy - 84 * u, W * 0.24, 14 * u); ctx.beginPath(); ctx.moveTo(W * 0.56, fy - 84 * u); ctx.lineTo(W * 0.7, fy - 110 * u); ctx.lineTo(W * 0.84, fy - 84 * u); ctx.fill(); }
    ctx.fillStyle = th.far; ctx.beginPath(); ctx.moveTo(0, fy); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, fy + Math.sin(x * 0.015 + 1) * 26 * u + Math.sin(x * 0.04) * 6); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    if (th.deco === 'palm') { [0.12, 0.88].forEach((x, k) => { const px = W * x, py = fy + 18 * u; ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + (k ? -14 : 14) * u, py - 50 * u, px + (k ? -6 : 6) * u, py - 96 * u); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; ctx.strokeStyle = i % 2 ? '#2f8a44' : '#43a85a'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(px + (k ? -6 : 6) * u, py - 96 * u); ctx.quadraticCurveTo(px + Math.cos(a) * 30 * u, py - 96 * u + Math.sin(a) * 26 * u - 8 * u, px + Math.cos(a) * 42 * u, py - 90 * u + Math.sin(a) * 26 * u + 14 * u); ctx.stroke(); } }); }
    if (th.deco === 'storm') { ctx.fillStyle = 'rgba(230,200,150,.18)'; for (let i = 0; i < 10; i++) { const y = (i * 83 + tt * 40) % H, x = ((tt * 160 + i * 130) % (W + 200)) - 100; ctx.fillRect(x, y, 90 * u, 2); } }
  }
  function pit() {
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#f6d598'); g.addColorStop(1, '#d99a52');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -30, CW, CH + 30, [0, 0, 28, 28]); ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,30,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { ctx.beginPath(); const y = 40 + i * 48; ctx.moveTo(10, y); ctx.bezierCurveTo(90, y - 8, 200, y + 10, CW - 10, y); ctx.stroke(); }
    ctx.restore();
  }
  function pitFront() {
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const wg = ctx.createLinearGradient(-WALL, 0, 0, 0); wg.addColorStop(0, '#8a4a22'); wg.addColorStop(1, '#b8683a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.roundRect(-WALL, -30, WALL + 2, CH + WALL + 30, [8, 0, 0, 24]); ctx.fill();
    const wg2 = ctx.createLinearGradient(CW, 0, CW + WALL, 0); wg2.addColorStop(0, '#b8683a'); wg2.addColorStop(1, '#8a4a22');
    ctx.fillStyle = wg2; ctx.beginPath(); ctx.roundRect(CW - 2, -30, WALL + 2, CH + WALL + 30, [0, 8, 24, 0]); ctx.fill();
    ctx.fillStyle = '#8a4a22'; ctx.beginPath(); ctx.roundRect(-WALL, CH - 2, CW + WALL * 2, WALL + 2, [0, 0, 24, 24]); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,.25)'; ctx.fillRect(-WALL + 3, -26, 3, CH + 20); ctx.fillRect(CW + 3, -26, 3, CH + 20);
    /* danger line */
    const warn = dangerT > 0.2; ctx.strokeStyle = warn ? 'rgba(255,60,60,' + (0.5 + 0.5 * Math.sin(t * 14)) + ')' : 'rgba(120,40,10,.45)'; ctx.lineWidth = warn ? 4 : 2.5; ctx.setLineDash([12, 9]);
    ctx.beginPath(); ctx.moveTo(0, LINE); ctx.lineTo(CW, LINE); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function drawBuddy(b) {
    const k = 1 + b.pop * 0.28;
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
    Desert.buddy(ctx, b.tier, 0, 0, b.r, { rot: b.a, mood: b.mood, blink: b.blink < 0 });
    ctx.restore();
  }
  function render(dt) {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    background(t);
    if (mode === 'title') return;
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 5);
    pit(); pitFront();
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.rect(-WALL, -120, CW + WALL * 2, CH + 130); ctx.clip();
    bodies.forEach(drawBuddy);
    if (mode === 'play' && cool <= 0.0) {
      const r = R[cur], x = clamp(dropX, r + 1, CW - r - 1);
      ctx.strokeStyle = 'rgba(120,50,10,.4)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 40 + r); ctx.lineTo(x, CH); ctx.stroke(); ctx.setLineDash([]);
      Desert.buddy(ctx, cur, x, 40, r, { t, blink: false });
    } else if (mode === 'play') {
      const r = R[cur], x = clamp(dropX, r + 1, CW - r - 1); ctx.globalAlpha = 1 - cool / 0.55; Desert.buddy(ctx, cur, x, 40, r * (0.6 + 0.4 * (1 - cool / 0.55)), {}); ctx.globalAlpha = 1;
    }
    parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    floats.forEach(f => { const k = f.age / 0.9; ctx.globalAlpha = 1 - k * k; ctx.font = '700 22px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(90,40,10,.7)'; ctx.lineWidth = 5; ctx.fillStyle = '#fff6d0'; ctx.strokeText(f.txt, f.x, f.y - k * 40); ctx.fillText(f.txt, f.x, f.y - k * 40); ctx.globalAlpha = 1; });
    ctx.restore();
    ctx.restore();
    /* next preview */
    if (mode === 'play' || mode === 'pause') {
      const nx = W - 52 * u, ny = 98 * u;
      ctx.fillStyle = 'rgba(58,31,12,.85)'; ctx.beginPath(); ctx.roundRect(nx - 36 * u, ny - 30 * u, 72 * u, 76 * u, 14); ctx.fill(); ctx.strokeStyle = 'rgba(255,207,106,.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '700 ' + Math.round(12 * u) + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#ffd9a0'; ctx.textAlign = 'center'; ctx.fillText('NEXT', nx, ny - 14 * u);
      Desert.buddy(ctx, next, nx, ny + 14 * u, Math.min(R[next], 26) * u * 0.95, {});
      $('hudL').textContent = 'S' + stage + ' \u00B7 ' + score; $('hudR').textContent = ''; $('hudC').textContent = goalText();
    }
    /* evolution ladder */
    if (mode === 'play' || mode === 'pause' || mode === 'over') {
      const n = 8, gap = (W - 20) / n, yy = H - 32 * u;
      for (let i = 0; i < n; i++) {
        const x = 10 + gap * (i + 0.5), r = (7 + i * 1.1) * u; ctx.globalAlpha = i <= topTier ? 1 : 0.55;
        Desert.buddy(ctx, i, x, yy, r, {}); ctx.globalAlpha = 1;
        if (i < n - 1) { ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.beginPath(); const ax = x + gap * 0.5; ctx.moveTo(ax - 3, yy - 4); ctx.lineTo(ax + 3, yy); ctx.lineTo(ax - 3, yy + 4); ctx.fill(); }
      }
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,240,180,' + flash * 0.4 + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* title art */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const s = Math.min(w / 300, h / 150);
    for (let i = 0; i < 8; i++) {
      const r = (10 + i * 2.2) * s, x = 20 * s + i * (w - 40 * s) / 7, y = h - r - 6 - Math.abs(Math.sin(t * 2.2 + i * 0.8)) * 14 * s;
      Desert.buddy(c, i, x, y, r, { t, blink: false });
    }
  }

  /* ---------------- flow ---------------- */
  function start() { reset(); mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start);
  $('btnAgain').addEventListener('click', start);
  $('btnRestart').addEventListener('click', start);
  $('btnMenu').addEventListener('click', toMenu);
  reset();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(dt); render(dt); drawTitleArt(); });

  window.__dune = { get state() { return { stage, goal: goalText(), mode, score, n: bodies.length, topTier, merges, tiers: bodies.map(b => b.tier) }; }, drop(x) { dropX = x; cool = 0; drop(); }, R };
})();
