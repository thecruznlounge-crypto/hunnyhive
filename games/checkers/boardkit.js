/* BoardKit - 8x8 canvas board view shared by Chess and Checkers. */
(function (global) {
  'use strict';
  function create(T, opts) {
    const K = T.K, stage = T.stage, N = 8;
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;z-index:30;touch-action:none;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.6),0 0 0 4px #3a1f0b,0 0 0 6px #c9a227'; stage.appendChild(cv);
    const ctx = cv.getContext('2d');
    const V = { cv, flip: false, size: 0, cell: 0, hl: {}, pieceAt: () => null, drawPiece: null, anim: null, onTap: null, light: '#efd9b0', dark: '#a8703f', label: true };
    V.layout = function () {
      const f = T.G.f, s = Math.floor(Math.min(f.h - 18, f.w - 150)), dpr = Math.min(2, global.devicePixelRatio || 1);
      V.size = s; V.cell = s / N; cv.style.left = Math.round(f.x + f.w / 2 - s / 2) + 'px'; cv.style.top = Math.round(f.y + f.h / 2 - s / 2) + 'px'; cv.style.width = s + 'px'; cv.style.height = s + 'px';
      cv.width = Math.round(s * dpr); cv.height = Math.round(s * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); V.render();
    };
    const xy = sq => { let r = Math.floor(sq / 8), c = sq % 8; if (V.flip) { r = 7 - r; c = 7 - c; } return { x: c * V.cell, y: r * V.cell }; };
    V.center = sq => { const p = xy(sq); return { x: p.x + V.cell / 2, y: p.y + V.cell / 2 }; };
    V.sqAt = (px, py) => { let c = Math.floor(px / V.cell), r = Math.floor(py / V.cell); if (c < 0 || r < 0 || c > 7 || r > 7) return -1; if (V.flip) { r = 7 - r; c = 7 - c; } return r * 8 + c; };
    V.render = function () {
      const cs = V.cell; ctx.clearRect(0, 0, V.size, V.size);
      for (let sq = 0; sq < 64; sq++) {
        const p = xy(sq), r = Math.floor(sq / 8), c = sq % 8, dark = (r + c) % 2 === 1;
        ctx.fillStyle = dark ? V.dark : V.light; ctx.fillRect(p.x, p.y, cs, cs);
        const h = V.hl[sq];
        if (h === 'last') { ctx.fillStyle = 'rgba(255,220,80,.38)'; ctx.fillRect(p.x, p.y, cs, cs); }
        if (h === 'sel') { ctx.fillStyle = 'rgba(80,200,120,.5)'; ctx.fillRect(p.x, p.y, cs, cs); }
        if (h === 'check') { const g = ctx.createRadialGradient(p.x + cs / 2, p.y + cs / 2, 2, p.x + cs / 2, p.y + cs / 2, cs * .7); g.addColorStop(0, 'rgba(255,40,40,.9)'); g.addColorStop(1, 'rgba(255,40,40,0)'); ctx.fillStyle = g; ctx.fillRect(p.x, p.y, cs, cs); }
        if (h === 'hint') { ctx.fillStyle = 'rgba(80,160,255,.5)'; ctx.fillRect(p.x, p.y, cs, cs); }
        if (V.label) { ctx.font = '700 ' + Math.max(8, cs * .17) + 'px system-ui,sans-serif'; ctx.fillStyle = dark ? 'rgba(255,240,210,.8)' : 'rgba(110,60,20,.85)'; const lc = V.flip ? 7 - c : c, lr = V.flip ? 7 - r : r; if (lc === 0) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(8 - r), p.x + 2, p.y + 1); } if (lr === 7) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('abcdefgh'[c], p.x + cs - 2, p.y + cs - 1); } }
      }
      for (let sq = 0; sq < 64; sq++) { if (V.anim && V.anim.to === sq) continue; const pc = V.pieceAt(sq); if (pc) { const q = V.center(sq); V.drawPiece(ctx, pc, q.x, q.y, cs); } }
      for (let sq = 0; sq < 64; sq++) {
        const h = V.hl[sq]; if (h !== 'move' && h !== 'cap') continue; const q = V.center(sq);
        ctx.beginPath(); if (h === 'move') { ctx.fillStyle = 'rgba(30,110,60,.55)'; ctx.arc(q.x, q.y, cs * .15, 0, 7); ctx.fill(); } else { ctx.strokeStyle = 'rgba(200,40,40,.8)'; ctx.lineWidth = cs * .09; ctx.arc(q.x, q.y, cs * .44, 0, 7); ctx.stroke(); }
      }
      if (V.anim) { const a = V.anim; V.drawPiece(ctx, a.piece, a.x, a.y, cs); }
    };
    V.animate = function (from, to, piece, dur, via) {
      return new Promise(res => {
        const pts = [V.center(from)].concat((via || []).map(V.center)).concat([V.center(to)]); const t0 = performance.now(), D = Math.max(1, dur * T.SP);
        const step = now => {
          const k = Math.max(0, Math.min(1, (now - t0) / D)), seg = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1))), kk = k * (pts.length - 1) - seg, e = kk < .5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2, a = pts[seg], b = pts[seg + 1];
          V.anim = { to, piece, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; V.render();
          if (k < 1) requestAnimationFrame(step); else { V.anim = null; V.render(); res(); }
        }; requestAnimationFrame(step);
      });
    };
    const tap = e => { const r = cv.getBoundingClientRect(), sc = stage.getBoundingClientRect(); /* handle rotated stage */ const rot = getComputedStyle(stage).transform !== 'none' && innerHeight > innerWidth; let px, py; if (rot) { px = e.clientY - r.top; py = r.right - e.clientX; px = px * (V.size / r.height); py = py * (V.size / r.width); } else { px = (e.clientX - r.left) * V.size / r.width; py = (e.clientY - r.top) * V.size / r.height; } const sq = V.sqAt(px, py); if (sq >= 0 && V.onTap) V.onTap(sq); };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); tap(e); });
    return V;
  }
  global.BoardKit = { create };
})(window);
