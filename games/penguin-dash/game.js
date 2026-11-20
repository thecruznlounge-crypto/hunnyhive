/* Penguin Dash - three-lane pseudo-3D ice runner. */
(function () {
  'use strict';
  Kit.ns('penguin-dash');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const K = 0.0021, ZFAR = 2300;
  let W, H, cx, hy, gy, u, LW;
  function layout() {
    W = S.W; H = S.H; cx = W / 2; u = Math.min(W / 390, H / 720);
    hy = H * 0.29; gy = H * 0.82; LW = 104 * u;
  }
  S.onresize = layout; layout();

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = z => 1 / (1 + Math.max(z, -60) * K);
  const best = () => Kit.get('best', 0);

  /* ---------------- state ---------------- */
  let mode = 'title', t = 0;
  let dist, speed, lane, px, py, vy, slideT, fish, chase, invuln, shake, flash, ents, nextZ, parts, streak, hitsTaken, bannerT, newBest;
  let demoDist = 0;

  function reset() {
    dist = 0; speed = 330; lane = 0; px = 0; py = 0; vy = 0; slideT = 0; fish = 0; chase = 0; invuln = 0; shake = 0; flash = 0;
    ents = []; parts = []; streak = 0; hitsTaken = 0; newBest = false; nextZ = 900;
    fillEnts();
  }

  /* ---------------- level generation ---------------- */
  function add(type, ln, z, h) { ents.push({ type, lane: ln, z, h: h || 0, done: false }); }
  function fishLine(ln, z0, n, h) { for (let i = 0; i < n; i++) add('fish', ln, z0 + i * 78, h || 0); }
  function fishArc(ln, z0, n) { for (let i = 0; i < n; i++) add('fish', ln, z0 + i * 70, Math.sin((i + 0.5) / n * Math.PI) * 58); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function spawn() {
    const d = clamp(dist / 14000, 0, 1);
    const z = nextZ, lanes = [-1, 0, 1];
    const r = Math.random();
    let len = 420;
    if (r < 0.16) {
      const ln = pick(lanes); fishLine(ln, z, 7); len = 620;
    } else if (r < 0.40) {
      const open = pick(lanes);
      lanes.forEach(l => { if (l !== open && (Math.random() < 0.55 + d * 0.4 || l === lanes.find(x => x !== open))) add('block', l, z + 120); });
      fishLine(open, z, 8); len = 560;
    } else if (r < 0.60) {
      const n = d > 0.25 && Math.random() < 0.5 ? 3 : (Math.random() < 0.5 ? 1 : 2);
      const ls = lanes.slice().sort(() => Math.random() - 0.5).slice(0, n);
      ls.forEach(l => add('spike', l, z + 140));
      fishArc(ls[0], z + 40, 6); len = 520;
    } else if (r < 0.76) {
      add('bridge', 0, z + 100);
      fishLine(pick(lanes), z + 20, 5); len = 520;
    } else if (r < 0.88) {
      const open = pick(lanes);
      lanes.forEach(l => { if (l !== open) add('crack', l, z + 100); });
      fishArc(open, z, 6); len = 500;
    } else {
      const a = pick(lanes), b = pick(lanes.filter(l => l !== a));
      add('block', a, z + 100); add('spike', b, z + 100 + (Math.random() < 0.5 ? 0 : 160));
      const c = lanes.find(l => l !== a && l !== b); fishLine(c, z, 6); len = 600;
    }
    nextZ = z + Math.max(len, speed * (0.82 - d * 0.18));
  }
  function fillEnts() { while (nextZ < dist + ZFAR + 400) spawn(); }

  /* ---------------- input ---------------- */
  function doLane(dir) {
    if (mode !== 'play') return;
    const n = clamp(lane + dir, -1, 1);
    if (n !== lane) { lane = n; Kit.noise(0.12, 0.07, null, 2500); }
  }
  function doJump() {
    if (mode !== 'play') return;
    if (py <= 0.5) { vy = 480; slideT = 0; Kit.tone(380, 0.18, 'sine', 0.12, 420); puff(5); }
  }
  function doSlide() {
    if (mode !== 'play') return;
    if (py > 4) vy = -760;
    slideT = 0.62; Kit.noise(0.3, 0.07, null, 900);
  }
  let sx0 = 0, sy0 = 0, sid = null, sused = false;
  const cv = S.canvas;
  cv.addEventListener('pointerdown', e => { sid = e.pointerId; sx0 = e.clientX; sy0 = e.clientY; sused = false; Kit.ac(); });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - sx0, dy = e.clientY - sy0, T = 26;
    if (Math.abs(dx) < T && Math.abs(dy) < T) return;
    if (Math.abs(dx) > Math.abs(dy)) doLane(dx > 0 ? 1 : -1); else if (dy < 0) doJump(); else doSlide();
    sx0 = e.clientX; sy0 = e.clientY; sused = true;
  });
  cv.addEventListener('pointerup', e => { if (e.pointerId === sid) { if (!sused) doJump(); sid = null; } });
  cv.addEventListener('pointercancel', () => { sid = null; });
  addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a') doLane(-1);
    else if (k === 'ArrowRight' || k === 'd') doLane(1);
    else if (k === 'ArrowUp' || k === 'w' || k === ' ') doJump();
    else if (k === 'ArrowDown' || k === 's') doSlide();
    else if (k === 'Escape' || k === 'p') (mode === 'play' ? pause() : mode === 'pause' ? resume() : 0);
  });

  /* ---------------- particles ---------------- */
  function puff(n) {
    for (let i = 0; i < n; i++) parts.push({ x: px * LW, y: 0, z: 0, vx: rnd(-90, 90), vy: rnd(30, 120), life: rnd(0.3, 0.6), age: 0, c: '255,255,255', r: rnd(2, 4) });
  }
  function sparkle(wx, h, c) {
    for (let i = 0; i < 8; i++) parts.push({ x: wx, y: h, z: 0, vx: rnd(-140, 140), vy: rnd(-40, 160), life: rnd(0.3, 0.55), age: 0, c: c || '255,214,94', r: rnd(2, 4) });
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode === 'play') {
      speed = Math.min(900, speed + (speed < 420 ? 90 : 7) * dt);
      dist += speed * dt;
      px += (lane - px) * (1 - Math.exp(-15 * dt));
      if (py > 0 || vy > 0) { vy -= 1750 * dt; py += vy * dt; if (py <= 0) { py = 0; vy = 0; puff(4); } }
      if (slideT > 0) { slideT -= dt; if (Math.random() < 0.6) parts.push({ x: px * LW, y: 4, z: 0, vx: rnd(-60, 60), vy: rnd(20, 70), life: 0.35, age: 0, c: '230,248,255', r: rnd(2, 4) }); }
      invuln = Math.max(0, invuln - dt); chase = Math.max(0, chase - 0.085 * dt);
      fillEnts();
      for (let i = ents.length - 1; i >= 0; i--) {
        const e = ents[i], rz = e.z - dist;
        if (rz < -140) { ents.splice(i, 1); continue; }
        if (e.done || rz > 24 || rz < -24) continue;
        const near = Math.abs(px - e.lane) < 0.62;
        if (e.type === 'fish') {
          if (near && (e.h < 28 || py > 12)) {
            e.done = true; fish++; streak++;
            Kit.tone(660 + Math.min(streak, 12) * 45, 0.12, 'triangle', 0.14);
            sparkle(e.lane * LW, e.h + 24);
          }
        } else if (!invuln) {
          let hit = false;
          if (e.type === 'block') hit = near;
          else if (e.type === 'spike') hit = near && py < 30;
          else if (e.type === 'crack') hit = near && py < 22;
          else if (e.type === 'bridge') hit = slideT <= 0;
          if (hit) { e.done = true; crash(); }
        }
      }
    } else {
      /* title / pause / over: gentle scroll */
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 260 * dt;
    }
    shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 2.5);
  }

  function crash() {
    streak = 0; shake = 1; flash = 1; Kit.vibe(60);
    Kit.noise(0.35, 0.3, null, 300); Kit.tone(120, 0.35, 'sawtooth', 0.22, -60);
    if (chase > 0.25) { caught(); return; }
    chase = 0.66; invuln = 1.3; hitsTaken++; speed = Math.max(330, speed * 0.78);
    Kit.banner('Ouch!', 'The seal is close');
  }

  function caught() {
    mode = 'over';
    const m = Math.floor(dist / 40);
    newBest = m > best();
    if (newBest) Kit.set('best', m);
    Kit.tone(300, 0.7, 'sawtooth', 0.2, -220);
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      $('resTitle').textContent = newBest ? 'New best!' : 'Gulp!';
      $('resStats').innerHTML = row('Distance', m + ' m', newBest) + row('Fish', fish) + row('Best', Math.max(m, best()) + ' m');
      Chars.portrait($('resPortrait'), 'penguin', 'dizzy');
      Kit.show('over');
    }, 650);
  }
  const row = (a, b, hi) => '<div class="row' + (hi ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';

  /* ---------------- rendering ---------------- */
  const stars = []; for (let i = 0; i < 60; i++) stars.push([Math.random(), Math.random() * 0.9, Math.random()]);
  function sky(tt) {
    const g = ctx.createLinearGradient(0, 0, 0, hy + 10);
    g.addColorStop(0, '#07162f'); g.addColorStop(0.55, '#0f3a6b'); g.addColorStop(1, '#6fc7e6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy + 10);
    ctx.fillStyle = '#fff';
    stars.forEach(s => { ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(tt * 1.4 + s[2] * 20)); ctx.fillRect(s[0] * W, s[1] * hy * 0.8, 1.6, 1.6); });
    ctx.globalAlpha = 1;
    /* aurora ribbons */
    for (let k = 0; k < 3; k++) {
      const base = hy * (0.22 + k * 0.1), amp = 14 + k * 6;
      const ag = ctx.createLinearGradient(0, base - 40, 0, base + 40);
      const hue = [150, 170, 200][k];
      ag.addColorStop(0, 'hsla(' + hue + ',90%,60%,0)'); ag.addColorStop(0.5, 'hsla(' + hue + ',90%,65%,.28)'); ag.addColorStop(1, 'hsla(' + hue + ',90%,60%,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.moveTo(0, base + 60);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, base + Math.sin(x * 0.012 + tt * (0.6 + k * 0.25) + k * 2) * amp - 14);
      ctx.lineTo(W, base + 60); ctx.closePath(); ctx.fill();
    }
  }
  function mountains(off) {
    const layers = [['#2b5d8c', 0.55, 90, 0.06], ['#1c4672', 0.8, 70, 0.14]];
    layers.forEach((L, li) => {
      ctx.fillStyle = L[0]; ctx.beginPath(); ctx.moveTo(0, hy + 2);
      const step = 70 * u, o = off * L[3] * -1;
      for (let x = -step; x <= W + step * 2; x += step) {
        const i = Math.round((x - o) / step), hh = (Math.abs(Math.sin(i * 12.9898 + li * 4.1) * 43758.5453) % 1);
        ctx.lineTo(x + step / 2 + (o % step), hy - (L[2] * (0.35 + hh * 0.65)) * u * L[1]);
        ctx.lineTo(x + step + (o % step), hy + 2);
      }
      ctx.lineTo(W, hy + 2); ctx.closePath(); ctx.fill();
    });
  }
  function ground(offDist) {
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#9fdcf2'); g.addColorStop(1, '#5fb2d8');
    ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
    /* track */
    const tl = (z, wl) => [cx - wl * LW * P(z), hy + (gy - hy) * P(z)];
    const edge = 1.55;
    const pb = (H - hy) / (gy - hy), a = tl(ZFAR, -edge), b = tl(ZFAR, edge);
    const c = [cx + edge * LW * pb, H], d = [cx - edge * LW * pb, H];
    const tg = ctx.createLinearGradient(0, hy, 0, H);
    tg.addColorStop(0, '#d4f2fc'); tg.addColorStop(1, '#f5fdff');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0] , c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    /* rim */
    ctx.strokeStyle = '#8fd2ee'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(d[0], d[1]); ctx.moveTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    /* lane lines */
    ctx.strokeStyle = 'rgba(120,190,225,.55)'; ctx.lineWidth = 2 * u;
    [-0.5, 0.5].forEach(l => {
      const p1 = tl(ZFAR, -l * -1 * -1), p2 = tl(-60, l);
      const q1 = [cx + l * LW * P(ZFAR), hy + (gy - hy) * P(ZFAR)], q2 = [cx + l * LW * P(-60), hy + (gy - hy) * P(-60)];
      ctx.setLineDash([14 * u, 18 * u]); ctx.lineDashOffset = -(offDist * 0.08);
      ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
    });
    ctx.setLineDash([]);
    /* cross sheen bars */
    const sp = 170, off = offDist % sp;
    for (let z = -off; z < ZFAR; z += sp) {
      if (z < -40) continue;
      const p = P(z), y = hy + (gy - hy) * p;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * p + 0.05) + ')';
      ctx.fillRect(cx - edge * LW * p, y, edge * 2 * LW * p, Math.max(1, 5 * p * u));
    }
  }
  function props(offDist) {
    const sp = 230, off = offDist % sp, base = Math.floor(offDist / sp);
    for (let k = Math.ceil(ZFAR / sp); k >= 0; k--) {
      const z = k * sp - off, idx = base + k;
      if (z < -50) continue;
      [-1, 1].forEach(side => {
        const h = Math.abs(Math.sin(idx * 7.13 + side * 3.3) * 99.1) % 1;
        if (h < 0.28) return;
        const wx = side * (2.25 + h * 1.3) * LW, p = P(z), x = cx + wx * p, y = hy + (gy - hy) * p, s = p * u * (0.8 + h * 0.7);
        const al = clamp((ZFAR - z) / 400, 0, 1); ctx.globalAlpha = al;
        if (h > 0.62) pine(x, y, s); else crystal(x, y, s, h);
        ctx.globalAlpha = 1;
      });
    }
  }
  function pine(x, y, s) {
    ctx.fillStyle = '#5b4a3c'; ctx.fillRect(x - 5 * s, y - 14 * s, 10 * s, 14 * s);
    for (let i = 0; i < 3; i++) {
      const w = (44 - i * 11) * s, yy = y - (14 + i * 26) * s;
      ctx.fillStyle = '#2b7a6d'; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - 36 * s); ctx.lineTo(x + w, yy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.moveTo(x - w * 0.62, yy - 14 * s); ctx.lineTo(x, yy - 36 * s); ctx.lineTo(x + w * 0.62, yy - 14 * s); ctx.quadraticCurveTo(x, yy - 6 * s, x - w * 0.62, yy - 14 * s); ctx.fill();
    }
  }
  function crystal(x, y, s, h) {
    for (let i = -1; i <= 1; i++) {
      const hh = (70 - Math.abs(i) * 22 + h * 20) * s, w = 15 * s;
      const g = ctx.createLinearGradient(x + i * 18 * s - w, 0, x + i * 18 * s + w, 0);
      g.addColorStop(0, '#bff0ff'); g.addColorStop(1, '#4fb3dd');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + i * 18 * s - w, y); ctx.lineTo(x + i * 18 * s - w * 0.5, y - hh * 0.8); ctx.lineTo(x + i * 18 * s, y - hh); ctx.lineTo(x + i * 18 * s + w * 0.7, y - hh * 0.7); ctx.lineTo(x + i * 18 * s + w, y); ctx.closePath(); ctx.fill();
    }
  }

  function drawEnt(e) {
    const rz = e.z - dist; if (rz > ZFAR || rz < -70) return;
    const p = P(rz), x = cx + e.lane * LW * p, y = hy + (gy - hy) * p, s = p * u;
    ctx.globalAlpha = clamp((ZFAR - rz) / 450, 0, 1);
    if (e.type === 'fish') {
      if (e.done) { ctx.globalAlpha = 1; return; }
      const fy = y - (e.h + 26) * s + Math.sin(t * 5 + e.z * 0.02) * 3 * s;
      ctx.fillStyle = 'rgba(0,30,60,.22)'; ctx.beginPath(); ctx.ellipse(x, y, 16 * s, 4.5 * s, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.translate(x, fy); ctx.scale(s, s);
      const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#ffe58a'); g.addColorStop(1, '#ff9a3c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-2, 0, 17, 10.5, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(25, -10); ctx.lineTo(25, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-6, -4, 8, 3, -0.2, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#16304f'; ctx.beginPath(); ctx.arc(-10, -2, 2.2, 0, 6.3); ctx.fill();
      ctx.restore();
    } else if (e.type === 'spike') {
      ctx.fillStyle = 'rgba(0,30,60,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 46 * s, 8 * s, 0, 0, 6.3); ctx.fill();
      [[-24, 38], [0, 56], [24, 40]].forEach((a, i) => {
        const g = ctx.createLinearGradient(x + a[0] * s - 14 * s, 0, x + a[0] * s + 14 * s, 0);
        g.addColorStop(0, '#d9f6ff'); g.addColorStop(0.55, '#7fd0ee'); g.addColorStop(1, '#2f8fbe');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + a[0] * s - 15 * s, y); ctx.lineTo(x + a[0] * s - 3 * s, y - a[1] * s); ctx.lineTo(x + a[0] * s + 15 * s, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.stroke();
      });
    } else if (e.type === 'crack') {
      ctx.fillStyle = '#0b3a66'; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 46 * s, 11 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#1c7ab0'; ctx.beginPath(); ctx.ellipse(x, y - 1 * s, 38 * s, 7.5 * s, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#8fd2ee'; ctx.lineWidth = Math.max(1, 2.5 * s); ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 46 * s, 11 * s, 0, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,220,245,.8)'; ctx.beginPath(); ctx.moveTo(x - 60 * s, y + 4 * s); ctx.lineTo(x - 44 * s, y - 4 * s); ctx.moveTo(x + 44 * s, y - 4 * s); ctx.lineTo(x + 62 * s, y + 6 * s); ctx.stroke();
    } else if (e.type === 'block') {
      const w = 78 * s, h = 70 * s;
      ctx.fillStyle = 'rgba(0,30,60,.28)'; ctx.beginPath(); ctx.ellipse(x + 6 * s, y, 52 * s, 9 * s, 0, 0, 6.3); ctx.fill();
      const g = ctx.createLinearGradient(x - w / 2, y - h, x + w / 2, y);
      g.addColorStop(0, '#e9fbff'); g.addColorStop(0.6, '#a8e4f6'); g.addColorStop(1, '#5eb9de');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 8 * s); ctx.fill();
      ctx.fillStyle = '#f6feff'; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h + 6 * s); ctx.quadraticCurveTo(x - w / 2, y - h, x - w / 2 + 8 * s, y - h); ctx.lineTo(x + w / 2 - 8 * s, y - h); ctx.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y - h + 6 * s); ctx.lineTo(x + w / 2, y - h + 16 * s); ctx.lineTo(x - w / 2, y - h + 16 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, 3 * s); ctx.beginPath(); ctx.moveTo(x - w / 2 + 12 * s, y - h + 28 * s); ctx.lineTo(x - w / 2 + 12 * s, y - 14 * s); ctx.stroke();
      ctx.strokeStyle = '#3f9ccb'; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 8 * s); ctx.stroke();
    } else if (e.type === 'bridge') {
      const hw = 1.55 * LW * p, beamY = y - 78 * s, bt = 26 * s;
      ctx.fillStyle = 'rgba(0,30,60,.18)'; ctx.fillRect(cx - hw, y - 4 * s, hw * 2, 8 * s);
      [-1, 1].forEach(sd => {
        const g = ctx.createLinearGradient(cx + sd * hw - 12 * s, 0, cx + sd * hw + 12 * s, 0);
        g.addColorStop(0, '#d9f6ff'); g.addColorStop(1, '#5eb9de');
        ctx.fillStyle = g; ctx.fillRect(cx + sd * hw - 13 * s, beamY, 26 * s, 78 * s + 3 * s);
      });
      const g = ctx.createLinearGradient(0, beamY - bt * 0.4, 0, beamY + bt);
      g.addColorStop(0, '#f6feff'); g.addColorStop(1, '#8fd6ef');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - hw - 16 * s, beamY - bt * 0.5, hw * 2 + 32 * s, bt * 1.4, 8 * s); ctx.fill();
      ctx.fillStyle = '#bfeaf8';
      for (let i = 0; i < 9; i++) { const ix = cx - hw + (i + 0.5) * (hw * 2 / 9); ctx.beginPath(); ctx.moveTo(ix - 7 * s, beamY + bt * 0.85); ctx.lineTo(ix, beamY + bt * 0.85 + (14 + (i % 3) * 7) * s); ctx.lineTo(ix + 7 * s, beamY + bt * 0.85); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(tt) {
    const x = cx + px * LW, bank = clamp((lane - px) * 0.22, -0.3, 0.3);
    const sliding = slideT > 0;
    ctx.fillStyle = 'rgba(0,30,60,' + (0.28 - py * 0.002) + ')';
    ctx.beginPath(); ctx.ellipse(x, gy + 2, (36 - py * 0.2) * u, 8 * u, 0, 0, 6.3); ctx.fill();
    if (invuln > 0 && Math.floor(tt * 16) % 2 === 0) return;
    Chars.draw(ctx, 'penguin', x, gy - py * u * 1.1, 0.64 * u, {
      t: tt * 1.6, moving: 1, mood: invuln > 0.9 ? 'scared' : 'neutral', tilt: sliding ? 0 : bank + (py > 4 ? -0.08 : 0),
      sx: sliding ? 1.35 : 1, sy: sliding ? 0.5 : (py > 4 ? 1.06 : 1), idle: false, lx: (lane - px) * 0.6
    });
  }
  function drawChase(tt) {
    if (chase < 0.05) return;
    const a = clamp(chase * 2, 0, 1);
    const x = cx + px * LW * 0.8 + Math.sin(tt * 9) * 4 * u, y = H + 120 * u - chase * 170 * u;
    ctx.globalAlpha = a;
    Chars.draw(ctx, 'seal', x, y, 1.05 * u, { t: tt * 2, mood: 'angry', moving: 1, idle: false });
    ctx.globalAlpha = 1;
    if (chase > 0.28) {
      const g = ctx.createLinearGradient(0, H, 0, H * 0.7);
      g.addColorStop(0, 'rgba(255,60,60,' + 0.35 * (0.6 + 0.4 * Math.sin(tt * 14)) + ')'); g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    }
  }

  function render(dt) {
    const tt = t, dd = mode === 'play' || mode === 'over' ? dist : demoDist;
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 7 * u, rnd(-1, 1) * shake * 5 * u);
    sky(tt); mountains(px * 40 + dd * 0.02); ground(dd); props(dd);
    if (mode === 'play' || mode === 'pause' || mode === 'over') {
      const list = ents.filter(e => e.z - dist > -80).sort((a, b) => b.z - a.z);
      for (const e of list) if (e.z - dist > 0) drawEnt(e);
      drawPlayer(tt);
      for (const e of list) if (e.z - dist <= 0) drawEnt(e);
      /* particles (world x offsets relative to centre, y up from ground) */
      parts.forEach(p => { const a = 1 - p.age / p.life; ctx.fillStyle = 'rgba(' + p.c + ',' + a + ')'; ctx.beginPath(); ctx.arc(cx + p.x * u, gy - p.y * u, p.r * u * a + 0.6, 0, 6.3); ctx.fill(); });
      drawChase(tt);
      /* speed lines */
      if (mode === 'play' && speed > 520) {
        ctx.strokeStyle = 'rgba(255,255,255,' + clamp((speed - 520) / 900, 0, 0.35) + ')'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) { const sx = (i * 137 + tt * 900) % W, sy = H * 0.45 + ((i * 71 + tt * 1300) % (H * 0.5)); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 30); ctx.stroke(); }
      }
    }
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.4 + ')'; ctx.fillRect(0, 0, W, H); }
    /* HUD text */
    if (mode === 'play' || mode === 'pause') {
      $('hudL').textContent = 'Fish ' + fish;
      $('hudC').textContent = Math.floor(dist / 40) + ' m';
      const r = $('hudR'); r.textContent = streak >= 5 ? 'x' + (1 + Math.floor(streak / 5)) : '';
    }
  }

  /* title art */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const sc = Math.min(w / 220, h / 150);
    c.fillStyle = 'rgba(0,30,60,.3)'; c.beginPath(); c.ellipse(w / 2, h - 8, 54 * sc, 9 * sc, 0, 0, 6.3); c.fill();
    const hop = Math.abs(Math.sin(t * 3.4)) * 14 * sc;
    Chars.draw(c, 'penguin', w / 2, h - 8 - hop, 1.05 * sc, { t, moving: 1, idle: false, lx: Math.sin(t) * 0.5 });
    for (let i = 0; i < 3; i++) {
      const fx = w / 2 + (i - 1) * 78 * sc, fy = h * 0.2 + Math.sin(t * 2 + i) * 6;
      c.save(); c.translate(fx, fy); c.scale(sc * 0.9, sc * 0.9); c.rotate(Math.sin(t * 2 + i) * 0.2);
      c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(0, 0, 17, 10, 0, 0, 6.3); c.fill();
      c.beginPath(); c.moveTo(12, 0); c.lineTo(25, -10); c.lineTo(25, 10); c.closePath(); c.fill();
      c.fillStyle = '#16304f'; c.beginPath(); c.arc(-9, -2, 2, 0, 6.3); c.fill(); c.restore();
    }
  }

  /* ---------------- flow ---------------- */
  function start() {
    reset(); mode = 'play';
    Kit.hideScreens(); $('hud').classList.add('show'); $('hudR').textContent = '';
    Kit.banner('Go!', null);
  }
  function pause(auto) {
    if (mode !== 'play') return;
    mode = 'pause'; Kit.show('pause');
  }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }

  reset(); mode = 'title';
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start);
  $('btnAgain').addEventListener('click', start);
  $('btnRestart').addEventListener('click', start);
  $('btnMenu').addEventListener('click', toMenu);

  Kit.loop((dt, tt) => {
    t = tt; S.watch(dt);
    if (mode === 'title') demoDist += 260 * dt;
    if (mode !== 'pause') update(dt);
    render(dt); drawTitleArt();
  });

  window.__penguin = { step(d) { update(d); }, get state() { return { mode, dist, fish, lane, py, chase, hitsTaken }; }, start, set(o) { Object.assign(window.__penguin._o = {}, o); } ,
    hack: { setLane: v => { lane = v; }, god: () => { invuln = 99; } } };
})();
