/* C.I. Yay - Counter-Intelligence gate. Admit the real agents, turn away the impostors. */
(function () {
  'use strict';
  Kit.ns('ci-yay');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); }
  S.onresize = layout; layout();

  const COLORS = { RED: '#e8433a', BLUE: '#3a8ae8', GREEN: '#2fae4c', GOLD: '#e8b81c' };
  const CN = Object.keys(COLORS);
  const SKY = [['#5a8ad8', '#f6d08a'], ['#d86a4a', '#3a2a5a'], ['#1a2248', '#3a2a5a'], ['#0a1028', '#1a2248'], ['#2a4a78', '#8a5a7a']];

  let mode = 'title', stage = 1, score = 0, strikes = 0, t = 0, n = 0, perStage = 6, streak = 0, correct = 0;
  let R = null, cur = null, phase = 'idle', phaseT = 0, timeLeft = 0, timeMax = 8, parts = [], flash = 0, drag = null, today = 10, verdict = null;
  const best = () => Kit.get('best', 0);

  function newRules() {
    const k = stage; R = { colors: [pick(CN)], lvl: 0, photo: false, exp: false, nocase: false };
    if (k >= 4) { let c2; do { c2 = pick(CN); } while (c2 === R.colors[0]); R.colors.push(c2); }
    if (k >= 2) R.lvl = k >= 6 ? rint(2, 3) : 2;
    if (k >= 3) R.photo = true;
    if (k >= 5) { R.exp = true; today = rint(4, 10); }
    if (k >= 4) R.nocase = true;
    if (k >= 7 && Math.random() < 0.5) R.lvl = 3;
  }
  function activeRules() { const a = ['color']; if (R.lvl) a.push('lvl'); if (R.photo) a.push('photo'); if (R.exp) a.push('exp'); if (R.nocase) a.push('case'); return a; }
  function evalAgent(a) {
    const bad = [];
    if (!R.colors.includes(a.color)) bad.push('Wrong badge colour');
    if (R.lvl && a.lvl < R.lvl) bad.push('Clearance too low');
    if (R.photo && a.photoMismatch) bad.push('Photo does not match');
    if (R.exp && a.exp < today) bad.push('Badge expired');
    if (R.nocase && a.p.item === 'case') bad.push('Briefcase not allowed');
    return bad;
  }
  function makeAgent() {
    const p = Spy.make({ item: pick(['none', 'none', 'paper', 'flower', 'umbrella', 'case']) });
    const want = Math.random() < 0.5; const rules = activeRules();
    const a = { p, color: pick(R.colors), lvl: rint(Math.max(1, R.lvl), 3), photoMismatch: false, exp: R.exp ? rint(today, 12) : rint(1, 12), name: p.name + ' ' + pick(['Black', 'Stone', 'Vale', 'Frost', 'Gray', 'Moon', 'Cross', 'Wolfe', 'Hart']), id: rint(100, 999) };
    if (R.nocase && p.item === 'case') p.item = 'paper';
    if (!want) {
      const v = pick(rules);
      if (v === 'color') a.color = pick(CN.filter(c => !R.colors.includes(c)));
      else if (v === 'lvl') a.lvl = rint(1, R.lvl - 1);
      else if (v === 'photo') a.photoMismatch = true;
      else if (v === 'exp') a.exp = rint(1, today - 1);
      else if (v === 'case') p.item = 'case';
    }
    a.photo = Object.assign({}, p);
    if (a.photoMismatch) { const m = pick(['hat', 'glasses', 'stache']); if (m === 'hat') a.photo.hat = pick(Spy.HATS.filter(h => h !== p.hat)); else if (m === 'glasses') a.photo.glasses = pick(Spy.GLASS.filter(h => h !== p.glasses)); else a.photo.stache = !p.stache; }
    a.x = -120; a.bad = evalAgent(a); a.ok = a.bad.length === 0; return a;
  }
  function next() {
    if (n >= perStage) { stage++; n = 0; newRules(); Kit.banner('Stage ' + stage, 'New rules today'); syncHud(); }
    cur = makeAgent(); phase = 'in'; phaseT = 0; timeMax = Math.max(4.5, 9 - stage * 0.45); timeLeft = timeMax; verdict = null; n++; syncHud();
  }
  function decide(yes) {
    if (mode !== 'play' || phase !== 'wait') return;
    const ok = cur.ok === yes;
    phase = yes ? 'yay' : 'nay'; phaseT = 0; verdict = { ok, txt: ok ? (yes ? 'Welcome in, agent!' : 'Impostor stopped!') : (cur.ok ? 'That was a real agent!' : cur.bad[0] + '!') };
    if (ok) { const pts = Math.round(100 + 100 * (timeLeft / timeMax) + streak * 20); score += pts; streak++; correct++; flash = 0.3; Kit.tone(660, 0.1, 'triangle', 0.2); Kit.tone(990, 0.15, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.08 : 0); parts.push({ txt: '+' + pts, x: W / 2, y: H * 0.34, age: 0, life: 1 }); for (let i = 0; i < 16; i++) parts.push({ x: W / 2, y: H * 0.4, vx: rnd(-130, 130), vy: rnd(-180, -20), age: 0, life: rnd(0.4, 0.9), c: pick(['120,240,150', '255,230,90']), r: rnd(2, 4) }); }
    else { strikes++; streak = 0; flash = 0.5; Kit.tone(160, 0.4, 'sawtooth', 0.2, -80); Kit.vibe(60); }
    syncHud();
  }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + Math.min(n, perStage) + '/' + perStage; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function update(dt) {
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; } else p.y -= 30 * dt; }); parts = parts.filter(p => p.age < p.life); flash = Math.max(0, flash - dt * 2);
    if (mode !== 'play' || !cur) return;
    phaseT += dt;
    if (phase === 'in') { cur.x = -120 + (W / 2 + 120) * Math.min(1, phaseT / 0.55); cur.walk = phaseT * 14; if (phaseT >= 0.55) { phase = 'wait'; phaseT = 0; cur.walk = 0; } }
    else if (phase === 'wait') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; phase = 'tout'; phaseT = 0; strikes++; streak = 0; verdict = { ok: false, txt: "Too slow! You let it stall." }; flash = 0.5; Kit.tone(160, 0.4, 'sawtooth', 0.2, -80); syncHud(); } }
    else { const dur = phase === 'tout' ? 1.2 : 1.1; if (phase === 'yay') cur.x = W / 2 + Math.max(0, phaseT - 0.4) * 500; else if (phase === 'nay') cur.x = W / 2 - Math.max(0, phaseT - 0.4) * 500; cur.walk = phaseT > 0.4 ? phaseT * 14 : 0; if (phaseT > dur) { if (strikes >= 3) return gameOver(); next(); } }
    $('bYay').disabled = $('bNay').disabled = phase !== 'wait';
  }

  /* ---------------- render ---------------- */
  function drawBg() {
    const sk = SKY[(stage - 1) % SKY.length], g = ctx.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const night = (stage - 1) % SKY.length >= 2;
    if (night) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.arc((i * 97) % W, 80 + ((i * 53) % 240), 1.2, 0, TAU); ctx.fill(); } }
    const cy = H * 0.54;
    /* HQ building */
    const bw = Math.min(W - 40, 340), bx = W / 2 - bw / 2, by = cy - 240 * u;
    ctx.fillStyle = '#2a3250'; ctx.fillRect(bx, by + 40, bw, cy - by); ctx.fillStyle = '#3a4468'; ctx.beginPath(); ctx.moveTo(bx - 14, by + 44); ctx.lineTo(W / 2, by - 18); ctx.lineTo(bx + bw + 14, by + 44); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 3; ctx.stroke();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = night ? ((r * 7 + c * 3) % 5 === 0 ? '#ffe9a0' : '#1c2440') : '#a8d0f0'; ctx.fillRect(bx + 18 + c * (bw - 36) / 6, by + 66 + r * 40 * u, (bw - 36) / 6 - 10, 26 * u); }
    ctx.fillStyle = '#ffcf4a'; ctx.font = '700 ' + Math.round(22 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('C.I. HEADQUARTERS', W / 2, by + 36);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 14, by + 40); ctx.lineTo(bx + 14, by - 40); ctx.stroke(); const w = Math.sin(t * 4) * 3; ctx.fillStyle = '#e8433a'; ctx.beginPath(); ctx.moveTo(bx + 14, by - 40); ctx.quadraticCurveTo(bx + 36, by - 44 + w, bx + 54, by - 38); ctx.lineTo(bx + 54, by - 16); ctx.quadraticCurveTo(bx + 36, by - 22 - w, bx + 14, by - 20); ctx.fill();
    /* ground */
    ctx.fillStyle = '#3a3e4c'; ctx.fillRect(0, cy - 4, W, H - cy + 4);
  }
  function drawBooth() {
    const cy = H * 0.54, s = Math.min(2.1, (cy - 190) / 50) * u * 0.97, fy = cy + 104 * u * 0.97;
    if (cur && phase !== 'idle') {
      const a = cur; Spy.person(ctx, a.p, a.x, fy, s, { walk: a.walk || 0, flip: phase === 'nay' || (phase === 'tout' && false), look: phase === 'wait' ? Math.sin(t * 2) * 0.6 : 0, mood: phase === 'nay' ? 'angry' : (phase === 'yay' ? 'happy' : 'neutral'), shadow: false });
    }
    /* counter */
    const g = ctx.createLinearGradient(0, cy, 0, H); g.addColorStop(0, '#7a5a3a'); g.addColorStop(0.08, '#5a3e24'); g.addColorStop(1, '#2a1c10'); ctx.fillStyle = g; ctx.fillRect(0, cy, W, H - cy); ctx.fillStyle = '#9a7648'; ctx.fillRect(0, cy - 3, W, 10); ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2; ctx.strokeRect(-2, cy - 3, W + 4, 10);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, cy + 30 + i * 40 * u, W, 2);
  }
  function drawRules() {
    const act = activeRules(), lines = [];
    lines.push(['color', R.colors.map(c => ({ t: c, c: COLORS[c] }))]);
    if (R.lvl) lines.push(['lvl', '★'.repeat(R.lvl) + ' or higher']); if (R.photo) lines.push(['photo', 'Photo must match face']); if (R.exp) lines.push(['exp', 'Not expired · today ' + today + '/26']); if (R.nocase) lines.push(['case', 'No briefcases']);
    const w = Math.min(W - 24, 360), x = W / 2 - w / 2, y = 64, lh = 19 * u + 4, h = 30 + lines.length * lh;
    ctx.fillStyle = 'rgba(8,10,20,.9)'; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a52'; ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('TODAY\'S RULES · ADMIT ONLY IF', x + 12, y + 18);
    lines.forEach((l, i) => {
      const ly = y + 28 + i * lh + lh / 2; ctx.font = '700 ' + Math.round(14 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8ecf8';
      if (l[0] === 'color') { ctx.fillText('Badge is', x + 14, ly); let cx = x + 14 + ctx.measureText('Badge is ').width + 4; l[1].forEach((c, k) => { if (k) { ctx.fillStyle = '#e8ecf8'; ctx.fillText('or', cx, ly); cx += ctx.measureText('or ').width + 4; } ctx.fillStyle = c.c; ctx.beginPath(); ctx.roundRect(cx, ly - 9, 62 * u + 4, 18, 6); ctx.fill(); ctx.fillStyle = '#10131c'; ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.t, cx + (62 * u + 4) / 2, ly); ctx.textAlign = 'left'; ctx.font = '700 ' + Math.round(14 * u + 2) + 'px Fredoka, system-ui, sans-serif'; cx += 62 * u + 12; }); }
      else { ctx.fillStyle = l[0] === 'lvl' ? '#ffd24a' : '#e8ecf8'; ctx.fillText(l[1], x + 14, ly); }
      ctx.textBaseline = 'alphabetic';
    });
    return y + h;
  }
  function drawCard(x, y, w, h) {
    const a = cur; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#f6f2e6'; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS[a.color]; ctx.beginPath(); ctx.roundRect(0, 0, w, 26, [10, 10, 0, 0]); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#10131c'; ctx.font = '700 ' + Math.round(13 * u + 1) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('C.I. AGENT · ' + a.color, 10, 14);
    ctx.fillStyle = '#d8d4c8'; ctx.beginPath(); ctx.roundRect(10, 34, 62 * u + 8, 70 * u + 8, 6); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(10, 34, 62 * u + 8, 70 * u + 8, 6); ctx.clip(); ctx.fillStyle = '#9ab6d8'; ctx.fillRect(10, 34, 70, 80); const ph = Object.assign({}, a.photo); Spy.head(ctx, ph, 10 + (62 * u + 8) / 2, 34 + (70 * u + 8) * 0.52, 21 * u + 3, {}); ctx.fillStyle = a.p.coat; ctx.fillRect(10, 34 + (70 * u + 8) * 0.88, 70, 30); ctx.restore();
    ctx.fillStyle = '#10131c'; ctx.font = '700 ' + Math.round(15 * u + 1) + 'px Fredoka, system-ui, sans-serif'; ctx.fillText(a.name, 20 + 62 * u + 8, 46);
    ctx.font = '700 ' + Math.round(12 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#5a5a66'; ctx.fillText('ID ' + a.id, 20 + 62 * u + 8, 64);
    ctx.fillStyle = '#d9a014'; ctx.font = '700 ' + Math.round(18 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.fillText('★'.repeat(a.lvl) + '☆'.repeat(3 - a.lvl), 20 + 62 * u + 8, 86);
    ctx.fillStyle = '#10131c'; ctx.font = '700 ' + Math.round(12 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.fillText('EXP ' + String(a.exp).padStart(2, '0') + '/26', 20 + 62 * u + 8, 106);
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  function render() {
    if (!R || mode === 'title') { ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H); return; }
    drawBg(); drawBooth(); const ry = drawRules();
    if (cur && (phase === 'wait' || phase === 'yay' || phase === 'nay' || phase === 'tout')) {
      const cw = Math.min(W - 40, 300), ch = 120 * u + 14, cx = W / 2 - cw / 2 + (drag ? clamp(drag.dx, -120, 120) : 0), cy = H * 0.54 + 22 * u;
      ctx.save(); if (phase === 'yay') ctx.translate(Math.min(1, phaseT * 2) * 260, 0); else if (phase === 'nay' || phase === 'tout') ctx.translate(-Math.min(1, phaseT * 2) * 260, 0); ctx.globalAlpha = (phase === 'wait') ? 1 : Math.max(0, 1 - phaseT * 1.2); ctx.rotate((drag ? clamp(drag.dx, -120, 120) / 1200 : 0)); drawCard(cx, cy, cw, ch); ctx.restore();
    }
    if (phase === 'wait') { const bw = Math.min(W - 40, 300), bx = W / 2 - bw / 2, by = ry + 8; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill(); ctx.fillStyle = timeLeft / timeMax < 0.3 ? '#ff4a4a' : '#ffcf4a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(8, bw * timeLeft / timeMax), 8, 4); ctx.fill(); }
    if (verdict) { ctx.globalAlpha = Math.min(1, phaseT * 4); ctx.font = '700 ' + Math.round(22 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = verdict.ok ? '#7dea8a' : '#ff7a6a'; ctx.strokeText(verdict.txt, W / 2, ry + 64); ctx.fillText(verdict.txt, W / 2, ry + 64); ctx.globalAlpha = 1; }
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(28 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgb(' + p.c + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = (verdict && verdict.ok ? 'rgba(120,255,160,' : 'rgba(255,60,60,') + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'You are fired!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Correct calls', correct) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'bulldog', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; n = 0; score = 0; strikes = 0; streak = 0; correct = 0; parts = []; mode = 'play'; newRules(); Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); Kit.banner('Stage 1', 'Check the badges'); next(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('bYay').addEventListener('click', () => decide(true)); $('bNay').addEventListener('click', () => decide(false));
  const cv = $('game');
  cv.addEventListener('pointerdown', e => { if (phase === 'wait') drag = { x: e.clientX, dx: 0, id: e.pointerId }; });
  cv.addEventListener('pointermove', e => { if (drag && drag.id === e.pointerId) drag.dx = e.clientX - drag.x; });
  const up = e => { if (drag && drag.id === e.pointerId) { const dx = drag.dx; drag = null; if (Math.abs(dx) > 70) decide(dx > 0); } }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
  window.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'y') decide(true); if (e.key === 'ArrowLeft' || e.key === 'n') decide(false); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__ci = { get state() { return { mode, stage, score, strikes, n, phase, ok: cur && cur.ok, bad: cur && cur.bad, R }; }, decide, setStage(k) { stage = k; n = 0; newRules(); next(); } };
})();
