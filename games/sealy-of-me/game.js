/* Sealy of Me - juggle a beach ball on a seal's head. */
(function () {
  'use strict';
  Kit.ns('sealy-of-me');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const HEAD = 114;           // design-space height of the head top above the feet
  const best = () => Kit.get('best', 0);

  let W, H, u, floeY, topLimit;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); floeY = H * 0.85; topLimit = Math.max(96, H * 0.13); }
  S.onresize = layout; layout();

  let mode = 'title', t = 0;
  let seal, ball, items, parts, floats, score, lives, combo, maxCombo, caught, spawnT, urchinT, elapsed, gust, gustT, nextGust, shake, respawn, kick, mood, moodT, sink, bot = false;

  function reset() {
    seal = { x: W / 2, tx: W / 2, vx: 0, squash: 0 };
    items = []; parts = []; floats = []; score = 0; lives = 3; combo = 0; maxCombo = 0; caught = 0; spawnT = 1; urchinT = 6; elapsed = 0;
    gust = 0; gustT = 0; nextGust = 22; shake = 0; respawn = 0; kick = 0; mood = 'neutral'; moodT = 0; sink = null;
    ball = null; newBall(true);
  }
  function newBall(first) {
    ball = { x: clamp(seal.x + rnd(-24, 24), 40, W - 40), y: -30 * u, vx: rnd(-40, 40), vy: 60, a: 0, va: 0, r: 25 * u, dead: false };
  }
  const mult = () => Math.min(5, 1 + Math.floor(combo / 8));

  /* ---------------- items ---------------- */
  function spawnItem() {
    const d = clamp(elapsed / 90, 0, 1);
    const r = Math.random();
    let type = 'fish';
    if (r < 0.07) type = 'gold'; else if (r < 0.1 && lives < 3) type = 'heart';
    items.push({ type, x: rnd(44, W - 44), y: rnd(topLimit + 50, floeY - 260 * u), vx: 0, age: 0, life: 7, ph: rnd(0, 6) });
  }
  function spawnUrchin() {
    const d = clamp(elapsed / 90, 0, 1), fromL = Math.random() < 0.5;
    items.push({ type: 'urchin', x: fromL ? -30 : W + 30, y: rnd(topLimit + 60, floeY - 280 * u), vx: (fromL ? 1 : -1) * rnd(40, 70 + d * 60) * u, age: 0, life: 14, ph: rnd(0, 6) });
  }
  const IR = { fish: 20, gold: 22, heart: 20, urchin: 24 };

  /* ---------------- physics ---------------- */
  function step(dt) {
    const g = 1180 * u;
    /* seal */
    const old = seal.x;
    if (bot && ball) seal.tx = ball.x + Math.sin(t * 1.7) * 14 + (ball.vx * 0.12);
    seal.tx = clamp(seal.tx, 40, W - 40);
    seal.x += (seal.tx - seal.x) * (1 - Math.exp(-16 * dt));
    seal.vx = (seal.x - old) / dt;
    seal.squash = Math.max(0, seal.squash - dt * 5);
    kick = Math.max(0, kick - dt * 3);
    /* ball */
    if (ball && !ball.dead) {
      const n = Math.ceil(dt / 0.008), h = dt / n;
      for (let i = 0; i < n; i++) {
        ball.vy += g * h; ball.vx += gust * 230 * u * h;
        ball.x += ball.vx * h; ball.y += ball.vy * h; ball.a += ball.va * h;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.92; Kit.tone(300, 0.05, 'sine', 0.06); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * 0.92; Kit.tone(300, 0.05, 'sine', 0.06); }
        const top = floeY - HEAD * 0.86 * u, half = 44 * u;
        if (ball.vy > 0 && ball.y + ball.r >= top && ball.y + ball.r <= top + 34 * u + ball.vy * h * 1.2 && Math.abs(ball.x - seal.x) < half + ball.r * 0.55) {
          bounce(top, half);
        }
        if (ball.y - ball.r > floeY + 30 * u) { lose(); break; }
      }
      ball.va *= 0.995;
    }
    /* items */
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; it.age += dt; it.x += it.vx * dt;
      if (it.age > it.life || it.x < -60 || it.x > W + 60) { items.splice(i, 1); continue; }
      if (ball && !ball.dead) {
        const dx = ball.x - it.x, dy = ball.y - (it.y + Math.sin(t * 3 + it.ph) * 5 * u), rr = ball.r + IR[it.type] * u * 0.8;
        if (dx * dx + dy * dy < rr * rr) {
          if (it.type === 'urchin') { items.splice(i, 1); pop(); break; }
          collect(it); items.splice(i, 1);
        }
      }
    }
  }
  function bounce(top, half) {
    const off = clamp((ball.x - seal.x) / half, -1.3, 1.3);
    const apex = clamp(H * (0.42 + Math.min(combo, 24) * 0.0075), H * 0.42, floeY - topLimit - 60 * u);
    const need = Math.min(apex, floeY - topLimit - 70 * u);
    const vy = -Math.sqrt(2 * 1180 * u * need);
    ball.y = top - ball.r; ball.vy = vy;
    ball.vx = off * 330 * u + seal.vx * 0.42 + ball.vx * 0.12;
    ball.va = ball.vx * 0.02 + rnd(-3, 3);
    seal.squash = 1; kick = 1; combo++; maxCombo = Math.max(maxCombo, combo);
    score += mult();
    mood = combo > 0 && combo % 10 === 0 ? 'win' : mood; moodT = 0.5;
    Kit.tone(220 + Math.min(combo, 20) * 14, 0.14, 'triangle', 0.18, 140); Kit.noise(0.05, 0.08, null, 2000);
    sparkle(ball.x, top, '255,255,255', 5);
    if (combo === 10 || combo === 25 || combo === 50) { Kit.banner(combo + ' bounces!', 'x' + mult() + ' multiplier'); }
    Kit.vibe(6);
  }
  function collect(it) {
    const pts = it.type === 'gold' ? 50 : it.type === 'heart' ? 0 : 10;
    if (it.type === 'heart') { lives = Math.min(3, lives + 1); Kit.tone(660, 0.4, 'triangle', 0.2, 400); addFloat(it.x, it.y, '+1 life'); }
    else { score += pts * mult(); caught++; addFloat(it.x, it.y, '+' + pts * mult()); Kit.tone(it.type === 'gold' ? 1040 : 780, 0.12, 'triangle', 0.16, 200); }
    sparkle(it.x, it.y, it.type === 'heart' ? '255,111,142' : '255,214,94', 12);
    mood = 'win'; moodT = 0.7;
  }
  function pop() {
    sparkle(ball.x, ball.y, '255,120,120', 16); Kit.noise(0.2, 0.25, null, 1200); Kit.tone(160, 0.25, 'sawtooth', 0.15, -80);
    addFloat(ball.x, ball.y, 'Pop!'); looseLife('pop');
  }
  function lose() {
    sink = { x: ball.x, t: 0 };
    for (let i = 0; i < 14; i++) parts.push({ x: ball.x, y: floeY + 26 * u, vx: rnd(-130, 130), vy: rnd(-320, -90), life: rnd(0.4, 0.8), age: 0, c: '200,235,255', r: rnd(2, 4.5), g: 800 });
    Kit.noise(0.35, 0.22, null, 800); Kit.tone(180, 0.3, 'sine', 0.2, -100);
    looseLife('splash');
  }
  function looseLife(why) {
    ball.dead = true; combo = 0; lives--; shake = 0.7; mood = 'dizzy'; moodT = 1.2; Kit.vibe(50);
    if (lives <= 0) return gameOver();
    respawn = 1.0;
  }
  function sparkle(x, y, c, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-150, 150), vy: rnd(-200, 60), life: rnd(0.3, 0.6), age: 0, c, r: rnd(2, 4), g: 500 }); }
  function addFloat(x, y, txt) { floats.push({ x, y, txt, age: 0 }); }

  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score);
    Kit.tone(330, 0.7, 'sawtooth', 0.18, -240);
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      $('resTitle').textContent = nb ? 'New best!' : 'Sealy of me!';
      const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Best streak', maxCombo + ' bounces') + row('Fish caught', caught) + row('Best', Math.max(score, best()).toLocaleString());
      Chars.portrait($('resPortrait'), 'seal', 'dizzy'); Kit.show('over');
    }, 700);
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    t += 0;
    if (mode === 'play') {
      elapsed += dt;
      /* spawns */
      spawnT -= dt; if (spawnT <= 0 && items.filter(i => i.type !== 'urchin').length < 5) { spawnItem(); spawnT = rnd(0.9, 1.7); }
      urchinT -= dt; if (urchinT <= 0) { spawnUrchin(); urchinT = clamp(rnd(6, 9) - elapsed / 18, 2.2, 9); }
      /* gusts */
      nextGust -= dt; if (nextGust <= 0) { gust = Math.random() < 0.5 ? -1 : 1; gustT = 4; nextGust = rnd(24, 34); Kit.banner('Gust!', gust < 0 ? 'Wind from the right' : 'Wind from the left'); }
      if (gustT > 0) { gustT -= dt; if (gustT <= 0) gust = 0; }
      if (respawn > 0) { respawn -= dt; if (respawn <= 0) newBall(); }
      step(dt);
      if (mode === 'play') {
        $('hudL').innerHTML = '<span class="hearts">' + '♥'.repeat(Math.max(0, lives)) + '<span style="opacity:.25">' + '♥'.repeat(Math.max(0, 3 - lives)) + '</span></span>';
        $('hudC').textContent = score.toLocaleString();
        $('hudR').textContent = mult() > 1 ? 'x' + mult() : '';
      }
    } else if (mode === 'title') { demoUpdate(dt); }
    if (sink) { sink.t += dt; if (sink.t > 0.8) sink = null; }
    moodT = Math.max(0, moodT - dt); if (moodT <= 0 && mood !== 'neutral' && mode === 'play') mood = 'neutral';
    shake = Math.max(0, shake - dt * 2.4);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 500) * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 0.8) floats.splice(i, 1); }
  }

  /* demo bounce on the title screen is drawn in the title canvas */
  function demoUpdate() {}

  /* ---------------- input ---------------- */
  let drag = null;
  S.canvas.addEventListener('pointerdown', e => { Kit.ac(); drag = { id: e.pointerId, x0: e.clientX, s0: seal ? seal.tx : 0 }; });
  S.canvas.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id && mode === 'play') seal.tx = drag.s0 + (e.clientX - drag.x0) * 1.25; });
  S.canvas.addEventListener('pointerup', () => { drag = null; });
  S.canvas.addEventListener('pointercancel', () => { drag = null; });
  const keys = {};
  addEventListener('keydown', e => { keys[e.key] = true; if (e.key === 'Escape' || e.key === 'p') (mode === 'play' ? pause() : mode === 'pause' ? resume() : 0); });
  addEventListener('keyup', e => { keys[e.key] = false; });
  Kit.loop((dt, tt) => {
    t = tt; S.watch(dt);
    if (mode === 'play') { const k = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0); if (k) { seal.tx += k * 760 * u * dt; if (drag) drag.s0 += k * 760 * u * dt; } }
    if (mode !== 'pause') update(dt);
    render(dt); drawTitleArt();
  });

  /* ---------------- rendering ---------------- */
  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, floeY);
    g.addColorStop(0, '#6f7fe0'); g.addColorStop(0.45, '#f29bc4'); g.addColorStop(0.8, '#ffd3a0'); g.addColorStop(1, '#ffe9c4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* sun */
    const sx = W * 0.72, sy = floeY - 120 * u;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 160 * u); sg.addColorStop(0, 'rgba(255,250,220,.95)'); sg.addColorStop(0.25, 'rgba(255,225,170,.6)'); sg.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(sx, sy, 44 * u, 0, TAU); ctx.fill();
    /* clouds */
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 4; i++) { const x = ((i * 190 + t * (6 + i * 3)) % (W + 240)) - 120, y = topLimit + 20 + i * 60 * u; ctx.beginPath(); ctx.ellipse(x, y, 60 * u, 14 * u, 0, 0, TAU); ctx.ellipse(x + 34 * u, y - 8 * u, 38 * u, 14 * u, 0, 0, TAU); ctx.fill(); }
    /* icebergs */
    ctx.fillStyle = '#b8d9f2'; ctx.beginPath(); ctx.moveTo(0, floeY); ctx.lineTo(W * 0.08, floeY - 70 * u); ctx.lineTo(W * 0.17, floeY - 30 * u); ctx.lineTo(W * 0.27, floeY - 96 * u); ctx.lineTo(W * 0.4, floeY); ctx.fill();
    ctx.fillStyle = '#e4f3ff'; ctx.beginPath(); ctx.moveTo(W * 0.27, floeY - 96 * u); ctx.lineTo(W * 0.4, floeY); ctx.lineTo(W * 0.3, floeY); ctx.fill();
    ctx.fillStyle = '#c9e4f7'; ctx.beginPath(); ctx.moveTo(W * 0.62, floeY); ctx.lineTo(W * 0.74, floeY - 54 * u); ctx.lineTo(W * 0.9, floeY - 20 * u); ctx.lineTo(W, floeY - 60 * u); ctx.lineTo(W, floeY); ctx.fill();
  }
  function water() {
    const y0 = floeY + 10 * u;
    const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#4aa3e0'); g.addColorStop(1, '#16508f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, y0);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.04 + t * 1.8) * 4 * u);
    ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 16) { const y = y0 + (28 + k * 26) * u + Math.sin(x * 0.05 + t * 1.5 + k * 2) * 4 * u; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  }
  function floe() {
    const y = floeY, th = 34 * u;
    ctx.fillStyle = 'rgba(10,40,90,.3)'; ctx.beginPath(); ctx.ellipse(W / 2, y + th + 6 * u, W * 0.56, 12 * u, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + th); g.addColorStop(0, '#f6fdff'); g.addColorStop(0.4, '#cfeefb'); g.addColorStop(1, '#79c1e6');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-20, y - 4 * u); ctx.quadraticCurveTo(W / 2, y - 16 * u, W + 20, y - 4 * u); ctx.lineTo(W + 20, y + th * 0.7);
    for (let x = W + 20; x >= -20; x -= 40) ctx.lineTo(x, y + th * (0.8 + 0.2 * Math.abs(Math.sin(x * 0.07)))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(W / 2, y - 6 * u, W * 0.52, 6 * u, 0, 0, TAU); ctx.fill();
  }
  function drawBall(b) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    const r = b.r, cols = ['#ff5a6e', '#ffffff', '#3fb6e8', '#ffd45e', '#ff5a6e', '#ffffff', '#3fb6e8', '#ffd45e'];
    for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * TAU / 8, (i + 1) * TAU / 8); ctx.fill(); }
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,30,70,.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,100,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function drawItem(it) {
    const s = u, y = it.y + Math.sin(t * 3 + it.ph) * 5 * u, fade = clamp((it.life - it.age) / 1, 0, 1) * clamp(it.age / 0.25, 0, 1);
    ctx.save(); ctx.translate(it.x, y); ctx.globalAlpha = fade;
    if (it.type === 'urchin') {
      ctx.rotate(t * 0.8 + it.ph);
      ctx.fillStyle = '#3b2a63'; for (let i = 0; i < 14; i++) { const a = i * TAU / 14; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 18 * s, Math.sin(a - 0.12) * 18 * s); ctx.lineTo(Math.cos(a) * 34 * s, Math.sin(a) * 34 * s); ctx.lineTo(Math.cos(a + 0.12) * 18 * s, Math.sin(a + 0.12) * 18 * s); ctx.fill(); }
      const g = ctx.createRadialGradient(-5 * s, -6 * s, 2, 0, 0, 22 * s); g.addColorStop(0, '#9b6ee0'); g.addColorStop(1, '#4a2f8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20 * s, 0, TAU); ctx.fill();
      ctx.rotate(-(t * 0.8 + it.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6 * s, -2 * s, 4.5 * s, 0, TAU); ctx.arc(6 * s, -2 * s, 4.5 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#220f44'; ctx.beginPath(); ctx.arc(-6 * s, -2 * s, 2 * s, 0, TAU); ctx.arc(6 * s, -2 * s, 2 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#220f44'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-7 * s, -9 * s); ctx.lineTo(-2 * s, -7 * s); ctx.moveTo(7 * s, -9 * s); ctx.lineTo(2 * s, -7 * s); ctx.stroke();
    } else if (it.type === 'heart') {
      ctx.scale(s * (1 + Math.sin(t * 6) * 0.08), s * (1 + Math.sin(t * 6) * 0.08)); ctx.fillStyle = '#ff5a7e';
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -2, -14, -24, 0, -9); ctx.bezierCurveTo(14, -24, 26, -2, 0, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-8, -8, 5, 3, -0.6, 0, TAU); ctx.fill();
    } else {
      const gold = it.type === 'gold';
      ctx.scale(s * (gold ? 1.25 : 1), s * (gold ? 1.25 : 1)); ctx.rotate(Math.sin(t * 3 + it.ph) * 0.2);
      if (gold) { ctx.fillStyle = 'rgba(255,240,150,.5)'; ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(t * 8) * 2, 0, TAU); ctx.fill(); }
      const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, gold ? '#fff3a8' : '#8fe3ff'); g.addColorStop(1, gold ? '#ffb300' : '#2f9fd8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-2, 0, 17, 10.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(25, -10); ctx.lineTo(25, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-6, -4, 8, 3, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16304f'; ctx.beginPath(); ctx.arc(-10, -2, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawSeal(x, tilt, sq, k, mo, tt) {
    const s = 0.92 * u;
    ctx.fillStyle = 'rgba(10,40,90,.25)'; ctx.beginPath(); ctx.ellipse(x, floeY + 3 * u, 46 * u, 9 * u, 0, 0, TAU); ctx.fill();
    Chars.draw(ctx, 'seal', x, floeY + 2 * u, s, { t: tt, mood: mo, tilt, sx: 1 + sq * 0.1, sy: 1 - sq * 0.12, arm: k * 0.8, idle: false, moving: 0.3 });
  }
  function render(dt) {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 8, rnd(-1, 1) * shake * 6);
    sky(); water(); floe();
    if (mode === 'play' || mode === 'pause' || mode === 'over') {
      items.forEach(drawItem);
      if (ball && !ball.dead) {
        /* shadow on the floe */
        const hgt = clamp((floeY - ball.y) / (H * 0.8), 0, 1);
        ctx.fillStyle = 'rgba(10,40,90,' + (0.22 * (1 - hgt)) + ')'; ctx.beginPath(); ctx.ellipse(ball.x, floeY + 2 * u, ball.r * (1.1 - hgt * 0.5), 5 * u, 0, 0, TAU); ctx.fill();
      }
      drawSeal(seal.x, clamp(((ball && !ball.dead ? ball.x : seal.x) - seal.x) * 0.0016, -0.2, 0.2) + clamp(seal.vx * 0.00012, -0.15, 0.15), seal.squash, kick, mode === 'over' ? 'dizzy' : mood, t);
      if (ball && !ball.dead) drawBall(ball);
      if (gust) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 7; i++) { const y = topLimit + 40 + ((i * 97 + t * 40) % (floeY - topLimit - 100)), x = ((i * 131 + t * 520 * (gust > 0 ? 1 : -1)) % (W + 120) + W + 120) % (W + 120) - 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + gust * 50, y); ctx.stroke(); } }
      parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * u, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      floats.forEach(f => { const k = f.age / 0.8; ctx.globalAlpha = 1 - k * k; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(40,20,80,.6)'; ctx.lineWidth = 4; ctx.fillStyle = '#fff'; ctx.strokeText(f.txt, f.x, f.y - k * 40 * u); ctx.fillText(f.txt, f.x, f.y - k * 40 * u); ctx.globalAlpha = 1; });
    }
    ctx.restore();
  }

  /* title art: seal bouncing a ball */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const sc = Math.min(w / 220, h / 170), ph = (t * 1.4) % 1, hgt = Math.sin(ph * Math.PI);
    c.fillStyle = 'rgba(10,40,90,.25)'; c.beginPath(); c.ellipse(w / 2, h - 6, 50 * sc, 8 * sc, 0, 0, TAU); c.fill();
    const sw = Math.sin(t * 1.4 * Math.PI) * 0.0;
    Chars.draw(c, 'seal', w / 2, h - 6, 1.0 * sc, { t, idle: false, moving: 0.3, mood: hgt > 0.9 ? 'win' : 'neutral', arm: Math.sin(t * 6) * 0.2, sy: 1 - (1 - hgt) * 0.05 });
    const by = h - 6 - 112 * sc - hgt * 100 * sc - 20 * sc, bx = w / 2 + Math.sin(t * 1.4 * Math.PI) * 14 * sc, r = 20 * sc;
    c.save(); c.translate(bx, by); c.rotate(t * 3); const cols = ['#ff5a6e', '#ffffff', '#3fb6e8', '#ffd45e'];
    for (let i = 0; i < 8; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * TAU / 8, (i + 1) * TAU / 8); c.fill(); }
    c.strokeStyle = 'rgba(20,50,100,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.restore();
  }

  /* ---------------- flow ---------------- */
  function start() { reset(); mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); Kit.banner('Bounce it!', null); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  reset(); mode = 'title';
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start);
  $('btnAgain').addEventListener('click', start);
  $('btnRestart').addEventListener('click', start);
  $('btnMenu').addEventListener('click', toMenu);

  window.__sealy = { start, setBot(v) { bot = v; }, get state() { return { mode, score, lives, combo, maxCombo, caught, items: items.length, ball: ball && { x: ball.x, y: ball.y } }; }, step, HEAD };
})();
