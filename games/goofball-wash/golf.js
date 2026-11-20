/* Golf art kit */
window.Golf = (function () {
  const TAU = Math.PI * 2;
  function ball(c, x, y, r, o) {
    o = o || {}; c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, o.tint || '#dfe8ee');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = '#2a3a4a'; c.lineWidth = Math.max(1.2, r * 0.09); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.55, r * 0.26, r * 0.12, -0.5, 0, TAU); c.fill();
    if (!o.noDimples) { c.fillStyle = 'rgba(0,0,40,.10)'; for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (0.25 + (i % 3) * 0.2); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, 0, TAU); c.fill(); } }
    if (o.face !== false) {
      const m = o.mood || 'happy', ey = -r * 0.1, ex = r * 0.3, blink = o.blink;
      c.fillStyle = '#16202a';
      if (m === 'dizzy') { c.strokeStyle = '#16202a'; c.lineWidth = r * 0.08; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * ex - r * 0.1, ey - r * 0.1); c.lineTo(s * ex + r * 0.1, ey + r * 0.1); c.moveTo(s * ex + r * 0.1, ey - r * 0.1); c.lineTo(s * ex - r * 0.1, ey + r * 0.1); c.stroke(); }); }
      else [-1, 1].forEach(s => { c.beginPath(); c.ellipse(s * ex, ey, r * 0.11, blink ? r * 0.02 : r * 0.16, 0, 0, TAU); c.fill(); if (!blink) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s * ex - r * 0.03, ey - r * 0.05, r * 0.04, 0, TAU); c.fill(); c.fillStyle = '#16202a'; } });
      c.strokeStyle = '#16202a'; c.lineWidth = r * 0.08; c.lineCap = 'round'; c.beginPath();
      if (m === 'scared') c.ellipse(0, r * 0.4, r * 0.12, r * 0.16, 0, 0, TAU); else if (m === 'dizzy') { c.moveTo(-r * 0.2, r * 0.38); c.quadraticCurveTo(0, r * 0.28, r * 0.2, r * 0.38); } else c.arc(0, r * 0.2, r * 0.3, 0.25, Math.PI - 0.25);
      c.stroke();
      c.fillStyle = 'rgba(255,120,140,.35)'; [-1, 1].forEach(s => { c.beginPath(); c.ellipse(s * r * 0.52, r * 0.2, r * 0.14, r * 0.08, 0, 0, TAU); c.fill(); });
    }
    c.restore();
  }
  function flag(c, x, y, h, t, col) {
    c.strokeStyle = '#eee'; c.lineWidth = Math.max(2, h * 0.05); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
    const w = h * 0.45, wv = Math.sin((t || 0) * 5) * h * 0.04; c.fillStyle = col || '#ff3d3d'; c.beginPath(); c.moveTo(x, y - h); c.quadraticCurveTo(x + w * 0.5, y - h - h * 0.08 + wv, x + w, y - h + h * 0.12 + wv); c.lineTo(x, y - h + h * 0.3); c.closePath(); c.fill();
  }
  function tree(c, x, y, s) {
    c.fillStyle = '#6b4423'; c.fillRect(x - s * 0.07, y - s * 0.45, s * 0.14, s * 0.45);
    [['#1f7a35', 0, -0.62, 0.34], ['#2c9a45', -0.16, -0.5, 0.26], ['#2c9a45', 0.16, -0.5, 0.26], ['#37b04f', 0, -0.78, 0.24]].forEach(a => { c.fillStyle = a[0]; c.beginPath(); c.arc(x + a[1] * s, y + a[2] * s, a[3] * s, 0, TAU); c.fill(); });
  }
  function bag(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
    c.fillStyle = '#d33a2a'; c.beginPath(); c.roundRect(-14, -52, 28, 62, 8); c.fill(); c.fillStyle = '#a82a1c'; c.fillRect(-14, -18, 28, 6);
    c.strokeStyle = '#ddd'; c.lineWidth = 3; [[-8, -52, -12, -76], [0, -52, 2, -80], [8, -52, 14, -74]].forEach(a => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.stroke(); });
    c.fillStyle = '#333'; [[-12, -76], [2, -80], [14, -74]].forEach(a => { c.beginPath(); c.arc(a[0], a[1], 5, 0, TAU); c.fill(); });
    c.restore();
  }
  function grassBg(c, W, H, t, hz) {
    const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#6ec0ff'); g.addColorStop(1, '#d6f3ff'); c.fillStyle = g; c.fillRect(0, 0, W, hz + 2);
    c.fillStyle = '#8fd07a'; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += 10) c.lineTo(x, hz - 18 - Math.sin(x * 0.015 + 1) * 12); c.lineTo(W, hz + 4); c.lineTo(0, hz + 4); c.fill();
    const gg = c.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, '#46b05a'); gg.addColorStop(1, '#2a8a40'); c.fillStyle = gg; c.fillRect(0, hz, W, H - hz);
  }
  return { ball, flag, tree, bag, grassBg };
})();
