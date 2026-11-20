/* Polar Opposite - a mirror puzzle. Bear and penguin always move in opposite directions. */
(function () {
  'use strict';
  Kit.ns('polar-opposite');
  const $ = Kit.$;
  const S = Kit.setup($('game'));
  const ctx = S.ctx;
  const LV = window.LEVELS;
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  /* ---------------- level model ---------------- */
  let W, H, u, tile, bx0, by0;
  let L, R, C, grid, bear, peng, gb, gp, hist, moves, par, li = 0, mode = 'title', t = 0, anim = null, queued = null, parts = [], shake = 0, hintDir = null, hintT = 0, fast = false;

  function load(i) {
    li = i; L = LV[i]; R = L.rows.length; C = L.rows[0].length; par = L.par;
    grid = []; hist = []; moves = 0; anim = null; queued = null; parts = []; hintDir = null;
    for (let y = 0; y < R; y++) {
      grid.push([]);
      for (let x = 0; x < C; x++) {
        const ch = L.rows[y][x]; let c = '.';
        if (ch === '#' || ch === 'o') c = ch;
        else if (ch === 'B') bear = [x, y]; else if (ch === 'P') peng = [x, y];
        else if (ch === 'b') gb = [x, y]; else if (ch === 'p') gp = [x, y];
        grid[y].push(c);
      }
    }
    layout();
    syncUI();
  }
  function cellAt(x, y) { if (x < 0 || y < 0 || x >= C || y >= R) return '#'; return grid[y][x]; }
  function stepPos(pos, dx, dy) {
    const nx = pos[0] + dx, ny = pos[1] + dy, c = cellAt(nx, ny);
    if (c === '#') return { pos, moved: false, water: false };
    if (c === 'o') return { pos: [nx, ny], moved: true, water: true };
    return { pos: [nx, ny], moved: true, water: false };
  }
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];

  /* shortest solution from current state (for hints) */
  function solveFrom(b0, p0) {
    const key = (b, p) => b[0] + ',' + b[1] + ',' + p[0] + ',' + p[1];
    const seen = new Map(); seen.set(key(b0, p0), null);
    const q = [[b0, p0]];
    for (let qi = 0; qi < q.length; qi++) {
      const [b, p] = q[qi];
      if (eq(b, gb) && eq(p, gp)) {
        let k = key(b, p), first = null;
        while (seen.get(k)) { const s = seen.get(k); first = s.m; k = s.from; }
        return first;
      }
      for (const m in DIRS) {
        const d = DIRS[m], rb = stepPos(b, d[0], d[1]), rp = stepPos(p, -d[0], -d[1]);
        if (rb.water || rp.water || (!rb.moved && !rp.moved)) continue;
        const nk = key(rb.pos, rp.pos);
        if (seen.has(nk)) continue;
        seen.set(nk, { from: key(b, p), m }); q.push([rb.pos, rp.pos]);
      }
    }
    return null;
  }

  /* ---------------- moves ---------------- */
  function tryMove(m) {
    if (mode !== 'play' || anim) { if (anim && !queued) queued = m; return false; }
    const d = DIRS[m], rb = stepPos(bear, d[0], d[1]), rp = stepPos(peng, -d[0], -d[1]);
    if (!rb.moved && !rp.moved) { shake = 0.25; Kit.tone(140, 0.08, 'square', 0.08); return false; }
    hintDir = null;
    const from = { b: bear.slice(), p: peng.slice() };
    const wet = rb.water || rp.water;
    anim = { k: 0, dur: wet ? 0.36 : 0.13, from, to: { b: rb.pos, p: rp.pos }, wetB: rb.water, wetP: rp.water, wet, d: m };
    if (fast) { finishAnim(); return true; }
    Kit.tone(wet ? 200 : 520, 0.07, 'sine', 0.1, wet ? -80 : 80);
    return true;
  }
  function finishAnim() {
    const a = anim; anim = null; if (!a) return;
    if (a.wet) {
      splash(a.wetB ? a.to.b : a.to.p);
      Kit.noise(0.3, 0.2, null, 700); Kit.tone(170, 0.3, 'sine', 0.2, -90); Kit.vibe(40); shake = 0.6;
      Kit.toast('Splash! Back to safety'); return;
    }
    hist.push({ b: bear.slice(), p: peng.slice() }); moves++;
    bear = a.to.b; peng = a.to.p; syncUI();
    if (eq(bear, gb) && eq(peng, gp)) return win();
    if (queued) { const q = queued; queued = null; tryMove(q); }
  }
  function undo() {
    if (mode !== 'play' || anim || !hist.length) return;
    const h = hist.pop(); bear = h.b; peng = h.p; moves--; hintDir = null; syncUI(); Kit.tone(330, 0.08, 'triangle', 0.1, -60);
  }
  function restart() { if (mode === 'play' || mode === 'pause') { const i = li; mode = 'play'; load(i); Kit.hideScreens(); $('hud').classList.add('show'); } }
  function hint() {
    if (mode !== 'play' || anim) return;
    const m = solveFrom(bear, peng);
    if (!m) { Kit.toast('Stuck? Try Undo or Restart'); return; }
    hintDir = m; hintT = 1.6;
    Kit.toast('Try ' + { U: 'up', D: 'down', L: 'left', R: 'right' }[m]);
  }

  function win() {
    mode = 'won';
    const stars = moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1;
    const saved = Kit.get('stars', []); if (!saved[li] || saved[li] < stars) { saved[li] = stars; Kit.set('stars', saved); }
    Kit.tone(523, 0.15, 'triangle', 0.2); Kit.tone(659, 0.15, 'triangle', 0.2, 0, Kit.ac() ? Kit.ac().currentTime + 0.12 : 0); Kit.tone(784, 0.35, 'triangle', 0.22, 0, Kit.ac() ? Kit.ac().currentTime + 0.24 : 0);
    Kit.vibe(30);
    for (let i = 0; i < 50; i++) parts.push({ x: S.W / 2 + rnd(-40, 40), y: S.H * 0.4, vx: rnd(-260, 260), vy: rnd(-420, -60), life: rnd(0.8, 1.5), age: 0, c: ['#ff8a3d', '#5ec8e5', '#ffd45e', '#fff', '#ff6f9c'][i % 5], r: rnd(3, 6), g: 600 });
    winStars = stars;
    if (fast) return;
    setTimeout(() => { if (mode === 'won') showWin(); }, 900);
  }
  let winStars = 0;
  function showWin() {
    $('hud').classList.remove('show');
    const last = li === LV.length - 1;
    $('resTitle').textContent = last ? 'All levels cleared!' : 'Level ' + (li + 1) + ' cleared!';
    const row = (a, b, h) => '<div class="row' + (h ? ' hi' : '') + '"><span>' + a + '</span><b>' + b + '</b></div>';
    $('resStats').innerHTML = row('Stars', '★'.repeat(winStars) + '☆'.repeat(3 - winStars), true) + row('Moves', moves + ' (par ' + par + ')');
    $('btnAgain').textContent = last ? 'Replay level' : 'Next level';
    $('btnMenu').textContent = 'Levels';
    const c = $('resPortrait'), w = c.clientWidth || 150, h = c.clientHeight || 140, dpr = Math.min(2, devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    Chars.draw(g, 'bear', w * 0.3, h - 10, 0.82, { mood: 'win', shadow: true, idle: false });
    Chars.draw(g, 'penguin', w * 0.72, h - 10, 0.8, { mood: 'win', shadow: true, idle: false });
    Kit.show('over');
  }

  function splash(pos) {
    const x = bx0 + (pos[0] + 0.5) * tile, y = by0 + (pos[1] + 0.5) * tile;
    for (let i = 0; i < 14; i++) parts.push({ x, y, vx: rnd(-120, 120), vy: rnd(-260, -80), life: rnd(0.4, 0.7), age: 0, c: '#bfeaff', r: rnd(2, 4), g: 700 });
  }

  /* ---------------- UI ---------------- */
  function syncUI() {
    $('hudL').textContent = 'Lv ' + (li + 1);
    $('hudC').textContent = moves + (moves === 1 ? ' move' : ' moves');
    $('hudR').textContent = 'Par ' + par;
    $('btnUndo').disabled = !hist.length;
  }
  function layout() {
    W = S.W; H = S.H; u = Math.min(W / 390, H / 720);
    if (!L) return;
    const availW = W - 24, availH = H - 80 - 220 * Math.min(1, H / 700) - 24;
    tile = Math.floor(Math.min(availW / C, availH / R, 76 * u));
    bx0 = Math.round((W - C * tile) / 2); by0 = Math.round(72 + (availH - R * tile) / 2 + 14);
  }
  S.onresize = layout;

  function openLevels() {
    mode = 'title';
    const saved = Kit.get('stars', []), done = saved.filter(x => x).length;
    const grid = $('lvgrid'); grid.innerHTML = '';
    LV.forEach((l, i) => {
      const b = document.createElement('button'); b.type = 'button';
      const open = i <= done;
      b.className = 'lv' + (open ? '' : ' locked');
      b.innerHTML = (i + 1) + '<small>' + (saved[i] ? '★'.repeat(saved[i]) : open ? '' : '\u{1F512}') + '</small>';
      b.addEventListener('click', () => start(i));
      grid.appendChild(b);
    });
    Kit.show('levels');
  }
  function start(i) {
    mode = 'play'; load(i); Kit.hideScreens(); $('hud').classList.add('show'); Kit.ac();
  }
  function pause() { if (mode !== 'play') return; mode = 'pause'; Kit.show('pause'); }
  function resume() { if (mode === 'pause') { mode = 'play'; Kit.hideScreens(); } }
  function toMenu() { $('hud').classList.remove('show'); openLevels(); }

  Kit.wire({ onPause: pause, onResume: resume, onQuit: toMenu });
  $('btnPlay').addEventListener('click', () => { Kit.ac(); openLevels(); });
  $('btnLvBack').addEventListener('click', () => { mode = 'title'; Kit.show('title'); });
  $('btnAgain').addEventListener('click', () => start(li === LV.length - 1 ? li : li + 1));
  $('btnMenu').addEventListener('click', toMenu);
  $('btnRestart').addEventListener('click', () => { mode = 'play'; start(li); });
  $('btnUndo').addEventListener('click', undo);
  $('btnReset').addEventListener('click', () => start(li));
  $('btnHint').addEventListener('click', hint);
  document.querySelectorAll('#dpad button').forEach(b => b.addEventListener('click', () => tryMove(b.dataset.d)));
  addEventListener('keydown', e => {
    const m = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R' }[e.key];
    if (m) { e.preventDefault(); tryMove(m); } else if (e.key === 'z' || e.key === 'u') undo(); else if (e.key === 'r') restart();
  });
  let sx = 0, sy = 0, sid = null;
  S.canvas.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; });
  S.canvas.addEventListener('pointerup', e => {
    if (e.pointerId !== sid) return; sid = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  });

  /* ---------------- rendering ---------------- */
  function hash(x, y) { return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1; }
  function background(tt) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#103f73'); g.addColorStop(1, '#0a2547'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 40; i++) { const x = (i * 97.3 + tt * (6 + i % 5)) % (W + 20) - 10, y = (i * 53.7 + tt * (14 + i % 7)) % (H + 20) - 10; ctx.globalAlpha = 0.3 + (i % 4) * 0.12; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3), 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function paw(x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.18, s * 0.4, s * 0.32, 0, 0, 6.3); ctx.fill();
    [[-0.42, -0.22], [-0.15, -0.46], [0.15, -0.46], [0.42, -0.22]].forEach(o => { ctx.beginPath(); ctx.ellipse(x + o[0] * s, y + o[1] * s, s * 0.14, s * 0.18, 0, 0, 6.3); ctx.fill(); });
  }
  function foot(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + s * 0.05, s * 0.5, s * 0.72, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.2, s * 0.3, s * 0.48, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x - s * 0.12, y - s * 0.28); ctx.lineTo(x + s * 0.12, y - s * 0.28); ctx.lineTo(x, y - s * 0.1); ctx.closePath(); ctx.fill();
  }
  function drawBoard(tt) {
    const pad = 10 * u;
    /* frame */
    ctx.fillStyle = 'rgba(0,10,30,.35)'; ctx.beginPath(); ctx.roundRect(bx0 - pad + 3, by0 - pad + 8, C * tile + pad * 2, R * tile + pad * 2, 18); ctx.fill();
    ctx.fillStyle = '#3b82b3'; ctx.beginPath(); ctx.roundRect(bx0 - pad, by0 - pad, C * tile + pad * 2, R * tile + pad * 2, 18); ctx.fill();
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const px = bx0 + x * tile, py = by0 + y * tile, c = grid[y][x];
      if (c === 'o') {
        ctx.fillStyle = '#1b6fb0'; ctx.fillRect(px, py, tile, tile);
        ctx.strokeStyle = 'rgba(190,235,255,.55)'; ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) { ctx.beginPath(); const yy = py + tile * (0.32 + k * 0.38); ctx.moveTo(px + 4, yy); for (let s = 0; s <= 8; s++) ctx.lineTo(px + 4 + s * (tile - 8) / 8, yy + Math.sin(tt * 2.5 + s * 0.9 + x + y + k) * 2.4); ctx.stroke(); }
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#e6f8ff' : '#d3f0fb'; ctx.fillRect(px, py, tile, tile);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(px + 2, py + 2, tile * 0.4, 3);
      }
    }
    /* goals */
    const pulse = 0.5 + 0.5 * Math.sin(tt * 3);
    [[gb, '#ff8a3d', true], [gp, '#1fb5d6', false]].forEach(g => {
      const cx = bx0 + (g[0][0] + 0.5) * tile, cy = by0 + (g[0][1] + 0.5) * tile;
      ctx.fillStyle = g[1]; ctx.globalAlpha = 0.18 + 0.12 * pulse; ctx.beginPath(); ctx.arc(cx, cy, tile * 0.46, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = g[1]; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -tt * 14; ctx.beginPath(); ctx.arc(cx, cy, tile * 0.4, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.85; if (g[2]) paw(cx, cy + 2, tile * 0.3, g[1]); else foot(cx, cy, tile * 0.3, g[1]); ctx.globalAlpha = 1;
    });
    /* walls */
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      if (grid[y][x] !== '#') continue;
      const px = bx0 + x * tile, py = by0 + y * tile, h = hash(x, y), r = tile * 0.16;
      ctx.fillStyle = 'rgba(0,30,60,.3)'; ctx.beginPath(); ctx.roundRect(px + 3, py + tile * 0.16, tile - 2, tile * 0.82, r); ctx.fill();
      ctx.fillStyle = '#8fc9e6'; ctx.beginPath(); ctx.roundRect(px + 1, py + tile * 0.12, tile - 2, tile * 0.82, r); ctx.fill();
      const g = ctx.createLinearGradient(0, py, 0, py + tile * 0.8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cdeefa');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(px + 1, py + 1, tile - 2, tile * 0.78, r); ctx.fill();
      ctx.fillStyle = 'rgba(120,190,225,.55)'; ctx.beginPath(); ctx.ellipse(px + tile * (0.3 + h * 0.4), py + tile * 0.4, tile * 0.1, tile * 0.05, 0.3, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px + tile * 0.3, py + tile * 0.17, tile * 0.16, tile * 0.05, -0.3, 0, 6.3); ctx.fill();
    }
  }
  function pos(a, who, k) {
    if (!a) return who === 'b' ? bear : peng;
    const f = a.from[who], to = a.to[who];
    return [f[0] + (to[0] - f[0]) * k, f[1] + (to[1] - f[1]) * k];
  }
  function drawChars(tt) {
    const k = anim ? ease(Math.min(1, anim.k / anim.dur)) : 0;
    const who = [['bear', 'b', gb, 'win'], ['penguin', 'p', gp, 'win']];
    const list = who.map(w => ({ kind: w[0], key: w[1], p: pos(anim, w[1], anim && anim.wet && ((w[1] === 'b' && anim.wetB) || (w[1] === 'p' && anim.wetP)) ? Math.min(k, 1) * 0.9 : k), goal: w[2] }));
    list.sort((a, b) => a.p[1] - b.p[1]);
    list.forEach(c => {
      let cx = bx0 + (c.p[0] + 0.5) * tile, cy = by0 + (c.p[1] + 0.5) * tile + tile * 0.3;
      const s = tile / 104;
      const atGoal = (c.key === 'b' ? eq(bear, gb) : eq(peng, gp)) && !anim;
      let sc = s, al = 1, tilt = 0, hop = 0;
      if (anim) { hop = Math.sin(k * Math.PI) * tile * 0.12; tilt = Math.sin(k * Math.PI) * 0.12 * (anim.d === 'L' ? -1 : 1) * (c.key === 'b' ? 1 : -1); }
      if (anim && anim.wet && ((c.key === 'b' && anim.wetB) || (c.key === 'p' && anim.wetP))) { sc = s * (1 - 0.85 * Math.min(1, k * 1.1)); al = 1 - Math.min(1, k * 1.1); }
      ctx.fillStyle = 'rgba(0,30,60,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 1, tile * 0.32 * (al), tile * 0.09, 0, 0, 6.3); ctx.fill();
      Chars.draw(ctx, c.kind, cx, cy - hop, sc, { t: tt + (c.key === 'p' ? 1.3 : 0), alpha: al, mood: mode === 'won' || atGoal ? 'win' : 'neutral', tilt, idle: true, moving: anim ? 1 : 0 });
    });
    /* tiny mirror hint arrows above heads */
  }
  function render(dt) {
    t += 0; ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    background(t);
    if (!L || mode === 'title') return;
    ctx.save();
    if (shake > 0) { ctx.translate(rnd(-1, 1) * shake * 6, rnd(-1, 1) * shake * 4); shake = Math.max(0, shake - dt * 2.5); }
    drawBoard(t); drawChars(t);
    ctx.restore();
    parts.forEach(p => { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.r, p.r * 1.6); }); ctx.globalAlpha = 1;
  }
  function update(dt) {
    if (anim) { anim.k += dt; if (anim.k >= anim.dur) finishAnim(); }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintDir = null; }
    document.querySelectorAll('#dpad button').forEach(b => b.classList.toggle('hint', !!hintDir && b.dataset.d === hintDir));
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age > p.life) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 500) * dt; }
  }

  /* title art: bear and penguin facing off */
  const ta = $('titleArt');
  function drawTitleArt() {
    if (!$('title').classList.contains('show')) return;
    const w = ta.clientWidth, h = ta.clientHeight; if (!w) return;
    if (ta.width !== Math.round(w * S.dpr)) { ta.width = Math.round(w * S.dpr); ta.height = Math.round(h * S.dpr); }
    const c = ta.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const sc = Math.min(w / 260, h / 150), sw = Math.sin(t * 1.6) * 16 * sc;
    c.fillStyle = 'rgba(0,30,60,.3)'; c.beginPath(); c.ellipse(w / 2, h - 8, 120 * sc, 9 * sc, 0, 0, 6.3); c.fill();
    Chars.draw(c, 'bear', w * 0.3 + sw, h - 8, 0.95 * sc, { t, idle: false, moving: 0.4, shadow: false });
    Chars.draw(c, 'penguin', w * 0.7 - sw, h - 8, 0.95 * sc, { t, idle: false, moving: 0.4, flip: true, shadow: false });
  }

  load(0); mode = 'title';
  Kit.loop((dt, tt) => { t = tt; S.watch(dt); if (mode !== 'pause') update(dt); render(dt); drawTitleArt(); });

  window.__polar = { LV, load: i => { mode = 'play'; load(i); }, move: tryMove, solveFrom, setFast(v) { fast = v; }, get state() { return { mode, moves, par, bear, peng, gb, gp, li }; } };
})();
