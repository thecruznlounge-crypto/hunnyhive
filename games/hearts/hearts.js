/* Hearts - 4 players, lowest score wins. Pass three, avoid hearts and the Queen of Spades, or shoot the moon. */
(function () {
  'use strict';
  const T = CardTable.create({ id: 'hearts', back: 'crimson' }), K = T.K, stage = T.stage, $ = K.$;
  const SUITS = ['S', 'H', 'C', 'D'], rv = c => K.rankVal(c.r), isQS = c => c.r === 'Q' && c.s === 'S';
  const pts = c => c.s === 'H' ? 1 : isQS(c) ? 13 : 0;
  let S = null, GOAL = 100;
  const sb = document.createElement('div'); sb.className = 'sboard'; stage.appendChild(sb);
  function placeSb() { const f = T.G.f; sb.style.left = (f.x + 12) + 'px'; sb.style.top = (f.y + 12) + 'px'; }
  function renderSb() {
    if (!S) { sb.classList.add('hide'); return; } sb.classList.remove('hide');
    sb.innerHTML = '<span class="h">HEARTS &middot; TO ' + GOAL + '</span>' + S.pl.map((p, i) => (i === 0 ? 'You' : p.name) + ': <b>' + S.total[i] + '</b>').join('<br>');
  }
  function renderSeats() { S.pl.forEach((p, i) => T.seatText(i, S.hp[i] + ' pts', 'Round · ' + S.total[i] + ' total')); renderSb(); }

  function legalFor(hand, trick) {
    const cs = hand.map(e => e.card);
    if (!trick.length) {
      if (S.first) return hand.filter(e => e.card.r === '2' && e.card.s === 'C');
      const ns = hand.filter(e => e.card.s !== 'H'); return (S.broken || !ns.length) ? hand : ns;
    }
    const ls = trick[0].card.s, f = hand.filter(e => e.card.s === ls); if (f.length) return f;
    if (S.first) { const ok = hand.filter(e => pts(e.card) === 0); if (ok.length) return ok; }
    return hand;
  }
  function trickWinner(trick) { let b = trick[0]; for (const t of trick.slice(1)) if (t.card.s === b.card.s && rv(t.card) > rv(b.card)) b = t; return b.seat; }

  /* ---------- cpu ---------- */
  function passScore(c, cards) {
    if (isQS(c)) return 100; const sp = cards.filter(x => x.s === 'S' && rv(x) < 12).length;
    if (c.s === 'S' && rv(c) > 12) return sp < 3 ? 90 + rv(c) / 10 : 20;
    if (c.s === 'H') return 40 + rv(c); return rv(c);
  }
  function cpuPass(cards) { return cards.slice().sort((a, b) => passScore(b, cards) - passScore(a, cards)).slice(0, 3); }
  function cpuPlay(seat, legal, trick) {
    const cards = legal.map(e => e.card), asc = cards.slice().sort((a, b) => rv(a) - rv(b)), pick = c => legal.find(e => e.card === c), hand = T.hands[seat].map(e => e.card);
    if (!trick.length) {
      if (S.first) return legal[0];
      const hasQS = hand.some(isQS), sp = hand.filter(c => c.s === 'S' && rv(c) < 12).length;
      const safe = asc.filter(c => !(c.s === 'S' && (hasQS || rv(c) > 12) && sp < 2 && !hasQS) && !(c.s === 'S' && hasQS));
      const pool = safe.length ? safe : asc; const nh = pool.filter(c => c.s !== 'H'); return pick((nh.length ? nh : pool)[0]);
    }
    const ls = trick[0].card.s, w = trickWinner(trick), wc = trick.find(t => t.seat === w).card, tp = trick.reduce((a, t) => a + pts(t.card), 0), last = trick.length === 3;
    const follow = cards.filter(c => c.s === ls);
    if (follow.length) {
      const under = follow.filter(c => rv(c) < rv(wc)).sort((a, b) => rv(b) - rv(a));
      if (under.length) return pick(under[0]);
      if (last && tp === 0) { const nq = follow.filter(c => !isQS(c)); if (nq.length) return pick(nq[nq.length - 1]); }
      const nq = follow.filter(c => !isQS(c)).sort((a, b) => rv(a) - rv(b)); if (ls === 'S' && follow.some(isQS) && rv(wc) > 12) return pick(follow.find(isQS));
      return pick((nq.length ? nq : follow)[0]);
    }
    const qs = cards.find(isQS); if (qs) return pick(qs);
    const hs = cards.filter(c => c.s === 'H').sort((a, b) => rv(b) - rv(a)); if (hs.length) return pick(hs[0]);
    const sp = cards.filter(c => c.s === 'S' && rv(c) > 12); if (sp.length) return pick(sp[0]);
    return pick(asc[asc.length - 1]);
  }

  /* ---------- flow ---------- */
  async function start(opts, roster, sess) {
    T.netStart(sess || null); const t = ++T.token; T.status(''); T.clearCards(); T.clearActions(); K.mountTable(stage); T.geo(); placeSb();
    GOAL = +opts.goal || 100;
    S = { pl: roster, total: [0, 0, 0, 0], hp: [0, 0, 0, 0], round: 0, first: false, broken: false, rw: 0, rounds: 0, bestRound: 99, moons: 0 };
    T.buildSeats(roster); renderSeats(); T.inGame = true; UI.setInGame(true);
    K.Profile.game('hearts').played++; K.Profile.save();
    try {
      for (;;) {
        S.round++; await playRound(t);
        if (Math.max(...S.total) >= GOAL) { const m = Math.min(...S.total); if (S.total.filter(x => x === m).length === 1) return finish(S.total.indexOf(m), t); }
      }
    } catch (e) { if (e !== T.Abort) throw e; }
  }
  async function playRound(t) {
    S.hp = [0, 0, 0, 0]; S.broken = false; S.first = true; T.clearCards(); renderSeats();
    const d = T.shuf(K.deck52()); let hands = T.netHands([0, 1, 2, 3].map(i => d.slice(i * 13, i * 13 + 13))); K.sfx.shuffle();
    const dir = [1, 3, 2, 0][(S.round - 1) % 4], dn = ['left', 'right', 'across', 'none'][(S.round - 1) % 4];
    await T.banner('Round ' + S.round, dn === 'none' ? 'No passing this round' : 'Pass three cards ' + dn, 1000); T.chk(t);
    await T.deal(hands, SUITS, t);
    if (dir) {
      const picks = [];
      for (let s = 0; s < 4; s++) { const raw = await T.act(s, 'pass', async () => (s === 0 ? (await humanPass(t, dn)).map(e => e.card) : cpuPass(T.hands[s].map(e => e.card))).map(c => ({ r: c.r, s: c.s }))); picks[s] = raw.map(x => T.hands[s].find(e => e.card.r === x.r && e.card.s === x.s).card); }
      const nh = [0, 1, 2, 3].map(s => T.hands[s].map(e => e.card).filter(c => !picks[s].includes(c)));
      for (let s = 0; s < 4; s++) { const to = (s + dir) % 4; picks[s].forEach(c => nh[to].push(c)); }
      /* animate: passed cards slide to receiver */
      for (let s = 0; s < 4; s++) { const to = (s + dir) % 4; T.hands[s].filter(e => picks[s].includes(e.card)).forEach(e => T.mv(e, Object.assign({}, T.offPos(to)), 450)); }
      await T.wait(520); T.chk(t); T.clearCards();
      for (let s = 0; s < 4; s++) { const arr = s === 0 ? T.sortHand(nh[s], SUITS) : nh[s]; arr.forEach((c, i) => { const el = T.addCard(c, s === 0, T.handSlot(s, i, arr.length)); el.seat = s; T.hands[s].push(el); }); }
      K.sfx.deal(); await T.wait(350); T.chk(t);
    }
    let lead = T.hands.findIndex(h => h.some(e => e.card.r === '2' && e.card.s === 'C'));
    for (let n = 0; n < 13; n++) { lead = await playTrick(lead, t); S.first = false; }
    await scoreRound(t);
  }
  function humanPass(t, dn) {
    return new Promise(res => {
      const sel = new Set();
      const btn = T.btn('Pass 3 cards ' + dn, '', () => { if (sel.size !== 3) return; finish_(); }); btn.disabled = true;
      const refresh = () => { T.hands[0].forEach((e, i) => { const sl = T.handSlot(0, i, T.hands[0].length); K.place(e, { y: sl.y - (sel.has(e) ? 18 : 0), dur: 150 * T.SP, z: sel.has(e) ? 90 + i : 40 + i }); e.classList.toggle('glow', sel.has(e)); }); btn.disabled = sel.size !== 3; btn.textContent = sel.size === 3 ? 'Pass ' + dn : 'Choose 3 cards (' + sel.size + '/3)'; };
      const finish_ = () => { T.humanResolve = null; T.hands[0].forEach(e => { e.onclick = null; e.classList.remove('hit', 'glow'); }); T.clearActions(); const r = [...sel]; res(r); };
      T.hands[0].forEach(e => { e.classList.add('hit'); e.onclick = () => { if (sel.has(e)) sel.delete(e); else if (sel.size < 3) sel.add(e); K.sfx.flip(); refresh(); }; });
      T.humanResolve = () => { sel.clear(); cpuPass(T.hands[0].map(e => e.card)).forEach(c => sel.add(T.hands[0].find(e => e.card === c))); finish_(); };
      T.status('Pick three cards to pass ' + dn); refresh();
      if (T.auto) setTimeout(() => T.humanResolve && T.humanResolve(), 500 * T.SP);
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
      T.hands[seat].splice(T.hands[seat].indexOf(el), 1); if (el.card.s === 'H') S.broken = true;
      el.style.zIndex = 300 + k; K.place(el, { up: true, dur: 0 }); K.sfx.flip(); T.mv(el, T.trickSlot(seat), 380); T.layoutHand(seat, 300);
      trick.push({ seat, card: el.card, el }); await T.wait(420); T.chk(t);
    }
    const w = trickWinner(trick), p = trick.reduce((a, x) => a + pts(x.card), 0); S.hp[w] += p; S.won = (S.won || 0); renderSeats(); T.setTurn(w);
    if (p) T.floatAt(T.seatPos(w).x + 26, T.seatPos(w).y + 20, '+' + p, false);
    await T.wait(800); T.chk(t);
    trick.forEach(x => T.mv(x.el, Object.assign({}, T.offPos(w), { r: 20, s: .8 }), 420)); await T.wait(480); T.chk(t);
    trick.forEach(x => x.el.remove()); return w;
  }
  async function scoreRound(t) {
    let moon = S.hp.findIndex(x => x === 26), msg = '';
    if (moon >= 0) { S.hp = S.hp.map((x, i) => i === moon ? 0 : 26); msg = (moon === 0 ? 'You shot the moon!' : S.pl[moon].name + ' shot the moon!') + '<br>'; S.moons++; K.sfx.fanfare(); }
    S.hp.forEach((x, i) => S.total[i] += x); S.rounds++; if (S.hp[0] <= Math.min(...S.hp)) S.rw++; S.bestRound = Math.min(S.bestRound, S.hp[0]);
    renderSeats(); await T.banner('Round ' + S.round, msg + S.pl.map((p, i) => (i === 0 ? 'You' : p.name) + ' ' + S.hp[i]).join(' · '), 2400); T.chk(t);
  }
  async function finish(w, t) {
    const won = w === 0;
    const rows = S.pl.map((p, i) => ({ p, i })).sort((a, b) => S.total[a.i] - S.total[b.i]).map(x => T.resultRow(x.p, S.total[x.i], x.i === w)).join('');
    T.finish({ won, title: won ? 'You win!' : S.pl[w].name + ' wins', sub: 'Lowest score wins. ' + S.round + ' rounds played.', rows, rounds: S.rounds, roundsWon: S.rw, best: 0, base: 40 + S.round * 3, winBonus: GOAL >= 100 ? 120 : 60, onChoice: a => { if (a === 'again' && !T.net) { const o = UI.setup(); start(o, T.rosterFor(4)); } else { T.netEnd(); UI.showMenu(); } } });
  }
  T.onMenu = () => { T.netEnd(); UI.showMenu(); };
  T.relayout = function () { if (!S) return; K.clearSprites(); T.geo(); placeSb(); T.seatLayout(); for (let s = 0; s < 4; s++) T.layoutHand(s, 0); };
  const rules = '<h3>Goal</h3><p>Score the <b>fewest</b> points. When anyone reaches the target the lowest score wins.</p>' +
    '<h3>Passing</h3><p>Each round you pass three cards (left, right, across, then none). Pass your worst cards.</p>' +
    '<h3>Play</h3><p>The Two of Clubs leads. Follow suit if you can. Highest card of the led suit takes the trick. Hearts cannot be led until a heart has been played.</p>' +
    '<h3>Points</h3><ul><li>Each heart: 1 point</li><li>Queen of Spades: 13 points</li><li>No points on the first trick unless you have no choice</li></ul>' +
    '<h3>Shooting the moon</h3><p>Take every heart and the Queen of Spades and you score 0 while everyone else gets 26.</p>';
  const UI = CardUI.init({
    stage, id: 'hearts', title: 'HEARTS', sub: 'Dodge the Queen of Spades', rules,
    fan: [{ r: 'Q', s: 'S' }, { r: 'A', s: 'H' }, { r: 'K', s: 'H' }, { r: 'Q', s: 'H' }],
    fields: [{ key: 'mode', label: 'Players', def: 'cpu', options: [{ v: 'cpu', t: 'You + CPUs' }, { v: 'online', t: 'Online (room code)' }] }, { key: 'goal', label: 'Game length', def: 100, options: [{ v: 50, t: 'Quick 50' }, { v: 100, t: 'Standard 100' }] }],
    onPlay: (opts, roster) => opts.mode === 'online' ? Multi.lobby({ game: 'hearts', title: 'Hearts', min: 2, max: 4, onStart: sess => start(opts, T.netRoster(sess, roster), sess), onCancel: () => UI.showMenu() }) : start(opts, roster),
    statExtra: s => [[(s.extra && s.extra.moons) || 0, 'Moons shot']]
  });
  T.geo(); placeSb(); renderSb();
  if (window.Install) Install.registerSW();
  UI.showMenu();
  window.__t = { get S() { return S; }, T };
})();
