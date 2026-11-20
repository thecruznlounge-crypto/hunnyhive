/* CardKit - shared by Kings Corner and Queendom Come.
   Realistic canvas-drawn playing cards, DOM card elements with 3D flips,
   felt table, synthesized sound, player profile (avatar, stats, credits, rooms). */
(function (global) {
  'use strict';
  const SUITS = ['S', 'H', 'D', 'C'];
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const isRed = s => s === 'H' || s === 'D';
  const RED = '#b81c2c', BLK = '#14181f', GOLD = '#c9a227';
  const $ = (s, r) => (r || document).querySelector(s);
  const rand = n => Math.floor(Math.random() * n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- suit glyphs drawn as paths ---------- */
  function suitPath(s, x, y, z) {
    const p = new Path2D();
    if (s === 'H') {
      p.moveTo(x, y + z * .95);
      p.bezierCurveTo(x - z * 1.35, y + z * .2, x - z * 1.05, y - z * .95, x, y - z * .35);
      p.bezierCurveTo(x + z * 1.05, y - z * .95, x + z * 1.35, y + z * .2, x, y + z * .95);
    } else if (s === 'D') {
      p.moveTo(x, y - z * 1.05); p.bezierCurveTo(x + z * .35, y - z * .45, x + z * .75, y - z * .2, x + z * .85, y);
      p.bezierCurveTo(x + z * .75, y + z * .2, x + z * .35, y + z * .45, x, y + z * 1.05);
      p.bezierCurveTo(x - z * .35, y + z * .45, x - z * .75, y + z * .2, x - z * .85, y);
      p.bezierCurveTo(x - z * .75, y - z * .2, x - z * .35, y - z * .45, x, y - z * 1.05);
    } else if (s === 'S') {
      p.moveTo(x, y - z * 1.0);
      p.bezierCurveTo(x + z * .2, y - z * .55, x + z * 1.2, y - z * .1, x + z * 1.0, y + z * .5);
      p.bezierCurveTo(x + z * .9, y + z * .85, x + z * .35, y + z * .85, x + z * .12, y + z * .45);
      p.bezierCurveTo(x + z * .14, y + z * .75, x + z * .25, y + z * .95, x + z * .45, y + z * 1.05);
      p.lineTo(x - z * .45, y + z * 1.05);
      p.bezierCurveTo(x - z * .25, y + z * .95, x - z * .14, y + z * .75, x - z * .12, y + z * .45);
      p.bezierCurveTo(x - z * .35, y + z * .85, x - z * .9, y + z * .85, x - z * 1.0, y + z * .5);
      p.bezierCurveTo(x - z * 1.2, y - z * .1, x - z * .2, y - z * .55, x, y - z * 1.0);
    } else {
      const r = z * .42;
      p.arc(x, y - z * .5, r, 0, 7); p.moveTo(x - z * .5 + r, y + z * .3);
      p.arc(x - z * .5, y + z * .3, r, 0, 7); p.moveTo(x + z * .5 + r, y + z * .3);
      p.arc(x + z * .5, y + z * .3, r, 0, 7);
      p.moveTo(x - z * .12, y); p.bezierCurveTo(x - z * .1, y + z * .6, x - z * .25, y + z * .85, x - z * .5, y + z * 1.05);
      p.lineTo(x + z * .5, y + z * 1.05); p.bezierCurveTo(x + z * .25, y + z * .85, x + z * .1, y + z * .6, x + z * .12, y);
      p.closePath();
    }
    return p;
  }
  function drawSuit(c, s, x, y, z, col) { c.fillStyle = col || (isRed(s) ? RED : BLK); c.fill(suitPath(s, x, y, z)); }

  /* ---------- card faces ---------- */
  const PIPS = {
    2: [[.5, 0], [.5, 1]], 3: [[.5, 0], [.5, .5], [.5, 1]],
    4: [[0, 0], [1, 0], [0, 1], [1, 1]], 5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]],
    6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
    7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
    8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
    9: [[0, 0], [1, 0], [0, .333], [1, .333], [.5, .5], [0, .667], [1, .667], [0, 1], [1, 1]],
    10: [[0, 0], [1, 0], [.5, .165], [0, .333], [1, .333], [0, .667], [1, .667], [.5, .835], [0, 1], [1, 1]]
  };
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function figure(c, rank, suit, W, H) {
    /* top half of a court figure inside a box of W x H, origin at box top-left */
    const col = isRed(suit) ? RED : BLK;
    const robe = rank === 'K' ? (isRed(suit) ? '#b81c2c' : '#1f3f7a') : rank === 'Q' ? (isRed(suit) ? '#7d1c4a' : '#254a5e') : (isRed(suit) ? '#c8821c' : '#2f6a48');
    const cx = W * .5;
    /* robe */
    const g = c.createLinearGradient(0, H * .5, 0, H);
    g.addColorStop(0, robe); g.addColorStop(1, '#0d1018');
    c.fillStyle = g; c.beginPath();
    c.moveTo(cx - W * .42, H); c.bezierCurveTo(cx - W * .4, H * .7, cx - W * .3, H * .6, cx - W * .12, H * .56);
    c.lineTo(cx + W * .12, H * .56); c.bezierCurveTo(cx + W * .3, H * .6, cx + W * .4, H * .7, cx + W * .42, H); c.closePath(); c.fill();
    c.strokeStyle = GOLD; c.lineWidth = W * .018; c.stroke();
    /* trim */
    c.fillStyle = GOLD; c.beginPath(); c.moveTo(cx - W * .12, H * .56); c.lineTo(cx, H * .74); c.lineTo(cx + W * .12, H * .56); c.lineTo(cx + W * .07, H * .56); c.lineTo(cx, H * .67); c.lineTo(cx - W * .07, H * .56); c.fill();
    c.fillStyle = col; c.globalAlpha = .9; c.beginPath(); c.arc(cx, H * .82, W * .06, 0, 7); c.fill(); c.globalAlpha = 1;
    /* hair (queen long, others short) */
    const hair = rank === 'Q' ? '#6b3b16' : rank === 'K' ? '#8b8b8b' : '#4a2c12';
    if (rank === 'Q') { c.fillStyle = hair; c.beginPath(); c.ellipse(cx, H * .36, W * .21, H * .27, 0, 0, 7); c.fill(); }
    /* neck + face */
    c.fillStyle = '#e8c39b'; c.fillRect(cx - W * .05, H * .46, W * .1, H * .12);
    c.beginPath(); c.ellipse(cx, H * .36, W * .14, H * .17, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(60,35,15,.55)'; c.lineWidth = W * .01; c.stroke();
    /* beard / hair cap */
    c.fillStyle = hair;
    if (rank === 'K') { c.beginPath(); c.moveTo(cx - W * .14, H * .38); c.bezierCurveTo(cx - W * .15, H * .56, cx + W * .15, H * .56, cx + W * .14, H * .38); c.bezierCurveTo(cx + W * .08, H * .45, cx - W * .08, H * .45, cx - W * .14, H * .38); c.fill(); }
    else { c.beginPath(); c.ellipse(cx, H * .27, W * .15, H * .09, 0, Math.PI, 0); c.fill(); }
    /* eyes */
    c.fillStyle = '#2a1a0a'; c.beginPath(); c.arc(cx - W * .055, H * .35, W * .013, 0, 7); c.arc(cx + W * .055, H * .35, W * .013, 0, 7); c.fill();
    c.strokeStyle = '#8a3b2c'; c.lineWidth = W * .012; c.beginPath(); c.moveTo(cx - W * .035, H * .42); c.quadraticCurveTo(cx, H * .44, cx + W * .035, H * .42); c.stroke();
    /* headwear */
    c.fillStyle = GOLD; c.strokeStyle = '#7a5d0c'; c.lineWidth = W * .012;
    if (rank === 'K') {
      c.beginPath(); c.moveTo(cx - W * .15, H * .24); c.lineTo(cx - W * .17, H * .06); c.lineTo(cx - W * .08, H * .15); c.lineTo(cx, H * .02); c.lineTo(cx + W * .08, H * .15); c.lineTo(cx + W * .17, H * .06); c.lineTo(cx + W * .15, H * .24); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(cx, H * .2, W * .022, 0, 7); c.fill();
    } else if (rank === 'Q') {
      c.beginPath(); c.moveTo(cx - W * .15, H * .24); c.lineTo(cx - W * .15, H * .1); c.quadraticCurveTo(cx - W * .08, H * .16, cx - W * .05, H * .05); c.quadraticCurveTo(cx, H * .15, cx + W * .05, H * .05); c.quadraticCurveTo(cx + W * .08, H * .16, cx + W * .15, H * .1); c.lineTo(cx + W * .15, H * .24); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(cx, H * .19, W * .022, 0, 7); c.fill();
    } else {
      c.fillStyle = robe; c.beginPath(); c.ellipse(cx, H * .22, W * .17, H * .08, -.1, Math.PI, 0); c.lineTo(cx + W * .16, H * .25); c.lineTo(cx - W * .16, H * .25); c.fill(); c.stroke();
      c.strokeStyle = col; c.lineWidth = W * .02; c.beginPath(); c.moveTo(cx + W * .1, H * .17); c.quadraticCurveTo(cx + W * .3, H * .0, cx + W * .32, H * .2); c.stroke();
    }
    /* sceptre / flower */
    c.strokeStyle = GOLD; c.lineWidth = W * .025; c.beginPath(); c.moveTo(cx + W * .3, H * .96); c.lineTo(cx + W * .3, H * .5); c.stroke();
    drawSuit(c, suit, cx + W * .3, H * .44, W * .07, col);
  }

  function drawFace(c, rank, suit, w, h) {
    const col = isRed(suit) ? RED : BLK;
    const rr = w * .075;
    /* body */
    const bg = c.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#fffefa'); bg.addColorStop(.6, '#f9f5ea'); bg.addColorStop(1, '#ede6d4');
    roundRect(c, .5, .5, w - 1, h - 1, rr); c.fillStyle = bg; c.fill();
    c.lineWidth = Math.max(1, w * .012); c.strokeStyle = 'rgba(70,60,40,.45)'; c.stroke();
    /* paper grain */
    c.save(); roundRect(c, 1, 1, w - 2, h - 2, rr); c.clip();
    c.globalAlpha = .035; for (let i = 0; i < w * h / 55; i++) { c.fillStyle = Math.random() < .5 ? '#000' : '#8a7a5a'; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    c.globalAlpha = 1;
    const sh = c.createLinearGradient(0, 0, 0, h * .12); sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh; c.fillRect(0, 0, w, h * .12); c.restore();
    /* indices */
    const fs = w * (rank === '10' ? .2 : .235);
    function index() {
      c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 ' + fs + 'px "Playfair Display", Georgia, "Times New Roman", serif';
      c.fillText(rank, w * .115, h * .075);
      drawSuit(c, suit, w * .115, h * .075 + fs * .95, w * .06);
    }
    index(); c.save(); c.translate(w, h); c.rotate(Math.PI); index(); c.restore();
    /* play area */
    const ax = w * .25, aw = w * .5, ay = h * .105, ah = h * .79;
    const pz = w * .105;
    if (rank === 'A') {
      const z = suit === 'S' ? w * .34 : w * .27;
      drawSuit(c, suit, w * .5, h * .5, z);
      if (suit === 'S') { c.strokeStyle = GOLD; c.lineWidth = w * .012; c.beginPath(); c.arc(w * .5, h * .5, w * .4, 0, 7); c.stroke(); }
    } else if (PIPS[rank]) {
      PIPS[rank].forEach(p => {
        const px = ax + p[0] * aw, py = ay + p[1] * ah;
        if (p[1] > .5) { c.save(); c.translate(px, py); c.rotate(Math.PI); drawSuit(c, suit, 0, 0, pz); c.restore(); } else drawSuit(c, suit, px, py, pz);
      });
    } else {
      /* court card: framed panel, mirrored figure */
      const fx = w * .2, fw = w * .6, fy = h * .09, fh = h * .82;
      c.fillStyle = isRed(suit) ? '#fbeede' : '#eef0f2'; roundRect(c, fx, fy, fw, fh, w * .02); c.fill();
      c.lineWidth = w * .016; c.strokeStyle = GOLD; c.stroke();
      c.lineWidth = w * .006; c.strokeStyle = col; roundRect(c, fx + w * .018, fy + w * .018, fw - w * .036, fh - w * .036, w * .01); c.stroke();
      c.save(); roundRect(c, fx + w * .02, fy + w * .02, fw - w * .04, fh - w * .04, w * .01); c.clip();
      c.fillStyle = col; c.globalAlpha = .07; c.fillRect(fx, fy + fh / 2, fw, fh / 2); c.globalAlpha = 1;
      c.save(); c.translate(fx, fy); figure(c, rank, suit, fw, fh / 2); c.restore();
      c.save(); c.translate(fx + fw, fy + fh); c.rotate(Math.PI); figure(c, rank, suit, fw, fh / 2); c.restore();
      c.fillStyle = GOLD; c.fillRect(fx, fy + fh / 2 - w * .004, fw, w * .008);
      c.restore();
    }
  }

  function drawBack(c, w, h, theme) {
    const T = theme === 'crimson' ? { a: '#6e0f22', b: '#2c0610', l: '#e9d9a8' } : { a: '#143a66', b: '#07182d', l: '#e9d9a8' };
    const rr = w * .075;
    roundRect(c, .5, .5, w - 1, h - 1, rr); c.fillStyle = '#fbf7ea'; c.fill();
    c.lineWidth = Math.max(1, w * .012); c.strokeStyle = 'rgba(70,60,40,.5)'; c.stroke();
    const m = w * .06; roundRect(c, m, m, w - 2 * m, h - 2 * m, rr * .6);
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, T.a); g.addColorStop(1, T.b); c.fillStyle = g; c.fill();
    c.save(); roundRect(c, m, m, w - 2 * m, h - 2 * m, rr * .6); c.clip();
    c.strokeStyle = 'rgba(233,217,168,.28)'; c.lineWidth = Math.max(1, w * .008);
    const step = w * .11;
    for (let k = -h; k < w + h; k += step) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k, h); c.lineTo(k + h, 0); c.stroke(); }
    c.restore();
    c.lineWidth = w * .012; c.strokeStyle = T.l; roundRect(c, m + w * .03, m + w * .03, w - 2 * (m + w * .03), h - 2 * (m + w * .03), rr * .4); c.stroke();
    /* medallion */
    const cx = w / 2, cy = h / 2;
    c.fillStyle = T.b; c.beginPath(); c.ellipse(cx, cy, w * .27, w * .27, 0, 0, 7); c.fill();
    c.lineWidth = w * .015; c.strokeStyle = T.l; c.stroke();
    c.lineWidth = w * .006; c.beginPath(); c.arc(cx, cy, w * .22, 0, 7); c.stroke();
    drawSuit(c, 'S', cx, cy - w * .09, w * .06, T.l); drawSuit(c, 'H', cx + w * .09, cy, w * .06, T.l);
    drawSuit(c, 'D', cx, cy + w * .09, w * .06, T.l); drawSuit(c, 'C', cx - w * .09, cy, w * .06, T.l);
  }

  const cache = new Map();
  let dpr = Math.min(3, global.devicePixelRatio || 1);
  function sprite(key, w, draw) {
    const k = key + '@' + w;
    if (cache.has(k)) return cache.get(k);
    const W = Math.round(w * dpr), H = Math.round(w * 1.4 * dpr);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.scale(W / 100, H / 140);
    draw(c, 100, 140);
    const url = cv.toDataURL('image/png'); cache.set(k, url); return url;
  }
  let backTheme = 'navy';
  const faceURL = (r, s) => sprite(r + s, 100, (c, w, h) => drawFace(c, r, s, w, h));
  const backURL = () => sprite('back-' + backTheme, 100, (c, w, h) => drawBack(c, w, h, backTheme));

  /* ---------- DOM card element ---------- */
  function cardEl(card, up) {
    const el = document.createElement('div'); el.className = 'pc';
    el.innerHTML = '<div class="in"><img class="b" alt="" draggable="false"><img class="f" alt="" draggable="false"></div>';
    el.querySelector('.b').src = backURL();
    el.card = card;
    if (card) el.querySelector('.f').src = faceURL(card.r, card.s);
    el.up = !!up; if (up) el.classList.add('up');
    el.pos = { x: 0, y: 0, r: 0, s: 1, z: 1 };
    return el;
  }
  function place(el, o) {
    Object.assign(el.pos, o);
    const p = el.pos;
    el.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) rotate(' + p.r + 'deg) scale(' + p.s + ')';
    el.style.zIndex = p.z;
    if (o.up !== undefined) { el.up = o.up; el.classList.toggle('up', o.up); }
    if (o.dur !== undefined) el.style.setProperty('--dur', o.dur + 'ms');
    return el;
  }
  function setCard(el, card) { el.card = card; el.querySelector('.f').src = faceURL(card.r, card.s); }
  function setBack(theme) { backTheme = theme; }

  function deck52() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push({ r, s }); return d; }
  const rankVal = r => r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : +r;
  const label = c => c.r + SYM[c.s];

  /* ---------- sound ---------- */
  let ac = null, soundOn = true;
  function actx() { if (!ac) { try { ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function noise(dur, freq, q, vol) {
    const a = actx(); if (!a || !soundOn) return;
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  function tone(freq, dur, type, vol, when) {
    const a = actx(); if (!a || !soundOn) return;
    const t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .1, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.start(t); o.stop(t + dur + .03);
  }
  const sfx = {
    flip() { noise(.09, 2600, .7, .35); noise(.05, 900, 1, .2); },
    deal() { noise(.07, 1800, .6, .28); },
    shuffle() { for (let i = 0; i < 6; i++) setTimeout(() => noise(.06, 1500 + rand(900), .6, .2), i * 55); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .35, 'triangle', .1, i * .09)); },
    lose() { tone(220, .35, 'sine', .08); tone(165, .5, 'sine', .08, .12); },
    queen() { tone(880, .25, 'triangle', .12); tone(1175, .4, 'triangle', .1, .12); },
    tick() { tone(1200, .04, 'square', .03); },
    fanfare() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .5, 'triangle', .1, i * .12)); }
  };
  function setSound(v) { soundOn = !!v; }

  /* ---------- profile / rooms ---------- */
  const AV_GLYPH = ['♠', '♥', '♦', '♣', '♛', '♚', '♝', '♞', '★', '☾', '☀', '♬'];
  const AV_COLOR = [['#2d6a4f', '#0b2b1e'], ['#8a1c2c', '#2c0710'], ['#1f4f8a', '#0a1c36'], ['#7a5a12', '#2b1f05'], ['#5b2a86', '#1a0b2c'], ['#1c6f73', '#08292b'], ['#a14a1c', '#2e1304'], ['#3a3f4d', '#0f1118']];
  const ROOMS = [
    { id: 'parlor', name: 'The Parlor', cost: 0, mult: 1, felt: ['#1d6b3d', '#0b3a20'], rail: ['#7b4a22', '#3a1f0b'], blurb: 'Classic green baize and mahogany.' },
    { id: 'riverboat', name: 'Riverboat Lounge', cost: 500, mult: 1.5, felt: ['#1b6a6b', '#0a3a3c'], rail: ['#8a5a2b', '#43260d'], blurb: 'Teal felt, brass trim, 1.5x credits.' },
    { id: 'highroller', name: 'High Roller Suite', cost: 2000, mult: 2, felt: ['#6d1427', '#340712'], rail: ['#1a1a1d', '#050506'], blurb: 'Burgundy felt, black lacquer, 2x credits.' }
  ];
  const PKEY = 'mypwa.cards.profile.v1';
  const P0 = { name: 'You', av: { g: 0, c: 0 }, credits: 100, room: 'parlor', owned: ['parlor'], sound: true, stats: {} };
  let profile = (function () { try { return Object.assign({}, P0, JSON.parse(localStorage.getItem(PKEY)) || {}); } catch (e) { return Object.assign({}, P0); } })();
  const Profile = {
    get: () => profile,
    save() { try { localStorage.setItem(PKEY, JSON.stringify(profile)); } catch (e) { } },
    game(id) { return profile.stats[id] || (profile.stats[id] = { played: 0, won: 0, rounds: 0, roundsWon: 0, best: 0, streak: 0, bestStreak: 0, extra: {} }); },
    room() { return ROOMS.find(r => r.id === profile.room) || ROOMS[0]; },
    buy(id) { const r = ROOMS.find(x => x.id === id); if (!r) return false; if (profile.owned.includes(id)) { profile.room = id; Profile.save(); return true; } if (profile.credits < r.cost) return false; profile.credits -= r.cost; profile.owned.push(id); profile.room = id; Profile.save(); return true; }
  };
  function avatarHTML(av, size, name) {
    const col = AV_COLOR[(av && av.c || 0) % AV_COLOR.length], g = AV_GLYPH[(av && av.g || 0) % AV_GLYPH.length];
    const red = g === '♥' || g === '♦';
    return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;background:radial-gradient(circle at 35% 28%,' + col[0] + ',' + col[1] + ');font-size:' + Math.round(size * .5) + 'px"><span style="color:' + (red ? '#ff9aa6' : '#f4e7b8') + '">' + g + '</span></div>';
  }

  /* ---------- table ---------- */
  function mountTable(stage) {
    const room = Profile.room();
    stage.style.setProperty('--felt1', room.felt[0]); stage.style.setProperty('--felt2', room.felt[1]);
    stage.style.setProperty('--rail1', room.rail[0]); stage.style.setProperty('--rail2', room.rail[1]);
    if (!$('.table', stage)) {
      const t = document.createElement('div'); t.className = 'table';
      t.innerHTML = '<div class="rail"><div class="felt"><div class="inlay"></div><div class="ring"></div></div></div>';
      stage.appendChild(t);
    }
  }

  /* ---------- modal helpers ---------- */
  function modal(html, opts) {
    opts = opts || {};
    const m = document.createElement('div'); m.className = 'cmodal';
    m.innerHTML = '<div class="cm-card' + (opts.wide ? ' wide' : '') + '">' + html + '</div>';
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('show'));
    const close = () => { m.classList.remove('show'); setTimeout(() => m.remove(), 220); };
    m.addEventListener('click', e => { if (e.target === m && !opts.sticky) close(); const b = e.target.closest('[data-close]'); if (b) close(); });
    m.close = close; return m;
  }
  function confetti(layer) {
    const cols = ['#e8c35a', '#fff', '#c0283a', '#2f8f5b', '#4a7fd0'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i'); p.className = 'conf';
      p.style.left = rand(100) + '%'; p.style.background = cols[rand(cols.length)];
      p.style.animationDelay = (Math.random() * .8) + 's'; p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
      p.style.transform = 'rotate(' + rand(360) + 'deg)'; layer.appendChild(p);
      setTimeout(() => p.remove(), 4800);
    }
  }
  function fit(stage, base) {
    /* card width from available stage size */
    const W = stage.clientWidth, H = stage.clientHeight;
    const cw = Math.max(34, Math.min(W * (base || .09), H * (base || .09) * 1.6 * 0.9, 96));
    stage.style.setProperty('--cw', cw + 'px');
    return { W, H, cw, ch: cw * 1.4 };
  }
  function clearSprites() { cache.clear(); dpr = Math.min(3, global.devicePixelRatio || 1); }

  global.CardKit = { SUITS, SYM, RANKS, isRed, rand, shuffle, sleep, deck52, rankVal, label, cardEl, place, setCard, setBack, faceURL, backURL, sfx, setSound, Profile, ROOMS, AV_GLYPH, AV_COLOR, avatarHTML, mountTable, modal, confetti, fit, clearSprites, drawFace, drawBack, $ };
})(window);
