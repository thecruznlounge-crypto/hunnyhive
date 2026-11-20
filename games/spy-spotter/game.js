/* Spy Spotter - one person in the crowd matches the briefing. Arrest them. */
(function () {
  'use strict';
  Kit.ns('spy-spotter');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let W, H, u;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 740); }
  S.onresize = layout; layout();

  const THEMES = [
    { name: 'Market Square', wall: ['#f2c27a', '#d8864a'], floor: ['#b8844a', '#8a5a2c'], deco: 'stalls' },
    { name: 'Casino Lobby', wall: ['#5a1a2e', '#2e0c18'], floor: ['#7a1c2c', '#4a1018'], deco: 'slots' },
    { name: 'Airport Terminal', wall: ['#9ec8e8', '#6a98c0'], floor: ['#c8d0dc', '#9aa4b4'], deco: 'windows' },
    { name: 'Carnival', wall: ['#4a2a7a', '#241048'], floor: ['#8a6a3a', '#5a4020'], deco: 'tents' },
    { name: 'Ski Lodge', wall: ['#cfe6f6', '#8ab4d8'], floor: ['#a8784a', '#7a5028'], deco: 'pines' }
  ];
  const POOL = ['hat:fedora', 'hat:cap', 'hat:beret', 'hat:top', 'hat:cowboy', 'hat:bowler', 'hat:hood', 'glasses:shades', 'glasses:round', 'item:case', 'item:paper', 'item:flower', 'item:umbrella', 'stache:1'];
  const ATTR = { hat: Spy.HATS, glasses: Spy.GLASS, item: Spy.ITEMS };

  let mode = 'title', round = 1, score = 0, lives = 3, t = 0, left = 0, total = 30, crowd = [], traits = [], spy = null, state = 'play', stateT = 0, flash = 0, parts = [], theme = THEMES[0], arrests = 0, streak = 0;
  const best = () => Kit.get('best', 0);

  function applyTrait(p, k) { const [a, b] = k.split(':'); if (a === 'stache') p.stache = true; else p[a] = b; }
  function breakTrait(p, k) { const [a, b] = k.split(':'); if (a === 'stache') p.stache = false; else { const o = ATTR[a].filter(v => v !== b && !(a === 'hat' && v === 'hood' && false)); p[a] = pick(o); } }
  function matches(p) { return traits.every(k => Spy.has(p, k)); }
  function nTraits() { return round <= 2 ? 2 : round <= 5 ? 3 : 4; }
  function newRound() {
    theme = THEMES[Math.floor((round - 1) / 3) % THEMES.length]; state = 'play'; stateT = 0; parts = [];
    const n = nTraits(), cats = {}; traits = [];
    shuffle(POOL.slice()).forEach(k => { const c = k.split(':')[0]; if (traits.length < n && !cats[c + (c === 'hat' ? '' : '')]) { cats[c] = 1; traits.push(k); } });
    if (traits.length < n) shuffle(POOL.slice()).forEach(k => { if (traits.length < n && !traits.includes(k) && !traits.some(x => x.split(':')[0] === k.split(':')[0])) traits.push(k); });
    const N = clamp(8 + round * 2, 8, 30); crowd = [];
    const mk = o => { const p = Spy.make(); Object.assign(p, o || {}); return p; };
    const sp = mk(); traits.forEach(k => applyTrait(sp, k)); sp.spy = true; crowd.push(sp);
    traits.forEach(k => { for (let r = 0; r < (round < 3 ? 1 : 2); r++) { const d = mk(); traits.forEach(x => applyTrait(d, x)); breakTrait(d, k); d.spy = false; crowd.push(d); } });
    while (crowd.length < N) { const d = mk(); if (matches(d)) continue; d.spy = false; crowd.push(d); }
    crowd = crowd.slice(0, Math.max(N, traits.length * 2 + 1));
    const rows = 3 + (N > 18 ? 1 : 0), top = 190 * u + (H > 700 ? 6 : 0), bot = H - 54, rowH = (bot - top) / rows;
    shuffle(crowd).forEach((p, i) => { const r = i % rows; p.row = r; p.y = top + rowH * (r + 0.9) + rnd(-6, 6); p.sc = (0.72 + r * 0.18) * u * (rows > 3 ? 0.9 : 1); p.x = rnd(30, W - 30); p.vx = (Math.random() < 0.2 ? 0 : rnd(14, 38)) * (Math.random() < 0.5 ? -1 : 1) * u * (1 + r * 0.25) * (1 + round * 0.04); p.walk = rnd(0, 6); p.look = rnd(-1, 1); p.mood = 'neutral'; p.hit = 0; });
    total = Math.max(14, 30 - round * 1.1); left = total; syncHud();
    Kit.banner('Case ' + round, theme.name);
  }
  function syncHud() { $('hudL').textContent = 'Case ' + round; $('hudC').textContent = score.toLocaleString(); $('hudR').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)); }

  function tap(x, y) {
    if (mode !== 'play' || state !== 'play') return;
    const order = crowd.slice().sort((a, b) => b.y - a.y);
    for (const p of order) { const h = 108 * p.sc; if (Math.abs(x - p.x) < 18 * p.sc + 6 && y > p.y - h && y < p.y + 6) return accuse(p); }
  }
  function accuse(p) {
    if (p.spy) {
      state = 'won'; stateT = 0; const bonus = Math.round(left * 12); score += 500 + bonus + streak * 100; streak++; arrests++; p.mood = 'scared'; flash = 0.6;
      for (let i = 0; i < 26; i++) parts.push({ x: p.x, y: p.y - 60 * p.sc, vx: rnd(-130, 130), vy: rnd(-200, -30), age: 0, life: rnd(0.5, 1.1), c: pick(['255,207,74', '255,106,82', '120,230,160']), r: rnd(2, 4) });
      parts.push({ txt: 'ARRESTED! +' + (500 + bonus), x: p.x, y: p.y - 120 * p.sc, age: 0, life: 1.4 });
      Kit.tone(523, 0.1, 'triangle', 0.22); Kit.tone(784, 0.12, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.1 : 0); Kit.tone(1046, 0.3, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.2 : 0); Kit.vibe(20); syncHud();
    } else {
      p.hit = 1; p.mood = 'angry'; lives--; streak = 0; left = Math.max(0, left - 4); flash = 0.4; parts.push({ txt: 'Innocent!', x: p.x, y: p.y - 120 * p.sc, age: 0, life: 1.1 });
      Kit.tone(200, 0.35, 'sawtooth', 0.16, -100); Kit.vibe(50); syncHud(); if (lives <= 0) { state = 'lost'; stateT = 0; }
    }
  }
  function update(dt) {
    if (mode !== 'play' && mode !== 'over') return;
    crowd.forEach(p => { if (state === 'won' && !p.spy) { p.vx *= 0.9; } p.x += p.vx * dt; if (p.x < -30) p.x = W + 30; if (p.x > W + 30) p.x = -30; p.walk += Math.abs(p.vx) * dt * 0.07; p.hit = Math.max(0, p.hit - dt * 0.8); if (Math.random() < dt * 0.4) p.look = rnd(-1, 1); if (p.hit <= 0 && p.mood === 'angry') p.mood = 'neutral'; });
    if (mode === 'play') {
      if (state === 'play') { left -= dt; if (left <= 0) { left = 0; lives--; streak = 0; syncHud(); parts.push({ txt: 'Time up!', x: W / 2, y: H / 2, age: 0, life: 1.2 }); state = lives <= 0 ? 'lost' : 'missed'; stateT = 0; Kit.tone(180, 0.5, 'sawtooth', 0.16, -90); } }
      else { stateT += dt; if (state === 'won' && stateT > 1.5) { round++; newRound(); } else if (state === 'missed' && stateT > 1.8) { round++; newRound(); } else if (state === 'lost' && stateT > 1.4) gameOver(); }
    }
    flash = Math.max(0, flash - dt * 2);
    parts.forEach(p => { p.age += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; } else p.y -= 26 * dt; }); parts = parts.filter(p => p.age < p.life);
    $('crowdFill').style.width = (left / total * 100) + '%';
  }

  function drawBg() {
    const hz = 150 * u + 70; const g = ctx.createLinearGradient(0, 0, 0, hz + 40); g.addColorStop(0, theme.wall[0]); g.addColorStop(1, theme.wall[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const dk = theme.deco, by = hz + 20 * u;
    if (dk === 'stalls') for (let i = 0; i < 4; i++) { const x = i * W / 3.5 - 10; ctx.fillStyle = ['#e8433a', '#3a8ae8', '#2fae4c', '#ffcf4a'][i]; ctx.fillRect(x, by - 74 * u, 90 * u, 14 * u); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x, by - 60 * u, 90 * u, 60 * u); for (let s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? '#fff' : ctx.fillStyle; } ctx.fillStyle = '#fff'; for (let s = 0; s < 5; s++) ctx.fillRect(x + s * 18 * u + 2, by - 74 * u, 8 * u, 14 * u); }
    else if (dk === 'slots') for (let i = 0; i < 5; i++) { const x = i * W / 4.4 + 6; ctx.fillStyle = '#d8a84a'; ctx.beginPath(); ctx.roundRect(x, by - 80 * u, 54 * u, 80 * u, 6); ctx.fill(); ctx.fillStyle = '#1a0a10'; ctx.fillRect(x + 6 * u, by - 70 * u, 42 * u, 24 * u); ctx.fillStyle = ['#ff4a4a', '#4aff8a', '#ffcf4a'][i % 3]; for (let s = 0; s < 3; s++) ctx.fillRect(x + 9 * u + s * 13 * u, by - 64 * u, 9 * u, 12 * u); ctx.fillStyle = 'rgba(255,230,120,' + (0.5 + 0.5 * Math.sin(t * 4 + i)) + ')'; ctx.beginPath(); ctx.arc(x + 27 * u, by - 86 * u, 4, 0, TAU); ctx.fill(); }
    else if (dk === 'windows') for (let i = 0; i < 4; i++) { const x = i * W / 3.8 + 10; ctx.fillStyle = '#cfe8ff'; ctx.fillRect(x, by - 100 * u, 70 * u, 90 * u); ctx.fillStyle = '#7ab0e8'; ctx.fillRect(x, by - 100 * u, 70 * u, 40 * u); ctx.strokeStyle = '#5a6a80'; ctx.lineWidth = 3; ctx.strokeRect(x, by - 100 * u, 70 * u, 90 * u); const px = ((t * 20 + i * 70) % (W + 80)) - 40; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px, by - 60 * u, 18, 5, 0, 0, TAU); ctx.fill(); }
    else if (dk === 'tents') for (let i = 0; i < 3; i++) { const x = i * W / 2.4 + 30; ctx.fillStyle = ['#e8433a', '#ffcf4a', '#3a8ae8'][i]; ctx.beginPath(); ctx.moveTo(x - 50 * u, by); ctx.lineTo(x, by - 90 * u); ctx.lineTo(x + 50 * u, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(x, by - 90 * u); ctx.lineTo(x - 14 * u, by); ctx.lineTo(x + 14 * u, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,240,150,' + (0.5 + 0.5 * Math.sin(t * 3 + i)) + ')'; ctx.beginPath(); ctx.arc(x, by - 94 * u, 5, 0, TAU); ctx.fill(); }
    else for (let i = 0; i < 7; i++) { const x = i * W / 6.5, hh = (70 + (i % 3) * 22) * u; ctx.fillStyle = i % 2 ? '#2a6a4a' : '#1f5a3a'; ctx.beginPath(); ctx.moveTo(x - 28 * u, by); ctx.lineTo(x, by - hh); ctx.lineTo(x + 28 * u, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 10 * u, by - hh * 0.7); ctx.lineTo(x, by - hh); ctx.lineTo(x + 10 * u, by - hh * 0.7); ctx.closePath(); ctx.fill(); }
    const fg = ctx.createLinearGradient(0, by, 0, H); fg.addColorStop(0, theme.floor[0]); fg.addColorStop(1, theme.floor[1]); ctx.fillStyle = fg; ctx.fillRect(0, by, W, H - by);
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; for (let i = -6; i < 14; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + (i - 4) * 20, by); ctx.lineTo(W / 2 + (i - 4) * 90, H); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, by, W, 6);
  }
  function drawBrief() {
    const w = Math.min(W - 24, 360), x = W / 2 - w / 2, y = 70 * 1, h = 100 * u + 4;
    ctx.fillStyle = 'rgba(8,10,20,.88)'; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a52'; ctx.font = '700 ' + Math.round(13 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('TOP SECRET BRIEFING', x + 14, y + 20 * u + 2);
    const n = traits.length, cw = (w - 20) / n;
    traits.forEach((k, i) => { const cx = x + 10 + cw * (i + 0.5); ctx.save(); ctx.beginPath(); ctx.arc(cx, y + 52 * u + 4, 22 * u, 0, TAU); ctx.fillStyle = '#e8ecf8'; ctx.fill(); ctx.clip(); Spy.traitIcon(ctx, k, cx, y + 56 * u + 4, 1.0 * u); ctx.restore(); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, y + 52 * u + 4, 22 * u, 0, TAU); ctx.stroke(); ctx.fillStyle = '#e8ecf8'; ctx.font = '700 ' + Math.round(11 * u + 1) + 'px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Spy.traitLabel(k).replace('carries ', '').replace('holds ', '').replace('wears ', '').replace('has ', ''), cx, y + 86 * u + 8); });
  }
  function render() {
    if (!crowd.length || mode === 'title') { ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H); return; }
    drawBg();
    crowd.slice().sort((a, b) => a.y - b.y).forEach(p => {
      Spy.person(ctx, p, p.x, p.y, p.sc, { walk: p.vx ? p.walk : 0, flip: p.vx < 0, look: p.look, mood: p.mood });
      if (p.hit > 0) { ctx.globalAlpha = Math.min(1, p.hit * 2); ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 5; const cx = p.x, cy = p.y - 60 * p.sc, r = 14 * p.sc; ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke(); ctx.globalAlpha = 1; }
      if ((state === 'won' || state === 'missed' || state === 'lost') && p.spy) { ctx.strokeStyle = 'rgba(255,230,90,' + (0.6 + 0.4 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y - 52 * p.sc, 34 * p.sc, 62 * p.sc, 0, 0, TAU); ctx.stroke(); }
    });
    parts.forEach(p => { const k = 1 - p.age / p.life; if (p.txt) { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = '700 ' + Math.round(24 * u + 4) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#ffe066'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; } else { ctx.globalAlpha = k; ctx.fillStyle = 'rgb(' + p.c + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    drawBrief();
    if (flash > 0) { ctx.fillStyle = (state === 'won' ? 'rgba(255,240,150,' : 'rgba(255,60,60,') + flash * 0.35 + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function gameOver() {
    mode = 'over'; const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = nb ? 'New best!' : 'The spy escaped!';
    $('resStats').innerHTML = row('Score', score.toLocaleString(), nb) + row('Spies arrested', arrests) + row('Best', Math.max(score, best()).toLocaleString());
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1); c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); Heroes.draw(g, 'owl', cw / 2, ch - 8, Math.min(cw / 130, ch / 125), {});
    Kit.show('over');
  }
  function start() { round = 1; score = 0; lives = 3; streak = 0; arrests = 0; mode = 'play'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRound(); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', start); $('btnAgain').addEventListener('click', start); $('btnRestart').addEventListener('click', start); $('btnMenu').addEventListener('click', toMenu);
  $('game').addEventListener('pointerdown', e => { Kit.ac(); tap(e.clientX, e.clientY); });
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(dt); render(); });
  window.__spot = { get state() { return { mode, round, score, lives, state, n: crowd.length, traits, spy: spy }; }, setRound(n) { round = n; newRound(); }, spyPos() { const p = crowd.find(c => c.spy); return { x: p.x, y: p.y - 40 * p.sc }; }, decoyPos() { const p = crowd.find(c => !c.spy); return { x: p.x, y: p.y - 40 * p.sc }; } };
})();
