/* Straw Carry - the straw that broke the camel's back.
   You and a rival merchant take turns adding 1-3 straws. The camel's limit is hidden. Whoever breaks it loses. */
(function () {
  'use strict';
  Kit.ns('straw-carry');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));

  let W, H, u, gy, cx, sc;
  function layout() { W = S.W; H = S.H; u = Math.min(W / 390, H / 720); gy = H * 0.64; cx = W / 2; sc = Math.min(W * 0.62 / 150, H * 0.36 / 135, 2.3); }
  S.onresize = layout; layout();

  /* ---------------- straw pile slots (local camel coordinates) ---------------- */
  const SLOTS = [];
  (function () {
    let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const caps = [6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2];
    let l = 0, j = 0;
    for (let i = 0; i < 80; i++) {
      const cap = caps[Math.min(l, caps.length - 1)];
      SLOTS.push({ x: (j - (cap - 1) / 2) * 11 + (r() - 0.5) * 5, y: -l * 6.2 - 2, a: (r() - 0.5) * 0.5, col: ['#ecc95f', '#d9a93e', '#f2d77f', '#c99a30'][Math.floor(r() * 4)], len: 30 + r() * 8 });
      j++; if (j >= cap) { j = 0; l++; }
    }
  })();

  /* ---------------- state ---------------- */
  let mode = 'title', t = 0, state = 'idle', L = 20, n = 0, noise = [], wins = 0, round = 0, starter = 'player', queue = [], falling = [], relT = 0, thinkT = 0, dropActor = 'player';
  let strainVis = 0, collapse = 0, loser = null, shake = 0, parts = [], bubble = null, bubbleT = 0, toss = { player: 0, ai: 0 }, blinkT = 0, overT = 0, lastCreak = 0, label = '';

  const bestStreak = () => Kit.get('best', 0);
  const cue = k => clamp(k / L + (noise[k] || 0), 0, 1.15);
  const cueNow = () => cue(n);

  function newRound() {
    round++; { const ti = Math.floor((round - 1) / 2), pt = Math.floor((round - 2) / 2); if (round > 1 && ti !== pt) Kit.banner('Stage ' + (ti + 1), TH().name); }
    L = rint(14 + Math.min(round, 10), 24 + Math.min(round * 2, 26));
    noise = []; for (let i = 0; i <= 60; i++) noise[i] = gauss() * 0.055;
    n = 0; queue = []; falling = []; parts = []; collapse = 0; loser = null; strainVis = 0; bubble = null;
    state = starter === 'player' ? 'idle' : 'think'; thinkT = 1.0;
    setButtons();
    $('hudL').textContent = 'S' + (Math.floor((round - 1) / 2) + 1) + ' \u00B7 Camel ' + round; syncHud();
    Kit.banner(starter === 'player' ? 'Your turn' : 'Rival starts', null);
  }
  function syncHud() { $('hudC').textContent = n + (n === 1 ? ' straw' : ' straws'); $('hudR').textContent = wins ? 'Streak ' + wins : ''; }
  function setButtons() { const ok = mode === 'play' && state === 'idle'; ['b1', 'b2', 'b3'].forEach(id => { $(id).disabled = !ok; }); }

  function say(txt, who) { bubble = { txt, who }; bubbleT = 1.8; }
  function startDrop(k, actor) {
    state = 'drop'; dropActor = actor; queue = []; for (let i = 0; i < k; i++) queue.push(actor); relT = 0; toss[actor] = 1; setButtons();
    if (actor === 'ai') say('+' + k, 'ai');
  }

  /* ---------------- AI rival ---------------- */
  function aiMove() {
    const c = Math.max(0.16, cueNow());
    const Lhat = Math.max(n + 1, n / c);
    const sig = Math.max(2.2, Lhat * (0.17 - Math.min(0.08, wins * 0.012)));
    const risk = k => 1 - Phi((n + k - 0.5 - Lhat) / sig);   // chance that n+k exceeds the limit
    const tol = 0.1 + Math.random() * 0.12;
    let k = 1;
    for (let j = 3; j >= 1; j--) if (risk(j) < tol) { k = j; break; }
    if (Math.random() < 0.12) k = rint(1, 3);
    startDrop(k, 'ai');
  }

  /* ---------------- play ---------------- */
  function playerPick(k) { if (mode !== 'play' || state !== 'idle') return; Kit.ac(); startDrop(k, 'player'); Kit.tone(420 + k * 60, 0.1, 'triangle', 0.14, 120); }
  [1, 2, 3].forEach(k => $('b' + k).addEventListener('click', () => playerPick(k)));
  addEventListener('keydown', e => { if (e.key >= '1' && e.key <= '3') playerPick(+e.key); else if (e.key === 'Escape' || e.key === 'p') (mode === 'play' ? pause() : mode === 'pause' ? resume() : 0); });

  function landed(f) {
    n++; syncHud(); shake = Math.max(shake, 0.15);
    const c = cue(n);
    if (n > L) return breakCamel(f.actor);
    Kit.tone(200 + Math.random() * 40, 0.06, 'triangle', 0.12); Kit.noise(0.05, 0.08, null, 2500);
    if (Math.random() < sstep(0.45, 1, c) + 0.1) { const lo = 140 - c * 70 + rnd(-10, 10); Kit.tone(lo, 0.35, 'sawtooth', 0.035 + c * 0.07, -30 - c * 35); }
    if (c > 0.82) { Kit.tone(90 + Math.random() * 20, 0.5, 'sine', 0.12, -25); }
    for (let i = 0; i < 5; i++) parts.push({ x: rnd(-18, 18), y: rnd(-6, 0), vx: rnd(-30, 30), vy: rnd(-30, -10), life: 0.5, age: 0, kind: 'dust' });
  }
  function breakCamel(actor) {
    state = 'broke'; loser = actor; collapse = 0; queue = []; shake = 1; Kit.vibe(80);
    Kit.noise(0.5, 0.3, null, 300); Kit.tone(140, 0.7, 'sawtooth', 0.25, -110); Kit.tone(80, 0.9, 'sine', 0.3, -40);
    for (let i = 0; i < 40; i++) parts.push({ x: rnd(-30, 30), y: -112 - rnd(0, 30), vx: rnd(-220, 220), vy: rnd(-380, -100), life: rnd(0.9, 1.6), age: 0, kind: 'straw', a: rnd(0, TAU), va: rnd(-8, 8) });
    Kit.banner('CRACK!', loser === 'player' ? 'You added the last straw' : 'Rival added the last straw');
    overT = 2.4;
  }

  function endRound() {
    mode = 'over';
    const won = loser === 'ai';
    if (won) { wins++; if (wins > bestStreak()) Kit.set('best', wins); Kit.tone(660, 0.15, 'triangle', 0.2); Kit.tone(880, 0.3, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.12 : 0); }
    $('hud').classList.remove('show');
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resTitle').textContent = won ? 'The rival broke it!' : 'Back broken!';
    $('resStats').innerHTML = row('Camel limit', L + ' straws') + row('Straws loaded', n) + row('Win streak', wins, won) + row('Best streak', Math.max(bestStreak(), wins));
    $('btnAgain').textContent = won ? 'Next camel' : 'Try again';
    const c = $('resPortrait'), cw = c.clientWidth || 150, ch = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = cw * dpr; c.height = ch * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    Desert.camel(g, cw / 2, ch - 8, Math.min(cw / 160, ch / 140), { t: 0, mood: won ? 'win' : 'dizzy', idle: false, tilt: won ? 0 : 0.1, sy: won ? 1 : 0.85 });
    if (!won) wins = 0;
    Kit.show('over');
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    if (mode !== 'play') return;
    blinkT -= dt; if (blinkT < -0.14) blinkT = rnd(1.8, 4);
    toss.player = Math.max(0, toss.player - dt * 3); toss.ai = Math.max(0, toss.ai - dt * 3);
    bubbleT = Math.max(0, bubbleT - dt); if (!bubbleT) bubble = null;
    const target = state === 'broke' ? 0.2 : sstep(0.3, 1.0, cueNow());
    strainVis += (target - strainVis) * Math.min(1, dt * 3.5);
    if (state === 'drop') {
      relT -= dt;
      if (queue.length && relT <= 0) { const actor = queue.shift(); falling.push({ i: n + falling.length, t: 0, actor, x0: rnd(-40, 40), spin: rnd(-6, 6) }); relT = 0.36; }
      for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.t += dt; if (f.t >= 0.3) { falling.splice(i, 1); landed(f); if (state === 'broke') { falling = []; break; } } }
      if (state === 'drop' && !queue.length && !falling.length) {
        if (dropActor === 'player') { state = 'think'; thinkT = rnd(0.9, 1.7); const talk = ['Hmm...', 'Easy now...', 'Let me see...', 'Okay...']; say(talk[rint(0, 3)], 'ai'); }
        else { state = 'idle'; setButtons(); }
      }
    } else if (state === 'think') {
      thinkT -= dt; if (thinkT <= 0) aiMove();
    } else if (state === 'broke') {
      collapse = Math.min(1, collapse + dt * 2.2); overT -= dt; if (overT <= 0 && mode === 'play') endRound();
    }
    shake = Math.max(0, shake - dt * 3);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'dust' ? 0 : 700) * dt; if (p.a != null) p.a += p.va * dt; }
    syncHud();
  }

  /* ---------------- rendering ---------------- */
  const THEMES = [
    { name: 'Sunset Bazaar', g: ['#5a3a8c', '#e0658a', '#ffae5a', '#ffe0a0'], d1: '#d98a4a', d2: '#e8a45e', g1: '#f2c27a', g2: '#c98a45', deco: 'bazaar', night: false },
    { name: 'Red Canyon', g: ['#2a5aa8', '#d8845a', '#ffc080', '#ffe6b0'], d1: '#b8603a', d2: '#d8804a', g1: '#e8a066', g2: '#b8683a', deco: 'mesa', night: false },
    { name: 'Oasis Dawn', g: ['#2a8fd0', '#8ad8e8', '#ffe8a8', '#fff2c8'], d1: '#d8b070', d2: '#e8c488', g1: '#f2d490', g2: '#d0a460', deco: 'oasis', night: false },
    { name: 'Pyramid Night', g: ['#080a30', '#2a2060', '#7a3a7a', '#c8785a'], d1: '#6a4a5a', d2: '#8a5a5a', g1: '#a8705a', g2: '#6a4a48', deco: 'pyramid', night: true },
    { name: 'Moonlit Caravan', g: ['#0a1040', '#1c2a70', '#3a4a98', '#6a78b8'], d1: '#38407a', d2: '#4a5498', g1: '#5a68a8', g2: '#3a4478', deco: 'caravan', night: true }
  ];
  const TH = () => THEMES[(Math.floor((Math.max(1, round) - 1) / 2)) % THEMES.length];
  function sky() {
    const th = TH(), g = ctx.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, th.g[0]); g.addColorStop(0.35, th.g[1]); g.addColorStop(0.7, th.g[2]); g.addColorStop(1, th.g[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (th.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + i)); ctx.fillRect((i * 97) % W, (i * 53) % (gy * 0.8), 2, 2); } ctx.globalAlpha = 1; }
    const sx = W * 0.72, sy = gy - 90 * u;
    const rg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 200 * u); rg.addColorStop(0, th.night ? 'rgba(210,220,255,.7)' : 'rgba(255,250,200,.95)'); rg.addColorStop(0.3, th.night ? 'rgba(150,170,255,.25)' : 'rgba(255,220,140,.5)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.night ? '#eef0ff' : '#fff6d0'; ctx.beginPath(); ctx.arc(sx, sy, 46 * u, 0, TAU); ctx.fill();
    const dune = (col, base, amp, ph, sp) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, base + Math.sin(x * sp + ph) * amp + Math.sin(x * sp * 2.3 + ph) * amp * 0.3); ctx.lineTo(W, H); ctx.fill(); };
    const by = gy - 40 * u;
    if (th.deco === 'mesa') { ctx.fillStyle = '#9a4a2a'; [[0.1, 90, 70], [0.3, 60, 50], [0.82, 110, 80]].forEach(([x, h, w]) => { ctx.beginPath(); ctx.moveTo(W * x - w * u, by + 10); ctx.lineTo(W * x - w * u * 0.8, by - h * u); ctx.lineTo(W * x + w * u * 0.8, by - h * u); ctx.lineTo(W * x + w * u, by + 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(W * x - w * u * 0.8, by - h * u, w * u * 0.5, h * u); ctx.fillStyle = '#9a4a2a'; }); }
    if (th.deco === 'pyramid') { ctx.fillStyle = '#5a3a58'; [[0.18, 120], [0.34, 80]].forEach(([x, h]) => { ctx.beginPath(); ctx.moveTo(W * x - h * u, by + 8); ctx.lineTo(W * x, by - h * u); ctx.lineTo(W * x + h * u, by + 8); ctx.fill(); }); }
    dune(th.d1, by, 24 * u, 1, 0.012);
    if (th.deco === 'bazaar') { [[0.14, '#e0455a'], [0.3, '#2a9ad8'], [0.46, '#f0b030']].forEach(([x, c], i) => { const tx = W * x, ty = by + 6 * u; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(tx - 22 * u, ty - 4 * u, 44 * u, 8 * u); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(tx - 28 * u, ty - 22 * u); ctx.lineTo(tx, ty - 44 * u); ctx.lineTo(tx + 28 * u, ty - 22 * u); ctx.fill(); ctx.fillStyle = '#fff3d8'; ctx.fillRect(tx - 22 * u, ty - 22 * u, 44 * u, 22 * u); }); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.14, by - 30 * u); for (let i = 1; i <= 10; i++) ctx.lineTo(W * (0.14 + 0.32 * i / 10), by - 30 * u + Math.sin(i * Math.PI) * 6 * u + 8 * u * Math.sin(i / 10 * Math.PI)); ctx.stroke(); }
    if (th.deco === 'oasis') { ctx.fillStyle = '#4cb8e8'; ctx.beginPath(); ctx.ellipse(W * 0.26, by + 14 * u, 70 * u, 12 * u, 0, 0, TAU); ctx.fill(); [0.1, 0.4].forEach((x, k) => { const px = W * x, py = by + 12 * u; ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 12 * u, py - 40 * u, px + 5 * u, py - 82 * u); ctx.stroke(); for (let i = 0; i < 6; i++) { const a2 = -Math.PI / 2 + (i - 2.5) * 0.6; ctx.strokeStyle = i % 2 ? '#2f8a44' : '#43a85a'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(px + 5 * u, py - 82 * u); ctx.quadraticCurveTo(px + 5 * u + Math.cos(a2) * 26 * u, py - 82 * u + Math.sin(a2) * 22 * u - 6 * u, px + 5 * u + Math.cos(a2) * 38 * u, py - 76 * u + Math.sin(a2) * 22 * u + 12 * u); ctx.stroke(); } }); }
    if (th.deco === 'caravan') { ctx.fillStyle = '#10143a'; for (let i = 0; i < 4; i++) { const cx2 = W * (0.1 + i * 0.12) , cy2 = by + 2 * u; ctx.beginPath(); ctx.ellipse(cx2, cy2 - 10 * u, 14 * u, 7 * u, 0, 0, TAU); ctx.fill(); ctx.fillRect(cx2 - 11 * u, cy2 - 8 * u, 3 * u, 12 * u); ctx.fillRect(cx2 + 8 * u, cy2 - 8 * u, 3 * u, 12 * u); ctx.beginPath(); ctx.arc(cx2 + 14 * u, cy2 - 20 * u, 4 * u, 0, TAU); ctx.fill(); } }
    dune(th.d2, gy - 12 * u, 18 * u, 3, 0.017);
    const gg = ctx.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, th.g1); gg.addColorStop(1, th.g2); ctx.fillStyle = gg; ctx.fillRect(0, gy + 6, W, H - gy);
    ctx.fillStyle = 'rgba(120,70,20,.15)'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 83) % W, gy + 14 + ((i * 47) % (H - gy - 20)), 14, 2);
  }
  function straw(c, x, y, a, col, len, th) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.strokeStyle = 'rgba(90,50,10,.35)'; c.lineWidth = th + 1.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-len / 2, 1); c.lineTo(len / 2, 1); c.stroke();
    c.strokeStyle = col; c.lineWidth = th; c.beginPath(); c.moveTo(-len / 2, 0); c.lineTo(len / 2, 0); c.stroke();
    c.strokeStyle = 'rgba(255,245,200,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-len / 2 + 2, -th * 0.25); c.lineTo(len / 2 - 3, -th * 0.25); c.stroke();
    c.strokeStyle = '#8a5a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-len * 0.08, -th / 2); c.lineTo(-len * 0.08, th / 2); c.stroke();
    c.restore();
  }
  function merchant(x, y, s, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(80,40,10,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 7, 0, 0, TAU); ctx.fill();
    const lift = o.lift || 0, bob = o.active ? Math.sin(t * 5) * 2 : 0;
    ctx.translate(0, bob);
    /* robe */
    ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(-22, -4); ctx.quadraticCurveTo(-26, -52, -12, -62); ctx.lineTo(12, -62); ctx.quadraticCurveTo(26, -52, 22, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-4, -60, 8, 56);
    ctx.fillStyle = o.sash; ctx.fillRect(-23, -34, 46, 7);
    /* arm tossing */
    ctx.strokeStyle = o.robe; ctx.lineWidth = 9; ctx.lineCap = 'round'; const dir = o.flip ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(dir * 14, -54); ctx.lineTo(dir * (26 + lift * 14), -44 - lift * 38); ctx.stroke();
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(dir * (28 + lift * 14), -44 - lift * 40, 5.5, 0, TAU); ctx.fill();
    if (lift > 0.1) straw(ctx, dir * (28 + lift * 14), -52 - lift * 40, -0.3 * dir, '#ecc95f', 26, 5);
    /* head */
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(0, -78, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = o.turban; ctx.beginPath(); ctx.ellipse(0, -90, 20, 12, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-20, -92, 40, 8);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18, -94); ctx.quadraticCurveTo(0, -84, 18, -93); ctx.stroke();
    ctx.fillStyle = o.gem; ctx.beginPath(); ctx.arc(0, -92, 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -80, 3.6, 0, TAU); ctx.arc(6, -80, 3.6, 0, TAU); ctx.fill();
    const look = o.look || 0; ctx.fillStyle = '#2a1608'; ctx.beginPath(); ctx.arc(-6 + look * 1.5, -80, 1.9, 0, TAU); ctx.arc(6 + look * 1.5, -80, 1.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, -72); ctx.quadraticCurveTo(0, -68, 9, -72); ctx.stroke();
    if (o.mood === 'sad') { ctx.beginPath(); ctx.arc(0, -66, 4, Math.PI, TAU); ctx.stroke(); } else { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -68, 4, 0.1, Math.PI - 0.1); ctx.stroke(); }
    ctx.restore();
  }
  function bubbleDraw(x, y, txt) {
    ctx.save(); ctx.font = '700 ' + Math.round(17 * u) + 'px Fredoka, system-ui, sans-serif'; const w = ctx.measureText(txt).width + 22 * u, h = 30 * u;
    const bx = clamp(x - w / 2, 6, W - w - 6), by = y - h;
    ctx.fillStyle = '#fff6df'; ctx.strokeStyle = '#7a300c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, by + h - 1); ctx.lineTo(x, by + h + 9 * u); ctx.lineTo(x + 8, by + h - 1); ctx.fillStyle = '#fff6df'; ctx.fill();
    ctx.fillStyle = '#4a2a12'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + w / 2, by + h / 2 + 1); ctx.restore();
  }
  function label_() {
    const c = cueNow();
    return n === 0 ? 'Fresh and ready' : c < 0.4 ? 'Strolling along' : c < 0.6 ? 'Feeling it a bit' : c < 0.76 ? 'Wobbling' : c < 0.9 ? 'Groaning...' : 'Creaking badly!';
  }

  function render(dt) {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 4);
    sky();
    if (mode === 'title') { ctx.restore(); return; }
    const c = cueNow(), trem = state === 'broke' ? 0 : sstep(0.55, 1, c) * 2.4 * sc * (state === 'idle' || state === 'think' ? 1 : 1.2);
    const jx = Math.sin(t * 47) * trem, jy = Math.cos(t * 39) * trem * 0.5;
    ctx.fillStyle = 'rgba(80,40,10,.28)'; ctx.beginPath(); ctx.ellipse(cx, gy + 4, 74 * sc, 9 * sc, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx + jx, gy + jy); ctx.scale(sc, sc);
    const collapsed = state === 'broke';
    Desert.camel(ctx, 0, 0, 1, { t, walk: collapsed ? 0 : (1 - sstep(0.2, 0.7, c)) * 0.5, strain: strainVis, mood: collapsed ? 'dizzy' : c > 0.82 ? 'scared' : 'neutral', blink: blinkT < 0, blanket: '#c2301f', tilt: collapsed ? 0.2 * collapse : 0, sy: collapsed ? 1 - 0.3 * collapse : 1, sx: collapsed ? 1 + 0.1 * collapse : 1, idle: false, hump: strainVis });
    /* straw pile */
    const sq = strainVis * 14 * 0.9, shown = Math.min(n, SLOTS.length);
    const base = -98 + sq;
    ctx.save(); ctx.translate(-10, base); if (collapsed) { ctx.rotate(0.2 * collapse); ctx.translate(0, 30 * collapse); }
    for (let i = 0; i < shown; i++) { if (collapsed && collapse > 0.15 && i > shown * (1 - collapse)) continue; const sl = SLOTS[i]; straw(ctx, sl.x, sl.y, sl.a, sl.col, sl.len, 5); }
    ctx.restore();
    /* falling straws */
    falling.forEach(f => {
      const k = clamp(f.t / 0.3, 0, 1), idx = Math.min(f.i, SLOTS.length - 1), sl = SLOTS[idx], y0 = -330, e = k * k;
      straw(ctx, -10 + sl.x + f.x0 * (1 - e), base + sl.y + (y0 - sl.y) * (1 - e) * -1 * -1 - 0, sl.a + f.spin * (1 - e), sl.col, sl.len, 5);
    });
    parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); if (p.kind === 'straw') straw(ctx, p.x, p.y, p.a, '#ecc95f', 30, 5); else { ctx.fillStyle = 'rgba(255,230,180,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y + base + 10, 3, 0, TAU); ctx.fill(); } }); ctx.globalAlpha = 1;
    ctx.restore();
    /* merchants */
    const pAct = state === 'idle' || (state === 'drop' && dropActor === 'player'), aAct = state === 'think' || (state === 'drop' && dropActor === 'ai');
    merchant(W * 0.13, gy + 6, 1.15 * u, { robe: '#c2301f', sash: '#ffcf6a', skin: '#e0a070', turban: '#fff1d6', gem: '#e5383b', lift: toss.player, active: pAct, mood: collapsed && loser === 'player' ? 'sad' : '', look: 1 });
    merchant(W * 0.87, gy + 6, 1.15 * u, { robe: '#2c5aa0', sash: '#d0e8ff', skin: '#c88a5a', turban: '#4a2a6a', gem: '#ffcf6a', flip: true, lift: toss.ai, active: aAct, mood: collapsed && loser === 'ai' ? 'sad' : '', look: -1 });
    /* turn marker */
    if (state === 'idle' || state === 'think') {
      const mx = state === 'idle' ? W * 0.13 : W * 0.87;
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); const yy = gy - 150 * u + Math.sin(t * 6) * 4; ctx.moveTo(mx - 10, yy); ctx.lineTo(mx + 10, yy); ctx.lineTo(mx, yy + 14); ctx.closePath(); ctx.fill();
    }
    if (bubble) bubbleDraw(bubble.who === 'ai' ? W * 0.87 : W * 0.13, gy - 150 * u - 6, bubble.txt);
    /* camel status */
    ctx.font = '700 ' + Math.round(19 * u) + 'px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(70,25,5,.6)'; ctx.fillStyle = c > 0.76 ? '#ffe0a0' : '#fff6df';
    const lab = state === 'broke' ? '' : label_(), ly = gy + 70 * u + 26;
    ctx.strokeText(lab, cx, ly); ctx.fillText(lab, cx, ly);
    /* prompt */
    const pr = state === 'idle' ? 'Your move: add 1, 2 or 3 straws' : state === 'think' ? 'Rival is thinking...' : '';
    ctx.font = '700 ' + Math.round(16 * u) + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#fff1d6'; ctx.strokeStyle = 'rgba(70,25,5,.6)'; ctx.lineWidth = 4; ctx.strokeText(pr, cx, H - 112 * u - 12); ctx.fillText(pr, cx, H - 112 * u - 12);
    ctx.restore();
  }

  /* title art */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const s = Math.min(w / 190, h / 160), k = Math.floor((t * 2.2) % 14);
    c.fillStyle = 'rgba(80,40,10,.25)'; c.beginPath(); c.ellipse(w / 2, h - 5, 70 * s, 8 * s, 0, 0, TAU); c.fill();
    c.save(); c.translate(w / 2, h - 8); c.scale(s, s); Desert.camel(c, 0, 0, 1, { t, walk: 0.7, strain: k / 20, mood: k > 11 ? 'scared' : 'neutral', blanket: '#c2301f', idle: false });
    c.translate(-10, -98 + k * 0.7); for (let i = 0; i < k; i++) { const sl = SLOTS[i]; straw(c, sl.x, sl.y, sl.a, sl.col, sl.len, 5); } c.restore();
  }

  /* ---------------- flow ---------------- */
  function start(keepStreak) {
    if (!keepStreak) wins = 0, round = 0;
    mode = 'play'; starter = round % 2 ? 'player' : 'ai'; Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac(); newRound();
  }
  function pause() { if (mode !== 'play' || state === 'broke') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); setButtons(); } }
  function toMenu() { mode = 'title'; $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', () => start(false));
  $('btnAgain').addEventListener('click', () => start(wins > 0));
  $('btnRestart').addEventListener('click', () => { mode = 'play'; start(false); });
  $('btnMenu').addEventListener('click', toMenu);
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); update(dt); render(dt); drawTitleArt(); });

  window.__straw = { setRound(r) { round = r - 1; newRound(); }, get state() { return { mode, state, n, L, wins, loser, round }; }, pick: playerPick, setL(v) { L = v; }, SLOTS };
})();
