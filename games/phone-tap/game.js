/* Phone Tap - tap the lines that use the code words. */
(function () {
  'use strict';
  Kit.ns('phone-tap');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); }
  S.onresize = layout; layout();

  const PAIRS = [['EAGLE', 'BEAGLE'], ['FALCON', 'FALAFEL'], ['PIANO', 'PIRANHA'], ['TULIP', 'TULLE'], ['BRIDGE', 'BRIDGET'], ['SNOW', 'SNOB'], ['COBRA', 'COBALT'], ['ORCHID', 'ORCHARD'], ['VELVET', 'VELCRO'], ['DAGGER', 'DANGER'], ['PHARAOH', 'PHARMACY'], ['MARBLE', 'MARGARINE'], ['LANTERN', 'LANTANA'], ['WALRUS', 'WALNUT'], ['COMET', 'COMEDY'], ['RAVEN', 'RAVIOLI']];
  const TPL = ['The {W} is ready', 'Did you see the {W}?', 'Bring the {W} at noon', 'I lost the {W}', '{W} is on the move', 'Tell them about the {W}', 'Leave the {W} here', 'Is the {W} safe?'];
  const CHAT = ['What is for dinner?', 'Wrong number, sorry', 'Your pizza is ready', 'Call mom back soon', 'Are we still on for golf?', 'Sale ends Friday', 'Can you hear me now?', 'Happy birthday!', 'Traffic is awful', 'Did you feed the cat?', 'The game starts at eight'];
  const THEMES = [['#3a2a1a', '#241810'], ['#1a3a3a', '#102424'], ['#3a1a3a', '#241024'], ['#2a3a1a', '#182410'], ['#3a2a2a', '#241818']];

  let mode = 'title', stage = 1, score = 0, strikes = 0, t = 0, cells = [], codes = [], decoys = [], need = 10, got = 0, spawnT = 0, parts = [], flash = 0, streak = 0, caught = 0, cols = 2, rows = 3, gridTop = 0, cw = 0, ch = 0, goT = 0, recorded = 0;
  const best = () => Kit.get('best', 0);

  function setupStage() {
    const prs = shuffle(PAIRS.slice()).slice(0, 3); codes = prs.map(p => p[0]); decoys = prs.map(p => p[1]);
    const n = stage <= 1 ? 6 : stage <= 2 ? 9 : stage <= 3 ? 12 : stage <= 5 ? 12 : 16; cols = n <= 6 ? 2 : n <= 12 ? 3 : 4; rows = Math.ceil(n / cols);
    cells = []; for (let i = 0; i < n; i++) cells.push({ call: null, i });
    got = 0; need = 8 + stage * 2; spawnT = 0.5; layoutGrid(); syncHud();
    Kit.banner('Stage ' + stage, 'Listen for new code words');
  }
  function layoutGrid() { gridTop = 176 * u + 8; const gap = 8, avW = W - 28, avH = H - gridTop - 14; cw = (avW - gap * (cols - 1)) / cols; ch = Math.min(100 * u + 20, (avH - gap * (rows - 1)) / rows); }
  S.onresize = () => { layout(); layoutGrid(); };
  function cellRect(i) { const c = i % cols, r = Math.floor(i / cols); return { x: 14 + c * (cw + 8), y: gridTop + r * (ch + 8), w: cw, h: ch }; }
  function mkCall() {
    const r = Math.random(); let type, txt, w;
    if (r < 0.46) { type = 'sus'; w = pick(codes); txt = pick(TPL).replace('{W}', w); }
    else if (r < 0.72) { type = 'dec'; w = pick(decoys); txt = pick(TPL).replace('{W}', w); }
    else { type = 'chat'; txt = pick(CHAT); }
    return { type, txt, w, age: 0, life: Math.max(2.1, 4.2 - stage * 0.28), state: 'ring', fb: 0 };
  }
  function tap(x, y) {
    if (mode !== 'play') return;
    for (let i = 0; i < cells.length; i++) { const r = cellRect(i); if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { const c = cells[i].call; if (c && c.state === 'ring') return answer(i); return; } }
  }
  function answer(i) {
    const cell = cells[i], c = cell.call, r = cellRect(i), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (c.type === 'sus') {
      c.state = 'rec'; c.fb = 0; got++; recorded++; const pts = 100 + streak * 25; score += pts; streak++; flash = 0.25; parts.push({ txt: '+' + pts, x: cx, y: cy, age: 0, life: 0.9 }); for (let k = 0; k < 10; k++) parts.push({ x: cx, y: cy, vx: rnd(-110, 110), vy: rnd(-150, -20), age: 0, life: rnd(0.4, 0.8), c: '255,207,74', r: rnd(2, 3.5) });
      Kit.tone(660, 0.08, 'triangle', 0.2); Kit.tone(990, 0.14, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.07 : 0); Kit.vibe(12); syncHud();
      if (got >= need) { stage++; goT = 0.9; mode = 'stage'; }
    } else {
      c.state = 'bad'; c.fb = 0; strikes++; streak = 0; flash = 0.45; parts.push({ txt: c.type === 'dec' ? 'Lookalike!' : 'Just chatter', x: cx, y: cy, age: 0, life: 1 }); Kit.tone(170, 0.35, 'sawtooth', 0.18, -80); Kit.vibe(50); syncHud(); if (strikes >= 3) { mode = 'dying'; goT = 0.9; }
    }
  }
  function syncHud() { $('hudL').textContent = 'S' + stage; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function update(dt) {
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; } else p.y -= 28 * dt; }); parts = parts.filter(p => p.age < p.life); flash = Math.max(0, flash - dt * 2);
    if (mode === 'stage') { goT -= dt; cells.forEach(c => { if (c.call) { c.call.fb += dt; if (c.call.fb > 0.5) c.call = null; } }); if (goT <= 0) { mode = 'play'; setupStage(); } return; }
    if (mode === 'dying') { goT -= dt; if (goT <= 0) gameOver(); return; }
    if (mode !== 'play') return;
    spawnT -= dt;
    if (spawnT <= 0) { const free = cells.filter(c => !c.call); const busy = cells.length - free.length, cap = Math.ceil(cells.length * 0.55); if (free.length && busy < cap) { const c = pick(free); c.call = mkCall(); Kit.tone(880 + rint(0, 3) * 110, 0.05, 'square', 0.05); } spawnT = Math.max(0.5, 1.5 - stage * 0.13) * rnd(0.7, 1.15); }
    cells.forEach(c => { const k = c.call; if (!k) return; if (k.state === 'ring') { k.age += dt; if (k.age >= k.life) { if (k.type === 'sus') { strikes++; streak = 0; flash = 0.45; const r = cellRect(c.i); parts.push({ txt: 'Leaked!', x: r.x + r.w / 2, y: r.y + r.h / 2, age: 0, life: 1 }); Kit.tone(170, 0.35, 'sawtooth', 0.18, -80); syncHud(); if (strikes >= 3) { mode = 'dying'; goT = 0.9; } } c.call = null; } } else { k.fb += dt; if (k.fb > 0.55) c.call = null; } });
  }
  function drawCell(c) {
    const r = cellRect(c.i), k = c.call; ctx.save();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#2a3040'); g.addColorStop(1, '#1a1e2a'); ctx.fillStyle = g; ctx.strokeStyle = '#0a0c14'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10); ctx.stroke();
    /* jack */
    const jx = r.x + 20, jy = r.y + r.h - 20; ctx.fillStyle = '#0a0c12'; ctx.beginPath(); ctx.arc(jx, jy, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a92a8'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#12141c'; ctx.beginPath(); ctx.arc(jx, jy, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a8298'; ctx.font = '700 ' + Math.round(11 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('LINE ' + String(c.i + 1).padStart(2, '0'), r.x + 36, r.y + r.h - 16);
    if (k) {
      const ring = k.state === 'ring', pulse = 0.5 + 0.5 * Math.sin(t * 14), col = k.state === 'rec' ? '90,230,140' : k.state === 'bad' ? '255,80,70' : '255,200,60';
      ctx.fillStyle = 'rgba(' + col + ',' + (ring ? 0.12 + 0.12 * pulse : 0.22) + ')'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10); ctx.fill();
      ctx.fillStyle = 'rgb(' + col + ')'; ctx.shadowColor = 'rgb(' + col + ')'; ctx.shadowBlur = ring ? 8 + pulse * 8 : 10; ctx.beginPath(); ctx.arc(r.x + r.w - 18, r.y + 18, 7, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#f2f4fa'; const fs = Math.round(clamp(r.w / 11, 12, 17)); ctx.font = '700 ' + fs + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const words = k.txt.split(' '), lines = [], maxW = r.w - 28; let cur = ''; words.forEach(w => { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }); lines.push(cur);
      const ly = r.y + (r.h - 26) / 2 - (lines.length - 1) * (fs * 0.6) + 4; lines.forEach((ln, i) => { ctx.fillText((i === 0 ? '“' : '') + ln + (i === lines.length - 1 ? '”' : ''), r.x + r.w / 2, ly + i * fs * 1.2); });
      ctx.textBaseline = 'alphabetic';
      if (ring) { const f = 1 - k.age / k.life; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(r.x + 10, r.y + r.h - 8, r.w - 20, 4, 2); ctx.fill(); ctx.fillStyle = f < 0.3 ? '#ff5a4a' : '#ffcf4a'; ctx.beginPath(); ctx.roundRect(r.x + 10, r.y + r.h - 8, Math.max(4, (r.w - 20) * f), 4, 2); ctx.fill(); }
      else { ctx.font = '700 ' + Math.round(13 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.fillStyle = k.state === 'rec' ? '#7dea8a' : '#ff7a6a'; ctx.textAlign = 'center'; ctx.fillText(k.state === 'rec' ? '● RECORDED' : '✖ WRONG LINE', r.x + r.w / 2, r.y + r.h - 12); }
    }
    ctx.restore();
  }
  function render() {
    if (mode === 'title') { ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H); return; }
    const th = THEMES[(stage - 1) % THEMES.length], g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th[0]); g.addColorStop(1, th[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 2; for (let y = 0; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    /* briefing */
    const bw = Math.min(W - 24, 360), bx = W / 2 - bw / 2, by = 62; ctx.fillStyle = 'rgba(8,10,20,.9)'; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bw, 102 * u + 4, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a52'; ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('LISTEN FOR THESE CODE WORDS', bx + 14, by + 20);
    const slot = (bw - 28 - 64 * u) / 3, ml = Math.max.apply(null, codes.map(c => c.length)), cf = Math.min(Math.round(20 * u + 2), Math.floor(slot / (ml * 0.74))); ctx.font = '700 ' + cf + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe066'; codes.forEach((c, i) => { ctx.fillText(c, bx + 14 + slot * (i + 0.5), by + 52 * u + 6); });
    const pw = bw - 28 - 70 * u, px = bx + 14; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(px, by + 74 * u + 4, pw, 10, 5); ctx.fill(); ctx.fillStyle = '#7dea8a'; ctx.beginPath(); ctx.roundRect(px, by + 74 * u + 4, Math.max(10, pw * got / need), 10, 5); ctx.fill();
    ctx.fillStyle = '#e8ecf8'; ctx.font = '700 11px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('RECORDED ' + got + ' / ' + need + '  ·  Only exact words count!', px, by + 96 * u + 6);
    Heroes.draw(ctx, 'mouse', bx + bw - 38 * u, by + 100 * u, 0.68 * u, { t, bob: t * 3, look: Math.sin(t) });
    cells.forEach(drawCell);
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(22 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgb(' + p.c + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Operation blown!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Calls recorded', recorded) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw2 = c.clientWidth || 150, ch2 = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw2 * dpr; c.height = ch2 * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'mouse', cw2 / 2, ch2 - 8, Math.min(cw2 / 130, ch2 / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; strikes = 0; streak = 0; recorded = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); setupStage(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => { Kit.ac(); tap(e.clientX, e.clientY); });
  codes = ['EAGLE', 'PIANO', 'COBRA']; cells = [];
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__tap = { get state() { return { mode, stage, score, strikes, got, need, n: cells.length, codes, calls: cells.filter(c => c.call).map(c => ({ i: c.i, type: c.call.type, txt: c.call.txt, st: c.call.state })) }; }, tapCell(i) { const r = cellRect(i); tap(r.x + r.w / 2, r.y + r.h / 2); }, setStage(n) { stage = n; setupStage(); } };
})();
