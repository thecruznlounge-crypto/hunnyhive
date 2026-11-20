(() => {
'use strict';

const C = window.Chars;
const $ = s => document.querySelector(s);
const cv = $('#game');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;
const TAU = Math.PI * 2;
const TILT = 0.86;          // how much the arena is squashed to fake a camera angle
const R0 = 165;             // base arena radius in world units
const N = 96;               // edge profile samples
const FRICTION = 1.7;       // exponential slide decay per second
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;

/* ---------- animal stats ---------- */
const K = {
  bear:    { m: 1.75, r: 30, launch: 400, cd: 1.35, acd: 6.0, ab: 'Ground Pound' },
  penguin: { m: 0.95, r: 25, launch: 500, cd: 0.85, acd: 4.5, ab: 'Belly Slide' },
  seal:    { m: 1.25, r: 27, launch: 450, cd: 1.0,  acd: 4.0, ab: 'Flop Turn' },
  orca:    { m: 1.55, r: 29, launch: 420, cd: 1.2,  acd: 7.0, ab: 'Breach' }
};
const COLORS = { bear: '#f6f1e7', penguin: '#ff5a6e', seal: '#ffd45e', orca: '#5ec8e5' };

/* ---------- viewport ---------- */
let W = 0, H = 0, DPR = 1, S = 1, CX = 0, CY = 0, dprCap = 2.5, zoom = 1, cyFrac = 0.46;
let arenaKey = '';
function applyView() {
  S = Math.min(W / 360, H / 640) * zoom;
  CX = W / 2; CY = H * cyFrac;
  arenaKey = '';
}
function resize() {
  DPR = Math.min(dprCap, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  applyView();
}
window.addEventListener('resize', resize);
resize();

let bobY = 0;
const sx = x => CX + x * S;
const sy = (y, z) => CY + bobY + y * TILT * S - (z || 0) * S;

/* ---------- audio ---------- */
const Snd = {
  ctx: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(f0, f1, dur, type, vol) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, type) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t);
  },
  whoosh() { this.noise(0.25, 0.18, 1800, 'highpass'); },
  hit(p) { this.tone(190, 55, 0.14, 'triangle', 0.15 + 0.25 * p); this.noise(0.08, 0.12 * p + 0.05, 2400, 'bandpass'); },
  pound() { this.tone(110, 38, 0.35, 'sine', 0.45); this.noise(0.25, 0.2, 400, 'lowpass'); },
  splash() { this.noise(0.5, 0.28, 900, 'bandpass'); this.tone(420, 120, 0.25, 'sine', 0.1); },
  click() { this.tone(660, 880, 0.06, 'square', 0.06); },
  beep(hi) { this.tone(hi ? 880 : 520, hi ? 880 : 520, hi ? 0.35 : 0.14, 'square', 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.22, 'triangle', 0.2), i * 110)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.97, 0.3, 'triangle', 0.18), i * 150)); }
};
function haptic(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* not supported */ } }

/* ---------- textures ---------- */
function makeIceTexture() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 500;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(300, 230, 20, 320, 250, 340);
  bg.addColorStop(0, '#fcffff'); bg.addColorStop(0.55, '#e3f6fd'); bg.addColorStop(1, '#b4e3f4');
  g.fillStyle = bg; g.fillRect(0, 0, 640, 500);
  // frost blobs
  for (let i = 0; i < 16; i++) {
    const x = rnd(640), y = rnd(500), r = rnd(40, 110);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // blue depth patches
  for (let i = 0; i < 10; i++) {
    const x = rnd(640), y = rnd(500), r = rnd(30, 90);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(110,195,230,.28)'); gr.addColorStop(1, 'rgba(110,195,230,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // skate scratches
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(255,255,255,${rnd(0.15, 0.35)})`; g.lineWidth = rnd(1, 2.2);
    const x = rnd(640), y = rnd(500), a = rnd(TAU), l = rnd(60, 200);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // speckles
  for (let i = 0; i < 700; i++) {
    g.fillStyle = Math.random() < 0.6 ? `rgba(255,255,255,${rnd(0.2, 0.6)})` : `rgba(120,190,225,${rnd(0.1, 0.3)})`;
    g.beginPath(); g.arc(rnd(640), rnd(500), rnd(0.6, 2.2), 0, TAU); g.fill();
  }
  // cracks
  function crack(x, y, a, len, depth) {
    if (depth <= 0 || len < 8) return;
    g.beginPath(); g.moveTo(x, y);
    let cx = x, cy = y, ca = a;
    const steps = Math.floor(len / 14);
    for (let i = 0; i < steps; i++) {
      ca += rnd(-0.5, 0.5); cx += Math.cos(ca) * 14; cy += Math.sin(ca) * 14; g.lineTo(cx, cy);
      if (Math.random() < 0.18) crack(cx, cy, ca + rnd(-1.2, 1.2), len * 0.5, depth - 1);
    }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = depth + 1.5; g.stroke();
    g.strokeStyle = 'rgba(90,165,205,.75)'; g.lineWidth = depth * 0.7 + 0.5; g.stroke();
  }
  for (let i = 0; i < 7; i++) crack(rnd(120, 520), rnd(100, 400), rnd(TAU), rnd(120, 220), 3);
  return c;
}
function makeCausticTile() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = rnd(256), y = rnd(256), r = rnd(14, 46);
    for (let ox = -256; ox <= 256; ox += 256) for (let oy = -256; oy <= 256; oy += 256) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, 'rgba(140,230,255,.20)'); gr.addColorStop(0.6, 'rgba(140,230,255,.06)'); gr.addColorStop(1, 'rgba(140,230,255,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return c;
}
const iceTex = makeIceTexture();
const causticTile = makeCausticTile();

/* ---------- state ---------- */
let mode = 'menu';          // 'menu' (demo behind title) | 'play'
let phase = 'idle';         // 'count' | 'play' | 'over' | 'paused'
let T = 0;                  // global time
let ents = [];
let humanKind = 'bear';
let round = 1, roundT = 0, overT = 0, countT = 0, countShown = -1;
let arenaScale = 1, arenaTarget = 1, shrinkAt = 10, warn = null, nextShrinkIdx = 0;
let prof = new Array(N).fill(1), profT = new Array(N).fill(1);
let parts = [];
let shake = 0;
let drag = null;
let flashWhite = 0;
let confettiOn = false;
let speedMul = 1;
let bergs = [], flakes = [];

function newProfile() {
  const p1 = rnd(TAU), p2 = rnd(TAU), p3 = rnd(TAU), p4 = rnd(TAU);
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU;
    const v = 1 + 0.06 * Math.sin(3 * a + p1) + 0.045 * Math.sin(5 * a + p2) + 0.03 * Math.sin(9 * a + p3) + 0.015 * Math.sin(17 * a + p4);
    prof[i] = profT[i] = v;
  }
}
function edgeR(a) {
  let u = (a / TAU) % 1; if (u < 0) u += 1;
  const f = u * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f);
  return R0 * arenaScale * lerp(prof[i0], prof[i1], t);
}
function addBite(a, w, d) {
  for (let i = 0; i < N; i++) {
    let da = Math.abs(((i / N * TAU) - a + Math.PI * 3) % TAU - Math.PI);
    if (da < w) profT[i] -= d * 0.5 * (1 + Math.cos(Math.PI * da / w));
    profT[i] = Math.max(0.6, profT[i]);
  }
}
function margin(e) { return edgeR(Math.atan2(e.y, e.x)) - hyp(e.x, e.y); }

function mkEnt(kind, human, idx) {
  const k = K[kind];
  return { idx, kind, kindName: C.INFO[kind].name, human, x: 0, y: 0, vx: 0, vy: 0, r: k.r, m: k.m, alive: true, fall: 0, cd: 0, acd: 2, ko: 0, wins: 0,
    lastHit: -1, lastHitT: -9, think: rnd(0.8, 1.6), t: rnd(10), blink: 0, blinkT: rnd(1, 4), hit: 0, dizzy: 0,
    air: 0, airMax: 0.6, dash: 0, flop: 0, puffT: 0, mood: 'neutral', splashed: false };
}
function layout() {
  const list = ents;
  list.forEach((e, i) => {
    const ang = Math.PI / 2 + i * TAU / list.length;
    e.x = Math.cos(ang) * 92; e.y = Math.sin(ang) * 92;
    e.vx = e.vy = 0; e.alive = true; e.fall = 0; e.cd = 0.4; e.acd = rnd(1.5, 3); e.hit = 0; e.dizzy = 0; e.air = 0; e.dash = 0; e.flop = 0;
    e.lastHit = -1; e.mood = 'neutral'; e.splashed = false; e.think = rnd(1.9, 3.0); if (!e.human) e.acd = rnd(4, 6);
  });
}

function startMatch(kind) {
  humanKind = kind;
  mode = 'play'; zoom = 1; cyFrac = 0.46; applyView();
  const kinds = [kind].concat(C.KINDS.filter(k => k !== kind));
  ents = kinds.map((k, i) => mkEnt(k, i === 0, i));
  round = 1;
  buildChips();
  startRound();
  $('#hud').classList.add('show');
  setAbilityLabel();
}
function startDemo() {
  mode = 'menu'; zoom = 0.8; cyFrac = 0.5; applyView();
  const kinds = C.KINDS.slice().sort(() => Math.random() - 0.5);
  ents = kinds.map((k, i) => mkEnt(k, false, i));
  startRound();
  phase = 'play';
  $('#hud').classList.remove('show');
}
function startRound() {
  newProfile();
  arenaScale = arenaTarget = 1; warn = null; shrinkAt = 11; nextShrinkIdx = 0;
  layout(); parts = []; roundT = 0; overT = 0; drag = null; speedMul = 1; confettiOn = false;
  if (mode === 'play') {
    phase = 'count'; countT = 3.2; countShown = -1;
  } else phase = 'play';
  updateChips();
}

/* ---------- particles ---------- */
function add(p) { parts.push(p); return p; }
function puff(x, y, n, spd, size, col) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(0.3, 1) * spd;
    add({ t: 'puff', x, y, z: rnd(2, 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rnd(10, 30), life: rnd(0.35, 0.7), max: 0.7, size: size * rnd(0.7, 1.3), col: col || '255,255,255' });
  }
}
function shards(x, y, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(0.4, 1) * spd;
    add({ t: 'shard', x, y, z: rnd(4, 12), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rnd(80, 190), life: 1.2, max: 1.2, size: rnd(3, 7), rot: rnd(TAU), vr: rnd(-12, 12) });
  }
}
function splash(x, y, big) {
  add({ t: 'ring', x, y, z: 0, life: 0.9, max: 0.9, size: big ? 26 : 16, col: '210,245,255', lw: 3 });
  add({ t: 'ring', x, y, z: 0, life: 1.2, max: 1.2, size: big ? 16 : 9, col: '150,220,245', lw: 2 });
  for (let i = 0; i < (big ? 26 : 16); i++) {
    const a = rnd(TAU), s = rnd(15, 55);
    add({ t: 'drop', x, y, z: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rnd(90, 210), life: 1.4, max: 1.4, size: rnd(1.8, 3.6) });
  }
}
function starFx(x, y, s) { add({ t: 'star', x, y, z: 16, life: 0.26, max: 0.26, size: s }); }
function popText(x, y, text, col, size) { add({ t: 'text', x, y, z: 40, vz: 40, life: 1.1, max: 1.1, text, col: col || '#fff', size: size || 22 }); }
function shockRing(x, y, R, col) {
  add({ t: 'ring', x, y, z: 0, life: 0.55, max: 0.55, size: R * 0.25, grow: R * 0.9, col, lw: 7 });
  add({ t: 'ring', x, y, z: 0, life: 0.7, max: 0.7, size: R * 0.15, grow: R * 0.7, col: '255,255,255', lw: 3 });
}
function confetti() {
  confettiOn = true;
  for (let i = 0; i < 120; i++) add({ t: 'conf', x: rnd(W), y: rnd(-H * 0.6, 0), vx: rnd(-30, 30), vy: rnd(120, 260), life: 6, max: 6, size: rnd(5, 10), rot: rnd(TAU), vr: rnd(-8, 8), col: ['#ff8a3d', '#5ec8e5', '#ffd45e', '#ff5a6e', '#ffffff', '#2fc2ae'][Math.floor(rnd(6))] });
}

/* ---------- game logic ---------- */
function alive() { return ents.filter(e => e.alive && e.fall === 0); }
function nearestEnemy(e) {
  let best = null, bd = 1e9;
  for (const o of ents) if (o !== e && o.alive && o.fall === 0) { const d = hyp(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function launch(e, dx, dy, power) {
  const k = K[e.kind], l = hyp(dx, dy) || 1;
  const v = k.launch * power;
  e.vx += dx / l * v; e.vy += dy / l * v;
  const sp = hyp(e.vx, e.vy);
  if (sp > 720) { e.vx *= 720 / sp; e.vy *= 720 / sp; }
  e.cd = k.cd * (0.6 + 0.4 * power);
  puff(e.x, e.y, 6, 40, 7);
  Snd.whoosh();
}
function shock(e, R, F, col) {
  shockRing(e.x, e.y, R, col);
  for (const o of ents) {
    if (o === e || !o.alive || o.fall > 0 || o.air > 0) continue;
    const dx = o.x - e.x, dy = o.y - e.y, d = hyp(dx, dy) || 1;
    if (d < R + o.r) {
      const f = F * (1 - clamp(d / (R + o.r), 0, 1) * 0.55) / Math.pow(o.m, 0.8);
      o.vx += dx / d * f; o.vy += dy / d * f;
      o.lastHit = e.idx; o.lastHitT = T; o.hit = 1; o.dizzy = 0.6;
      starFx(o.x, o.y, 34);
    }
  }
  shake = Math.max(shake, 11); haptic(25);
}
function useAbility(e) {
  if (e.acd > 0 || !e.alive || e.fall > 0 || e.air > 0) return false;
  const k = K[e.kind], foe = nearestEnemy(e);
  e.acd = k.acd;
  if (e.kind === 'bear') {
    e.hit = 0.8; shock(e, 120, 470, '255,160,90'); Snd.pound(); puff(e.x, e.y, 14, 90, 11); shards(e.x, e.y, 14, 150);
  } else if (e.kind === 'penguin') {
    let dx = foe ? foe.x - e.x : e.vx, dy = foe ? foe.y - e.y : e.vy;
    const l = hyp(dx, dy) || 1; e.vx += dx / l * 520; e.vy += dy / l * 520; e.dash = 0.5;
    puff(e.x, e.y, 10, 70, 8); Snd.whoosh(); Snd.tone(300, 800, 0.18, 'triangle', 0.12);
  } else if (e.kind === 'seal') {
    if (foe) {
      const dx = foe.x - e.x, dy = foe.y - e.y, l = hyp(dx, dy) || 1, sp = Math.max(hyp(e.vx, e.vy), 360);
      e.vx = dx / l * sp; e.vy = dy / l * sp; e.flop = 0.45;
    }
    puff(e.x, e.y, 8, 60, 8, '190,225,255'); Snd.tone(500, 250, 0.2, 'sine', 0.14); Snd.whoosh();
  } else if (e.kind === 'orca') {
    e.air = e.airMax = 0.62; e.vx *= 0.5; e.vy *= 0.5; Snd.tone(300, 600, 0.3, 'sine', 0.18);
  }
  haptic(15);
  return true;
}

function collide(a, b, dt) {
  if (a.air > 0 || b.air > 0 || a.fall > 0 || b.fall > 0 || !a.alive || !b.alive) return;
  let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
  const min = a.r + b.r;
  if (d >= min) return;
  if (d < 0.001) { dx = rnd(-1, 1); dy = rnd(-1, 1); d = hyp(dx, dy); }
  const nx = dx / d, ny = dy / d, ov = min - d;
  const ia = 1 / a.m, ib = 1 / b.m;
  a.x -= nx * ov * ia / (ia + ib); a.y -= ny * ov * ia / (ia + ib);
  b.x += nx * ov * ib / (ia + ib); b.y += ny * ov * ib / (ia + ib);
  const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rv > 0) {
    const j = (1 + 0.93) * rv / (ia + ib);
    a.vx -= j * ia * nx; a.vy -= j * ia * ny;
    b.vx += j * ib * nx; b.vy += j * ib * ny;
    if (rv > 60) {
      const p = clamp(rv / 420, 0, 1);
      a.lastHit = b.idx; a.lastHitT = T; b.lastHit = a.idx; b.lastHitT = T;
      a.hit = b.hit = Math.max(a.hit, p);
      if (rv > 220) { a.dizzy = b.dizzy = 0.5; }
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      starFx(mx, my, 20 + 40 * p);
      shards(mx, my, 3 + Math.floor(7 * p), 120 + 120 * p);
      shake = Math.max(shake, 3 + 9 * p);
      Snd.hit(p);
      if (a.human || b.human) haptic(10 + 30 * p);
      if (p > 0.6) { flashWhite = Math.max(flashWhite, 0.18); popText(mx, my, ['BONK!', 'WHAM!', 'THUD!'][Math.floor(rnd(3))], '#fff', 26); }
    }
  }
}

function aiThink(e) {
  if (e.cd > 0) return;
  const foes = ents.filter(o => o !== e && o.alive && o.fall === 0);
  if (!foes.length) return;
  const m = margin(e);
  const jit = 0.26;
  if (m < 34) {
    const a = Math.atan2(-e.y, -e.x) + rnd(-0.35, 0.35);
    launch(e, Math.cos(a), Math.sin(a), rnd(0.45, 0.65));
    return;
  }
  let best = null, bs = 1e9;
  for (const o of foes) {
    const s = margin(o) + 0.3 * hyp(o.x - e.x, o.y - e.y) - (o.vx * o.vx + o.vy * o.vy < 400 ? 12 : 0);
    if (s < bs) { bs = s; best = o; }
  }
  const lead = 0.22;
  const tx = best.x + best.vx * lead, ty = best.y + best.vy * lead;
  const a = Math.atan2(ty - e.y, tx - e.x) + rnd(-jit, jit);
  const d = hyp(tx - e.x, ty - e.y);
  const pw = clamp(0.5 + d / 260, 0.5, 1) * rnd(0.75, 0.95);
  launch(e, Math.cos(a), Math.sin(a), pw);
}
function aiAbility(e) {
  if (e.acd > 0) return;
  const foe = nearestEnemy(e); if (!foe) return;
  const d = hyp(foe.x - e.x, foe.y - e.y);
  if (e.kind === 'bear' && d < 115 && Math.random() < 0.06) useAbility(e);
  else if (e.kind === 'orca' && d < 130 && Math.random() < 0.05) useAbility(e);
  else if (e.kind === 'penguin' && d > 60 && d < 220 && Math.random() < 0.025) useAbility(e);
  else if (e.kind === 'seal' && d > 70 && d < 240 && Math.random() < 0.025) useAbility(e);
}

function step(dt) {
  T += dt;
  bobY = Math.sin(T * 0.9) * 2;
  if (phase === 'paused') return;
  // arena profile smoothing & shrink
  for (let i = 0; i < N; i++) prof[i] += (profT[i] - prof[i]) * Math.min(1, dt * 1.6);
  arenaScale += (arenaTarget - arenaScale) * Math.min(1, dt * 1.4);

  if (phase === 'count') {
    countT -= dt;
    const shown = Math.ceil(countT);
    if (shown !== countShown && countT > 0) { countShown = shown; banner(String(shown), '', 'pop'); Snd.beep(false); }
    if (countT <= 0) { phase = 'play'; banner('GO!', '', 'pop'); Snd.beep(true); setHint('Drag back from anywhere and release to slide'); }
    ents.forEach(e => { e.t += dt; });
    particlesStep(dt);
    return;
  }

  const ts = dt * speedMul;
  if (phase === 'play') {
    roundT += ts;
    // melt schedule
    if (roundT > shrinkAt - 2.4 && !warn) {
      const a = rnd(TAU);
      warn = { a, w: 0.75, t: 2.4 };
    }
    if (warn) {
      warn.t -= ts;
      if (warn.t <= 0) {
        addBite(warn.a, warn.w, 0.12);
        arenaTarget = Math.max(0.5, arenaTarget * 0.935);
        shards(Math.cos(warn.a) * R0 * arenaScale * 0.95, Math.sin(warn.a) * R0 * arenaScale * 0.95, 18, 180);
        splash(Math.cos(warn.a) * R0 * arenaScale, Math.sin(warn.a) * R0 * arenaScale, true);
        Snd.splash(); shake = Math.max(shake, 7);
        warn = null; shrinkAt = roundT + 8.5;
      }
    }
  }

  const sub = Math.ceil(ts / (1 / 120));
  const h = ts / sub;
  for (let s = 0; s < sub; s++) {
    for (const e of ents) {
      if (!e.alive) continue;
      if (e.air > 0) {
        e.air -= h;
        if (e.air <= 0) { e.air = 0; shock(e, 140, 500, '120,220,255'); Snd.pound(); splash(e.x, e.y, true); shards(e.x, e.y, 12, 160); }
      }
      e.x += e.vx * h; e.y += e.vy * h;
      const f = Math.exp(-FRICTION * h);
      e.vx *= f; e.vy *= f;
      const sp = hyp(e.vx, e.vy);
      if (sp < 5) { e.vx = e.vy = 0; }
    }
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) collide(ents[i], ents[j], h);
  }

  // per-entity timers, edge, AI
  for (const e of ents) {
    e.t += dt;
    e.cd = Math.max(0, e.cd - ts); e.acd = Math.max(0, e.acd - ts);
    e.hit = Math.max(0, e.hit - dt * 3); e.dizzy = Math.max(0, e.dizzy - dt);
    e.dash = Math.max(0, e.dash - dt); e.flop = Math.max(0, e.flop - dt);
    e.blinkT -= dt; if (e.blinkT <= 0) { e.blink = 0.12; e.blinkT = rnd(1.8, 4.5); } e.blink = Math.max(0, e.blink - dt);
    if (!e.alive) continue;
    if (e.fall > 0) {
      e.fall += dt;
      if (!e.splashed && e.fall > 0.45) { e.splashed = true; splash(e.x, e.y, false); Snd.splash(); }
      if (e.fall > 1.0) e.alive = false;
      continue;
    }
    const sp = hyp(e.vx, e.vy);
    e.puffT -= dt;
    if (sp > 170 && e.puffT <= 0 && e.air === 0) { e.puffT = 0.04; puff(e.x - e.vx * 0.02, e.y - e.vy * 0.02, 1, 18, 6); }
    // edge test
    if (e.air === 0 && phase !== 'over') {
      const ed = edgeR(Math.atan2(e.y, e.x));
      if (hyp(e.x, e.y) > ed + 2) {
        e.fall = 0.001; shake = Math.max(shake, 4);
        const k = e.lastHit >= 0 && T - e.lastHitT < 3.5 ? ents[e.lastHit] : null;
        if (k && k !== e) { k.ko++; popText(e.x, e.y, '+1 KO', '#ffd45e', 24); } else popText(e.x, e.y, 'Slipped!', '#fff', 20);
        if (e.human) { haptic(60); Snd.lose(); }
        updateChips();
      }
    }
    // AI
    if (!e.human && phase === 'play') {
      e.think -= ts;
      if (e.think <= 0) { e.think = rnd(1.0, 1.9); aiThink(e); }
      aiAbility(e);
    }
    // mood
    const m = margin(e);
    e.mood = (e.dizzy > 0.2) ? 'dizzy' : (m < 26 || e.fall > 0) ? 'scared' : sp > 240 ? 'angry' : 'neutral';
  }
  for (const e of ents) if (e.fall > 0) e.mood = 'scared';

  // round end
  if (phase === 'play') {
    const live = alive();
    if (live.length <= 1 && mode === 'play') {
      phase = 'over'; overT = 1.9;
      const w = live[0] || null;
      roundWinner(w);
    } else if (live.length <= 1 && mode === 'menu') {
      phase = 'over'; overT = 2.2;
    }
    const human = ents[0];
    if (mode === 'play' && !human.alive && phase === 'play') speedMul = 1.6;
  } else if (phase === 'over') {
    overT -= dt;
    ents.forEach(e => { if (e.alive && e.fall === 0) e.mood = 'win'; });
    if (overT <= 0) {
      if (mode === 'menu') startRound();
      else nextRound();
    }
  }
  particlesStep(dt);
  shake *= Math.pow(0.0006, dt);
  flashWhite = Math.max(0, flashWhite - dt * 1.2);
  if (confettiOn && parts.length < 8) confettiOn = false;
  updateHud();
}

let lastWinner = null;
function roundWinner(w) {
  lastWinner = w;
  if (w) {
    w.wins++;
    banner(w.human ? 'You win the round!' : w.kindName + ' wins', 'Round ' + round + ' of 3', 'pop');
    if (w.human) { Snd.win(); haptic(40); }
  } else banner('Draw!', '', 'pop');
  updateChips();
}
function nextRound() {
  const best = ents.slice().sort((a, b) => b.wins - a.wins)[0];
  if (best.wins >= 2 || round >= 3) { matchOver(); return; }
  round++;
  startRound();
}
function matchOver() {
  phase = 'idle';
  const sorted = ents.slice().sort((a, b) => b.wins - a.wins || b.ko - a.ko);
  const champ = sorted[0], youWon = champ.human;
  $('#resTitle').textContent = youWon ? 'You are the champion!' : champ.kindName + ' takes the match';
  const rows = sorted.map(e => `<div class="row${e.human ? ' me' : ''}"><span class="dot" style="background:${COLORS[e.kind]}"></span><span class="nm">${e.human ? 'You (' + e.kindName + ')' : e.kindName}</span><span class="stars">${'★'.repeat(e.wins) || '–'}</span><span>${e.ko} KO</span></div>`);
  $('#standings').innerHTML = rows.join('');
  show('results');
  $('#hud').classList.remove('show');
  C.portrait($('#resPortrait'), champ.kind, 'win');
  if (youWon) { Snd.win(); confetti(); } else Snd.lose();
}

/* ---------- particles ---------- */
function particlesStep(dt) {
  for (const p of parts) {
    p.life -= dt;
    if (p.t === 'conf') { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; continue; }
    if (p.vx !== undefined) { p.x += p.vx * dt; p.y += (p.vy || 0) * dt; }
    if (p.vz !== undefined) {
      p.z += p.vz * dt;
      if (p.t === 'shard' || p.t === 'drop') p.vz -= 520 * dt;
      if (p.t === 'puff') p.vz *= 0.92;
      if ((p.t === 'shard' || p.t === 'drop') && p.z < 0) p.life = 0;
    }
    if (p.rot !== undefined && p.vr) p.rot += p.vr * dt;
  }
  parts = parts.filter(p => p.life > 0);
}

/* ---------- rendering ---------- */
function polyPoints(dy) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, r = R0 * arenaScale * prof[i];
    pts.push([sx(Math.cos(a) * r), sy(Math.sin(a) * r) + (dy || 0)]);
  }
  return pts;
}
function pathOf(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function initScene() {
  bergs = [];
  for (let i = 0; i < 7; i++) bergs.push({ x: rnd(-0.1, 1.1), y: rnd(0, 1), s: rnd(0.5, 1.3), ph: rnd(TAU), rot: rnd(TAU), pts: Array.from({ length: 7 }, (_, k) => [k / 7 * TAU, rnd(0.7, 1.15)]) });
  flakes = Array.from({ length: 70 }, () => ({ x: rnd(1), y: rnd(1), s: rnd(0.8, 2.6), v: rnd(0.02, 0.07), ph: rnd(TAU) }));
}
initScene();

function drawWater() {
  const g = ctx.createRadialGradient(CX, CY, 40 * S, CX, CY, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#1d9cc4'); g.addColorStop(0.35, '#0f6896'); g.addColorStop(1, '#06223f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // caustics scrolling
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    const off = T * (k ? -14 : 9), sc = k ? 1.5 : 1;
    ctx.globalAlpha = k ? 0.55 : 0.85;
    const tw = 256 * sc;
    const ox = ((off % tw) + tw) % tw, oy = (((off * 0.6 + k * 70) % tw) + tw) % tw;
    for (let x = -tw + ox; x < W; x += tw) for (let y = -tw + oy; y < H; y += tw) ctx.drawImage(causticTile, x, y, tw, tw);
  }
  ctx.restore();
  // soft wave lines
  ctx.save();
  ctx.strokeStyle = 'rgba(190,240,255,.07)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y0 = (i / 12) * H + ((T * 6 + i * 20) % (H / 12));
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) { const y = y0 + Math.sin(x * 0.02 + T * 1.2 + i) * 6; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // drifting bergs
  for (const b of bergs) {
    const x = ((b.x * W + T * 3 * b.s) % (W * 1.3)) - W * 0.15, y = b.y * H + Math.sin(T * 0.6 + b.ph) * 4;
    const r = 34 * b.s * S;
    ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot + T * 0.03);
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); b.pts.forEach(([a, k], i) => { const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k * TILT; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath();
    ctx.fillStyle = '#7fcfe8'; ctx.save(); ctx.translate(0, r * 0.25); ctx.fill(); ctx.restore();
    const gg = ctx.createLinearGradient(0, -r, 0, r); gg.addColorStop(0, '#f6fdff'); gg.addColorStop(1, '#bfe9f7');
    ctx.fillStyle = gg; ctx.fill();
    ctx.restore();
  }
  // vignette
  const v = ctx.createRadialGradient(CX, H * 0.5, Math.min(W, H) * 0.35, CX, H * 0.5, Math.max(W, H) * 0.85);
  v.addColorStop(0, 'rgba(0,10,30,0)'); v.addColorStop(1, 'rgba(0,10,30,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

let arenaCache = null;
function arenaBox() {
  const thick = 24 * S;
  const bw = 2 * R0 * 1.3 * S, bh = 2 * R0 * TILT * 1.3 * S + thick * 2 + 40 * S;
  return { x: CX - bw / 2, y: CY - R0 * TILT * 1.3 * S - 12 * S, w: bw, h: bh };
}
function drawArenaStatic() {
  const top = polyPoints(0);
  const thick = 24 * S;
  // underwater glow
  pathOf(polyPoints(thick + 8 * S)); ctx.fillStyle = 'rgba(120,225,250,.22)'; ctx.fill();
  // soft shadow on the water (layered, no blur filter so it works everywhere)
  for (let i = 4; i >= 1; i--) { pathOf(polyPoints(thick + (6 + i * 5) * S)); ctx.fillStyle = 'rgba(2,20,40,.13)'; ctx.fill(); }
  // side wall (extrusion)
  for (let k = thick; k >= 0; k -= 2) {
    const t = k / thick;
    pathOf(polyPoints(k));
    ctx.fillStyle = `rgb(${Math.round(lerp(168, 66, t))},${Math.round(lerp(226, 150, t))},${Math.round(lerp(246, 196, t))})`;
    ctx.fill();
  }
  // vertical striations on the wall
  ctx.save();
  pathOf(polyPoints(thick)); ctx.clip();
  const pb = polyPoints(thick);
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < N; i += 3) { ctx.beginPath(); ctx.moveTo(pb[i][0], pb[i][1] - thick); ctx.lineTo(pb[i][0], pb[i][1]); ctx.stroke(); }
  ctx.restore();
  // foam at the waterline
  pathOf(polyPoints(thick)); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3 * S; ctx.stroke();

  // top surface
  ctx.save();
  pathOf(top); ctx.clip();
  const g = ctx.createRadialGradient(sx(-30), sy(-40), 10 * S, sx(0), sy(0), R0 * S * 1.15);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e1f5fd'); g.addColorStop(1, '#a8dcf0');
  ctx.fillStyle = g; ctx.fillRect(CX - 300 * S, CY - 300 * S, 600 * S, 600 * S);
  const L = R0 * 1.18;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(iceTex, sx(-L), sy(-L), 2 * L * S, 2 * L * TILT * S);
  ctx.globalAlpha = 1;
  // wet edge band
  ctx.strokeStyle = 'rgba(120,205,235,.38)'; ctx.lineWidth = 30 * S; pathOf(top); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 10 * S; pathOf(top); ctx.stroke();
  ctx.restore();
  // crisp rim light
  pathOf(top); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3 * S; ctx.stroke();
  ctx.save(); ctx.translate(0, -1.5 * S); pathOf(top); ctx.strokeStyle = 'rgba(200,240,255,.6)'; ctx.lineWidth = 1.5 * S; ctx.stroke(); ctx.restore();
}
function buildArenaCache() {
  const bx = arenaBox();
  const pw = Math.ceil(bx.w * DPR), ph = Math.ceil(bx.h * DPR);
  if (!arenaCache || arenaCache.width !== pw || arenaCache.height !== ph) {
    arenaCache = document.createElement('canvas'); arenaCache.width = pw; arenaCache.height = ph;
  }
  const octx = arenaCache.getContext('2d');
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, pw, ph);
  const keep = ctx, kb = bobY;
  ctx = octx; bobY = 0;
  ctx.setTransform(DPR, 0, 0, DPR, -bx.x * DPR, -bx.y * DPR);
  drawArenaStatic();
  ctx = keep; bobY = kb;
}
function drawArena() {
  let sum = 0; for (let i = 0; i < N; i++) sum += prof[i] * (1 + (i % 7) * 0.01);
  const key = arenaScale.toFixed(4) + '|' + sum.toFixed(4) + '|' + W + 'x' + H + '|' + DPR;
  if (key !== arenaKey || !arenaCache) { buildArenaCache(); arenaKey = key; }
  const bx = arenaBox();
  ctx.drawImage(arenaCache, bx.x, bx.y + bobY, bx.w, bx.h);
  // dynamic parts: melt warning and sparkles, clipped to the ice
  const top = polyPoints(0);
  ctx.save();
  pathOf(top); ctx.clip();
  if (warn) {
    const pulse = 0.25 + 0.2 * Math.sin(T * 14);
    const a0 = warn.a - warn.w, a1 = warn.a + warn.w;
    ctx.beginPath();
    const steps = 18;
    for (let i = 0; i <= steps; i++) { const a = lerp(a0, a1, i / steps), r = edgeR(a); ctx.lineTo(sx(Math.cos(a) * r), sy(Math.sin(a) * r)); }
    for (let i = steps; i >= 0; i--) { const a = lerp(a0, a1, i / steps), r = edgeR(a) * 0.72; ctx.lineTo(sx(Math.cos(a) * r), sy(Math.sin(a) * r)); }
    ctx.closePath(); ctx.fillStyle = `rgba(255,120,40,${pulse})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,150,60,${0.6 + 0.4 * Math.sin(T * 14)})`; ctx.lineWidth = 3 * S; ctx.setLineDash([10 * S, 7 * S]);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const a = lerp(a0, a1, i / steps), r = edgeR(a) * 0.72; ctx.lineTo(sx(Math.cos(a) * r), sy(Math.sin(a) * r)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399, r = (0.2 + 0.7 * ((i * 37 % 100) / 100)) * R0 * arenaScale;
    const tw = Math.max(0, Math.sin(T * 2.2 + i * 1.7));
    if (tw > 0.2) {
      const x = sx(Math.cos(a) * r), y = sy(Math.sin(a) * r), s = (2 + 4 * tw) * S;
      ctx.fillStyle = `rgba(255,255,255,${tw})`;
      ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * 0.5, y + s * 0.5);
      ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.5, y - s * 0.5); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawEnt(e) {
  if (!e.alive && e.fall > 1) return;
  const k = K[e.kind];
  let z = 0;
  if (e.air > 0) { const u = 1 - e.air / e.airMax; z = Math.sin(u * Math.PI) * 78; }
  const x = sx(e.x), y0 = sy(e.y);
  let sc = e.r * 2.75 / 100 * S, alpha = 1, dyF = 0;
  if (e.fall > 0) { const u = clamp(e.fall / 0.9, 0, 1); sc *= 1 - 0.4 * u; alpha = 1 - u * 0.9; dyF = u * 26 * S; }
  // ground shadow
  const shR = e.r * 1.25 * S * (1 - z / 220);
  ctx.save(); ctx.globalAlpha = (e.fall > 0 ? alpha * 0.6 : 0.3); ctx.fillStyle = '#0a2a48';
  ctx.beginPath(); ctx.ellipse(x, y0 + 3 * S + dyF * 0.3, shR, shR * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
  // player marker ring
  if (e.human && e.fall === 0 && mode === 'play') {
    const pr = e.r * 1.5 * S, pulse = 1 + 0.06 * Math.sin(T * 6);
    ctx.save(); ctx.strokeStyle = `rgba(255,138,61,${e.cd > 0 ? 0.35 : 0.95})`; ctx.lineWidth = 3.5 * S;
    ctx.beginPath(); ctx.ellipse(x, y0 + 2 * S, pr * pulse, pr * pulse * 0.42, 0, 0, TAU); ctx.stroke();
    if (e.cd > 0) {
      const u = 1 - e.cd / (K[e.kind].cd);
      ctx.strokeStyle = '#5ec8e5'; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.ellipse(x, y0 + 2 * S, pr * pulse, pr * pulse * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + TAU * u); ctx.stroke();
    }
    ctx.restore();
  }
  const sp = hyp(e.vx, e.vy), mv = clamp(sp / 260, 0, 1);
  let sqx = 1 + 0.1 * mv + 0.16 * e.hit, sqy = 1 - 0.07 * mv - 0.2 * e.hit;
  if (e.flop > 0) { sqx *= 1.25; sqy *= 0.75; }
  if (e.air > 0) { const u = 1 - e.air / e.airMax; sqx *= 1 - 0.1 * Math.sin(u * Math.PI); sqy *= 1 + 0.12 * Math.sin(u * Math.PI); }
  const foe = nearestEnemy(e);
  const lx = foe ? clamp((foe.x - e.x) / 90, -1, 1) : 0, ly = foe ? clamp((foe.y - e.y) / 90, -1, 1) * 0.6 : 0;
  C.draw(ctx, e.kind, x, y0 - z * S + dyF, sc, {
    t: e.t, mood: e.mood, lx, ly, blink: e.blink > 0, moving: mv, tilt: clamp(e.vx / 520, -0.28, 0.28) + (e.fall > 0 ? e.fall * 3 : 0),
    sx: sqx, sy: sqy, alpha, arm: e.air > 0 ? -0.9 : (e.dash > 0 ? 0.6 : 0)
  });
  // dash streak
  if (e.dash > 0) {
    ctx.save(); ctx.globalAlpha = e.dash; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3 * S; ctx.lineCap = 'round';
    const l = hyp(e.vx, e.vy) || 1;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - e.vx / l * 18 * S + i * 8 * S, y0 - 28 * S - e.vy / l * 10 * S); ctx.lineTo(x - e.vx / l * 56 * S + i * 8 * S, y0 - 28 * S - e.vy / l * 30 * S); ctx.stroke(); }
    ctx.restore();
  }
  // name tag
  if (e.fall === 0) {
    const label = e.human && mode === 'play' ? 'YOU' : e.kindName;
    const ty = y0 - z * S - 118 * sc - 6 * S;
    ctx.save();
    ctx.font = `800 ${Math.round(11 * Math.max(0.9, S))}px Nunito, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 12 * S;
    ctx.fillStyle = e.human && mode === 'play' ? '#ff8a3d' : 'rgba(8,30,56,.78)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, ty - 8 * S, tw, 16 * S, 8 * S) : ctx.rect(x - tw / 2, ty - 8 * S, tw, 16 * S); ctx.fill();
    ctx.fillStyle = e.human && mode === 'play' ? '#0b2545' : '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, ty + 0.5); ctx.restore();
  }
  void k;
}

function drawParticles(layer) {
  for (const p of parts) {
    const u = p.life / p.max;
    if (layer === 'under' && p.t !== 'ring') continue;
    if (layer === 'over' && p.t === 'ring') continue;
    switch (p.t) {
      case 'ring': {
        const r = (p.size + (p.grow || p.size * 3) * (1 - u)) * S;
        ctx.strokeStyle = `rgba(${p.col},${u * 0.9})`; ctx.lineWidth = p.lw * S * (0.5 + u);
        ctx.beginPath(); ctx.ellipse(sx(p.x), sy(p.y), r, r * TILT, 0, 0, TAU); ctx.stroke(); break;
      }
      case 'puff': {
        ctx.fillStyle = `rgba(${p.col},${u * 0.55})`;
        ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y, p.z), p.size * S * (1.6 - u * 0.6), 0, TAU); ctx.fill(); break;
      }
      case 'shard': {
        ctx.save(); ctx.translate(sx(p.x), sy(p.y, p.z)); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, u * 2);
        ctx.fillStyle = '#e9f9ff'; ctx.strokeStyle = '#7ed0ee'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -p.size * S); ctx.lineTo(p.size * 0.7 * S, p.size * 0.8 * S); ctx.lineTo(-p.size * 0.7 * S, p.size * 0.6 * S); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break;
      }
      case 'drop': {
        ctx.fillStyle = `rgba(190,238,255,${Math.min(1, u * 2)})`;
        ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y, p.z), p.size * S, 0, TAU); ctx.fill(); break;
      }
      case 'star': {
        const s = p.size * S * (1.2 - u * 0.5), x = sx(p.x), y = sy(p.y, p.z);
        ctx.save(); ctx.translate(x, y); ctx.rotate(0.3); ctx.globalAlpha = u;
        ctx.fillStyle = '#fff'; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const rr = i % 2 ? s * 0.42 : s; const a = i / 16 * TAU; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, TAU); ctx.fill(); ctx.restore(); break;
      }
      case 'text': {
        ctx.save(); ctx.globalAlpha = Math.min(1, u * 2.2); ctx.font = `700 ${Math.round(p.size * Math.max(0.9, S))}px Fredoka, Nunito, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,30,56,.85)'; ctx.lineJoin = 'round';
        const x = sx(p.x), y = sy(p.y, p.z); ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y); ctx.restore(); break;
      }
      case 'conf': {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); break;
      }
    }
  }
}

function drawSnow() {
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (const f of flakes) {
    f.y += f.v * 0.016; if (f.y > 1.02) { f.y = -0.02; f.x = rnd(1); }
    const x = (f.x + Math.sin(T * 0.7 + f.ph) * 0.02) * W, y = f.y * H;
    ctx.globalAlpha = 0.35 + f.s * 0.12; ctx.beginPath(); ctx.arc(x, y, f.s * Math.max(0.8, S * 0.9), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAim() {
  const h = ents[0];
  if (!drag || !h || !h.alive || h.fall > 0 || mode !== 'play') return;
  const dx = drag.x0 - drag.x, dy = drag.y0 - drag.y;
  const len = hyp(dx, dy), maxPull = 110 * Math.max(0.8, S);
  const power = clamp(len / maxPull, 0, 1);
  setPower(power);
  if (len < 10) return;
  const wx = dx, wy = dy / TILT;
  const l = hyp(wx, wy), nx = wx / l, ny = wy / l;
  const x = sx(h.x), y = sy(h.y) - 20 * S;
  const k = K[h.kind];
  const dist = (k.launch * power) / FRICTION; // approximate travel distance
  const ex = x + nx * Math.min(dist, 260) * S, ey = y + ny * Math.min(dist, 260) * S * TILT;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, ex, ey);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, `rgba(255,${Math.round(200 - 80 * power)},${Math.round(120 - 60 * power)},.95)`);
  ctx.strokeStyle = g; ctx.lineWidth = 6 * S; ctx.lineCap = 'round'; ctx.setLineDash([2, 13 * S]); ctx.lineDashOffset = -T * 40;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
  // arrow head
  const ang = Math.atan2(ey - y, ex - x);
  ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = `rgba(255,${Math.round(190 - 80 * power)},90,1)`;
  ctx.beginPath(); ctx.moveTo(14 * S, 0); ctx.lineTo(-6 * S, -11 * S); ctx.lineTo(-2 * S, 0); ctx.lineTo(-6 * S, 11 * S); ctx.closePath(); ctx.fill();
  ctx.restore();
  // pull handle
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(drag.x0, drag.y0); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(drag.x0, drag.y0, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(drag.x, drag.y, 10, 0, TAU); ctx.fill(); ctx.restore();
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const shx = (Math.random() - 0.5) * shake * S, shy = (Math.random() - 0.5) * shake * S;
  ctx.save(); ctx.translate(shx, shy);
  drawWater();
  drawArena();
  drawParticles('under');
  const sorted = ents.slice().sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnt(e);
  drawParticles('over');
  drawAim();
  ctx.restore();
  drawSnow();
  if (flashWhite > 0) { ctx.fillStyle = `rgba(255,255,255,${flashWhite})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- HUD & UI ---------- */
const el = { hRound: $('#hRound'), hMelt: $('#hMelt'), hIce: $('#hIce'), chips: $('#chips'), hint: $('#hint'), pwFill: $('#pwFill'), pwLabel: $('#pwLabel'),
  abil: $('#abil'), abilName: $('#abilName'), abilSub: $('#abilSub'), abilCd: $('#abilCd'), banner: $('#banner'), toast: $('#toast') };
let hintT = 0;
function setHint(t) { el.hint.textContent = t; el.hint.style.opacity = 1; hintT = 4; }
function setPower(p) { el.pwFill.style.width = Math.round(p * 100) + '%'; }
function banner(main, sub, cls) {
  el.banner.className = 'banner';
  el.banner.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
  void el.banner.offsetWidth;
  el.banner.classList.add(cls || 'pop');
}
function toast(msg) { el.toast.textContent = msg; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 1600); }
function setAbilityLabel() { el.abilName.textContent = K[humanKind].ab; }
function buildChips() {
  el.chips.innerHTML = ents.map(e => `<div class="chip" id="chip${e.idx}"><span class="dot" style="background:${COLORS[e.kind]}"></span><span class="cn">${e.human ? 'You' : e.kindName.split(' ').pop()}</span><span class="stars"></span><span class="ko"></span></div>`).join('');
}
function updateChips() {
  if (mode !== 'play') return;
  ents.forEach(e => {
    const c = document.getElementById('chip' + e.idx); if (!c) return;
    c.classList.toggle('out', !e.alive || e.fall > 0);
    c.querySelector('.stars').textContent = '★'.repeat(e.wins);
    c.querySelector('.ko').textContent = e.ko + ' KO';
  });
}
let lastMelt = '', lastIce = '', lastCd = -1, lastSub = '';
function updateHud() {
  if (mode !== 'play') return;
  el.hRound.textContent = 'Round ' + round + ' of 3';
  let melt;
  if (warn) { melt = 'Melt ' + Math.max(0, Math.ceil(warn.t)); el.hMelt.classList.add('warn'); }
  else { melt = 'Melt ' + Math.max(0, Math.ceil(shrinkAt - 2.4 - roundT)); el.hMelt.classList.remove('warn'); }
  if (melt !== lastMelt) { el.hMelt.textContent = melt; lastMelt = melt; }
  const ice = 'Ice ' + Math.round(clamp(arenaScale, 0, 1) * 100) + '%';
  if (ice !== lastIce) { el.hIce.textContent = ice; lastIce = ice; }
  const h = ents[0];
  const cd = h.acd > 0 ? Math.round(h.acd / K[h.kind].acd * 100) : 0;
  if (cd !== lastCd) { el.abilCd.style.height = cd + '%'; lastCd = cd; el.abil.classList.toggle('cooling', cd > 0); }
  const sub = h.acd > 0 ? Math.ceil(h.acd) + 's' : 'Ready';
  if (sub !== lastSub) { el.abilSub.textContent = sub; lastSub = sub; }
  if (hintT > 0) { hintT -= 0.016; if (hintT <= 0) el.hint.style.opacity = 0; }
  if (!drag) setPower(0);
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  if (id) $('#' + id).classList.add('show');
}

/* ---------- input ---------- */
cv.addEventListener('pointerdown', ev => {
  Snd.init();
  if (mode !== 'play' || phase !== 'play') return;
  const h = ents[0]; if (!h.alive || h.fall > 0) return;
  drag = { x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  ev.preventDefault();
});
cv.addEventListener('pointermove', ev => { if (drag && ev.pointerId === drag.id) { drag.x = ev.clientX; drag.y = ev.clientY; } });
function endDrag(ev, fire) {
  if (!drag || (ev && ev.pointerId !== drag.id)) return;
  const d = drag; drag = null; setPower(0);
  if (!fire || mode !== 'play' || phase !== 'play') return;
  const h = ents[0]; if (!h.alive || h.fall > 0) return;
  const dx = d.x0 - d.x, dy = d.y0 - d.y, len = hyp(dx, dy), maxPull = 110 * Math.max(0.8, S);
  if (len < 14) return;
  if (h.cd > 0) { toast('Recharging...'); return; }
  launch(h, dx, dy / TILT, clamp(len / maxPull, 0.12, 1));
  haptic(12);
}
cv.addEventListener('pointerup', ev => endDrag(ev, true));
cv.addEventListener('pointercancel', ev => endDrag(ev, false));
cv.addEventListener('contextmenu', e => e.preventDefault());

$('#abil').addEventListener('pointerdown', ev => { ev.preventDefault(); Snd.init(); if (mode === 'play' && phase === 'play') useAbility(ents[0]); });
window.addEventListener('keydown', ev => {
  if (ev.code === 'Space') { ev.preventDefault(); if (mode === 'play' && phase === 'play') useAbility(ents[0]); }
  if (ev.code === 'Escape' || ev.code === 'KeyP') togglePause();
});

function togglePause() {
  if (mode !== 'play') return;
  if (phase === 'paused') { phase = prevPhase; show(null); }
  else if (phase === 'play' || phase === 'count') { prevPhase = phase; phase = 'paused'; drag = null; show('pause'); }
}
let prevPhase = 'play';

$('#btnPlay').addEventListener('click', () => { Snd.init(); Snd.click(); buildSelect(); show('select'); });
$('#btnBack').addEventListener('click', () => { Snd.click(); show('title'); });
$('#btnHow').addEventListener('click', () => { Snd.init(); Snd.click(); $('#how').classList.add('open'); });
$('#howClose').addEventListener('click', () => $('#how').classList.remove('open'));
$('#how').addEventListener('click', e => { if (e.target.id === 'how') $('#how').classList.remove('open'); });
$('#btnPause').addEventListener('click', () => togglePause());
$('#btnResume').addEventListener('click', () => togglePause());
$('#btnQuit').addEventListener('click', () => { phase = 'idle'; $('#hud').classList.remove('show'); startDemo(); show('title'); });
$('#btnAgain').addEventListener('click', () => { Snd.click(); show(null); startMatch(humanKind); });
$('#btnChange').addEventListener('click', () => { Snd.click(); parts = parts.filter(p => p.t !== 'conf'); startDemo(); buildSelect(); show('select'); });
$('#btnMute').addEventListener('click', () => { Snd.on = !Snd.on; $('#btnMute').classList.toggle('off', !Snd.on); if (Snd.on) Snd.click(); });

function buildSelect() {
  const wrap = $('#cards');
  wrap.innerHTML = C.KINDS.map(k => {
    const i = C.INFO[k];
    const bar = (label, v) => `<div class="stat"><span>${label}</span><i><b style="width:${v * 20}%"></b></i></div>`;
    return `<button class="card" data-k="${k}" type="button"><canvas></canvas><div class="nm">${i.name}</div><div class="tg">${K[k].ab}</div>${bar('Weight', i.weight)}${bar('Speed', i.speed)}${bar('Grip', i.grip)}</button>`;
  }).join('');
  requestAnimationFrame(() => {
    wrap.querySelectorAll('.card').forEach(c => C.portrait(c.querySelector('canvas'), c.dataset.k));
  });
  wrap.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    Snd.init(); Snd.click();
    show(null);
    startMatch(c.dataset.k);
  }));
}

/* ---------- boot ---------- */
Install.mount('.install-btn');
Install.registerSW();
startDemo();

let last = performance.now(), perfAcc = 0, perfN = 0;
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw); last = now;
  // adaptive resolution: if frames are slow, drop the render scale
  if (raw < 0.5) { perfAcc += raw; perfN++; }
  if (perfN >= 45) {
    if (perfAcc / perfN > 0.026 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); resize(); }
    perfAcc = 0; perfN = 0;
  }
  step(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// helpful for automated checks
window.__glacier = { get ents() { return ents; }, startMatch, get phase() { return phase; }, get mode() { return mode; }, useAbility, launch, step };
})();
