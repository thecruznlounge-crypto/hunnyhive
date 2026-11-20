(() => {
'use strict';

const C = window.Chars;
const $ = s => document.querySelector(s);
const cv = $('#game');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;
const TAU = Math.PI * 2;
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;

/* ---------- lane geometry (world units) ---------- */
const LL = 560;         // end of the lane (start of pit)
const PIT = 640;        // back wall
const LW = 104;         // lane width
const HALF = LW / 2;
const GUT = 54;         // ball center beyond this falls into the gutter
const KPER = 0.0016;    // perspective strength
const PINR = 6, BALLR = 8;
const KS = 34;          // curve strength
const SLICK_A = 85;     // sideways push on slick ice
const ZN = -300;        // how far toward the viewer the floor is drawn

const KINDS = {
  bear:    { mass: 1.9, spin: 0.7,  speed: 0.92, prev: 0.7, sp: 'Heavy Roll' },
  penguin: { mass: 1.0, spin: 0.55, speed: 1.08, prev: 1.0, sp: 'Laser Roll' },
  seal:    { mass: 1.2, spin: 1.7,  speed: 1.0,  prev: 0.6, sp: 'Trick Spin' },
  orca:    { mass: 1.4, spin: 1.0,  speed: 1.0,  prev: 0.7, sp: 'Splash Roll' }
};
const COLORS = { bear: '#f6f1e7', penguin: '#ff5a6e', seal: '#ffd45e', orca: '#5ec8e5' };

/* ---------- viewport / projection ---------- */
let W = 0, H = 0, DPR = 1, CX = 0, U = 2.4, Ybase = 600, Yfar = 200, dprCap = 2.5;
const Pend = 1 / (1 + LL * KPER);
let mode = 'menu';
function layoutLane() {
  CX = W / 2; U = W * 0.62 / LW;
  if (mode === 'play') {
    const hudB = $('#hudTop').getBoundingClientRect().bottom;
    const ctlT = $('#controls').getBoundingClientRect().top;
    Yfar = hudB + 52;
    Ybase = Math.max(Yfar + 220, ctlT - 96);
  } else {
    Yfar = H * 0.47; Ybase = H * 0.82;
  }
}
function resize() {
  DPR = Math.min(dprCap, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  layoutLane();
}
window.addEventListener('resize', resize);
function pj(x, z) {
  const p = 1 / (1 + z * KPER);
  return { x: CX + x * U * p, y: Ybase - (1 - p) / (1 - Pend) * (Ybase - Yfar), s: U * p };
}

/* ---------- audio ---------- */
const Snd = {
  ctx: null, on: true, lastTick: 0,
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
  roll() { this.noise(0.5, 0.16, 500, 'lowpass'); this.tone(120, 90, 0.4, 'sine', 0.06); },
  pin(p) { const now = performance.now(); if (now - this.lastTick < 45) return; this.lastTick = now; this.tone(900 + Math.random() * 500, 400, 0.07, 'triangle', 0.08 + 0.12 * p); this.noise(0.05, 0.08 + 0.1 * p, 3000, 'bandpass'); },
  crash() { this.noise(0.5, 0.3, 1400, 'bandpass'); this.tone(180, 60, 0.3, 'triangle', 0.25); },
  splash() { this.noise(0.4, 0.2, 800, 'bandpass'); },
  fish() { this.tone(600, 1200, 0.15, 'square', 0.07); },
  click() { this.tone(660, 880, 0.06, 'square', 0.06); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.22, 'triangle', 0.2), i * 110)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.97, 0.3, 'triangle', 0.18), i * 150)); }
};
function haptic(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* ignore */ } }

/* ---------- static scene data ---------- */
let stars = [], peaks = [], trees = [], flakes = [];
function initScene() {
  stars = Array.from({ length: 90 }, () => ({ x: rnd(1), y: rnd(0.55), s: rnd(0.6, 1.8), ph: rnd(TAU) }));
  peaks = [0, 1].map(l => Array.from({ length: 10 }, (_, i) => ({ x: i / 9 * 1.2 - 0.1 + rnd(-0.03, 0.03), h: rnd(0.5, 1) * (l ? 0.7 : 1) })));
  trees = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let z = -200; z < PIT; z += rnd(55, 95)) trees.push({ side, z, off: rnd(76, 104), h: rnd(0.8, 1.25) });
  }
  trees.sort((a, b) => b.z - a.z);
  flakes = Array.from({ length: 60 }, () => ({ x: rnd(1), y: rnd(1), s: rnd(0.8, 2.4), v: rnd(0.02, 0.06), ph: rnd(TAU) }));
}
initScene();

/* ---------- game state ---------- */
let phase = 'idle';     // 'aim' | 'ai' | 'roll' | 'after' | 'over' | 'paused'
let prevPhase = 'aim';
let T = 0;
let players = [];
let cur = 0, frame = 0;
let humanKind = 'bear';
let pins = [], ball = null, slick = null, fish = null;
let startX = 0, charX = 0, pullDrag = null, aiPlan = null;
let phaseT = 0, rollT = 0, calmT = 0;
let parts = [], shake = 0, flashWhite = 0;
let remaining = 10, downThis = 0;
let charMood = 'neutral', charMoodT = 0, throwT = 9, charArm = 0;
let demoKind = 'bear';

function mkPlayer(kind, human) { return { kind, human, name: C.INFO[kind].name, rolls: [], fr: [], uses: 2 }; }

function newEnv() {
  slick = { x: rnd(-26, 26), z: rnd(190, 330), w: rnd(30, 40), l: rnd(60, 80), dir: Math.random() < 0.5 ? -1 : 1 };
  let fx;
  do { fx = rnd(-30, 30); } while (Math.abs(fx - slick.x) < 20);
  fish = { x: fx, z: rnd(110, 430), r: 9, taken: false, t: 0 };
}
function newRack() {
  pins = [];
  let id = 0;
  for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) {
    const hx = (i - r / 2) * 16, hz = 500 + r * 14;
    pins.push({ id: id++, hx, hz, x: hx, z: hz, vx: 0, vz: 0, fall: false, tilt: 0, tdir: 1, gone: false, charge: 0, alpha: 1, drop: rnd(0.35, 0.65), speed: 0 });
  }
  remaining = 10;
}
function resetStanding() {
  pins = pins.filter(p => !p.fall && !p.gone && p.z < LL + 6 && Math.abs(p.x) < GUT - 2);
  pins.forEach(p => { p.x = p.hx; p.z = p.hz; p.vx = p.vz = 0; p.tilt = 0; p.charge = 0; p.alpha = 1; p.speed = 0; });
  remaining = pins.length;
}

/* ---------- ball physics ---------- */
function ballParams(kind, sp) {
  const k = KINDS[kind];
  const b = { mass: 4.2 * k.mass, spin: k.spin, speed: k.speed, slickF: kind === 'penguin' ? 0.5 : 1, straight: false, splash: false };
  if (sp) {
    if (kind === 'bear') { b.mass *= 1.8; b.speed *= 1.08; }
    if (kind === 'penguin') { b.straight = true; b.slickF = 0; b.speed *= 1.12; }
    if (kind === 'seal') b.spin *= 2.0;
    if (kind === 'orca') b.splash = true;
  }
  return b;
}
function mkBall(x, ang, curve, power, kind, sp) {
  const bp = ballParams(kind, sp);
  const v = (230 + 250 * power) * bp.speed;
  return { x, z: 6, vx: v * Math.sin(ang), vz: v * Math.cos(ang), curve: bp.straight ? 0 : curve, spin: bp.spin, slickF: bp.slickF, mass: bp.mass, splash: bp.splash,
    gut: false, done: false, rot: 0, fish: false, inSlick: false, fade: 1, kind };
}
function advanceBall(b, h, env) {
  let ev = null;
  if (!b.gut) {
    let ax = b.curve * KS * b.spin * (0.4 + 0.9 * clamp(b.z / LL, 0, 1.2));
    const sl = env.slick;
    if (Math.abs(b.x - sl.x) < sl.w / 2 && Math.abs(b.z - sl.z) < sl.l / 2) { ax = ax * 0.4 + sl.dir * SLICK_A * b.slickF; b.inSlick = true; } else b.inSlick = false;
    b.vx += ax * h;
  }
  b.vz *= Math.exp(-0.1 * h);
  b.x += b.vx * h; b.z += b.vz * h; b.rot += b.vz * h * 0.09;
  if (!env.fish.taken) {
    const dx = b.x - env.fish.x, dz = b.z - env.fish.z;
    if (dx * dx + dz * dz < (env.fish.r + BALLR) * (env.fish.r + BALLR)) { b.vz *= 1.1; b.vx *= 1.1; ev = 'fish'; }
  }
  if (!b.gut && Math.abs(b.x) > GUT) { b.gut = true; b.vx = 0; ev = ev || 'gutter'; }
  if (b.gut) { const t = (b.x < 0 ? -1 : 1) * 58; b.x += (t - b.x) * Math.min(1, h * 12); }
  return ev;
}
function simBall(sx, ang, curve, power, kind, sp, frac) {
  const b = mkBall(sx, ang, curve, power, kind, sp);
  const env = { slick, fish: { x: fish.x, z: fish.z, r: fish.r, taken: fish.taken } };
  const pts = [{ x: b.x, z: b.z }];
  let n = 0;
  while (b.z < LL * frac && n < 700) {
    const ev = advanceBall(b, 1 / 60, env);
    if (ev === 'fish') env.fish.taken = true;
    pts.push({ x: b.x, z: b.z }); n++;
    if (b.gut) break;
  }
  return pts;
}
function xAt(pts, z) {
  for (let i = 1; i < pts.length; i++) if (pts[i].z >= z) { const a = pts[i - 1], b = pts[i], t = (z - a.z) / ((b.z - a.z) || 1); return lerp(a.x, b.x, t); }
  return pts[pts.length - 1].x;
}

/* ---------- pins ---------- */
function circleHit(a, ma, b, mb, e, boost) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d, nz = dz / d, ov = min - d, ia = 1 / ma, ib = 1 / mb;
  a.x -= nx * ov * ia / (ia + ib); a.z -= nz * ov * ia / (ia + ib);
  b.x += nx * ov * ib / (ia + ib); b.z += nz * ov * ib / (ia + ib);
  const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rv > 0) {
    const j = (1 + e) * rv / (ia + ib) * (boost || 1);
    a.vx -= j * ia * nx; a.vz -= j * ia * nz; b.vx += j * ib * nx; b.vz += j * ib * nz;
    return rv;
  }
  return 0;
}
function toppleIfHit(p, rv, thr) {
  if (!p.fall && rv > thr) {
    p.fall = true; p.tdir = (p.vx >= 0 ? 1 : -1) * (Math.random() < 0.12 ? -1 : 1);
    return true;
  }
  return false;
}
function stepPins(h) {
  const bObj = ball && !ball.gut && !ball.done ? { x: ball.x, z: ball.z, vx: ball.vx, vz: ball.vz, r: BALLR } : null;
  for (const p of pins) {
    if (p.gone) continue;
    p.x += p.vx * h; p.z += p.vz * h;
    const fr = p.fall ? 1.3 : 5.5;
    const f = Math.exp(-fr * h); p.vx *= f; p.vz *= f;
    p.speed = Math.hypot(p.vx, p.vz);
    if (p.fall) p.tilt += (p.tdir * 1.5 - p.tilt) * Math.min(1, h * 8);
    p.charge = Math.max(0, p.charge - h);
    if (p.z > PIT - 6 || Math.abs(p.x) > 64) { p.gone = true; p.fall = true; }
  }
  const live = pins.filter(p => !p.gone).map(p => ({ p, o: { x: p.x, z: p.z, vx: p.vx, vz: p.vz, r: PINR } }));
  // ball vs pins
  if (bObj) {
    for (const q of live) {
      if (Math.abs(q.o.z - bObj.z) > 16) continue;
      const bb = { x: bObj.x, z: bObj.z, vx: ball.vx, vz: ball.vz, r: BALLR };
      const rv = circleHit(bb, ball.mass, q.o, 1, 0.55, 1);
      if (rv > 0) {
        ball.vx = bb.vx; ball.vz = bb.vz; ball.x = bb.x; ball.z = bb.z; bObj.x = bb.x; bObj.z = bb.z;
        q.p.x = q.o.x; q.p.z = q.o.z; q.p.vx = q.o.vx; q.p.vz = q.o.vz;
        if (toppleIfHit(q.p, rv, 4)) pinFx(q.p, rv);
        if (ball.splash) q.p.charge = 0.9;
        ball.vx *= 0.995;
      }
    }
  }
  // pin vs pin
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const A = live[i], B = live[j];
    if (Math.abs(A.o.z - B.o.z) > 14 || Math.abs(A.o.x - B.o.x) > 14) continue;
    A.o.x = A.p.x; A.o.z = A.p.z; A.o.vx = A.p.vx; A.o.vz = A.p.vz;
    B.o.x = B.p.x; B.o.z = B.p.z; B.o.vx = B.p.vx; B.o.vz = B.p.vz;
    const boost = (A.p.charge > 0 || B.p.charge > 0) ? 1.7 : 1;
    const rv = circleHit(A.o, 1, B.o, 1, 0.6, boost);
    if (rv > 0) {
      A.p.x = A.o.x; A.p.z = A.o.z; A.p.vx = A.o.vx; A.p.vz = A.o.vz;
      B.p.x = B.o.x; B.p.z = B.o.z; B.p.vx = B.o.vx; B.p.vz = B.o.vz;
      if (boost > 1) { A.p.charge = Math.max(A.p.charge, 0.7); B.p.charge = Math.max(B.p.charge, 0.7); }
      const thr = boost > 1 ? 8 : 20;
      if (toppleIfHit(A.p, rv, thr)) pinFx(A.p, rv);
      if (toppleIfHit(B.p, rv, thr)) pinFx(B.p, rv);
    }
  }
}
function pinFx(p, rv) {
  const pw = clamp(rv / 200, 0.15, 1);
  Snd.pin(pw);
  const n = 2 + Math.floor(pw * 4);
  for (let i = 0; i < n; i++) add({ t: 'shard', x: p.x, z: p.z, h: rnd(2, 10), vx: rnd(-40, 40), vz: rnd(-30, 50), vh: rnd(40, 120), life: 0.8, max: 0.8, size: rnd(1.4, 3), rot: rnd(TAU), vr: rnd(-10, 10) });
  if (pw > 0.5) { shake = Math.max(shake, 2 + 4 * pw); }
}

/* ---------- particles (world coords x,z,h) ---------- */
function add(p) { parts.push(p); return p; }
function spray(x, z, n, spd) {
  for (let i = 0; i < n; i++) add({ t: 'puff', x: x + rnd(-3, 3), z, h: rnd(1, 4), vx: rnd(-1, 1) * spd, vz: rnd(-0.5, 1) * spd, vh: rnd(10, 40), life: rnd(0.3, 0.6), max: 0.6, size: rnd(2, 4.5) });
}
function popText(x, z, text, col, size) { add({ t: 'text', x, z, h: 20, vx: 0, vz: 0, vh: 22, life: 1.4, max: 1.4, text, col: col || '#fff', size: size || 22 }); }
function confetti() {
  for (let i = 0; i < 110; i++) add({ t: 'conf', sx: rnd(W), sy: rnd(-H * 0.5, 0), vsx: rnd(-30, 30), vsy: rnd(120, 260), life: 5, max: 5, size: rnd(5, 10), rot: rnd(TAU), vr: rnd(-8, 8), col: ['#ff8a3d', '#5ec8e5', '#ffd45e', '#ff5a6e', '#ffffff', '#2fc2ae'][Math.floor(rnd(6))] });
}
function stepParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    if (p.t === 'conf') { p.sx += p.vsx * dt; p.sy += p.vsy * dt; p.rot += p.vr * dt; continue; }
    p.x += (p.vx || 0) * dt; p.z += (p.vz || 0) * dt; p.h += (p.vh || 0) * dt;
    if (p.t === 'shard') { p.vh -= 400 * dt; if (p.h < 0) p.life = 0; p.rot += (p.vr || 0) * dt; }
    if (p.t === 'puff') p.vh *= 0.94;
  }
  parts = parts.filter(p => p.life > 0);
}

/* ---------- scoring ---------- */
function calc(rolls) {
  const cells = []; let i = 0, run = 0;
  for (let f = 0; f < 10; f++) {
    const c = { m: [], t: null }; cells.push(c);
    if (i >= rolls.length) continue;
    const a = rolls[i];
    if (f < 9) {
      if (a === 10) {
        c.m = ['X']; i++;
        const b = rolls[i], d = rolls[i + 1];
        if (b !== undefined && d !== undefined) { run += 10 + b + d; c.t = run; }
      } else {
        const b = rolls[i + 1];
        if (b === undefined) { c.m = [a]; i++; }
        else {
          c.m = [a, a + b === 10 ? '/' : b];
          if (a + b === 10) { const d = rolls[i + 2]; if (d !== undefined) { run += 10 + d; c.t = run; } }
          else { run += a + b; c.t = run; }
          i += 2;
        }
      }
    } else {
      const b = rolls[i + 1], d = rolls[i + 2], m = [a === 10 ? 'X' : a];
      if (b !== undefined) m.push(a === 10 ? (b === 10 ? 'X' : b) : (a + b === 10 ? '/' : b));
      if (d !== undefined) {
        if (a === 10 && b === 10) m.push(d === 10 ? 'X' : d);
        else if (a === 10) m.push(b + d === 10 ? '/' : d);
        else m.push(d === 10 ? 'X' : d);
      }
      c.m = m;
      const done = a === 10 ? (b !== undefined && d !== undefined) : (b !== undefined && (a + b === 10 ? d !== undefined : true));
      if (done) c.t = run + a + (b || 0) + (d || 0);
    }
  }
  let total = 0; cells.forEach(c => { if (c.t !== null) total = c.t; });
  return { cells, total };
}

/* ---------- turn flow ---------- */
function startMatch(kind) {
  humanKind = kind; mode = 'play';
  const others = C.KINDS.filter(k => k !== kind);
  players = [mkPlayer(kind, true), mkPlayer(others[Math.floor(rnd(others.length))], false)];
  cur = 0; frame = 0;
  parts = parts.filter(p => p.t !== 'conf');
  buildScoreboard();
  $('#hud').classList.add('show');
  layoutLane();
  newEnv(); newRack();
  startX = 0; charX = 0; $('#slPos').value = 0; $('#slCurve').value = 0; updateCurveLabel();
  setSpecial(false);
  beginTurn(true);
}
function beginTurn(first) {
  const p = players[cur];
  throwT = 9; charMood = 'neutral'; charArm = 0; ball = null; aiPlan = null;
  if (p.fr.length === 0 && !first) { newEnv(); }
  if (first) newEnv();
  if (p.human) { phase = 'aim'; startX = +$('#slPos').value; }
  else { phase = 'ai'; phaseT = 1.1; }
  specialOn = false; setSpecial(false);
  updateHud(); updateScoreboard();
  if (p.human) setHint('Drag back from the ball, then let go to roll');
  else setHint(p.name + ' is lining up...');
}
function rollBall(sx, ang, curve, power, sp) {
  const p = players[cur] || { kind: demoKind };
  ball = mkBall(sx, ang, curve, power, p.kind, sp);
  phase = 'roll'; rollT = 0; calmT = 0; throwT = 0;
  Snd.roll(); haptic(15);
  spray(sx, 6, 8, 40);
  if (mode === 'play' && sp && p.uses > 0) { p.uses--; }
  updateHud();
}
function countDown() {
  return pins.filter(p => p.fall || p.gone || p.z > LL + 6 || Math.abs(p.x) > GUT - 2).length;
}
function finishRoll() {
  const down = countDown();
  downThis = down;
  const p = players[cur];
  const gutter = ball && ball.gut;
  if (mode === 'play') {
    p.rolls.push(down); p.fr.push(down);
  }
  // reaction + banner
  const first = mode === 'play' ? p.fr.length === 1 || (frame === 9 && remaining === 10) : true;
  let msg = '', sub = '';
  if (down === remaining && down > 0) {
    if (mode === 'play') {
      const strike = first && remaining === 10;
      msg = strike ? 'STRIKE!' : 'SPARE!'; confetti2(strike); charMood = 'win'; Snd.win(); shake = Math.max(shake, strike ? 12 : 6); flashWhite = 0.25; haptic(strike ? 60 : 30);
    }
  } else if (down === 0) {
    msg = gutter ? 'Gutter ball' : 'Miss'; charMood = gutter ? 'scared' : 'dizzy';
  } else { msg = down + (down === 1 ? ' pin' : ' pins'); charMood = down >= 7 ? 'win' : 'neutral'; }
  charMoodT = 1.6;
  if (mode === 'play' && msg) banner(msg, sub);
  phase = 'after'; phaseT = down === remaining && down > 0 ? 2.1 : 1.7;
  Snd.crash();
  updateScoreboard();
}
function confetti2(strike) { if (strike || players[cur].human) { if (players[cur].human) confetti(); } }

function advanceTurn() {
  if (mode === 'menu') { newRack(); newEnv(); demoThrow(); return; }
  const p = players[cur];
  const fr = p.fr;
  let done = false, rack = false;
  if (frame < 9) {
    if (fr[0] === 10 || fr.length === 2) done = true;
  } else {
    if (fr.length === 1 && fr[0] === 10) rack = true;
    if (fr.length === 2) {
      if (fr[0] === 10 && fr[1] === 10) rack = true;
      else if (fr[0] === 10) done = false;
      else if (fr[0] + fr[1] === 10) rack = true;
      else done = true;
    }
    if (fr.length === 3) done = true;
    if (fr.length === 2 && fr[0] === 10 && fr[1] < 10 && !rack) { /* continue with remaining pins */ }
  }
  if (done) {
    p.fr = [];
    if (cur === 0) cur = 1; else { cur = 0; frame++; }
    if (frame > 9) { endMatch(); return; }
    newRack();
  } else if (rack) newRack();
  else resetStanding();
  if (done) { /* already racked */ }
  beginTurn(false);
}

/* ---------- AI ---------- */
function aiPlanRoll(p) {
  const kind = p.kind;
  const sp = p.uses > 0 && remaining > 0 && Math.random() < (p.fr.length === 1 ? 0.3 : 0.18);
  const standing = pins.filter(q => !q.fall && !q.gone);
  let tx = 0, tz = 505;
  if (standing.length === 10) tx = (Math.random() < 0.5 ? -1 : 1) * 4;
  else if (standing.length) { tx = standing.reduce((a, q) => a + q.hx, 0) / standing.length; tz = standing.reduce((a, q) => a + q.hz, 0) / standing.length; }
  const power = rnd(0.78, 0.95);
  let best = null;
  for (const sx of [-26, -14, 0, 14, 26]) for (const cv0 of [-0.6, -0.3, 0, 0.3, 0.6]) {
    for (let ang = -0.13; ang <= 0.1301; ang += 0.01) {
      const pts = simBall(sx, ang, cv0, power, kind, sp, 0.93);
      const last = pts[pts.length - 1];
      if (last.z < tz - 4) continue;
      const err = Math.abs(xAt(pts, tz) - tx) + Math.abs(cv0) * 1.2 + (Math.random() * 0.2);
      if (!best || err < best.err) best = { err, sx, curve: cv0, ang };
    }
  }
  if (!best) best = { sx: 0, curve: 0, ang: 0 };
  // humanize: usually a small wobble, sometimes a real miss
  let noise = 0.042;
  if (Math.random() < 0.26) noise = 0.1;
  return { x: best.sx + rnd(-4, 4), angle: best.ang + rnd(-noise, noise), curve: best.curve + rnd(-0.12, 0.12), power: clamp(power + rnd(-0.1, 0.05), 0.5, 1), sp };
}
function demoThrow() {
  demoKind = C.KINDS[Math.floor(rnd(4))];
  players = [mkPlayer(demoKind, false)];
  const plan = aiPlanRoll(players[0]);
  aiPlan = plan; phase = 'ai'; phaseT = 1.0; startX = plan.x; charX = plan.x;
}

/* ---------- match end ---------- */
function endMatch() {
  phase = 'over';
  const t = players.map(p => calc(p.rolls).total);
  const youWon = t[0] > t[1], tie = t[0] === t[1];
  $('#resTitle').textContent = tie ? 'It is a tie!' : (youWon ? 'You win!' : players[1].name + ' wins');
  const order = [0, 1].sort((a, b) => t[b] - t[a]);
  $('#standings').innerHTML = order.map(i => `<div class="row${players[i].human ? ' me' : ''}"><span class="dot" style="background:${COLORS[players[i].kind]}"></span><span class="nm">${players[i].human ? 'You (' + players[i].name + ')' : players[i].name}</span><span class="sc">${t[i]}</span></div>`).join('');
  show('results');
  $('#hud').classList.remove('show');
  C.portrait($('#resPortrait'), tie ? players[0].kind : players[order[0]].kind, 'win');
  if (youWon) { Snd.win(); confetti(); } else Snd.lose();
}

/* ---------- update ---------- */
function update(dt) {
  T += dt;
  if (phase === 'paused') return;
  throwT += dt;
  charMoodT -= dt; if (charMoodT <= 0 && phase !== 'after') charMood = 'neutral';
  charX += (startX - charX) * Math.min(1, dt * 10);
  if (phase === 'aim') {
    startX = +$('#slPos').value;
  }
  if (phase === 'ai') {
    phaseT -= dt;
    if (phaseT > 0.5 || !aiPlan) {
      if (!aiPlan && phaseT < 0.9) { aiPlan = aiPlanRoll(players[cur]); startX = aiPlan.x; if (mode === 'play') { $('#slCurve').value = Math.round(aiPlan.curve * 100); updateCurveLabel(); $('#slPos').value = Math.round(aiPlan.x); } }
    }
    if (phaseT <= 0 && aiPlan) {
      if (mode === 'play' && aiPlan.sp) { setSpecial(true); }
      rollBall(aiPlan.x, aiPlan.angle, aiPlan.curve, aiPlan.power, aiPlan.sp);
    }
  }
  if (phase === 'roll') {
    rollT += dt;
    const sub = Math.ceil(dt / (1 / 120)), h = dt / sub;
    for (let s = 0; s < sub; s++) {
      if (ball && !ball.done) {
        const ev = advanceBall(ball, h, { slick, fish });
        if (ev === 'fish') { fish.taken = true; fish.t = 0; Snd.fish(); popText(fish.x, fish.z, 'Boost!', '#ffd45e', 22); spray(fish.x, fish.z, 10, 30); }
        if (ev === 'gutter') { Snd.splash(); spray(ball.x, ball.z, 12, 40); if (mode === 'play') haptic(30); }
        if (ball.z > PIT - 10 || ball.vz < 6) ball.done = true;
        if (ball.z > LL + 4 && !ball.gut) { /* in the pit */ }
      }
      stepPins(h);
    }
    if (ball && !ball.done && Math.random() < dt * 40) spray(ball.x, ball.z, 1, 12);
    if (ball && ball.done) ball.fade = Math.max(0, ball.fade - dt * 2);
    const moving = pins.some(p => !p.gone && p.speed > 6);
    if (ball && ball.done && !moving) calmT += dt; else calmT = 0;
    if (calmT > 0.5 || rollT > 8) finishRoll();
  }
  if (phase === 'after') {
    phaseT -= dt;
    pins.forEach(p => { if (p.fall || p.gone) p.alpha = Math.max(0, p.alpha - dt * 0.7); });
    if (ball) ball.fade = Math.max(0, ball.fade - dt * 3);
    if (phaseT <= 0) advanceTurn();
  }
  if (phase !== 'roll') {
    const sub = Math.ceil(dt / (1 / 120)), h = dt / sub;
    for (let s = 0; s < sub; s++) stepPins(h);
  }
  // rack drop-in
  for (const p of pins) if (p.drop > 0) p.drop = Math.max(0, p.drop - dt);
  if (fish) fish.t += dt;
  stepParts(dt);
  shake *= Math.pow(0.0008, dt);
  flashWhite = Math.max(0, flashWhite - dt * 1.3);
}

/* ---------- rendering ---------- */
function strip(xa, xb, za, zb) {
  const a = pj(xa, za), b = pj(xb, za), c = pj(xb, zb), d = pj(xa, zb);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
}
function drawBackdrop() {
  const yh = pj(0, PIT + 140).y;
  const g = ctx.createLinearGradient(0, 0, 0, yh);
  g.addColorStop(0, '#050f24'); g.addColorStop(0.55, '#0b2c55'); g.addColorStop(1, '#1d6b97');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(T * 1.5 + s.ph);
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * tw})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * yh, s.s * 0.8, 0, TAU); ctx.fill();
  }
  // aurora ribbons
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const cols = [['80,255,190', 0.2], ['90,170,255', 0.16], ['190,120,255', 0.12]];
  cols.forEach((c, k) => {
    const base = yh * (0.12 + 0.1 * k), amp = yh * 0.05, hh = yh * 0.3;
    const gr = ctx.createLinearGradient(0, base - amp, 0, base + hh);
    gr.addColorStop(0, `rgba(${c[0]},0)`); gr.addColorStop(0.35, `rgba(${c[0]},${c[1]})`); gr.addColorStop(1, `rgba(${c[0]},0)`);
    ctx.fillStyle = gr; ctx.beginPath();
    for (let x = 0; x <= W + 20; x += 20) { const y = base + Math.sin(x * 0.011 + T * 0.35 + k * 2) * amp + Math.sin(x * 0.023 - T * 0.2) * amp * 0.5; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    for (let x = W + 20; x >= 0; x -= 20) { const y = base + hh * 0.9 + Math.sin(x * 0.009 + T * 0.3 + k) * amp * 0.8; ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  // mountains
  peaks.forEach((layer, l) => {
    const hmax = yh * (l ? 0.22 : 0.3);
    ctx.fillStyle = l ? '#1d5a88' : '#16456f';
    ctx.beginPath(); ctx.moveTo(-10, yh);
    layer.forEach(p => ctx.lineTo(p.x * W, yh - p.h * hmax));
    ctx.lineTo(W + 10, yh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(235,248,255,.85)';
    layer.forEach(p => { const px = p.x * W, py = yh - p.h * hmax; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - hmax * 0.16 * p.h, py + hmax * 0.22 * p.h); ctx.lineTo(px - hmax * 0.05, py + hmax * 0.15 * p.h); ctx.lineTo(px + hmax * 0.04, py + hmax * 0.25 * p.h); ctx.lineTo(px + hmax * 0.16 * p.h, py + hmax * 0.2 * p.h); ctx.closePath(); ctx.fill(); });
  });
  // snow plain
  const gg = ctx.createLinearGradient(0, yh, 0, H);
  gg.addColorStop(0, '#a9dcee'); gg.addColorStop(1, '#e6f6fc');
  ctx.fillStyle = gg; ctx.fillRect(0, yh, W, H - yh);
}
function drawTree(t) {
  const b = pj(t.side * t.off, t.z), s = b.s, hh = 62 * t.h * s, ww = 30 * t.h * s;
  if (b.y > H + hh || b.x < -ww || b.x > W + ww) return;
  ctx.fillStyle = 'rgba(10,40,70,.18)'; ctx.beginPath(); ctx.ellipse(b.x + ww * 0.3, b.y, ww * 0.6, ww * 0.18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b3d2a'; ctx.fillRect(b.x - ww * 0.07, b.y - hh * 0.16, ww * 0.14, hh * 0.16);
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const yb = b.y - hh * (0.1 + i * 0.27), yt = yb - hh * 0.42, w = ww * (1 - i * 0.22) * 0.5;
    const gr = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0); gr.addColorStop(0, '#2c7a7e'); gr.addColorStop(1, '#14485a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(b.x, yt); ctx.lineTo(b.x + w, yb); ctx.lineTo(b.x - w, yb); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(245,252,255,.95)'; ctx.beginPath(); ctx.moveTo(b.x, yt); ctx.lineTo(b.x + w * 0.62, yt + (yb - yt) * 0.62); ctx.quadraticCurveTo(b.x + w * 0.2, yt + (yb - yt) * 0.46, b.x, yt + (yb - yt) * 0.55); ctx.quadraticCurveTo(b.x - w * 0.2, yt + (yb - yt) * 0.46, b.x - w * 0.62, yt + (yb - yt) * 0.62); ctx.closePath(); ctx.fill();
  }
}
function drawLane() {
  // snow banks
  for (const sd of [-1, 1]) {
    const xa = sd * 64, xb = sd * 260;
    strip(Math.min(xa, xb), Math.max(xa, xb), ZN, PIT);
    const f = pj(sd * 64, 0), g = pj(sd * 200, 0);
    const gr = ctx.createLinearGradient(f.x, 0, g.x, 0); gr.addColorStop(0, '#f4fcff'); gr.addColorStop(1, '#cfeaf6');
    ctx.fillStyle = gr; ctx.fill();
    strip(Math.min(sd * 64, sd * 74), Math.max(sd * 64, sd * 74), ZN, PIT); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
  }
  // gutters
  for (const sd of [-1, 1]) {
    strip(Math.min(sd * HALF, sd * 64), Math.max(sd * HALF, sd * 64), ZN, PIT + 10);
    const f = pj(sd * HALF, 0), g = pj(sd * 64, 0);
    const gr = ctx.createLinearGradient(f.x, 0, g.x, 0); gr.addColorStop(0, '#0f4066'); gr.addColorStop(1, '#2a87b0');
    ctx.fillStyle = gr; ctx.fill();
    ctx.fillStyle = 'rgba(190,240,255,.5)';
    for (let z = ZN; z < LL; z += 36) {
      const zz = z + ((T * 40) % 36); const q = pj(sd * 58, zz);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 6 * q.s * 0.5, 1.2 * q.s * 0.5, 0, 0, TAU); ctx.fill();
    }
  }
  // pit and back wall
  strip(-HALF, HALF, LL, PIT);
  const pa = pj(0, LL), pb = pj(0, PIT);
  const pg = ctx.createLinearGradient(0, pb.y, 0, pa.y); pg.addColorStop(0, '#020a16'); pg.addColorStop(1, '#0b2a4a');
  ctx.fillStyle = pg; ctx.fill();
  const wl = pj(-96, PIT), wr = pj(96, PIT), wh = 46 * wl.s;
  const wg = ctx.createLinearGradient(0, wl.y - wh, 0, wl.y); wg.addColorStop(0, '#d9f3ff'); wg.addColorStop(1, '#5aa6cc');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.rect(wl.x, wl.y - wh, wr.x - wl.x, wh); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(wl.x, wl.y - wh * i / 4); ctx.lineTo(wr.x, wl.y - wh * i / 4); ctx.stroke(); }
  ctx.fillStyle = '#0a2a4a'; ctx.fillRect(wl.x, wl.y - wh - 6 * wl.s, wr.x - wl.x, 6 * wl.s);
  // lane surface
  strip(-HALF, HALF, ZN, 0);
  ctx.fillStyle = '#e7f7fd'; ctx.fill();
  strip(-HALF, HALF, 0, LL);
  const ya = pj(0, 0).y, yb = pj(0, LL).y;
  const lg = ctx.createLinearGradient(0, ya, 0, yb); lg.addColorStop(0, '#fbfeff'); lg.addColorStop(0.5, '#e0f4fc'); lg.addColorStop(1, '#bfe6f5');
  ctx.fillStyle = lg; ctx.fill();
  // glare band
  ctx.save(); strip(-HALF, HALF, ZN, LL); ctx.clip();
  const gx = (Math.sin(T * 0.25) * 0.5 + 0.5) * W;
  const gl = ctx.createLinearGradient(gx - 90, 0, gx + 90, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  // boards
  ctx.strokeStyle = 'rgba(110,185,215,.28)'; ctx.lineWidth = 1;
  for (let x = -39; x <= 39; x += 13) { const a = pj(x, ZN), b = pj(x, LL); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // arrows
  ctx.fillStyle = 'rgba(60,150,195,.55)';
  for (let i = 0; i < 7; i++) {
    const x = -36 + i * 12, z = 150 + Math.abs(i - 3) * 9, a = pj(x, z + 22), l = pj(x - 4.5, z), r = pj(x + 4.5, z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(r.x, r.y); ctx.lineTo(l.x, l.y); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 7; i++) { const q = pj(-36 + i * 12, 42); ctx.beginPath(); ctx.arc(q.x, q.y, 1.8 * q.s, 0, TAU); ctx.fill(); }
  // slick patch
  if (slick) {
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU, q = pj(slick.x + Math.cos(a) * slick.w / 2 * (1 + 0.1 * Math.sin(a * 3)), slick.z + Math.sin(a) * slick.l / 2); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.closePath();
    const c = pj(slick.x, slick.z), sg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, slick.w * c.s * 0.7);
    sg.addColorStop(0, 'rgba(120,205,240,.7)'); sg.addColorStop(1, 'rgba(160,225,250,.45)');
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -T * 12; ctx.stroke(); ctx.setLineDash([]);
    // direction chevrons
    ctx.strokeStyle = 'rgba(40,130,180,.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      const q = pj(slick.x + k * slick.w * 0.28, slick.z), d = slick.dir * 5 * q.s;
      ctx.beginPath(); ctx.moveTo(q.x - d, q.y - 5 * q.s * 0.6); ctx.lineTo(q.x + d, q.y); ctx.lineTo(q.x - d, q.y + 5 * q.s * 0.6); ctx.stroke();
    }
  }
  ctx.restore();
  // lane edge lines
  for (const sd of [-1, 1]) { const a = pj(sd * HALF, ZN), b = pj(sd * HALF, LL); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // foul line
  strip(-HALF, HALF, -2.5, 1.5); ctx.fillStyle = '#ff8a3d'; ctx.fill();
}
function drawFish() {
  if (!fish || fish.taken) return;
  const q = pj(fish.x, fish.z), s = q.s * 0.5, bob = Math.sin(fish.t * 4) * 2 * s;
  ctx.save(); ctx.translate(q.x, q.y - 10 * s + bob);
  ctx.fillStyle = 'rgba(8,40,70,.25)'; ctx.beginPath(); ctx.ellipse(0, 12 * s - bob, 13 * s, 3 * s, 0, 0, TAU); ctx.fill();
  ctx.rotate(Math.sin(fish.t * 3) * 0.12);
  const g = ctx.createLinearGradient(0, -8 * s, 0, 8 * s); g.addColorStop(0, '#ffb35c'); g.addColorStop(1, '#ee6d1f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14 * s, 8 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(11 * s, 0); ctx.lineTo(22 * s, -9 * s); ctx.lineTo(22 * s, 9 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7 * s, -1.5 * s, 2.6 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b1a33'; ctx.beginPath(); ctx.arc(-7.6 * s, -1.5 * s, 1.3 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-1 * s, -4 * s, 7 * s, 2 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function pinPath() {
  ctx.beginPath(); ctx.moveTo(-5, 0);
  ctx.bezierCurveTo(-7.5, -9, -3.2, -14, -3.4, -19); ctx.bezierCurveTo(-5.2, -22, -3.6, -30, 0, -30);
  ctx.bezierCurveTo(3.6, -30, 5.2, -22, 3.4, -19); ctx.bezierCurveTo(3.2, -14, 7.5, -9, 5, 0); ctx.closePath();
}
function drawPin(p, mirror) {
  if (p.gone && p.alpha <= 0) return;
  const q = pj(p.x, p.z), s = q.s;
  let lift = 0;
  if (p.drop > 0) lift = p.drop * 130 * s;
  ctx.save();
  ctx.translate(q.x, q.y - lift);
  if (mirror) { ctx.scale(1, -0.45); ctx.globalAlpha = 0.2 * p.alpha; } else {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = 'rgba(8,40,70,.28)'; ctx.beginPath(); ctx.ellipse(0, 0.5 * s, 7 * s, 2.2 * s, 0, 0, TAU); ctx.fill();
  }
  ctx.rotate(p.tilt); ctx.scale(s, s);
  pinPath();
  const g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#e6f7ff'); g.addColorStop(1, '#8fcbe8');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); pinPath(); ctx.clip();
  ctx.fillStyle = '#e4455b'; ctx.fillRect(-8, -23.5, 16, 3); ctx.fillRect(-8, -16, 16, 2.2);
  if (p.charge > 0) { ctx.fillStyle = 'rgba(255,200,90,' + Math.min(0.7, p.charge) + ')'; ctx.fillRect(-8, -30, 16, 30); }
  ctx.restore();
  pinPath(); ctx.strokeStyle = '#3b97c0'; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.ellipse(-2, -11, 1.1, 5.5, 0.08, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawBall(b, held) {
  const q = pj(b.x, b.z), r = BALLR * q.s;
  const a = (b.fade == null ? 1 : b.fade);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,40,70,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1, r * 1.05, r * 0.36, 0, 0, TAU); ctx.fill();
  const cy = q.y - r * 0.85 + (b.gut ? r * 0.5 : 0);
  const gr = ctx.createRadialGradient(q.x - r * 0.35, cy - r * 0.4, r * 0.1, q.x, cy, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#e1f3fb'); gr.addColorStop(1, b.gut ? '#5b86a3' : '#8fc4de');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, cy, r, 0, TAU); ctx.fill();
  // dimples that rotate with distance
  ctx.save(); ctx.beginPath(); ctx.arc(q.x, cy, r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(100,170,205,.45)';
  for (let i = 0; i < 6; i++) {
    const ang = i * 1.05 + b.rot * 0.5, ph = (Math.sin(ang) + 1) / 2;
    const dx = Math.cos(ang * 1.3) * r * 0.55, dy = ((b.rot * 0.7 + i * 0.9) % 2 - 1) * r * 0.95;
    ctx.beginPath(); ctx.ellipse(q.x + dx, cy + dy, r * 0.13 * (0.5 + ph), r * 0.1 * (0.5 + ph), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(q.x - r * 0.35, cy - r * 0.45, r * 0.3, r * 0.17, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  void held;
}
function drawChar() {
  const p = mode === 'play' ? players[cur] : null;
  if (!p || phase === 'over') return;
  const q = pj(charX, -62), sc = 0.31 * q.s;
  let arm = 0, sx = 1, sy = 1, tilt = 0;
  if (phase === 'aim' && pullDrag) { const pw = clamp((pullDrag.y - pullDrag.y0) / (H * 0.2), 0, 1); tilt = -0.12 * pw; sy = 1 - 0.05 * pw; arm = -0.3 * pw; }
  if (throwT < 0.6) { const u = throwT / 0.6; arm = 1.1 * Math.sin(Math.min(1, u) * Math.PI * 0.9); tilt = 0.12 * Math.sin(Math.min(1, u * 1.4) * Math.PI); sy = 1 + 0.06 * Math.sin(u * Math.PI); }
  if (charMood === 'win') { const jump = Math.abs(Math.sin(T * 9)) * 14 * q.s * 0.4; C.draw(ctx, p.kind, q.x, q.y - jump, sc, { t: T, mood: 'win', arm: 0.9 + 0.5 * Math.sin(T * 12), shadow: true, lx: 0, ly: 0 }); return; }
  C.draw(ctx, p.kind, q.x, q.y, sc, { t: T, mood: charMood, arm, tilt, sx, sy, shadow: true, lx: clamp(-charX / 40, -1, 1) * -0.2, ly: -0.5, blink: Math.sin(T * 1.3) > 0.985 });
}
function drawParts() {
  for (const p of parts) {
    const u = p.life / p.max;
    if (p.t === 'conf') { ctx.save(); ctx.translate(p.sx, p.sy); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); continue; }
    const q = pj(p.x, p.z), s = q.s, y = q.y - p.h * s;
    if (p.t === 'puff') { ctx.fillStyle = `rgba(255,255,255,${u * 0.6})`; ctx.beginPath(); ctx.arc(q.x, y, p.size * s * (1.5 - u * 0.5), 0, TAU); ctx.fill(); }
    else if (p.t === 'shard') {
      ctx.save(); ctx.translate(q.x, y); ctx.rotate(p.rot); ctx.fillStyle = '#eefaff'; ctx.strokeStyle = '#7ed0ee'; ctx.lineWidth = 0.8; ctx.globalAlpha = Math.min(1, u * 2);
      ctx.beginPath(); ctx.moveTo(0, -p.size * s); ctx.lineTo(p.size * 0.7 * s, p.size * 0.8 * s); ctx.lineTo(-p.size * 0.7 * s, p.size * 0.6 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    } else if (p.t === 'text') {
      ctx.save(); ctx.globalAlpha = Math.min(1, u * 2.2); ctx.font = `700 ${Math.round(p.size * Math.max(0.95, U / 2.4))}px Fredoka, Nunito, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,30,56,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(p.text, q.x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, q.x, y); ctx.restore();
    }
  }
}
function drawAim() {
  if (phase !== 'aim' || !pullDrag) return;
  const { power, angle } = pullVals();
  const kind = players[cur].kind;
  const curve = +$('#slCurve').value / 100;
  const pts = simBall(startX, angle, curve, Math.max(0.12, power), kind, specialOn && players[cur].uses > 0, KINDS[kind].prev);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.setLineDash([1, 12]); ctx.lineDashOffset = -T * 30;
  const a = pj(pts[0].x, pts[0].z), e = pj(pts[pts.length - 1].x, pts[pts.length - 1].z);
  const g = ctx.createLinearGradient(a.x, a.y, e.x, e.y); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,170,90,.9)');
  ctx.strokeStyle = g; ctx.beginPath();
  pts.forEach((p, i) => { const q = pj(p.x, p.z); i ? ctx.lineTo(q.x, q.y - 4) : ctx.moveTo(q.x, q.y - 4); });
  ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,200,120,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, e.y, 11 * e.s * 0.5, 5 * e.s * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  // pull handle
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(pullDrag.x0, pullDrag.y0); ctx.lineTo(pullDrag.x, pullDrag.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(pullDrag.x0, pullDrag.y0, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(pullDrag.x, pullDrag.y, 10, 0, TAU); ctx.fill(); ctx.restore();
}
function drawSnow() {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const f of flakes) {
    f.y += f.v * 0.016; if (f.y > 1.02) { f.y = -0.02; f.x = rnd(1); }
    ctx.globalAlpha = 0.3 + f.s * 0.12; ctx.beginPath(); ctx.arc((f.x + Math.sin(T * 0.6 + f.ph) * 0.02) * W, f.y * H, f.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
  ctx.save(); ctx.translate(shx, shy);
  drawBackdrop();
  for (const t of trees) drawTree(t);
  drawLane();
  drawFish();
  // pin reflections (clipped to the lane)
  ctx.save(); strip(-HALF, HALF, 0, LL); ctx.clip();
  pins.slice().sort((a, b) => b.z - a.z).forEach(p => { if (p.z < LL) drawPin(p, true); });
  ctx.restore();
  // pins and ball in depth order
  const items = pins.map(p => ({ z: p.z, f: () => drawPin(p, false) }));
  if (ball) items.push({ z: ball.z, f: () => drawBall(ball) });
  items.sort((a, b) => b.z - a.z);
  items.forEach(i => i.f());
  if (mode === 'play') {
    drawChar();
    if (phase === 'aim' || phase === 'ai') drawBall({ x: charX, z: 8, rot: 0, gut: false, fade: 1 });
  }
  drawParts();
  drawAim();
  ctx.restore();
  drawSnow();
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.85);
  v.addColorStop(0, 'rgba(0,10,30,0)'); v.addColorStop(1, 'rgba(0,10,30,.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (flashWhite > 0) { ctx.fillStyle = `rgba(255,255,255,${flashWhite})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- HUD & UI ---------- */
const el = { hFrame: $('#hFrame'), hTurn: $('#hTurn'), sb: $('#sb'), hint: $('#hint'), pwFill: $('#pwFill'), abil: $('#abil'), abilName: $('#abilName'), abilSub: $('#abilSub'),
  banner: $('#banner'), toast: $('#toast'), slPos: $('#slPos'), slCurve: $('#slCurve'), curveVal: $('#curveVal') };
let specialOn = false;
function setHint(t) { el.hint.textContent = t; }
function setPower(p) { el.pwFill.style.width = Math.round(p * 100) + '%'; }
function banner(main, sub) {
  el.banner.className = 'banner';
  el.banner.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
  void el.banner.offsetWidth; el.banner.classList.add('pop');
}
function toast(msg) { el.toast.textContent = msg; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 1600); }
function updateCurveLabel() {
  const v = +el.slCurve.value;
  el.curveVal.textContent = Math.abs(v) < 6 ? 'Straight' : (v < 0 ? 'Left ' : 'Right ') + Math.abs(v) + '%';
}
function setSpecial(on) { specialOn = on; updateHud(); }
function buildScoreboard() {
  el.sb.innerHTML = players.map((p, i) => {
    const cells = Array.from({ length: 10 }, (_, f) => `<div class="sb-cell" id="c${i}_${f}"><span class="m"></span><span class="t"></span></div>`).join('');
    return `<div class="sb-row" id="row${i}"><div class="sb-name"><span class="dot" style="background:${COLORS[p.kind]}"></span>${p.human ? 'You' : p.name}</div><div class="sb-cells">${cells}</div><div class="sb-tot" id="tot${i}">0</div></div>`;
  }).join('');
}
function updateScoreboard() {
  if (mode !== 'play') return;
  players.forEach((p, i) => {
    const r = calc(p.rolls);
    r.cells.forEach((c, f) => {
      const cell = document.getElementById(`c${i}_${f}`); if (!cell) return;
      cell.querySelector('.m').textContent = c.m.join(' ');
      cell.querySelector('.t').textContent = c.t === null ? '' : c.t;
      cell.classList.toggle('now', i === cur && f === frame && phase !== 'over');
    });
    document.getElementById('tot' + i).textContent = r.total;
    document.getElementById('row' + i).classList.toggle('cur', i === cur);
  });
}
function updateHud() {
  if (mode !== 'play') return;
  const p = players[cur];
  el.hFrame.textContent = 'Frame ' + Math.min(frame + 1, 10) + ' of 10';
  el.hTurn.textContent = p.human ? 'Your turn' : p.name + "'s turn";
  const human = p.human && (phase === 'aim');
  el.slPos.disabled = !human; el.slCurve.disabled = !human;
  const me = players[0];
  el.abilName.textContent = KINDS[me.kind].sp;
  el.abilSub.textContent = specialOn && p.human ? 'Armed!' : (me.uses > 0 ? me.uses + ' left' : 'Used up');
  el.abil.classList.toggle('armed', specialOn && p.human);
  el.abil.classList.toggle('off', me.uses <= 0 || !human);
}
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  if (id) $('#' + id).classList.add('show');
}

/* ---------- input ---------- */
function pullVals() {
  const dy = Math.max(0, pullDrag.y - pullDrag.y0), dx = pullDrag.x - pullDrag.x0;
  return { power: clamp(dy / (H * 0.2), 0, 1), angle: clamp(-dx / (W * 0.35), -1, 1) * 0.14 };
}
cv.addEventListener('pointerdown', ev => {
  Snd.init();
  if (mode !== 'play' || phase !== 'aim' || !players[cur].human) return;
  pullDrag = { x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  ev.preventDefault();
});
cv.addEventListener('pointermove', ev => {
  if (pullDrag && ev.pointerId === pullDrag.id) { pullDrag.x = ev.clientX; pullDrag.y = ev.clientY; setPower(pullVals().power); }
});
function endPull(ev, fire) {
  if (!pullDrag || (ev && ev.pointerId !== pullDrag.id)) return;
  const { power, angle } = pullVals(); pullDrag = null; setPower(0);
  if (!fire || phase !== 'aim' || mode !== 'play') return;
  if (power < 0.14) { toast('Pull back further to roll'); return; }
  const me = players[cur];
  rollBall(startX, angle, +el.slCurve.value / 100, power, specialOn && me.uses > 0);
}
cv.addEventListener('pointerup', ev => endPull(ev, true));
cv.addEventListener('pointercancel', ev => endPull(ev, false));
cv.addEventListener('contextmenu', e => e.preventDefault());
el.slCurve.addEventListener('input', updateCurveLabel);
el.abil.addEventListener('click', () => {
  Snd.init();
  if (mode !== 'play' || phase !== 'aim') return;
  const me = players[0];
  if (me.uses <= 0) { toast('No special rolls left'); return; }
  setSpecial(!specialOn); Snd.click();
  setHint(specialOn ? KINDS[me.kind].sp + ' is armed for your next roll' : 'Drag back from the ball, then let go to roll');
});
window.addEventListener('keydown', ev => {
  if (ev.code === 'Escape' || ev.code === 'KeyP') togglePause();
});
function togglePause() {
  if (mode !== 'play') return;
  if (phase === 'paused') { phase = prevPhase; show(null); }
  else if (phase !== 'over' && phase !== 'idle') { prevPhase = phase; phase = 'paused'; pullDrag = null; show('pause'); }
}

$('#btnPlay').addEventListener('click', () => { Snd.init(); Snd.click(); buildSelect(); show('select'); });
$('#btnBack').addEventListener('click', () => { Snd.click(); show('title'); });
$('#btnHow').addEventListener('click', () => { Snd.init(); Snd.click(); $('#how').classList.add('open'); });
$('#howClose').addEventListener('click', () => $('#how').classList.remove('open'));
$('#how').addEventListener('click', e => { if (e.target.id === 'how') $('#how').classList.remove('open'); });
$('#btnPause').addEventListener('click', () => togglePause());
$('#btnResume').addEventListener('click', () => togglePause());
$('#btnQuit').addEventListener('click', () => { quitToMenu(); show('title'); });
$('#btnAgain').addEventListener('click', () => { Snd.click(); show(null); startMatch(humanKind); });
$('#btnChange').addEventListener('click', () => { Snd.click(); quitToMenu(); buildSelect(); show('select'); });
$('#btnMute').addEventListener('click', () => { Snd.on = !Snd.on; $('#btnMute').classList.toggle('off', !Snd.on); if (Snd.on) Snd.click(); });
function quitToMenu() {
  phase = 'idle'; mode = 'menu'; $('#hud').classList.remove('show'); parts = parts.filter(p => p.t !== 'conf'); layoutLane(); newEnv(); newRack(); demoThrow();
}
function buildSelect() {
  const wrap = $('#cards');
  wrap.innerHTML = C.KINDS.map(k => {
    const i = C.INFO[k];
    const bar = (label, v) => `<div class="stat"><span>${label}</span><i><b style="width:${v * 20}%"></b></i></div>`;
    return `<button class="card" data-k="${k}" type="button"><canvas></canvas><div class="nm">${i.name}</div><div class="tg">${KINDS[k].sp}</div>${bar('Power', i.weight)}${bar('Curve', k === 'seal' ? 5 : k === 'bear' ? 2 : k === 'penguin' ? 1 : 3)}${bar('Aim', k === 'penguin' ? 5 : k === 'orca' ? 3 : k === 'bear' ? 3 : 2)}</button>`;
  }).join('');
  requestAnimationFrame(() => wrap.querySelectorAll('.card').forEach(c => C.portrait(c.querySelector('canvas'), c.dataset.k)));
  wrap.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => { Snd.init(); Snd.click(); show(null); startMatch(c.dataset.k); }));
}

/* ---------- boot ---------- */
Install.mount('.install-btn');
Install.registerSW();
resize();
newEnv(); newRack(); demoThrow();

let last = performance.now(), perfAcc = 0, perfN = 0;
function frameLoop(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw); last = now;
  if (raw < 0.5) { perfAcc += raw; perfN++; }
  if (perfN >= 45) {
    if (perfAcc / perfN > 0.026 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); resize(); }
    perfAcc = 0; perfN = 0;
  }
  update(dt);
  render();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

window.__lanes = { get phase() { return phase; }, get mode() { return mode; }, get players() { return players; }, startMatch, step: update, calc, get pins() { return pins; }, get frame() { return frame; }, rollBall, get startX() { return startX; } };
})();
