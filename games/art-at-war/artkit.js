/* Art games kit: sketch pad, ink analysis, sprite cropping. */
(function (g) {
  'use strict';
  const Art = {};
  Art.COLORS = ['#1b1b2f', '#e63946', '#ff9f1c', '#ffd23f', '#2ec4b6', '#3a86ff', '#8338ec', '#ff6fb5', '#ffffff'];
  /* ---- strokes ---- */
  Art.drawStroke = function (ctx, s) {
    const p = s.pts; if (!p.length) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.size; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    if (s.erase) ctx.globalCompositeOperation = 'destination-out';
    if (p.length < 2) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.size / 2, 0, 6.2832); ctx.fill(); ctx.restore(); return; }
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]); ctx.stroke(); ctx.restore();
  };
  /* ---- pad: pointer drawing on a canvas with a transparent background ---- */
  Art.Pad = function (canvas, o) {
    o = o || {};
    const P = { canvas, ctx: canvas.getContext('2d'), strokes: [], color: Art.COLORS[0], size: 9, erase: false, onchange: o.onchange || null, locked: false, guide: null };
    const N = o.res || 512; canvas.width = N; canvas.height = N;
        P.render = function () {
      const c = P.ctx; c.clearRect(0, 0, N, N);
      if (P.custom) c.drawImage(P.custom, 0, 0, N, N);
      P.strokes.forEach(s => Art.drawStroke(c, s));
      if (P.cur) Art.drawStroke(c, P.cur);
    };
    function pt(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * N, (e.clientY - r.top) / r.height * N]; }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => {
      if (P.locked) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      P.cur = { pts: [pt(e)], color: P.color, size: P.size * N / 512, erase: P.erase }; P.render();
    });
    canvas.addEventListener('pointermove', e => {
      if (!P.cur) return; const q = pt(e), l = P.cur.pts[P.cur.pts.length - 1];
      if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) > 2) { P.cur.pts.push(q); P.render(); }
    });
    const end = () => { if (!P.cur) return; P.strokes.push(P.cur); P.cur = null; P.render(); if (P.onchange) P.onchange(); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    P.undo = () => { P.strokes.pop(); P.render(); if (P.onchange) P.onchange(); };
    P.clear = () => { P.strokes = []; P.cur = null; P.custom = null; P.render(); if (P.onchange) P.onchange(); };
    
    P.hasInk = () => P.strokes.some(s => !s.erase);
    return P;
  };
  /* ---- ink analysis ---- */
  Art.ink = function (cv) {
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { n, frac: n / (w * h), x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, empty: n < 30 };
  };
  /* crop to ink bbox and fit inside maxW x maxH (px) */
  Art.sprite = function (cv, maxW, maxH, keepAspect) {
    const k = Art.ink(cv); if (k.empty) return null;
    const s = Math.min(maxW / k.w, maxH / k.h), W = Math.max(2, Math.round(k.w * s)), H = Math.max(2, Math.round(k.h * s));
    const o = document.createElement('canvas'); o.width = W; o.height = H; const c = o.getContext('2d'); c.imageSmoothingQuality = 'high';
    c.drawImage(cv, k.x0, k.y0, k.w, k.h, 0, 0, W, H); o.ink = k; return o;
  };
  Art.fromURL = function (url, cb) { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(i, 0, 0, 512, 512); cb(c); }; i.src = url; };
  Art.rr = function (c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  g.Art = Art;
})(window);
