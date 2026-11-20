/* Beat Cops Beat Box - three pads, one precinct groove. */
(function () {
  'use strict';
  Kit.ns('beat-cops-beat-box');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  let W, H, u, hitY, laneW, lx0;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); hitY = H - 150 * u - 20; laneW = Math.min(W - 24, 360) / 3; lx0 = W / 2 - laneW * 1.5; }
  S.onresize = layout; layout();
  const LANES = [{ n: 'BOOM', c: ['#ff7a6a', '#d9332b'], key: 'a' }, { n: 'CLAP', c: ['#7ab4ff', '#2a62d8'], key: 's' }, { n: 'TSS', c: ['#ffe27a', '#e8b81c'], key: 'd' }];
  const THEMES = [{ name: 'Precinct Roof', sky: ['#1a2a5a', '#3a2a7a'] }, { name: 'Harbor Dock', sky: ['#0a3a5a', '#1a6a8a'] }, { name: 'Downtown Block Party', sky: ['#4a1a5a', '#8a2a5a'] }, { name: 'Midnight Alley', sky: ['#0a0a20', '#2a1a4a'] }, { name: 'Stadium Finale', sky: ['#5a2a1a', '#a84a2a'] }];

  let mode = 'title', stage = 1, score = 0, combo = 0, bestCombo = 0, meter = 60, t = 0, clock = 0, notes = [], bpm = 100, step = 0.3, travel = 1.4, endT = 0, flashes = [0, 0, 0], parts = [], hits = 0, total = 0, state = 'play', stateT = 0, beatPulse = 0, lastBeat = -1, mouth = 0, siren = 0, stageHits = 0, stageTotal = 0, perfects = 0;
  const best = () => Kit.get('best', 0);
  const th = () => THEMES[(stage - 1) % THEMES.length];

  /* sound */
  function snd(l) {
    const a = Kit.ac(); if (!a) return;
    if (l === 0) Kit.tone(160, 0.22, 'sine', 0.55, -120); else if (l === 1) { Kit.noise(0.14, 0.4, null, 1200); Kit.tone(220, 0.08, 'triangle', 0.18, -60); } else { Kit.noise(0.05, 0.22, null, 6000); }
  }
  function genNotes() {
    bpm = 96 + stage * 8; step = 60 / bpm / 2; travel = Math.max(0.85, 1.5 - stage * 0.05); notes = [];
    const bars = 10 + Math.min(4, stage), lead = 2.0; let id = 0;
    for (let b = 0; b < bars; b++) {
      const add = (s, lane) => { const tt = lead + (b * 8 + s) * step; if (!notes.some(n => n.lane === lane && Math.abs(n.t - tt) < step * 0.9)) notes.push({ t: tt, lane, state: 'fall', id: id++ }); };
      if (b < 1 && stage === 1) { add(0, 0); add(4, 0); continue; }
      add(0, 0); add(4, 0); add(2, 1); add(6, 1);
      if (stage >= 2) for (let s = 0; s < 8; s += 1) if (Math.random() < 0.18 + stage * 0.07 && s % 2 === 1 || (stage >= 3 && s % 2 === 0 && Math.random() < 0.2)) add(s, 2);
      if (stage >= 2 && Math.random() < 0.15 + stage * 0.06) add(3, 0); if (stage >= 3 && Math.random() < 0.2 + stage * 0.04) add(7, 0);
      if (stage >= 3 && Math.random() < 0.25) add(5, 1); if (b % 4 === 3 && stage >= 2) { add(6, 1); add(7, 1); }
      if (stage >= 4 && Math.random() < 0.3) { add(1, 2); add(1, 0); }
    }
    notes.sort((a, b) => a.t - b.t); endT = notes[notes.length - 1].t + 1.5; stageHits = 0; stageTotal = notes.length;
  }
  function hit(l) {
    if (mode !== 'play' || state !== 'play') return; flashes[l] = 1;
    let bestN = null, bd = 0.17; notes.forEach(n => { if (n.lane === l && n.state === 'fall') { const d = Math.abs(n.t - clock); if (d < bd) { bd = d; bestN = n; } } });
    if (!bestN) { snd(l); return; }
    bestN.state = 'hit'; bestN.age = 0; const perfect = bd < 0.06; combo++; bestCombo = Math.max(bestCombo, combo); hits++; stageHits++; if (perfect) perfects++; const mult = 1 + Math.min(3, Math.floor(combo / 10)); const pts = (perfect ? 100 : 60) * mult; score += pts; meter = Math.min(100, meter + (perfect ? 4 : 2.5)); mouth = 0.18; snd(l);
    parts.push({ txt: perfect ? 'PERFECT' : 'GOOD', x: lx0 + laneW * (l + 0.5), y: hitY - 30 * u, age: 0, life: 0.6, c: perfect ? '#ffe066' : '#bfe0ff' }); for (let k = 0; k < 8; k++) parts.push({ x: lx0 + laneW * (l + 0.5), y: hitY, vx: rnd(-90, 90), vy: rnd(-160, -20), age: 0, life: rnd(0.3, 0.6), r: rnd(2, 3.5), cc: LANES[l].c[0] });
    syncHud();
  }
  function miss(n) { n.state = 'miss'; n.age = 0; combo = 0; total++; meter -= 9; Kit.tone(130, 0.12, 'sawtooth', 0.08, -30); syncHud(); }
  function syncHud() { const mult = 1 + Math.min(3, Math.floor(combo / 10)); $('hudL').textContent = 'S' + stage + ' · ' + th().name; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = combo > 1 ? '×' + mult + ' · ' + combo : ''; $('crowdFill').style.width = clamp(meter, 0, 100) + '%'; }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 400 * dt; } else q.y -= 30 * dt; }); parts = parts.filter(q => q.age < q.life);
    for (let i = 0; i < 3; i++) flashes[i] = Math.max(0, flashes[i] - dt * 6); mouth = Math.max(0, mouth - dt); beatPulse = Math.max(0, beatPulse - dt * 4); siren += dt;
    if (mode !== 'play') return; stateT += dt;
    if (state === 'play') {
      clock += dt; const bi = Math.floor((clock - 2.0) / (step * 2)); if (clock > 1.2 && bi !== lastBeat) { lastBeat = bi; beatPulse = 1; }
      notes.forEach(n => { if (n.state === 'fall' && clock - n.t > 0.15) miss(n); else if (n.state !== 'fall') n.age += dt; });
      if (meter <= 0) { meter = 0; state = 'fail'; stateT = 0; Kit.tone(160, 0.7, 'sawtooth', 0.2, -100); }
      else if (clock > endT) { state = 'done'; stateT = 0; const acc = Math.round(100 * stageHits / stageTotal); const b = 300 + acc * 5; score += b; parts.push({ txt: 'Stage clear! ' + acc + '%  +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.8, c: '#7dea8a', big: 1 }); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.12, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); syncHud(); }
      $('crowdFill').style.width = clamp(meter, 0, 100) + '%';
    } else if (state === 'done') { if (stateT > 2.0) { stage++; beginStage(); } }
    else if (state === 'fail') { if (stateT > 1.4) gameOver(); }
  }
  function beginStage() { genNotes(); clock = 0; lastBeat = -1; state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, th().name); syncHud(); }

  function render() {
    const T = th(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const red = Math.sin(siren * 5) > 0; ctx.fillStyle = red ? 'rgba(255,50,50,' + (0.1 + beatPulse * 0.12) + ')' : 'rgba(60,110,255,' + (0.1 + beatPulse * 0.12) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = red ? 'rgba(255,60,60,.28)' : 'rgba(70,120,255,.28)'; ctx.beginPath(); ctx.moveTo(red ? 0 : W, 0); ctx.lineTo(red ? W * 0.6 : W * 0.4, H * 0.5); ctx.lineTo(red ? 0 : W, H * 0.5); ctx.closePath(); ctx.fill();
    /* skyline */
    ctx.fillStyle = 'rgba(10,14,36,.7)'; for (let i = 0; i < 9; i++) { const bw = W / 8, hh = (60 + (i * 53 % 90)) * u; ctx.fillRect(i * bw - 10, hitY - 150 * u - hh * 0.2, bw - 6, hh + 200); }
    /* mascot */
    const sc = (0.95 + beatPulse * 0.08 + (mouth > 0 ? 0.04 : 0)) * u; Heroes.draw(ctx, 'beatcop', W / 2, 232 * u, sc, { t, bob: t * 0, look: Math.sin(t * 2) });
    /* lanes */
    for (let i = 0; i < 3; i++) { const x = lx0 + laneW * i; const lg = ctx.createLinearGradient(0, 130, 0, hitY); lg.addColorStop(0, 'rgba(10,14,36,.15)'); lg.addColorStop(1, 'rgba(10,14,36,.62)'); ctx.fillStyle = lg; ctx.fillRect(x + 3, 130, laneW - 6, H - 130); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2; ctx.strokeRect(x + 3, 130, laneW - 6, H - 130); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx0, hitY); ctx.lineTo(lx0 + laneW * 3, hitY); ctx.stroke();
    /* notes */
    notes.forEach(n => {
      const cx = lx0 + laneW * (n.lane + 0.5), k = (clock - (n.t - travel)) / travel; if (k < 0 || k > 1.25 && n.state === 'fall') return; const y = 130 + (hitY - 130) * k;
      if (n.state === 'hit') { ctx.globalAlpha = Math.max(0, 1 - n.age * 4); const r = 28 * u * (1 + n.age * 3); ctx.strokeStyle = LANES[n.lane].c[0]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, hitY, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; return; }
      if (n.state === 'miss') ctx.globalAlpha = Math.max(0, 0.5 - n.age);
      const r = (16 + 14 * k) * u, c2 = LANES[n.lane].c, rg = ctx.createRadialGradient(cx - r * 0.3, y - r * 0.3, 2, cx, y, r); rg.addColorStop(0, c2[0]); rg.addColorStop(1, c2[1]); ctx.fillStyle = rg; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(r * 0.55) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.lane === 0 ? '★' : n.lane === 1 ? '✋' : '•', cx, y + 1); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    });
    /* pads */
    for (let i = 0; i < 3; i++) { const x = lx0 + laneW * i + 6, w = laneW - 12, y = hitY + 14, h = 112 * u; const c2 = LANES[i].c, f = flashes[i]; const pg = ctx.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, f > 0.3 ? '#fff' : c2[0]); pg.addColorStop(1, c2[1]); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(x, y + 6, w, h, 18); ctx.fill(); ctx.fillStyle = pg; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y + (f > 0.2 ? 4 : 0), w, h, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = f > 0.3 ? c2[1] : '#fff'; ctx.font = '700 ' + Math.round(26 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(LANES[i].n, x + w / 2, y + h / 2 + 8 + (f > 0.2 ? 4 : 0)); ctx.font = '700 11px Nunito, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(LANES[i].key.toUpperCase(), x + w / 2, y + h - 10); }
    parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round((q.big ? 28 : 16) * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = q.c; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = q.cc; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Crowd left the block!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Best combo', bestCombo) + row('Perfect hits', perfects) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'beatcop', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; combo = 0; bestCombo = 0; meter = 60; hits = 0; total = 0; perfects = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); beginStage(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => { Kit.ac(); if (mode !== 'play') return; const l = Math.floor((e.clientX - lx0) / laneW); if (l >= 0 && l < 3 && e.clientY > 120) hit(l); });
  window.addEventListener('keydown', e => { if (e.repeat) return; const k = e.key.toLowerCase(); const l = k === 'a' || k === 'arrowleft' ? 0 : k === 's' || k === 'arrowdown' ? 1 : k === 'd' || k === 'arrowright' ? 2 : -1; if (l >= 0) hit(l); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__beat = { get state() { return { mode, stage, score, combo, meter, clock, state, n: notes.length, left: notes.filter(n => n.state === 'fall').length }; }, hit, setStage(n) { stage = n; beginStage(); }, next() { const n = notes.find(x => x.state === 'fall'); return n && { lane: n.lane, t: n.t, dt: n.t - clock }; }, skip(sec) { clock += sec; } };
})();
