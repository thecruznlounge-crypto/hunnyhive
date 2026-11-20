/* Funchise - open, upgrade and manage a growing chain. Hustle tips, survive events, hit the earnings goal. */
(function () {
  'use strict';
  Kit.ns('funchise');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const CITIES = [
    { name: 'Smalltown', sign: 'burger', sky: ['#9ad8ff', '#d8f0ff'], ground: '#6ab84a', goal: 2500, m: 1 },
    { name: 'Beach City', sign: 'icecream', sky: ['#ffd89a', '#fff0d0'], ground: '#f0d890', goal: 3500, m: 2.2 },
    { name: 'Metro', sign: 'pizza', sky: ['#7a90c8', '#c8d4f0'], ground: '#8a909c', goal: 4500, m: 4.5 },
    { name: 'Capital', sign: 'taco', sky: ['#c88ab8', '#f0d4e8'], ground: '#7a9a7a', goal: 6000, m: 9 },
    { name: 'Neon Tokyo', sign: 'sushi', sky: ['#2a1a5a', '#6a3a9a'], ground: '#3a3a5a', goal: 8000, m: 18 }
  ];
  const city = () => { const b = CITIES[Math.min(stage - 1, CITIES.length - 1)], x = Math.max(0, stage - CITIES.length); return Object.assign({}, b, { m: b.m * Math.pow(2, x), goal: b.goal * Math.pow(1.6, x), name: stage > CITIES.length ? b.name + ' ' + (x + 2) : b.name }); };
  const money = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.floor(n).toLocaleString();
  let W, H, u, lotRects, panelY;
  let stage = 1, score = 0, strikes = 0, cash = 0, earned = 0, goal = 1, t = 0, cfg, lots = [], sel = 0, parts = [], bubbles = [], events = [], evT = 20, rush = 0, state = 'play', stateT = 0, shake = 0, flash = 0, totalEarned = 0, tipsTotal = 0, bestMult = 1, btns = [], inspector = null;
  const best = () => Kit.get('best', 0);
  const baseInc = L => 5 * Math.pow(2, L - 1), upCost = L => Math.round(100 * Math.pow(1.7, L) * cfg.m / 5) * 5;
  const incOf = l => l.lv ? baseInc(l.lv) * cfg.m * (l.staff ? 1.25 : 1) * (l.ads ? 1.5 : 1) * (rush > 0 ? 2 : 1) * (l.out ? 0 : 1) : 0;
  const rate = () => lots.reduce((a, l) => a + incOf(l), 0);
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 760); panelY = H - 210 * u; lotRects = [];
    const top = 150 * u, avail = panelY - top - 8, cw = (W - 36) / 2, ch = avail / 3 - 8;
    for (let i = 0; i < 6; i++) lotRects.push({ x: 12 + (i % 2) * (cw + 12), y: top + Math.floor(i / 2) * (ch + 8), w: cw, h: ch });
  }
  S.onresize = layout; layout();
  function syncHud() { $('hudL').textContent = cfg.name; $('hudC').textContent = money(cash); $('hudR').textContent = '⭐'.repeat(Math.max(0, 3 - strikes)) + '☆'.repeat(strikes); }
  function say(txt, x, y, col) { if (parts.some(q => q.txt === txt && q.age < 0.6)) return; parts.push({ txt, x, y, age: 0, life: 1.1, col }); }
  function newCity() { cfg = city(); layout(); lots = Array.from({ length: 6 }, () => ({ lv: 0, staff: 0, ads: 0, out: 0, outT: 0, pulse: 0 })); cash = Math.round(120 * cfg.m / 5) * 5 + 0; earned = 0; goal = cfg.goal * cfg.m; bubbles = []; events = []; evT = 18; rush = 0; sel = 0; inspector = null; state = 'play'; stateT = 0; Kit.banner('City ' + stage, cfg.name); syncHud(); }
  function tipOf(l) { return Math.max(10 * cfg.m, incOf(l) * 2.5); }
  function earn(v, tip) { cash += v; earned += v; totalEarned += v; score += Math.round(v); if (tip) tipsTotal += v; }
  function buy(cost, fn, x, y) { if (cash < cost) { say('Need ' + money(cost), x, y, '#ff9a8a'); Kit.tone(160, 0.15, 'square', 0.1); return; } cash -= cost; fn(); Kit.tone(520, 0.08, 'triangle', 0.18); Kit.tone(780, 0.12, 'triangle', 0.16, 0, Kit.ac().currentTime + 0.07); syncHud(); }
  function act(a) {
    const l = lots[sel], r = lotRects[sel], x = r.x + r.w / 2, y = r.y;
    if (a === 'up') { if (l.lv >= 5) return; const c = upCost(l.lv); buy(c, () => { l.lv++; l.pulse = 1; say(l.lv === 1 ? 'Grand opening!' : 'Level ' + l.lv, x, y + 20, '#ffe066'); for (let i = 0; i < 12; i++) parts.push({ x, y: y + r.h / 2, vx: rnd(-140, 140), vy: rnd(-220, -40), age: 0, life: 0.8, c: pick(['#ffe066', '#8aee9a', '#ff8a7a']) }); }, x, y + 20); }
    else if (a === 'staff' && l.lv && !l.staff) buy(Math.round(150 * cfg.m / 5) * 5, () => { l.staff = 1; say('Manager hired!', x, y + 20, '#8aee9a'); }, x, y + 20);
    else if (a === 'ads' && l.lv && !l.ads) buy(Math.round(250 * cfg.m / 5) * 5, () => { l.ads = 1; say('Ads running!', x, y + 20, '#8ad0ff'); }, x, y + 20);
  }
  function spawnBubble() {
    const open = lots.map((l, i) => i).filter(i => lots[i].lv && !lots[i].out && !bubbles.some(b => b.i === i)); if (!open.length) return;
    bubbles.push({ i: pick(open), age: 0, life: 3.6, e: pick(['\u{1F600}', '\u{1F60B}', '\u{1F911}', '\u{1F929}']), x: rnd(0.25, 0.75) });
  }
  function fireEvent() {
    const open = lots.map((l, i) => i).filter(i => lots[i].lv); if (open.length < 2) return;
    const k = pick(['rush', 'inspect', 'short', 'inspect', 'short']);
    if (k === 'rush') { rush = 12; Kit.banner('Rush hour!', 'Income x2'); Kit.tone(660, 0.2, 'triangle', 0.2); }
    else if (k === 'inspect') { inspector = { i: pick(open), age: 0, life: 4.5 }; Kit.banner('Inspector!', 'Tap to impress them'); Kit.tone(300, 0.25, 'square', 0.12); }
    else { const i = pick(open.filter(j => !lots[j].out)); if (i != null) { lots[i].out = 1; lots[i].outT = 9; Kit.banner('Shortage!', 'Tap the store to restock'); Kit.tone(200, 0.3, 'sawtooth', 0.14, -80); } }
  }
  function strike(msg) { strikes++; flash = 0.5; shake = 0.4; say(msg, W / 2, H * 0.4, '#ff8a7a'); Kit.tone(150, 0.4, 'sawtooth', 0.18, -80); Kit.vibe(60); syncHud(); if (strikes >= 3) { state = 'lost'; stateT = 0; } }
  function tapAt(x, y) {
    if (F.mode !== 'play' || state !== 'play') return; Kit.ac();
    for (const b of btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { act(b.a); return; }
    if (inspector) { const r = lotRects[inspector.i]; if (Math.hypot(x - (r.x + r.w / 2), y - (r.y + 20 * u)) < 50 * u) { inspector = null; const b = 100 * cfg.m; earn(b); say('Five stars! +' + money(b), r.x + r.w / 2, r.y + 20 * u, '#8aee9a'); Kit.tone(880, 0.2, 'triangle', 0.2); syncHud(); return; } }
    for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i], r = lotRects[b.i], bx = r.x + r.w * b.x, by = r.y + 16 * u; if (Math.hypot(x - bx, y - by) < 40 * u) { const v = tipOf(lots[b.i]); earn(v, 1); say('+' + money(v), bx, by, '#ffe066'); bubbles.splice(i, 1); Kit.tone(700 + Math.random() * 200, 0.07, 'triangle', 0.16); syncHud(); return; } }
    for (let i = 0; i < 6; i++) { const r = lotRects[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { if (lots[i].out) { lots[i].out = 0; say('Restocked!', r.x + r.w / 2, r.y + 30 * u, '#8aee9a'); Kit.tone(600, 0.1, 'triangle', 0.16); } sel = i; return; } }
  }
  function update(dt) {
    parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; } else q.y -= 34 * dt; }); parts = parts.filter(q => q.age < q.life);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2); if (F.mode !== 'play') return; stateT += dt;
    lots.forEach(l => { l.pulse = Math.max(0, l.pulse - dt * 2); });
    if (state === 'play') {
      earn(rate() * dt); syncHud(); rush = Math.max(0, rush - dt);
      lots.forEach((l, i) => { if (l.out) { l.outT -= dt; if (l.outT <= 0) { l.out = 0; strike('Shortage ruined the day!'); } } if (l.staff && l.lv && !l.out && Math.random() < dt * 0.25) { earn(tipOf(l) * 0.5, 1); } });
      bubbles.forEach(b => b.age += dt); bubbles = bubbles.filter(b => b.age < b.life);
      if (Math.random() < dt * (0.5 + lots.filter(l => l.lv).length * 0.25)) spawnBubble();
      if (inspector) { inspector.age += dt; if (inspector.age > inspector.life) { inspector = null; strike('Failed inspection!'); } }
      evT -= dt; if (evT <= 0) { fireEvent(); evT = rnd(16, 26); }
      if (earned >= goal) { state = 'clear'; stateT = 0; const b = Math.round(1000 * cfg.m * (1 + (3 - strikes) * 0.3)); score += b; say('City conquered! +' + money(b), W / 2, H * 0.4, '#fff'); Kit.tone(523, 0.12, 'triangle', 0.22); Kit.tone(784, 0.24, 'triangle', 0.22, 0, Kit.ac().currentTime + 0.12); }
    } else if (state === 'clear') { if (stateT > 2.2) { stage++; newCity(); } }
    else if (state === 'lost' && stateT > 0.8) gameOver();
  }
  function building(l, r, i) {
    const cx = r.x + r.w / 2, base = r.y + r.h - 10 * u, sel_ = i === sel;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.strokeStyle = sel_ ? '#ffcf4a' : 'rgba(0,0,0,.25)'; ctx.lineWidth = sel_ ? 4 : 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill(); ctx.stroke();
    if (!l.lv) { Food.emoji(ctx, 'home', cx, r.y + r.h * 0.45, 40 * u, { alpha: 0.45, shadow: false }); Food.text(ctx, 'Empty lot', cx, r.y + r.h * 0.78, 13 * u, '#fff'); return; }
    const bh = (34 + l.lv * 11) * u, bw = r.w * 0.5 * (1 + l.pulse * 0.08), by = base - bh;
    ctx.save(); ctx.translate(cx, base); ctx.scale(1 + l.pulse * 0.08, 1 + l.pulse * 0.08); ctx.translate(-cx, -base);
    const g = ctx.createLinearGradient(0, by, 0, base); g.addColorStop(0, l.out ? '#777' : '#ffd890'); g.addColorStop(1, l.out ? '#555' : '#e8a050'); ctx.fillStyle = g; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cx - bw / 2, by, bw, bh, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = l.out ? '#444' : '#e8453a'; ctx.beginPath(); ctx.moveTo(cx - bw / 2 - 6, by + 2); ctx.lineTo(cx, by - 14 * u); ctx.lineTo(cx + bw / 2 + 6, by + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(160,220,255,.85)'; for (let k = 0; k < Math.min(l.lv, 3); k++) ctx.fillRect(cx - bw / 2 + 8 + k * (bw - 16) / 3, base - 20 * u, (bw - 16) / 3 - 4, 14 * u);
    Food.emoji(ctx, cfg.sign, cx, by + 14 * u, 26 * u, { shadow: false }); ctx.restore();
    ctx.font = (11 * u) + 'px serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; for (let k = 0; k < l.lv; k++) ctx.fillText('⭐', r.x + 8 + k * 11 * u, r.y + r.h - 6);
    if (l.staff) Food.emoji(ctx, 'person', r.x + r.w - 18 * u, r.y + r.h - 18 * u, 18 * u, { shadow: false }); if (l.ads) Food.emoji(ctx, 'bubble', r.x + r.w - 40 * u, r.y + r.h - 18 * u, 16 * u, { shadow: false });
    Food.text(ctx, '+' + money(incOf(l)) + '/s', cx, r.y + 12 * u, 12 * u, l.out ? '#ff9a8a' : '#fff');
    if (l.out) { Food.emoji(ctx, 'warn', cx, r.y + r.h / 2, 38 * u, {}); Food.text(ctx, 'OUT - tap!', cx, r.y + r.h / 2 + 30 * u, 13 * u, '#ffdd66'); }
  }
  function render() {
    const sx = shake > 0 ? Math.sin(t * 90) * shake * 10 : 0; ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cfg.sky[0]); g.addColorStop(0.5, cfg.sky[1]); g.addColorStop(0.5, cfg.ground); g.addColorStop(1, cfg.ground); ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
    /* goal bar */
    const k = clamp(earned / goal, 0, 1); Food.meter(ctx, 14, 62 * u + 6, W - 28, 16 * u, k, '#ffcf4a'); Food.text(ctx, money(earned) + ' / ' + money(goal), W / 2, 62 * u + 6 + 8 * u, 11 * u + 1, '#3a1608', { stroke: false });
    Food.text(ctx, money(rate()) + '/s' + (rush > 0 ? '  RUSH x2' : ''), W / 2, 112 * u, 15 * u, rush > 0 ? '#ffe066' : '#fff');
    lots.forEach((l, i) => building(l, lotRects[i], i));
    bubbles.forEach(b => { const r = lotRects[b.i], x = r.x + r.w * b.x, y = r.y + 16 * u + Math.sin(t * 4 + b.i) * 3, a = Math.min(1, (b.life - b.age) * 2); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 22 * u, 0, TAU); ctx.fill(); ctx.stroke(); ctx.font = (24 * u) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(b.e, x, y + 1); ctx.globalAlpha = 1; });
    if (inspector) { const r = lotRects[inspector.i], x = r.x + r.w / 2, y = r.y + 20 * u; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8453a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 28 * u, 0, TAU); ctx.fill(); ctx.stroke(); Food.emoji(ctx, '\u{1F575}️', x, y, 34 * u, { shadow: false }); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 34 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - inspector.age / inspector.life)); ctx.stroke(); }
    /* panel */
    ctx.fillStyle = 'rgba(42,14,10,.92)'; ctx.fillRect(0, panelY, W, H - panelY); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, panelY); ctx.lineTo(W, panelY); ctx.stroke();
    const l = lots[sel]; btns = []; const bw = (W - 40) / 3, by = panelY + 70 * u, bh = 96 * u;
    Food.text(ctx, l.lv ? 'Store ' + (sel + 1) + ' · Level ' + l.lv : 'Empty lot ' + (sel + 1), 16, panelY + 24 * u, 17 * u, '#fff', { align: 'left' });
    Food.text(ctx, l.lv ? 'Earning ' + money(incOf(l)) + '/s' : 'Open a store to start earning', 16, panelY + 48 * u, 12 * u + 1, '#ffcf4a', { align: 'left', stroke: false });
    const defs = [
      { a: 'up', t: l.lv === 0 ? 'Open store' : l.lv >= 5 ? 'Max level' : 'Upgrade', c: l.lv >= 5 ? 0 : upCost(l.lv), ic: l.lv ? 'star' : 'shop', ok: l.lv < 5 },
      { a: 'staff', t: l.staff ? 'Manager ✓' : 'Hire manager', c: l.staff ? 0 : Math.round(150 * cfg.m / 5) * 5, ic: 'person', ok: l.lv && !l.staff, sub: '+25%, auto tips' },
      { a: 'ads', t: l.ads ? 'Ads ✓' : 'Run ads', c: l.ads ? 0 : Math.round(250 * cfg.m / 5) * 5, ic: 'bubble', ok: l.lv && !l.ads, sub: '+50% income' }
    ];
    defs.forEach((d, i) => {
      const x = 12 + i * (bw + 8), afford = d.ok && cash >= d.c; btns.push({ x, y: by, w: bw, h: bh, a: d.a });
      const gg = ctx.createLinearGradient(0, by, 0, by + bh); if (afford) { gg.addColorStop(0, '#ffe066'); gg.addColorStop(1, '#ffa630'); } else { gg.addColorStop(0, d.ok ? '#6a4a40' : '#3a2a26'); gg.addColorStop(1, d.ok ? '#4a2e28' : '#2a1c18'); }
      ctx.fillStyle = gg; ctx.strokeStyle = '#1a0806'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, by, bw, bh, 14); ctx.fill(); ctx.stroke();
      Food.emoji(ctx, d.ic, x + bw / 2, by + 26 * u, 32 * u, { shadow: false, alpha: d.ok ? 1 : 0.4 });
      Food.text(ctx, d.t, x + bw / 2, by + 56 * u, 12 * u + 1, afford ? '#3a1608' : '#fff', { stroke: false });
      Food.text(ctx, d.ok ? money(d.c) : d.sub || '', x + bw / 2, by + 78 * u, 14 * u, afford ? '#3a1608' : d.ok ? '#ff9a8a' : '#aaa', { stroke: false });
    });
    Heroes.draw(ctx, 'penny', W - 40 * u, panelY + 38 * u, 0.3 * u, { t, look: Math.sin(t) });
    parts.forEach(q => { const kk = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, kk * 2); Food.text(ctx, q.txt, q.x, q.y, 18 * u + 2, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = clamp(kk, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,40,' + flash * 0.3 + ')'; ctx.fillRect(0, 0, W, H); }
    if (stage === 1 && !lots.some(x => x.lv)) Food.text(ctx, 'Tap "Open store" to start!', W / 2, panelY - 14 * u, 15 * u, '#fff');
  }
  function gameOver() { const nb = score > best(); if (nb) Kit.set('best', score); Kit.tone(200, 0.8, 'sawtooth', 0.18, -150); F.over(nb ? 'New best!' : 'Chain closed!', [['Score', score.toLocaleString(), nb], ['Total earned', money(totalEarned)], ['Tips hustled', money(tipsTotal)], ['City reached', stage], ['Best', Math.max(score, best()).toLocaleString()]]); }
  const F = Food.flow({ hero: 'penny', onStart() { stage = 1; score = 0; strikes = 0; totalEarned = 0; tipsTotal = 0; parts = []; newCity(); } });
  $('game').addEventListener('pointerdown', e => tapAt(e.clientX, e.clientY));
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (F.mode !== 'pause') update(dt); if (cfg && lots.length) render(); else { ctx.fillStyle = '#2a0e0a'; ctx.fillRect(0, 0, W, H); } });
  cfg = city(); layout();
  window.__f = { get s() { return { mode: F.mode, stage, score, strikes, cash, earned, goal, lots: lots.map(l => l.lv), state, bub: bubbles.length }; }, act, sel(i) { sel = i; }, tapAt, cheat(v) { cash += v; } };
})();
