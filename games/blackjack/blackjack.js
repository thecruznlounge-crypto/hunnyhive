/* Blackjack - 6 decks, dealer stands on all 17s, blackjack pays 3:2, double, split and a basic-strategy hint. */
(function () {
  'use strict';
  const T = CardTable.create({ id: 'blackjack', back: 'navy' }), K = T.K, stage = T.stage, $ = K.$;
  const START = 1000, MINB = 10;
  const val = c => c.r === 'A' ? 11 : ('JQK'.includes(c.r) || c.r === '10') ? 10 : +c.r;
  function total(cards) { let t = 0, a = 0; cards.forEach(c => { t += val(c); if (c.r === 'A') a++; }); while (t > 21 && a) { t -= 10; a--; } return { t, soft: a > 0 }; }
  let S = null, shoe = [], HANDS = 25, lastBet = 50;
  const sb = document.createElement('div'); sb.className = 'sboard'; stage.appendChild(sb);
  function placeSb() { const f = T.G.f; sb.style.left = (f.x + 12) + 'px'; sb.style.top = (f.y + 12) + 'px'; }
  function renderSb() { if (!S) { sb.classList.add('hide'); return; } sb.classList.remove('hide'); sb.innerHTML = '<span class="h">BLACKJACK</span>Chips: <b>' + S.bank + '</b><br>Hand <b>' + Math.min(S.n + (S.inHand ? 0 : 1), HANDS) + '</b> of ' + HANDS + '<br>Net: <b style="color:' + (S.bank >= START ? '#8ff0a8' : '#ff9aa6') + '">' + (S.bank >= START ? '+' : '') + (S.bank - START) + '</b>'; }
  function draw() { if (shoe.length < 52) { shoe = []; for (let d = 0; d < 6; d++) shoe.push(...K.deck52()); K.shuffle(shoe); K.sfx.shuffle(); } return shoe.pop(); }

  /* ---------- layout ---------- */
  function dealerSlot(i, n) { const { f, cw, cx } = T.G, step = Math.min(cw * .55, (f.w * .4) / Math.max(1, n)), w = step * (n - 1) + cw; return { x: cx - w / 2 + step * i, y: f.y + 40, r: 0, s: 1, z: 20 + i }; }
  function handSlot(hi, nh, i, n) {
    const { f, cw, ch, cx, cy } = T.G, step = Math.min(cw * .5, (f.w * (nh > 1 ? .22 : .4)) / Math.max(1, n)), w = step * (n - 1) + cw;
    const hx = nh > 1 ? cx + (hi === 0 ? -1 : 1) * (cw * 1.9) : cx;
    return { x: hx - w / 2 + step * i, y: f.y + f.h - ch * 2.35 + i * 3, r: 0, s: 1, z: 40 + i + hi * 10 };
  }
  function layout(dur) {
    if (!S) return; S.dealer.els.forEach((e, i) => T.mv(e, dealerSlot(i, S.dealer.els.length), dur));
    S.hands.forEach((h, hi) => { h.els.forEach((e, i) => T.mv(e, handSlot(hi, S.hands.length, i, h.els.length), dur)); positionTag(h, hi); });
  }
  function positionTag(h, hi) {
    if (!h.tag) { h.tag = document.createElement('div'); h.tag.className = 'totalchip'; stage.appendChild(h.tag); }
    const s = handSlot(hi, S.hands.length, 0, h.els.length), { cw, ch } = T.G, tt = total(h.els.map(e => e.card));
    h.tag.textContent = (tt.t > 21 ? 'Bust ' : '') + tt.t + (tt.soft && tt.t <= 21 ? ' soft' : '') + ' · bet ' + h.bet; h.tag.style.left = (s.x + 2) + 'px'; h.tag.style.top = (s.y + ch + 6) + 'px'; h.tag.style.background = h.state ? ({ win: 'rgba(30,120,60,.85)', lose: 'rgba(130,30,40,.85)', push: 'rgba(60,60,80,.85)' })[h.state] || '' : '';
  }
  function dealerTag(txt) { if (!S.dtag) { S.dtag = document.createElement('div'); S.dtag.className = 'totalchip'; stage.appendChild(S.dtag); } const { f, ch, cx, cw } = T.G; S.dtag.style.left = (cx + cw * 1.1) + 'px'; S.dtag.style.top = (f.y + 44) + 'px'; S.dtag.textContent = txt; S.dtag.style.display = txt ? '' : 'none'; }
  const deal1 = async (list, up, t) => {
    const c = draw(), el = T.addCard(c, false, { x: T.G.f.x + T.G.f.w - T.G.cw * 1.6, y: T.G.f.y + 8, r: 0, s: 1, z: 1 }); list.push(el); K.sfx.deal();
    layout(300); if (up) setTimeout(() => K.place(el, { up: true, dur: 260 * T.SP }), 260 * T.SP); await T.wait(420); T.chk(t); return el;
  };

  /* ---------- strategy ---------- */
  function advise(h, up, canDouble, canSplit) {
    const cs = h.els.map(e => e.card), tt = total(cs), u = val(up) === 11 ? 11 : val(up);
    if (canSplit && cs[0].r === cs[1].r) { const r = val(cs[0]); if (r === 11 || r === 8) return 'split'; if (r === 9 && ![7, 10, 11].includes(u)) return 'split'; if (r === 7 && u <= 7) return 'split'; if (r === 6 && u <= 6) return 'split'; if ((r === 2 || r === 3) && u <= 7) return 'split'; }
    if (tt.soft) { if (tt.t >= 19) return 'stand'; if (tt.t === 18) return (u >= 9) ? 'hit' : (canDouble && u >= 3 && u <= 6) ? 'double' : 'stand'; if (canDouble && tt.t >= 15 && u >= 4 && u <= 6) return 'double'; return 'hit'; }
    if (tt.t >= 17) return 'stand'; if (tt.t >= 13) return u <= 6 ? 'stand' : 'hit'; if (tt.t === 12) return (u >= 4 && u <= 6) ? 'stand' : 'hit';
    if (tt.t === 11) return canDouble ? 'double' : 'hit'; if (tt.t === 10) return canDouble && u <= 9 ? 'double' : 'hit'; if (tt.t === 9) return canDouble && u >= 3 && u <= 6 ? 'double' : 'hit'; return 'hit';
  }

  /* ---------- flow ---------- */
  async function start(opts, roster) {
    const t = ++T.token; T.status(''); T.clearCards(); T.clearActions(); stage.querySelectorAll('.totalchip,.bidbox').forEach(e => e.remove()); K.mountTable(stage); T.geo(); placeSb();
    HANDS = +opts.hands || 25; shoe = [];
    S = { bank: START, n: 0, hands: [], dealer: { els: [] }, inHand: false, wins: 0, played: 0, bestBank: START, bj: 0 };
    T.buildSeats([roster[0], , { name: 'Dealer', av: { g: 4, c: 7 } }]); T.seatText(0, '', 'You'); T.seatText(2, '', 'Stands on 17');
    T.inGame = true; UI.setInGame(true); K.Profile.game('blackjack').played++; K.Profile.save(); renderSb();
    try {
      while (S.n < HANDS && S.bank >= MINB) { await playHand(t); S.bestBank = Math.max(S.bestBank, S.bank); }
      finish(t);
    } catch (e) { if (e !== T.Abort) throw e; }
  }
  function betPhase(t) {
    return new Promise(res => {
      let bet = Math.min(lastBet, S.bank); if (bet < MINB) bet = Math.min(MINB, S.bank);
      const box = document.createElement('div'); box.className = 'bidbox'; stage.appendChild(box);
      const render = () => {
        box.innerHTML = '<h3>PLACE YOUR BET</h3><div style="font-size:26px;font-weight:900;color:var(--gold2);margin-bottom:8px">' + bet + '</div><div class="g">' + [10, 25, 50, 100, 500].map(v => '<button class="btn sm ghost" data-add="' + v + '"' + (bet + v > S.bank ? ' disabled' : '') + '>+' + v + '</button>').join('') + '<button class="btn sm ghost" data-clear>Clear</button><button class="btn sm ghost" data-max>All in</button></div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-deal' + (bet < MINB ? ' disabled' : '') + '>Deal</button></div><small>Minimum ' + MINB + ' &middot; Blackjack pays 3:2</small>';
      };
      const done = () => { T.humanResolve = null; box.remove(); lastBet = bet; res(bet); };
      box.onclick = e => { const a = e.target.closest('[data-add]'); if (a) { bet = Math.min(S.bank, bet + +a.dataset.add); K.sfx.tick(); } else if (e.target.closest('[data-clear]')) bet = 0; else if (e.target.closest('[data-max]')) bet = S.bank; else if (e.target.closest('[data-deal]') && bet >= MINB) return done(); render(); };
      T.humanResolve = () => { if (bet < MINB) bet = Math.min(MINB, S.bank); done(); };
      render(); if (T.auto) setTimeout(() => T.humanResolve && T.humanResolve(), 500 * T.SP);
    });
  }
  async function playHand(t) {
    S.inHand = false; renderSb(); T.status('Place your bet'); T.setTurn(0);
    const bet = await betPhase(t); T.chk(t); T.status(''); S.n++; S.inHand = true; S.bank -= bet; renderSb();
    S.hands.forEach(h => { h.tag && h.tag.remove(); }); S.hands = [{ els: [], bet, state: '', done: false }]; S.dealer = { els: [] }; dealerTag('');
    const H = S.hands[0];
    await deal1(H.els, true, t); await deal1(S.dealer.els, true, t); await deal1(H.els, true, t); const hole = await deal1(S.dealer.els, false, t);
    layout(0); const up = S.dealer.els[0].card, pbj = total(H.els.map(e => e.card)).t === 21;
    const dbj = total(S.dealer.els.map(e => e.card)).t === 21;
    if ((val(up) >= 10) && dbj || pbj) { K.place(hole, { up: true, dur: 300 * T.SP }); await T.wait(500); T.chk(t); }
    if (pbj || dbj) {
      if (pbj && dbj) { H.state = 'push'; S.bank += bet; await result('Push', 'Both have blackjack', 0, t); }
      else if (pbj) { H.state = 'win'; const pay = Math.round(bet * 2.5); S.bank += pay; S.bj++; S.wins++; K.sfx.win(); await result('Blackjack!', 'Pays 3:2', pay - bet, t); }
      else { H.state = 'lose'; K.sfx.lose(); await result('Dealer blackjack', '', -bet, t); }
      return endHand(t);
    }
    /* player turns */
    for (let hi = 0; hi < S.hands.length; hi++) {
      const h = S.hands[hi];
      for (;;) {
        layout(300); const tt = total(h.els.map(e => e.card)); if (tt.t >= 21 || h.done) break;
        const canDouble = h.els.length === 2 && S.bank >= h.bet, canSplit = S.hands.length === 1 && h.els.length === 2 && val(h.els[0].card) === val(h.els[1].card) && S.bank >= h.bet && !h.split;
        const act = await chooseAction(h, up, canDouble, canSplit, t); T.chk(t);
        if (act === 'stand') break;
        if (act === 'hit') { await deal1(h.els, true, t); continue; }
        if (act === 'double') { S.bank -= h.bet; h.bet *= 2; renderSb(); await deal1(h.els, true, t); h.done = true; break; }
        if (act === 'split') {
          S.bank -= h.bet; const second = h.els.pop(), h2 = { els: [second], bet: h.bet, state: '', done: false, split: true }; h.split = true; S.hands.push(h2); renderSb(); layout(300); await T.wait(350); T.chk(t);
          await deal1(h.els, true, t); await deal1(h2.els, true, t); if (h.els[0].card.r === 'A') { h.done = true; h2.done = true; } continue;
        }
      }
      layout(250); await T.wait(200); T.chk(t);
    }
    /* dealer */
    K.place(hole, { up: true, dur: 300 * T.SP }); K.sfx.flip(); await T.wait(550); T.chk(t);
    const live = S.hands.some(h => total(h.els.map(e => e.card)).t <= 21);
    dealerTag(total(S.dealer.els.map(e => e.card)).t + '');
    while (live && total(S.dealer.els.map(e => e.card)).t < 17) { await deal1(S.dealer.els, true, t); dealerTag(total(S.dealer.els.map(e => e.card)).t + ''); await T.wait(250); }
    const dt = total(S.dealer.els.map(e => e.card)).t; dealerTag(dt > 21 ? 'Bust ' + dt : dt + '');
    let net = 0, label = '';
    S.hands.forEach(h => {
      const pt = total(h.els.map(e => e.card)).t;
      if (pt > 21) { h.state = 'lose'; net -= h.bet; } else if (dt > 21 || pt > dt) { h.state = 'win'; S.bank += h.bet * 2; net += h.bet; } else if (pt === dt) { h.state = 'push'; S.bank += h.bet; } else { h.state = 'lose'; net -= h.bet; }
    });
    S.hands.forEach((h, hi) => positionTag(h, hi)); if (net > 0) { S.wins++; K.sfx.win(); } else if (net < 0) K.sfx.lose();
    label = net > 0 ? 'You win' : net < 0 ? 'Dealer wins' : 'Push';
    await result(label, (dt > 21 ? 'Dealer busts' : 'Dealer ' + dt), net, t); endHand(t);
  }
  async function result(title, sub, net, t) {
    renderSb(); S.hands.forEach((h, hi) => positionTag(h, hi));
    if (net) T.floatAt(T.G.cx, T.G.cy, (net > 0 ? '+' : '') + net, net > 0);
    await T.banner(title, sub, 1300); T.chk(t);
  }
  async function endHand(t) {
    S.inHand = false; renderSb();
    S.hands.forEach(h => h.els.forEach(e => T.mv(e, { x: T.G.f.x + T.G.f.w + T.G.cw, y: T.G.f.y, r: 25, s: .8 }, 400))); S.dealer.els.forEach(e => T.mv(e, { x: T.G.f.x + T.G.f.w + T.G.cw, y: T.G.f.y, r: 25, s: .8 }, 400));
    await T.wait(460); T.chk(t); stage.querySelectorAll('.pc').forEach(e => e.remove()); S.hands.forEach(h => { if (h.tag) { h.tag.remove(); h.tag = null; } }); dealerTag(''); S.hands = []; S.dealer = { els: [] };
  }
  function chooseAction(h, up, canDouble, canSplit, t) {
    return new Promise(res => {
      T.clearActions(); T.setTurn(0); T.status('Your move');
      const adv = advise(h, up, canDouble, canSplit), done = a => { T.humanResolve = null; T.clearActions(); T.status(''); res(a); };
      const mk = (txt, a, cls) => T.btn(txt, cls === undefined ? 'ghost' : cls, () => done(a));
      mk('Hit', 'hit', adv === 'hit' ? '' : 'ghost'); mk('Stand', 'stand', adv === 'stand' ? '' : 'ghost');
      if (canDouble) mk('Double', 'double', adv === 'double' ? '' : 'ghost'); if (canSplit) mk('Split', 'split', adv === 'split' ? '' : 'ghost');
      const hint = document.createElement('div'); hint.className = 'status'; T.status('Hint: ' + adv + ' (highlighted)');
      T.humanResolve = () => done(adv); if (T.auto) setTimeout(() => T.humanResolve && T.humanResolve(), 600 * T.SP);
    });
  }
  function finish(t) {
    const net = S.bank - START, won = net > 0;
    const rows = T.resultRow({ name: 'Final chips', av: K.Profile.get().av }, S.bank + ' (' + (net >= 0 ? '+' : '') + net + ')', won) + T.resultRow({ name: 'Hands won', av: { g: 8, c: 3 } }, S.wins + ' of ' + S.n) + T.resultRow({ name: 'Blackjacks', av: { g: 5, c: 4 } }, S.bj);
    T.finish({ won, title: won ? 'You beat the house!' : S.bank < MINB ? 'Busted out' : 'The house wins', sub: S.n + ' hands played.', rows, rounds: S.n, roundsWon: S.wins, best: S.bestBank, base: 25 + Math.min(60, S.n * 2), winBonus: HANDS >= 50 ? 150 : HANDS <= 10 ? 50 : 90, onChoice: a => { if (a === 'again') { const o = UI.setup(); start(o, T.rosterFor(2)); } else UI.showMenu(); } });
  }
  T.onMenu = () => UI.showMenu();
  T.relayout = function () { if (!S) return; K.clearSprites(); T.geo(); placeSb(); T.seatLayout(); layout(0); dealerTag(S.dtag && S.dtag.textContent); };
  const rules = '<h3>Goal</h3><p>Get closer to 21 than the dealer without going over. Number cards are face value, face cards are 10, an Ace is 1 or 11.</p>' +
    '<h3>Play</h3><ul><li><b>Hit</b>: take a card</li><li><b>Stand</b>: keep your hand</li><li><b>Double</b>: double your bet, take one card</li><li><b>Split</b>: split a pair into two hands</li></ul><p>The dealer stands on every 17. Blackjack (Ace + 10) pays 3:2.</p>' +
    '<h3>Chips</h3><p>You start each game with ' + START + ' chips and play a set number of hands. Finish ahead to win. The highlighted button is the basic-strategy play.</p>';
  const UI = CardUI.init({
    stage, id: 'blackjack', title: 'BLACKJACK', sub: 'Beat the dealer to 21', rules,
    fan: [{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }],
    fields: [{ key: 'hands', label: 'Game length', def: 25, options: [{ v: 10, t: 'Sprint 10' }, { v: 25, t: 'Standard 25' }, { v: 50, t: 'Marathon 50' }] }],
    onPlay: (opts, roster) => start(opts, roster),
    statExtra: s => [[s.best || 0, 'Best chips']]
  });
  T.geo(); placeSb(); renderSb();
  if (window.Install) Install.registerSW();
  UI.showMenu();
  window.__t = { get S() { return S; }, T };
})();
