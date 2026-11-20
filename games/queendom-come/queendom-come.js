/* Queendom Come */
(function () {
  'use strict';
  const K = CardKit, $ = K.$;
  const stage = $('#stage');
  K.setBack('crimson');
  K.mountTable(stage);

  const hud = document.createElement('div'); hud.className = 'hud'; stage.appendChild(hud);
  const board = document.createElement('div'); board.className = 'board';
  board.style.pointerEvents = 'none';
  board.innerHTML = '<div style="display:flex;align-items:center;gap:clamp(10px,3vw,28px)">' +
    '<div class="qe" id="qh" style="text-align:center"><img alt="Queen of Hearts"><div class="own" id="qho">Unclaimed</div></div>' +
    '<div><div class="t serif">QUEENDOM<br>COME</div><div class="s" id="bsub">LAST PLAYER WITH CARDS WINS</div></div>' +
    '<div class="qe" id="qd" style="text-align:center"><img alt="Queen of Diamonds"><div class="own" id="qdo">Unclaimed</div></div></div>';
  stage.appendChild(board);
  const styleEl = document.createElement('style');
  styleEl.textContent = '.qe img{width:calc(var(--cw)*.62);border-radius:5px;box-shadow:0 4px 10px rgba(0,0,0,.6);opacity:.35;filter:grayscale(.6);transition:opacity .4s,filter .4s}.qe.on img{opacity:1;filter:none;box-shadow:0 0 0 2px var(--gold),0 0 16px rgba(241,220,142,.7)}.qe .own{font-size:9px;color:var(--muted);margin-top:3px;font-weight:700}.qe.on .own{color:var(--gold2)}.board .t{line-height:1.05}';
  document.head.appendChild(styleEl);
  $('#qh img').src = K.faceURL('Q', 'H'); $('#qd img').src = K.faceURL('Q', 'D');
  const statusEl = document.createElement('div'); statusEl.className = 'status hide'; stage.appendChild(statusEl);
  const bannerEl = document.createElement('div'); bannerEl.className = 'banner'; stage.appendChild(bannerEl);
  const actions = document.createElement('div'); actions.className = 'actions'; stage.appendChild(actions);
  const flipBtn = document.createElement('button'); flipBtn.className = 'btn hide'; flipBtn.textContent = 'Flip card'; actions.appendChild(flipBtn);
  const chooseBtn = document.createElement('button'); chooseBtn.className = 'btn ghost hide'; chooseBtn.textContent = 'Choose card'; actions.appendChild(chooseBtn);
  const handEl = document.createElement('div'); handEl.className = 'hand'; stage.appendChild(handEl);

  const SEAT_CORNER = [{ l: 1, t: 0 }, { l: 1, t: 1 }, { l: 0, t: 1 }, { l: 0, t: 0 }];
  const SEAT_SETS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
  let S = null, token = 0, SP = (/[?&]fast=([\d.]+)/.exec(location.search) || [0, 1])[1] * 1 || 1, auto = false, humanResolve = null, G = null;
  const Abort = {};
  const wait = async ms => { const t = token; await K.sleep(ms * SP); if (t !== token) throw Abort; };
  const chk = t => { if (t !== token) throw Abort; };
  const hum = () => S.pl.find(p => p.human);
  const cval = c => K.rankVal(c.r);

  function rectIn(el) { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
  function geo() {
    const f = rectIn($('.felt', stage));
    const cw = Math.max(34, Math.min(f.w * .1, f.h * .19, 88));
    stage.style.setProperty('--cw', cw + 'px');
    G = { f, cw, ch: cw * 1.4, cx: f.x + f.w / 2, cy: f.y + f.h / 2 };
  }
  function slot(seat, kind, i) {
    const { f, cw, ch } = G, c = SEAT_CORNER[seat], m = cw * .26, dir = c.l ? 1 : -1, vs = c.t ? 1 : -1;
    const bx = c.l ? f.x + m : f.x + f.w - m - cw, y = c.t ? f.y + m : f.y + f.h - m - ch;
    i = i || 0;
    if (kind === 'pile') return { x: bx - dir * i * .0, y: y - i * 1.1, r: 0, s: 1, z: 10 + i };
    if (kind === 'play') return { x: bx + dir * cw * 1.3, y: y + vs * cw * .18, r: dir * 3, s: 1, z: 300 };
    if (kind === 'duel') return { x: bx + dir * (cw * 1.3 + cw * .34 * (i + 1)), y: y + vs * (cw * .18 + (i % 2 ? 6 : -4)), r: dir * (3 + (i + 1) * 4), s: .96, z: 300 + i };
  }
  function seatPos(seat) { const c = SEAT_CORNER[seat], H = stage.clientHeight, W = stage.clientWidth; return { x: c.l ? 2 : W - 62, y: c.t ? 8 : H - 84 }; }
  function addCard(card, up, at) {
    const el = K.cardEl(card, up); stage.appendChild(el);
    K.place(el, Object.assign({ dur: 0 }, at || { x: G.cx - G.cw / 2, y: G.cy - G.ch / 2, r: 0, s: 1, z: 1 }));
    el.getBoundingClientRect(); return el;
  }
  const mv = (el, to, dur) => K.place(el, Object.assign({}, to, { dur: (dur === undefined ? 520 : dur) * SP }));
  const status = t => { statusEl.textContent = t; statusEl.classList.toggle('hide', !t); };
  async function banner(t, sub, ms) { bannerEl.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); bannerEl.classList.add('show'); await wait(ms || 1100); bannerEl.classList.remove('show'); }

  /* ---------- seats & piles ---------- */
  function buildSeats() {
    stage.querySelectorAll('.seat,.pile-n,.pc').forEach(e => e.remove());
    S.pl.forEach(p => {
      const el = document.createElement('div'); el.className = 'seat';
      el.innerHTML = K.avatarHTML(p.av, 38) + '<div class="nm">' + p.name + '</div><div class="sc">26</div><div class="sub">cards</div>';
      stage.appendChild(el); p.seatEl = el;
      const chip = document.createElement('div'); chip.className = 'pile-n'; stage.appendChild(chip); p.chip = chip;
      p.layers = [];
    });
    seatLayout();
  }
  function seatLayout() {
    S.pl.forEach(p => {
      const q = seatPos(p.seat); p.seatEl.style.left = q.x + 'px'; p.seatEl.style.top = q.y + 'px';
      const c = SEAT_CORNER[p.seat], s = slot(p.seat, 'pile'); p.chip.style.left = (s.x + G.cw / 2) + 'px'; p.chip.style.top = (c.t ? s.y + G.ch + 5 : s.y - 20) + 'px';
    });
  }
  function renderPile(p) {
    const n = p.pile.length, want = n === 0 ? 0 : Math.min(4, 1 + Math.floor((n - 1) / 10));
    while (p.layers.length < want) { const el = addCard(null, false, slot(p.seat, 'pile', p.layers.length)); p.layers.push(el); }
    while (p.layers.length > want) p.layers.pop().remove();
    p.layers.forEach((el, i) => K.place(el, Object.assign({ dur: 0 }, slot(p.seat, 'pile', i))));
    p.chip.textContent = n; p.chip.classList.toggle('hide', n === 0);
    p.seatEl.querySelector('.sc').textContent = n;
    p.seatEl.classList.toggle('out', n === 0);
  }
  function setTurn(p) { S.pl.forEach(q => q.seatEl.classList.toggle('turn', q === p)); }
  function updateQueens() {
    [['H', 'qh', 'qho'], ['D', 'qd', 'qdo']].forEach(([s, a, b]) => {
      const o = S.q[s]; $('#' + a).classList.toggle('on', o !== null); $('#' + b).textContent = o === null ? 'Unclaimed' : S.pl[o].name;
    });
  }

  /* ---------- flow ---------- */
  async function start(opts, roster) {
    token++; const t = token;
    stage.querySelectorAll('.pc,.seat,.pile-n').forEach(e => e.remove());
    K.mountTable(stage); geo(); handEl.classList.remove('show');
    humanResolve = null; [flipBtn, chooseBtn].forEach(b => b.classList.add('hide')); status('');
    const seats = SEAT_SETS[roster.length];
    S = { opts, q: { H: null, D: null }, round: 0, over: false, rw: 0, camp: 0, pl: roster.map((r, i) => Object.assign({}, r, { seat: seats[i], pile: [] })) };
    buildSeats(); updateQueens();
    K.Profile.game('queendom-come').played++; K.Profile.save(); UI.setInGame(true);
    try {
      /* shuffle + deal */
      const deck = K.shuffle(K.deck52()), n = S.pl.length, per = Math.floor(52 / n);
      status('Shuffling…'); K.sfx.shuffle();
      const tmp = []; for (let i = 0; i < 6; i++) { const e = addCard(null, false, { x: G.cx - G.cw / 2 + (i - 3) * 2, y: G.cy - G.ch / 2 - i, r: 0, s: 1, z: 500 + i }); tmp.push(e); }
      await wait(600);
      for (let j = 0; j < per; j++) for (let i = 0; i < n; i++) S.pl[i].pile.push(deck.pop());
      /* leftover cards (3 players) go to the first player so nothing is lost */
      while (deck.length) S.pl[0].pile.push(deck.pop());
      for (let k = 0; k < 8; k++) for (const p of S.pl) { const e = addCard(null, false, { x: G.cx - G.cw / 2, y: G.cy - G.ch / 2, r: 0, s: 1, z: 600 + k }); const sp = slot(p.seat, 'pile'); mv(e, { x: sp.x, y: sp.y, r: 0, s: 1, z: 600 + k }, 300); setTimeout(() => e.remove(), 380 * SP); K.sfx.deal(); await wait(34); }
      tmp.forEach(e => e.remove()); S.pl.forEach(renderPile); status('');
      await wait(300);
      await play(t);
    } catch (e) { if (e !== Abort) throw e; }
  }

  function waitHuman(p, t) {
    return new Promise(res => {
      const done = (idx) => { flipBtn.classList.add('hide'); chooseBtn.classList.add('hide'); handEl.classList.remove('show'); const top = p.layers[p.layers.length - 1]; if (top) { top.classList.remove('hit', 'glow'); top.onclick = null; } humanResolve = null; res(idx); };
      humanResolve = () => done(-1);
      if (auto) { setTimeout(() => humanResolve && humanResolve(), 420 * SP); return; }
      const top = p.layers[p.layers.length - 1];
      if (top) { top.classList.add('hit', 'glow'); top.onclick = () => done(-1); }
      flipBtn.classList.remove('hide'); chooseBtn.classList.remove('hide');
      flipBtn.onclick = () => done(-1);
      chooseBtn.onclick = () => {
        handEl.innerHTML = ''; const take = p.pile.slice(-13).reverse();
        take.forEach((c, i) => { const im = document.createElement('img'); im.src = K.faceURL(c.r, c.s); im.alt = K.label(c); im.onclick = () => done(p.pile.length - 1 - i); handEl.appendChild(im); });
        handEl.classList.toggle('show');
      };
    });
  }

  async function playCard(p, idx, n, t) {
    const c = idx < 0 || idx >= p.pile.length ? p.pile.pop() : p.pile.splice(idx, 1)[0];
    const src = p.layers.length ? Object.assign({}, p.layers[p.layers.length - 1].pos) : slot(p.seat, 'pile');
    const el = addCard(c, false, { x: src.x, y: src.y, r: 0, s: 1, z: 280 });
    if (p.layers.length > 1 || p.pile.length === 0) renderPile(p); else { p.chip.textContent = p.pile.length; p.seatEl.querySelector('.sc').textContent = p.pile.length; }
    renderPile(p);
    mv(el, slot(p.seat, n === 0 ? 'play' : 'duel', n - 1), 460);
    await wait(120);
    return { p, c, el };
  }

  function decide(plays) {
    const qd = plays.find(x => x.c.r === 'Q' && x.c.s === 'D');
    if (qd) return { w: [qd], why: 'Queen of Diamonds beats all' };
    const hasD = plays.some(x => x.c.s === 'D');
    const qh = plays.find(x => x.c.r === 'Q' && x.c.s === 'H');
    if (qh && !hasD) return { w: [qh], why: 'Queen of Hearts' };
    const tiers = [['D', 'Diamonds trump'], ['H', 'Hearts'], ['K', 'King']];
    for (const [k, why] of tiers) {
      const set = k === 'K' ? plays.filter(x => x.c.r === 'K') : plays.filter(x => x.c.s === k);
      if (!set.length) continue;
      const hi = Math.max(...set.map(x => cval(x.c)));
      return { w: set.filter(x => cval(x.c) === hi), why };
    }
    const hi = Math.max(...plays.map(x => cval(x.c)));
    return { w: plays.filter(x => cval(x.c) === hi), why: 'High card' };
  }

  async function roundOf(parts, t, inCampaign) {
    S.round++;
    const live = parts.filter(p => p.pile.length);
    const pool = []; const plays = [];
    let n = 0;
    for (const p of live) {
      setTurn(p);
      let idx = -1;
      status(p.human ? 'Your move - flip or choose a card' : '');
      if (p.human) idx = await waitHuman(p, t);
      chk(t);
      const pl = await playCard(p, idx, 0, t); plays.push(pl); pool.push(pl);
      K.place(pl.el, { up: true, dur: 520 * SP }); K.sfx.flip();
      if (!p.human) await wait(260);
    }
    setTurn(null); status('');
    await wait(900);
    let res = decide(plays), duelN = 0, cur = plays;
    while (res.w.length > 1) {
      const tied = res.w.map(x => x.p);
      await banner('DUEL!', tied.map(p => p.name).join(' vs '), 900);
      const next = [];
      for (const p of tied) {
        if (!p.pile.length) continue;
        duelN++;
        const pl = await playCard(p, -1, duelN, t); K.place(pl.el, { up: true, dur: 520 * SP }); K.sfx.flip(); next.push(pl); pool.push(pl);
      }
      await wait(900);
      if (!next.length) { res = { w: [res.w[0]], why: 'Duel' }; break; }
      if (next.length === 1) { res = { w: next, why: 'Duel' }; break; }
      res = decide(next); res.why = 'Duel';
    }
    const win = res.w[0].p;
    const cards = pool.map(x => x.c);
    /* queen ownership */
    cards.forEach(c => { if (c.r === 'Q' && (c.s === 'H' || c.s === 'D')) { if (S.q[c.s] !== S.pl.indexOf(win)) { K.sfx.queen(); } S.q[c.s] = S.pl.indexOf(win); } });
    updateQueens();
    status(win.name + ' wins - ' + res.why);
    pool.forEach(x => x.el.classList.add('glow'));
    (win.human ? K.sfx.win : K.sfx.deal)();
    await wait(900);
    const sp = slot(win.seat, 'pile', win.layers.length);
    pool.forEach((x, i) => { setTimeout(() => { mv(x.el, { x: sp.x, y: sp.y, r: 0, s: .9, z: 700 + i }, 420); K.place(x.el, { up: false }); }, i * 55 * SP); });
    await wait(420 + pool.length * 55);
    pool.forEach(x => x.el.remove());
    K.shuffle(cards); win.pile = cards.concat(win.pile);
    if (win.human) S.rw++;
    S.pl.forEach(renderPile); status('');
    await wait(200);
    return win;
  }

  const alive = () => S.pl.filter(p => p.pile.length);
  async function play(t) {
    while (!S.over) {
      const live = alive();
      if (live.length <= 1 || S.round > 1500) break;
      if (hum() && !hum().pile.length) break;
      await roundOf(live, t, false);
      chk(t);
      const a = S.q.H, b = S.q.D;
      if (a !== null && b !== null && a !== b && S.pl[a].pile.length && S.pl[b].pile.length) { const w = await campaign(S.pl[a], S.pl[b], t); if (S.opts.mode === 'quick') { S.champ = w; break; } }
      if (S.opts.mode === 'quick' && S.round >= 80) break;
    }
    S.over = true;
    await finish(t);
  }

  async function campaign(a, b, t) {
    S.camp++;
    K.sfx.fanfare();
    await banner('CAMPAIGN!', a.name + ' (Q♥) vs ' + b.name + ' (Q♦)', 1700);
    S.pl.forEach(p => { if (p !== a && p !== b) p.seatEl.classList.add('out'); });
    const all = K.shuffle(a.pile.concat(b.pile)), half = Math.floor(all.length / 2);
    K.sfx.shuffle(); a.pile = all.slice(0, half); b.pile = all.slice(half);
    S.pl.forEach(renderPile); await wait(700);
    let guard = 0;
    const cap = S.opts.mode === 'quick' ? 40 : 1500;
    while (a.pile.length && b.pile.length && guard++ < cap) {
      await roundOf([a, b], t, true);
      if (hum() && !hum().pile.length) break;
    }
    const w = a.pile.length === b.pile.length ? (K.rand(2) ? a : b) : (a.pile.length > b.pile.length ? a : b), lo = w === a ? b : a;
    if (lo.pile.length) { w.pile = w.pile.concat(lo.pile); lo.pile = []; S.pl.forEach(renderPile); }
    S.q.H = S.q.D = S.pl.indexOf(w); updateQueens();
    S.pl.forEach(p => p.seatEl.classList.toggle('out', !p.pile.length));
    await banner(w.name + ' takes the campaign', 'Every card from both stacks', 1300);
    return w;
  }

  async function finish(t) {
    status(''); setTurn(null);
    const h = hum(), left = alive();
    let winner = S.champ || (left.length === 1 ? left[0] : S.pl.slice().sort((x, y) => y.pile.length - x.pile.length)[0]);
    const won = winner === h;
    const st = K.Profile.game('queendom-come'), room = K.Profile.room();
    st.rounds += S.round; st.roundsWon += S.rw;
    if (won) { st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
    st.extra.campaigns = (st.extra.campaigns || 0) + S.camp;
    const earned = Math.round((30 + (won ? 100 : 0) + Math.min(60, S.rw)) * room.mult);
    K.Profile.get().credits += earned; K.Profile.save();
    if (won) { K.sfx.fanfare(); K.confetti(stage); } else K.sfx.lose();
    await K.sleep(700);
    const m = K.modal('<h2>' + (won ? 'Queendom is yours!' : winner.name + ' takes the queendom') + '</h2><p>' + (won ? (S.champ ? 'You won the campaign.' : S.pl.length && alive().length === 1 ? 'You hold every card.' : 'You hold the most cards.') : (h && !h.pile.length ? 'You ran out of cards.' : 'Better luck next hand.')) + '</p><p style="margin-top:8px">Rounds: <b>' + S.round + '</b> &middot; Campaigns: <b>' + S.camp + '</b></p><p style="margin-top:6px">Credits earned: <b style="color:var(--gold2)">+' + earned + '</b> (' + room.name + ' ' + room.mult + 'x)</p><div class="row"><button class="btn ghost" data-act="menu">Menu</button><button class="btn" data-act="again">Play again</button></div>', { sticky: true });
    m.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return; m.close(); UI.setInGame(false);
      if (a.dataset.act === 'again') { const o = UI.setup(); start(o, rosterFor(+o.players)); } else UI.showMenu();
    });
  }
  function rosterFor(n) {
    const P = K.Profile.get(), names = K.shuffle(['Duke', 'Vera', 'Sterling', 'Mae', 'Rook', 'Isla']);
    return Array.from({ length: n }, (_, i) => i === 0 ? { name: P.name || 'You', av: P.av, human: true } : { name: names[i], av: { g: K.rand(12), c: K.rand(8) }, human: false });
  }

  /* ---------- hud ---------- */
  function ibtn(txt, label, fn) { const b = document.createElement('button'); b.className = 'ibtn'; b.innerHTML = txt; b.setAttribute('aria-label', label); b.onclick = fn; hud.appendChild(b); return b; }
  hud.style.position = 'absolute';
  const bMenu = ibtn('&#9776;', 'Menu', () => UI.showMenu());
  const bSnd = ibtn(K.Profile.get().sound ? '&#128266;' : '&#128263;', 'Sound', () => { const P = K.Profile.get(); P.sound = !P.sound; K.setSound(P.sound); K.Profile.save(); bSnd.innerHTML = P.sound ? '&#128266;' : '&#128263;'; });
  const bAuto = ibtn('Auto', 'Auto play', () => { auto = !auto; bAuto.style.background = auto ? 'linear-gradient(180deg,#f1dc8e,#c9a227)' : ''; bAuto.style.color = auto ? '#241a02' : ''; if (auto && humanResolve) setTimeout(() => humanResolve && humanResolve(), 300); });
  const bSpd = ibtn('1x', 'Speed', () => { SP = SP === 1 ? .55 : SP === .55 ? .3 : 1; bSpd.textContent = SP === 1 ? '1x' : SP === .55 ? '2x' : '4x'; });
  bAuto.style.fontSize = bSpd.style.fontSize = '11px'; bAuto.style.fontWeight = bSpd.style.fontWeight = '800';
  function placeHud() {
    const H = stage.clientHeight, W = stage.clientWidth;
    [[bMenu, 11, H / 2 - 46], [bSnd, 11, H / 2 + 4], [bAuto, W - 51, H / 2 - 46], [bSpd, W - 51, H / 2 + 4]].forEach(([b, x, y]) => { b.style.left = x + 'px'; b.style.top = y + 'px'; });
  }
  function relayout() {
    placeHud(); if (!S) return; K.clearSprites(); geo(); seatLayout(); S.pl.forEach(renderPile);
  }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(relayout, 120); });
  addEventListener('orientationchange', () => { clearTimeout(rz); rz = setTimeout(relayout, 300); });

  const rules = '<h3>The deal</h3><p>The deck is split evenly. Everyone flips the top card at once; the winner takes every card played.</p>' +
    '<h3>Who wins a hand</h3><ol><li><b>Queen of Diamonds</b> beats everything.</li><li><b>Queen of Hearts</b> beats everything except a diamond.</li><li>Diamonds beat hearts - highest diamond wins.</li><li>Then hearts, then kings, then the highest card.</li><li>A tie is a <b>duel</b>: tied players flip another card.</li></ol>' +
    '<h3>Campaign</h3><p>Win the Queen of Hearts and the Queen of Diamonds with <b>different</b> players and a campaign is declared: their stacks are shuffled together and they play it out head-to-head. The winner takes every card from both.</p>' +
    '<h3>Winning</h3><p>Out of cards and you are out. The last player with cards holds the queendom. In a <b>Quick</b> match the first campaign decides it (or most cards after 80 rounds).</p>' +
    '<h3>Choose a card</h3><p>Tap <b>Choose card</b> to see your top 13 cards and play any of them instead of the top card.</p>';
  const UI = CardUI.init({
    stage, id: 'queendom-come', title: 'QUEENDOM COME', sub: 'Two queens. One crown.', rules,
    fan: [{ r: 'Q', s: 'H' }, { r: 'K', s: 'S' }, { r: 'Q', s: 'D' }],
    fields: [{ key: 'players', label: 'Players', def: 4, options: [{ v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' }] },
      { key: 'mode', label: 'Match length', def: 'quick', options: [{ v: 'quick', t: 'Quick' }, { v: 'classic', t: 'Classic' }], note: 'Quick: the first campaign (capped at 40 rounds) decides the match, or most cards after 80 rounds. Classic: play until one player holds every card.' }],
    onPlay: (opts, roster) => start(opts, roster),
    statExtra: s => [[(s.extra && s.extra.campaigns) || 0, 'Campaigns']]
  });
  geo(); placeHud();
  if (window.Install) Install.registerSW();
  UI.showMenu();
})();
