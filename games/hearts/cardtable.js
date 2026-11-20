/* CardTable - shared 4-seat table for trick games (Spades, Hearts) and Blackjack.
   Seats: 0 = you (bottom, face-up fan), 1 = left, 2 = top, 3 = right (CPU, face-down fans). */
(function (global) {
  'use strict';
  const K = global.CardKit, $ = K.$;

  function create(cfg) {
    const stage = $('#stage');
    K.setBack(cfg.back || 'navy');
    K.mountTable(stage);
    const T = { stage, K, S: null, token: 0, auto: false, G: null, Abort: {}, humanResolve: null, seatsEl: [], hands: [[], [], [], []] };
    T.SP = (/[?&]fast=([\d.]+)/.exec(location.search) || [0, 1])[1] * 1 || 1;

    const hud = document.createElement('div'); hud.className = 'hud'; stage.appendChild(hud);
    const statusEl = document.createElement('div'); statusEl.className = 'status hide'; stage.appendChild(statusEl);
    const bannerEl = document.createElement('div'); bannerEl.className = 'banner'; stage.appendChild(bannerEl);
    const actions = document.createElement('div'); actions.className = 'actions'; stage.appendChild(actions);
    T.actions = actions;

    T.wait = async ms => { const t = T.token; await K.sleep(ms * T.SP); if (t !== T.token) throw T.Abort; };
    T.chk = t => { if (t !== T.token) throw T.Abort; };
    T.status = t => { statusEl.textContent = t; statusEl.classList.toggle('hide', !t); };
    T.banner = async (t, sub, ms) => { bannerEl.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); bannerEl.classList.add('show'); await T.wait(ms || 1100); bannerEl.classList.remove('show'); };

    function rectIn(el) { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
    T.geo = function () {
      const f = rectIn($('.felt', stage));
      const cw = Math.max(32, Math.min(f.w * .085, f.h * .17, 80));
      stage.style.setProperty('--cw', cw + 'px');
      T.G = { f, cw, ch: cw * 1.4, cx: f.x + f.w / 2, cy: f.y + f.h / 2 };
      return T.G;
    };

    /* ---------- slots ---------- */
    const CPUS = .6;
    T.handSlot = function (seat, i, n) {
      const { f, cw, ch, cx, cy } = T.G, mid = (n - 1) / 2;
      if (seat === 0) {
        const step = Math.min(cw * .64, (f.w * .66 - cw) / Math.max(1, n - 1)), w = step * (n - 1) + cw, x0 = cx - w / 2, d = i - mid;
        return { x: x0 + step * i, y: f.y + f.h - ch - 12 + d * d * .22, r: d * 1.6, s: 1, z: 40 + i };
      }
      const cw2 = cw * CPUS, ch2 = ch * CPUS;
      if (seat === 2) { const step = Math.min(cw2 * .34, (f.w * .4) / Math.max(1, n)), w = step * (n - 1) + cw2; return { x: cx - w / 2 + step * i + (cw - cw2) / 2 * 0, y: f.y + 4 - (ch - ch2) / 2, r: 0, s: CPUS, z: 10 + i, ox: (cw - cw2) / 2 * -1 }; }
      const step = Math.min(ch2 * .26, (f.h * .5) / Math.max(1, n)), h = step * (n - 1) + ch2, y0 = cy - h / 2 - (ch - ch2) / 2;
      const bx = seat === 1 ? f.x + 52 - (cw - cw2) / 2 : f.x + f.w - 52 - cw2 - (cw - cw2) / 2;
      return { x: bx, y: y0 + step * i, r: 0, s: CPUS, z: 10 + i };
    };
    T.trickSlot = function (seat) {
      const { cw, ch, cx, cy } = T.G;
      if (seat === 0) return { x: cx - cw / 2, y: cy + ch * .02, r: 2, s: 1, z: 300 };
      if (seat === 2) return { x: cx - cw / 2 + 4, y: cy - ch * 1.02, r: -2, s: 1, z: 300 };
      if (seat === 1) return { x: cx - cw * 1.55, y: cy - ch * .52, r: -6, s: 1, z: 300 };
      return { x: cx + cw * .55, y: cy - ch * .48, r: 6, s: 1, z: 300 };
    };
    T.seatPos = function (seat) {
      const { f, cx, cy, cw } = T.G;
      if (seat === 0) return { x: f.x + 6, y: f.y + f.h - 90 };
      if (seat === 2) return { x: cx - cw * 2.7, y: f.y + 6 };
      if (seat === 1) return { x: f.x + 4, y: cy - 72 };
      return { x: f.x + f.w - 58, y: cy - 72 };
    };
    T.offPos = function (seat) {
      const { f, cx, cy, cw, ch } = T.G;
      return seat === 0 ? { x: cx - cw / 2, y: f.y + f.h + ch } : seat === 2 ? { x: cx - cw / 2, y: f.y - ch * 2 } : seat === 1 ? { x: f.x - cw * 2, y: cy } : { x: f.x + f.w + cw, y: cy };
    };

    /* ---------- seats ---------- */
    T.buildSeats = function (roster, cls) {
      stage.querySelectorAll('.seat').forEach(e => e.remove()); T.seatsEl = [];
      roster.forEach((p, i) => {
        const el = document.createElement('div'); el.className = 'seat' + (cls ? ' ' + cls : '');
        el.innerHTML = K.avatarHTML(p.av, 38) + '<div class="nm">' + p.name + '</div><div class="sc"></div><div class="sub"></div>';
        stage.appendChild(el); T.seatsEl[i] = el;
      });
      T.seatLayout();
    };
    T.seatLayout = function () { T.seatsEl.forEach((el, i) => { const q = T.seatPos(i); el.style.left = q.x + 'px'; el.style.top = q.y + 'px'; }); };
    T.seatText = (i, sc, sub) => { const el = T.seatsEl[i]; if (!el) return; if (sc != null) el.querySelector('.sc').textContent = sc; if (sub != null) el.querySelector('.sub').textContent = sub; };
    T.setTurn = i => T.seatsEl.forEach((el, k) => el.classList.toggle('turn', k === i));

    /* ---------- cards ---------- */
    T.addCard = function (card, up, at) {
      const el = K.cardEl(card, up); stage.appendChild(el);
      K.place(el, Object.assign({ dur: 0 }, at || { x: T.G.cx - T.G.cw / 2, y: T.G.cy - T.G.ch / 2, r: 0, s: 1, z: 1 }));
      el.getBoundingClientRect(); return el;
    };
    T.mv = (el, to, dur) => K.place(el, Object.assign({}, to, { dur: (dur === undefined ? 480 : dur) * T.SP }));
    T.layoutHand = function (seat, dur) {
      const h = T.hands[seat], n = h.length;
      h.forEach((el, i) => T.mv(el, T.handSlot(seat, i, n), dur));
    };
    T.clearCards = function () { stage.querySelectorAll('.pc').forEach(e => e.remove()); T.hands = [[], [], [], []]; };
    T.sortHand = (cards, suitOrder) => cards.slice().sort((a, b) => (suitOrder.indexOf(a.s) - suitOrder.indexOf(b.s)) || (K.rankVal(b.r) - K.rankVal(a.r)));

    /* deal: hands = [[cards x4]], deals round-robin, human face-up and sorted */
    T.deal = async function (hands, suitOrder, t) {
      T.hands = [[], [], [], []];
      const stk = { x: T.G.cx - T.G.cw / 2, y: T.G.cy - T.G.ch / 2, r: 0, s: 1, z: 1 };
      const sorted0 = T.sortHand(hands[0], suitOrder);
      const maxn = Math.max(...hands.map(h => h.length));
      for (let k = 0; k < maxn; k++) for (let s = 0; s < 4; s++) {
        if (!hands[s] || k >= hands[s].length) continue;
        const card = s === 0 ? sorted0[k] : hands[s][k];
        const el = T.addCard(card, false, stk); el.seat = s; T.hands[s].push(el);
        T.mv(el, T.handSlot(s, T.hands[s].length - 1, hands[s].length), 260); K.sfx.deal && K.sfx.deal();
        await T.wait(k === 0 && s === 0 ? 40 : 38); T.chk(t);
      }
      await T.wait(300); T.chk(t);
      T.hands[0].sort((a, b) => (suitOrder.indexOf(a.card.s) - suitOrder.indexOf(b.card.s)) || (K.rankVal(b.card.r) - K.rankVal(a.card.r)));
      T.hands[0].forEach(el => K.place(el, { up: true, dur: 320 * T.SP }));
      T.layoutHand(0, 300); await T.wait(380); T.chk(t);
    };
    T.resortHand0 = function () { T.layoutHand(0, 250); };

    /* human picks one of `legal` (array of els). Resolves el. Auto resolves via fallback(el list) */
    T.pick = function (legal, fallback, t) {
      return new Promise(res => {
        const done = el => { T.humanResolve = null; T.hands[0].forEach(e => { e.classList.remove('hit', 'dim', 'glow'); e.onclick = null; e.style.cursor = ''; }); res(el); };
        T.hands[0].forEach(e => { const ok = legal.includes(e); e.classList.toggle('dim', !ok); e.classList.toggle('hit', ok); e.classList.toggle('glow', ok); e.onclick = ok ? () => { K.sfx.tap && K.sfx.tap(); done(e); } : null; });
        T.humanResolve = () => done(fallback(legal));
        if (T.auto) setTimeout(() => { if (T.humanResolve && T.token === t) T.humanResolve(); }, 420 * T.SP);
      });
    };

    /* ---------- misc ui ---------- */
    T.floatAt = function (x, y, txt, pos) { const e = document.createElement('div'); e.className = 'float ' + (pos ? 'pos' : 'neg'); e.textContent = txt; e.style.left = x + 'px'; e.style.top = y + 'px'; stage.appendChild(e); setTimeout(() => e.remove(), 1500); };
    T.btn = function (txt, cls, fn) { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = txt; b.onclick = fn; actions.appendChild(b); return b; };
    T.clearActions = () => { actions.innerHTML = ''; };
    function ibtn(txt, label, fn) { const b = document.createElement('button'); b.className = 'ibtn'; b.innerHTML = txt; b.setAttribute('aria-label', label); b.onclick = fn; b.style.position = 'absolute'; hud.appendChild(b); return b; }
    const bMenu = ibtn('&#9776;', 'Menu', () => T.onMenu && T.onMenu());
    const bSnd = ibtn(K.Profile.get().sound ? '&#128266;' : '&#128263;', 'Sound', () => { const P = K.Profile.get(); P.sound = !P.sound; K.setSound(P.sound); K.Profile.save(); bSnd.innerHTML = P.sound ? '&#128266;' : '&#128263;'; });
    const bAuto = ibtn('Auto', 'Auto play', () => { T.auto = !T.auto; bAuto.style.background = T.auto ? 'linear-gradient(180deg,#f1dc8e,#c9a227)' : ''; bAuto.style.color = T.auto ? '#241a02' : ''; if (T.auto && T.humanResolve) setTimeout(() => T.humanResolve && T.humanResolve(), 250); T.onAuto && T.onAuto(); });
    const bSpd = ibtn('1x', 'Speed', () => { T.SP = T.SP === 1 ? .55 : T.SP === .55 ? .3 : 1; bSpd.textContent = T.SP === 1 ? '1x' : T.SP === .55 ? '2x' : '4x'; });
    bAuto.style.fontSize = '11px'; bAuto.style.fontWeight = '800'; bSpd.style.fontSize = '12px'; bSpd.style.fontWeight = '800';
    T.placeHud = function () {
      const H = stage.clientHeight, W = stage.clientWidth;
      bMenu.style.left = '11px'; bMenu.style.top = (H / 2 - 46) + 'px'; bSnd.style.left = '11px'; bSnd.style.top = (H / 2 + 4) + 'px';
      bAuto.style.left = (W - 51) + 'px'; bAuto.style.top = (H / 2 - 46) + 'px'; bSpd.style.left = (W - 51) + 'px'; bSpd.style.top = (H / 2 + 4) + 'px';
    };
    if (cfg.noAuto) { bAuto.style.display = 'none'; }

    /* standard game finish modal */
    T.finish = async function (o) {
      T.status(''); T.setTurn(-1);
      const st = K.Profile.game(cfg.id), room = K.Profile.room();
      st.rounds += o.rounds || 0; st.roundsWon += o.roundsWon || 0; st.best = Math.max(st.best || 0, o.best || 0);
      if (o.won) { st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
      const earned = Math.round((o.base || 40) * room.mult * (o.mult || 1) + (o.won ? (o.winBonus || 100) * room.mult : 0));
      K.Profile.get().credits += earned; K.Profile.save();
      if (o.won) { K.sfx.fanfare(); K.confetti(stage); } else K.sfx.lose();
      await K.sleep(900 * T.SP);
      const m = K.modal('<h2>' + o.title + '</h2><p style="margin-bottom:8px">' + (o.sub || '') + '</p><div class="plist">' + (o.rows || '') + '</div><p style="margin-top:10px">Credits earned: <b style="color:var(--gold2)">+' + earned + '</b> (' + room.mult + 'x room)</p><div class="row"><button class="btn ghost" data-act="menu">Menu</button><button class="btn" data-act="again">Play again</button></div>', { sticky: true });
      m.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; m.close(); T.inGame = false; o.onChoice(a.dataset.act); });
    };
    T.resultRow = (p, text, hi) => '<div class="prow">' + K.avatarHTML(p.av, 28) + '<b style="flex:1">' + p.name + '</b><span style="font-weight:800;color:' + (hi ? 'var(--gold2)' : 'var(--ink)') + '">' + text + '</span></div>';
    T.rosterFor = function (n) {
      const P = K.Profile.get(), names = K.shuffle(['Duke', 'Vera', 'Sterling', 'Mae', 'Rook', 'Isla', 'Beau', 'Nova']);
      return Array.from({ length: n }, (_, i) => i === 0 ? { name: P.name || 'You', av: P.av, human: true } : { name: names[i], av: { g: K.rand(12), c: K.rand(8) }, human: false });
    };

    /* ---------- online lockstep (Supabase room via Multi) ---------- */
    const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
    T.net = null;
    T.rnd = n => T.net ? Math.floor(T.net.rng() * n) : K.rand(n);
    T.shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = T.rnd(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    T.netEnd = () => { const N = T.net; T.net = null; if (N) { try { N.sess.close(); } catch (e) { } } const ab = stage.querySelector('.ibtn[aria-label="Auto play"]'); if (ab) ab.style.display = ''; };
    T.netStart = sess => {
      T.netEnd(); if (!sess) return;
      const N = T.net = { sess, me: sess.me, n: sess.players.length, rng: mulberry(sess.seed), q: {}, w: {} }; T.auto = false;
      const ab = stage.querySelector('.ibtn[aria-label="Auto play"]'); if (ab) ab.style.display = 'none';
      sess.on('act', d => { const k = d.g + ':' + d.kind, w = N.w[k]; if (w && w.length) w.shift()(d.v); else (N.q[k] = N.q[k] || []).push(d.v); });
      sess.onLeave = p => { if (T.net !== N) return; T.token++; T.humanResolve = null; T.clearActions && T.clearActions(); const m = K.modal('<h2>Game ended</h2><p>' + ((p && p.name) || 'A player') + ' left the room.</p><div class="row"><button class="btn" data-x>Back to menu</button></div>', { sticky: true }); m.addEventListener('click', e => { if (e.target.closest('[data-x]')) { m.close(); T.inGame = false; T.netEnd(); T.onMenu && T.onMenu(); } }); };
    };
    /* the controller of a seat (its human, or the host for CPU seats) decides and broadcasts; everyone else waits for it */
    T.act = async (lseat, kind, compute) => {
      const N = T.net; if (!N) return compute(); const g = (lseat + N.me) % 4, ctrl = g < N.n ? g : 0;
      if (ctrl === N.me) { const v = await compute(); N.sess.send('act', { g, kind, v }); return v; }
      const k = g + ':' + kind; if (N.q[k] && N.q[k].length) return N.q[k].shift(); return new Promise(res => { (N.w[k] = N.w[k] || []).push(res); });
    };
    T.netRoster = (sess, roster) => Array.from({ length: 4 }, (_, i) => { const g = (i + sess.me) % 4, p = sess.players[g]; return p ? { name: p.name, av: p.av, human: true } : Object.assign({}, roster[1 + (g - sess.players.length) % 3]); });
    T.netHands = hg => T.net ? [0, 1, 2, 3].map(i => hg[(i + T.net.me) % 4]) : hg;
    let rz; const rl = () => { clearTimeout(rz); rz = setTimeout(() => { T.placeHud(); T.relayout && T.relayout(); }, 150); };
    addEventListener('resize', rl); addEventListener('orientationchange', () => setTimeout(rl, 300));
    T.geo(); T.placeHud();
    return T;
  }
  global.CardTable = { create };
})(window);
