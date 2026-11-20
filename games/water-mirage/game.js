/* Water Mirage - one oasis is real. Find it before the heat gets you. */
(function () {
  'use strict';
  Kit.ns('water-mirage');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let W, H, u, hz;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); hz = H * 0.3; }
  S.onresize = layout; layout();

  /* ---------------- palm sprite ---------------- */
  function palmSprite(count, seed) {
    const w = 150, h = 120, c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d'); g.scale(2, 2);
    let sd = seed; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const palms = [];
    for (let k = 0; k < count; k++) palms.push({ x: count === 1 ? w / 2 : 38 + k * (w - 76) / Math.max(1, count - 1) + (r() - 0.5) * 12, h: 62 + r() * 28, lean: (r() - 0.5) * 22 });
    palms.sort((a, b) => a.h - b.h);
    palms.forEach(p => {
      const bx = p.x, by = h - 4, tx = p.x + p.lean, ty = by - p.h;
      g.strokeStyle = '#7a4a22'; g.lineWidth = 5.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + p.lean * 0.1, by - p.h * 0.55, tx, ty); g.stroke();
      g.strokeStyle = 'rgba(40,20,5,.35)'; g.lineWidth = 1.5; for (let i = 1; i < 7; i++) { const f = i / 7, x = bx + (tx - bx) * f * f * 0.9 + p.lean * 0.1 * f * (1 - f), y = by - p.h * f; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y + 1.5); g.stroke(); }
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.55 + (r() - 0.5) * 0.12, len = 30 + r() * 8;
        const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.8 + 12;
        g.fillStyle = i % 2 ? '#2f8a3c' : '#3fa24a'; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.55 - 8, ex, ey); g.quadraticCurveTo(tx + Math.cos(a) * len * 0.55 + 2, ty + Math.sin(a) * len * 0.55 + 2, tx, ty + 2); g.fill();
      }
      g.fillStyle = '#6a3a14'; g.beginPath(); g.arc(tx - 2, ty + 4, 3, 0, TAU); g.arc(tx + 3, ty + 5, 3, 0, TAU); g.fill();
    });
    return c;
  }

  /* ---------------- oasis drawing ---------------- */
  function wave(a, y, tt, f, ph) { return Math.sin(y * f + tt * 3.2 + ph) * a; }
  function drawOasis(c, o, tt, x, y, sc) {
    const rx = o.rx * sc, ry = o.ry * sc, tl = o.tells, fade = o.fade == null ? 1 : o.fade;
    c.save(); c.globalAlpha = fade;
    const sw = o.spr.width / 2, sh = o.spr.height / 2, ps = sc * 0.82 * o.palmK;
    const baseY = y - ry * 0.55, palmW = sw * ps, palmH = sh * ps;
    /* shore */
    if (!tl.noShore) {
      c.fillStyle = '#a9743a'; c.beginPath(); c.ellipse(x, y + 2 * sc, rx + 10 * sc, ry + 6 * sc, 0, 0, TAU); c.fill();
      c.fillStyle = '#4e9a46';
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + o.seed, gx = x + Math.cos(a) * (rx + 7 * sc), gy = y + Math.sin(a) * (ry + 4 * sc); c.beginPath(); c.ellipse(gx, gy, 6 * sc, 3.4 * sc, 0, 0, TAU); c.fill(); }
    } else {
      c.fillStyle = 'rgba(230,195,130,.5)'; c.beginPath(); c.ellipse(x, y + 1, rx + 3 * sc, ry + 1.5 * sc, 0, 0, TAU); c.fill();
    }
    /* water body */
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
    const wg = c.createLinearGradient(0, y - ry, 0, y + ry); wg.addColorStop(0, '#8fe6ff'); wg.addColorStop(0.5, '#33a8e6'); wg.addColorStop(1, '#1670bd');
    c.fillStyle = wg; c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    /* reflection: sliced and distorted */
    const amp = tl.shimmer;
    const reflOff = tl.reflOff || 0;
    const slice = 2;
    c.globalAlpha = fade * 0.78;
    for (let yy = 0; yy < ry * 2; yy += slice) {
      const f = yy / (ry * 2), sy = Math.floor((1 - f) * sh * 2);
      if (sy < 0) continue;
      const dx = wave(amp, yy, tt, 0.55, o.seed) + reflOff * (0.5 + f * 0.5);
      c.drawImage(o.spr, 0, sy, sw * 2, 2.2, x - palmW / 2 + dx + palmW * 0.0, y - ry + yy * 0.9 + 0, palmW, slice * 0.9 + 0.6);
    }
    c.globalAlpha = fade;
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - rx, y - ry, rx * 2, ry * 0.5);
    /* ripples */
    if (!tl.noRipple) {
      o.rip.forEach(rp => { const k = (tt - rp.t0) / 1.6; if (k < 0 || k > 1) return; c.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(x + rp.dx * rx, y + rp.dy * ry, rx * 0.34 * k + 2, ry * 0.34 * k + 1, 0, 0, TAU); c.stroke(); });
    }
    /* heat lines on mirages */
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); const yy = y - ry + (i + 1) * ry * 2 / 5; for (let xx = -rx; xx <= rx; xx += 6) { const v = wave(amp * 0.7 + 0.4, xx, tt * 0.7 + i, 0.18, i) ; xx === -rx ? c.moveTo(x + xx, yy + v) : c.lineTo(x + xx, yy + v); } c.stroke(); }
    c.restore();
    /* rim */
    c.strokeStyle = tl.noShore ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.65)'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
    /* palms (upright), slightly distorted by heat */
    const ph = 2.4;
    for (let yy = 0; yy < sh * 2; yy += 2) {
      const dx = wave(amp * 0.55, yy, tt, 0.35, o.seed + 1);
      const dy = baseY - palmH + yy * ps * 0.5 * 1.0;
      c.drawImage(o.spr, 0, yy, sw * 2, 2.2, x - palmW / 2 + dx, baseY - palmH + (yy / (sh * 2)) * palmH, palmW, palmH / sh + 0.6);
    }
    c.restore();
  }

  /* ---------------- rounds ---------------- */
  let mode = 'title', t = 0, level = 1, score = 0, water = 100, pools = [], streak = 0, best = 0, state = 'play', stateT = 0, floats = [], parts = [], roundT = 0, mistakes = 0, shake = 0, flash = 0, seenReal = 0;
  const bestScore = () => Kit.get('best', 0);

  function params(L) {
    return {
      n: Math.min(7, 3 + Math.floor((L - 1) / 2)),
      amp: Math.max(1.7, 4.6 - 0.28 * L),
      refl: Math.max(7, 24 - 1.4 * L),
      tellN: L < 4 ? 3 : L < 8 ? 2 : 1,
      drain: Math.min(15, 5.5 + 0.45 * L)
    };
  }
  function makePools() {
    const P = params(level), list = [];
    const y0 = H * 0.36, y1 = H * 0.76, tries = 900;
    for (let k = 0; k < P.n; k++) {
      let placed = false;
      for (let a = 0; a < tries && !placed; a++) {
        const y = rnd(y0, y1), sc = (0.62 + 0.55 * (y - y0) / (y1 - y0)) * u, rx = 54 * sc, ry = 17 * sc, palmH = 96 * sc * 0.82;
        const x = rnd(rx + 14, W - rx - 14), box = { l: x - rx - 6, r: x + rx + 6, t: y - palmH - ry, b: y + ry + 6 };
        if (list.every(p => p.box.r < box.l || p.box.l > box.r || p.box.b < box.t || p.box.t > box.b)) { list.push({ x, y, sc, rx: 54, ry: 17, box }); placed = true; }
      }
    }
    const realIdx = rint(0, list.length - 1);
    const tellNames = ['shimmer', 'refl', 'shore', 'ripple'];
    list.forEach((p, i) => {
      p.real = i === realIdx; p.seed = rnd(0, 6.3); p.palmK = rnd(0.9, 1.1);
      p.spr = palmSprite(rint(1, 2), rint(3, 9999)); p.fade = 1; p.state = 'idle';
      p.rip = []; p.ripN = rnd(0, 1.5);
      const tl = { shimmer: 0.55, reflOff: 0, noShore: false, noRipple: false };
      if (!p.real) {
        const pick = shuffle(tellNames.slice()).slice(0, P.tellN);
        if (pick.includes('shimmer')) tl.shimmer = P.amp;
        if (pick.includes('refl')) tl.reflOff = (Math.random() < 0.5 ? -1 : 1) * P.refl * 0.6;
        if (pick.includes('shore')) tl.noShore = true;
        if (pick.includes('ripple')) tl.noRipple = true;
      }
      p.tells = tl;
    });
    pools = list;
  }
  function newRound() { { const ti = Math.floor((level - 1) / 3); if (level > 1 && (level - 1) % 3 === 0) { Kit.banner('Stage ' + (ti + 1), TH().name); Kit.tone(660, 0.2, 'triangle', 0.2, 300); } } makePools(); roundT = 0; state = 'play'; $('hudL').textContent = 'S' + (Math.floor((level - 1) / 3) + 1) + ' \u00B7 R' + level; syncHud(); }
  function syncHud() { $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = streak > 1 ? 'x' + Math.min(5, streak) : ''; const f = $('thirstFill'); f.style.width = clamp(water, 0, 100) + '%'; $('thirst').classList.toggle('low', water < 30); }

  /* ---------------- input ---------------- */
  S.canvas.addEventListener('pointerdown', e => {
    Kit.ac(); if (mode !== 'play' || state !== 'play') return;
    let hit = null, bd = 1e9;
    pools.forEach(p => { if (p.state !== 'idle') return; const rx = p.rx * p.sc + 16, ry = (p.ry * p.sc + 22), dx = (e.clientX - p.x) / rx, dy = (e.clientY - (p.y - 10 * p.sc)) / (ry + p.sc * 26); const d = dx * dx + dy * dy; if (d < 1.6 && d < bd) { bd = d; hit = p; } });
    if (hit) choose(hit);
  });
  function choose(p) {
    if (p.real) {
      p.state = 'win'; state = 'won'; stateT = 0; streak++;
      const bonus = Math.round(clamp(10 - roundT, 0, 10) * 15), pts = (100 + bonus) * Math.min(5, streak);
      score += pts; water = Math.min(100, water + 22); seenReal++;
      floats.push({ x: p.x, y: p.y - 50 * p.sc, txt: '+' + pts, age: 0 }); flash = 0.6;
      for (let i = 0; i < 30; i++) parts.push({ x: p.x + rnd(-p.rx * p.sc, p.rx * p.sc), y: p.y, vx: rnd(-90, 90), vy: rnd(-260, -60), life: rnd(0.5, 1), age: 0, c: '150,230,255', r: rnd(2, 4) });
      Kit.tone(523, 0.12, 'triangle', 0.2); Kit.tone(784, 0.25, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.noise(0.3, 0.1, null, 1500); Kit.vibe(15);
      Kit.banner('Real water!', streak > 1 ? streak + ' in a row' : null);
      syncHud();
    } else {
      p.state = 'gone'; streak = 0; mistakes++; water -= 28; shake = 0.8; Kit.vibe(40);
      for (let i = 0; i < 24; i++) parts.push({ x: p.x + rnd(-p.rx * p.sc, p.rx * p.sc), y: p.y + rnd(-10, 10), vx: rnd(-60, 60), vy: rnd(-80, 20), life: rnd(0.5, 1.1), age: 0, c: '255,230,160', r: rnd(2, 5) });
      floats.push({ x: p.x, y: p.y - 40 * p.sc, txt: 'Mirage!', age: 0 });
      Kit.tone(220, 0.4, 'sawtooth', 0.14, -120); Kit.noise(0.3, 0.12, null, 600);
      if (water <= 0) { water = 0; syncHud(); return gameOver(); }
      syncHud();
    }
  }

  function gameOver() {
    state = 'dead'; mode = 'over'; const nb = score > bestScore(); if (nb) Kit.set('best', score);
    Kit.tone(200, 0.8, 'sawtooth', 0.18, -150);
    const real = pools.find(p => p.real); if (real) real.state = 'reveal';
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      $('resTitle').textContent = nb ? 'New best!' : 'Parched!';
      $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Oases found', seenReal) + row('Best score', Math.max(score, bestScore()).toLocaleString());
      const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
      c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      Desert.camel(g, cw / 2, ch - 8, Math.min(cw / 160, ch / 140), { mood: 'dizzy', idle: false });
      Kit.show('over');
    }, 1400);
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode === 'play' || mode === 'over') {
      roundT += dt;
      if (mode === 'play' && state === 'play') { water -= params(level).drain * dt; syncHud(); if (water <= 0) { water = 0; syncHud(); gameOver(); } }
      pools.forEach(p => {
        p.ripN -= dt; if (p.ripN <= 0) { p.rip.push({ t0: t, dx: rnd(-0.55, 0.55), dy: rnd(-0.4, 0.4) }); p.ripN = rnd(0.8, 1.8); if (p.rip.length > 4) p.rip.shift(); }
        if (p.state === 'gone') p.fade = Math.max(0, p.fade - dt * 2.4);
      });
      if (state === 'won') { stateT += dt; pools.forEach(p => { if (!p.real && p.state === 'idle') p.fade = Math.max(0, p.fade - dt * 2); }); if (stateT > 1.5) { level++; newRound(); } }
    }
    shake = Math.max(0, shake - dt * 2.5); flash = Math.max(0, flash - dt * 2);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 1) floats.splice(i, 1); }
  }

  /* ---------------- render ---------------- */
  const THEMES = [
    { name: 'Golden Dunes', sky: ['#4a8fd8', '#ffd9a0', '#fff0c8'], far: '#e8b66c', g: ['#f4cd88', '#d99a52'], sun: '#fffbe0', night: false, deco: 'none' },
    { name: 'Red Mesa', sky: ['#2f6fc8', '#ffb888', '#ffe8c0'], far: '#c8704a', g: ['#eaa870', '#b86a3c'], sun: '#fff4d8', night: false, deco: 'mesa' },
    { name: 'Pyramid Haze', sky: ['#5a7ac0', '#e8b080', '#ffe6b8'], far: '#d8a060', g: ['#f0c880', '#c8905a'], sun: '#fffbe0', night: false, deco: 'pyramid' },
    { name: 'Dusk Flats', sky: ['#4a2a8a', '#e0658a', '#ffc080'], far: '#a86a50', g: ['#d89a68', '#a8684a'], sun: '#ffe8c0', night: false, deco: 'dune2' },
    { name: 'Starlit Sands', sky: ['#0a0f3a', '#2a3a8a', '#6a6ab0'], far: '#384a8a', g: ['#5a68a8', '#3a4478'], sun: '#e8ecff', night: true, deco: 'cactus' }
  ];
  const TH = () => THEMES[(Math.floor((Math.max(1, level) - 1) / 3)) % THEMES.length];
  function scenery(tt) {
    const th = TH(), g = ctx.createLinearGradient(0, 0, 0, hz + 30); g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 30);
    if (th.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(tt * 1.3 + i)); ctx.fillRect((i * 97) % W, (i * 53) % hz, 2, 2); } ctx.globalAlpha = 1; }
    const sx = W * 0.78, sy = hz * 0.5; const rg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 150 * u); rg.addColorStop(0, th.night ? 'rgba(220,230,255,.8)' : 'rgba(255,255,230,1)'); rg.addColorStop(0.2, th.night ? 'rgba(160,180,255,.4)' : 'rgba(255,240,170,.8)'); rg.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, hz + 40);
    ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sx, sy, 32 * u, 0, TAU); ctx.fill();
    if (th.deco === 'mesa') { ctx.fillStyle = '#a8502e'; [[0.12, 60, 50], [0.34, 40, 36], [0.66, 70, 60]].forEach(([x, h, w]) => { ctx.beginPath(); ctx.moveTo(W * x - w * u, hz + 6); ctx.lineTo(W * x - w * u * 0.75, hz - h * u); ctx.lineTo(W * x + w * u * 0.75, hz - h * u); ctx.lineTo(W * x + w * u, hz + 6); ctx.fill(); }); }
    if (th.deco === 'pyramid') { ctx.fillStyle = '#c08850'; [[0.2, 70], [0.42, 48]].forEach(([x, h]) => { ctx.beginPath(); ctx.moveTo(W * x - h * u, hz + 4); ctx.lineTo(W * x, hz - h * u); ctx.lineTo(W * x + h * u, hz + 4); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.moveTo(W * x, hz - h * u); ctx.lineTo(W * x + h * u, hz + 4); ctx.lineTo(W * x, hz + 4); ctx.fill(); ctx.fillStyle = '#c08850'; }); }
    ctx.fillStyle = th.far; ctx.beginPath(); ctx.moveTo(0, hz + 40); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, hz + Math.sin(x * 0.012 + 2) * 12 * u + Math.sin(tt * 2 + x * 0.05) * 1.2); ctx.lineTo(W, hz + 40); ctx.fill();
    const gg = ctx.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, th.g[0]); gg.addColorStop(1, th.g[1]); ctx.fillStyle = gg; ctx.fillRect(0, hz + 12 * u, W, H - hz);
    ctx.fillStyle = 'rgba(140,80,20,.14)'; for (let i = 0; i < 50; i++) ctx.fillRect((i * 91) % W, hz + 30 + ((i * 53) % (H - hz - 30)), 22, 2);
    if (th.deco === 'cactus') { ctx.fillStyle = '#1a3a52'; [[0.08, 70], [0.9, 56]].forEach(([x, h]) => { const cx3 = W * x, cy3 = hz + 30 * u; ctx.beginPath(); ctx.roundRect(cx3 - 6 * u, cy3 - h * u, 12 * u, h * u, 6 * u); ctx.fill(); ctx.beginPath(); ctx.roundRect(cx3 - 22 * u, cy3 - h * 0.7 * u, 8 * u, 24 * u, 4 * u); ctx.fill(); ctx.fillRect(cx3 - 22 * u, cy3 - h * 0.4 * u, 18 * u, 6 * u); }); }
    ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 5; i++) { const y = hz + 30 + i * 60 * u + Math.sin(tt * 1.3 + i) * 5; ctx.fillRect(0, y, W, 14 * u); }
  }
  function render(dt) {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 4);
    scenery(t);
    if (mode !== 'title') {
      pools.slice().sort((a, b) => a.y - b.y).forEach(p => {
        if (p.fade <= 0.01) return;
        const real = p.state === 'reveal' || p.state === 'win';
        drawOasis(ctx, p, t, p.x, p.y, p.sc);
        if (p.state === 'reveal' || (p.state === 'win')) { ctx.strokeStyle = 'rgba(255,255,160,' + (0.6 + 0.4 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx * p.sc + 12, p.ry * p.sc + 7, 0, 0, TAU); ctx.stroke(); }
      });
      parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      floats.forEach(f => { const k = f.age; ctx.globalAlpha = 1 - k * k; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(90,40,10,.7)'; ctx.lineWidth = 5; ctx.fillStyle = '#fff6d0'; ctx.strokeText(f.txt, f.x, f.y - k * 40); ctx.fillText(f.txt, f.x, f.y - k * 40); ctx.globalAlpha = 1; });
      if (mode === 'play' && state === 'play') { ctx.font = '700 ' + Math.round(16 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a2a12'; ctx.globalAlpha = 0.85; ctx.fillText(level === 1 ? 'Tap the real water' : 'Which one is real?', W / 2, H - 28 * u); ctx.globalAlpha = 1; }
    }
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(160,230,255,' + flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* title art: an oasis next to a shimmering twin */
  const ta = $('titleArt'); let demoReal = null, demoFake = null;
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    if (!demoReal) {
      const mk = real => ({ rx: 54, ry: 17, seed: real ? 1 : 3, palmK: 1, spr: palmSprite(2, real ? 77 : 91), fade: 1, rip: real ? [{ t0: 0, dx: 0, dy: 0 }] : [], ripN: 1, tells: real ? { shimmer: 0.5, reflOff: 0, noShore: false, noRipple: false } : { shimmer: 4, reflOff: 12, noShore: true, noRipple: true } });
      demoReal = mk(true); demoFake = mk(false);
    }
    demoReal.rip = [{ t0: t - (t % 1.6), dx: 0.2, dy: 0 }];
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const sc = Math.min(w / 300, h / 110) * 0.95;
    drawOasis(c, demoReal, t, w * 0.27, h * 0.72, sc); drawOasis(c, demoFake, t, w * 0.74, h * 0.72, sc);
    c.font = '700 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff1d6'; c.fillText('REAL', w * 0.27, h - 2); c.fillText('MIRAGE', w * 0.74, h - 2);
  }

  /* ---------------- flow ---------------- */
  function start() { level = 1; score = 0; water = 100; streak = 0; mistakes = 0; seenReal = 0; floats = []; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRound(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(dt); drawTitleArt(); });

  window.__mirage = { get state() { return { mode, state, level, score, water, n: pools.length, real: pools.findIndex(p => p.real), streak }; }, pick(i) { choose(pools[i]); }, setLevel(n) { level = n; newRound(); }, pools: () => pools.map(p => ({ x: p.x, y: p.y, real: p.real, tells: p.tells })) };
})();
