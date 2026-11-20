/* Chess - full rules (castling, en passant, promotion, check/mate/draws) with a CPU opponent. */
(function () {
  'use strict';
  const T = CardTable.create({ id: 'chess', back: 'navy', noAuto: true }), K = T.K, stage = T.stage;
  T.stage.querySelector('.ibtn[aria-label="Speed"]') && 0;
  const V = BoardKit.create(T);
  (function () { const st = stage.querySelector('.status'); st.style.cssText += ';left:auto;transform:none;white-space:normal;max-width:118px;text-align:center'; T.placeStatus = () => { const f = T.G.f; st.style.left = (f.x + 4) + 'px'; st.style.top = (f.y + f.h / 2 - 118) + 'px'; }; })();
  V.cv.style.visibility = 'hidden';
  /* ---------- engine ---------- */
  const P = 1, Nn = 2, B = 3, R = 4, Q = 5, Kg = 6;
  const VAL = [0, 100, 320, 330, 500, 900, 20000];
  const PST = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], KD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]], BD = [[-1, -1], [-1, 1], [1, -1], [1, 1]], RD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function initial() {
    const b = new Int8Array(64), back = [R, Nn, B, Q, Kg, B, Nn, R];
    for (let c = 0; c < 8; c++) { b[c] = -back[c]; b[8 + c] = -P; b[48 + c] = P; b[56 + c] = back[c]; }
    return { b, turn: 1, castle: 15, ep: -1, half: 0, full: 1 };
  }
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  function attacked(b, sq, by) { /* is sq attacked by color `by` */
    const r = sq >> 3, c = sq & 7;
    const pr = r + (by === 1 ? 1 : -1); for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr * 8 + c + dc] === by * P) return true;
    for (const [dr, dc] of KN) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by * Nn) return true;
    for (const [dr, dc] of KD) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by * Kg) return true;
    for (const [dr, dc] of BD) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (p === by * B || p === by * Q) return true; break; } rr += dr; cc += dc; } }
    for (const [dr, dc] of RD) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (p === by * R || p === by * Q) return true; break; } rr += dr; cc += dc; } }
    return false;
  }
  const kingSq = (b, col) => b.indexOf(col * Kg);
  const inCheck = (st, col) => attacked(st.b, kingSq(st.b, col), -col);
  function pseudo(st, caps) {
    const { b, turn: t } = st, out = [];
    const add = (f, to, fl) => { out.push({ f, t: to, fl: fl || 0 }); };
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p || Math.sign(p) !== t) continue; const type = Math.abs(p), r = sq >> 3, c = sq & 7;
      if (type === P) {
        const dir = t === 1 ? -1 : 1, start = t === 1 ? 6 : 1, last = t === 1 ? 0 : 7, r1 = r + dir;
        if (inb(r1, c) && !b[r1 * 8 + c] && !caps) { if (r1 === last) for (const pr of [Q, R, B, Nn]) out.push({ f: sq, t: r1 * 8 + c, fl: 0, pr }); else { add(sq, r1 * 8 + c); if (r === start && !b[(r + 2 * dir) * 8 + c]) add(sq, (r + 2 * dir) * 8 + c, 4); } }
        for (const dc of [-1, 1]) { const cc = c + dc; if (!inb(r1, cc)) continue; const to = r1 * 8 + cc, tp = b[to]; if (tp && Math.sign(tp) === -t) { if (r1 === last) for (const pr of [Q, R, B, Nn]) out.push({ f: sq, t: to, fl: 1, pr }); else add(sq, to, 1); } else if (to === st.ep) add(sq, to, 3); }
      } else if (type === Nn || type === Kg) {
        for (const [dr, dc] of (type === Nn ? KN : KD)) { const rr = r + dr, cc = c + dc; if (!inb(rr, cc)) continue; const to = rr * 8 + cc, tp = b[to]; if (!tp) { if (!caps) add(sq, to); } else if (Math.sign(tp) === -t) add(sq, to, 1); }
        if (type === Kg && !caps) {
          const row = t === 1 ? 56 : 0, ks = t === 1 ? 1 : 4, qs = t === 1 ? 2 : 8;
          if (sq === row + 4 && !attacked(b, sq, -t)) {
            if ((st.castle & ks) && !b[row + 5] && !b[row + 6] && b[row + 7] === t * R && !attacked(b, row + 5, -t) && !attacked(b, row + 6, -t)) add(sq, row + 6, 8);
            if ((st.castle & qs) && !b[row + 3] && !b[row + 2] && !b[row + 1] && b[row] === t * R && !attacked(b, row + 3, -t) && !attacked(b, row + 2, -t)) add(sq, row + 2, 16);
          }
        }
      } else {
        const dirs = type === B ? BD : type === R ? RD : KD;
        for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const to = rr * 8 + cc, tp = b[to]; if (!tp) { if (!caps) add(sq, to); } else { if (Math.sign(tp) === -t) add(sq, to, 1); break; } rr += dr; cc += dc; } }
      }
    }
    return out;
  }
  function make(st, m) {
    const b = new Int8Array(st.b), p = b[m.f], t = st.turn, type = Math.abs(p); let castle = st.castle, ep = -1, half = st.half + 1;
    const cap = b[m.t] !== 0 || (m.fl & 2);
    b[m.t] = m.pr ? t * m.pr : p; b[m.f] = 0;
    if (m.fl === 3) b[m.t + (t === 1 ? 8 : -8)] = 0;
    if (m.fl === 4) ep = (m.f + m.t) >> 1;
    if (m.fl === 8) { b[m.f + 3] = 0; b[m.f + 1] = t * R; }
    if (m.fl === 16) { b[m.f - 4] = 0; b[m.f - 1] = t * R; }
    if (type === Kg) castle &= t === 1 ? ~3 : ~12;
    if (m.f === 63 || m.t === 63) castle &= ~1; if (m.f === 56 || m.t === 56) castle &= ~2; if (m.f === 7 || m.t === 7) castle &= ~4; if (m.f === 0 || m.t === 0) castle &= ~8;
    if (type === P || cap || (m.fl & 1)) half = 0;
    return { b, turn: -t, castle, ep, half, full: st.full + (t === -1 ? 1 : 0) };
  }
  function legal(st) { const out = []; for (const m of pseudo(st)) { const n = make(st, m); if (!attacked(n.b, kingSq(n.b, st.turn), -st.turn)) out.push(m); } return out; }
  function evaluate(st) { /* from side-to-move view */
    let s = 0; const b = st.b;
    for (let sq = 0; sq < 64; sq++) { const p = b[sq]; if (!p) continue; const t = Math.sign(p), ty = Math.abs(p); const idx = t === 1 ? sq : (7 - (sq >> 3)) * 8 + (sq & 7); s += t * (VAL[ty] + PST[ty][idx]); }
    return s * st.turn;
  }
  let deadline = 0, nodes = 0;
  function order(st, ms) { const b = st.b; return ms.sort((a, c) => score(b, c) - score(b, a)); }
  function score(b, m) { let s = 0; const cp = Math.abs(b[m.t]); if (cp) s += 10 * VAL[cp] - VAL[Math.abs(b[m.f])] / 10; if (m.pr) s += VAL[m.pr]; if (m.fl & 24) s += 30; return s; }
  function quiesce(st, a, bt, d) {
    const st0 = evaluate(st); if (d <= 0) return st0; if (st0 >= bt) return st0; if (st0 > a) a = st0;
    for (const m of order(st, pseudo(st, true))) { const n = make(st, m); if (attacked(n.b, kingSq(n.b, st.turn), -st.turn)) continue; const v = -quiesce(n, -bt, -a, d - 1); if (v >= bt) return v; if (v > a) a = v; }
    return a;
  }
  function search(st, d, a, bt, ply) {
    if ((++nodes & 1023) === 0 && performance.now() > deadline) throw 'time';
    if (st.half >= 100) return 0;
    if (d <= 0) return quiesce(st, a, bt, 4);
    const ms = order(st, legal(st)); if (!ms.length) return inCheck(st, st.turn) ? -30000 + ply : 0;
    for (const m of ms) { const v = -search(make(st, m), d - 1, -bt, -a, ply + 1); if (v >= bt) return v; if (v > a) a = v; }
    return a;
  }
  function bestMove(st, depth, ms, ms_limit, noise) {
    ms = ms || legal(st); if (!ms.length) return null; ms = order(st, ms.slice());
    deadline = performance.now() + ms_limit; nodes = 0; let best = ms[0], scores = null;
    for (let d = 1; d <= depth; d++) {
      try {
        let a = -1e9, cur = null, sc = [];
        for (const m of ms) { const v = -search(make(st, m), d - 1, -1e9, noise ? 1e9 : -a, 1); sc.push({ m, v }); if (v > a) { a = v; cur = m; } }
        best = cur; scores = sc; ms = sc.slice().sort((x, y) => y.v - x.v).map(x => x.m);
      } catch (e) { if (e !== 'time') throw e; break; }
    }
    if (noise && scores) { const top = scores.reduce((m, x) => Math.max(m, x.v), -1e9); const pool = scores.filter(x => x.v >= top - noise); return pool[K.rand(pool.length)].m; }
    return best;
  }
  /* ---------- state / game ---------- */
  let S = null, token = 0;
  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  V.drawPiece = function (c, p, x, y, cs) {
    const t = Math.sign(p), g = GLYPH[Math.abs(p)] + '︎';
    c.font = Math.round(cs * .82) + 'px "Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols","DejaVu Sans",serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = cs * .06; c.strokeStyle = t === 1 ? '#2a1a0c' : '#f3e4bd'; c.fillStyle = t === 1 ? '#fffdf4' : '#241d1a';
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = cs * .08; c.shadowOffsetY = cs * .03; c.strokeText(g, x, y + cs * .04); c.shadowColor = 'transparent'; c.fillText(g, x, y + cs * .04);
  };
  const fileOf = sq => 'abcdefgh'[sq & 7], rankOf = sq => 8 - (sq >> 3);
  const sqName = sq => fileOf(sq) + rankOf(sq);
  function san(st, m) {
    const p = Math.abs(st.b[m.f]), cap = st.b[m.t] || m.fl === 3; if (m.fl === 8) return 'O-O'; if (m.fl === 16) return 'O-O-O';
    let s = p === P ? (cap ? fileOf(m.f) + 'x' : '') : 'PNBRQK'[p - 1] + (cap ? 'x' : ''); s += sqName(m.t); if (m.pr) s += '=' + 'PNBRQK'[m.pr - 1];
    const n = make(st, m); if (inCheck(n, n.turn)) s += legal(n).length ? '+' : '#'; return s;
  }
  function resetHL() { V.hl = {}; if (S.last) { V.hl[S.last.f] = 'last'; V.hl[S.last.t] = 'last'; } if (inCheck(S.st, S.st.turn)) V.hl[kingSq(S.st.b, S.st.turn)] = 'check'; }
  function seatInfo() {
    const opp = S.mode === 'cpu' ? S.cpuColor : -S.myColor; // left seat shows the side at top
    [[1, opp], [3, -opp]].forEach(([seat, col]) => { const nm = (col === 1 ? 'White' : 'Black'); T.seatText(seat, (S.st.turn === col && !S.over ? '● ' : '') + nm, S.cap[String(col)].sort((a, b) => b - a).map(p => GLYPH[p]).join('') || ' '); T.seatsEl[seat].classList.toggle('turn', S.st.turn === col && !S.over); });
  }
  async function start(o, sess) {
    const t = ++token; T.token = t; T.clearActions(); K.mountTable(stage); T.geo(); V.layout(); T.placeStatus(); V.cv.style.visibility = 'visible';
    const me = sess ? (sess.me === 0 ? 1 : -1) : o.side === 'random' ? (K.rand(2) ? 1 : -1) : o.side === 'black' ? -1 : 1;
    S = { st: initial(), mode: sess ? 'online' : o.mode, sess, myColor: me, cpuColor: -me, level: o.level, moves: [], hist: [], keys: new Map(), cap: { 1: [], '-1': [] }, last: null, over: false, sel: -1, busy: false, nm: 0, hint: null };
    S.cap = { '1': [], '-1': [] };
    const P0 = K.Profile.get();
    const names = S.mode === 'cpu' ? [P0.name || 'You', ['Pawny', 'Knightly', 'The Grandmaster'][['easy', 'medium', 'hard'].indexOf(o.level)] || 'CPU'] : ['White', 'Black'];
    const oppP = sess && sess.players[1 - sess.me], meP = sess && sess.players[sess.me];
    T.buildSeats([, { name: sess ? oppP.name : (S.mode === 'cpu' ? names[1] : 'Black'), av: sess ? oppP.av : { g: 5, c: 7 } }, , { name: sess ? meP.name : (S.mode === 'cpu' ? names[0] : 'White'), av: sess ? meP.av : P0.av }]);
    if (sess) { sess.on('mv', d => { if (S.over) return; const ms = legal(S.st).filter(x => x.f === d.f && x.t === d.t && (!d.pr || x.pr === d.pr)); if (ms.length) doMove(ms, false); }); sess.on('resign', () => { if (!S.over) end({ w: S.myColor, why: 'Opponent resigned' }); }); sess.onLeave = () => { if (!S.over) end({ w: S.myColor, why: 'Opponent left the game' }); }; }
    V.flip = S.mode !== 'local' ? me === -1 : false; V.pieceAt = sq => S.st.b[sq] || null; V.onTap = onTap;
    pushKey(); resetHL(); V.render(); seatInfo(); setBtns(); UI.setInGame(true); T.inGame = true;
    K.Profile.game('chess').played++; K.Profile.save(); T.status(turnText());
    if (S.mode === 'cpu' && S.st.turn === S.cpuColor) cpuMove();
  }
  const turnText = () => S.over ? '' : (S.mode !== 'local' ? (S.st.turn === S.myColor ? 'Your move' : (S.mode === 'online' ? "Opponent's move" : 'Thinking...')) : (S.st.turn === 1 ? 'White to move' : 'Black to move'));
  const key = st => Array.from(st.b).join(',') + st.turn + st.castle + st.ep;
  function pushKey() { const k = key(S.st); S.keys.set(k, (S.keys.get(k) || 0) + 1); return S.keys.get(k); }
  function myTurn() { return !S.over && !S.busy && (S.mode === 'local' || S.st.turn === S.myColor); }
  function onTap(sq) {
    if (!S || !myTurn()) return; const p = S.st.b[sq], ms = legal(S.st);
    if (S.sel >= 0) { const cand = ms.filter(m => m.f === S.sel && m.t === sq); if (cand.length) return doMove(cand, true); }
    if (p && Math.sign(p) === S.st.turn) { S.sel = sq; resetHL(); V.hl[sq] = 'sel'; ms.filter(m => m.f === sq).forEach(m => { V.hl[m.t] = (S.st.b[m.t] || m.fl === 3) ? 'cap' : 'move'; }); K.sfx.tick(); } else { S.sel = -1; resetHL(); }
    V.render();
  }
  async function doMove(cand, human) {
    let m = cand[0];
    if (cand.length > 1 && cand[0].pr) { if (human) { const pr = await askPromo(); m = cand.find(x => x.pr === pr) || cand[0]; } else m = cand.find(x => x.pr === Q) || cand[0]; }
    if (human && S.mode === 'online') S.sess.send('mv', { f: m.f, t: m.t, pr: m.pr || 0 });
    S.busy = true; S.sel = -1; S.hint = null; const st = S.st, text = san(st, m), mover = st.turn, piece = st.b[m.f];
    const captured = m.fl === 3 ? -mover * P : st.b[m.t]; S.hist.push({ st, last: S.last, cap: { '1': S.cap['1'].slice(), '-1': S.cap['-1'].slice() }, text });
    V.hl = {}; const view = S.st; S.st = make(st, m); S.last = m;
    /* hide destination during slide */
    V.pieceAt = sq => sq === m.f ? null : (S.st.b[sq] || null);
    const sw = S.st; resetHL(); V.render();
    const slide = V.animate(m.f, m.t, m.pr ? mover * P : piece, 260, null);
    if (m.fl === 8 || m.fl === 16) { const rf = m.fl === 8 ? m.f + 3 : m.f - 4, rt = m.fl === 8 ? m.f + 1 : m.f - 1; V.animate(rf, rt, mover * R, 260); }
    await slide; V.pieceAt = sq => S.st.b[sq] || null;
    if (captured) { S.cap[String(mover)].push(Math.abs(captured)); K.sfx.flip(); } else K.sfx.deal();
    S.moves.push(text); S.nm++; resetHL(); V.render(); seatInfo();
    const reps = pushKey(), ms = legal(S.st), chk = inCheck(S.st, S.st.turn);
    S.busy = false;
    let res = null;
    if (!ms.length) res = chk ? { w: mover, why: 'Checkmate' } : { w: 0, why: 'Stalemate' };
    else if (S.st.half >= 100) res = { w: 0, why: 'Fifty-move rule' }; else if (reps >= 3) res = { w: 0, why: 'Threefold repetition' }; else if (insufficient(S.st.b)) res = { w: 0, why: 'Insufficient material' };
    if (res) return end(res);
    T.status(turnText() + (chk ? ' — check!' : '')); if (chk) K.sfx.queen();
    if (S.mode === 'cpu' && S.st.turn === S.cpuColor) cpuMove();
  }
  function insufficient(b) { const ps = []; for (let i = 0; i < 64; i++) if (b[i] && Math.abs(b[i]) !== Kg) ps.push(Math.abs(b[i])); if (!ps.length) return true; if (ps.length === 1 && (ps[0] === B || ps[0] === Nn)) return true; return false; }
  function cpuMove() {
    const t = token, depth = { easy: 2, medium: 3, hard: 6 }[S.level] || 3, ms = legal(S.st), lim = { easy: 250, medium: 700, hard: 2000 }[S.level] || 700, noise = { easy: 120, medium: 20, hard: 0 }[S.level];
    S.busy = true; setTimeout(() => { if (t !== token) return; const m = bestMove(S.st, depth, ms, lim, noise); S.busy = false; if (t !== token || !m) return; doMove([m].concat(ms.filter(x => x !== m && x.f === m.f && x.t === m.t)), false); }, 350 * T.SP);
  }
  function askPromo() {
    return new Promise(res => { const col = S.st.turn; const m = K.modal('<h2>Promote pawn</h2><div class="row" style="justify-content:center;gap:10px">' + [Q, R, B, Nn].map(p => '<button class="btn" data-p="' + p + '" style="font-size:34px;padding:6px 14px;font-family:\'Noto Sans Symbols 2\',\'Segoe UI Symbol\',serif">' + GLYPH[p] + '︎</button>').join('') + '</div>', { sticky: true }); m.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { m.close(); res(+b.dataset.p); } }); });
  }
  async function end(r) {
    S.over = true; T.status(''); resetHL(); V.render(); seatInfo();
    const vsMe = S.mode !== 'local', mine = vsMe ? r.w === S.myColor : r.w !== 0; const draw = r.w === 0;
    if (draw) K.sfx.lose();
    const st = K.Profile.game('chess'); if (draw) { /* draws count as played only */ }
    const who = draw ? 'Draw' : vsMe ? (mine ? 'You win!' : (S.mode === 'online' ? 'Opponent wins' : 'CPU wins')) : (r.w === 1 ? 'White wins' : 'Black wins');
    T.finish({ won: vsMe && mine, title: who, sub: r.why + ' after ' + Math.ceil(S.nm / 2) + ' moves.', rows: '', rounds: 1, roundsWon: vsMe && mine ? 1 : 0, best: S.nm, base: S.mode !== 'local' ? (S.mode === 'online' ? 50 :  ({ easy: 20, medium: 40, hard: 70 }[S.level] || 30)) : 10, winBonus: S.mode === 'online' ? 80 : ({ easy: 40, medium: 90, hard: 180 }[S.level] || 60), mult: draw ? .6 : 1, onChoice: a => { if (S.sess) S.sess.close(); if (a === 'again' && S.mode !== 'online') { const o = UI.setup(); start(o); } else UI.showMenu(); } });
  }
  /* ---------- side buttons ---------- */
  let btns = {};
  function sbtn(txt, fn) { const b = document.createElement('button'); b.className = 'btn sm ghost'; b.textContent = txt; b.style.cssText = 'position:absolute;z-index:160;width:64px;padding:7px 4px'; b.onclick = fn; stage.appendChild(b); return b; }
  function setBtns() {
    if (btns.hint) return;
    btns.hint = sbtn('Hint', () => { if (!S || !myTurn() || S.mode === 'online') return; const m = bestMove(S.st, 3, legal(S.st), 700, 0); if (m) { resetHL(); V.hl[m.f] = 'hint'; V.hl[m.t] = 'hint'; V.render(); } });
    btns.undo = sbtn('Undo', () => { if (!S || S.busy || S.over || !S.hist.length || S.mode === 'online') return; const n = S.mode === 'cpu' ? (S.hist.length >= 2 ? 2 : (S.myColor === 1 ? 1 : 0)) : 1; for (let i = 0; i < n && S.hist.length; i++) { const h = S.hist.pop(); S.st = h.st; S.last = h.last; S.cap = h.cap; S.moves.pop(); S.nm--; } S.keys = new Map(); pushKey(); S.sel = -1; resetHL(); V.render(); seatInfo(); T.status(turnText()); });
    btns.resign = sbtn('Resign', () => { if (!S || S.over) return; const m = K.modal('<h2>Resign?</h2><p>This counts as a loss.</p><div class="row"><button class="btn ghost" data-close>Keep playing</button><button class="btn" data-r>Resign</button></div>'); m.addEventListener('click', e => { if (e.target.closest('[data-r]')) { m.close(); if (S.mode === 'online') S.sess.send('resign', {}); end({ w: S.mode === 'local' ? -S.st.turn : -S.myColor, why: 'Resignation' }); } }); });
    placeBtns();
  }
  function placeBtns() { if (!btns.hint) return; const f = T.G.f; [btns.hint, btns.undo, btns.resign].forEach((b, i) => { b.style.left = (f.x + 6) + 'px'; b.style.top = (f.y + f.h / 2 + 24 + i * 36) + 'px'; }); }
  T.onMenu = () => UI.showMenu();
  T.relayout = function () { if (!S) return; K.clearSprites(); T.geo(); V.layout(); T.seatLayout(); placeBtns(); T.placeStatus(); };
  window.addEventListener('load', () => { T.geo(); V.layout(); });
  const rules = '<h3>Goal</h3><p>Checkmate the enemy king: attack it so it cannot escape.</p>' +
    '<h3>Playing</h3><p>Tap a piece, then a highlighted square. Castling, en passant and pawn promotion are all supported. Use <b>Hint</b> to see a strong move and <b>Undo</b> to take back a move.</p>' +
    '<h3>Draws</h3><p>Stalemate, threefold repetition, the fifty-move rule and insufficient material all end the game in a draw.</p>' +
    '<h3>Levels</h3><p>Easy makes friendly mistakes, Medium plays solid chess, Hard searches deeper and punishes errors.</p>';
  const UI = CardUI.init({
    stage, id: 'chess', title: 'CHESS', sub: 'The game of kings', rules,
    fan: [{ r: 'K', s: 'S' }, { r: 'Q', s: 'S' }, { r: 'K', s: 'H' }],
    fields: [
      { key: 'mode', label: 'Opponent', def: 'cpu', options: [{ v: 'cpu', t: 'vs CPU' }, { v: 'local', t: '2 players, one device' }, { v: 'online', t: 'Online (room code)' }] },
      { key: 'level', label: 'Level', def: 'medium', options: [{ v: 'easy', t: 'Easy' }, { v: 'medium', t: 'Medium' }, { v: 'hard', t: 'Hard' }], enabled: s => s.mode === 'cpu' },
      { key: 'side', label: 'Play as', def: 'white', options: [{ v: 'white', t: 'White' }, { v: 'black', t: 'Black' }, { v: 'random', t: 'Random' }], enabled: s => s.mode === 'cpu' }
    ],
    onPlay: opts => opts.mode === 'online' ? Multi.lobby({ game: 'chess', title: 'Chess', min: 2, max: 2, onStart: sess => start(opts, sess) }) : start(opts),
    statExtra: s => [[s.best || 0, 'Longest game']]
  });
  T.geo(); V.layout(); T.placeStatus();
  if (window.Install) Install.registerSW();
  UI.showMenu();
  window.__c = { get S() { return S; }, legal, initial, make, bestMove, doMove, V, san };
})();
