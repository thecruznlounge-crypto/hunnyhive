/* Art at War: draw a fighter and a weapon (or pick a design), then duel, rumble or melee. */
(function () {
  'use strict';
  Kit.ns('art-at-war');
  const $ = Kit.$, S = Kit.setup($('game')), ctx = S.ctx, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const WW = 800, WH = 450, P = AWPresets;
  const STAGES = [
    { name: 'Paper Plains', bg: ['#fff6df', '#f0dcae'], ink: '#3a3350', pl: '#fffaf0', pe: '#5a4a38', ground: [[0, 800]], gy: 380, plats: [[120, 290, 160], [520, 290, 160], [320, 205, 160]], deco: 'lines' },
    { name: 'Blueprint Yard', bg: ['#1c4a9a', '#0e2a66'], ink: '#cfe3ff', pl: '#2a62c4', pe: '#cfe3ff', ground: [[70, 730]], gy: 380, plats: [[150, 312, 120], [340, 244, 120], [530, 312, 120]], deco: 'grid' },
    { name: 'Easel Heights', bg: ['#2a2f3a', '#14171f'], ink: '#e8eef8', pl: '#3a4150', pe: '#e8eef8', ground: [[0, 290], [510, 800]], gy: 372, plats: [[320, 296, 160], [90, 250, 100], [610, 250, 100]], deco: 'chalk' },
    { name: 'Neon Wall', bg: ['#2d0a4a', '#0e0420'], ink: '#ff5dc8', pl: '#1a0a30', pe: '#4ff0ff', ground: [[100, 700]], gy: 390, plats: [[60, 284, 100], [640, 284, 100]], move: { x: 250, y: 290, w: 140, rng: 160, sp: 1.1 }, deco: 'neon' }
  ];
  let cfg = { mode: 'duel', stage: 0, diff: 1 }, char = null, wpn = null;
  const pads = {}; let tab = 'char';
  /* ---------------- studio ---------------- */
  function composite(kind) { const p = pads[kind], o = document.createElement('canvas'); o.width = o.height = 512; const c = o.getContext('2d'); if (p.custom) c.drawImage(p.custom, 0, 0, 512, 512); p.strokes.forEach(s => Art.drawStroke(c, s)); return o; }
  function buildStats(cv, kind) {
    const k = Art.ink(cv); if (k.empty) return null;
    const dens = clamp(k.n / (k.w * k.h), 0, 1);
    if (kind === 'char') { const bulk = clamp((dens - .1) / .45, 0, 1); return { hp: Math.round(75 + bulk * 65), spd: Math.round(190 - bulk * 45) }; }
    const asp = k.w / Math.max(8, k.h), reach = clamp(30 + asp * 13, 34, 80);
    return { reach: Math.round(reach), pow: Math.round(8 + clamp(dens * 26, 0, 10) + (80 - reach) / 14), cd: +(.26 + (reach - 34) / 46 * .22).toFixed(2) };
  }
  function mkChip(parent, cv, fn) {
    const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; const c = document.createElement('canvas'); c.width = c.height = 70;
    const x = c.getContext('2d'), k = Art.ink(cv), s = Math.min(60 / k.w, 60 / k.h); x.drawImage(cv, k.x0, k.y0, k.w, k.h, 35 - k.w * s / 2, 35 - k.h * s / 2, k.w * s, k.h * s);
    b.appendChild(c); b.onclick = fn; parent.appendChild(b); return b;
  }
  function setPreset(kind, i) { const src = kind === 'char' ? P.char(i) : P.wpn(i), p = pads[kind]; p.custom = src; p.strokes = []; p.render(); refreshStats(); }
  function refreshStats() {
    const a = buildStats(composite('char'), 'char'), b = buildStats(composite('wpn'), 'wpn');
    $('stats').innerHTML = (a ? '<span>❤ HP <b>' + a.hp + '</b></span><span>⚡ Speed <b>' + a.spd + '</b></span>' : '<span>Draw your fighter</span>') + (b ? '<span>📏 Reach <b>' + b.reach + '</b></span><span>💥 Power <b>' + b.pow + '</b></span>' : '<span>Draw your weapon</span>');
  }
  function initStudio() {
    ['char', 'wpn'].forEach(kind => {
      const p = Art.Pad($(kind === 'char' ? 'padChar' : 'padWpn'), { onchange: refreshStats }); pads[kind] = p;
      p.undo = () => { if (p.strokes.length) p.strokes.pop(); else p.custom = null; p.render(); refreshStats(); };
      p.clear = () => { p.strokes = []; p.custom = null; p.render(); refreshStats(); };
      const row = $(kind === 'char' ? 'chipsChar' : 'chipsWpn');
      (kind === 'char' ? P.CHARS : P.WPNS).forEach((n, i) => { const b = mkChip(row, kind === 'char' ? P.char(i) : P.wpn(i), () => { row.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); setPreset(kind, i); }); b.setAttribute('aria-label', n); });
    });
    const sw = $('swatches'); Art.COLORS.forEach((c, i) => { const b = document.createElement('button'); b.className = 'sw' + (i === 1 ? ' on' : ''); b.style.background = c; b.type = 'button'; b.setAttribute('aria-label', 'Color ' + (i + 1)); b.onclick = () => { setColor(c); sw.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sw.appendChild(b); });
    function setColor(c) { Object.values(pads).forEach(p => { p.color = c; p.erase = false; }); $('btnErase').classList.remove('on'); }
    setColor(Art.COLORS[1]);
    $('btnErase').onclick = e => { const on = !pads.char.erase; Object.values(pads).forEach(p => p.erase = on); e.currentTarget.classList.toggle('on', on); };
    $('btnSize').onclick = () => { const n = pads.char.size >= 24 ? 6 : pads.char.size + 6; Object.values(pads).forEach(p => p.size = n); $('btnSize').textContent = 'Brush ' + (n / 6 | 0); };
    $('btnUndo').onclick = () => pads[tab].undo(); $('btnClear').onclick = () => pads[tab].clear();
    document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.t));
    setTab('char'); setPreset('char', 0); setPreset('wpn', 0); $('chipsChar').children[0].classList.add('on'); $('chipsWpn').children[0].classList.add('on');
    ['char', 'wpn'].forEach(kind => { const u = Kit.get('draw_' + kind, null); if (u) Art.fromURL(u, c => { pads[kind].custom = c; pads[kind].strokes = []; pads[kind].render(); refreshStats(); document.querySelectorAll('#chips' + (kind === 'char' ? 'Char' : 'Wpn') + ' .chip').forEach(x => x.classList.remove('on')); }); });
  }
  function setTab(t) { tab = t; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('boxChar').style.display = t === 'char' ? '' : 'none'; $('boxWpn').style.display = t === 'wpn' ? '' : 'none'; $('chipsChar').style.display = t === 'char' ? '' : 'none'; $('chipsWpn').style.display = t === 'wpn' ? '' : 'none'; $('tip').textContent = t === 'char' ? 'Draw a fighter facing right, or tap a design. More ink = more health, less speed.' : 'Draw a weapon pointing right, handle on the left. Long = reach, thick = power.'; }
  function commitDrawings() {
    const cc = composite('char'), wc = composite('wpn');
    if (Art.ink(cc).empty) { Kit.toast('Draw a fighter first'); setTab('char'); return false; }
    if (Art.ink(wc).empty) { Kit.toast('Draw a weapon first'); setTab('wpn'); return false; }
    Kit.set('draw_char', cc.toDataURL('image/png')); Kit.set('draw_wpn', wc.toDataURL('image/png'));
    char = Object.assign({ cv: cc }, buildStats(cc, 'char')); wpn = Object.assign({ cv: wc }, buildStats(wc, 'wpn')); return true;
  }
  /* ---------------- fighters ---------------- */
  const CPU_COLS = ['#e63946', '#ff9f1c', '#2ec4b6', '#8338ec', '#ff6fb5', '#3a86ff'];
  let F = [], shots = [], parts = [], texts = [], plats = [], state = 'menu', t = 0, shake = 0, round = 1, wins = [0, 0], wave = 0, timeLeft = 0, banner = 0, over = false;
  function mkFighter(o) {
    const f = Object.assign({ x: 400, y: 0, vx: 0, vy: 0, face: 1, max: o.hp, hp: o.hp, air: true, jumps: 2, atk: -1, hit: {}, stun: 0, inv: 0, alive: true, sp: 0, cdT: 0, kos: 0, respawn: 0, hw: 16, hh: 66, ai: { t: 0, dir: 0, jump: false, atk: false, sp: false }, flash: 0, in: {} }, o);
    f.spr = Art.sprite(o.cv, 74, 86); f.wsp = Art.sprite(o.wcv, 200, 200); f.wl = f.reach; return f;
  }
  function cpuFighter(team, diff) {
    const ci = Math.floor(rnd(0, 6)), wi = Math.floor(rnd(0, 6)), cc = P.char(ci), wc = P.wpn(wi), s1 = buildStats(cc, 'char'), s2 = buildStats(wc, 'wpn');
    return mkFighter({ cv: cc, wcv: wc, hp: Math.round(s1.hp * (.85 + diff * .15)), spd: s1.spd * (.9 + diff * .1), reach: s2.reach, pow: s2.pow * (.8 + diff * .2), cd: s2.cd / (.9 + diff * .1), team, name: P.CHARS[ci], cpu: true, diff, color: pick(CPU_COLS) });
  }
  const st = () => STAGES[cfg.stage];
  function buildPlats() { const s = st(); plats = []; s.ground.forEach(g => plats.push({ x: g[0], y: s.gy, w: g[1] - g[0], g: true })); s.plats.forEach(p => plats.push({ x: p[0], y: p[1], w: p[2] })); if (s.move) plats.push({ x: s.move.x, y: s.move.y, w: s.move.w, mv: true, bx: s.move.x, dx: 0 }); }
  function respawnPos(f) { const g = pick(st().ground); f.x = clamp(g[0] + 50 + rnd(0, Math.max(10, g[1] - g[0] - 100)), 40, 760); f.y = st().gy - 220; f.vy = 0; f.vx = 0; }
  function resetRound(n) {
    shots = []; parts = []; texts = []; buildPlats();
    F = [mkFighter({ cv: char.cv, wcv: wpn.cv, hp: char.hp, spd: char.spd, reach: wpn.reach, pow: wpn.pow, cd: wpn.cd, team: 0, name: 'You', human: true, color: '#7be0c3' })];
    if (cfg.mode === 'duel') F.push(cpuFighter(1, cfg.diff)); else if (cfg.mode === 'melee') for (let i = 1; i < 4; i++) F.push(cpuFighter(i, cfg.diff)); else { wave = 0; nextWave(true); }
    const sx = [180, 620, 330, 470]; F.forEach((f, i) => { f.x = sx[i % 4]; f.y = st().gy - 90 - i * 12; f.face = f.x < 400 ? 1 : -1; f.inv = 1; });
    t = 0; state = 'count'; banner = 1.4; timeLeft = cfg.mode === 'melee' ? 90 : 0; over = false;
    Kit.banner(cfg.mode === 'duel' ? 'Round ' + n : cfg.mode === 'rumble' ? 'Rumble!' : 'Melee!', 'Ready…');
  }
  function nextWave(first) {
    wave++; const n = Math.min(3, 1 + Math.floor((wave - 1) / 2)); if (!first) { const me = F[0]; me.hp = Math.min(me.max, me.hp + me.max * .3); }
    for (let i = 0; i < n; i++) { const f = cpuFighter(i + 1, clamp(.7 + wave * .08, .7, 1.7) * (cfg.diff * .5 + .6)); f.hp = f.max = Math.round(f.max * (.8 + wave * .06)); f.x = i % 2 ? 740 : 60; f.y = st().gy - 60 - i * 40; f.inv = 1; F.push(f); }
    if (!first) Kit.banner('Wave ' + wave, n + (n > 1 ? ' fighters' : ' fighter'));
  }
  /* ---------------- input ---------------- */
  const K = { l: 0, r: 0 }, edge = { jp: 0, at: 0, sp: 0 };
  const KM = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'j', w: 'j', ' ': 'j', j: 'a', z: 'a', k: 's', x: 's' };
  addEventListener('keydown', e => { const m = KM[e.key]; if (!m) return; if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); if (e.repeat) return; if (m === 'l') K.l = 1; if (m === 'r') K.r = 1; if (m === 'j') edge.jp = 1; if (m === 'a') edge.at = 1; if (m === 's') edge.sp = 1; });
  addEventListener('keyup', e => { const m = KM[e.key]; if (m === 'l') K.l = 0; if (m === 'r') K.r = 0; });
  function bindBtn(id, down, up) { const b = $(id), d = e => { e.preventDefault(); b.classList.add('down'); down(); }, u = e => { e.preventDefault(); b.classList.remove('down'); if (up) up(); }; b.addEventListener('pointerdown', d); b.addEventListener('pointerup', u); b.addEventListener('pointerleave', u); b.addEventListener('pointercancel', u); }
  bindBtn('cL', () => K.l = 1, () => K.l = 0); bindBtn('cR', () => K.r = 1, () => K.r = 0); bindBtn('cJ', () => edge.jp = 1); bindBtn('cA', () => edge.at = 1); bindBtn('cS', () => edge.sp = 1);
  /* ---------------- sim ---------------- */
  function support(nx, ny) { for (const p of plats) if (nx >= p.x - 4 && nx <= p.x + p.w + 4 && p.y >= ny - 6 && p.y <= ny + 110) return true; return false; }
  function puff(x, y, n, col) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-140, 140), vy: rnd(-200, 20), life: rnd(.25, .55), c: col, r: rnd(2, 5) }); }
  function doJump(f) { if (f.jumps > 0) { f.vy = f.jumps === 2 ? -560 : -500; f.jumps--; f.air = true; Kit.tone(f.jumps ? 420 : 520, .1, 'triangle', .06, 300); puff(f.x, f.y, 4, '#ffffff'); } }
  function startAtk(f) { if (f.atk >= 0 || f.stun > 0 || f.cdT > 0) return; f.atk = 0; f.hit = {}; f.cdT = f.cd + .12; Kit.noise(.08, .05, null, 2500); }
  function startSpecial(f) { if (f.sp > 0 || f.stun > 0 || f.atk >= 0) return; f.sp = 1.4; shots.push({ x: f.x + f.face * 24, y: f.y - 44, vx: f.face * 430, from: f, dmg: 9 + f.pow * .3, life: 1.3, col: f.color }); Kit.tone(300, .15, 'sawtooth', .06, 500); }
  function ko(f, a) { f.alive = false; f.hp = 0; if (a && a !== f) a.kos++; f.respawn = cfg.mode === 'melee' ? 1.8 : 0; puff(f.x, f.y - 40, 16, f.color); shake = 10; Kit.tone(110, .35, 'sawtooth', .1, -70); }
  function hurt(f, a, dmg, kx) {
    if (!f.alive || f.inv > 0) return; f.hp -= dmg; f.stun = .25; f.vx = kx * (150 + dmg * 12); f.vy = -230 - dmg * 5; f.air = true; f.flash = .15; f.atk = -1; shake = Math.min(10, shake + dmg * .4);
    Kit.tone(160, .1, 'square', .08, -80); Kit.noise(.07, .08, null, 800); Kit.vibe(12); puff(f.x, f.y - 40, 7, a ? a.color : '#fff'); texts.push({ x: f.x, y: f.y - 110, s: Math.round(dmg), t: .7 });
    if (f.hp <= 0) ko(f, a);
  }
  const overlap = (px, py, f) => px > f.x - f.hw - 8 && px < f.x + f.hw + 8 && py > f.y - f.hh - 8 && py < f.y + 6;
  function aiStep(f, dt) {
    const foes = F.filter(o => o !== f && o.alive && (cfg.mode === 'melee' || o.team !== f.team)), A = f.ai; if (!foes.length) { f.in = {}; return; }
    let e = foes[0], bd = 1e9; foes.forEach(o => { const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * .6; if (d < bd) { bd = d; e = o; } });
    A.t -= dt; const dx = e.x - f.x, dy = e.y - f.y, ad = Math.abs(dx), sgn = dx > 0 ? 1 : -1, dd = f.diff || 1;
    if (A.t <= 0) { A.t = rnd(.1, .3) / dd; A.dir = ad > f.reach * .75 ? sgn : (ad < f.reach * .3 && Math.random() < .4 ? -sgn : 0); if (Math.random() < .1) A.dir = pick([-1, 0, 1]); A.jump = (dy < -50 && Math.random() < .6) || (ad > 100 && Math.random() < .05); A.atk = ad < f.reach + 26 && Math.abs(dy) < 66 && Math.random() < .75 * Math.min(1, dd); A.sp = ad > 160 && Math.abs(dy) < 60 && Math.random() < .35; }
    f.in = { l: A.dir < 0, r: A.dir > 0, jp: A.jump, at: A.atk, sp: A.sp }; A.jump = A.atk = A.sp = false;
    if (!f.air && (f.in.l || f.in.r) && !support(f.x + (f.in.r ? 38 : -38), f.y)) { f.in.l = f.in.r = false; if (Math.random() < .3) f.in.jp = true; }
    if (f.air && (f.y > st().gy + 30 || f.x < 20 || f.x > 780) && f.jumps > 0) { f.in.jp = true; f.in.l = f.x > 400; f.in.r = f.x <= 400; }
  }
  function swingHit(f) {
    const hx = f.x + f.face * 12, hy = f.y - 46, a = -1.1 + 2 * Math.min(1, f.atk), reach = f.reach + 10;
    F.forEach((o, oi) => { if (o === f || !o.alive || f.hit[oi] || (cfg.mode !== 'melee' && o.team === f.team)) return; for (let k = .3; k <= 1.01; k += .23) { if (overlap(hx + f.face * Math.cos(a) * reach * k, hy + Math.sin(a) * reach * k, o)) { f.hit[oi] = 1; hurt(o, f, f.pow, f.face); break; } } });
  }
  function step(dt) {
    t += dt; texts.forEach(x => { x.t -= dt; x.y -= 30 * dt; }); texts = texts.filter(x => x.t > 0);
    plats.forEach(p => { if (p.mv) { const m = st().move, nx = p.bx + Math.sin(t * m.sp) * m.rng / 2; p.dx = nx - p.x; p.x = nx; } });
    F.forEach(f => {
      if (!f.alive) { if (f.respawn > 0 && !over) { f.respawn -= dt; if (f.respawn <= 0) { f.alive = true; f.hp = f.max; respawnPos(f); f.inv = 1.6; f.jumps = 2; } } return; }
      if (f.human) { f.in = { l: K.l, r: K.r, jp: edge.jp, at: edge.at, sp: edge.sp }; edge.jp = edge.at = edge.sp = 0; } else aiStep(f, dt);
      f.inv = Math.max(0, f.inv - dt); f.stun = Math.max(0, f.stun - dt); f.flash = Math.max(0, f.flash - dt); f.sp = Math.max(0, f.sp - dt); f.cdT = Math.max(0, f.cdT - dt);
      const I = f.in;
      if (state === 'fight' && f.stun <= 0) { const m = (I.r ? 1 : 0) - (I.l ? 1 : 0); f.vx += (m * f.spd * (f.atk >= 0 ? .5 : 1) - f.vx) * Math.min(1, dt * (f.air ? 6 : 14)); if (m) f.face = m; if (I.jp) doJump(f); if (I.at) startAtk(f); if (I.sp) startSpecial(f); }
      else f.vx *= Math.pow(.2, dt);
      f.vy += 1500 * dt; const py = f.y; f.x += f.vx * dt; f.y += f.vy * dt; f.air = true;
      if (f.vy >= 0) for (const p of plats) if (f.x >= p.x - 6 && f.x <= p.x + p.w + 6 && py <= p.y + 6 && f.y >= p.y) { f.y = p.y; f.vy = 0; f.air = false; f.jumps = 2; if (p.dx) f.x += p.dx; break; }
      if (f.y > WH + 120 || f.x < -70 || f.x > WW + 70) ko(f, null);
      if (f.atk >= 0) { f.atk += dt / .3; if (f.atk >= 1) f.atk = -1; else if (f.atk > .3 && f.atk < .75) swingHit(f); }
    });
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.x += s.vx * dt; s.life -= dt; let dead = s.life <= 0 || s.x < -20 || s.x > WW + 20; F.forEach(f => { if (!dead && f.alive && f !== s.from && (cfg.mode === 'melee' || f.team !== s.from.team) && overlap(s.x, s.y, f)) { hurt(f, s.from, s.dmg, Math.sign(s.vx)); dead = true; } }); if (dead) { puff(s.x, s.y, 5, s.col); shots.splice(i, 1); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; if (p.life <= 0) parts.splice(i, 1); }
    shake *= Math.pow(.02, dt);
  }
  /* ---------------- flow ---------------- */
  function checkEnd() {
    if (over || state !== 'fight') return; const me = F[0];
    if (cfg.mode === 'duel') { const foe = F[1]; if (!me.alive || !foe.alive) { wins[me.alive ? 0 : 1]++; const done = wins[0] === 2 || wins[1] === 2; state = 'roundEnd'; Kit.banner(me.alive ? 'K.O.!' : 'Down!', wins[0] + ' – ' + wins[1]); setTimeout(() => { if (state !== 'roundEnd') return; if (done) finish(wins[0] === 2); else { round++; resetRound(round); } }, 1500); } }
    else if (cfg.mode === 'rumble') { if (!me.alive) { over = true; setTimeout(() => finish(false), 1100); } else if (!F.some(f => f.cpu && f.alive)) nextWave(); }
    else { const lead = Math.max(...F.map(f => f.kos)); if (lead >= 5 || timeLeft <= 0) { over = true; setTimeout(() => finish(me.kos === lead && lead > 0), 700); } }
  }
  function finish(win) {
    state = 'over'; Kit.hideScreens(); showCtl(false); $('hud').classList.remove('show');
    const me = F[0], score = cfg.mode === 'rumble' ? (wave - 1) * 100 + me.kos * 50 : cfg.mode === 'melee' ? me.kos * 100 : wins[0] * 150 + Math.round(Math.max(0, me.hp)), key = 'best_' + cfg.mode, best = Kit.get(key, 0), nb = score > best; if (nb) Kit.set(key, score);
    $('resTitle').textContent = win ? 'Victory!' : cfg.mode === 'rumble' ? 'Wave ' + wave : 'Defeated';
    $('resStats').innerHTML = (cfg.mode === 'rumble' ? 'Reached wave <b>' + wave + '</b> · ' : '') + 'KOs <b>' + me.kos + '</b><br>Score <b>' + score + '</b>' + (nb ? ' · new best!' : ' · best ' + best);
    Kit.show('over'); win ? Kit.tone(660, .3, 'triangle', .1, 400) : Kit.tone(200, .4, 'sawtooth', .08, -100);
  }
  function showCtl(on) { document.querySelectorAll('.ctl').forEach(c => c.classList.toggle('show', on)); $('rot').classList.toggle('need', on); }
  function begin() { Kit.hideScreens(); showCtl(true); $('hud').classList.add('show'); wins = [0, 0]; round = 1; resetRound(1); }
  /* ---------------- render ---------------- */
  let sc = 1, ox = 0, oy = 0;
  S.onresize = () => { sc = Math.min(S.W / WW, S.H / WH); ox = (S.W - WW * sc) / 2; oy = (S.H - WH * sc) / 2; }; S.onresize();
  function drawBG() {
    const s = st(), g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, s.bg[0]); g.addColorStop(1, s.bg[1]); ctx.fillStyle = g; ctx.fillRect(-200, -200, WW + 400, WH + 400);
    ctx.save(); ctx.strokeStyle = s.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = .18;
    if (s.deco === 'lines') { for (let y = 20; y < WH; y += 28) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(WW + 100, y); ctx.stroke(); } ctx.strokeStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(70, -50); ctx.lineTo(70, WH + 50); ctx.stroke(); }
    else if (s.deco === 'grid') { for (let x = 0; x <= WW; x += 40) { ctx.beginPath(); ctx.moveTo(x, -50); ctx.lineTo(x, WH + 50); ctx.stroke(); } for (let y = 0; y <= WH; y += 40) { ctx.beginPath(); ctx.moveTo(-50, y); ctx.lineTo(WW + 50, y); ctx.stroke(); } ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(400, 140, 70, 0, TAU); ctx.moveTo(330, 140); ctx.lineTo(470, 140); ctx.stroke(); }
    else if (s.deco === 'chalk') { ctx.lineWidth = 3; ctx.globalAlpha = .22; ctx.beginPath(); ctx.moveTo(60, 120); ctx.quadraticCurveTo(160, 60, 260, 130); ctx.moveTo(540, 90); ctx.lineTo(620, 60); ctx.lineTo(700, 100); ctx.stroke(); ctx.font = '28px Fredoka,sans-serif'; ctx.fillStyle = s.ink; ctx.fillText('E = mc²', 120, 200); ctx.fillText('a² + b² = c²', 540, 180); }
    else { ctx.globalAlpha = .5; ctx.shadowColor = s.ink; ctx.shadowBlur = 14; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(60, 320); ctx.lineTo(160, 200); ctx.lineTo(260, 320); ctx.moveTo(540, 320); ctx.lineTo(640, 190); ctx.lineTo(740, 320); ctx.stroke(); ctx.strokeStyle = '#4ff0ff'; ctx.beginPath(); ctx.arc(400, 120, 50, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawPlats() {
    const s = st(); plats.forEach(p => { ctx.save(); const h = p.g ? 70 : 16; ctx.fillStyle = s.pl; ctx.strokeStyle = s.pe; ctx.lineWidth = 3; if (s.deco === 'neon') { ctx.shadowColor = s.pe; ctx.shadowBlur = 12; } Art.rr(ctx, p.x, p.y, p.w, h, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = .25; ctx.beginPath(); for (let x = p.x + 14; x < p.x + p.w - 8; x += 22) { ctx.moveTo(x, p.y + 6); ctx.lineTo(x - 8, p.y + h - 6); } ctx.stroke(); ctx.restore(); });
  }
  function drawFighter(f) {
    if (!f.alive) return; ctx.save(); ctx.translate(f.x, f.y); if (f.inv > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = .45;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 6, 0, 0, TAU); ctx.fill();
    const bob = f.air ? 0 : Math.abs(f.vx) > 20 ? Math.sin(t * 16) * 3 : Math.sin(t * 3) * 1.2, lean = clamp(f.vx / 700, -.2, .2), sp = f.spr;
    ctx.save(); ctx.scale(f.face, 1); ctx.rotate(lean); if (f.flash > 0) ctx.filter = 'brightness(2.2)'; ctx.drawImage(sp, -sp.width / 2, -sp.height + bob + 2); ctx.filter = 'none'; ctx.restore();
    const w = f.wsp, wl = f.wl, k = wl / w.width, wh = w.height * k, a = f.atk >= 0 ? -1.1 + 2 * Math.min(1, f.atk) : -.55 + Math.sin(t * 3 + f.x) * .06;
    ctx.save(); ctx.translate(f.face * 12, -46 + bob); ctx.scale(f.face, 1); ctx.rotate(a); ctx.drawImage(w, -4, -wh / 2, wl, wh);
    if (f.atk > .25 && f.atk < .8) { ctx.globalAlpha = .35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, wl + 4, -1.1, a); ctx.stroke(); } ctx.restore(); ctx.restore();
    const bw = 54, bx = f.x - bw / 2, by = f.y - 100; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8); ctx.fillStyle = f.human ? '#7be0c3' : f.color; ctx.fillRect(bx, by, bw * clamp(f.hp / f.max, 0, 1), 6);
    ctx.font = '700 11px Nunito,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#fff'; ctx.strokeText(f.name, f.x, by - 4); ctx.fillText(f.name, f.x, by - 4);
  }
  function drawHUD() {
    const me = F[0]; if (!me) return; ctx.save(); ctx.font = '700 15px Fredoka,sans-serif'; ctx.textBaseline = 'middle';
    const txt = cfg.mode === 'duel' ? 'Round ' + round + '   You ' + wins[0] + ' – ' + wins[1] : cfg.mode === 'rumble' ? 'Wave ' + wave + '   KOs ' + me.kos : F.map(f => (f.human ? 'You' : f.name.slice(0, 4)) + ' ' + f.kos).join(' · ') + '   ⏱ ' + Math.max(0, Math.ceil(timeLeft));
    ctx.textAlign = 'center'; const w = ctx.measureText(txt).width + 28; ctx.fillStyle = 'rgba(20,12,40,.7)'; Art.rr(ctx, 400 - w / 2, 10, w, 28, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, 400, 25);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; Art.rr(ctx, 16, 12, 170, 18, 9); ctx.fill(); ctx.fillStyle = '#7be0c3'; if (me.hp > 0) { Art.rr(ctx, 18, 14, Math.max(8, 166 * clamp(me.hp / me.max, 0, 1)), 14, 7); ctx.fill(); } ctx.restore();
  }
  function render() {
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.fillStyle = '#10091f'; ctx.fillRect(0, 0, S.W, S.H); if (!F.length || state === 'menu') return;
    ctx.save(); ctx.translate(ox + (Math.random() - .5) * shake * sc, oy + (Math.random() - .5) * shake * sc); ctx.scale(sc, sc); ctx.beginPath(); ctx.rect(0, 0, WW, WH); ctx.clip(); drawBG(); drawPlats(); F.forEach(drawFighter);
    shots.forEach(s => { ctx.fillStyle = s.col; ctx.strokeStyle = '#1b1b2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, 12, 8, 0, 0, TAU); ctx.fill(); ctx.stroke(); });
    parts.forEach(p => { ctx.globalAlpha = clamp(p.life * 3, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.font = '800 20px Fredoka,sans-serif'; ctx.textAlign = 'center'; texts.forEach(x => { ctx.globalAlpha = clamp(x.t * 2, 0, 1); ctx.lineWidth = 4; ctx.strokeStyle = '#1b1b2f'; ctx.strokeText(x.s, x.x, x.y); ctx.fillStyle = '#ffd23f'; ctx.fillText(x.s, x.x, x.y); }); ctx.globalAlpha = 1; drawHUD(); ctx.restore();
  }
  function settle(dt) { F.forEach(f => { f.vy += 1500 * dt; const py = f.y; f.y += f.vy * dt; for (const p of plats) if (f.x >= p.x && f.x <= p.x + p.w && py <= p.y + 6 && f.y >= p.y) { f.y = p.y; f.vy = 0; f.air = false; } }); }
  Kit.loop(dt => {
    S.watch(dt);
    if (state === 'count') { banner -= dt; if (banner <= 0) { state = 'fight'; Kit.banner('FIGHT!', ''); } else settle(dt); }
    else if (state === 'fight' || state === 'roundEnd') { step(dt); if (state === 'fight') { if (cfg.mode === 'melee') timeLeft -= dt; checkEnd(); } }
    else if (state === 'over') step(dt * .3);
    if (state !== 'paused') render();
  });
  /* ---------------- menus ---------------- */
  function pauseGame() { if (state === 'fight' || state === 'count') { state = 'paused'; Kit.show('pause'); } }
  function resume() { Kit.hideScreens(); state = 'fight'; }
  function quit() { state = 'menu'; F = []; Kit.hideScreens(); showCtl(false); $('hud').classList.remove('show'); Kit.show('title'); }
  Kit.wire({ onPause: pauseGame, onResume: resume, onQuit: quit });
  $('btnPlay').onclick = () => { Kit.hideScreens(); $('studio').classList.add('show'); };
  $('btnToModes').onclick = () => { if (commitDrawings()) { $('studio').classList.remove('show'); Kit.show('modes'); } };
  $('btnStudioBack').onclick = () => { $('studio').classList.remove('show'); Kit.show('title'); };
  $('btnModesBack').onclick = () => { Kit.hideScreens(); $('studio').classList.add('show'); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b)); });
  const sg = $('stageRow'); STAGES.forEach((s, i) => { const b = document.createElement('button'); b.className = 'mini' + (i === 0 ? ' on' : ''); b.type = 'button'; b.textContent = s.name; b.onclick = () => { cfg.stage = i; sg.querySelectorAll('.mini').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sg.appendChild(b); });
  const dg = $('diffRow'); ['Easy', 'Normal', 'Hard'].forEach((n, i) => { const b = document.createElement('button'); b.className = 'mini' + (i === 1 ? ' on' : ''); b.type = 'button'; b.textContent = n; b.onclick = () => { cfg.diff = [.7, 1, 1.4][i]; dg.querySelectorAll('.mini').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; dg.appendChild(b); });
  $('btnGo').onclick = begin; $('btnAgain').onclick = begin; $('btnMenu').onclick = () => { Kit.hideScreens(); Kit.show('modes'); }; $('btnRestart').onclick = begin;
  (function titleArt() { const c = $('heroArt'), x = c.getContext('2d'); c.width = 680; c.height = 240; for (let i = 0; i < 6; i++) { const s = Art.sprite(P.char(i), 100, 150); x.drawImage(s, 20 + i * 108, 236 - s.height); } })();
  initStudio(); Kit.show('title');
  window.__aw = { F: () => F, cfg, begin, state: () => state, commit: commitDrawings, kill: i => { F[i].hp = 0; ko(F[i], F[0]); }, pads };
})();
