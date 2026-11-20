/* Showcial — AI artist talent show PWA (vanilla JS, no build step) */
(function () {
  'use strict';

  /* ---------- brand config: change the name here (plus manifest + index <title>) ---------- */
  const BRAND = 'Showcial';

  const { GENRES, VOICES, Player, renderWav, rng } = window.SC_AUDIO;
  const KEY = 'showcial.v1';
  const ROUND_MS = 3 * 24 * 3600e3;   // each round lasts 3 days
  const VOTES_PER_ROUND = 5;
  const MAX_MINE = 3;
  const PRICE = '$0.99';
  const GENRE_COLORS = { pop: '#ff6bd6', hiphop: '#ffcc4d', rnb: '#b06bff', edm: '#00d4ff', rock: '#ff4d6a', country: '#ffa24d', latin: '#ff3d81', lofi: '#7cffc4' };
  const LOOK = {
    shape: [['orb', 'Orb'], ['squircle', 'Squircle'], ['hex', 'Hex'], ['drop', 'Drop']],
    eyes: [['visor', 'Visor'], ['dots', 'Dots'], ['lens', 'Lens'], ['slits', 'Slits'], ['stars', 'Stars']],
    top: [['none', 'None'], ['halo', 'Halo'], ['antenna', 'Antenna'], ['phones', 'Headphones'], ['spikes', 'Spikes'], ['crown', 'Crown']]
  };
  const PALETTES = [[262, 190], [330, 262], [190, 150], [20, 330], [45, 10], [160, 210], [290, 200], [0, 40]];
  const VOICE_DESC = { silky: 'Smooth & warm', airy: 'Light, high, breathy', raspy: 'Gritty edge', robotic: 'Vocoder chrome', deep: 'Low & heavy', choir: 'Stacked harmony' };
  const W1 = ['Midnight', 'Chrome', 'Velvet', 'Neon', 'Paper', 'Glass', 'Static', 'Golden', 'Electric', 'Satellite', 'Lucky', 'Low', 'Cherry', 'Silver', 'Echo', 'Wild', 'Sugar', 'Hollow'];
  const W2 = ['Heart', 'Summer', 'Signal', 'Motel', 'Skyline', 'Ghost', 'Fever', 'Highway', 'Parade', 'Mirror', 'Weather', 'Arcade', 'Romance', 'Garden', 'Frequency', 'Pulse', 'Daydream', 'Riot'];
  const N1 = ['Nova', 'Echo', 'Zara', 'Kilo', 'Pixel', 'Juno', 'Vex', 'Lyra', 'Onyx', 'Rio', 'Sable', 'Taro', 'Uma', 'Halo', 'Kai', 'Mira'];
  const N2 = ['Vale', '.exe', 'Byte', 'Static', 'Bloom', 'Wave', 'Kade', 'Volt', 'Rae', 'Flux', 'Moon', 'Synth', 'Grid', 'Ray'];
  const VIBES = ['Heartbreak, but make it chrome', 'Built for the 2am drive home', 'Sad lyrics, happy drums', 'Born in a server farm, raised on vinyl', 'Glitter in the circuits', 'Main-character energy only', 'Rain on the motherboard', 'Dance floor diplomacy'];
  const SEED = [
    ['Nova Vale', 'pop', 'airy', 'Glitter-pop for late night drives'],
    ['Glimmer.9', 'pop', 'robotic', 'Bubblegum synths, chrome heart'],
    ['MC Parsec', 'hiphop', 'deep', 'Bars from the outer rim'],
    ['Lil Kernel', 'hiphop', 'raspy', 'Low-level flow, high-level hits'],
    ['Velvet Byte', 'rnb', 'silky', 'Slow jams in 16-bit'],
    ['Silk Protocol', 'rnb', 'choir', 'Harmonies, handshake included'],
    ['Voltara', 'edm', 'robotic', 'Peak-time voltage'],
    ['Neon Lotus', 'edm', 'airy', 'Festival bloom'],
    ['Static Wolves', 'rock', 'raspy', 'Feedback and fangs'],
    ['Ivy Circuit', 'rock', 'choir', 'Garage anthems, overgrown'],
    ['Prairie.exe', 'country', 'silky', 'Dust roads and dial tones'],
    ['Rusty Ohm', 'country', 'deep', 'Tall tales, low voltage'],
    ['Sol Byte', 'latin', 'silky', 'Sunset dembow'],
    ['Luna Pixel', 'latin', 'airy', 'Moonlit perreo'],
    ['Mochi Static', 'lofi', 'silky', 'Beats to code to'],
    ['Rain.wav', 'lofi', 'deep', 'Window-fog lullabies']
  ];

  /* ---------- utils ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n.toLocaleString();
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const uid = () => Math.random().toString(36).slice(2, 9);
  const dur = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

  function trackTitle(r) { return pick(r, W1) + ' ' + pick(r, W2); }
  function randomLook(r) {
    const p = pick(r, PALETTES);
    return { shape: pick(r, LOOK.shape)[0], eyes: pick(r, LOOK.eyes)[0], top: pick(r, LOOK.top.filter(t => t[0] !== 'crown'))[0], h1: p[0], h2: p[1] };
  }
  function makeArtist(o) {
    const seed = o.seed || Math.floor(Math.random() * 1e9);
    const r = rng(seed);
    return {
      id: o.id || uid(), name: o.name, genre: o.genre, voice: o.voice, vibe: o.vibe || '',
      look: o.look || randomLook(r), seed, created: Date.now(), mine: !!o.mine,
      rv: 0, tv: 0, plays: 0, hype: 1, elim: null, safeRound: null, champ: null,
      tracks: o.tracks || [0, 1, 2].map(i => ({ t: trackTitle(r), seed: seed + i * 101 }))
    };
  }

  /* ---------- state ---------- */
  let S;
  function freshState() {
    const now = Date.now();
    const s = { v: 1, season: { no: 1, round: 1, total: 5, ends: now + ROUND_MS * 0.62, history: [], champion: null }, artists: [], my: { votes: {}, wish: [], reports: [] }, lastSim: now };
    SEED.forEach((x, i) => {
      const a = makeArtist({ name: x[0], genre: x[1], voice: x[2], vibe: x[3], seed: 1000 + i * 7919 });
      const r = rng(a.seed + 5);
      a.hype = 0.4 + r() * 1.6; a.rv = Math.round(60 + r() * 520 * a.hype); a.tv = a.rv + Math.round(r() * 1800); a.plays = Math.round(a.tv * (2 + r() * 3));
      a.created = now - (16 - i) * 86400e3;
      s.artists.push(a);
    });
    return s;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return s; } } catch (e) { }
    return freshState();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  S = load();

  const byId = id => S.artists.find(a => a.id === id);
  const active = () => S.artists.filter(a => !a.elim);
  const ranked = () => active().sort((a, b) => b.rv - a.rv);
  const roundKey = () => S.season.no + '-' + S.season.round;
  const myVotes = () => S.my.votes[roundKey()] || [];
  const votesLeft = () => S.season.champion ? 0 : VOTES_PER_ROUND - myVotes().length;
  const isFinale = () => S.season.round >= S.season.total;

  function cutCount() {
    const n = active().length;
    if (isFinale() || S.season.champion) return 0;
    let c = Math.max(1, Math.floor(n * 0.25));
    if (n - c < 3) c = Math.max(0, n - 3);
    return c;
  }
  function dangerIds() {
    const pool = active().filter(a => a.safeRound !== S.season.round).sort((a, b) => a.rv - b.rv);
    return new Set(pool.slice(0, cutCount()).map(a => a.id));
  }
  function status(a, danger) {
    if (a.champ) return 'champ';
    if (a.elim) return 'out';
    if (a.safeRound === S.season.round) return 'safe';
    if ((danger || dangerIds()).has(a.id)) return 'danger';
    return 'ok';
  }
  function statusTag(a, danger) {
    const s = status(a, danger);
    if (s === 'champ') return `<span class="tag champ">👑 Champion S${a.champ}</span>`;
    if (s === 'out') return `<span class="tag out">Out · R${a.elim}</span>`;
    if (s === 'safe') return `<span class="tag safe">Safe · new</span>`;
    if (s === 'danger') return `<span class="tag danger">⚠ Danger</span>`;
    return '';
  }

  /* fan simulation + round engine (demo season runs locally) */
  function simulate() {
    const now = Date.now();
    const mins = Math.min(360, (now - S.lastSim) / 60000);
    if (mins > 0.05 && !S.season.champion) {
      active().forEach(a => {
        a._acc = (a._acc || 0) + mins * a.hype * 0.35 * (0.6 + Math.random() * 0.8);
        const w = Math.floor(a._acc); a._acc -= w; a.rv += w; a.tv += w; a.plays += w * 3;
      });
    }
    S.lastSim = now;
    let guard = 10;
    while (!S.season.champion && S.season.ends <= now && guard--) endRound(true);
    save();
  }
  function endRound(quiet) {
    const se = S.season;
    if (se.champion) return;
    if (isFinale()) {
      const champ = ranked()[0];
      se.champion = champ.id; champ.champ = se.no;
      se.history.unshift({ round: se.round, out: [], champ: champ.id, at: Date.now() });
      if (!quiet) { toast(`👑 ${champ.name} wins Season ${se.no}!`); burst(innerWidth / 2, innerHeight / 3, 28); }
      save(); return;
    }
    const d = dangerIds();
    const out = S.artists.filter(a => d.has(a.id));
    out.forEach(a => { a.elim = se.round; });
    se.history.unshift({ round: se.round, out: out.map(a => a.id), top: ranked()[0] && ranked()[0].id, at: Date.now() });
    se.round++; se.ends = quiet ? Math.max(se.ends + ROUND_MS, Date.now() + ROUND_MS / 2) : Date.now() + ROUND_MS;
    active().forEach(a => { a.rv = Math.round(a.rv * 0.12); });
    if (!quiet) toast(`Round over — ${out.length} eliminated: ${out.map(a => a.name).join(', ')}`);
    save();
  }
  function newSeason() {
    const se = S.season;
    S.season = { no: se.no + 1, round: 1, total: 5, ends: Date.now() + ROUND_MS, history: [], champion: null };
    S.artists.forEach(a => { a.elim = null; a.safeRound = null; a.rv = a.mine ? 0 : Math.round(30 + Math.random() * 200 * a.hype); });
    save(); toast(`Season ${S.season.no} is live!`); route();
  }

  /* ---------- avatars ---------- */
  let avN = 0;
  function star(cx, cy, r, fill) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
    return `<path d="${d}Z" fill="${fill}"/>`;
  }
  function avatar(a, cls) {
    const L = a.look, id = 'av' + (avN++);
    const c1 = `hsl(${L.h1} 95% 68%)`, c2 = `hsl(${L.h2} 90% 52%)`, c3 = `hsl(${L.h2} 75% 20%)`;
    const ink = '#0b0920', fillB = `url(#${id}b)`, fillE = `url(#${id}e)`;
    let body;
    if (L.shape === 'squircle') body = `<rect x="38" y="44" width="124" height="124" rx="46" fill="${fillB}"/>`;
    else if (L.shape === 'hex') body = `<path d="M100 40 L156 72 L156 138 L100 170 L44 138 L44 72Z" fill="${fillB}" stroke="${fillB}" stroke-width="14" stroke-linejoin="round"/>`;
    else if (L.shape === 'drop') body = `<path d="M100 32 C128 66 164 94 164 128 A64 64 0 0 1 36 128 C36 94 72 66 100 32Z" fill="${fillB}"/>`;
    else body = `<circle cx="100" cy="106" r="66" fill="${fillB}"/>`;
    let eyes = '', mouth = `<path d="M87 134 Q100 144 113 134" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    switch (L.eyes) {
      case 'dots': eyes = `<circle cx="79" cy="102" r="11" fill="${ink}"/><circle cx="121" cy="102" r="11" fill="${ink}"/><circle cx="82" cy="98" r="4" fill="#fff"/><circle cx="124" cy="98" r="4" fill="#fff"/>`; break;
      case 'lens': eyes = `<circle cx="100" cy="102" r="23" fill="${ink}"/><circle cx="100" cy="102" r="14" fill="${fillE}"/><circle cx="106" cy="96" r="4.5" fill="#fff"/>`; break;
      case 'slits': eyes = `<path d="M64 96 L90 105" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M136 96 L110 105" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`; break;
      case 'stars': eyes = star(79, 102, 14, ink) + star(121, 102, 14, ink) + star(79, 102, 6, '#fff') + star(121, 102, 6, '#fff'); break;
      default: eyes = `<rect x="54" y="88" width="92" height="28" rx="14" fill="${ink}"/><rect x="64" y="99" width="72" height="6" rx="3" fill="${fillE}"/>`;
        mouth = `<rect x="89" y="132" width="22" height="6" rx="3" fill="${ink}" opacity=".55"/>`;
    }
    const top = a.champ ? 'crown' : L.top;
    let behind = '', front = '';
    if (top === 'halo') front = `<ellipse cx="100" cy="30" rx="38" ry="9" fill="none" stroke="#ffe08a" stroke-width="5"/>`;
    if (top === 'antenna') behind = `<path d="M100 48 L100 18" stroke="${c2}" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="15" r="8" fill="${fillE}"/>`;
    if (top === 'spikes') behind = `<path d="M66 60 L76 20 L90 50 L100 8 L110 50 L124 20 L134 60Z" fill="${c1}"/>`;
    if (top === 'crown') front = `<path d="M70 50 L72 20 L88 36 L100 14 L112 36 L128 20 L130 50Z" fill="#ffcc4d" stroke="#fff1bf" stroke-width="2" stroke-linejoin="round"/>`;
    if (top === 'phones') front = `<path d="M36 108 A64 64 0 0 1 164 108" fill="none" stroke="#1a1640" stroke-width="9" stroke-linecap="round"/><rect x="22" y="94" width="24" height="42" rx="11" fill="#1a1640"/><rect x="154" y="94" width="24" height="42" rx="11" fill="#1a1640"/><rect x="28" y="104" width="5" height="22" rx="2.5" fill="${fillE}"/><rect x="167" y="104" width="5" height="22" rx="2.5" fill="${fillE}"/>`;
    const delay = -(((Date.now() / 1000) + (a.seed % 40) / 10) % 4).toFixed(2);
    return `<div class="av ${cls || ''}" data-av="${a.id}"><div class="ring"></div><svg viewBox="0 0 200 200" aria-hidden="true"><defs>
      <radialGradient id="${id}b" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="${c1}"/><stop offset=".72" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
      <linearGradient id="${id}e" x1="0" x2="1"><stop offset="0" stop-color="#00d4ff"/><stop offset="1" stop-color="#e8fbff"/></linearGradient></defs>
      <ellipse cx="100" cy="188" rx="48" ry="7" fill="#000" opacity=".35"/>
      <g class="bob" style="animation-delay:${delay}s">${behind}${body}<ellipse cx="76" cy="72" rx="20" ry="11" fill="#fff" opacity=".28" transform="rotate(-32 76 72)"/>${eyes}${mouth}${front}</g></svg></div>`;
  }

  /* ---------- feedback ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
  function burst(x, y, n) {
    const b = $('#burst'); if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < (n || 12); i++) {
      const s = document.createElement('i'); s.textContent = i % 3 ? '★' : '✦';
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 30}px;--r:${Math.random() * 360}deg;color:${['#ffcc4d', '#00d4ff', '#ff3d81', '#7c5cff'][i % 4]}`;
      b.appendChild(s); setTimeout(() => s.remove(), 950);
    }
  }
  function sheet(html) {
    const w = $('#sheet'); w.querySelector('.sheet').innerHTML = html; w.hidden = false;
    w.onclick = e => { if (e.target === w || e.target.closest('[data-close]')) closeSheet(); };
  }
  function closeSheet() { $('#sheet').hidden = true; }

  /* ---------- actions ---------- */
  function vote(id, el) {
    const a = byId(id); if (!a) return;
    if (S.season.champion) return toast('Season is over — a new one starts soon.');
    if (a.elim) return toast(`${a.name} was eliminated in round ${a.elim}.`);
    if (a.mine) return toast('You can\'t vote for your own artist — share it instead!');
    const mv = myVotes();
    if (mv.includes(id)) return toast(`Already voted for ${a.name} this round.`);
    if (mv.length >= VOTES_PER_ROUND) return toast('Out of votes — they reset next round.');
    S.my.votes[roundKey()] = mv.concat(id);
    a.rv++; a.tv++; save();
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    burst(r.left + r.width / 2, r.top + r.height / 2, 14);
    toast(`★ Voted for ${a.name} — ${votesLeft()} left this round`);
    refresh();
  }
  function playTrack(id, t) {
    const a = byId(id); if (!a) return;
    t = +t || 0;
    const key = id + ':' + t;
    if (Player.cur && Player.cur.id === key) { Player.stop(); return; }
    const tr = a.tracks[t];
    Player.play({ genre: a.genre, voice: a.voice, seed: tr.seed }, { id: key, artistId: id, title: tr.t, sub: a.name + ' · ' + GENRES[a.genre].label, bars: 8 });
    a.plays++; save();
  }
  function playIntro() {
    if (Player.cur && Player.cur.id === 'intro') { Player.stop(); return; }
    Player.play({ genre: 'edm', voice: 'robotic', seed: 777 }, { id: 'intro', title: BRAND + ' Theme', sub: 'Intro music · loops', loop: true });
  }
  async function download(id, t, btn) {
    const a = byId(id), tr = a.tracks[+t];
    const old = btn.textContent; btn.textContent = 'Rendering…'; btn.disabled = true;
    try {
      const blob = await renderWav({ genre: a.genre, voice: a.voice, seed: tr.seed }, 16);
      const url = URL.createObjectURL(blob), l = document.createElement('a');
      l.href = url; l.download = `${a.name} - ${tr.t} (${BRAND} demo).wav`.replace(/[\\/:*?"<>|]/g, '');
      document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Demo downloaded ⤓');
    } catch (e) { toast('Could not render this track on this device.'); }
    btn.textContent = old; btn.disabled = false;
  }
  function buy(id, t) {
    const k = id + ':' + t;
    if (!S.my.wish.includes(k)) S.my.wish.push(k);
    save();
    sheet(`<h3>Checkout opens at launch</h3><p class="muted">Full-length tracks will sell for ${PRICE}, with a share going to the artist's creator. We saved <b>${esc(byId(id).tracks[t].t)}</b> to your wishlist in My Studio so you can grab it the day sales open.</p><div class="row"><button class="btn" data-close>Got it</button></div>`);
  }
  async function share(id) {
    const a = byId(id), url = location.origin + location.pathname + '#a/' + id;
    const data = { title: `${a.name} on ${BRAND}`, text: `Vote for ${a.name} (${GENRES[a.genre].label}) in the ${BRAND} AI talent show!`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch (e) { }
  }
  function report(id) {
    const a = byId(id);
    sheet(`<h3>Report ${esc(a.name)}</h3><p class="muted" style="margin-bottom:.8rem">AI artists must be original. Tell us what's wrong:</p>
      <div class="list-plain">${['Imitates a real artist or person', 'Offensive name, image or content', 'Spam or misleading', 'Something else'].map((r, i) => `<label class="mini"><input type="radio" name="rep" value="${i}" ${i ? '' : 'checked'}> <span class="t">${r}</span></label>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn hot" id="repGo">Send report</button></div>`);
    $('#repGo').onclick = () => { S.my.reports.push({ id, r: +($('input[name=rep]:checked') || {}).value || 0, at: Date.now() }); save(); closeSheet(); toast('Thanks — flagged for review.'); };
  }

  /* ---------- views ---------- */
  function card(a, rank, danger, lead) {
    const G = GENRES[a.genre], V = VOICES[a.voice], voted = myVotes().includes(a.id);
    const pct = lead ? Math.max(4, Math.round(a.rv / lead * 100)) : 0;
    const st = status(a, danger);
    const voteBtn = a.elim ? `<button class="btn small ghost" data-act="open" data-id="${a.id}">Profile</button>`
      : a.mine ? `<button class="btn small ghost" data-act="share" data-id="${a.id}">↗ Share</button>`
        : `<button class="btn small ${voted ? 'voted' : ''}" data-act="vote" data-id="${a.id}">${voted ? '★ Voted' : '★ Vote'}</button>`;
    return `<article class="acard ${a.elim ? 'out' : ''}" style="--glow:hsla(${a.look.h1},90%,60%,.3)" data-card="${a.id}">
      <div class="art" data-act="open" data-id="${a.id}">${rank ? `<span class="rank">#${rank}</span>` : ''}<div class="flags">${statusTag(a, danger)}${a.mine ? '<span class="tag mine">Yours</span>' : ''}</div>${avatar(a, a.elim ? 'out' : '')}</div>
      <div class="body"><div><div class="name">${esc(a.name)}</div><div class="meta">${G.emoji} ${G.label} · ${V.label}</div></div>
      ${a.elim ? `<div class="votes"><span>Total votes</span><b>${fmt(a.tv)}</b></div>` : `<div><div class="votes"><span>Round votes</span><b>${fmt(a.rv)}</b></div><div class="bar ${st === 'danger' ? 'danger' : ''}"><i style="width:${pct}%"></i></div></div>`}
      <div class="acts"><button class="btn small ghost" data-act="play" data-id="${a.id}" data-t="0" data-kind="btn">▶ Play</button>${voteBtn}</div></div></article>`;
  }
  function mini(a, right) {
    return `<div class="mini" data-act="open" data-id="${a.id}">${avatar(a, a.elim ? 'out' : '')}<div class="t"><b>${esc(a.name)}</b><small>${GENRES[a.genre].emoji} ${GENRES[a.genre].label} · ${VOICES[a.voice].label}</small></div>${right || ''}</div>`;
  }
  function roundLabel() {
    const se = S.season;
    if (se.champion) return `Season ${se.no} · Champion crowned`;
    return `Season ${se.no} · ${isFinale() ? 'Grand Finale' : `Round ${se.round} of ${se.total}`}`;
  }
  function countdownHTML() {
    if (S.season.champion) return `<div class="countdown"><button class="btn gold" data-act="newseason">Start Season ${S.season.no + 1}</button></div>`;
    return `<div class="countdown" id="cd"><span class="lbl">${isFinale() ? 'Champion crowned in' : 'Eliminations in'}</span>
      <div class="unit"><b data-u="d">0</b><small>days</small></div><div class="unit"><b data-u="h">00</b><small>hrs</small></div><div class="unit"><b data-u="m">00</b><small>min</small></div><div class="unit"><b data-u="s">00</b><small>sec</small></div></div>`;
  }

  function viewStage() {
    const r = ranked(), lead = r[0], danger = dangerIds();
    const champ = S.season.champion && byId(S.season.champion);
    const hero = champ || lead;
    const genres = Object.keys(GENRES).map(k => {
      const n = active().filter(a => a.genre === k).length;
      return `<a class="genre-tile" href="#showdown/${k}" style="--gc:${GENRE_COLORS[k]}"><span class="e">${GENRES[k].emoji}</span><b>${GENRES[k].label}</b><small>${n} in the running</small></a>`;
    }).join('');
    const tick = r.slice(0, 10).map((a, i) => `<span>#${i + 1} <b>${esc(a.name)}</b> <em>${fmt(a.rv)} ★</em></span>`).join('');
    const dz = active().filter(a => danger.has(a.id)).sort((a, b) => a.rv - b.rv).slice(0, 4);
    const fresh = S.artists.slice().sort((a, b) => b.created - a.created).slice(0, 4);
    const pod = [r[1], r[0], r[2]].map((a, i) => a ? `<div class="pod p${[2, 1, 3][i]}" data-act="open" data-id="${a.id}"><div class="place">${[2, 1, 3][i]}</div>${avatar(a)}<b>${esc(a.name)}</b><small>${fmt(a.rv)} votes</small></div>` : '<div></div>').join('');
    return `
    <section class="hero">
      <div>
        <span class="kicker"><span class="live-dot"></span>Live · ${roundLabel()}</span>
        <h1>Build an <span class="c">AI artist</span>. Step into the <span class="p">spotlight</span>. Win the crowd.</h1>
        <p class="lead">Design a performer — voice, look and sound — then enter the weekly showdown. Fans vote, the bottom quarter gets cut each round, and one artist takes the crown.</p>
        <div class="row"><a class="btn" href="#create">🎤 Start Building</a><a class="btn ghost" href="#showdown">★ Watch &amp; Vote</a></div>
        ${countdownHTML()}
        <div class="row" style="margin-top:1rem"><button class="btn small ghost" data-act="intro" data-kind="intro">🔊 Intro music</button></div>
      </div>
      <div class="stage-card">
        <div class="stage-top"><span class="kicker"><span class="live-dot"></span>${champ ? 'Champion' : 'Now on stage'}</span><span class="tag">#1 · ${fmt(hero.rv)} ★</span></div>
        <div class="floor"></div>
        <div class="stage-art" data-act="open" data-id="${hero.id}">${avatar(hero)}</div>
        <div class="lower-third">
          <div class="who"><b>${esc(hero.name)}</b><span>${GENRES[hero.genre].emoji} ${GENRES[hero.genre].label} · “${esc(hero.tracks[0].t)}”</span></div>
          <button class="icon-btn play" data-act="play" data-id="${hero.id}" data-t="0" data-kind="icon" aria-label="Play">▶</button>
          ${champ ? '' : `<button class="icon-btn ${myVotes().includes(hero.id) ? 'voted' : ''}" data-act="vote" data-id="${hero.id}" aria-label="Vote">★</button>`}
        </div>
      </div>
    </section>
    <div class="ticker" aria-label="Live standings"><div class="ticker-track" style="animation-delay:-${((Date.now() / 1000) % 40).toFixed(1)}s">${tick}${tick}</div></div>
    <section><div class="sec-head"><div><h2>${champ ? 'Final standings' : `Leading round ${S.season.round}`}</h2><p>Votes reset at each elimination — momentum matters.</p></div><a class="link" href="#charts">Full charts →</a></div><div class="podium">${pod}</div></section>
    <section class="two">
      <div><div class="sec-head"><div><h2>⚠ Danger zone</h2><p>${dz.length ? 'Cut when the clock hits zero unless fans step in.' : 'No cuts this round.'}</p></div></div><div class="mini-list">${dz.map(a => mini(a, `<button class="btn small ${myVotes().includes(a.id) ? 'voted' : ''}" data-act="vote" data-id="${a.id}">★ Save</button>`)).join('') || '<div class="empty">Everyone\'s safe — for now.</div>'}</div></div>
      <div><div class="sec-head"><div><h2>Fresh on stage</h2><p>Newest artists in the show.</p></div></div><div class="mini-list">${fresh.map(a => mini(a, `<button class="icon-btn" data-act="play" data-id="${a.id}" data-t="0" data-kind="icon" aria-label="Play">▶</button>`)).join('')}</div></div>
    </section>
    <section><div class="sec-head"><div><h2>Pick a genre</h2><p>Every genre runs its own lane on the main stage.</p></div></div><div class="genres">${genres}</div></section>
    <section><div class="sec-head"><div><h2>How the show works</h2></div></div>
      <div class="steps">
        <div class="step"><div class="n">1</div><h3>Choose a voice</h3><p>Pick a genre and vocal style — silky, raspy, robotic, choir and more.</p></div>
        <div class="step"><div class="n">2</div><h3>Design the avatar</h3><p>Shape, eyes, headgear and colors. Every artist is one of a kind.</p></div>
        <div class="step"><div class="n">3</div><h3>Enter the showdown</h3><p>Your debut single drops and you're safe for your first round.</p></div>
        <div class="step"><div class="n">4</div><h3>Vote &amp; survive</h3><p>Fans get ${VOTES_PER_ROUND} votes a round. The bottom 25% is cut until a champion is crowned.</p></div>
      </div></section>`;
  }

  let filt = { g: 'all', sort: 'votes' };
  function viewShowdown(g) {
    filt.g = g || 'all';
    const danger = dangerIds(), r = ranked(), lead = r[0] ? r[0].rv : 1;
    const rankOf = new Map(r.map((a, i) => [a.id, i + 1]));
    let list = active().filter(a => filt.g === 'all' || a.genre === filt.g);
    if (filt.sort === 'votes') list.sort((a, b) => b.rv - a.rv);
    if (filt.sort === 'new') list.sort((a, b) => b.created - a.created);
    if (filt.sort === 'danger') list.sort((a, b) => a.rv - b.rv);
    const outList = S.artists.filter(a => a.elim && (filt.g === 'all' || a.genre === filt.g));
    const chips = [['all', 'All']].concat(Object.keys(GENRES).map(k => [k, GENRES[k].emoji + ' ' + GENRES[k].label]))
      .map(c => `<button class="chip ${filt.g === c[0] ? 'on' : ''}" data-act="filter" data-g="${c[0]}">${c[1]}</button>`).join('');
    return `<section style="margin-top:.5rem"><div class="sec-head"><div><span class="kicker"><span class="live-dot"></span>${roundLabel()}</span><h2 style="margin-top:.4rem">The Showdown</h2><p>${S.season.champion ? 'Voting is closed for this season.' : `You have <b style="color:var(--gold)">${votesLeft()} of ${VOTES_PER_ROUND}</b> votes left this round. ${cutCount()} artist${cutCount() === 1 ? '' : 's'} will be cut.`}</p></div><a class="btn small hide-sm" href="#create">+ Enter yours</a></div>
      <div class="chips" role="tablist">${chips}</div>
      <div class="toolbar"><span class="muted">${list.length} artist${list.length === 1 ? '' : 's'} still in</span>
        <select data-act="sort" aria-label="Sort"><option value="votes" ${filt.sort === 'votes' ? 'selected' : ''}>Most votes</option><option value="danger" ${filt.sort === 'danger' ? 'selected' : ''}>Closest to the cut</option><option value="new" ${filt.sort === 'new' ? 'selected' : ''}>Newest</option></select></div>
      <div class="grid" style="margin-top:.8rem">${list.map(a => card(a, rankOf.get(a.id), danger, lead)).join('') || '<div class="empty">No artists in this genre yet. <br><a class="btn" href="#create">Create the first one</a></div>'}</div>
    </section>
    ${outList.length ? `<section><div class="sec-head"><div><h2>Eliminated</h2><p>Still streamable — they just can't win this season.</p></div></div><div class="grid">${outList.map(a => card(a, 0, danger, lead)).join('')}</div></section>` : ''}`;
  }

  function viewCharts() {
    const r = ranked(), danger = dangerIds(), n = cutCount();
    const champ = S.season.champion && byId(S.season.champion);
    const rows = r.map((a, i) => (n && i === r.length - n ? `<div class="cutline">Elimination line</div>` : '') +
      `<div class="lrow" data-act="open" data-id="${a.id}"><span class="pos">${i + 1}</span>${avatar(a)}<div class="nm"><b>${esc(a.name)}</b><small>${GENRES[a.genre].emoji} ${GENRES[a.genre].label} · ${fmt(a.tv)} total</small></div><span class="tg">${statusTag(a, danger)}</span><span class="vc">${fmt(a.rv)}</span></div>`).join('');
    const outs = S.artists.filter(a => a.elim).sort((a, b) => b.elim - a.elim);
    const hist = S.season.history.map(h => `<div class="hist"><b>Round ${h.round}</b><p>${h.champ ? `👑 ${esc(byId(h.champ).name)} crowned champion.` : h.out.length ? 'Cut: ' + h.out.map(id => esc((byId(id) || {}).name || '?')).join(', ') : 'No eliminations.'}</p></div>`).join('');
    return `${champ ? `<section><div class="champ-banner">${avatar(champ)}<div><span class="kicker">Season ${S.season.no} champion</span><h2 style="margin:.3rem 0">${esc(champ.name)}</h2><p class="muted">${GENRES[champ.genre].label} · ${fmt(champ.tv)} total votes</p><div class="row" style="margin-top:.8rem"><button class="btn" data-act="play" data-id="${champ.id}" data-t="0" data-kind="btn">▶ Play</button><button class="btn gold" data-act="newseason">Start Season ${S.season.no + 1}</button></div></div></div></section>` : ''}
    <section style="margin-top:.5rem"><div class="sec-head"><div><span class="kicker">${roundLabel()}</span><h2 style="margin-top:.4rem">Live leaderboard</h2><p>Ranked by votes this round. Anyone below the line is cut when the timer ends.</p></div></div>
      <div class="board">${rows}</div></section>
    <section class="two">
      <div><div class="sec-head"><h2>Elimination history</h2></div><div class="history">${hist || '<div class="empty">First cut hasn\'t happened yet.</div>'}</div></div>
      <div><div class="sec-head"><h2>Eliminated</h2></div><div class="mini-list">${outs.map(a => mini(a, `<span class="tag out">R${a.elim}</span>`)).join('') || '<div class="empty">Nobody\'s out yet.</div>'}</div></div>
    </section>
    <details class="host"><summary>Host tools (demo season)</summary><p class="muted" style="margin-top:.5rem">This season runs on your device so you can test the full flow offline. Fan votes are simulated.</p>
      <div class="row"><button class="btn small ghost" data-act="endround" ${S.season.champion ? 'disabled' : ''}>⏭ End round now</button><button class="btn small ghost" data-act="newseason">↺ New season</button><button class="btn small ghost" data-act="wipe">🗑 Reset everything</button></div></details>`;
  }

  function viewMe() {
    const mine = S.artists.filter(a => a.mine), danger = dangerIds(), lead = (ranked()[0] || { rv: 1 }).rv;
    const mv = myVotes().map(byId).filter(Boolean);
    const wish = S.my.wish.map(k => { const [id, t] = k.split(':'); const a = byId(id); return a && { a, t: +t }; }).filter(Boolean);
    const inst = !isStandalone() ? `<div class="install-card"><img src="icons/icon-192.png" alt=""><div><b>Install ${BRAND}</b><p class="muted" style="font-size:.9rem">One tap. Full screen, offline, instant launch.</p></div><button class="btn small" data-act="install">Install</button></div>` : '';
    return `<section style="margin-top:.5rem"><div class="sec-head"><div><h2>My Studio</h2><p>Your artists, votes and wishlist.</p></div>${mine.length < MAX_MINE ? '<a class="btn small" href="#create">+ New artist</a>' : ''}</div>${inst}</section>
    <section><div class="sec-head"><div><h2>My artists <span class="muted" style="font-size:.9rem">${mine.length}/${MAX_MINE}</span></h2></div></div>
      ${mine.length ? `<div class="grid">${mine.map(a => card(a, 0, danger, lead)).join('')}</div>` : `<div class="empty"><b>No artists yet.</b><p>Build one in under a minute — your debut single is generated on the spot.</p><a class="btn" href="#create">🎤 Create AI Artist</a></div>`}</section>
    <section class="two">
      <div><div class="sec-head"><div><h2>My votes</h2><p>${votesLeft()} of ${VOTES_PER_ROUND} left this round</p></div></div><div class="mini-list">${mv.map(a => mini(a, '<span class="tag champ">★</span>')).join('') || '<div class="empty">No votes yet this round. <a class="link" href="#showdown">Go vote →</a></div>'}</div></div>
      <div><div class="sec-head"><div><h2>Wishlist</h2><p>Full tracks unlock when sales open.</p></div></div><div class="tracks">${wish.map(w => `<div class="track"><button class="icon-btn" data-act="play" data-id="${w.a.id}" data-t="${w.t}" data-kind="icon">▶</button><div class="ti"><b>${esc(w.a.tracks[w.t].t)}</b><small>${esc(w.a.name)}</small></div><span class="tag">${PRICE}</span></div>`).join('') || '<div class="empty">Tap a price tag on any track to save it here.</div>'}</div></div>
    </section>
    <p class="muted" style="font-size:.85rem;text-align:center;margin-top:2rem">${BRAND} · <a class="link" href="privacy.html">Privacy &amp; terms</a> · Your data stays on this device.</p>`;
  }

  function viewArtist(id) {
    const a = byId(id);
    if (!a) return `<div class="empty" style="margin-top:2rem">Artist not found. <a class="btn" href="#showdown">Back to the show</a></div>`;
    const G = GENRES[a.genre], V = VOICES[a.voice], r = ranked(), rank = r.indexOf(a) + 1, voted = myVotes().includes(a.id);
    const len = window.SC_AUDIO.buildSong({ genre: a.genre, voice: a.voice, seed: a.tracks[0].seed }).barDur * 16;
    const similar = S.artists.filter(x => x.genre === a.genre && x.id !== a.id).slice(0, 4);
    return `<button class="back" data-act="back">← Back</button>
    <div class="ahero" style="--glow:hsla(${a.look.h1},90%,60%,.35)">
      ${avatar(a, a.elim ? 'out' : '')}
      <div><span class="kicker">${G.emoji} ${G.label} · ${V.label} voice</span><h1>${esc(a.name)}</h1>
        <p class="lead">${esc(a.vibe || 'An original AI performer.')}</p>
        <div class="row" style="margin-top:.6rem">${statusTag(a)}${a.mine ? '<span class="tag mine">Your artist</span>' : '<span class="tag">Demo season artist</span>'}</div>
        <div class="stats"><div class="stat"><b>${a.elim ? '—' : '#' + rank}</b><small>Rank</small></div><div class="stat"><b>${fmt(a.rv)}</b><small>Round votes</small></div><div class="stat"><b>${fmt(a.tv)}</b><small>Total votes</small></div><div class="stat"><b>${fmt(a.plays)}</b><small>Plays</small></div></div>
        <div class="row"><button class="btn" data-act="play" data-id="${a.id}" data-t="0" data-kind="btn">▶ Play</button>
          ${a.mine || a.elim ? '' : `<button class="btn ${voted ? 'voted' : 'hot'}" data-act="vote" data-id="${a.id}">${voted ? '★ Voted' : '★ Vote'}</button>`}
          <button class="btn ghost" data-act="share" data-id="${a.id}">↗ Share</button>
          ${a.mine ? `<button class="btn ghost" data-act="retire" data-id="${a.id}">Retire</button>` : `<button class="btn ghost" data-act="report" data-id="${a.id}" aria-label="Report">⚑</button>`}</div>
      </div></div>
    <section><div class="sec-head"><div><h2>Tracks</h2><p>Free demo downloads (WAV). Full tracks ${a.mine ? 'are yours to keep.' : PRICE + ' when sales open.'}</p></div></div>
      <div class="tracks">${a.tracks.map((tr, i) => `<div class="track" data-track="${a.id}:${i}"><button class="icon-btn play" data-act="play" data-id="${a.id}" data-t="${i}" data-kind="icon" aria-label="Play">▶</button><div class="ti"><b>${esc(tr.t)}</b><small>${i ? 'Album cut' : 'Debut single'} · ${dur(len)}</small></div><button class="btn small ghost" data-act="dl" data-id="${a.id}" data-t="${i}">⤓ Demo</button>${a.mine ? '' : `<button class="btn small gold" data-act="buy" data-id="${a.id}" data-t="${i}">${S.my.wish.includes(a.id + ':' + i) ? '♥ Saved' : PRICE}</button>`}</div>`).join('')}</div></section>
    ${similar.length ? `<section><div class="sec-head"><h2>More ${G.label}</h2></div><div class="mini-list">${similar.map(x => mini(x, statusTag(x))).join('')}</div></section>` : ''}`;
  }

  /* --- create --- */
  let draft = null, cstep = 0;
  function newDraft() {
    const r = rng(Math.floor(Math.random() * 1e9));
    return { name: '', genre: pick(r, Object.keys(GENRES)), voice: pick(r, Object.keys(VOICES)), vibe: '', look: randomLook(r), seed: Math.floor(Math.random() * 1e9), single: trackTitle(r) };
  }
  function draftArtist() { return { id: 'draft', name: draft.name || 'Your Artist', genre: draft.genre, voice: draft.voice, look: draft.look, seed: draft.seed, tracks: [{ t: draft.single, seed: draft.seed }] }; }
  function opt(k, v, label, sub, cur) { return `<button class="opt ${cur === v ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${v}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
  function viewCreate() {
    if (!draft) draft = newDraft();
    const mineN = S.artists.filter(a => a.mine).length;
    const d = draft, names = ['Identity', 'Voice', 'Look', 'Debut'];
    let body = '';
    if (cstep === 0) body = `
      <div class="field"><label for="fName">Artist name</label><div class="input-row"><input id="fName" type="text" maxlength="24" placeholder="e.g. Nova Vale" value="${esc(d.name)}" autocomplete="off"><button class="icon-btn" data-act="rollname" aria-label="Random name">🎲</button></div></div>
      <div class="field"><span class="lbl">Genre</span><div class="opt-grid">${Object.keys(GENRES).map(k => opt('genre', k, GENRES[k].emoji + ' ' + GENRES[k].label, GENRES[k].bpm + ' bpm', d.genre)).join('')}</div></div>
      <div class="field"><label for="fVibe">Vibe / tagline</label><div class="input-row"><input id="fVibe" type="text" maxlength="60" placeholder="What's their story?" value="${esc(d.vibe)}"><button class="icon-btn" data-act="rollvibe" aria-label="Random vibe">🎲</button></div></div>`;
    if (cstep === 1) body = `
      <div class="field"><span class="lbl">Vocal style</span><div class="opt-grid">${Object.keys(VOICES).map(k => opt('voice', k, VOICES[k].label, VOICE_DESC[k], d.voice)).join('')}</div></div>
      <div class="field"><span class="lbl">Sound</span><div class="row"><button class="btn ghost" data-act="preview" data-kind="preview">▶ Preview hook</button><button class="btn ghost" data-act="reroll">🔀 New melody</button></div><p class="hint">Every melody is generated from a seed — shuffle until it slaps.</p></div>`;
    if (cstep === 2) body = `
      <div class="field"><span class="lbl">Shape</span><div class="opt-grid">${LOOK.shape.map(x => opt('look.shape', x[0], x[1], '', d.look.shape)).join('')}</div></div>
      <div class="field"><span class="lbl">Eyes</span><div class="opt-grid">${LOOK.eyes.map(x => opt('look.eyes', x[0], x[1], '', d.look.eyes)).join('')}</div></div>
      <div class="field"><span class="lbl">Headgear</span><div class="opt-grid">${LOOK.top.filter(x => x[0] !== 'crown').map(x => opt('look.top', x[0], x[1], '', d.look.top)).join('')}</div><p class="hint">👑 The crown is earned — champions get it automatically.</p></div>
      <div class="field"><span class="lbl">Palette</span><div class="swatches">${PALETTES.map(p => `<button class="sw ${d.look.h1 === p[0] && d.look.h2 === p[1] ? 'on' : ''}" style="background:linear-gradient(135deg,hsl(${p[0]} 95% 66%),hsl(${p[1]} 90% 52%))" data-act="pal" data-a="${p[0]}" data-b="${p[1]}" aria-label="Palette"></button>`).join('')}</div></div>
      <div class="field"><label>Glow hue</label><input type="range" min="0" max="359" value="${d.look.h1}" data-hue="h1" aria-label="Glow hue"><label style="margin-top:.6rem">Shade hue</label><input type="range" min="0" max="359" value="${d.look.h2}" data-hue="h2" aria-label="Shade hue"></div>`;
    if (cstep === 3) body = `
      <div class="field"><label for="fSingle">Debut single title</label><div class="input-row"><input id="fSingle" type="text" maxlength="32" value="${esc(d.single)}"><button class="icon-btn" data-act="rolltitle" aria-label="Random title">🎲</button></div></div>
      <div class="mini-list" style="margin-bottom:1rem">
        <div class="mini"><div class="t"><b>${esc(d.name || '— name needed —')}</b><small>${GENRES[d.genre].emoji} ${GENRES[d.genre].label} · ${VOICES[d.voice].label} voice</small></div></div>
        <div class="mini"><div class="t"><b>Safe for round ${S.season.round}</b><small>New entries can't be cut in the round they join.</small></div></div>
        <div class="mini"><div class="t"><b>3 tracks generated</b><small>Free demos for fans; full tracks on sale at launch.</small></div></div>
      </div>
      ${mineN >= MAX_MINE ? `<p class="muted">You already have ${MAX_MINE} artists. Retire one in My Studio to enter another.</p>` : S.season.champion ? `<p class="muted">This season is finished — start a new season in Charts to enter.</p>` : ''}
      <button class="btn hot" style="width:100%" data-act="enter" ${mineN >= MAX_MINE || S.season.champion ? 'disabled' : ''}>🎤 Enter the Showdown</button>`;
    return `<section style="margin-top:.5rem"><div class="sec-head"><div><h2>Create your AI artist</h2><p>Four quick steps. Live preview as you go.</p></div></div>
      <div class="builder">
        <div class="preview"><div class="stage-card"><div class="stage-top"><span class="kicker">Preview</span><span class="tag" id="pvGenre">${GENRES[d.genre].emoji} ${GENRES[d.genre].label}</span></div><div class="floor"></div><div class="stage-art" id="pvArt">${avatar(draftArtist())}</div>
          <div class="lower-third"><div class="who"><b id="pvName">${esc(d.name || 'Your Artist')}</b><span id="pvSub">${VOICES[d.voice].label} voice · “${esc(d.single)}”</span></div><button class="icon-btn play" data-act="preview" data-kind="icon" aria-label="Preview">▶</button></div></div></div>
        <div><div class="steps-nav">${names.map((n, i) => `<button class="${i === cstep ? 'on' : i < cstep ? 'done' : ''}" data-act="cstep" data-i="${i}">${i + 1}. ${n}</button>`).join('')}</div>
          <div class="panel">${body}
            <div class="panel-foot">${cstep ? '<button class="btn ghost" data-act="cprev">← Back</button>' : '<span></span>'}${cstep < 3 ? '<button class="btn" data-act="cnext">Next →</button>' : ''}</div></div></div>
      </div></section>`;
  }
  function updatePreview() {
    const art = $('#pvArt'); if (!art) return;
    art.innerHTML = avatar(draftArtist());
    $('#pvName').textContent = draft.name || 'Your Artist';
    $('#pvSub').textContent = `${VOICES[draft.voice].label} voice · “${draft.single}”`;
    $('#pvGenre').textContent = `${GENRES[draft.genre].emoji} ${GENRES[draft.genre].label}`;
    markLive();
  }
  function previewDraft() {
    if (Player.cur && Player.cur.id === 'draft') { Player.stop(); return; }
    Player.play({ genre: draft.genre, voice: draft.voice, seed: draft.seed }, { id: 'draft', artistId: 'draft', title: draft.single, sub: (draft.name || 'Your Artist') + ' · preview', bars: 6 });
  }
  function enterShow() {
    const name = draft.name.trim();
    if (name.length < 2) { cstep = 0; render(); toast('Give your artist a name first.'); setTimeout(() => $('#fName') && $('#fName').focus(), 50); return; }
    if (S.artists.some(a => a.name.toLowerCase() === name.toLowerCase())) { cstep = 0; render(); toast('That name is taken — try another.'); return; }
    const r = rng(draft.seed + 9);
    const a = makeArtist({ name, genre: draft.genre, voice: draft.voice, vibe: draft.vibe.trim() || pick(r, VIBES), look: Object.assign({}, draft.look), seed: draft.seed, mine: true,
      tracks: [{ t: draft.single.trim() || trackTitle(r), seed: draft.seed }, { t: trackTitle(r), seed: draft.seed + 101 }, { t: trackTitle(r), seed: draft.seed + 202 }] });
    a.safeRound = S.season.round; a.hype = 1.0;
    S.artists.push(a); save();
    draft = null; cstep = 0;
    Player.stop();
    location.hash = '#a/' + a.id;
    setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 30); toast(`🎤 ${a.name} has entered the show!`); playTrack(a.id, 0); }, 120);
  }

  /* ---------- router ---------- */
  let curView = '';
  function parse() { const h = location.hash.replace(/^#/, '') || 'stage'; const [v, arg] = h.split('/'); return { v, arg }; }
  function render(keepScroll) {
    const { v, arg } = parse();
    const main = $('#view');
    let html;
    if (v === 'showdown') html = viewShowdown(arg);
    else if (v === 'create') html = viewCreate();
    else if (v === 'charts') html = viewCharts();
    else if (v === 'me') html = viewMe();
    else if (v === 'a') html = viewArtist(arg);
    else html = viewStage();
    const changed = curView !== location.hash;
    main.innerHTML = html;
    if (changed) { main.classList.remove('view-in'); void main.offsetWidth; main.classList.add('view-in'); if (!keepScroll) scrollTo(0, 0); }
    curView = location.hash;
    const nav = v === 'a' ? '' : v;
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (nav || 'stage') && v !== 'a'));
    document.title = (v === 'a' && byId(arg) ? byId(arg).name + ' · ' : '') + BRAND + ' — The AI Artist Talent Show';
    updatePill(); tickCountdown(); markLive();
  }
  function route() { render(); }
  function refresh() { const y = scrollY; render(true); scrollTo(0, y); }
  window.addEventListener('hashchange', route);

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'open': if (id && id !== 'draft') location.hash = '#a/' + id; break;
      case 'play': e.stopPropagation(); playTrack(id, el.dataset.t); break;
      case 'vote': e.stopPropagation(); vote(id, el); break;
      case 'intro': playIntro(); break;
      case 'filter': filt.g = el.dataset.g; history.replaceState(null, '', filt.g === 'all' ? '#showdown' : '#showdown/' + filt.g); curView = location.hash; refresh(); break;
      case 'dl': download(id, el.dataset.t, el); break;
      case 'buy': buy(id, +el.dataset.t); refresh(); break;
      case 'share': e.stopPropagation(); share(id); break;
      case 'report': report(id); break;
      case 'retire':
        sheet(`<h3>Retire ${esc(byId(id).name)}?</h3><p class="muted">They'll leave the show and free up a slot in your studio. This can't be undone.</p><div class="row"><button class="btn ghost" data-close>Keep</button><button class="btn hot" id="retGo">Retire</button></div>`);
        $('#retGo').onclick = () => { if (Player.cur && Player.cur.meta.artistId === id) Player.stop(); S.artists = S.artists.filter(a => a.id !== id); save(); closeSheet(); location.hash = '#me'; toast('Artist retired.'); };
        break;
      case 'back': if (history.length > 1) history.back(); else location.hash = '#showdown'; break;
      case 'endround': endRound(false); refresh(); break;
      case 'newseason': newSeason(); break;
      case 'wipe':
        sheet(`<h3>Reset everything?</h3><p class="muted">Deletes your artists, votes and wishlist on this device and restarts the demo season.</p><div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn hot" id="wipeGo">Reset</button></div>`);
        $('#wipeGo').onclick = () => { Player.stop(); S = freshState(); save(); closeSheet(); location.hash = '#stage'; route(); toast('Fresh start.'); };
        break;
      case 'install': doInstall(); break;
      // create
      case 'set': {
        const k = el.dataset.k, v = el.dataset.v;
        if (k.startsWith('look.')) draft.look[k.slice(5)] = v; else draft[k] = v;
        $$(`[data-k="${k}"]`).forEach(b => b.classList.toggle('on', b === el));
        updatePreview();
        if (k === 'voice' || k === 'genre') { if (Player.cur && Player.cur.id === 'draft') Player.stop(); previewDraft(); }
        break;
      }
      case 'pal': draft.look.h1 = +el.dataset.a; draft.look.h2 = +el.dataset.b; $$('.sw').forEach(b => b.classList.toggle('on', b === el)); $$('[data-hue]').forEach(r => r.value = draft.look[r.dataset.hue]); updatePreview(); break;
      case 'rollname': { const r = rng(Math.random() * 1e9); draft.name = pick(r, N1) + (r() < .5 ? ' ' : '') + pick(r, N2); $('#fName').value = draft.name; updatePreview(); break; }
      case 'rollvibe': draft.vibe = VIBES[Math.floor(Math.random() * VIBES.length)]; $('#fVibe').value = draft.vibe; break;
      case 'rolltitle': draft.single = trackTitle(rng(Math.random() * 1e9)); $('#fSingle').value = draft.single; updatePreview(); break;
      case 'reroll': draft.seed = Math.floor(Math.random() * 1e9); if (Player.cur && Player.cur.id === 'draft') Player.stop(); previewDraft(); toast('New melody generated 🔀'); break;
      case 'preview': previewDraft(); break;
      case 'cstep': cstep = +el.dataset.i; refresh(); scrollTo(0, 0); break;
      case 'cnext': if (cstep === 0 && draft.name.trim().length < 2) { toast('Name your artist (or tap 🎲).'); $('#fName').focus(); break; } cstep = Math.min(3, cstep + 1); refresh(); scrollTo(0, 0); break;
      case 'cprev': cstep = Math.max(0, cstep - 1); refresh(); scrollTo(0, 0); break;
      case 'enter': enterShow(); break;
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!draft) return;
    if (t.id === 'fName') { draft.name = t.value; updatePreview(); }
    if (t.id === 'fVibe') draft.vibe = t.value;
    if (t.id === 'fSingle') { draft.single = t.value; updatePreview(); }
    if (t.dataset.hue) { draft.look[t.dataset.hue] = +t.value; $$('.sw').forEach(b => b.classList.remove('on')); updatePreview(); }
  });
  document.addEventListener('change', e => { if (e.target.dataset.act === 'sort') { filt.sort = e.target.value; refresh(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act]:not(button):not(a):not(select)')) { e.preventDefault(); e.target.click(); }
  });

  /* ---------- player UI ---------- */
  function updatePill() {
    const p = $('#votesPill'), n = votesLeft();
    p.querySelector('b').textContent = n; p.classList.toggle('zero', n <= 0);
  }
  function markLive() {
    const c = Player.cur, aid = c && c.meta.artistId, key = c && c.id;
    $$('.av').forEach(el => el.classList.toggle('live', !!aid && el.dataset.av === aid));
    $$('.acard').forEach(el => el.classList.toggle('playing', !!aid && el.dataset.card === aid));
    $$('.track').forEach(el => el.classList.toggle('playing', el.dataset.track === key));
    $$('[data-act="play"]').forEach(b => {
      const on = key === b.dataset.id + ':' + (b.dataset.t || 0);
      if (b.dataset.kind === 'icon') b.textContent = on ? '■' : '▶';
      else if (b.dataset.kind === 'btn') b.textContent = on ? '■ Stop' : '▶ Play';
    });
    const mv = $('#mbVote'); if (aid) mv.classList.toggle('voted', myVotes().includes(aid));
    $$('[data-kind="intro"]').forEach(b => b.textContent = key === 'intro' ? '🔇 Stop intro' : '🔊 Intro music');
    $$('[data-act="preview"]').forEach(b => { const on = key === 'draft'; if (b.dataset.kind === 'icon') b.textContent = on ? '■' : '▶'; else b.textContent = on ? '■ Stop' : '▶ Preview hook'; });
  }
  Player.on(cur => {
    const mb = $('#minibar');
    if (!cur) { mb.hidden = true; markLive(); return; }
    mb.hidden = false;
    $('#mbTitle').textContent = cur.meta.title || '—';
    $('#mbSub').textContent = cur.meta.sub || '';
    const a = byId(cur.meta.artistId) || (cur.meta.artistId === 'draft' && draft ? draftArtist() : null);
    $('#mbArt').innerHTML = a ? avatar(a) : '<span class="logo-mark" style="display:block;width:46px;height:46px;border-radius:12px"></span>';
    $('#mbArt').dataset.id = a && a.id !== 'draft' ? a.id : '';
    const real = a && a.id !== 'draft' && !a.mine && !a.elim;
    $('#mbVote').hidden = !real;
    $('#mbVote').classList.toggle('voted', !!(real && myVotes().includes(a.id)));
    markLive();
  });
  $('#mbPlay').onclick = () => Player.stop();
  $('#mbArt').onclick = () => { const id = $('#mbArt').dataset.id; if (id) location.hash = '#a/' + id; };
  $('#mbVote').onclick = e => { const c = Player.cur; if (c && c.meta.artistId) { vote(c.meta.artistId, e.currentTarget); e.currentTarget.classList.toggle('voted', myVotes().includes(c.meta.artistId)); } };
  (function loop() {
    const lvl = Player.level();
    $$('.av.live').forEach(el => el.style.setProperty('--lvl', lvl.toFixed(3)));
    const p = $('#mbProg'); if (p) p.style.width = (Player.progress() * 100) + '%';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('visibilitychange', () => { if (document.hidden && Player.cur && Player.cur.loop) Player.stop(); });

  /* ---------- countdown + sim ticks ---------- */
  function tickCountdown() {
    const cd = $('#cd'); if (!cd) return;
    let ms = Math.max(0, S.season.ends - Date.now());
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4); ms -= m * 6e4;
    const s = Math.floor(ms / 1e3);
    const set = (u, v) => { const el = cd.querySelector(`[data-u="${u}"]`); if (el) el.textContent = v; };
    set('d', d); set('h', String(h).padStart(2, '0')); set('m', String(m).padStart(2, '0')); set('s', String(s).padStart(2, '0'));
  }
  setInterval(() => {
    tickCountdown();
    if (!S.season.champion && S.season.ends <= Date.now()) { endRound(false); refresh(); }
  }, 1000);
  setInterval(() => {
    simulate();
    const { v } = parse();
    // light live refresh of numbers on browse views (skip while creating or when a sheet is open)
    if (v !== 'create' && $('#sheet').hidden && !document.hidden && !document.activeElement.matches('select,input')) refresh();
  }, 20000);

  /* ---------- install (one tap) ---------- */
  let bip = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function showInstall(on) { $('#installBtn').hidden = !on; }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); bip = e; showInstall(true); });
  window.addEventListener('appinstalled', () => { bip = null; showInstall(false); toast(`${BRAND} installed 🎉`); });
  if (isIOS && !isStandalone()) showInstall(true);
  async function doInstall() {
    if (bip) { bip.prompt(); const r = await bip.userChoice; bip = null; showInstall(false); if (r.outcome === 'accepted') toast('Installing…'); return; }
    if (isIOS) { sheet(`<h3>Add ${BRAND} to your Home Screen</h3><ol><li>Tap the <b>Share</b> button <span aria-hidden="true">⬆︎</span> in Safari.</li><li>Choose <b>Add to Home Screen</b>.</li></ol><div class="row"><button class="btn" data-close>Got it</button></div>`); return; }
    if (isStandalone()) return toast('Already installed ✓');
    toast('Use your browser menu → Install app');
  }
  $('#installBtn').onclick = doInstall;

  /* ---------- offline ---------- */
  function net() { document.body.classList.toggle('offline', !navigator.onLine); }
  window.addEventListener('online', () => { net(); toast('Back online'); });
  window.addEventListener('offline', () => { net(); toast('Offline — the show goes on.'); });
  net();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }

  /* ---------- boot ---------- */
  $$('[data-brand]').forEach(el => el.textContent = BRAND);
  simulate();
  render();
})();
