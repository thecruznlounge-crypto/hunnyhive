/* Red Light Blue Light - run on blue, freeze on red. */
(function () {
  'use strict';
  Kit.ns('red-light-blue-light');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  let W, H, u, gY;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); gY = H * 0.62; }
  S.onresize = layout; layout();
  const THEMES = [
    { name: 'Neon Street', sky: ['#1a1040', '#5a2a7a'], gnd: ['#2a2840', '#14121f'], bld: ['#2a2058', '#1a1440'] },
    { name: 'Parking Garage', sky: ['#2a2e3a', '#4a5060'], gnd: ['#5a5e6a', '#2a2e38'], bld: ['#3a3e4a', '#2a2e38'] },
    { name: 'Harbor Docks', sky: ['#0a2a4a', '#2a6a8a'], gnd: ['#6a5a42', '#3a2e20'], bld: ['#1a3a5a', '#122a44'] },
    { name: 'Airport Runway', sky: ['#3a6ab8', '#a8d0f0'], gnd: ['#4a4e58', '#2a2e38'], bld: ['#8aa4c8', '#6a84a8'] },
    { name: 'Stadium Night', sky: ['#0a1a3a', '#1a3a6a'], gnd: ['#2a7a3a', '#145a24'], bld: ['#1a2a54', '#101c3c'] }
  ];
  let mode = 'title', stage = 1, score = 0, strikes = 0, t = 0, prog = 0, light = 'blue', lt = 0, ltNext = 2, warn = 0, fake = false, running = false, holding = false, tleft = 40, tmax = 40, state = 'play', stateT = 0, grace = 0, parts = [], flash = 0, cleared = 0, shake = 0, seq = 0, runT = 0, stepPh = 0;
  const best = () => Kit.get('best', 0), th = () => THEMES[(stage - 1) % THEMES.length];
  function nextLight() {
    seq++; if (light === 'blue' || light === 'start') {
      light = 'red'; ltNext = rnd(1.0, 2.1) + (stage < 3 ? 0.5 : 0); fake = false; Kit.tone(220, 0.25, 'square', 0.1, -60);
    } else {
      light = 'blue'; ltNext = Math.max(0.7, rnd(1.4, 3.2) - stage * 0.22); fake = false; Kit.tone(660, 0.15, 'triangle', 0.14);
    }
    lt = 0; warn = 0;
  }
  function newRun() { prog = 0; light = 'blue'; lt = 0; ltNext = 2.2; tmax = Math.max(28, 44 - stage * 2); tleft = tmax; state = 'play'; stateT = 0; grace = 0; syncHud(); }
  function syncHud() { $('hudL').textContent = 'S' + stage; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function caught(why) { strikes++; state = 'caught'; stateT = 0; flash = 0.6; shake = 0.7; prog = Math.max(0, prog - 0.2); Kit.tone(140, 0.5, 'sawtooth', 0.22, -80); Kit.noise(0.3, 0.2, null, 500); Kit.vibe(100); parts.push({ txt: why, x: W / 2, y: H * 0.4, age: 0, life: 1.3 }); syncHud(); }
  function update(dt) {
    parts.forEach(q => { q.age += dt; q.y -= 26 * dt; }); parts = parts.filter(q => q.age < q.life); flash = Math.max(0, flash - dt * 2); shake = Math.max(0, shake - dt * 3);
    if (mode !== 'play') return; stateT += dt;
    if (state === 'play') {
      lt += dt; tleft -= dt;
      /* warning logic: before red, yellow blink */
      if (light === 'blue') { const wl = stage <= 2 ? 0.55 : stage <= 4 ? (seq % 2 ? 0.4 : 0.25) : 0; const fakeP = stage >= 4 && !fake && lt > 0.5 && Math.random() < dt * 0.35 && ltNext - lt > 1.0; if (fakeP) { fake = true; warn = 0.45; } if (wl > 0 && ltNext - lt < wl) warn = Math.max(warn, 0.05); }
      warn = Math.max(0, warn - dt);
      if (lt >= ltNext) nextLight();
      running = holding; if (running) { prog += dt / (20 - Math.min(6, stage)); stepPh += dt * 14; runT += dt; if (light === 'red') { grace += dt; if (grace > 0.22) caught('Moved on red!'); } else { score += Math.round(dt * 60 * (1 + stage * 0.2)); } if (light !== 'red') grace = 0; } else grace = Math.max(0, grace - dt * 2);
      if (prog >= 1) { state = 'done'; stateT = 0; const b = 400 + Math.round(tleft * 25); score += b; cleared++; flash = 0.4; parts.push({ txt: 'Finish! +' + b, x: W / 2, y: H * 0.4, age: 0, life: 1.4 }); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.12, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); }
      else if (tleft <= 0) { tleft = 0; caught("Time's up!"); }
      syncHud();
    } else if (state === 'caught') { if (stateT > 1.4) { if (strikes >= 3) return gameOver(); state = 'play'; stateT = 0; grace = 0; light = 'red'; lt = 0; ltNext = 1.2; } }
    else if (state === 'done') { if (stateT > 1.8) { stage++; newRun(); Kit.banner('Stage ' + stage, th().name); } }
  }
  function drawRunner(x, y, s, moving) {
    const bob = moving ? Math.abs(Math.sin(stepPh)) * 5 * u : 0; ctx.save(); Heroes.draw(ctx, 'beatcop', x, y - bob, s, { look: 1, t }); ctx.restore();
  }
  function render() {
    const T = th(), g = ctx.createLinearGradient(0, 0, 0, gY); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const isRed = light === 'red', col = isRed ? '255,50,50' : '60,120,255'; const pulse = 0.5 + 0.5 * Math.sin(t * 14);
    ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 6);
    /* buildings parallax */
    for (let l = 0; l < 2; l++) { const sp = 600 * (l ? 0.5 : 0.25) * u, off = (prog * sp) % (90 * u), bw = 90 * u; ctx.fillStyle = T.bld[l]; for (let i = -1; i < W / bw + 2; i++) { const hh = (90 + ((i * 29 + l * 13 + 50) % 7) * 18) * u + l * 30; ctx.fillRect(i * bw - off, gY - hh, bw - 8, hh); ctx.fillStyle = 'rgba(255,240,170,.28)'; for (let r = 0; r < 4; r++) ctx.fillRect(i * bw - off + 10, gY - hh + 12 + r * 24 * u, 14 * u, 10 * u); ctx.fillStyle = T.bld[l]; } }
    /* ground */
    const gg = ctx.createLinearGradient(0, gY, 0, H); gg.addColorStop(0, T.gnd[0]); gg.addColorStop(1, T.gnd[1]); ctx.fillStyle = gg; ctx.fillRect(0, gY, W, H - gY);
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 4; ctx.setLineDash([30 * u, 26 * u]); ctx.lineDashOffset = (prog * 1400 * u) % (56 * u); ctx.beginPath(); ctx.moveTo(0, gY + 74 * u); ctx.lineTo(W, gY + 74 * u); ctx.stroke(); ctx.setLineDash([]);
    /* finish */
    const fx = W * 0.82 + (1 - prog) * W * 0.9; if (fx < W + 80) { ctx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#14141e' : '#fff'; ctx.fillRect(fx - 12, gY + 10 + i * 20 * u, 24, 20 * u); } ctx.fillStyle = '#ffcf4a'; ctx.font = '700 ' + Math.round(16 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FINISH', fx, gY - 10); }
    /* light bot at the finish: always on the right, bigger as you near */
    const bs = (1.05 + prog * 0.5) * u * 1.15, bx = W * 0.84; Heroes.draw(ctx, 'lightbot', bx, gY + 120 * u, bs, { t: isRed ? 0.2 : 0, look: -1 });
    ctx.restore();
    /* light bar */
    const bw = Math.min(W - 40, 340), bx2 = W / 2 - bw / 2, by = 76; ctx.fillStyle = '#14141e'; ctx.beginPath(); ctx.roundRect(bx2 - 6, by - 6, bw + 12, 64 * u + 12, 16); ctx.fill();
    const warnOn = warn > 0 && Math.floor(t * 12) % 2 === 0; const lc = warnOn ? ['255,220,40', '255,220,40'] : [isRed ? '255,50,50' : '70,70,90', isRed ? '70,40,40' : '60,120,255'];
    const lamp = (x, c, on) => { const rg = ctx.createRadialGradient(x, by + 32 * u, 4, x, by + 32 * u, 60); rg.addColorStop(0, 'rgba(' + c + ',' + (on ? 1 : 0.25) + ')'); rg.addColorStop(1, 'rgba(' + c + ',' + (on ? 0.55 : 0.1) + ')'); ctx.fillStyle = rg; ctx.beginPath(); ctx.roundRect(x - bw / 4 + 4, by, bw / 2 - 8, 64 * u, 12); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); };
    lamp(bx2 + bw / 4, warnOn ? '255,220,40' : '255,50,50', isRed || warnOn); lamp(bx2 + bw * 0.75, warnOn ? '255,220,40' : '60,120,255', !isRed || warnOn);
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(26 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5; const msg = warnOn ? 'GET READY...' : (isRed ? 'RED - FREEZE!' : 'BLUE - GO!'); ctx.strokeText(msg, W / 2, by + 32 * u + 10); ctx.fillText(msg, W / 2, by + 32 * u + 10);
    if (isRed) { ctx.fillStyle = 'rgba(255,50,50,' + (0.07 + pulse * 0.1) + ')'; ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = 'rgba(60,120,255,' + (0.05 + pulse * 0.06) + ')'; ctx.fillRect(0, 0, W, H); }
    /* runner */
    const rx = W * 0.14 + prog * W * 0.3, rs = 0.9 * u; drawRunner(rx, gY + 130 * u, rs, running && state === 'play');
    if (grace > 0.02 && isRed) { ctx.fillStyle = 'rgba(255,60,60,.9)'; ctx.font = '700 ' + Math.round(30 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', rx, gY + 12 * u); }
    /* progress + time */
    const pw = Math.min(W - 40, 320), px = W / 2 - pw / 2, py = by + 64 * u + 24; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(px, py, pw, 10, 5); ctx.fill(); ctx.fillStyle = '#7dea8a'; ctx.beginPath(); ctx.roundRect(px, py, Math.max(10, pw * prog), 10, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.ceil(tleft) + 's', px + pw, py + 26);
    const rb = $('bRun'); rb.classList.toggle('down', holding); rb.textContent = holding ? 'RUNNING' : 'HOLD TO RUN';
    parts.forEach(q => { const k = 1 - q.age / q.life; ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(30 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillText(q.txt, q.x, q.y); ctx.globalAlpha = 1; });
    if (flash > 0) { ctx.fillStyle = (state === 'done' ? 'rgba(120,255,160,' : 'rgba(255,60,60,') + flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Busted!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Finish lines crossed', cleared) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'lightbot', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), { t: 0.2 });
    Kit.show('over');
  }
  function start() { stage = 1; score = 0; strikes = 0; cleared = 0; seq = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRun(); Kit.banner('Stage 1', th().name); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; holding = false; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  const ptrs = new Set();
  window.addEventListener('pointerdown', e => { if (mode !== 'play' || e.target.closest('.sq')) return; Kit.ac(); ptrs.add(e.pointerId); holding = true; });
  const up = e => { ptrs.delete(e.pointerId); holding = ptrs.size > 0; }; window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowRight') holding = true; }); window.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'ArrowRight') holding = false; });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__rl = { get state() { return { mode, stage, score, strikes, state, light, prog, warn: warn > 0, tleft, ltLeft: ltNext - lt }; }, hold(v) { holding = v; }, setStage(n) { stage = n; newRun(); } };
})();
