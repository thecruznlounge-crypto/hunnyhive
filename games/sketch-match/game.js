/* Sketch Match: see a shape, sketch it, get scored on how closely your drawing matches. */
(function () {
  'use strict';
  Kit.ns('sketch-match');
  const $ = Kit.$, rad = d => d * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
  /* ---------- shape library (unit square, y down) ---------- */
  const arc = (cx, cy, r, a0, a1, n) => { n = n || Math.max(8, Math.round(Math.abs(a1 - a0) / 8)); const o = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  const circ = (cx, cy, r) => arc(cx, cy, r, 0, 360, 36), ell = (cx, cy, rx, ry) => circ(0, 0, 1).map(p => [cx + p[0] * rx, cy + p[1] * ry]);
  const poly = (...p) => p.concat([p[0]]), line = (...p) => p;
  function star() { const o = []; for (let i = 0; i < 10; i++) { const a = rad(-90 + i * 36), r = i % 2 ? .2 : .46; o.push([.5 + r * Math.cos(a), .52 + r * Math.sin(a)]); } o.push(o[0]); return o; }
  function heart() { const o = []; for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 2; o.push([.5 + .028 * 16 * Math.pow(Math.sin(t), 3), .45 - .028 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } return o; }
  function spiral() { const o = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 5, r = .03 + a / (Math.PI * 5) * .42; o.push([.5 + r * Math.cos(a), .5 + r * Math.sin(a)]); } return o; }
  const SHAPES = [
    { n: 'circle', t: 1, s: [circ(.5, .5, .42)] },
    { n: 'square', t: 1, s: [poly([.14, .14], [.86, .14], [.86, .86], [.14, .86])] },
    { n: 'triangle', t: 1, s: [poly([.5, .1], [.9, .86], [.1, .86])] },
    { n: 'star', t: 1, s: [star()] },
    { n: 'heart', t: 1, s: [heart()] },
    { n: 'arrow', t: 1, s: [poly([.08, .38], [.55, .38], [.55, .12], [.94, .5], [.55, .88], [.55, .62], [.08, .62])] },
    { n: 'moon', t: 1, s: [arc(.5, .5, .42, 40, 320).concat(arc(.62, .5, .337, 306.8, 53.2))] },
    { n: 'lightning', t: 1, s: [poly([.58, .04], [.2, .56], [.46, .56], [.36, .96], [.8, .4], [.54, .4])] },
    { n: 'smiley', t: 1, s: [circ(.5, .5, .43), circ(.35, .4, .05), circ(.65, .4, .05), arc(.5, .5, .26, 25, 155)] },
    { n: 'house', t: 1, s: [poly([.2, .5], [.8, .5], [.8, .9], [.2, .9]), line([.1, .52], [.5, .14], [.9, .52]), poly([.42, .66], [.58, .66], [.58, .9], [.42, .9])] },
    { n: 'flower', t: 2, s: [circ(.5, .5, .09)].concat([0, 60, 120, 180, 240, 300].map(a => circ(.5 + .25 * Math.cos(rad(a)), .5 + .25 * Math.sin(rad(a)), .13)))},
    { n: 'cat', t: 2, s: [circ(.5, .6, .32), line([.2, .5], [.22, .12], [.42, .32]), line([.8, .5], [.78, .12], [.58, .32]), circ(.39, .55, .04), circ(.61, .55, .04), poly([.46, .66], [.54, .66], [.5, .71]), line([.08, .62], [.3, .66]), line([.7, .66], [.92, .62])] },
    { n: 'fish', t: 2, s: [ell(.42, .5, .34, .22), poly([.74, .5], [.96, .28], [.96, .72]), circ(.28, .44, .035)] },
    { n: 'tree', t: 2, s: [circ(.5, .36, .3), poly([.43, .64], [.57, .64], [.57, .92], [.43, .92])] },
    { n: 'key', t: 2, s: [circ(.24, .5, .18), line([.42, .5], [.92, .5]), line([.74, .5], [.74, .68]), line([.88, .5], [.88, .64])] },
    { n: 'cup', t: 2, s: [poly([.16, .2], [.78, .2], [.68, .88], [.26, .88]), arc(.78, .46, .15, -90, 90)] },
    { n: 'sailboat', t: 2, s: [poly([.08, .7], [.92, .7], [.76, .92], [.24, .92]), line([.5, .7], [.5, .08]), poly([.54, .12], [.54, .6], [.88, .6])] },
    { n: 'rocket', t: 2, s: [poly([.5, .04], [.66, .26], [.66, .7], [.34, .7], [.34, .26]), poly([.34, .52], [.14, .8], [.34, .7]), poly([.66, .52], [.86, .8], [.66, .7]), circ(.5, .36, .08), poly([.42, .7], [.5, .94], [.58, .7])] },
    { n: 'umbrella', t: 2, s: [arc(.5, .5, .42, 180, 360).concat([[.92, .5], [.08, .5]]), line([.5, .5], [.5, .84]), arc(.42, .84, .08, 0, 180)] },
    { n: 'bicycle', t: 3, s: [circ(.2, .66, .18), circ(.8, .66, .18), line([.2, .66], [.4, .38], [.7, .38], [.8, .66]), line([.4, .38], [.5, .66], [.2, .66]), line([.7, .38], [.66, .26], [.8, .26]), line([.36, .32], [.46, .32])] },
    { n: 'castle', t: 3, s: [poly([.12, .92], [.12, .32], [.24, .32], [.24, .2], [.36, .2], [.36, .32], [.46, .32], [.46, .2], [.56, .2], [.56, .32], [.66, .32], [.66, .2], [.78, .2], [.78, .32], [.88, .32], [.88, .92]), line([.42, .92], [.42, .7], [.5, .62], [.58, .7], [.58, .92])] },
    { n: 'butterfly', t: 3, s: [ell(.3, .36, .22, .2), ell(.7, .36, .22, .2), ell(.34, .7, .16, .17), ell(.66, .7, .16, .17), line([.5, .22], [.5, .88]), line([.5, .22], [.4, .08]), line([.5, .22], [.6, .08])] },
    { n: 'spiral', t: 3, s: [spiral()] }
  ];
  /* ---------- scoring ---------- */
  const G = 96, TOL = 4;
  function bbox(strokes) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; strokes.forEach(s => s.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); })); return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
  function normalize(strokes) { const b = bbox(strokes), s = (G - 20) / Math.max(b.w, b.h, 1e-6), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return strokes.map(st => st.map(p => [G / 2 + (p[0] - cx) * s, G / 2 + (p[1] - cy) * s])); }
  function mask(strokes, lw) { const c = document.createElement('canvas'); c.width = c.height = G; const x = c.getContext('2d'); x.lineCap = x.lineJoin = 'round'; x.lineWidth = lw; x.strokeStyle = '#000'; x.fillStyle = '#000'; strokes.forEach(st => { if (st.length < 2) { x.beginPath(); x.arc(st[0][0], st[0][1], lw / 2, 0, 7); x.fill(); return; } x.beginPath(); st.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }); const d = x.getImageData(0, 0, G, G).data, m = new Uint8Array(G * G); for (let i = 0; i < G * G; i++) m[i] = d[i * 4 + 3] > 80 ? 1 : 0; return m; }
  function count(m) { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; }
  function overlapN(a, b, dx, dy) { let n = 0; for (let y = 0; y < G; y++) { const yy = y + dy; if (yy < 0 || yy >= G) continue; for (let x = 0; x < G; x++) { if (!a[y * G + x]) continue; const xx = x + dx; if (xx >= 0 && xx < G && b[yy * G + xx]) n++; } } return n; }
  function score(target, user) {
    const ub = bbox(user); if (Math.max(ub.w, ub.h) < 40) return { pct: 0, f: 0, nu: user };
    const T = normalize(target), U = normalize(user), t0 = mask(T, 3), td = mask(T, 3 + TOL * 2), u0 = mask(U, 3), ud = mask(U, 3 + TOL * 2), nt = count(t0), nu = count(u0); let best = 0;
    for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) { const p = overlapN(u0, td, dx, dy) / nu, r = overlapN(t0, ud, -dx, -dy) / nt, f = p + r ? 2 * p * r / (p + r) : 0; if (f > best) best = f; }
    return { pct: Math.round(clamp((best - .5) / .42, 0, 1) * 100), f: best, T, U };
  }
  const starsFor = p => p >= 85 ? 3 : p >= 65 ? 2 : p >= 45 ? 1 : 0;
  /* ---------- drawing the target ---------- */
  function paint(cv, strokes, o) {
    o = o || {}; const x = cv.getContext('2d'), W = cv.width; x.clearRect(0, 0, W, W); x.lineCap = x.lineJoin = 'round'; x.lineWidth = o.lw || W * .026; x.strokeStyle = o.col || '#1b1b2f'; x.globalAlpha = o.alpha || 1; const m = W * (o.pad == null ? .08 : o.pad), sz = W - 2 * m;
    strokes.forEach(st => { x.beginPath(); st.forEach((p, i) => { const px = o.raw ? p[0] : m + p[0] * sz, py = o.raw ? p[1] : m + p[1] * sz; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }); x.globalAlpha = 1;
  }
  /* ---------- game state ---------- */
  let mode = 'memory', round = 0, total = 0, stars = 0, cur = null, results = [], players = 1, pl = 0, duel = { s: [0, 0], r: [] }, order = [], timer = 0, tmax = 1, phase = 'menu', rafT = 0, pad;
  const ROUNDS = 8;
  function pickShape(r) { const tier = r < 3 ? [1] : r < 6 ? [1, 2] : [2, 3]; const pool = SHAPES.filter(s => tier.includes(s.t) && !order.includes(s)); const s = pick(pool.length ? pool : SHAPES); order.push(s); return s; }
  function startMode(m, np) { mode = m; players = np || 1; round = 0; total = 0; stars = 0; results = []; order = []; duel = { s: [0, 0] }; nextRound(); }
  function nextRound() {
    if (round >= (players === 2 ? 3 : ROUNDS)) return finish();
    cur = pickShape(round); pl = 0; round++; showPrompt();
  }
  function showPrompt() {
    phase = 'prompt'; Kit.hideScreens(); $('hudBar').textContent = (players === 2 ? 'Player ' + (pl + 1) + ' · ' : '') + 'Round ' + round + '/' + (players === 2 ? 3 : ROUNDS);
    $('pTitle').textContent = mode === 'trace' ? 'Trace this shape' : 'Memorize this shape'; $('pName').textContent = cur.n;
    paint($('tgt'), cur.s, { lw: 11 }); Kit.show('prompt');
    if (mode === 'trace') { tmax = 0; $('pBar').parentNode.style.display = 'none'; $('btnReady').textContent = 'Start tracing'; }
    else { tmax = Math.max(1.6, 4.2 - round * .25); timer = tmax; $('pBar').parentNode.style.display = ''; $('btnReady').textContent = "I'm ready"; }
  }
  function startDraw() {
    phase = 'draw'; Kit.show('draw'); pad.clear(); pad.color = '#1b1b2f'; pad.erase = false; $('btnErase').classList.remove('on');
    const g = $('guide'); g.getContext('2d').clearRect(0, 0, g.width, g.height); if (mode === 'trace') paint(g, cur.s, { lw: 10, col: '#3a86ff', alpha: .28 });
    $('dTitle').textContent = (players === 2 ? 'Player ' + (pl + 1) + ': ' : '') + (mode === 'trace' ? 'Trace the ' : 'Draw the ') + cur.n; $('dBar').parentNode.style.display = mode === 'trace' ? 'none' : ''; timer = tmax = 25;
  }
  function submit() {
    if (phase !== 'draw') return; phase = 'result'; const user = pad.strokes.filter(s => !s.erase).map(s => s.pts.map(p => [p[0], p[1]])), tgt = cur.s.map(s => s.map(p => [p[0] * 512, p[1] * 512]));
    const r = user.length ? score(tgt, user) : { pct: 0, f: 0 };
    if (players === 2) { duel.s[pl] += r.pct; duel['r' + pl] = r; if (pl === 0) { pl = 1; Kit.show('pass'); $('passTxt').textContent = 'Player 2, your turn!'; phase = 'pass'; return; } return showResult(duel.r0, duel.r1); }
    total += r.pct; const st = starsFor(r.pct); stars += st; results.push({ n: cur.n, pct: r.pct }); showResult(r);
  }
  function showResult(r, r2) {
    Kit.show('result'); const c = $('cmp'); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    const draw = (rr, col) => { if (!rr || !rr.T) return; const T = rr.T, U = rr.U; x.lineCap = x.lineJoin = 'round'; const k = c.width / G; x.lineWidth = 9; x.globalAlpha = .55; x.strokeStyle = '#2ec4b6'; T.forEach(s => { x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.stroke(); }); x.globalAlpha = 1; x.lineWidth = 5; x.strokeStyle = col; U.forEach(s => { x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.stroke(); }); };
    if (players === 2) { draw(r2, '#ff5d8f'); $('rBig').textContent = 'P1 ' + r.pct + '%  ·  P2 ' + r2.pct + '%'; $('rStars').textContent = r.pct === r2.pct ? 'Tie!' : (r.pct > r2.pct ? 'Player 1' : 'Player 2') + ' wins the round'; if (r.pct > r2.pct) duel.w = 0; Kit.tone(520, .2, 'triangle', .1, 200); }
    else { draw(r, '#ff5d8f'); const st = starsFor(r.pct); $('rBig').textContent = r.pct + '% match'; $('rStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st); Kit.tone(300 + st * 160, .25, 'triangle', .1, 250); if (st === 3) Kit.vibe(30); }
    $('btnNext').textContent = round >= (players === 2 ? 3 : ROUNDS) ? 'Results' : 'Next shape'; $('rMsg').textContent = players === 2 ? '' : (r.pct >= 85 ? 'Spot on!' : r.pct >= 65 ? 'Nice sketch' : r.pct >= 40 ? 'Getting there' : 'Try tracing slower');
  }
  function finish() {
    phase = 'over'; Kit.show('over');
    if (players === 2) { const a = duel.s[0], b = duel.s[1]; $('oTitle').textContent = a === b ? 'Draw!' : (a > b ? 'Player 1 wins!' : 'Player 2 wins!'); $('oStats').innerHTML = 'Player 1 <b>' + a + '</b> · Player 2 <b>' + b + '</b>'; return; }
    const key = 'best_' + mode, best = Kit.get(key, 0), nb = total > best; if (nb) Kit.set(key, total);
    $('oTitle').textContent = stars >= ROUNDS * 2 ? 'Master sketcher!' : stars >= ROUNDS ? 'Great hands!' : 'Keep sketching';
    $('oStats').innerHTML = 'Score <b>' + total + '</b> · ★ <b>' + stars + '</b>/' + ROUNDS * 3 + '<br>' + (nb ? 'New best!' : 'Best ' + best);
  }
  Kit.loop(dt => {
    if (phase === 'prompt' && tmax) { timer -= dt; $('pBar').style.width = clamp(timer / tmax, 0, 1) * 100 + '%'; if (timer <= 0) startDraw(); }
    else if (phase === 'draw' && mode !== 'trace') { timer -= dt; $('dBar').style.width = clamp(timer / tmax, 0, 1) * 100 + '%'; if (timer <= 0) submit(); }
  });
  /* ---------- wiring ---------- */
  Kit.wire({ onPause: () => { }, onQuit: () => { phase = 'menu'; Kit.show('menu'); } });
  pad = Art.Pad($('pad')); pad.size = 8;
  $('btnPlay').onclick = () => Kit.show('menu');
  $('mMemory').onclick = () => startMode('memory'); $('mTrace').onclick = () => startMode('trace'); $('mDuel').onclick = () => { mode = 'memory'; startMode('memory', 2); };
  $('btnMenuBack').onclick = () => Kit.show('title');
  $('btnReady').onclick = startDraw; $('btnDone').onclick = submit; $('btnUndo').onclick = () => pad.undo(); $('btnClear').onclick = () => pad.clear();
  $('btnErase').onclick = e => { pad.erase = !pad.erase; e.currentTarget.classList.toggle('on', pad.erase); };
  $('btnPass').onclick = () => { showPrompt2(); };
  function showPrompt2() { phase = 'prompt'; $('hudBar').textContent = 'Player 2 · Round ' + round + '/3'; Kit.show('prompt'); $('pTitle').textContent = 'Memorize this shape'; timer = tmax; }
  $('btnNext').onclick = () => nextRound(); $('btnAgain').onclick = () => startMode(mode, players); $('btnOverMenu').onclick = () => Kit.show('menu');
  const colRow = $('swatches'); ['#1b1b2f', '#e63946', '#3a86ff', '#2ec4b6'].forEach((c, i) => { const b = document.createElement('button'); b.className = 'sw' + (i ? '' : ' on'); b.style.background = c; b.type = 'button'; b.onclick = () => { pad.color = c; pad.erase = false; $('btnErase').classList.remove('on'); colRow.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; colRow.appendChild(b); });
  (function titleArt() { const c = $('heroArt'); c.width = 600; c.height = 200; const x = c.getContext('2d'); ['house', 'star', 'cat'].forEach((n, i) => { const s = SHAPES.find(z => z.n === n), t = document.createElement('canvas'); t.width = t.height = 180; paint(t, s.s, { lw: 7, col: '#fff' }); x.drawImage(t, 10 + i * 200, 10); if (i === 1) { x.globalAlpha = .9; const u = document.createElement('canvas'); u.width = u.height = 180; paint(u, s.s.map(z => z.map(p => [p[0] + .02, p[1] - .015])), { lw: 6, col: '#ff5d8f' }); x.drawImage(u, 10 + i * 200, 10); x.globalAlpha = 1; } }); })();
  Kit.show('title');
  window.__sm = { SHAPES, score, setCur: n => { cur = SHAPES.find(s => s.n === n); }, startMode, submit, state: () => phase, normalize, get cur() { return cur; }, pad, startDraw };
})();
