/* Mani Pedi Ready - run the spa: Soak, File, Polish, Dry. Press and hold the bubble. */
(function () {
  'use strict';
  Kit.ns('mani-pedi-ready');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const STEPS = [{ k: 'soak', e: '\u{1FAE7}', n: 'Soak', hold: .45, wait: 2.2, col: '#7ad8f0' }, { k: 'file', e: '✨', n: 'File', hold: 1.0, wait: 0, col: '#ffd23a' }, { k: 'polish', e: '\u{1F485}', n: 'Polish', hold: 1.2, wait: 0, col: '#ff7ac0' }, { k: 'dry', e: '\u{1F4A8}', n: 'Dry', hold: .45, wait: 2.4, col: '#b8a0ff' }];
  const STAGES = [
    { name: 'Soft Opening', chairs: 2, steps: [0, 2], pat: 30, gap: 3, goal: 4, bg: ['#c8f0ec', '#5ab0b8'] },
    { name: 'Walk-ins', chairs: 3, steps: [0, 1, 2], pat: 30, gap: 2.6, goal: 6, bg: ['#ffd0e8', '#c0609a'] },
    { name: 'Full Service', chairs: 3, steps: [0, 1, 2, 3], pat: 36, gap: 2.4, goal: 7, bg: ['#d8c8ff', '#6a4ac0'] },
    { name: 'Bridal Party', chairs: 4, steps: [0, 1, 2, 3], pat: 34, gap: 2, goal: 9, bg: ['#fff0c8', '#c88a3a'] },
    { name: 'Spa Rush', chairs: 4, steps: [0, 1, 2, 3], pat: 28, gap: 1.6, goal: 11, bg: ['#ff9ac0', '#6a1a5a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { pat: Math.max(18, b.pat - x * 2), goal: b.goal + Math.min(x * 2, 6), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, seats = [], stage = 1, score = 0, strikes = 0, made = 0, madeTotal = 0, earned = 0, perfects = 0, t = 0, cfg, hold = null, state = 'play', stateT = 0, shake = 0, flash = 0, spawnT = 1, cleared = 0;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); if (!cfg) return; const n = cfg.chairs, top = 120 * u, bot = H - 120 * u; seats = [];
    const cols = n === 4 ? 2 : n, rows = n === 4 ? 2 : 1, cw = W / cols, ch = (bot - top) / rows;
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); const old = seatsOld[i]; seats.push({ x: cw * (c + .5), y: top + ch * (r + .5) + (rows === 1 ? 10 * u : 0), s: Math.min(1, ch / (210 * u), cw / (150 * u)), cl: old ? old.cl : null }); }
  }
  let seatsOld = [];
  S.onresize = () => { seatsOld = seats; layout(); };
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + cleared + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function newStage() { cfg = stg(); cleared = 0; seatsOld = []; layout(); seats.forEach(s => s.cl = null); spawnT = .8; hold = null; state = 'play'; stateT = 0; Kit.banner('Stage ' + stage, cfg.name); syncHud(); }
  function spawn(s) { s.cl = { skin: pick(Fashion.SKIN), hair: pick(Fashion.HAIR || ['brown']), sty: pick(['bun', 'pony', 'braid', 'curls', 'bob', 'pixie']), step: 0, ph: 'wait', tm: 0, pat: cfg.pat * rnd(.9, 1.1), pmax: 1, in: 0, out: 0, mood: 1, done: false }; s.cl.pmax = s.cl.pat; Kit.tone(660, .08, 'sine', .12); }
  const stepDef = c => STEPS[cfg.steps[c.step]];
  function bubbleOf(s) { return { x: s.x, y: s.y - 98 * s.s * u, r: 30 * u }; }
  function down(x, y) {
    if (F.mode !== 'play' || state !== 'play') return false; Kit.ac();
    for (let i = 0; i < seats.length; i++) { const s = seats[i], c = s.cl; if (!c || c.ph !== 'ready' || c.done) continue; const b = bubbleOf(s); if (Math.hypot(x - b.x, y - b.y) < b.r * 1.8) { hold = { i, k: 0 }; return true; } } return false;
  }
  function up() { hold = null; }
  function advance(s) {
    const c = s.cl, d = stepDef(c);
    if (d.wait) { c.ph = 'run'; c.tm = d.wait; Kit.tone(520, .08, 'triangle', .14); } else { stepDone(s); }
  }
  function stepDone(s) {
    const c = s.cl; c.step++; Kit.tone(700 + c.step * 80, .08, 'triangle', .18); FX.burst(s.x, s.y - 40 * s.s * u, ['#fff', stepDef0(c.step - 1).col], 6);
    if (c.step >= cfg.steps.length) { c.done = true; c.ph = 'leave'; c.tm = 0; const k = clamp(c.pat / c.pmax, 0, 1), tip = Math.round(60 * cfg.steps.length * (.6 + k)); score += tip; earned += tip; cleared++; made++; madeTotal++; if (k > .5) perfects++; FX.say('+' + tip, s.x, s.y - 110 * s.s * u, '#ffe066', 26); FX.burst(s.x, s.y - 60 * u, ['#ffe066', '#ff7ac0', '#fff'], 12); Kit.tone(880, .14, 'triangle', .2); syncHud(); if (cleared >= cfg.goal) { state = 'clear'; stateT = 0; } }
    else c.ph = 'ready';
  }
  const stepDef0 = i => STEPS[cfg.steps[Math.min(i, cfg.steps.length - 1)]];
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    if (state === 'play') {
      spawnT -= dt; if (spawnT <= 0) { const free = seats.filter(s => !s.cl); if (free.length) { spawn(pick(free)); spawnT = cfg.gap * rnd(.8, 1.3); } else spawnT = .5; }
      seats.forEach((s, i) => { const c = s.cl; if (!c) return; c.in = Math.min(1, c.in + dt * 4);
        if (c.ph === 'leave') { c.out += dt * 1.6; if (c.out >= 1) s.cl = null; return; }
        if (c.ph === 'angry') { c.out += dt * 2; if (c.out >= 1) s.cl = null; return; }
        c.pat -= dt; c.mood = clamp(c.pat / c.pmax * 1.6, 0, 1);
        if (c.pat <= 0) { c.ph = 'angry'; c.out = 0; strikes++; shake = .3; flash = .3; FX.say('Angry client!', s.x, s.y - 100 * s.s * u, '#ff8a7a', 20); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); if (hold && hold.i === i) hold = null; syncHud(); if (strikes >= 3) { state = 'lost'; stateT = 0; } return; }
        if (c.ph === 'wait' && c.in >= 1) c.ph = 'ready';
        if (c.ph === 'run') { c.tm -= dt; if (c.tm <= 0) stepDone(s); }
      });
      if (hold) { const s = seats[hold.i], c = s && s.cl; if (!c || c.ph !== 'ready') hold = null; else { hold.k += dt / stepDef(c).hold; if (hold.k >= 1) { const sp = s; hold = null; advance(sp); } } }
    } else if (state === 'clear') { if (stateT > 1.8) { stage++; newStage(); } else if (stateT < .05) { const b = 400 + (3 - strikes) * 150; score += b; FX.say('Stage clear! +' + b, W / 2, H * .42, '#fff', 26); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); syncHud(); } }
    else if (state === 'lost' && stateT > .8) gameOver();
  }
  function ring(x, y, r, k, col) { ctx.lineWidth = 6 * u; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); if (k > 0) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); } }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((i * 83 + t * 8) % (W + 40) - 20, 150 * u + (i * 97) % (H * .6), 10 + i * 3, 0, TAU); ctx.fill(); }
    seats.forEach((s, i) => {
      const k = s.s * u; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 70, 70, 14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9ac8'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-52, -30, 104, 92, 22); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8629a'; ctx.beginPath(); ctx.roundRect(-52, -62, 104, 44, [22, 22, 6, 6]); ctx.fill(); ctx.stroke();
      const c = s.cl; if (c) { const dy = (1 - c.in) * -40 + (c.ph === 'leave' ? -c.out * 60 : 0) + (c.ph === 'angry' ? c.out * 20 : 0); ctx.globalAlpha = c.ph === 'leave' || c.ph === 'angry' ? 1 - c.out : c.in;
        ctx.fillStyle = pickShirt(i); ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(-34, -18 + dy, 68, 64, 18); ctx.fill(); ctx.stroke();
        Fashion.head(ctx, 0, -40 + dy, .5, { skin: c.skin, style: c.sty, color: ['brown', 'blonde', 'red', 'pink', 'purple', 'teal'][(i + madeTotal) % 6], t, mood: c.ph === 'angry' ? 0 : c.mood > .5 ? 1 : .4, look: 0 });
        if (c.ph === 'run') { const d = stepDef(c); ctx.fillStyle = d.col; ctx.globalAlpha = .75; ctx.beginPath(); ctx.ellipse(0, 52 + dy, 46, 14, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.stroke(); Food.emoji(ctx, d.e, 0, 46 + dy + Math.sin(t * 6) * 3, 30, { shadow: false }); const tk = 1 - c.tm / d.wait; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-36, 70, 72, 7); ctx.fillStyle = '#fff'; ctx.fillRect(-36, 70, 72 * tk, 7); }
        ctx.globalAlpha = 1; }
      ctx.restore();
      if (c && !c.done && c.ph !== 'angry') { const pk = clamp(c.pat / c.pmax, 0, 1); Food.meter(ctx, s.x - 40 * k, s.y + 82 * k, 80 * k, 8 * u, pk, pk > .5 ? '#7dea8a' : pk > .25 ? '#ffd23a' : '#ff5a4a'); }
      if (c && c.ph === 'ready') { const b = bubbleOf(s), d = stepDef(c), pulse = 1 + Math.sin(t * 7) * .06; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(pulse, pulse); ctx.fillStyle = '#fff'; ctx.strokeStyle = d.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill(); ctx.stroke(); Food.emoji(ctx, d.e, 0, 0, 34 * u, { shadow: false }); ctx.restore(); ring(b.x, b.y, b.r + 6 * u, hold && hold.i === i ? hold.k : 0, d.col); Food.text(ctx, d.n, b.x, b.y - b.r - 14 * u, 13 * u, '#fff'); const dots = cfg.steps.map((_, j) => j < c.step ? '●' : '○').join(' '); Food.text(ctx, dots, b.x, b.y + b.r + 14 * u, 11 * u, '#fff', { stroke: false }); }
    });
    Heroes.draw(ctx, 'flora', 52 * u, H - 62 * u, .55 * u, { t, look: 0 });
    Food.text(ctx, 'Tips: ' + earned.toLocaleString(), W - 70 * u, H - 54 * u, 15 * u, '#ffe066');
    if (stage === 1 && madeTotal === 0) Food.text(ctx, 'Press and hold the glowing bubble', W / 2, H - 100 * u, 15 * u, '#fff');
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  const SHIRT = ['#7a5ae8', '#2ac8b8', '#ffb02a', '#4a8ae8']; const pickShirt = i => SHIRT[i % 4];
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Spa closed!', [['Score', score.toLocaleString(), nb], ['Clients served', madeTotal], ['Happy clients', perfects], ['Tips', earned.toLocaleString()], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'flora', onStart() { stage = 1; score = 0; strikes = 0; made = 0; madeTotal = 0; earned = 0; perfects = 0; FX.clear(); newStage(); } });
  const cv = $('game'); cv.addEventListener('pointerdown', e => down(e.clientX, e.clientY)); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cfg = stg(); layout();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__m = { get s() { return { mode: F.mode, stage, score, strikes, served: cleared, goal: cfg.goal, earned, state, hold: !!hold, seats: seats.map(s => ({ x: s.x, y: s.y, ph: s.cl && s.cl.ph, step: s.cl && s.cl.step, b: bubbleOf(s) })) }; }, down, up };
})();
