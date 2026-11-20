/* Kings Corner */
(function () {
  'use strict';
  const K = CardKit, $ = K.$;
  const stage = $('#stage');
  K.setBack('navy');
  K.mountTable(stage);

  const hud = document.createElement('div'); hud.className = 'hud'; stage.appendChild(hud);
  const board = document.createElement('div'); board.className = 'board';
  board.innerHTML = '<div class="t serif">KINGS CORNER</div><div class="s" id="bsub">FIRST TO 364</div>';
  stage.appendChild(board);
  const statusEl = document.createElement('div'); statusEl.className = 'status hide'; stage.appendChild(statusEl);
  const bannerEl = document.createElement('div'); bannerEl.className = 'banner'; stage.appendChild(bannerEl);
  const actions = document.createElement('div'); actions.className = 'actions'; stage.appendChild(actions);
  const flipBtn = document.createElement('button'); flipBtn.className = 'btn hide'; flipBtn.textContent = 'Flip card'; actions.appendChild(flipBtn);

  const SEAT_CORNER = [{ l: 1, t: 0 }, { l: 1, t: 1 }, { l: 0, t: 1 }, { l: 0, t: 0 }]; /* BL, TL, TR, BR */
  const SEAT_SETS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
  const kval = r => r === 'A' ? 1 : r === 'J' ? 11 : r === 'Q' ? 12 : +r;
  let GOAL = 364;

  let S = null, token = 0, SP = (/[?&]fast=([\d.]+)/.exec(location.search) || [0, 1])[1] * 1 || 1, auto = false, humanResolve = null, G = null;
  const Abort = {};
  const wait = async ms => { const t = token; await K.sleep(ms * SP); if (t !== token) throw Abort; };
  const chk = t => { if (t !== token) throw Abort; };

  /* ---------- geometry ---------- */
  function rectIn(el) { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
  function geo() {
    const f = rectIn($('.felt', stage));
    const cw = Math.max(34, Math.min(f.w * .105, f.h * .2, 92));
    stage.style.setProperty('--cw', cw + 'px');
    G = { f, cw, ch: cw * 1.4, cx: f.x + f.w / 2, cy: f.y + f.h / 2 };
    return G;
  }
  function slot(seat, kind, i) {
    const { f, cw, ch } = G, c = SEAT_CORNER[seat], m = cw * .26, dir = c.l ? 1 : -1;
    const bx = c.l ? f.x + m : f.x + f.w - m - cw, y = c.t ? f.y + m : f.y + f.h - m - ch;
    i = i || 0;
    switch (kind) {
      case 'king': return { x: bx, y, r: 0, s: 1, z: 5 };
      case 'mate': return { x: bx + dir * cw * .6, y: y + (c.t ? 1 : -1) * cw * .06, r: dir * 2.5, s: 1, z: 300 };
      case 'tie': return { x: bx + dir * cw * 1.05, y: y + (c.t ? 1 : -1) * cw * .5, r: dir * -6, s: .92, z: 400 + i };
      case 'disc': return { x: bx + dir * (cw * .6 + (i % 5) * 1.2), y: y + (c.t ? -1 : 1) * 0 + (i % 4) * .8, r: 0, s: 1, z: 20 + i };
      case 'pile': return { x: bx + dir * cw * 1.95 - dir * i * .22, y: y - i * .55, r: 0, s: 1, z: 40 + i };
    }
  }
  function chipPos(seat) { const { cw, ch } = G, c = SEAT_CORNER[seat], p = slot(seat, 'mate'); return { x: p.x + cw / 2, y: c.t ? p.y + ch + 6 : p.y - 20 }; }
  function seatPos(seat) { const c = SEAT_CORNER[seat], H = stage.clientHeight, W = stage.clientWidth; return { x: c.l ? 2 : W - 62, y: c.t ? 8 : H - 84 }; }

  /* ---------- seats ---------- */
  function buildSeats() {
    stage.querySelectorAll('.seat,.pile-n').forEach(e => e.remove());
    S.pl.forEach(p => {
      const el = document.createElement('div'); el.className = 'seat';
      el.innerHTML = K.avatarHTML(p.av, 38) + '<div class="nm">' + p.name + '</div><div class="sc">0</div><div class="sub"></div>';
      stage.appendChild(el); p.seatEl = el;
      const chip = document.createElement('div'); chip.className = 'pile-n hide'; stage.appendChild(chip); p.chip = chip;
    });
    seatLayout(); renderScores();
  }
  function seatLayout() {
    if (!S) return;
    S.pl.forEach(p => { const q = seatPos(p.seat); p.seatEl.style.left = q.x + 'px'; p.seatEl.style.top = q.y + 'px'; const cp = chipPos(p.seat); p.chip.style.left = cp.x + 'px'; p.chip.style.top = cp.y + 'px'; });
  }
  function renderScores() {
    S.pl.forEach(p => {
      const sc = S.team ? S.tscore[p.team] : p.score;
      p.seatEl.querySelector('.sc').textContent = sc;
      p.seatEl.querySelector('.sub').textContent = S.team ? 'Team ' + (p.team ? 'B' : 'A') : (p.human ? 'Player' : 'CPU');
    });
  }
  function setTurn(p) { S.pl.forEach(q => q.seatEl.classList.toggle('turn', q === p)); }
  const status = t => { statusEl.textContent = t; statusEl.classList.toggle('hide', !t); };
  async function banner(t, sub, ms) { bannerEl.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); bannerEl.classList.add('show'); await wait(ms || 1100); bannerEl.classList.remove('show'); }
  function floatAt(x, y, txt, pos) { const e = document.createElement('div'); e.className = 'float ' + (pos ? 'pos' : 'neg'); e.textContent = txt; e.style.left = x + 'px'; e.style.top = y + 'px'; stage.appendChild(e); setTimeout(() => e.remove(), 1500); }

  function addCard(card, up, at) {
    const el = K.cardEl(card, up); stage.appendChild(el);
    K.place(el, Object.assign({ dur: 0 }, at || { x: G.cx - G.cw / 2, y: G.cy - G.ch / 2, r: 0, s: 1, z: 1 }));
    el.getBoundingClientRect();
    return el;
  }
  const mv = (el, to, dur) => K.place(el, Object.assign({}, to, { dur: (dur === undefined ? 520 : dur) * SP }));

  /* ---------- game flow ---------- */
  async function start(opts, roster) {
    token++; const t = token;
    stage.querySelectorAll('.pc,.seat,.pile-n').forEach(e => e.remove());
    K.mountTable(stage); geo();
    humanResolve = null; flipBtn.classList.add('hide'); status('');
    const seats = SEAT_SETS[roster.length];
    GOAL = +opts.goal || 364;
    S = { opts, team: opts.partner === 'on' && roster.length === 4, tscore: [0, 0], round: 0, over: false, rw: 0, rounds: 0, best: 0 };
    S.pl = roster.map((r, i) => Object.assign({}, r, { seat: seats[i], score: 0, team: seats[i] % 2, pile: [], disc: [], mate: null, ties: [], rwins: 0 }));
    buildSeats();
    K.Profile.game('kings-corner').played++; K.Profile.save();
    UI.setInGame(true);
    $('#bsub').textContent = 'FIRST TO ' + GOAL + (S.team ? ' · PARTNERSHIP' : '');
    try {
      await chooseKings(t);
      await dealPiles(t);
      await play(t);
    } catch (e) { if (e !== Abort) throw e; }
  }

  async function chooseKings(t) {
    const kings = K.SUITS.map(s => ({ r: 'K', s }));
    const { cw, ch, cx, cy } = G;
    if (S.opts.method === 'grab') {
      const els = K.shuffle(kings.slice()).map((c, i) => addCard(c, false, { x: cx - cw / 2, y: cy - ch / 2, r: 0, s: 1, z: 10 }));
      status('Free grab: pick your king');
      els.forEach((el, i) => { K.sfx.deal(); mv(el, { x: cx - cw * 2.3 + i * cw * 1.2, y: cy - ch / 2, r: (i - 1.5) * 4, s: 1, z: 10 + i }, 400); });
      await wait(550);
      const taken = new Set(); let pickedEl = null;
      const human = S.pl.find(p => p.human);
      if (human) {
        pickedEl = await new Promise(res => {
          let done = false;
          const fin = el => { if (done) return; done = true; humanResolve = null; res(el); };
          els.forEach(el => { el.classList.add('hit'); el.addEventListener('click', () => fin(el)); });
          humanResolve = () => fin(els[K.rand(4)]);
          if (auto) setTimeout(() => humanResolve && humanResolve(), 700 * SP);
        });
        chk(t);
        els.forEach(el => el.classList.remove('hit'));
        human.king = pickedEl; taken.add(pickedEl);
      }
      status('');
      for (const p of S.pl) {
        if (p.king) continue;
        const free = els.filter(e => !taken.has(e)); const el = free[K.rand(free.length)];
        taken.add(el); p.king = el; await wait(300);
        el.classList.add('glow'); K.sfx.flip(); await wait(250); el.classList.remove('glow');
      }
      for (const p of S.pl) { p.suit = p.king.card.s; K.place(p.king, { up: true, dur: 500 * SP }); K.sfx.flip(); await wait(260); }
      await wait(500);
      els.filter(e => !taken.has(e)).forEach(e => { mv(e, { x: cx - cw / 2, y: cy - ch / 2, r: 0, s: .7, z: 1 }, 300); setTimeout(() => e.remove(), 400); });
    } else {
      /* flip match: draw from the shuffled deck until each player has a different suit */
      status('Flipping for kings…');
      const deckCards = K.shuffle(K.deck52().filter(c => c.r !== 'K'));
      const stack = addCard(deckCards[0], false, { x: cx - cw * 2.2, y: cy - ch / 2, r: 0, s: 1, z: 2 }); let di = 0;
      const used = new Set();
      for (const p of S.pl) {
        while (true) {
          const c = deckCards[di++ % deckCards.length];
          const el = addCard(c, false, { x: cx - cw * 2.2, y: cy - ch / 2, r: 0, s: 1, z: 50 });
          K.sfx.deal(); mv(el, { x: cx - cw / 2 + (p.seat < 2 ? -1 : 1) * cw * .3, y: cy - ch / 2, r: 0, s: 1, z: 60 }, 350);
          await wait(380); K.place(el, { up: true, dur: 380 * SP }); K.sfx.flip(); await wait(560);
          if (used.has(c.s)) { status(p.name + ' drew ' + K.SYM[c.s] + ' - already taken, flip again'); mv(el, { x: cx - cw * 2.2, y: G.f.y + G.f.h, r: 0, s: .8, z: 1 }, 380); setTimeout(() => el.remove(), 500); await wait(450); continue; }
          used.add(c.s); p.suit = c.s;
          status(p.name + ' draws ' + K.SYM[c.s] + ' - the King of ' + { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }[c.s]);
          mv(el, { x: cx - cw / 2, y: G.f.y + G.f.h, r: 0, s: .6, z: 1 }, 380); setTimeout(() => el.remove(), 500);
          p.king = addCard({ r: 'K', s: c.s }, false); K.sfx.flip(); K.place(p.king, { up: true, dur: 400 * SP });
          mv(p.king, slot(p.seat, 'king'), 600); await wait(700); break;
        }
      }
      stack.remove(); status('');
    }
    /* kings to corners */
    S.pl.forEach(p => { p.suit = p.king.card.s; K.sfx.deal(); mv(p.king, slot(p.seat, 'king'), 650); p.king.classList.remove('glow'); });
    await wait(700);
    const sp = S.pl.find(p => p.suit === 'S');
    S.starter = sp ? S.pl.indexOf(sp) : 0;
    if (sp) await banner('King of Spades starts', sp.name + ' leads the first round', 1400);
  }

  async function dealPiles(t) {
    const { cx, cy, cw, ch } = G;
    const all = [];
    S.pl.forEach(p => {
      const cards = K.shuffle(K.RANKS.filter(r => r !== 'K').map(r => ({ r, s: p.suit })));
      p.pile = cards.map((c, i) => { const el = addCard(c, false); all.push([p, el, i]); return el; });
    });
    all.sort((a, b) => a[2] - b[2]);
    for (const [p, el, i] of all) {
      mv(el, slot(p.seat, 'pile', i), 380); if (i % 3 === 0) K.sfx.deal();
      if (p === S.pl[S.pl.length - 1]) await wait(45);
    }
    S.pl.forEach(pileShadow); await wait(500);
  }

  function pileShadow(p) { p.pile.forEach((el, i) => el.classList.toggle('deep', i < p.pile.length - 1)); }
  function pileTop(p) { return p.pile[p.pile.length - 1]; }
  async function ensurePile(p, t, keep) {
    if (p.pile.length) return;
    const cards = p.disc.splice(0); if (!keep && p.mate) { cards.push(p.mate); p.mate = null; }
    if (!cards.length) return;
    K.sfx.shuffle(); status(p.name + ' reshuffles');
    K.shuffle(cards);
    cards.forEach((el, i) => { K.place(el, { up: false, dur: 0 }); mv(el, { x: G.cx - G.cw / 2, y: G.cy - G.ch / 2, r: K.rand(20) - 10, s: 1, z: 700 + i }, 380); });
    await wait(430);
    cards.forEach((el, i) => { el.style.zIndex = 40 + i; mv(el, slot(p.seat, 'pile', i), 420); });
    p.pile = cards; pileShadow(p); await wait(480); status('');
  }

  function waitHuman(p) {
    return new Promise(res => {
      const top = pileTop(p);
      const done = () => { top.classList.remove('hit', 'glow'); flipBtn.classList.add('hide'); flipBtn.onclick = null; top.onclick = null; humanResolve = null; res(); };
      humanResolve = done;
      if (auto) { setTimeout(() => humanResolve && humanResolve(), 420 * SP); return; }
      top.classList.add('hit', 'glow'); top.onclick = done; flipBtn.classList.remove('hide'); flipBtn.onclick = done;
    });
  }

  async function flipFor(p, t) {
    setTurn(p);
    await ensurePile(p, t); chk(t);
    status(p.human ? 'Your flip - tap your pile' : p.name + ' flips');
    if (p.human) await waitHuman(p); else await wait(520);
    chk(t);
    const el = p.pile.pop(); pileShadow(p);
    if (p.mate) { const old = p.mate; p.disc.push(old); mv(old, slot(p.seat, 'disc', p.disc.length), 400); old.classList.add('dim'); }
    p.mate = el; el.classList.remove('dim');
    K.place(el, Object.assign({ up: true, dur: 560 * SP }, slot(p.seat, 'mate'))); K.sfx.flip();
    await wait(620);
    const v = kval(el.card.r), tot = 13 + v;
    p.total = tot; p.chip.textContent = 'K + ' + el.card.r + ' = ' + tot; p.chip.classList.remove('hide');
    return tot;
  }

  async function play(t) {
    let leader = S.starter;
    while (!S.over) {
      S.round++; $('#bsub').textContent = 'ROUND ' + S.round + ' · FIRST TO ' + GOAL + (S.team ? ' · PARTNERSHIP' : '');
      S.pl.forEach(p => { p.chip.classList.add('hide'); p.king.classList.remove('glow'); if (p.mate) p.mate.classList.remove('glow'); });
      const order = S.pl.map((_, i) => S.pl[(leader + i) % S.pl.length]);
      for (const p of order) await flipFor(p, t);
      setTurn(null); status('');
      /* decide */
      let winners, tieNote = '';
      const val = p => p.total;
      if (S.team) {
        const tt = [0, 0]; S.pl.forEach(p => tt[p.team] += p.total);
        S.pl.forEach(p => { p.chip.textContent += '  (team ' + tt[p.team] + ')'; });
        let tw = tt[0] === tt[1] ? null : (tt[0] > tt[1] ? 0 : 1);
        if (tw === null) { tieNote = 'Teams tied at ' + tt[0] + ' - tie-break flip'; tw = await tieBreakTeams(t); }
        winners = S.pl.filter(p => p.team === tw);
        S.last = { team: tw, pts: tt[tw], tt };
      } else {
        const hi = Math.max(...S.pl.map(val));
        let cand = S.pl.filter(p => val(p) === hi);
        if (cand.length > 1) { tieNote = 'Tie at ' + hi + ' - flipping a card to break it'; cand = [await tieBreak(cand, t)]; }
        winners = cand;
      }
      if (tieNote) await banner('Tie!', tieNote, 900);
      chk(t);
      /* score */
      const hum = S.pl.find(p => p.human); S.rounds++;
      winners.forEach(w => { w.mate.classList.add('glow'); w.king.classList.add('glow'); w.rwins++; });
      if (S.team) {
        const tw = winners[0].team, tt = S.last.tt;
        S.tscore[tw] += tt[tw]; S.tscore[1 - tw] -= tt[1 - tw];
        S.pl.forEach(p => { const cp = chipPos(p.seat); floatAt(cp.x, cp.y, (p.team === tw ? '+' : '-') + p.total, p.team === tw); });
        S.pl.forEach(p => { if (p.team === tw) p.score += p.total; else p.score -= p.total; });
        if (hum && winners.includes(hum)) S.rw++;
      } else {
        const w = winners[0];
        const div = S.pl.length - 1; /* 2 players: full penalty (zero-sum); 3-4 solo: split so scores can climb */
        S.pl.forEach(p => { const cp = chipPos(p.seat); if (p === w) { p.score += p.total; floatAt(cp.x, cp.y, '+' + p.total, true); } else { const pen = Math.round(p.total / div); p.score -= pen; floatAt(cp.x, cp.y, '-' + pen, false); } });
        if (hum && w === hum) S.rw++;
        leader = S.pl.indexOf(w);
      }
      if (hum) S.best = Math.max(S.best, hum.total);
      if (S.team) leader = S.pl.indexOf(winners[0]);
      (winners.some(w => w.human) ? K.sfx.win : K.sfx.lose)();
      renderScores();
      await wait(1300);
      chk(t);
      /* goal check */
      const sc = S.team ? [S.tscore[0], S.tscore[1]] : S.pl.map(p => p.score);
      const top = Math.max(...sc);
      if (top >= GOAL) {
        S.over = true;
        let wp;
        if (S.team) { const tw = S.tscore[0] >= S.tscore[1] ? 0 : 1; wp = S.pl.filter(p => p.team === tw); }
        else wp = [S.pl[sc.indexOf(top)]];
        await finish(wp, t);
      }
    }
  }

  async function tieBreak(cand, t) {
    let pool = cand.slice(), n = 0;
    while (pool.length > 1) {
      const draws = [];
      for (const p of pool) {
        await ensurePile(p, t, true);
        let v, el = null;
        if (p.pile.length) { el = p.pile.pop(); v = kval(el.card.r); K.place(el, Object.assign({ up: true, dur: 500 * SP }, slot(p.seat, 'tie', n++))); K.sfx.flip(); p.disc.push(el); }
        else v = 1 + K.rand(12);
        draws.push([p, v, el]);
      }
      await wait(900);
      const hi = Math.max(...draws.map(d => d[1])); pool = draws.filter(d => d[1] === hi).map(d => d[0]);
    }
    return pool[0];
  }
  async function tieBreakTeams(t) {
    let n = 0;
    while (true) {
      const sums = [0, 0];
      for (const p of S.pl) {
        await ensurePile(p, t, true);
        if (p.pile.length) { const el = p.pile.pop(); sums[p.team] += kval(el.card.r); K.place(el, Object.assign({ up: true, dur: 500 * SP }, slot(p.seat, 'tie', n++))); K.sfx.flip(); p.disc.push(el); }
        else sums[p.team] += 1 + K.rand(12);
      }
      await wait(1000);
      if (sums[0] !== sums[1]) return sums[0] > sums[1] ? 0 : 1;
    }
  }

  async function finish(winners, t) {
    status(''); setTurn(null);
    const hum = S.pl.find(p => p.human), won = winners.includes(hum);
    const st = K.Profile.game('kings-corner'), room = K.Profile.room();
    st.rounds += S.rounds; st.roundsWon += S.rw; st.best = Math.max(st.best, S.best);
    if (won) { st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
    const lenF = GOAL <= 91 ? .6 : GOAL >= 364 ? 1.8 : 1;
    const earned = Math.round((40 + (won ? 100 : 0) + S.rw * 4) * room.mult * lenF);
    K.Profile.get().credits += earned; K.Profile.save();
    if (won) { K.sfx.fanfare(); K.confetti(stage); } else K.sfx.lose();
    const names = winners.map(w => w.name).join(' & ');
    const rows = S.pl.slice().sort((a, b) => (S.team ? S.tscore[b.team] - S.tscore[a.team] : b.score - a.score)).map(p => '<div class="prow">' + K.avatarHTML(p.av, 28) + '<b style="flex:1">' + p.name + (S.team ? ' <small style="color:var(--muted)">Team ' + (p.team ? 'B' : 'A') + '</small>' : '') + '</b><span style="font-weight:800;color:var(--gold2)">' + (S.team ? S.tscore[p.team] : p.score) + '</span></div>').join('');
    await K.sleep(900);
    const m = K.modal('<h2>' + (won ? 'You win!' : names + ' wins') + '</h2><p style="margin-bottom:8px">' + (won ? 'You reached ' + GOAL + ' first.' : 'Reached ' + GOAL + ' first.') + '</p><div class="plist">' + rows + '</div><p style="margin-top:10px">Credits earned: <b style="color:var(--gold2)">+' + earned + '</b> (' + room.name + ' ' + room.mult + 'x)</p><div class="row"><button class="btn ghost" data-act="menu">Menu</button><button class="btn" data-act="again">Play again</button></div>', { sticky: true });
    m.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return; m.close();
      UI.setInGame(false);
      if (a.dataset.act === 'again') { const o = UI.setup(); start(o, rosterFor(+o.players)); } else UI.showMenu();
    });
  }
  function rosterFor(n) {
    const P = K.Profile.get(), names = K.shuffle(['Duke', 'Vera', 'Sterling', 'Mae', 'Rook', 'Isla']);
    return Array.from({ length: n }, (_, i) => i === 0 ? { name: P.name || 'You', av: P.av, human: true } : { name: names[i], av: { g: K.rand(12), c: K.rand(8) }, human: false });
  }

  /* ---------- hud buttons ---------- */
  function ibtn(txt, label, left, top, fn) {
    const b = document.createElement('button'); b.className = 'ibtn'; b.innerHTML = txt; b.setAttribute('aria-label', label);
    b.style.left = left; b.style.top = top; b.onclick = fn; hud.appendChild(b); return b;
  }
  const bMenu = ibtn('&#9776;', 'Menu', '11px', 'calc(50vh - 46px)', () => UI.showMenu());
  const bSnd = ibtn(K.Profile.get().sound ? '&#128266;' : '&#128263;', 'Sound', '11px', 'calc(50vh + 4px)', () => { const P = K.Profile.get(); P.sound = !P.sound; K.setSound(P.sound); K.Profile.save(); bSnd.innerHTML = P.sound ? '&#128266;' : '&#128263;'; });
  const bAuto = ibtn('Auto', 'Auto play', 'calc(100vw - 51px)', 'calc(50vh - 46px)', () => { auto = !auto; bAuto.style.background = auto ? 'linear-gradient(180deg,#f1dc8e,#c9a227)' : ''; bAuto.style.color = auto ? '#241a02' : ''; if (auto && humanResolve) setTimeout(() => humanResolve && humanResolve(), 300); });
  bAuto.style.fontSize = '11px'; bAuto.style.fontWeight = '800';
  const bSpd = ibtn('1x', 'Speed', 'calc(100vw - 51px)', 'calc(50vh + 4px)', () => { SP = SP === 1 ? .55 : SP === .55 ? .3 : 1; bSpd.textContent = SP === 1 ? '1x' : SP === .55 ? '2x' : '4x'; });
  bSpd.style.fontSize = '12px'; bSpd.style.fontWeight = '800';
  /* portrait: stage is rotated, so keep controls inside the stage */
  hud.style.position = 'absolute';
  [bMenu, bSnd, bAuto, bSpd].forEach(b => { b.style.position = 'absolute'; });
  function placeHud() {
    const H = stage.clientHeight, W = stage.clientWidth;
    bMenu.style.left = '11px'; bMenu.style.top = (H / 2 - 46) + 'px'; bSnd.style.left = '11px'; bSnd.style.top = (H / 2 + 4) + 'px';
    bAuto.style.left = (W - 51) + 'px'; bAuto.style.top = (H / 2 - 46) + 'px'; bSpd.style.left = (W - 51) + 'px'; bSpd.style.top = (H / 2 + 4) + 'px';
  }

  /* ---------- relayout ---------- */
  function relayout() {
    placeHud(); if (!S) return; K.clearSprites(); geo(); seatLayout();
    S.pl.forEach(p => {
      if (p.king) K.place(p.king, Object.assign({ dur: 0 }, slot(p.seat, 'king')));
      p.pile.forEach((el, i) => K.place(el, Object.assign({ dur: 0 }, slot(p.seat, 'pile', i)))); pileShadow(p);
      p.disc.forEach((el, i) => K.place(el, Object.assign({ dur: 0 }, slot(p.seat, 'disc', i + 1))));
      if (p.mate) K.place(p.mate, Object.assign({ dur: 0 }, slot(p.seat, 'mate')));
    });
  }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(relayout, 120); });
  addEventListener('orientationchange', () => { clearTimeout(rz); rz = setTimeout(relayout, 300); });

  /* ---------- UI / menu ---------- */
  const rules = '<h3>The kings</h3><p>Each player gets one king, and with it that whole suit. Pick by <b>free grab</b> (choose a face-down king) or <b>flip match</b> (flip cards until every player holds a different suit). The King of Spades starts the first round.</p>' +
    '<h3>A round</h3><p>Your king sits face-up in your corner and your other 12 cards face-down. Every player flips one card, which joins their king (the <b>corner mate</b>).</p>' +
    '<h3>Scoring</h3><ul><li>King + number card = 13 + the number</li><li>King + Jack = 13 + 11, King + Queen = 13 + 12</li><li>King + Ace = 14</li></ul><p>The highest total wins the round and adds its points. Every other hand <b>loses</b> its own points. A tie is broken by flipping another card. (With 3 or 4 solo players each losing hand pays its points divided by the number of opponents, so the game can actually be won; with 2 players or teams it is the full amount.)</p>' +
    '<h3>Winning</h3><p>First to <b>364</b> (the total of one suit across four) wins. In <b>partnership</b> (4 players) opposite corners are a team and their totals combine.</p>' +
    '<h3>Credits</h3><p>Win games to earn credits and unlock richer rooms that pay more.</p>';
  const UI = CardUI.init({
    stage, id: 'kings-corner', title: 'KINGS CORNER', sub: 'A card game of four corners', rules,
    fan: [{ r: 'K', s: 'S' }, { r: 'K', s: 'H' }, { r: 'K', s: 'D' }, { r: 'K', s: 'C' }],
    fields: [
      { key: 'players', label: 'Players', def: 4, options: [{ v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' }] },
      { key: 'partner', label: 'Partnership', def: 'off', options: [{ v: 'off', t: 'Solo' }, { v: 'on', t: 'Teams' }], enabled: s => +s.players === 4, note: 'Teams: opposite corners play together (4 players).' },
      { key: 'goal', label: 'Game length', def: 182, options: [{ v: 91, t: 'Sprint 91' }, { v: 182, t: 'Quick 182' }, { v: 364, t: 'Classic 364' }], note: 'Classic 364 is the full game and takes a long while; use Auto and 4x to speed it up.' },
      { key: 'method', label: 'Choosing kings', def: 'grab', options: [{ v: 'grab', t: 'Free grab' }, { v: 'flip', t: 'Flip match' }] }
    ],
    onPlay: (opts, roster) => start(opts, roster),
    statExtra: s => [[s.best || 0, 'Best hand']]
  });
  geo(); placeHud();
  if (window.Install) Install.registerSW();
  UI.showMenu();
})();
