/* Desert Games - shared character drawing: Desert.camel (side view) and Desert.buddy (round merge animals). */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  function ell(c, x, y, rx, ry, fill, stroke, lw, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); } }
  function lin(c, x0, y0, x1, y1, st) { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; }

  /* Camel facing right. Origin between the feet on the ground. ~150 wide x 135 tall at scale 1.
     o: t, walk 0..1, strain 0..1 (squashed under load), tuck 0..1 (legs pulled up), mood, blink, flip, tilt, sx, sy, alpha, hump (0..1 squash), blanket color */
  function camel(c, x, y, s, o) {
    o = o || {};
    const t = o.t || 0, walk = o.walk || 0, st = o.strain || 0, tuck = o.tuck || 0, sq = st * 14;
    c.save(); c.translate(x, y); c.scale(s * (o.flip ? -1 : 1), s);
    if (o.tilt) c.rotate(o.tilt);
    c.scale(o.sx || 1, o.sy || 1);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const body = '#d9a864', dark = '#a8753a', light = '#efcd92';
    const leg = (x0, ph, col, back) => {
      const a = Math.sin(t * 9 + ph) * 0.55 * walk, k = tuck;
      const hx = x0, hy = -50 + sq, len = 46 - sq * 0.6;
      const kx = hx + Math.sin(a) * len * 0.5 + (back ? -1 : 1) * k * 14, ky = hy + Math.cos(a) * len * 0.5 - k * 14;
      const fx = kx + Math.sin(a * 0.6 - 0.15 * (back ? -1 : 1)) * len * 0.5 - k * 14, fy = Math.min(-2, ky + len * 0.52 - k * 16);
      c.strokeStyle = col; c.lineWidth = 12; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.stroke();
      c.lineWidth = 9; c.beginPath(); c.moveTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      ell(c, fx + 2, fy, 8, 4.5, '#6b4423');
    };
    leg(-34, 0.3, dark, true); leg(30, 2.6, dark, false);
    /* tail */
    c.strokeStyle = dark; c.lineWidth = 5; c.beginPath(); c.moveTo(-50, -66 + sq); c.quadraticCurveTo(-64, -58, -62, -38 + sq); c.stroke(); ell(c, -62, -34 + sq, 5, 8, '#6b4423');
    /* neck + head */
    const wob = Math.sin(t * 4) * 1.5 * (walk > 0 ? 1 : 0.3);
    c.strokeStyle = body; c.lineWidth = 24; c.beginPath(); c.moveTo(36, -68 + sq); c.quadraticCurveTo(58, -88 + sq, 66 + wob, -112 + sq * 0.5); c.stroke();
    /* body */
    ell(c, 0, -64 + sq * 0.8, 54, 28 - sq * 0.25, lin(c, 0, -92, 0, -36, [[0, body], [1, dark]]));
    ell(c, 2, -52 + sq * 0.8, 40, 14, 'rgba(255,235,190,.45)');
    /* hump */
    const hs = 1 - (o.hump || 0) * 0.2;
    ell(c, -10, -92 + sq * 0.9, 24, 22 * hs, lin(c, 0, -118, 0, -76, [[0, light], [1, body]]));
    if (o.blanket) { c.fillStyle = o.blanket; c.beginPath(); c.moveTo(-34, -88 + sq); c.quadraticCurveTo(-10, -118 + sq * 0.8, 16, -88 + sq); c.lineTo(20, -66 + sq); c.lineTo(-38, -66 + sq); c.closePath(); c.fill(); c.fillStyle = '#ffcf6a'; c.fillRect(-38, -70 + sq, 58, 4); }
    /* head */
    const hx = 72 + wob, hy = -116 + sq * 0.5;
    ell(c, hx, hy, 18, 13, lin(c, hx, hy - 13, hx, hy + 13, [[0, light], [1, body]]), null, 0, -0.15);
    ell(c, hx + 15, hy + 5, 13, 10, '#efd2a0', null, 0, -0.05);
    ell(c, hx + 20, hy + 2, 2.2, 1.6, '#6b4423');
    ell(c, hx - 8, hy - 12, 4, 7, body, null, 0, -0.4);
    const mood = o.mood || 'neutral', blink = o.blink ? 0.15 : 1;
    if (mood === 'dizzy') { c.strokeStyle = '#2a1608'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 1, hy - 8); c.lineTo(hx + 7, hy - 1); c.moveTo(hx + 7, hy - 8); c.lineTo(hx - 1, hy - 1); c.stroke(); }
    else { ell(c, hx + 3, hy - 4, 3.6, 4.2 * blink, '#fff'); ell(c, hx + 4.2, hy - 4, 2.2, 2.8 * blink, '#2a1608'); }
    c.strokeStyle = '#6b4423'; c.lineWidth = 1.8; c.beginPath();
    if (mood === 'scared') { c.arc(hx + 14, hy + 10, 3.5, 0, TAU); }
    else { c.arc(hx + 12, hy + 4, 7, 0.25, 1.1); }
    c.stroke();
    if (mood === 'win' || mood === 'happy') { ell(c, hx + 1, hy + 4, 3.5, 2, 'rgba(255,120,120,.5)'); }
    if (st > 0.5) { ell(c, hx - 14, hy - 14 + ((t * 30) % 10), 2.5, 3.5, 'rgba(120,200,255,.9)'); }
    /* front leg over body */
    leg(40, 0.3 + 3.1, body, false); leg(-24, 2.6 + 3.1, body, true);
    c.restore();
  }

  /* Round buddies for the merge game. tier 0..7. r = radius in px. */
  const BUD = [
    { n: 'Scarab', c: '#2a3a6e', c2: '#5a78d0' },
    { n: 'Gecko', c: '#5aa84a', c2: '#a9e07a' },
    { n: 'Scorpion', c: '#a8452a', c2: '#e88a5a' },
    { n: 'Meerkat', c: '#c9a06a', c2: '#ecd0a0' },
    { n: 'Fennec', c: '#f0c890', c2: '#fff0d8' },
    { n: 'Owl', c: '#8a6a4a', c2: '#d8b890' },
    { n: 'Camel', c: '#d9a864', c2: '#f2d4a0' },
    { n: 'Sphinx', c: '#e8b840', c2: '#fff0a0' }
  ];
  function eyes(c, r, y, gap, size, o) {
    const m = o && o.mood || 'neutral', bl = o && o.blink ? 0.15 : 1;
    for (let sd = -1; sd <= 1; sd += 2) {
      const ex = sd * gap * r;
      if (m === 'dizzy') { c.strokeStyle = '#1e1208'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(ex - r * 0.07, y - r * 0.07); c.lineTo(ex + r * 0.07, y + r * 0.07); c.moveTo(ex + r * 0.07, y - r * 0.07); c.lineTo(ex - r * 0.07, y + r * 0.07); c.stroke(); continue; }
      ell(c, ex, y, r * size, r * size * 1.15 * bl, '#fff');
      ell(c, ex + r * 0.015, y + r * 0.01, r * size * 0.62, r * size * 0.78 * bl, '#1e1208');
      ell(c, ex - r * size * 0.12, y - r * size * 0.25, r * size * 0.2, r * size * 0.2, '#fff');
    }
  }
  function buddy(c, tier, x, y, r, o) {
    o = o || {}; const B = BUD[tier], t = o.t || 0;
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(r * 0.08, r * 0.1, r, r, 0, 0, TAU); c.fill();
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, B.c2); g.addColorStop(1, B.c);
    const body = () => { c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); };
    if (tier === 0) { /* scarab */
      c.strokeStyle = B.c; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(-r * 0.2, -r * 0.95); c.quadraticCurveTo(-r * 0.5, -r * 1.35, -r * 0.8, -r * 1.2); c.moveTo(r * 0.2, -r * 0.95); c.quadraticCurveTo(r * 0.5, -r * 1.35, r * 0.8, -r * 1.2); c.stroke();
      body(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(0, -r * 0.5); c.lineTo(0, r * 0.95); c.stroke();
      ell(c, 0, -r * 0.62, r * 0.52, r * 0.3, B.c2); eyes(c, r, -r * 0.1, 0.32, 0.17, o);
    } else if (tier === 1) { /* gecko */
      body(); ell(c, 0, r * 0.35, r * 0.62, r * 0.4, B.c2);
      [[-0.55, -0.7], [0.55, -0.7]].forEach(p => { ell(c, p[0] * r, p[1] * r, r * 0.28, r * 0.28, B.c2, B.c, r * 0.04); });
      eyes(c, r, -r * 0.62, 0.55, 0.2, o); c.strokeStyle = '#1e1208'; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, r * 0.1, r * 0.3, 0.2, 2.9); c.stroke();
      c.fillStyle = 'rgba(30,90,30,.5)'; [[-0.3, 0.55], [0.3, 0.55], [0, 0.78]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, r * 0.07, 0, TAU); c.fill(); });
    } else if (tier === 2) { /* scorpion */
      c.strokeStyle = B.c; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(r * 0.5, -r * 0.8); c.quadraticCurveTo(r * 1.3, -r * 1.1, r * 0.9, -r * 1.35); c.stroke(); ell(c, r * 0.85, -r * 1.35, r * 0.13, r * 0.13, '#ffcf6a');
      [-1, 1].forEach(sd => { c.strokeStyle = B.c; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(sd * r * 0.7, -r * 0.2); c.lineTo(sd * r * 1.08, -r * 0.62); c.stroke(); ell(c, sd * r * 1.08, -r * 0.7, r * 0.2, r * 0.14, B.c2, B.c, r * 0.04); });
      body(); eyes(c, r, -r * 0.1, 0.38, 0.19, o); c.strokeStyle = '#1e1208'; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, r * 0.25, r * 0.22, 0.2, 2.9); c.stroke();
    } else if (tier === 3) { /* meerkat */
      ell(c, -r * 0.78, -r * 0.12, r * 0.18, r * 0.24, B.c, null, 0, -0.2); ell(c, r * 0.78, -r * 0.12, r * 0.18, r * 0.24, B.c, null, 0, 0.2);
      body(); ell(c, 0, r * 0.3, r * 0.5, r * 0.4, B.c2);
      [-1, 1].forEach(sd => ell(c, sd * r * 0.34, -r * 0.18, r * 0.27, r * 0.2, 'rgba(60,35,15,.75)', null, 0, sd * 0.4));
      eyes(c, r, -r * 0.18, 0.34, 0.14, o); ell(c, 0, r * 0.12, r * 0.12, r * 0.09, '#2a1608');
      c.strokeStyle = '#2a1608'; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, r * 0.2, r * 0.18, 0.3, 2.8); c.stroke();
    } else if (tier === 4) { /* fennec */
      [-1, 1].forEach(sd => { c.fillStyle = B.c; c.beginPath(); c.moveTo(sd * r * 0.35, -r * 0.7); c.lineTo(sd * r * 0.95, -r * 1.55); c.lineTo(sd * r * 0.95, -r * 0.35); c.closePath(); c.fill(); c.fillStyle = '#ffb9a0'; c.beginPath(); c.moveTo(sd * r * 0.5, -r * 0.7); c.lineTo(sd * r * 0.88, -r * 1.32); c.lineTo(sd * r * 0.88, -r * 0.5); c.closePath(); c.fill(); });
      body(); ell(c, 0, r * 0.28, r * 0.55, r * 0.42, B.c2); eyes(c, r, -r * 0.12, 0.38, 0.14, o); ell(c, 0, r * 0.12, r * 0.1, r * 0.08, '#2a1608');
      c.strokeStyle = '#2a1608'; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, r * 0.2, r * 0.17, 0.3, 2.8); c.stroke();
    } else if (tier === 5) { /* owl */
      [-1, 1].forEach(sd => { c.fillStyle = B.c; c.beginPath(); c.moveTo(sd * r * 0.3, -r * 0.8); c.lineTo(sd * r * 0.75, -r * 1.3); c.lineTo(sd * r * 0.8, -r * 0.6); c.closePath(); c.fill(); });
      body(); ell(c, 0, r * 0.35, r * 0.6, r * 0.5, B.c2); [-1, 1].forEach(sd => ell(c, sd * r * 0.34, -r * 0.15, r * 0.3, r * 0.3, '#fff3d0', B.c, r * 0.04));
      eyes(c, r, -r * 0.15, 0.34, 0.2, o); c.fillStyle = '#ffa030'; c.beginPath(); c.moveTo(-r * 0.12, r * 0.05); c.lineTo(r * 0.12, r * 0.05); c.lineTo(0, r * 0.3); c.closePath(); c.fill();
    } else if (tier === 6) { /* camel */
      ell(c, 0, -r * 1.02, r * 0.4, r * 0.3, B.c); [-1, 1].forEach(sd => ell(c, sd * r * 0.62, -r * 0.82, r * 0.14, r * 0.26, B.c, null, 0, sd * 0.5));
      body(); ell(c, 0, r * 0.32, r * 0.58, r * 0.42, B.c2); eyes(c, r, -r * 0.18, 0.36, 0.15, o);
      ell(c, -r * 0.14, r * 0.28, r * 0.05, r * 0.04, '#6b4423'); ell(c, r * 0.14, r * 0.28, r * 0.05, r * 0.04, '#6b4423');
      c.strokeStyle = '#6b4423'; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, r * 0.35, r * 0.2, 0.3, 2.8); c.stroke();
    } else { /* sphinx */
      c.fillStyle = '#2c6fd0'; c.beginPath(); c.moveTo(-r * 0.95, r * 0.4); c.lineTo(-r * 0.85, -r * 0.6); c.quadraticCurveTo(0, -r * 1.5, r * 0.85, -r * 0.6); c.lineTo(r * 0.95, r * 0.4); c.closePath(); c.fill();
      c.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { c.fillRect(i * r * 0.26 - r * 0.04, -r * 1.1 + Math.abs(i) * r * 0.12, r * 0.08, r * 0.6); }
      body(); c.fillStyle = '#2c6fd0'; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.55); c.quadraticCurveTo(0, -r * 1.0, r * 0.7, -r * 0.55); c.lineTo(r * 0.7, -r * 0.4); c.quadraticCurveTo(0, -r * 0.7, -r * 0.7, -r * 0.4); c.fill();
      eyes(c, r, -r * 0.1, 0.34, 0.15, o); ell(c, 0, r * 0.14, r * 0.1, r * 0.08, '#6b3a10'); c.strokeStyle = '#6b3a10'; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, r * 0.22, r * 0.18, 0.3, 2.8); c.stroke();
      ell(c, 0, -r * 0.62, r * 0.09, r * 0.09, '#e5383b');
    }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.36, -r * 0.5, r * 0.22, r * 0.11, -0.6, 0, TAU); c.fill();
    c.restore();
  }
  global.Desert = { camel, buddy, BUD, ell, lin };
})(window);
