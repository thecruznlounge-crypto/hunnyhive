/* Fashion Passion - dress the model to the runway theme: style tags and color mood. */
(function () {
  'use strict';
  Kit.ns('fashion-passion');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2, FX = Fashion.fx(ctx, Food);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const COL = ['#ff4fa3', '#7a5ae8', '#2ac8b8', '#ffd23a', '#e8453a', '#4a8ae8', '#f4f4f8', '#2a2a3a'];
  const SHAPES = { top: ['tank', 'crop', 'blouse', 'jacket'], bottom: ['skirt', 'jeans', 'shorts', 'slacks'], shoes: ['heels', 'boots', 'sandals', 'sneakers'], hat: ['sun', 'beanie', 'cap', 'fedora'], bag: ['tote', 'clutch', 'satchel', 'bucket', 'round', 'hobo'] };
  const TAG = { tank: 'sporty', crop: 'trendy', blouse: 'chic', jacket: 'edgy', skirt: 'chic', jeans: 'trendy', shorts: 'sporty', slacks: 'edgy', heels: 'chic', boots: 'edgy', sandals: 'trendy', sneakers: 'sporty', sun: 'trendy', beanie: 'edgy', cap: 'sporty', fedora: 'chic', tote: 'sporty', clutch: 'chic', satchel: 'edgy', bucket: 'trendy', round: 'chic', hobo: 'trendy' };
  const TAGC = { sporty: '#2ac8b8', trendy: '#ff4fa3', chic: '#a05ae8', edgy: '#e8453a' };
  const THEMES = [
    { n: 'Beach Brunch', tag: 'trendy', pal: ['#2ac8b8', '#ffd23a', '#f4f4f8'] }, { n: 'Gym Glam', tag: 'sporty', pal: ['#ff4fa3', '#2a2a3a', '#f4f4f8'] },
    { n: 'Gala Night', tag: 'chic', pal: ['#2a2a3a', '#ffd23a', '#ff4fa3'] }, { n: 'Rock Show', tag: 'edgy', pal: ['#2a2a3a', '#e8453a', '#7a5ae8'] },
    { n: 'Garden Party', tag: 'chic', pal: ['#ff4fa3', '#f4f4f8', '#3ab85a'] }, { n: 'City Sprint', tag: 'sporty', pal: ['#4a8ae8', '#f4f4f8', '#ffd23a'] },
    { n: 'Street Pop', tag: 'trendy', pal: ['#7a5ae8', '#ffd23a', '#ff4fa3'] }, { n: 'After Dark', tag: 'edgy', pal: ['#2a2a3a', '#4a8ae8', '#f4f4f8'] }
  ];
  const STAGES = [
    { name: 'Open Casting', slots: ['top', 'bottom', 'shoes'], per: 3, pass: .6, time: 34, goal: 3, bg: ['#ffd0e8', '#8a3a9a'] },
    { name: 'Street Style', slots: ['top', 'bottom', 'shoes'], per: 4, pass: .65, time: 32, goal: 3, bg: ['#c8b8ff', '#3a2a8a'] },
    { name: 'Sun Hat Season', slots: ['top', 'bottom', 'shoes', 'hat'], per: 4, pass: .7, time: 32, goal: 4, bg: ['#ffe0a0', '#c85a3a'] },
    { name: 'Accessorize', slots: ['top', 'bottom', 'shoes', 'hat', 'bag'], per: 4, pass: .75, time: 32, goal: 4, bg: ['#7ad8d0', '#1a4a7a'] },
    { name: 'Fashion Week', slots: ['top', 'bottom', 'shoes', 'hat', 'bag'], per: 5, pass: .82, time: 30, goal: 5, bg: ['#ff6a8a', '#2a0a3a'] }
  ];
  const stg = () => { const b = STAGES[Math.min(stage - 1, STAGES.length - 1)], x = Math.max(0, stage - STAGES.length); return Object.assign({}, b, { pass: Math.min(.92, b.pass + x * .02), time: Math.max(20, b.time - x * 2), goal: b.goal + Math.min(x, 3), name: stage > STAGES.length ? b.name + ' ' + (x + 1) : b.name }); };
  const SLN = { top: 'Top', bottom: 'Bottom', shoes: 'Shoes', hat: 'Hat', bag: 'Bag' };
  let W, H, u, stage = 1, score = 0, strikes = 0, served = 0, servedTotal = 0, perfects = 0, t = 0, cfg, theme, closet = {}, outfit = {}, tab = 'top', timeLeft = 1, tmax = 1, state = 'play', stateT = 0, shake = 0, flash = 0, result = null, model = {}, rects = {}, seenTotal = 0;
  const best = () => Kit.get('best', 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); if (!cfg) return; rects = { tabs: [], items: [] }; const n = cfg.slots.length, tw = (W - 20 * u - (n - 1) * 5) / n, ty = H - 248 * u;
    cfg.slots.forEach((s, i) => rects.tabs.push({ s, x: 10 * u + i * (tw + 5), y: ty, w: tw, h: 40 * u }));
    const list = closet[tab] || [], m = cfg.per, cw = (W - 20 * u - (m - 1) * 6) / m, cy = ty + 48 * u; list.forEach((it, i) => rects.items.push({ it, i, x: 10 * u + i * (cw + 6), y: cy, w: cw, h: 150 * u }));
    rects.strut = { x: W * .52, y: 308 * u, w: W * .46, h: 62 * u }; model = { x: W * .29, y: 214 * u, s: 1.0 * u };
  }
  S.onresize = layout;
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · ' + served + '/' + cfg.goal; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  const pieceScore = (it) => (it.tag === theme.tag ? 60 : 0) + (theme.pal.includes(it.color) ? 40 : 0);
  function makeCloset() {
    closet = {}; cfg.slots.forEach(s => { const arr = [], shapes = SHAPES[s].slice().sort(() => Math.random() - .5); const goodShape = shapes.find(sh => TAG[sh] === theme.tag) || shapes[0];
      arr.push({ slot: s, shape: goodShape, color: pick(theme.pal), tag: TAG[goodShape] });
      for (let i = 1; i < cfg.per; i++) { const sh = shapes[i % shapes.length] === goodShape && i < shapes.length ? shapes[(i + 1) % shapes.length] : shapes[i % shapes.length]; arr.push({ slot: s, shape: sh, color: pick(i % 2 ? COL : theme.pal), tag: TAG[sh] }); }
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } closet[s] = arr; });
  }
  function newRound() { theme = pick(THEMES.filter(x => !theme || x !== theme)); outfit = {}; tab = cfg.slots[0]; makeCloset(); tmax = timeLeft = cfg.time; state = 'play'; stateT = 0; result = null; layout(); syncHud(); }
  function newStage() { cfg = stg(); served = 0; theme = null; Kit.banner('Stage ' + stage, cfg.name); newRound(); }
  function maxScore() { return cfg.slots.reduce((a, s) => a + Math.max(...closet[s].map(pieceScore)), 0); }
  function strut(force) {
    if (state !== 'play') return; if (!force && !cfg.slots.every(s => outfit[s])) { FX.say('Dress every slot!', W * .75, 280 * u, '#fff', 15); Kit.tone(200, .1, 'square', .1); return; }
    const mx = maxScore(), got = cfg.slots.reduce((a, s) => a + (outfit[s] ? pieceScore(outfit[s]) : 0), 0), k = got / mx, tk = clamp(timeLeft / tmax, 0, 1), judges = [0, 1, 2].map(j => clamp(Math.round(k * 10 + (j - 1) * (k < .99 ? 1 : 0)), 0, 10)), pass = k >= cfg.pass - 1e-6;
    result = { k, pass, judges, pts: pass ? Math.round(k * 600 * (1 + tk * .5)) : 0 }; state = 'result'; stateT = 0;
    if (pass) { served++; servedTotal++; score += result.pts; if (k >= .99) perfects++; FX.say('+' + result.pts, W * .29, 180 * u, '#ffe066', 28); FX.burst(W * .29, 220 * u, ['#ffe066', '#ff7ac0', '#fff'], 16); Kit.tone(660, .1, 'triangle', .2); Kit.tone(990, .2, 'triangle', .16, 0, Kit.ac().currentTime + .1); }
    else { strikes++; shake = .3; flash = .3; FX.say('Not runway ready', W * .29, 180 * u, '#ff8a7a', 20); Kit.tone(150, .4, 'sawtooth', .16, -80); Kit.vibe(50); }
    syncHud();
  }
  function next() {
    if (strikes >= 3) { state = 'lost'; stateT = 0; return; }
    if (served >= cfg.goal) { state = 'clear'; stateT = 0; const b = 400 + (3 - strikes) * 150; score += b; FX.say('Stage clear! +' + b, W / 2, H * .35, '#fff', 26); Kit.tone(523, .12, 'triangle', .22); Kit.tone(784, .24, 'triangle', .22, 0, Kit.ac().currentTime + .12); syncHud(); return; }
    newRound();
  }
  function update(dt) {
    FX.update(dt); shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    if (state === 'play') { timeLeft -= dt; if (timeLeft <= 0) strut(true); }
    else if (state === 'result') { if (stateT > 2.1) next(); } else if (state === 'clear') { if (stateT > 1.9) { stage++; newStage(); } } else if (state === 'lost' && stateT > .7) gameOver();
  }
  function chip(x, y, txt, col) { ctx.font = '700 ' + Math.round(12 * u) + 'px system-ui,sans-serif'; const w = ctx.measureText(txt).width + 14 * u; ctx.fillStyle = col; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, 20 * u, 10 * u); ctx.fill(); ctx.stroke(); Food.text(ctx, txt, x + w / 2, y + 10 * u, 12 * u, '#fff', { stroke: false }); }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.bg[0]); g.addColorStop(1, cfg.bg[1]); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    const k = clamp(timeLeft / tmax, 0, 1); Food.meter(ctx, 14, 62 * u + 6, W - 28, 12 * u, k, k > .5 ? '#7dea8a' : k > .25 ? '#ffd23a' : '#ff5a4a');
    /* runway */
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(model.x - 90 * u, 500 * u); ctx.lineTo(model.x + 90 * u, 500 * u); ctx.lineTo(model.x + 120 * u, 520 * u); ctx.lineTo(model.x - 120 * u, 520 * u); ctx.fill();
    Fashion.model(ctx, model.x, model.y, model.s, { skin: Fashion.SKIN[2], style: 'bob', color: 'brown', outfit, t, mood: result ? (result.pass ? 1 : 0) : 1 });
    /* theme card */
    const cx = W * .52, cw = W * .46, cy = 100 * u; ctx.fillStyle = '#fff6fa'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cx, cy, cw, 190 * u, 12); ctx.fill(); ctx.stroke();
    Food.text(ctx, 'THEME', cx + cw / 2, cy + 18 * u, 12 * u, '#a04a9a', { stroke: false }); Food.text(ctx, theme.n, cx + cw / 2, cy + 44 * u, 20 * u, '#3a0a4a', { stroke: false });
    Food.text(ctx, 'STYLE', cx + cw / 2, cy + 78 * u, 11 * u, '#a04a9a', { stroke: false }); ctx.font = '700 ' + Math.round(12 * u) + 'px system-ui'; const tw = ctx.measureText(theme.tag).width + 14 * u; chip(cx + cw / 2 - tw / 2, cy + 88 * u, theme.tag, TAGC[theme.tag]);
    Food.text(ctx, 'COLOR MOOD', cx + cw / 2, cy + 128 * u, 11 * u, '#a04a9a', { stroke: false }); theme.pal.forEach((c, i) => { ctx.fillStyle = c; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx + cw / 2 + (i - 1) * 40 * u, cy + 154 * u, 14 * u, 0, TAU); ctx.fill(); ctx.stroke(); });
    Food.text(ctx, 'Qualify: ' + Math.round(cfg.pass * 100) + '%', cx + cw / 2, cy + 182 * u, 12 * u, '#3a0a4a', { stroke: false });
    /* strut */
    const sb = rects.strut, ready = cfg.slots.every(s => outfit[s]); ctx.fillStyle = ready ? '#ff4fa3' : 'rgba(255,255,255,.3)'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 16); ctx.fill(); ctx.stroke(); Food.text(ctx, 'STRUT!', sb.x + sb.w / 2, sb.y + sb.h / 2, 24 * u, '#fff');
    /* judges */
    if (result) [0, 1, 2].forEach(j => { const jx = W * .6 + j * 50 * u, jy = 420 * u; ctx.fillStyle = result.pass ? '#7dea8a' : '#ff8a7a'; ctx.strokeStyle = '#2a0a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(jx - 20 * u, jy - 24 * u, 40 * u, 48 * u, 8); ctx.fill(); ctx.stroke(); Food.text(ctx, String(result.judges[j]), jx, jy, 24 * u, '#fff'); });
    else Heroes.draw(ctx, 'vogue', W * .78, 420 * u, .5 * u, { t, look: 0 });
    if (result) Food.text(ctx, Math.round(result.k * 100) + '% — ' + (result.pass ? 'QUALIFIED!' : 'Not this time'), W * .75, 470 * u, 17 * u, result.pass ? '#ffe066' : '#ffb0a0');
    /* closet */
    ctx.fillStyle = 'rgba(30,6,50,.6)'; ctx.fillRect(0, H - 258 * u, W, 258 * u);
    rects.tabs.forEach(r => { const sel = r.s === tab, has = !!outfit[r.s]; ctx.fillStyle = sel ? '#ffe066' : 'rgba(255,255,255,.2)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = sel ? 3 : 1.5; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke(); Food.text(ctx, (has ? '✓ ' : '') + SLN[r.s], r.x + r.w / 2, r.y + r.h / 2, 13 * u, sel ? '#4a1a5a' : '#fff', { stroke: false }); });
    rects.items.forEach(r => { const sel = outfit[tab] === r.it; ctx.fillStyle = sel ? '#fff6c8' : '#fff6fa'; ctx.strokeStyle = sel ? '#ffd23a' : '#2a0a3a'; ctx.lineWidth = sel ? 4 : 2.5; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke(); Fashion.piece(ctx, r.it, r.x + r.w / 2, r.y + r.h * .42, Math.min(r.w / 100, r.h / 120)); chip(r.x + r.w / 2 - 25 * u, r.y + r.h - 28 * u, r.it.tag, TAGC[r.it.tag]); });
    FX.draw(u); ctx.restore(); if (flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + flash * .3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function tapAt(x, y) {
    if (F.mode !== 'play' || state !== 'play') return false; Kit.ac(); const hit = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    for (const r of rects.tabs) if (hit(r)) { tab = r.s; layout(); Kit.tone(540, .05, 'triangle', .12); return true; }
    for (const r of rects.items) if (hit(r)) { outfit[tab] = outfit[tab] === r.it ? null : r.it; if (!outfit[tab]) delete outfit[tab]; Kit.tone(620, .06, 'triangle', .16); FX.burst(model.x, model.y + 100 * u, ['#fff', r.it.color], 5); return true; }
    if (hit(rects.strut)) { strut(false); return true; } return false;
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, .8, 'sawtooth', .18, -150); F.over(nb ? 'New best!' : 'Show’s over!', [['Score', score.toLocaleString(), nb], ['Looks qualified', servedTotal], ['Perfect looks', perfects], ['Stage reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'vogue', onStart() { stage = 1; score = 0; strikes = 0; servedTotal = 0; perfects = 0; FX.clear(); newStage(); } });
  $('game').addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY));
  cfg = stg(); theme = THEMES[0]; closet = {}; outfit = {}; layout();
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); render(); });
  window.__fp = { get s() { return { mode: F.mode, stage, score, strikes, served, goal: cfg.goal, state, tab, slots: cfg.slots, outfit: Object.keys(outfit), tabs: rects.tabs.map(r => ({ s: r.s, x: r.x + r.w / 2, y: r.y + r.h / 2 })), items: rects.items.map(r => ({ sc: pieceScore(r.it), x: r.x + r.w / 2, y: r.y + r.h / 2 })), strut: { x: rects.strut.x + 10, y: rects.strut.y + 10 } }; }, tapAt };
})();
