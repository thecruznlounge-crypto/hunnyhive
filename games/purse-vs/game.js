/* Purse Vs - memory match of designer purses against a rival shopper. */
(function () {
  'use strict';
  Kit.ns('purse-vs');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
  const COLS = ['#e8348a', '#7a5ae8', '#2ac8b8', '#ffb02a', '#e8453a', '#4a8ae8', '#3ab85a', '#2a2a3a'], CHARM = [null, '⭐', '\u{1F337}', '\u{1F380}'];
  const STAGES = [
    { name: 'Outlet Mall', pairs: 3, cols: 3, acc: .3, bg: ['#ffb0d8', '#a04a9a'] },
    { name: 'Boutique Row', pairs: 6, cols: 3, acc: .5, bg: ['#c8a8ff', '#5a3ab8'] },
    { name: 'Department Store', pairs: 8, cols: 4, acc: .65, bg: ['#ffd0a0', '#c8604a'] },
    { name: 'Designer Sale', pairs: 10, cols: 4, acc: .8, bg: ['#7ad8d0', '#1a5a7a'] },
    { name: 'Black Friday', pairs: 12, cols: 4, acc: .92, bg: ['#ff6a8a', '#3a0a2a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { acc: Math.min(.97, b.acc + x * .02), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  let W, H, u, cards = [], stage = 1, score = 0, strikes = 0, mine = 0, theirs = 0, wins = 0, totalPairs = 0, combo = 0, bestCombo = 0, t = 0, cfg, turn = 'you', phase = 'idle', phT = 0, flipped = [], known = {}, shake = 0, flash = 0, banner = null, state = 'play', stateT = 0;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); if (!cfg) return; const n = cards.length, cols = cfg.cols, rows = Math.ceil(n / cols), top = 112 * u, bot = H - 128 * u, ah = bot - top, aw = W - 20 * u;
    const cw = Math.min(aw / cols - 8 * u, (ah / rows - 8 * u) / 1.22, 96 * u), ch = cw * 1.22, x0 = W / 2 - (cols * (cw + 8 * u) - 8 * u) / 2, y0 = top + (ah - (rows * (ch + 8 * u) - 8 * u)) / 2;
    cards.forEach((c, i) => { c.w = cw; c.h = ch; c.x = x0 + (i % cols) * (cw + 8 * u) + cw / 2; c.y = y0 + Math.floor(i / cols) * (ch + 8 * u) + ch / 2; });
  }
  S.onresize = layout;
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + mine + '–' + theirs; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function deal() {
    const ids = [], seen = new Set(); let guard = 0;
    while (ids.length < cfg.pairs && guard++ < 400) { const sh = Fashion.PSHAPE[ids.length % 6 + (guard > 50 ? Math.floor(Math.random() * 6) : 0) % 6] || pick(Fashion.PSHAPE), col = guard > 20 || ids.length >= 6 ? pick(COLS) : COLS[ids.length], ch = ids.length >= 6 ? pick(CHARM) : null, k = sh + col + ch; if (seen.has(k)) continue; seen.add(k); ids.push({ shape: sh, color: col, charm: ch }); }
    const arr = []; ids.forEach((d, i) => { arr.push(Object.assign({ id: i }, d), Object.assign({ id: i }, d)); }); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    cards = arr.map(d => Object.assign(d, { state: 'down', f: 0, g: 1, x: 0, y: 0, w: 1, h: 1 })); known = {}; flipped = []; mine = theirs = 0; combo = 0; turn = 'you'; phase = 'idle'; layout(); syncHud();
  }
  function newStage() { cfg = stg(); totalPairs = cfg.pairs; Kit.banner('Stage ' + stage, cfg.name); state = 'play'; stateT = 0; deal(); }
  function flip(i) {
    const c = cards[i]; if (!c || c.state !== 'down' || flipped.length >= 2) return false; c.state = 'up'; flipped.push(i); Kit.tone(520 + flipped.length * 90, .06, 'triangle', .14);
    if (turn === 'you' || Math.random() < cfg.acc) known[i] = true; if (flipped.length === 2) { phase = 'resolve'; phT = 0; } return true;
  }
  function resolve() {
    const [a, b] = flipped, A = cards[a], B = cards[b], ok = A.id === B.id; flipped = [];
    if (ok) { A.state = B.state = 'gone'; delete known[a]; delete known[b]; if (turn === 'you') { mine++; combo++; bestCombo = Math.max(bestCombo, combo); const p = 100 * Math.min(combo, 5); score += p; FX.say('+' + p, A.x, A.y - 20 * u, '#ffe066', 22); FX.burst((A.x + B.x) / 2, (A.y + B.y) / 2, ['#ff7ac0', '#ffe066', '#fff'], 10); Kit.tone(780, .1, 'triangle', .2); Kit.tone(1040, .18, 'triangle', .16, 0, Kit.ac().currentTime + .08); } else { theirs++; combo = 0; FX.say('Rival!', A.x, A.y - 20 * u, '#ff8a7a', 18); Kit.tone(300, .15, 'square', .1); }
      syncHud(); if (cards.every(c => c.state === 'gone')) { roundEnd(); return; } phase = 'idle'; phT = 0; }
    else { A.state = B.state = 'down'; if (turn === 'you') combo = 0; turn = turn === 'you' ? 'rival' : 'you'; phase = 'idle'; phT = 0; Kit.tone(240, .1, 'sine', .1, -30); }
  }
  function rivalMove() {
    const down = cards.map((c, i) => i).filter(i => cards[i].state === 'down');
    if (flipped.length === 0) { const ks = down.filter(i => known[i]); for (const i of ks) { const j = ks.find(k => k !== i && cards[k].id === cards[i].id); if (j !== undefined) { flip(i); rivalNext = j; return; } } const unk = down.filter(i => !known[i]); rivalNext = null; flip(pick(unk.length ? unk : down)); }
    else { const f = flipped[0]; let j = rivalNext; if (j == null) { j = down.filter(i => known[i] && cards[i].id === cards[f].id)[0]; } if (j == null || cards[j].state !== 'down') { const rest = down.filter(i => i !== f && !known[i]); j = pick(rest.length ? rest : down.filter(i => i !== f)); } flip(j); }
  }
  let rivalNext = null;
  function roundEnd() {
    phase = 'over'; phT = 0;
    if (mine > theirs) { state = 'won'; const b = 300 + (mine - theirs) * 60 + (3 - strikes) * 100; score += b; wins++; FX.say('You win! +' + b, W / 2, H * .45, '#ffe066', 28); FX.burst(W / 2, H * .45, ['#ffe066', '#ff7ac0', '#fff'], 22); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); }
    else if (mine < theirs) { state = 'lost'; strikes++; shake = .3; flash = .3; FX.say('Rival wins this one', W / 2, H * .45, '#ff8a7a', 22); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); }
    else { state = 'tie'; FX.say('Tie - reshuffle!', W / 2, H * .45, '#fff', 24); }
    syncHud();
  }
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); cards.forEach(c => { const tf = c.state === 'down' ? 0 : 1; c.f += (tf - c.f) * Math.min(1, dt * 14); if (c.state === 'gone') c.g = Math.max(0, c.g - dt * 3); });
    if (F.mode !== 'play') return; phT += dt;
    if (phase === 'resolve' && phT > .85) resolve();
    else if (phase === 'idle' && turn === 'rival' && phT > .7 && flipped.length < 2) { phT = 0; rivalMove(); }
    else if (phase === 'over') { if (phT > 1.9) { if (state === 'won') { stage++; newStage(); } else if (strikes >= 3) { phase = 'dead'; phT = 0; } else { state = 'play'; deal(); } } }
    else if (phase === 'dead' && phT > .5) gameOver();
  }
  function backCard(c) { ctx.fillStyle = '#6a2a8a'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10 * u); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-c.w / 2 + 6 * u, -c.h / 2 + 6 * u, c.w - 12 * u, c.h - 12 * u, 6 * u); ctx.stroke(); Food.text(ctx, '★', 0, 0, c.w * .4, '#ffd23a', { stroke: false }); }
  function faceCard(c) { ctx.fillStyle = '#fff6fa'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10 * u); ctx.fill(); ctx.stroke(); Fashion.purse(ctx, 0, -c.h * .04, c.w / 112, { shape: c.shape, color: c.color, trim: c.color === '#ffb02a' ? '#fff' : '#ffd23a', charm: c.charm }); }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    /* rivals */
    const yT = turn === 'you';
    Food.text(ctx, 'YOU ' + mine, 62 * u, 92 * u, 16 * u, yT ? '#ffe066' : '#fff', { stroke: false }); Food.text(ctx, 'RIVAL ' + theirs, W - 70 * u, 92 * u, 16 * u, !yT ? '#ffe066' : '#fff', { stroke: false });
    Food.text(ctx, yT ? 'Your turn' : 'Rival is picking…', W / 2, 92 * u, 14 * u, '#fff', { stroke: false });
    cards.forEach(c => { if (c.g <= 0) return; ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.g, c.g); const sx2 = Math.abs(Math.cos(c.f * Math.PI)); ctx.scale(Math.max(.04, sx2), 1); if (c.f > .5) faceCard(c); else backCard(c); ctx.restore(); });
    Heroes.draw(ctx, 'chic', 56 * u, H - 62 * u, .55 * u, { t, look: yT ? 0 : .6 });
    ctx.save(); ctx.translate(W - 50 * u, H - 62 * u); Fashion.head(ctx, 0, 0, .36 * u, { skin: Fashion.SKIN[2], style: 'bob', color: 'red', acc: 'shades', t, mood: turn === 'rival' ? 1 : 0, look: yT ? -.4 : .6 }); ctx.restore();
    if (stage === 1 && wins === 0 && mine + theirs === 0) Food.text(ctx, 'Tap two purses to find a pair', W / 2, H - 112 * u, 15 * u, '#fff');
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function tapAt(x, y) { if (F.mode !== 'play' || turn !== 'you' || phase !== 'idle' || flipped.length >= 2) return false; Kit.ac(); for (let i = 0; i < cards.length; i++) { const c = cards[i]; if (c.state === 'down' && Math.abs(x - c.x) < c.w / 2 && Math.abs(y - c.y) < c.h / 2) return flip(i); } return false; }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Sold out!', [['Score', score.toLocaleString(), nb], ['Rounds won', wins], ['Best streak', bestCombo], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'chic', onStart() { stage = 1; score = 0; strikes = 0; wins = 0; bestCombo = 0; FX.clear(); newStage(); } });
  $('game').addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY));
  cfg = stg(); layout();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__p = { get s() { return { mode: F.mode, stage, score, strikes, served: mine, goal: totalPairs, lots: theirs, turn, phase, state, cards: cards.map(c => ({ id: c.id, st: c.state, x: c.x, y: c.y })) }; }, tapAt };
})();
