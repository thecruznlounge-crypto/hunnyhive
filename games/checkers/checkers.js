/* Checkers - American rules: forced jumps, multi-jumps, kings. */
(function () {
  'use strict';
  const T = CardTable.create({ id: 'checkers', back: 'crimson', noAuto: true }), K = T.K, stage = T.stage;
  const V = BoardKit.create(T);
  (function () { const st = stage.querySelector('.status'); st.style.cssText += ';left:auto;transform:none;white-space:normal;max-width:118px;text-align:center'; T.placeStatus = () => { const f = T.G.f; st.style.left = (f.x + 4) + 'px'; st.style.top = (f.y + f.h / 2 - 118) + 'px'; }; })();
  V.cv.style.visibility = 'hidden'; V.dark = '#6b3a1c'; V.light = '#e9d2a2'; V.label = false;
  /* pieces: 1 red man, 2 red king (move up = decreasing row); -1/-2 black */
  function initial() { const b = new Int8Array(64); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = -1; else if (r > 4) b[r * 8 + c] = 1; } return { b, turn: 1, half: 0 }; }
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  function dirsFor(p) { const t = Math.sign(p), k = Math.abs(p) === 2; const f = t === 1 ? -1 : 1; return k ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[f, -1], [f, 1]]; }
  function jumpsFrom(b, sq, p, caps, path, out) {
    const r = sq >> 3, c = sq & 7, t = Math.sign(p); let any = false;
    for (const [dr, dc] of dirsFor(p)) {
      const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc; if (!inb(lr, lc)) continue; const mid = mr * 8 + mc, land = lr * 8 + lc;
      if (Math.sign(b[mid]) === -t && b[mid] !== 0 && !caps.includes(mid) && (b[land] === 0 || land === path[0])) {
        any = true; const nc = caps.concat(mid), np = path.concat(land), promote = Math.abs(p) === 1 && (t === 1 ? lr === 0 : lr === 7);
        if (promote) out.push({ f: path[0], t: land, path: np, caps: nc }); else jumpsFrom(b, land, p, nc, np, out);
      }
    }
    if (!any && caps.length) out.push({ f: path[0], t: sq, path, caps });
  }
  function legal(st) {
    const { b, turn: t } = st, jumps = [], steps = [];
    for (let sq = 0; sq < 64; sq++) { const p = b[sq]; if (!p || Math.sign(p) !== t) continue; const r = sq >> 3, c = sq & 7; jumpsFrom(b, sq, p, [], [sq], jumps); for (const [dr, dc] of dirsFor(p)) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && !b[rr * 8 + cc]) steps.push({ f: sq, t: rr * 8 + cc, path: [sq, rr * 8 + cc], caps: [] }); } }
    return jumps.length ? jumps : steps;
  }
  function make(st, m) {
    const b = new Int8Array(st.b), p = b[m.f]; b[m.f] = 0; m.caps.forEach(q => b[q] = 0); const lr = m.t >> 3; let np = p; if (Math.abs(p) === 1 && (p > 0 ? lr === 0 : lr === 7)) np = p * 2; b[m.t] = np;
    return { b, turn: -st.turn, half: (m.caps.length || Math.abs(p) === 1) ? 0 : st.half + 1 };
  }
  function evaluate(st) { let s = 0; const b = st.b; for (let sq = 0; sq < 64; sq++) { const p = b[sq]; if (!p) continue; const t = Math.sign(p), r = sq >> 3, c = sq & 7; let v = Math.abs(p) === 2 ? 190 : 100 + (t === 1 ? 7 - r : r) * 4; if (c > 1 && c < 6 && r > 1 && r < 6) v += 4; if (Math.abs(p) === 1 && ((t === 1 && r === 7) || (t === -1 && r === 0))) v += 6; s += t * v; } return s * st.turn; }
  let deadline = 0, nodes = 0;
  function search(st, d, a, bt, ply) {
    if ((++nodes & 511) === 0 && performance.now() > deadline) throw 'time';
    if (st.half >= 80) return 0; const ms = legal(st); if (!ms.length) return -30000 + ply; if (d <= 0 && !ms[0].caps.length) return evaluate(st); if (d < -6) return evaluate(st);
    ms.sort((x, y) => y.caps.length - x.caps.length);
    for (const m of ms) { const v = -search(make(st, m), d - 1, -bt, -a, ply + 1); if (v >= bt) return v; if (v > a) a = v; } return a;
  }
  function bestMove(st, depth, ms, limit, noise) {
    ms = ms || legal(st); if (!ms.length) return null; if (ms.length === 1) return ms[0]; deadline = performance.now() + limit; nodes = 0; let best = ms[0], sc = null;
    for (let d = 1; d <= depth; d++) { try { const cur = []; let a = -1e9, bm = null; for (const m of ms) { const v = -search(make(st, m), d - 1, -1e9, noise ? 1e9 : -a, 1); cur.push({ m, v }); if (v > a) { a = v; bm = m; } } best = bm; sc = cur; ms = cur.slice().sort((x, y) => y.v - x.v).map(x => x.m); } catch (e) { if (e !== 'time') throw e; break; } }
    if (noise && sc) { const top = Math.max(...sc.map(x => x.v)), pool = sc.filter(x => x.v >= top - noise); return pool[K.rand(pool.length)].m; } return best;
  }
  /* ---------- ui ---------- */
  V.drawPiece = function (c, p, x, y, cs) {
    const t = Math.sign(p), k = Math.abs(p) === 2, r = cs * .38, col = t === 1 ? ['#ff6a5a', '#b3201a', '#6e0e0a'] : ['#6a6a76', '#26262e', '#0a0a10'];
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = cs * .1; c.shadowOffsetY = cs * .05; c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col[2]; c.fill(); c.restore();
    const g = c.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r); g.addColorStop(0, col[0]); g.addColorStop(.7, col[1]); g.addColorStop(1, col[2]); c.beginPath(); c.arc(x, y, r * .94, 0, 7); c.fillStyle = g; c.fill();
    c.lineWidth = cs * .035; c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(x, y, r * .72, 0, 7); c.stroke(); c.beginPath(); c.arc(x, y, r * .48, 0, 7); c.stroke();
    if (k) { c.fillStyle = '#ffd95a'; c.strokeStyle = '#7a5a08'; c.lineWidth = cs * .02; const w = r * .62; c.beginPath(); c.moveTo(x - w, y + w * .45); c.lineTo(x - w, y - w * .35); c.lineTo(x - w * .5, y); c.lineTo(x, y - w * .6); c.lineTo(x + w * .5, y); c.lineTo(x + w, y - w * .35); c.lineTo(x + w, y + w * .45); c.closePath(); c.fill(); c.stroke(); }
  };
  let S = null, token = 0;
  function resetHL() { V.hl = {}; if (S.last) { V.hl[S.last.f] = 'last'; V.hl[S.last.t] = 'last'; } }
  function seatInfo() {
    const opp = S.mode === 'cpu' ? S.cpuColor : -S.myColor;
    const cnt = col => { let n = 0; for (let i = 0; i < 64; i++) if (Math.sign(S.st.b[i]) === col) n++; return n; };
    [[1, opp], [3, -opp]].forEach(([seat, col]) => { T.seatText(seat, (S.st.turn === col && !S.over ? '● ' : '') + (col === 1 ? 'Red' : 'Black'), cnt(col) + ' pieces'); T.seatsEl[seat].classList.toggle('turn', S.st.turn === col && !S.over); });
  }
  const turnText = () => S.over ? '' : (S.mode !== 'local' ? (S.st.turn === S.myColor ? 'Your move' : (S.mode === 'online' ? "Opponent's move" : 'Thinking...')) : (S.st.turn === 1 ? 'Red to move' : 'Black to move'));
  async function start(o, sess) {
    const t = ++token; T.token = t; T.clearActions(); K.mountTable(stage); T.geo(); V.layout(); T.placeStatus(); V.cv.style.visibility = 'visible';
    const me = sess ? (sess.me === 0 ? 1 : -1) : o.side === 'random' ? (K.rand(2) ? 1 : -1) : o.side === 'black' ? -1 : 1, P0 = K.Profile.get();
    S = { st: initial(), mode: sess ? 'online' : o.mode, sess, myColor: me, cpuColor: -me, level: o.level, hist: [], keys: new Map(), last: null, over: false, sel: -1, busy: false, nm: 0, caps: 0 };
    const oppP = sess && sess.players[1 - sess.me], meP = sess && sess.players[sess.me];
    T.buildSeats([, { name: sess ? oppP.name : (S.mode === 'cpu' ? ['Pip', 'Dame Rose', 'King Cobra'][['easy', 'medium', 'hard'].indexOf(o.level)] || 'CPU' : 'Black'), av: sess ? oppP.av : { g: 3, c: 6 } }, , { name: sess ? meP.name : (S.mode === 'cpu' ? (P0.name || 'You') : 'Red'), av: sess ? meP.av : P0.av }]);
    if (sess) { sess.on('mv', d => { if (S.over) return; const m = legal(S.st).find(x => x.f === d.f && x.t === d.t); if (m) doMove(m, false); }); sess.on('resign', () => { if (!S.over) end({ w: S.myColor, why: 'Opponent resigned' }); }); sess.onLeave = () => { if (!S.over) end({ w: S.myColor, why: 'Opponent left the game' }); }; }
    V.flip = S.mode !== 'local' ? me === -1 : false; V.pieceAt = sq => S.st.b[sq] || null; V.onTap = onTap;
    resetHL(); V.render(); seatInfo(); UI.setInGame(true); T.inGame = true; setBtns();
    K.Profile.game('checkers').played++; K.Profile.save(); T.status(turnText());
    if (S.mode === 'cpu' && S.st.turn === S.cpuColor) cpuMove();
  }
  function myTurn() { return !S.over && !S.busy && (S.mode === 'local' || S.st.turn === S.myColor); }
  function onTap(sq) {
    if (!S || !myTurn()) return; const ms = legal(S.st), p = S.st.b[sq];
    if (S.sel >= 0) { const cand = ms.filter(m => m.f === S.sel && m.t === sq); if (cand.length) return doMove(cand[0], true); }
    const own = ms.filter(m => m.f === sq);
    if (p && Math.sign(p) === S.st.turn && own.length) { S.sel = sq; resetHL(); V.hl[sq] = 'sel'; own.forEach(m => V.hl[m.t] = m.caps.length ? 'cap' : 'move'); K.sfx.tick(); }
    else { S.sel = -1; resetHL(); if (p && Math.sign(p) === S.st.turn && ms[0] && ms[0].caps.length) T.status('You must jump!'); }
    V.render();
  }
  async function doMove(m, human) {
    if (human && S.mode === 'online') S.sess.send('mv', { f: m.f, t: m.t });
    S.busy = true; S.sel = -1; const st = S.st, mover = st.turn, piece = st.b[m.f];
    S.hist.push({ st, last: S.last, caps: S.caps }); S.st = make(st, m); S.last = m; S.nm++; S.caps += m.caps.length;
    V.pieceAt = sq => (sq === m.f || m.caps.includes(sq)) ? (m.caps.includes(sq) ? st.b[sq] : null) : (S.st.b[sq] || null);
    resetHL(); V.render(); const via = m.path.slice(1, -1);
    /* captured pieces vanish as the jumper passes: simple approach, remove after slide */
    await V.animate(m.f, m.t, piece, 240 + 160 * (m.path.length - 2), via);
    V.pieceAt = sq => S.st.b[sq] || null; if (m.caps.length) K.sfx.flip(); else K.sfx.deal();
    resetHL(); V.render(); seatInfo(); S.busy = false;
    const k = Array.from(S.st.b).join('') + S.st.turn; S.keys.set(k, (S.keys.get(k) || 0) + 1);
    const ms = legal(S.st); let res = null;
    if (!ms.length) res = { w: mover, why: 'No moves left' }; else if (S.st.half >= 80) res = { w: 0, why: '40 moves without progress' }; else if (S.keys.get(k) >= 3) res = { w: 0, why: 'Threefold repetition' };
    if (res) return end(res);
    T.status(turnText() + (ms[0].caps.length ? ' — jump!' : ''));
    if (S.mode === 'cpu' && S.st.turn === S.cpuColor) cpuMove();
  }
  function cpuMove() {
    const t = token, ms = legal(S.st), depth = { easy: 3, medium: 6, hard: 10 }[S.level] || 6, lim = { easy: 200, medium: 600, hard: 1800 }[S.level] || 600, noise = { easy: 60, medium: 8, hard: 0 }[S.level];
    S.busy = true; setTimeout(() => { if (t !== token) return; const m = bestMove(S.st, depth, ms, lim, noise); S.busy = false; if (t !== token || !m) return; doMove(m); }, 380 * T.SP);
  }
  async function end(r) {
    S.over = true; T.status(''); resetHL(); V.render(); seatInfo(); const draw = r.w === 0, vsMe = S.mode !== 'local', mine = vsMe ? r.w === S.myColor : true;
    if (draw) K.sfx.lose();
    T.finish({ won: vsMe && !draw && mine, title: draw ? 'Draw' : vsMe ? (mine ? 'You win!' : (S.mode === 'online' ? 'Opponent wins' : 'CPU wins')) : (r.w === 1 ? 'Red wins' : 'Black wins'), sub: r.why + ' after ' + Math.ceil(S.nm / 2) + ' moves.', rows: '', rounds: 1, roundsWon: vsMe && !draw && mine ? 1 : 0, best: S.caps, base: S.mode === 'online' ? 50 : S.mode === 'cpu' ? ({ easy: 20, medium: 40, hard: 70 }[S.level] || 30) : 10, winBonus: S.mode === 'online' ? 80 : ({ easy: 40, medium: 90, hard: 180 }[S.level] || 60), mult: draw ? .6 : 1, onChoice: a => { if (S.sess) S.sess.close(); if (a === 'again' && S.mode !== 'online') { const o = UI.setup(); start(o); } else UI.showMenu(); } });
  }
  let btns = {};
  function sbtn(txt, fn) { const b = document.createElement('button'); b.className = 'btn sm ghost'; b.textContent = txt; b.style.cssText = 'position:absolute;z-index:160;width:64px;padding:7px 4px'; b.onclick = fn; stage.appendChild(b); return b; }
  function setBtns() {
    if (btns.hint) return;
    btns.hint = sbtn('Hint', () => { if (!S || !myTurn() || S.mode === 'online') return; const m = bestMove(S.st, 6, legal(S.st), 600, 0); if (m) { resetHL(); V.hl[m.f] = 'hint'; V.hl[m.t] = 'hint'; V.render(); } });
    btns.undo = sbtn('Undo', () => { if (!S || S.busy || S.over || !S.hist.length || S.mode === 'online') return; const n = S.mode === 'cpu' ? (S.hist.length >= 2 ? 2 : (S.myColor === 1 ? 1 : 0)) : 1; for (let i = 0; i < n && S.hist.length; i++) { const h = S.hist.pop(); S.st = h.st; S.last = h.last; S.caps = h.caps; S.nm--; } S.sel = -1; resetHL(); V.render(); seatInfo(); T.status(turnText()); });
    btns.resign = sbtn('Resign', () => { if (!S || S.over) return; const m = K.modal('<h2>Resign?</h2><p>This counts as a loss.</p><div class="row"><button class="btn ghost" data-close>Keep playing</button><button class="btn" data-r>Resign</button></div>'); m.addEventListener('click', e => { if (e.target.closest('[data-r]')) { m.close(); if (S.mode === 'online') S.sess.send('resign', {}); end({ w: S.mode === 'local' ? -S.st.turn : -S.myColor, why: 'Resignation' }); } }); });
    placeBtns();
  }
  function placeBtns() { if (!btns.hint) return; const f = T.G.f; [btns.hint, btns.undo, btns.resign].forEach((b, i) => { b.style.left = (f.x + 6) + 'px'; b.style.top = (f.y + f.h / 2 + 24 + i * 36) + 'px'; }); }
  T.onMenu = () => UI.showMenu();
  T.relayout = function () { if (!S) return; K.clearSprites(); T.geo(); V.layout(); T.seatLayout(); placeBtns(); T.placeStatus(); };
  const rules = '<h3>Goal</h3><p>Capture all of your opponent\'s pieces or leave them with no legal move.</p>' +
    '<h3>Moving</h3><p>Pieces move one square diagonally forward. Tap a piece, then a highlighted square. <b>Jumps are mandatory</b>, and you can chain jumps in one turn.</p>' +
    '<h3>Kings</h3><p>Reach the far row to be crowned. Kings move and jump in all four diagonal directions.</p>';
  const UI = CardUI.init({
    stage, id: 'checkers', title: 'CHECKERS', sub: 'Jump, crown and conquer', rules,
    fan: [{ r: 'K', s: 'H' }, { r: 'K', s: 'S' }],
    fields: [
      { key: 'mode', label: 'Opponent', def: 'cpu', options: [{ v: 'cpu', t: 'vs CPU' }, { v: 'local', t: '2 players, one device' }, { v: 'online', t: 'Online (room code)' }] },
      { key: 'level', label: 'Level', def: 'medium', options: [{ v: 'easy', t: 'Easy' }, { v: 'medium', t: 'Medium' }, { v: 'hard', t: 'Hard' }], enabled: s => s.mode === 'cpu' },
      { key: 'side', label: 'Play as', def: 'white', options: [{ v: 'white', t: 'Red (first)' }, { v: 'black', t: 'Black' }, { v: 'random', t: 'Random' }], enabled: s => s.mode === 'cpu' }
    ],
    onPlay: opts => opts.mode === 'online' ? Multi.lobby({ game: 'checkers', title: 'Checkers', min: 2, max: 2, onStart: sess => start(opts, sess) }) : start(opts),
    statExtra: s => [[s.best || 0, 'Most captures']]
  });
  T.geo(); V.layout(); T.placeStatus();
  if (window.Install) Install.registerSW();
  UI.showMenu();
  window.__k = { get S() { return S; }, legal, doMove, initial, make, bestMove };
})();
