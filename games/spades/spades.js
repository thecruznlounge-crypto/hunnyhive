/* Spades - 4 players, partnerships (you + top vs left + right). */
(function () {
  'use strict';
  const T = CardTable.create({ id: 'spades', back: 'navy' }), K = T.K, stage = T.stage, $ = K.$;
  const SUITS = ['S', 'H', 'C', 'D'], rv = c => K.rankVal(c.r);
  let S = null, GOAL = 250;
  const sb = document.createElement('div'); sb.className = 'sboard'; stage.appendChild(sb);
  function placeSb() { const f = T.G.f; sb.style.left = (f.x + 12) + 'px'; sb.style.top = (f.y + 12) + 'px'; }
  function renderSb() {
    if (!S) { sb.classList.add('hide'); return; } sb.classList.remove('hide');
    sb.innerHTML = '<span class="h">SPADES &middot; TO ' + GOAL + '</span>You + ' + S.pl[2].name + ': <b>' + S.score[0] + '</b>' + (S.bags[0] ? ' <small>(' + S.bags[0] + ' bags)</small>' : '') + '<br>' + S.pl[1].name + ' + ' + S.pl[3].name + ': <b>' + S.score[1] + '</b>' + (S.bags[1] ? ' <small>(' + S.bags[1] + ' bags)</small>' : '');
  }
  const team = s => s % 2;
  function renderSeats() { S.pl.forEach((p, i) => T.seatText(i, S.bid[i] == null ? '' : (S.bid[i] === 0 ? 'Nil' : 'Bid ' + S.bid[i]), 'Won ' + S.won[i] + ' · ' + (i === 0 ? 'You' : i === 2 ? (p.human ? 'Partner' : 'Partner · CPU') : p.human ? 'Player' : 'CPU'))); renderSb(); }

  /* ---------- rules ---------- */
  function trickWinner(trick) {
    let best = trick[0];
    for (const t of trick.slice(1)) {
      const a = t.card, b = best.card;
      if (a.s === 'S' && b.s !== 'S') best = t; else if (a.s === b.s && rv(a) > rv(b)) best = t;
    }
    return best.seat;
  }
  function legalFor(hand, trick) {
    if (!trick.length) { const ns = hand.filter(e => e.card.s !== 'S'); return (S.broken || !ns.length) ? hand : ns; }
    const ls = trick[0].card.s, f = hand.filter(e => e.card.s === ls); return f.length ? f : hand;
  }
  /* ---------- cpu ---------- */
  function estimateBid(cards) {
    const by = s => cards.filter(c => c.s === s).sort((a, b) => rv(b) - rv(a));
    let est = 0; const sp = by('S');
    sp.forEach((c, i) => { if (rv(c) >= 14) est += 1; else if (rv(c) === 13 && sp.length >= 2) est += .9; else if (rv(c) === 12 && sp.length >= 3) est += .7; else if (i >= 3) est += .8; });
    ['H', 'C', 'D'].forEach(s => { const l = by(s); if (!l.length) { est += sp.length > 2 ? .9 : 0; return; } if (l.length === 1 && sp.length > 2) est += .5; if (rv(l[0]) === 14) est += 1; if (l[1] && rv(l[1]) === 13 && rv(l[0]) === 14) est += .9; else if (rv(l[0]) === 13 && l.length >= 2) est += .7; if (l[0] && rv(l[0]) === 12 && l.length >= 3) est += .2; });
    return est;
  }
  function cpuBid(seat, cards) {
    const e = estimateBid(cards); let b = Math.round(e); const ps = S.bid[(seat + 2) % 4];
    if (e < .9) return 0; if (b < 1) b = 1; if (b > 9) b = 9; if (ps === 0 && b > 1) b -= 0; return b;
  }
  function cpuPlay(seat, legal, trick) {
    const cards = legal.map(e => e.card), nil = S.bid[seat] === 0, pnil = S.bid[(seat + 2) % 4] === 0;
    const asc = cards.slice().sort((a, b) => rv(a) - rv(b));
    const pick = c => legal.find(e => e.card === c);
    if (!trick.length) {
      if (nil) return pick(asc[0]);
      const aces = cards.filter(c => c.s !== 'S' && rv(c) === 14); if (aces.length) return pick(aces[0]);
      const ks = cards.filter(c => c.s !== 'S' && rv(c) === 13 && cards.some(d => d.s === c.s && rv(d) === 14) === false && S.played.has('A' + c.s)); if (ks.length) return pick(ks[0]);
      const ns = asc.filter(c => c.s !== 'S'); if (ns.length) { if (pnil) return pick(ns[ns.length - 1]); return pick(ns[0]); }
      return pick(asc[S.broken ? asc.length - 1 : 0]);
    }
    const ls = trick[0].card.s, w = trickWinner(trick), wc = trick.find(t => t.seat === w).card;
    const beats = c => (c.s === 'S' && wc.s !== 'S') || (c.s === wc.s && rv(c) > rv(wc));
    const last = trick.length === 3;
    if (nil) { const under = asc.filter(c => !beats(c)); return pick(under.length ? under[under.length - 1] : asc[0]); }
    if (team(w) === team(seat) && w !== seat) {
      if (pnil || (wc.s === ls && rv(wc) < 11 && !last && false)) { const w2 = asc.filter(beats); if (pnil && w2.length && S.bid[w] === 0) return pick(w2[0]); }
      if (S.bid[w] === 0) { const w2 = asc.filter(beats); if (w2.length) return pick(w2[0]); }
      return pick(dump(asc, ls));
    }
    const wins = asc.filter(beats);
    if (wins.length) { if (last) return pick(wins[0]); const hi = wins[wins.length - 1], lo = wins[0]; return pick(rv(lo) >= 11 || lo.s === 'S' ? lo : hi.s === lo.s && !last ? hi : lo); }
    return pick(dump(asc, ls));
  }
  function dump(asc, ls) { const f = asc.filter(c => c.s === ls); if (f.length) return f[0]; const ns = asc.filter(c => c.s !== 'S'); return ns.length ? ns[0] : asc[0]; }

  /* ---------- flow ---------- */
  async function start(opts, roster, sess) {
    T.netStart(sess || null); const t = ++T.token; T.status(''); T.clearCards(); T.clearActions(); stage.querySelectorAll('.bidbox').forEach(e => e.remove());
    K.mountTable(stage); T.geo(); placeSb();
    GOAL = +opts.goal || 250;
    S = { pl: roster, score: [0, 0], bags: [0, 0], round: 0, bid: [null, null, null, null], won: [0, 0, 0, 0], broken: false, played: new Set(), rw: 0, rounds: 0, bestRound: 0, dealer: 0 };
    S.dealer = T.net ? (T.rnd(4) - T.net.me + 4) % 4 : K.rand(4);
    T.buildSeats(roster); renderSeats(); T.inGame = true; UI.setInGame(true);
    K.Profile.game('spades').played++; K.Profile.save();
    try {
      for (;;) {
        S.round++; await playRound(t);
        const a = S.score[0], b = S.score[1], end = Math.max(a, b) >= GOAL && a !== b || a <= -200 || b <= -200;
        if (end) { const w = (a <= -200 ? 1 : b <= -200 ? 0 : (a > b ? 0 : 1)); return finish(w, t); }
      }
    } catch (e) { if (e !== T.Abort) throw e; }
  }
  async function playRound(t) {
    S.bid = [null, null, null, null]; S.won = [0, 0, 0, 0]; S.broken = false; S.played = new Set(); T.clearCards(); renderSeats();
    const d = T.shuf(K.deck52()), hands = T.netHands([0, 1, 2, 3].map(i => d.slice(i * 13, i * 13 + 13))); K.sfx.shuffle();
    await T.banner('Round ' + S.round, 'Dealing...', 800); T.chk(t);
    await T.deal(hands, SUITS, t);
    S.dealer = (S.dealer + 1) % 4;
    for (let k = 1; k <= 4; k++) {
      const seat = (S.dealer + k) % 4; T.setTurn(seat); T.status(seat === 0 ? 'Your bid' : S.pl[seat].name + ' is bidding');
      const b = await T.act(seat, 'bid', async () => { if (seat === 0 && !T.auto) return humanBid(t); await T.wait(650); T.chk(t); return cpuBid(seat, T.hands[seat].map(e => e.card)); });
      S.bid[seat] = b; renderSeats(); T.floatAt(T.seatPos(seat).x + 26, T.seatPos(seat).y, b === 0 ? 'Nil' : 'Bid ' + b, true); K.sfx.flip();
      await T.wait(500); T.chk(t);
    }
    T.status('');
    const tb = [S.bid[0] + S.bid[2], S.bid[1] + S.bid[3]];
    await T.banner('Contracts', 'You + ' + S.pl[2].name + ': ' + tb[0] + '  ·  ' + S.pl[1].name + ' + ' + S.pl[3].name + ': ' + tb[1], 1500); T.chk(t);
    let lead = (S.dealer + 1) % 4;
    for (let n = 0; n < 13; n++) { lead = await playTrick(lead, t); }
    await scoreRound(t);
  }
  function humanBid(t) {
    return new Promise(res => {
      const mine = T.hands[0].map(e => e.card), est = estimateBid(mine);
      const box = document.createElement('div'); box.className = 'bidbox';
      let h = '<h3>YOUR BID</h3><div class="g">'; for (let i = 0; i <= 13; i++) h += '<button class="btn sm' + (Math.round(est) === i ? '' : ' ghost') + '" data-b="' + i + '">' + (i === 0 ? 'Nil' : i) + '</button>'; h += '</div><small>Tricks you expect to win. Nil = take none (+100, or -100 if you fail).</small>';
      box.innerHTML = h; stage.appendChild(box);
      T.humanResolve = () => done(Math.max(1, Math.min(9, Math.round(est))) || 1);
      const done = b => { T.humanResolve = null; box.remove(); res(b); };
      box.onclick = e => { const b = e.target.closest('[data-b]'); if (b) done(+b.dataset.b); };
    });
  }
  async function playTrick(lead, t) {
    const trick = [];
    for (let k = 0; k < 4; k++) {
      const seat = (lead + k) % 4; T.setTurn(seat); T.status(seat === 0 ? 'Your turn' : S.pl[seat].name + ' is thinking');
      const legal = legalFor(T.hands[seat], trick); let el;
      const pc = await T.act(seat, 'play', async () => { let e0;
        if (seat === 0) { if (legal.length === 1 && !T.auto) { await T.wait(350); e0 = legal[0]; } else e0 = await T.pick(legal, l => cpuPlay(0, l, trick), t); }
        else { await T.wait(520); e0 = cpuPlay(seat, legal, trick); }
        return { r: e0.card.r, s: e0.card.s }; });
      el = T.hands[seat].find(e => e.card.r === pc.r && e.card.s === pc.s);
      T.chk(t);
      T.hands[seat].splice(T.hands[seat].indexOf(el), 1); S.played.add(el.card.r + el.card.s);
      if (el.card.s === 'S') S.broken = true;
      el.style.zIndex = 300 + k; K.place(el, { up: true, dur: 0 }); K.sfx.flip(); T.mv(el, T.trickSlot(seat), 380); T.layoutHand(seat, 300);
      trick.push({ seat, card: el.card, el }); await T.wait(420); T.chk(t);
    }
    const w = trickWinner(trick); S.won[w]++; renderSeats(); T.setTurn(w);
    T.floatAt(T.seatPos(w).x + 26, T.seatPos(w).y + 20, '+1', true);
    await T.wait(850); T.chk(t);
    trick.forEach(x => T.mv(x.el, Object.assign({}, T.offPos(w), { r: 20, s: .8 }), 420)); await T.wait(480); T.chk(t);
    trick.forEach(x => x.el.remove()); return w;
  }
  async function scoreRound(t) {
    const lines = [];
    for (let tm = 0; tm < 2; tm++) {
      const a = tm, b = tm + 2, bid = S.bid[a] + S.bid[b], tricks = S.won[a] + S.won[b]; let pts = 0, txt;
      if (bid > 0) { if (tricks >= bid) { const bag = tricks - bid; pts += bid * 10 + bag; S.bags[tm] += bag; txt = 'made ' + bid + (bag ? ' (+' + bag + ' bags)' : ''); } else { pts -= bid * 10; txt = 'set (' + tricks + '/' + bid + ')'; } } else txt = 'nil only';
      [a, b].forEach(s => { if (S.bid[s] === 0) { if (S.won[s] === 0) { pts += 100; txt += ', nil made'; } else { pts -= 100; txt += ', nil broken'; } } });
      if (S.bags[tm] >= 10) { S.bags[tm] -= 10; pts -= 100; txt += ', bag penalty'; }
      S.score[tm] += pts; lines.push((tm ? S.pl[1].name + ' + ' + S.pl[3].name : 'You + ' + S.pl[2].name) + ': ' + (pts >= 0 ? '+' : '') + pts + ' (' + txt + ')');
      if (tm === 0) { S.rounds++; if (pts > 0) S.rw++; S.bestRound = Math.max(S.bestRound, pts); }
    }
    renderSeats(); await T.banner('Round scores', lines.join('<br>'), 2600); T.chk(t);
  }
  async function finish(w, t) {
    const won = w === 0, a = S.score[0], b = S.score[1];
    const rows = T.resultRow({ name: 'You + ' + S.pl[2].name, av: S.pl[0].av }, a, won) + T.resultRow({ name: S.pl[1].name + ' + ' + S.pl[3].name, av: S.pl[1].av }, b, !won);
    T.finish({ won, title: won ? 'You win!' : 'Opponents win', sub: 'Final score after ' + S.round + ' rounds.', rows, rounds: S.rounds, roundsWon: S.rw, best: S.bestRound, base: 40 + S.round * 4, winBonus: GOAL >= 500 ? 220 : GOAL <= 150 ? 70 : 110, onChoice: a => { if (a === 'again' && !T.net) { const o = UI.setup(); start(o, T.rosterFor(4)); } else { T.netEnd(); UI.showMenu(); } } });
  }
  T.onMenu = () => { T.netEnd(); UI.showMenu(); };
  T.relayout = function () { if (!S) return; K.clearSprites(); T.geo(); placeSb(); T.seatLayout(); for (let s = 0; s < 4; s++) T.layoutHand(s, 0); };

  const rules = '<h3>Goal</h3><p>You and the player across from you are a team against the other two. Reach the target score first.</p>' +
    '<h3>Bidding</h3><p>Everyone bids how many tricks they expect to take. Your team\'s bids are added together. <b>Nil</b> means you promise to take no tricks.</p>' +
    '<h3>Play</h3><p>Follow suit if you can. <b>Spades are trump</b> and beat every other suit. You cannot lead a spade until one has been played.</p>' +
    '<h3>Scoring</h3><ul><li>Make your bid: 10 points per trick bid, plus 1 per extra trick (a bag)</li><li>Miss it: lose 10 per trick bid</li><li>Nil made +100, nil broken -100</li><li>10 bags costs 100 points</li></ul>' +
    '<h3>Credits</h3><p>Win to earn credits and unlock richer rooms.</p>';
  const UI = CardUI.init({
    stage, id: 'spades', title: 'SPADES', sub: 'Bid, trump and take your tricks', rules,
    fan: [{ r: 'A', s: 'S' }, { r: 'K', s: 'S' }, { r: 'Q', s: 'S' }, { r: 'J', s: 'S' }],
    fields: [{ key: 'mode', label: 'Players', def: 'cpu', options: [{ v: 'cpu', t: 'You + CPUs' }, { v: 'online', t: 'Online (room code)' }] }, { key: 'goal', label: 'Game length', def: 250, options: [{ v: 150, t: 'Quick 150' }, { v: 250, t: 'Standard 250' }, { v: 500, t: 'Classic 500' }] }],
    onPlay: (opts, roster) => opts.mode === 'online' ? Multi.lobby({ game: 'spades', title: 'Spades', min: 2, max: 4, onStart: sess => start(opts, T.netRoster(sess, roster), sess), onCancel: () => UI.showMenu() }) : start(opts, roster),
    statExtra: s => [[s.best || 0, 'Best round']]
  });
  T.geo(); placeSb(); renderSb();
  if (window.Install) Install.registerSW();
  UI.showMenu();
  window.__t = { get S() { return S; }, T };
})();
