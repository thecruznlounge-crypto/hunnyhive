/* Orcastra - four-lane rhythm game. Every hit plays a chord tone over a synthesized band. */
(function () {
  'use strict';
  Kit.ns('orcastra');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const COL = ['#ff8a3d', '#3fd0e8', '#ff6f9c', '#ffd45e'];
  const COL2 = ['#ffc59a', '#aef0ff', '#ffc2d6', '#fff0a8'];

  /* ---------------- songs ----------------
     root: semitones above A3 (220Hz). q: 0 major / 1 minor. */
  const SONGS = [
    { id: 'ice', name: 'Ice Breaker', bpm: 96, bars: 26, travel: 1.9, stars: 1, seed: 11,
      prog: [[0, 1], [8 - 12, 0], [3, 0], [10 - 12, 0]], dens: [0, 0.5, 0.72], dbl: 0,
      bass: [[0, 0, 1.5], [3, 0, 1], [4, 7, 1.5], [6, 0, 1]], kick: [0, 4], snare: [2, 6], drums: true },
    { id: 'disco', name: 'Deep Blue Disco', bpm: 118, bars: 30, travel: 1.7, stars: 2, seed: 29,
      prog: [[5, 1], [1, 0], [8, 0], [3, 0]], dens: [0, 0.62, 0.86], dbl: 0.15,
      bass: [[0, 0, 0.8], [1, 12, 0.5], [2, 0, 0.8], [3, 7, 0.5], [4, 0, 0.8], [5, 12, 0.5], [6, 7, 0.8], [7, 10, 0.5]], kick: [0, 2, 4, 6], snare: [2, 6], drums: true },
    { id: 'overdrive', name: 'Orca Overdrive', bpm: 138, bars: 34, travel: 1.55, stars: 3, seed: 47,
      prog: [[7, 1], [3, 0], [10, 0], [5, 0]], dens: [0, 0.72, 1.0], dbl: 0.3,
      bass: [[0, 0, 0.6], [1, 0, 0.5], [2, 0, 0.6], [3, 12, 0.5], [4, 0, 0.6], [5, 0, 0.5], [6, 7, 0.6], [7, 10, 0.5]], kick: [0, 3, 4, 6], snare: [2, 6], drums: true }
  ];
  const W8 = [1, 0.42, 0.85, 0.5, 0.95, 0.42, 0.85, 0.55];
  const chordSemis = q => (q ? [0, 3, 7, 12] : [0, 4, 7, 12]);
  const hz = semi => 220 * Math.pow(2, semi / 12);

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function energyOf(song, b) { if (b < 2) return 0; const blk = Math.floor((b - 2) / 8) % 2; return blk === 0 ? 1 : 2; }
  function chordOf(song, b) { return song.prog[((b - 1) % 4 + 4) % 4]; }

  function buildChart(song) {
    const R = mulberry(song.seed), notes = [];
    let prev = 1, run = 0;
    for (let b = 2; b < song.bars - 1; b++) {
      const e = energyOf(song, b), ch = chordOf(song, b), tones = chordSemis(ch[1]);
      for (let sl = 0; sl < 8; sl++) {
        if (R() >= song.dens[e] * W8[sl]) continue;
        let lane = prev + Math.floor(R() * 4) - 1; // walk
        lane = ((lane % 4) + 4) % 4;
        if (lane === prev && run >= 2) lane = (lane + 1 + Math.floor(R() * 3)) % 4;
        run = lane === prev ? run + 1 : 0; prev = lane;
        const beat = b * 4 + sl * 0.5;
        notes.push({ beat, lane, freq: hz(ch[0] + 12 + tones[lane]), j: 0 });
        if (e === 2 && sl % 4 === 0 && R() < song.dbl) {
          const l2 = (lane + 2) % 4;
          notes.push({ beat, lane: l2, freq: hz(ch[0] + 12 + tones[l2]), j: 0 });
        }
      }
    }
    const last = song.bars - 1, ch = chordOf(song, last);
    notes.push({ beat: last * 4, lane: 1, freq: hz(ch[0] + 24), j: 0 }, { beat: last * 4, lane: 2, freq: hz(ch[0] + 19), j: 0 });
    notes.sort((a, b) => a.beat - b.beat);
    return notes;
  }

  /* ---------------- state ---------------- */
  let W, H, laneW, lx0, hitY, topY, u;
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 720);
    laneW = Math.min((W - 16) / 4, 108); lx0 = (W - laneW * 4) / 2; hitY = H * 0.7; topY = H * 0.12;
  }
  S.onresize = layout; layout();

  let mode = 'title', t = 0;
  let song, notes, spb, startAC = 0, startPerf = 0, pauseAt = 0, pausedTotal = 0, nextSlot = 0, endTime = 0;
  let score, combo, maxCombo, crowd, counts, judged, accSum, flashLane = [0, 0, 0, 0], floats = [], parts = [], pulse = 0;
  let offsetMs = Kit.get('offset', 0), bot = false, botAcc = 0.03, rankCache = null;

  const clockOK = () => { const a = Kit.ac(); return a && a.state === 'running'; };
  function songTime() {
    if (mode === 'pause') return pauseAt;
    return clockOK() ? Kit.ac().currentTime - startAC : performance.now() / 1000 - startPerf - pausedTotal;
  }
  const noteTime = n => n.beat * spb + offsetMs / 1000;

  function startSong(s) {
    song = s; notes = buildChart(s); spb = 60 / s.bpm;
    score = 0; combo = 0; maxCombo = 0; crowd = 60; counts = { p: 0, g: 0, o: 0, m: 0 }; judged = 0; accSum = 0; floats = []; parts = []; nextSlot = 0;
    const a = Kit.ac(), lead = 0.5;
    startPerf = performance.now() / 1000 + lead; pausedTotal = 0;
    if (a) startAC = a.currentTime + lead;
    endTime = (s.bars - 1) * 4 * spb + 2.4;
    mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show');
    Kit.banner(s.name, 'Get ready', 'pop');
  }

  /* ---------------- audio scheduling ---------------- */
  function schedule() {
    const a = Kit.ac(); if (!a || !clockOK()) { nextSlot = Math.max(nextSlot, Math.floor(songTime() / (spb / 2)) + 1); return; }
    const ahead = a.currentTime + 0.25;
    const sl = spb / 2;
    while (startAC + nextSlot * sl < ahead && nextSlot < song.bars * 8) {
      const s = nextSlot++, when = startAC + s * sl, b = Math.floor(s / 8), pos = s % 8;
      if (when < a.currentTime - 0.05) continue;
      if (b === 0) { if (pos % 2 === 0) Kit.tone(pos === 0 ? 1320 : 990, 0.06, 'square', 0.1, 0, when); continue; }
      const e = energyOf(song, b), ch = chordOf(song, b);
      if (pos === 0) {
        const tones = chordSemis(ch[1]);
        [0, 1, 2].forEach(i => Kit.tone(hz(ch[0] + tones[i]), spb * 4 * 0.97, 'triangle', 0.045, 0, when));
      }
      if (song.drums && b >= 2 || (b === 1 && pos % 2 === 0)) {
        if (song.kick.indexOf(pos) >= 0) { Kit.tone(150, 0.2, 'sine', 0.55, -100, when); }
        if (song.snare.indexOf(pos) >= 0 && b >= 2) { Kit.noise(0.14, 0.2, when, 1800); Kit.tone(190, 0.08, 'triangle', 0.1, 0, when); }
      }
      if (e > 0 || b === 1) Kit.noise(0.035, pos % 2 ? 0.035 : 0.07, when, 6500);
      song.bass.forEach(bs => { if (bs[0] === pos && b >= 1) Kit.tone(hz(ch[0] - 12 + bs[1]), bs[2] * spb * 0.9, 'triangle', 0.26, 0, when); });
      if (e === 2 && pos % 2 === 1) { const tones = chordSemis(ch[1]); Kit.tone(hz(ch[0] + 24 + tones[(s >> 1) % 4]), 0.12, 'sine', 0.035, 0, when); }
    }
  }
  function leadTone(freq, q) {
    Kit.tone(freq, 0.32, 'triangle', 0.3 * q);
    Kit.tone(freq * 2.005, 0.18, 'sine', 0.1 * q);
  }

  /* ---------------- judging ---------------- */
  function press(lane) {
    if (mode !== 'play') return;
    flashLane[lane] = 1;
    const T = songTime();
    let best = null, bd = 9;
    for (const n of notes) {
      if (n.lane !== lane || n.res) continue;
      const d = Math.abs(T - noteTime(n));
      if (d < bd) { bd = d; best = n; }
      if (noteTime(n) - T > 0.3) break;
    }
    if (!best || bd > 0.16) { Kit.noise(0.02, 0.04, null, 3000); return; }
    const d = T - noteTime(best);
    let g, pts, w, txt;
    if (bd <= 0.05) { g = 'p'; pts = 300; w = 1; txt = 'Perfect'; }
    else if (bd <= 0.1) { g = 'g'; pts = 200; w = 0.66; txt = d < 0 ? 'Great (early)' : 'Great (late)'; txt = 'Great'; }
    else { g = 'o'; pts = 100; w = 0.33; txt = d < 0 ? 'Early' : 'Late'; }
    best.res = g; counts[g]++; judged++; accSum += w;
    combo++; maxCombo = Math.max(maxCombo, combo);
    const mult = Math.min(4, 1 + Math.floor(combo / 10));
    score += pts * mult;
    crowd = clamp(crowd + (g === 'p' ? 2.4 : g === 'g' ? 1.4 : 0.5), 0, 100);
    leadTone(best.freq, g === 'p' ? 1 : 0.8);
    burst(lane, g); float(lane, txt, g);
    Kit.vibe(8);
    if (combo === 25 || combo === 50 || combo === 100 || combo === 150) { Kit.toast(combo + ' combo!'); }
  }
  function miss(n) {
    n.res = 'm'; counts.m++; judged++; combo = 0; crowd = clamp(crowd - 9, 0, 100);
    float(n.lane, 'Miss', 'm'); Kit.tone(110, 0.14, 'sawtooth', 0.07, -30);
  }
  function burst(lane, g) {
    const x = lx0 + (lane + 0.5) * laneW;
    for (let i = 0; i < (g === 'p' ? 14 : 8); i++) parts.push({ x, y: hitY, vx: rnd(-170, 170), vy: rnd(-230, 40), life: rnd(0.35, 0.65), age: 0, c: i % 2 ? COL[lane] : '#fff', r: rnd(2, 5) });
  }
  function float(lane, txt, g) {
    floats.push({ x: lx0 + (lane + 0.5) * laneW, y: hitY - 34 * u, txt, g, age: 0 });
  }

  /* ---------------- input ---------------- */
  S.canvas.addEventListener('pointerdown', e => {
    Kit.ac();
    if (mode !== 'play') return;
    const l = Math.floor((e.clientX - lx0) / laneW);
    if (l >= 0 && l < 4) press(l);
  });
  const KEYS = { d: 0, f: 1, j: 2, k: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k in KEYS) press(KEYS[k]);
    else if (k === 'escape' || k === 'p') (mode === 'play' ? pause() : mode === 'pause' ? resume() : 0);
  });

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode === 'play') {
      const T = songTime();
      schedule();
      if (bot) for (const n of notes) { if (!n.res && !n.bot && T >= noteTime(n) + n.j) { n.bot = true; if (Math.random() < 0.97) press(n.lane); } }
      for (const n of notes) {
        if (n.res) continue;
        if (T - noteTime(n) > 0.16) miss(n);
        else if (noteTime(n) - T > 0.4) break;
      }
      pulse = (T / spb) % 1;
      if (crowd <= 0) return finish(true);
      if (T > endTime) return finish(false);
    }
    for (let i = 0; i < 4; i++) flashLane[i] = Math.max(0, flashLane[i] - dt * 5);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].age += dt; if (floats[i].age > 0.7) floats.splice(i, 1); }
  }

  function rankOf(acc) { return acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D'; }
  const RV = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  function finish(failed) {
    mode = 'over';
    const total = notes.length, acc = total ? accSum / total : 0, rk = failed ? 'F' : rankOf(acc);
    let hi = false;
    if (!failed) {
      const b = Kit.get('best.' + song.id, null);
      if (!b || score > b.score) { hi = true; Kit.set('best.' + song.id, { score, rank: rk }); }
      else if (RV[rk] > RV[b.rank]) Kit.set('best.' + song.id, { score: b.score, rank: rk });
    }
    Kit.tone(failed ? 200 : 520, 0.6, 'triangle', 0.2, failed ? -120 : 300);
    setTimeout(() => {
      if (mode !== 'over') return;
      $('hud').classList.remove('show');
      $('resTitle').textContent = failed ? 'The crowd left' : 'Rank ' + rk;
      const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
      $('resStats').innerHTML = row('Score', score.toLocaleString(), hi) + row('Accuracy', Math.round(acc * 100) + '%') + row('Max combo', maxCombo) +
        row('Perfect / Great / Late', counts.p + ' / ' + counts.g + ' / ' + counts.o) + row('Missed', counts.m);
      Chars.portrait($('resPortrait'), 'orca', failed ? 'dizzy' : (RV[rk] >= 4 ? 'win' : 'neutral'));
      Kit.show('over');
    }, 500);
  }

  /* ---------------- rendering ---------------- */
  const bubbles = []; for (let i = 0; i < 26; i++) bubbles.push({ x: Math.random(), y: Math.random(), r: rnd(2, 6), v: rnd(0.02, 0.07) });
  function background(tt, beat) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a3a6d'); g.addColorStop(0.55, '#0b2a54'); g.addColorStop(1, '#051329');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x0 = W * (0.1 + i * 0.22) + Math.sin(tt * 0.3 + i) * 30, wd = 40 + 22 * Math.sin(i * 2 + tt * 0.5);
      const rg = ctx.createLinearGradient(0, 0, 0, H * 0.8);
      rg.addColorStop(0, 'rgba(120,220,255,' + (0.1 + beat * 0.04) + ')'); rg.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + wd, 0); ctx.lineTo(x0 + wd * 2 - 90, H * 0.8); ctx.lineTo(x0 - 90, H * 0.8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(180,235,255,.35)';
    bubbles.forEach(b => { b.y -= b.v * 0.016; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * W + Math.sin(tt + b.x * 9) * 6, b.y * H, b.r, 0, 6.3); ctx.fill(); });
    /* seabed */
    ctx.fillStyle = '#04101f'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H - 26 * u - Math.abs(Math.sin(x * 0.05)) * 22 * u);
    ctx.lineTo(W, H); ctx.fill();
  }
  function lanes(T, beat) {
    for (let i = 0; i < 4; i++) {
      const x = lx0 + i * laneW;
      const g = ctx.createLinearGradient(0, topY, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,' + (0.1 + beat * 0.03) + ')');
      ctx.fillStyle = g; ctx.fillRect(x + 2, topY, laneW - 4, H - topY);
      /* tap zone */
      ctx.fillStyle = COL[i]; ctx.globalAlpha = 0.1 + flashLane[i] * 0.35; ctx.fillRect(x + 2, hitY, laneW - 4, H - hitY); ctx.globalAlpha = 1;
      if (flashLane[i] > 0) { const lg = ctx.createLinearGradient(0, hitY - 200 * u, 0, hitY); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, COL[i]); ctx.globalAlpha = flashLane[i] * 0.4; ctx.fillStyle = lg; ctx.fillRect(x + 4, hitY - 200 * u, laneW - 8, 200 * u); ctx.globalAlpha = 1; }
      /* target */
      const cxn = x + laneW / 2, r = laneW * 0.4 * (1 + flashLane[i] * 0.12 + (beat < 0.12 ? 0.05 : 0));
      ctx.lineWidth = 4 * u; ctx.strokeStyle = COL2[i]; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cxn, hitY, r, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + flashLane[i] * 0.3) + ')'; ctx.beginPath(); ctx.arc(cxn, hitY, r, 0, 6.3); ctx.fill();
      /* lane dividers */
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, topY, 1.5, H - topY);
    }
    ctx.fillRect(lx0 + laneW * 4 - 1.5, topY, 1.5, H - topY);
  }
  function drawNote(n, T) {
    const dt = noteTime(n) - T;
    const y = hitY - (dt / song.travel) * (hitY - topY);
    if (y < topY - 40 || y > H + 40) return;
    const x = lx0 + (n.lane + 0.5) * laneW, r = laneW * 0.36;
    const a = clamp((y - topY + 40) / 90, 0, 1);
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, '#fff'); g.addColorStop(0.28, COL2[n.lane]); g.addColorStop(1, COL[n.lane]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.42, r * 0.3, r * 0.15, -0.5, 0, 6.3); ctx.fill();
    /* tiny note glyph */
    ctx.fillStyle = 'rgba(11,26,51,.65)'; ctx.beginPath(); ctx.ellipse(x - 3 * u, y + 5 * u, 5 * u, 3.6 * u, -0.4, 0, 6.3); ctx.fill(); ctx.fillRect(x + 0.5 * u, y - 9 * u, 2 * u, 14 * u);
    ctx.globalAlpha = 1;
  }
  function render(dt) {
    const tt = t, T = mode === 'play' || mode === 'pause' ? songTime() : tt;
    const beat = mode === 'play' ? 1 - pulse : 0.5 + 0.5 * Math.sin(tt * 3);
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    background(tt, beat);
    if (mode === 'play' || mode === 'pause' || mode === 'over') {
      lanes(T, beat);
      for (const n of notes) { if (n.res && n.res !== 'm') continue; if (n.res === 'm') { if (T - noteTime(n) > 0.5) continue; ctx.globalAlpha = 0.35; } drawNote(n, T); ctx.globalAlpha = 1; }
      parts.forEach(p => { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }); ctx.globalAlpha = 1;
      floats.forEach(f => {
        const k = f.age / 0.7; ctx.globalAlpha = 1 - k * k; ctx.font = '700 ' + Math.round(20 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = f.g === 'p' ? '#ffe58a' : f.g === 'g' ? '#aef0ff' : f.g === 'm' ? '#ff7a8a' : '#d6eef9';
        ctx.strokeStyle = 'rgba(0,20,40,.7)'; ctx.lineWidth = 4; ctx.strokeText(f.txt, f.x, f.y - k * 34 * u); ctx.fillText(f.txt, f.x, f.y - k * 34 * u); ctx.globalAlpha = 1;
      });
      /* orca conductor */
      const happy = combo >= 10;
      const bob = Math.abs(Math.sin(beat * Math.PI)) * 6 * u * (mode === 'play' ? 1 : 0);
      Chars.draw(ctx, 'orca', W / 2, H - 14 * u - bob, 0.92 * u, { t: tt, mood: crowd < 25 ? 'scared' : (happy ? 'win' : 'neutral'), arm: Math.sin(tt * (song ? song.bpm / 60 * Math.PI : 3)) * 0.7, tilt: Math.sin(tt * (song ? song.bpm / 60 * Math.PI : 3)) * 0.05, idle: false, shadow: false });
    }
    if (mode === 'play' || mode === 'pause') {
      $('hudL').textContent = score.toLocaleString();
      $('hudC').textContent = combo >= 2 ? combo + ' combo' : '';
      const m = Math.min(4, 1 + Math.floor(combo / 10)); $('hudR').textContent = m > 1 ? 'x' + m : '';
      $('crowdFill').style.width = crowd + '%';
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
    for (let i = 0; i < 4; i++) {
      const x = w * (0.16 + i * 0.22), y = h * 0.45 + Math.sin(t * 2.2 + i * 1.3) * 14 * sc;
      const g = c.createRadialGradient(x - 5, y - 6, 2, x, y, 20 * sc); g.addColorStop(0, '#fff'); g.addColorStop(0.3, COL2[i]); g.addColorStop(1, COL[i]);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 17 * sc, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.stroke();
    }
    Chars.draw(c, 'orca', w / 2, h - 6, 0.9 * sc, { t, moving: 0.5, idle: false, arm: Math.sin(t * 5) * 0.7, tilt: Math.sin(t * 2.5) * 0.06 });
  }

  /* ---------------- flow ---------------- */
  function pause() {
    if (mode !== 'play') return;
    pauseAt = songTime(); mode = 'pause';
    const a = Kit.ac(); if (a && a.state === 'running') a.suspend(); else pauseStart = performance.now() / 1000;
    $('syncV').textContent = offsetMs + ' ms'; Kit.show('pause');
  }
  let pauseStart = 0;
  function resume() {
    if (mode !== 'pause') return;
    const a = Kit.ac(); if (a && a.state === 'suspended') a.resume(); if (pauseStart) { pausedTotal += performance.now() / 1000 - pauseStart; pauseStart = 0; }
    mode = 'play'; Kit.hideScreens();
  }
  function toMenu() { const a = Kit.ac(); if (a && a.state === 'suspended') a.resume(); mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  function sync(d) { offsetMs = clamp(offsetMs + d, -200, 200); Kit.set('offset', offsetMs); $('syncV').textContent = offsetMs + ' ms'; }

  function openSongs() {
    const box = $('songlist'); box.innerHTML = '';
    SONGS.forEach(s => {
      const b = Kit.get('best.' + s.id, null);
      const el = document.createElement('button'); el.type = 'button'; el.className = 'song';
      el.innerHTML = '<div class="info"><div class="nm">' + s.name + '</div><div class="meta">' + s.bpm + ' BPM &middot; ' + '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) + (b ? ' &middot; Best ' + b.score.toLocaleString() : '') + '</div></div><div class="rk' + (b ? '' : ' none') + '">' + (b ? b.rank : '-') + '</div>';
      el.addEventListener('click', () => { Kit.ac(); startSong(s); });
      box.appendChild(el);
    });
    Kit.show('songs');
  }

  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', () => { Kit.ac(); openSongs(); });
  $('btnSongsBack').addEventListener('click', () => Kit.show('title'));
  $('btnAgain').addEventListener('click', () => startSong(song));
  $('btnRestart').addEventListener('click', () => { const a = Kit.ac(); if (a && a.state === 'suspended') a.resume(); pauseStart = 0; startSong(song); });
  $('btnMenu').addEventListener('click', openSongs);
  $('syncM').addEventListener('click', () => sync(-10));
  $('syncP').addEventListener('click', () => sync(10));
  /* the generic pause handler must reach songs from resume after visibility-pause too */
  Kit.loop((dt, tt) => {
    t = tt; S.watch(dt);
    if (mode !== 'pause') update(dt);
    if (mode !== 'title') render(dt); else { background(tt, 0.5 + 0.5 * Math.sin(tt * 3)); }
    drawTitleArt();
  });

  window.__orca = { SONGS, start: i => startSong(SONGS[i]), setBot(v) { bot = v; notes && notes.forEach(n => n.j = rnd(-0.035, 0.035)); }, get state() { return { mode, score, combo, maxCombo, crowd, counts, notes: notes && notes.length }; },
    buildChart };
})();
