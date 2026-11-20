/* Code Word - HQ sends a hint. Tap the words that fit. */
(function () {
  'use strict';
  Kit.ns('code-word');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); }
  S.onresize = layout; layout();

  const G = [
    { h: 'Things that fly', w: 'eagle jet kite bee rocket balloon drone owl bat helicopter', tr: 'penguin ostrich car', x: 'cold' },
    { h: 'Found in a kitchen', w: 'spoon oven whisk kettle fridge plate toaster blender ladle apron', tr: 'sofa hammer pillow', x: 'hot' },
    { h: 'Spy gadgets', w: 'wiretap periscope disguise microfilm decoder binoculars lockpick tracker mask parachute', tr: 'flashlight toolbox telescope' },
    { h: 'Cold things', w: 'ice snow glacier igloo frost popsicle freezer blizzard sleet iceberg', tr: 'lava desert oven', x: 'hot' },
    { h: 'Hot things', w: 'lava desert volcano sun fire sauna chili furnace ember magma', tr: 'glacier frost snowman', x: 'kitchen' },
    { h: 'Sea creatures', w: 'shark whale octopus crab squid dolphin jellyfish seal eel turtle', tr: 'lake boat sand' },
    { h: 'Musical instruments', w: 'piano guitar violin drum flute harp trumpet cello banjo tuba', tr: 'radio speaker microphone' },
    { h: 'Found in space', w: 'comet planet orbit moon galaxy asteroid nebula star satellite meteor', tr: 'sky ceiling ocean' },
    { h: 'Things with wheels', w: 'bike truck skateboard wagon scooter bus tractor train stroller cart', tr: 'sled canoe boat' },
    { h: 'School supplies', w: 'pencil eraser ruler notebook backpack desk chalk globe stapler marker', tr: 'mop plunger anvil' },
    { h: 'Fruits', w: 'apple mango grape lemon cherry peach banana plum melon berry', tr: 'tomato carrot potato' },
    { h: 'Weather', w: 'rain storm thunder fog hail breeze drizzle tornado rainbow monsoon', tr: 'moon umbrella raincoat' },
    { h: 'Body parts', w: 'elbow knee thumb ankle wrist shoulder chin heel palm spine', tr: 'sleeve glove shoe' }
  ].map(g => ({ h: g.h, w: g.w.split(' '), tr: g.tr.split(' '), x: g.x }));
  const ALL = []; G.forEach((g, gi) => g.w.forEach(w => ALL.push({ w, gi })));
  const THEMES = [['#26304a', '#10131c'], ['#3a2a3a', '#1a1018'], ['#1a3a3a', '#0c1c1c'], ['#3a3a1a', '#1c1c0c'], ['#3a1a1a', '#1c0c0c']];

  let mode = 'title', stage = 1, round = 1, score = 0, strikes = 0, t = 0, tiles = [], hint = null, need = 0, found = 0, left = 0, total = 30, cols = 3, rows = 3, gridTop = 0, tw = 0, th = 0, parts = [], flash = 0, doneT = 0, solved = 0, streak = 0, state = 'play', shake = 0;
  const best = () => Kit.get('best', 0);

  function newRound() {
    const g = pick(G), gi = G.indexOf(g); const tier = stage;
    need = tier <= 1 ? 2 : tier <= 2 ? 3 : tier <= 5 ? 4 : 5; const n = tier <= 1 ? 9 : tier <= 2 ? 12 : tier <= 5 ? 16 : 20; cols = n === 9 ? 3 : n === 12 ? 3 : 4; rows = n / cols;
    const good = shuffle(g.w.slice()).slice(0, need).map(w => ({ w, ok: true }));
    const nTrap = tier >= 4 ? Math.min(3, g.tr.length, tier - 2) : 0; const traps = shuffle(g.tr.slice()).slice(0, nTrap).map(w => ({ w, ok: false, trap: true }));
    const CF = { 'Things that fly': ['Found in space'], 'Found in a kitchen': ['Hot things', 'Cold things'], 'Hot things': ['Found in a kitchen', 'Cold things', 'Found in space'], 'Cold things': ['Hot things', 'Found in a kitchen', 'Weather'], 'Found in space': ['Things that fly', 'Weather', 'Hot things'], 'Weather': ['Cold things', 'Found in space'] }, bad = CF[g.h] || [];
    const pool = ALL.filter(e => e.gi !== gi && !bad.includes(G[e.gi].h) && !g.w.includes(e.w) && !g.tr.includes(e.w));
    const used = new Set(good.concat(traps).map(x => x.w)); const fill = []; shuffle(pool.slice()).forEach(e => { if (fill.length < n - good.length - traps.length && !used.has(e.w)) { used.add(e.w); fill.push({ w: e.w, ok: false }); } });
    tiles = shuffle(good.concat(traps, fill)).map((o, i) => Object.assign(o, { i, state: 'idle', fb: 0 })); hint = g; found = 0; state = 'play'; doneT = 0;
    total = Math.max(12, 16 + need * 4 - stage * 0.9); left = total; layoutGrid(); syncHud();
  }
  function layoutGrid() { gridTop = 66 + 112 * u + 18; const gap = 8, avW = W - 28, avH = H - gridTop - 18; tw = (avW - gap * (cols - 1)) / cols; th = Math.min(86 * u + 16, (avH - gap * (rows - 1)) / rows); }
  S.onresize = () => { layout(); layoutGrid(); };
  function rect(i) { const c = i % cols, r = Math.floor(i / cols); return { x: 14 + c * (tw + 8), y: gridTop + r * (th + 8), w: tw, h: th }; }
  function tap(x, y) {
    if (mode !== 'play' || state !== 'play') return;
    for (const tl of tiles) { if (tl.state !== 'idle') continue; const r = rect(tl.i); if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return choose(tl); }
  }
  function choose(tl) {
    const r = rect(tl.i), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (tl.ok) { tl.state = 'ok'; tl.fb = 0; found++; const pts = 100 + streak * 30; score += pts; streak++; parts.push({ txt: '+' + pts, x: cx, y: cy, age: 0, life: 0.9 }); for (let k = 0; k < 10; k++) parts.push({ x: cx, y: cy, vx: rnd(-110, 110), vy: rnd(-150, -20), age: 0, life: rnd(0.4, 0.8), c: '120,240,150', r: rnd(2, 3.5) }); Kit.tone(600 + found * 80, 0.1, 'triangle', 0.2); Kit.vibe(10); syncHud(); if (found >= need) { state = 'clear'; doneT = 0; const bonus = Math.round(left * 15); score += bonus; solved++; parts.push({ txt: 'CLEAR! +' + bonus, x: W / 2, y: H * 0.5, age: 0, life: 1.3 }); Kit.tone(784, 0.12, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); syncHud(); } }
    else { tl.state = 'bad'; tl.fb = 0; strikes++; streak = 0; flash = 0.4; shake = 0.5; parts.push({ txt: tl.trap ? 'Nice try!' : 'Decoy!', x: cx, y: cy, age: 0, life: 0.9 }); Kit.tone(170, 0.35, 'sawtooth', 0.18, -80); Kit.vibe(50); syncHud(); if (strikes >= 3) { state = 'lost'; doneT = 0; } }
  }
  function syncHud() { $('hudL').textContent = 'S' + stage + ' · Msg ' + (((round - 1) % 3) + 1) + '/3'; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '✖'.repeat(strikes) + '◯'.repeat(Math.max(0, 3 - strikes)); }
  function update(dt) {
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; } else p.y -= 28 * dt; }); parts = parts.filter(p => p.age < p.life); flash = Math.max(0, flash - dt * 2); shake = Math.max(0, shake - dt * 2.5);
    tiles.forEach(tl => { tl.fb += dt; });
    if (mode !== 'play') return;
    if (state === 'play') { left -= dt; if (left <= 0) { left = 0; strikes++; streak = 0; flash = 0.5; syncHud(); parts.push({ txt: "Time's up!", x: W / 2, y: H * 0.5, age: 0, life: 1.2 }); Kit.tone(170, 0.4, 'sawtooth', 0.18, -80); state = strikes >= 3 ? 'lost' : 'timeout'; doneT = 0; } }
    else { doneT += dt; if (state === 'clear' && doneT > 1.3) advance(); else if (state === 'timeout' && doneT > 1.8) advance(); else if (state === 'lost' && doneT > 1.4) gameOver(); }
  }
  function advance() { round++; if ((round - 1) % 3 === 0) { stage++; Kit.banner('Stage ' + stage, need >= 4 ? 'Watch for decoys' : 'Bigger board'); } newRound(); }
  function render() {
    const bg = THEMES[(stage - 1) % THEMES.length], g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    if (!hint || mode === 'title') return; ctx.save(); if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, 0);
    const bw = Math.min(W - 24, 360), bx = W / 2 - bw / 2, by = 66, bh = 112 * u; ctx.fillStyle = 'rgba(8,10,20,.92)'; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a52'; ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('MESSAGE FROM HQ', bx + 14, by + 20);
    const fs0 = Math.round(clamp((bw - 110 * u) / (hint.h.length * 0.52), 18, 28)); ctx.fillStyle = '#ffe066'; ctx.font = '700 ' + fs0 + 'px Fredoka, system-ui, sans-serif'; ctx.fillText(hint.h, bx + 14, by + 52 * u + 4);
    ctx.fillStyle = '#e8ecf8'; ctx.font = '700 ' + Math.round(15 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.fillText('Find ' + need + ' · Found ' + found, bx + 14, by + 76 * u + 4);
    const pw = bw - 28 - 70 * u; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(bx + 14, by + 90 * u + 2, pw, 8, 4); ctx.fill(); ctx.fillStyle = left / total < 0.25 ? '#ff5a4a' : '#7dea8a'; ctx.beginPath(); ctx.roundRect(bx + 14, by + 90 * u + 2, Math.max(8, pw * left / total), 8, 4); ctx.fill();
    Heroes.draw(ctx, 'parrot', bx + bw - 40 * u, by + bh - 4, 0.8 * u, { t, bob: t * 3, look: Math.sin(t) });
    tiles.forEach(tl => {
      const r = rect(tl.i); ctx.save(); const pop = tl.state !== 'idle' && tl.fb < 0.25 ? 1 + Math.sin(tl.fb / 0.25 * Math.PI) * 0.08 : 1; ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(pop, pop); ctx.translate(-r.w / 2, -r.h / 2);
      const col = tl.state === 'ok' ? ['#5ae88a', '#1f9a48'] : tl.state === 'bad' ? ['#ff8070', '#c4281c'] : ['#f6f0dc', '#d8ceaa'];
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(2, 4, r.w, r.h, 12); ctx.fill();
      const gg = ctx.createLinearGradient(0, 0, 0, r.h); gg.addColorStop(0, col[0]); gg.addColorStop(1, col[1]); ctx.fillStyle = gg; ctx.strokeStyle = '#14141e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.roundRect(0, 0, r.w, r.h, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tl.state === 'idle' ? '#1a1a24' : '#fff'; let fs = Math.round(clamp(r.w / 7.2, 13, 24)); ctx.font = '700 ' + fs + 'px Fredoka, system-ui, sans-serif'; const label = tl.w.toUpperCase(); while (ctx.measureText(label).width > r.w - 14 && fs > 9) { fs--; ctx.font = '700 ' + fs + 'px Fredoka, system-ui, sans-serif'; } ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, r.w / 2, r.h / 2 - (tl.state === 'idle' ? 0 : 7)); ctx.textBaseline = 'alphabetic';
      if (tl.state !== 'idle') { ctx.font = '700 ' + Math.round(12 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillText(tl.state === 'ok' ? '✔ AGENT' : '✖ DECOY', r.w / 2, r.h / 2 + 16); }
      else if ((state === 'timeout' || state === 'lost') && tl.ok) { ctx.strokeStyle = 'rgba(255,220,80,' + (0.6 + 0.4 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(2, 2, r.w - 4, r.h - 4, 10); ctx.stroke(); }
      ctx.restore();
    });
    ctx.restore();
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(24 * u + 2) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgb(' + p.c + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'Cover blown!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Messages cracked', solved) + row('Stage reached', stage) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'parrot', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { stage = 1; round = 1; score = 0; strikes = 0; streak = 0; solved = 0; parts = []; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRound(); Kit.banner('Stage 1', 'Crack the code'); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => { Kit.ac(); tap(e.clientX, e.clientY); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(); });
  window.__code = { get state() { return { mode, stage, round, score, strikes, found, need, state, hint: hint && hint.h, n: tiles.length, ok: tiles.filter(x => x.ok).map(x => x.i), words: tiles.map(x => x.w) }; }, tapTile(i) { const r = rect(i); tap(r.x + r.w / 2, r.y + r.h / 2); }, setStage(n) { stage = n; round = (n - 1) * 3 + 1; newRound(); } };
})();
