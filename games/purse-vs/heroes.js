/* Heroes: shaded, outlined mascot characters. Origin = feet center, ~100 units tall. */
window.Heroes = (function () {
  const TAU = Math.PI * 2, OUT = '#3a2210';
  function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  function rg(c, x, y, r, stops, fx, fy) { const g = c.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, 1, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  /* shaded ellipse with outline + highlight */
  function ell(c, x, y, rx, ry, cols, o) {
    o = o || {}; c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
    c.fillStyle = rg(c, 0, 0, Math.max(rx, ry), cols, -rx * 0.35, -ry * 0.4); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
    if (o.out !== 0) { c.strokeStyle = o.oc || OUT; c.lineWidth = o.out || 2.4; c.stroke(); }
    if (o.hi !== false) { c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.ellipse(-rx * 0.3, -ry * 0.45, rx * 0.34, ry * 0.18, -0.4, 0, TAU); c.fill(); }
    c.restore();
  }
  function poly(c, pts, fill, o) { o = o || {}; c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.strokeStyle = o.oc || OUT; c.lineWidth = o.out || 2.4; c.lineJoin = 'round'; c.stroke(); }
  function eye(c, x, y, r, o) {
    o = o || {}; const look = o.look || 0, blink = o.blink;
    if (blink) { c.strokeStyle = OUT; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x, y + r * 0.5, x + r, y); c.stroke(); return; }
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, r, r * 1.12, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.fillStyle = o.iris || '#2a1608'; c.beginPath(); c.ellipse(x + look * r * 0.25, y + r * 0.1, r * 0.66, r * 0.78, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + look * r * 0.25 - r * 0.22, y - r * 0.28, r * 0.26, 0, TAU); c.arc(x + look * r * 0.25 + r * 0.2, y + r * 0.3, r * 0.12, 0, TAU); c.fill();
  }
  function smile(c, x, y, w, o) { o = o || {}; c.strokeStyle = OUT; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); if (o.open) { c.moveTo(x - w, y); c.quadraticCurveTo(x, y + w * 1.1, x + w, y); c.closePath(); c.fillStyle = '#7a1c1c'; c.fill(); c.stroke(); c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(x, y + w * 0.62, w * 0.45, w * 0.25, 0, 0, TAU); c.fill(); } else { c.arc(x, y - w * 0.3, w, 0.3, Math.PI - 0.3); c.stroke(); } }
  function shades(c, x, y, w) { c.fillStyle = '#12141c'; c.beginPath(); c.roundRect(x - w, y - w * 0.32, w * 0.9, w * 0.62, w * 0.2); c.roundRect(x + w * 0.1, y - w * 0.32, w * 0.9, w * 0.62, w * 0.2); c.fill(); c.fillRect(x - w * 0.12, y - w * 0.18, w * 0.24, w * 0.12); c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - w * 0.62, y - w * 0.15, w * 0.2, w * 0.08, -0.4, 0, TAU); c.ellipse(x + w * 0.38, y - w * 0.15, w * 0.2, w * 0.08, -0.4, 0, TAU); c.fill(); }
  function shadow(c, w) { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0, 2, w, w * 0.16, 0, 0, TAU); c.fill(); }

  const H = {};
  H.ziggy = (c, o) => { /* camel with sunglasses, sitting */
    shadow(c, 62); const f = ['#f2c47e', '#d9a15a', '#a8703a'];
    ell(c, -8, -30, 52, 26, f); ell(c, -28, -62, 20, 17, f); ell(c, 8, -64, 18, 16, f);
    ell(c, 30, -22, 17, 12, f); ell(c, -40, -12, 14, 10, f);
    c.strokeStyle = OUT; c.lineWidth = 2.4; poly(c, [[34, -44], [52, -86], [70, -84], [56, -40]], '#d9a15a');
    ell(c, 60, -90, 25, 21, f); ell(c, 78, -80, 14, 11, ['#f6d49a', '#e8b878', '#c88a4a']);
    ell(c, 66, -108, 6, 8, f, { out: 2 }); ell(c, 50, -106, 6, 8, f, { out: 2 });
    c.fillStyle = '#3a2210'; c.beginPath(); c.arc(82, -82, 2, 0, TAU); c.fill();
    shades(c, 62, -94, 15); smile(c, 74, -74, 6, { open: true });
    c.fillStyle = '#e8453a'; c.beginPath(); c.roundRect(-34, -58, 50, 12, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  };
  H.sandy = (c, o) => { /* fennec fox */
    shadow(c, 44); const f = ['#fbd49a', '#f0b068', '#c8803a'];
    ell(c, 40, -22, 16, 10, f, { rot: 0.4 }); ell(c, 0, -30, 30, 24, f); ell(c, -22, -6, 9, 8, f); ell(c, 22, -6, 9, 8, f);
    poly(c, [[-30, -66], [-44, -118], [-12, -76]], f[1]); poly(c, [[-26, -70], [-38, -108], [-16, -78]], '#ffb8c0', { out: 0 });
    poly(c, [[30, -66], [44, -118], [12, -76]], f[1]); poly(c, [[26, -70], [38, -108], [16, -78]], '#ffb8c0', { out: 0 });
    ell(c, 0, -56, 30, 24, f); ell(c, 0, -48, 15, 11, ['#fff2d8', '#fbe0b0', '#e8c488'], { out: 0, hi: false });
    c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -52, 5, 3.6, 0, 0, TAU); c.fill();
    eye(c, -13, -62, 8, { look: o.look }); eye(c, 13, -62, 8, { look: o.look }); smile(c, 0, -45, 6, { open: o.open !== false });
  };
  H.duney = (c, o) => { /* gecko */
    shadow(c, 56); const f = ['#c8d890', '#8fae58', '#5a7a34'];
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.fillStyle = '#8fae58'; c.beginPath(); c.moveTo(-34, -20); c.quadraticCurveTo(-76, -10, -62, -42); c.quadraticCurveTo(-52, -30, -30, -28); c.fill(); c.stroke();
    ell(c, -6, -26, 40, 20, f); [[-24, 0], [18, 0]].forEach(p => { ell(c, p[0], p[1] - 4, 11, 7, f); });
    ell(c, 30, -34, 12, 9, f);
    ell(c, 36, -50, 25, 20, f); ell(c, 24, -66, 9, 10, ['#fff', '#eee', '#ccc']); ell(c, 48, -66, 9, 10, ['#fff', '#eee', '#ccc']);
    eye(c, 24, -67, 6.5, { look: 1 }); eye(c, 48, -67, 6.5, { look: 1 }); smile(c, 38, -42, 8, { open: false });
    c.fillStyle = 'rgba(80,110,40,.4)'; [[-20, -34], [-4, -38], [12, -32], [-12, -22]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 3.6, 0, TAU); c.fill(); });
  };
  H.blaze = (c, o) => { /* scorpion */
    shadow(c, 56); const f = ['#ff8a70', '#d83a30', '#8a1414'];
    for (let i = 0; i < 4; i++) { const x = -24 + i * 16; c.strokeStyle = '#8a1414'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, -22); c.lineTo(x + (i < 2 ? -12 : 12), -4); c.stroke(); }
    c.strokeStyle = OUT; c.lineWidth = 11; c.beginPath(); c.moveTo(30, -26); c.quadraticCurveTo(70, -34, 66, -78); c.quadraticCurveTo(60, -104, 30, -96); c.stroke(); c.strokeStyle = '#d83a30'; c.lineWidth = 7; c.stroke();
    poly(c, [[24, -102], [36, -118], [42, -96]], '#ffcf4a');
    [-1, 1].forEach(s => { c.save(); c.translate(s * 30, -52); c.strokeStyle = OUT; c.lineWidth = 11; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 12, -14); c.stroke(); c.strokeStyle = '#d83a30'; c.lineWidth = 7; c.stroke(); ell(c, s * 20, -28, 15, 11, f, { rot: s * -0.5 }); c.restore(); });
    ell(c, 0, -34, 36, 24, f); eye(c, -11, -42, 10, { iris: '#1a5a6a' }); eye(c, 11, -42, 10, { iris: '#1a5a6a' }); smile(c, 0, -26, 7, { open: true });
  };
  H.oasis = (c, o) => { /* meerkat with goggles */
    shadow(c, 38); const f = ['#f6d8a8', '#d8aa70', '#9a6a38'];
    ell(c, -12, -4, 11, 7, f); ell(c, 12, -4, 11, 7, f); ell(c, 0, -32, 24, 32, f); ell(c, 0, -26, 15, 22, ['#fff4dc', '#f8e2bc', '#e0c08c'], { out: 0, hi: false });
    ell(c, -26, -38, 8, 14, f, { rot: 0.3 }); ell(c, 26, -38, 8, 14, f, { rot: -0.3 });
    ell(c, 0, -76, 26, 24, f); ell(c, -22, -82, 8, 8, ['#6a4a2a', '#4a3018', '#2a1608']); ell(c, 22, -82, 8, 8, ['#6a4a2a', '#4a3018', '#2a1608']);
    c.fillStyle = '#4a7a98'; c.beginPath(); c.arc(0, -90, 26, Math.PI, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = '#6aa0c0'; c.fillRect(-26, -92, 52, 6);
    ell(c, -11, -78, 10, 10, ['#e8f6ff', '#9ad0ee', '#4a90c0'], { oc: '#2a3a4a' }); ell(c, 11, -78, 10, 10, ['#e8f6ff', '#9ad0ee', '#4a90c0'], { oc: '#2a3a4a' });
    eye(c, -11, -78, 5, {}); eye(c, 11, -78, 5, {}); c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -68, 4, 3, 0, 0, TAU); c.fill(); smile(c, 0, -64, 6, { open: true });
  };
  H.tee = (c, o) => { /* golf ball with cap + shades */
    shadow(c, 42); ell(c, -14, -6, 13, 8, ['#4a7ae8', '#2a52c0', '#1a3280']); ell(c, 14, -6, 13, 8, ['#4a7ae8', '#2a52c0', '#1a3280']);
    ell(c, 0, -46, 40, 40, ['#ffffff', '#eef2f6', '#b8c4d0']);
    c.fillStyle = 'rgba(80,100,140,.14)'; for (let i = 0; i < 14; i++) { const a = i * 2.4, d = 10 + (i % 4) * 8; c.beginPath(); c.arc(Math.cos(a) * d, -46 + Math.sin(a) * d, 2.6, 0, TAU); c.fill(); }
    c.fillStyle = '#1c3fa8'; c.beginPath(); c.arc(0, -56, 40, Math.PI * 1.04, Math.PI * 1.96); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke();
    c.fillStyle = '#2a52c0'; c.beginPath(); c.ellipse(26, -62, 26, 7, 0.12, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(-6, -72, 5, 0, TAU); c.fill();
    shades(c, 0, -50, 17); smile(c, 4, -30, 8, { open: true });
  };
  H.caddy = (c, o) => { /* golf cart, front */
    shadow(c, 52); c.fillStyle = '#1a1a22'; [[-36, -10], [36, -10]].forEach(p => { c.beginPath(); c.roundRect(p[0] - 8, p[1] - 12, 16, 22, 5); c.fill(); });
    c.fillStyle = '#ffd23a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(-42, -52, 84, 40, 10); c.fill(); c.stroke();
    c.fillStyle = '#e8b81c'; c.fillRect(-38, -26, 76, 8);
    c.fillStyle = '#eaf6ff'; c.beginPath(); c.roundRect(-34, -90, 68, 40, 8); c.fill(); c.stroke();
    c.fillStyle = '#ffd23a'; c.beginPath(); c.roundRect(-40, -98, 80, 10, 4); c.fill(); c.stroke();
    ell(c, -15, -70, 12, 13, ['#fff', '#fff', '#e8e8e8'], { hi: false }); ell(c, 15, -70, 12, 13, ['#fff', '#fff', '#e8e8e8'], { hi: false }); eye(c, -15, -69, 8, { look: o.look }); eye(c, 15, -69, 8, { look: o.look }); smile(c, 0, -52, 8, { open: true });
    c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(-30, -36, 5, 0, TAU); c.arc(30, -36, 5, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
  };
  H.fairway = (c, o) => { /* turtle with straw hat */
    shadow(c, 54); const g = ['#9ae068', '#5cb84a', '#2e7a30'];
    ell(c, -20, -4, 11, 8, g); ell(c, 26, -4, 11, 8, g);
    ell(c, -2, -34, 42, 30, ['#c8924a', '#9a6428', '#5a3814']); c.fillStyle = 'rgba(255,230,160,.22)'; [[-18, -42], [4, -50], [20, -38], [-4, -28]].forEach(p => { c.beginPath(); c.ellipse(p[0], p[1], 9, 6, 0, 0, TAU); c.fill(); }); c.strokeStyle = 'rgba(58,34,16,.5)'; c.lineWidth = 1.6; c.stroke();
    ell(c, 38, -44, 24, 22, g); ell(c, 54, -34, 9, 7, g, { hi: false });
    eye(c, 34, -52, 8, { look: 1 }); smile(c, 44, -38, 7, { open: false });
    c.fillStyle = '#f0cc6a'; c.beginPath(); c.ellipse(34, -66, 34, 8, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.beginPath(); c.ellipse(34, -74, 18, 13, 0, Math.PI, TAU); c.fill(); c.stroke(); c.fillStyle = '#d83a30'; c.fillRect(17, -76, 34, 5);
  };
  H.goofy = (c, o) => { /* raccoon with goggles */
    shadow(c, 46); const g = ['#bfc4cc', '#8a909c', '#4a505c'];
    c.strokeStyle = OUT; c.lineWidth = 2.4; for (let i = 0; i < 4; i++) { ell(c, 50 + i * 3, -26 - i * 10, 10, 9, i % 2 ? ['#4a505c', '#2a2e38', '#14161c'] : g, { rot: 0.4 }); }
    ell(c, -16, -4, 12, 8, g); ell(c, 16, -4, 12, 8, g); ell(c, 0, -30, 28, 28, g); ell(c, 0, -26, 16, 20, ['#fff', '#eef0f4', '#c8ccd4'], { out: 0, hi: false });
    poly(c, [[-26, -62], [-30, -92], [-8, -76]], g[1]); poly(c, [[26, -62], [30, -92], [8, -76]], g[1]);
    ell(c, 0, -62, 28, 24, g); c.fillStyle = '#23262e'; c.beginPath(); c.ellipse(-12, -64, 14, 10, -0.3, 0, TAU); c.ellipse(12, -64, 14, 10, 0.3, 0, TAU); c.fill();
    ell(c, 0, -52, 14, 10, ['#fff', '#f0f2f6', '#d0d4dc'], { out: 0, hi: false }); c.fillStyle = '#14161c'; c.beginPath(); c.ellipse(0, -57, 5, 3.6, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffd23a'; c.beginPath(); c.roundRect(-30, -74, 60, 16, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); ell(c, -13, -66, 11, 11, ['#e8f6ff', '#8ad0f0', '#3a90c8'], { oc: '#2a3a4a' }); ell(c, 13, -66, 11, 11, ['#e8f6ff', '#8ad0f0', '#3a90c8'], { oc: '#2a3a4a' });
    eye(c, -13, -66, 5.5, {}); eye(c, 13, -66, 5.5, {}); smile(c, 0, -46, 7, { open: true });
  };
  H.holey = (c, o) => { /* egg-shaped hole mascot with flag */
    shadow(c, 34); c.strokeStyle = '#eee'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(4, -64); c.lineTo(4, -112); c.stroke(); poly(c, [[4, -112], [36, -102 + Math.sin((o.t || 0) * 5) * 3], [4, -90]], '#e8332a');
    ell(c, 0, -34, 28, 36, ['#ffffff', '#f4f4ee', '#c8c8bc']); ell(c, -17, -3, 10, 7, ['#fff', '#f0f0e8', '#c0c0b4']); ell(c, 17, -3, 10, 7, ['#fff', '#f0f0e8', '#c0c0b4']);
    eye(c, -10, -42, 8, {}); eye(c, 10, -42, 8, {}); smile(c, 0, -26, 8, { open: true }); c.fillStyle = 'rgba(255,120,140,.4)'; c.beginPath(); c.ellipse(-20, -30, 6, 4, 0, 0, TAU); c.ellipse(20, -30, 6, 4, 0, 0, TAU); c.fill();
  };

  H.tux = (c, o) => { /* N0N07: suave cat in tux */
    shadow(c, 46); const f = ['#8a90a0', '#5a6070', '#2e3240'];
    ell(c, 0, -30, 28, 32, ['#2a2e3c', '#1a1d28', '#0c0e14']); poly(c, [[-9, -58], [0, -40], [9, -58]], '#fff'); c.fillStyle = '#d8332a'; c.beginPath(); c.moveTo(0, -52); c.lineTo(-10, -58); c.lineTo(-10, -46); c.closePath(); c.moveTo(0, -52); c.lineTo(10, -58); c.lineTo(10, -46); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    ell(c, -16, -4, 12, 7, ['#2a2e3c', '#1a1d28', '#0c0e14']); ell(c, 16, -4, 12, 7, ['#2a2e3c', '#1a1d28', '#0c0e14']);
    c.strokeStyle = OUT; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, -26); c.quadraticCurveTo(52, -34, 46, -62); c.stroke(); c.strokeStyle = '#5a6070'; c.lineWidth = 6; c.stroke();
    poly(c, [[-30, -80], [-34, -110], [-10, -92]], f[1]); poly(c, [[30, -80], [34, -110], [10, -92]], f[1]);
    ell(c, 0, -76, 30, 25, f); ell(c, 0, -66, 16, 11, ['#d8dce6', '#b8bece', '#8890a4'], { out: 0, hi: false });
    c.fillStyle = '#ff9aa8'; c.beginPath(); c.moveTo(-4, -72); c.lineTo(4, -72); c.lineTo(0, -67); c.closePath(); c.fill();
    eye(c, -13, -82, 8, { look: o.look, iris: '#3a8a4a' }); eye(c, 13, -82, 8, { look: o.look, iris: '#3a8a4a' });
    c.strokeStyle = '#e8e8f0'; c.lineWidth = 1.6; [-1, 1].forEach(s => [-3, 3].forEach(d => { c.beginPath(); c.moveTo(s * 18, -66 + d); c.lineTo(s * 38, -66 + d * 3); c.stroke(); })); smile(c, 0, -62, 6, { open: false });
  };
  H.owl = (c, o) => { /* Spy Spotter: owl detective with magnifier */
    shadow(c, 44); const f = ['#c8a070', '#9a6c3c', '#5a3a1a'];
    ell(c, -14, -3, 11, 6, ['#ffcf4a', '#e8a81c', '#a87008']); ell(c, 14, -3, 11, 6, ['#ffcf4a', '#e8a81c', '#a87008']);
    ell(c, 0, -42, 32, 38, f); ell(c, 0, -34, 20, 26, ['#f6e8c8', '#e8d0a0', '#b89860'], { out: 0, hi: false });
    c.strokeStyle = 'rgba(90,58,26,.4)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -40 + i * 11, 8, 0.2, Math.PI - 0.2); c.stroke(); }
    ell(c, -30, -42, 9, 24, f[1] ? ['#a87848', '#7a5028', '#4a2e10'] : f, { rot: 0.15 }); ell(c, 30, -42, 9, 24, ['#a87848', '#7a5028', '#4a2e10'], { rot: -0.15 });
    poly(c, [[-26, -74], [-30, -96], [-10, -80]], f[1]); poly(c, [[26, -74], [30, -96], [10, -80]], f[1]);
    ell(c, -13, -62, 15, 15, ['#fff', '#f4f4f4', '#d8d8d8']); ell(c, 13, -62, 15, 15, ['#fff', '#f4f4f4', '#d8d8d8']); eye(c, -13, -62, 8, { look: o.look }); eye(c, 13, -62, 8, { look: o.look });
    poly(c, [[-5, -54], [5, -54], [0, -44]], '#ffb02a');
    ell(c, 0, -76, 34, 6, ['#6a5a48', '#4a3c2e', '#2a2018']); c.fillStyle = '#4a3c2e'; c.beginPath(); c.moveTo(-20, -78); c.quadraticCurveTo(-18, -100, 0, -98); c.quadraticCurveTo(18, -100, 20, -78); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); c.fillStyle = '#c42f2f'; c.fillRect(-20, -86, 40, 5);
    c.strokeStyle = OUT; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(34, -20); c.lineTo(48, -42); c.stroke(); c.strokeStyle = '#8a5a2a'; c.lineWidth = 3.4; c.stroke(); ell(c, 54, -52, 12, 12, ['rgba(220,245,255,.9)', 'rgba(170,220,245,.8)', 'rgba(110,170,210,.8)'], { oc: '#8a5a2a', out: 3 });
  };
  H.bulldog = (c, o) => { /* C.I. Yay: bulldog guard with badge */
    shadow(c, 48); const f = ['#e8c89a', '#c89a60', '#8a5e30'];
    ell(c, -18, -4, 13, 8, f); ell(c, 18, -4, 13, 8, f); ell(c, 0, -32, 34, 30, ['#3a4a78', '#26325a', '#141c38']); poly(c, [[-10, -60], [0, -44], [10, -60]], '#f2f4fa');
    c.fillStyle = '#ffcf4a'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9; c.lineTo(14 + Math.cos(a) * r, -30 + Math.sin(a) * r); } c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    ell(c, -30, -76, 10, 17, ['#7a4a22', '#5a3414', '#3a2008'], { rot: 0.3 }); ell(c, 30, -76, 10, 17, ['#7a4a22', '#5a3414', '#3a2008'], { rot: -0.3 });
    ell(c, 0, -70, 32, 26, f); ell(c, 0, -60, 20, 15, ['#f6dcb4', '#e8c492', '#c09a64'], { out: 0, hi: false });
    c.fillStyle = '#1a1208'; c.beginPath(); c.ellipse(0, -66, 7, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; [-1, 1].forEach(s => { poly(c, [[s * 12 - 4, -52], [s * 12 + 4, -52], [s * 12, -42]], '#fff'); });
    eye(c, -14, -78, 8, { look: o.look }); eye(c, 14, -78, 8, { look: o.look });
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -53); c.quadraticCurveTo(0, -48, 8, -53); c.stroke();
    ell(c, 0, -94, 36, 8, ['#3a4a78', '#26325a', '#141c38']); c.fillStyle = '#26325a'; c.beginPath(); c.arc(0, -96, 24, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(0, -104, 5, 0, TAU); c.fill();
  };
  H.mouse = (c, o) => { /* Phone Tap: mouse with headset */
    shadow(c, 38); const f = ['#d8d8e0', '#aeb0be', '#6a6c7e'];
    c.strokeStyle = OUT; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-18, -14); c.quadraticCurveTo(-60, -10, -52, -48); c.stroke(); c.strokeStyle = '#ffb0b8'; c.lineWidth = 4; c.stroke();
    ell(c, 0, -26, 25, 26, f); ell(c, 0, -22, 14, 18, ['#fff', '#f2f2f6', '#d0d0da'], { out: 0, hi: false }); ell(c, -13, -3, 10, 6, f); ell(c, 13, -3, 10, 6, f);
    ell(c, -26, -80, 17, 17, ['#ffb8c4', '#e88a9c', '#b05468']); ell(c, 26, -80, 17, 17, ['#ffb8c4', '#e88a9c', '#b05468']);
    ell(c, 0, -62, 27, 25, f); ell(c, 0, -52, 12, 9, ['#fff', '#f4f4f8', '#d0d0da'], { out: 0, hi: false }); c.fillStyle = '#ff7a90'; c.beginPath(); c.ellipse(0, -57, 4.4, 3.2, 0, 0, TAU); c.fill();
    eye(c, -12, -68, 8, { look: o.look }); eye(c, 12, -68, 8, { look: o.look }); smile(c, 0, -49, 6, { open: true });
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 5; c.beginPath(); c.arc(0, -70, 31, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); ell(c, -29, -64, 9, 12, ['#4a5068', '#2a2e3c', '#12141c']); ell(c, 29, -64, 9, 12, ['#4a5068', '#2a2e3c', '#12141c']);
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-31, -54); c.quadraticCurveTo(-30, -42, -14, -44); c.stroke(); ell(c, -12, -44, 5, 4, ['#6a7088', '#3a4058', '#12141c']);
  };
  H.bomb = (c, o) => { /* Wiredup: nervous bomb */
    shadow(c, 38); ell(c, -14, -4, 12, 7, ['#4a4e5e', '#2a2e3c', '#12141c']); ell(c, 14, -4, 12, 7, ['#4a4e5e', '#2a2e3c', '#12141c']);
    ell(c, 0, -42, 36, 36, ['#6a6e82', '#2e3244', '#0c0e16']); c.fillStyle = '#4a4e5e'; c.beginPath(); c.roundRect(-10, -84, 20, 12, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
    c.strokeStyle = '#c89a4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -84); c.quadraticCurveTo(10, -98, 22, -92); c.stroke(); const fl = 1 + Math.sin((o.t || 0) * 18) * 0.25; c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(24, -93, 6 * fl, 0, TAU); c.fill(); c.fillStyle = '#ff6a2a'; c.beginPath(); c.arc(24, -93, 3.4 * fl, 0, TAU); c.fill();
    eye(c, -13, -46, 10, { look: o.look }); eye(c, 13, -46, 10, { look: o.look }); c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-8, -26); c.lineTo(-4, -30); c.lineTo(0, -26); c.lineTo(4, -30); c.lineTo(8, -26); c.stroke();
    c.fillStyle = 'rgba(120,200,255,.8)'; c.beginPath(); c.ellipse(28, -62, 3.4, 5.4, 0.3, 0, TAU); c.fill();
  };
  H.parrot = (c, o) => { /* Code Word: parrot in a fedora */
    shadow(c, 40); const g = ['#7ae070', '#3aae44', '#1a6a2a'];
    ell(c, -8, -4, 7, 7, ['#ffb02a', '#e88a10', '#a85a00'], { rot: 0 }); ell(c, 8, -4, 7, 7, ['#ffb02a', '#e88a10', '#a85a00']);
    poly(c, [[-12, -20], [-26, 6], [-6, -6]], '#e8433a'); poly(c, [[-2, -20], [-12, 8], [8, -6]], '#3a8ae8');
    ell(c, 0, -38, 28, 32, g); ell(c, 0, -30, 17, 22, ['#fff4a0', '#ffe060', '#d8b020'], { out: 0, hi: false });
    ell(c, -26, -36, 10, 22, ['#e8433a', '#c42f2f', '#7a1414'], { rot: 0.2 }); ell(c, 26, -36, 10, 22, ['#3a8ae8', '#2a62c0', '#143a80'], { rot: -0.2 });
    ell(c, 0, -74, 26, 24, g); ell(c, -12, -72, 12, 12, ['#fff', '#f4f4f4', '#d8d8d8']); ell(c, 12, -72, 12, 12, ['#fff', '#f4f4f4', '#d8d8d8']); eye(c, -12, -72, 7, { look: o.look }); eye(c, 12, -72, 7, { look: o.look });
    c.fillStyle = '#ffb02a'; c.beginPath(); c.moveTo(-8, -64); c.quadraticCurveTo(0, -78, 8, -64); c.quadraticCurveTo(10, -48, 0, -46); c.quadraticCurveTo(-10, -48, -8, -64); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); c.fillStyle = '#e88a10'; c.beginPath(); c.ellipse(0, -52, 7, 3, 0, 0, TAU); c.fill();
    ell(c, 0, -90, 30, 7, ['#4a3c2e', '#3a2e24', '#1e1610']); c.fillStyle = '#4a3c2e'; c.beginPath(); c.moveTo(-18, -91); c.quadraticCurveTo(-16, -112, 0, -110); c.quadraticCurveTo(16, -112, 18, -91); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); c.fillStyle = '#c42f2f'; c.fillRect(-18, -99, 36, 5);
  };

  H.medic = (c, o) => { /* Pair of Medics: bear medic; o.alt = second medic */
    shadow(c, 44); const f = o.alt ? ['#e8d0b0', '#c8a478', '#8a6a3c'] : ['#c89a6a', '#a07040', '#6a4420'], tc = o.alt ? '#2fae7a' : '#e8433a';
    ell(c, -14, -4, 12, 7, f); ell(c, 14, -4, 12, 7, f); ell(c, 0, -30, 28, 30, ['#ffffff', '#f2f4f8', '#c8d0dc']);
    c.fillStyle = tc; c.fillRect(-4, -46, 8, 22); c.fillRect(-11, -39, 22, 8); c.strokeStyle = OUT; c.lineWidth = 1.6; c.strokeRect(-4, -46, 8, 22);
    ell(c, -26, -80, 11, 11, f); ell(c, 26, -80, 11, 11, f); ell(c, 0, -66, 28, 25, f); ell(c, 0, -57, 14, 10, ['#f6dcb4', '#e8c492', '#c09a64'], { out: 0, hi: false });
    c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -62, 5, 3.6, 0, 0, TAU); c.fill(); eye(c, -12, -72, 8, { look: o.look }); eye(c, 12, -72, 8, { look: o.look }); smile(c, 0, -52, 6, { open: true });
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(-24, -96, 48, 18, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = tc; c.fillRect(-4, -94, 8, 14); c.fillRect(-7, -90, 14, 6);
  };
  H.beatcop = (c, o) => { /* Beat Cops Beat Box: penguin cop with headphones */
    shadow(c, 42); ell(c, -13, -3, 12, 6, ['#ffb02a', '#e88a10', '#a85a00']); ell(c, 13, -3, 12, 6, ['#ffb02a', '#e88a10', '#a85a00']);
    ell(c, 0, -38, 30, 36, ['#4a5068', '#2a2e3c', '#12141c']); ell(c, 0, -32, 19, 26, ['#ffffff', '#f2f4f8', '#c8d0dc'], { out: 0, hi: false });
    ell(c, -30, -38, 9, 20, ['#4a5068', '#2a2e3c', '#12141c'], { rot: 0.2 }); ell(c, 30, -38, 9, 20, ['#4a5068', '#2a2e3c', '#12141c'], { rot: -0.2 });
    ell(c, 0, -74, 27, 25, ['#4a5068', '#2a2e3c', '#12141c']); ell(c, -11, -72, 12, 13, ['#fff', '#f4f4f4', '#d8d8d8']); ell(c, 11, -72, 12, 13, ['#fff', '#f4f4f4', '#d8d8d8']); eye(c, -11, -72, 7, { look: o.look }); eye(c, 11, -72, 7, { look: o.look });
    poly(c, [[-7, -64], [7, -64], [0, -52]], '#ffb02a'); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, -40, 3.5, 0, TAU); c.fill();
    c.fillStyle = '#1c3fa8'; c.beginPath(); c.arc(0, -90, 24, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); ell(c, 0, -90, 31, 5, ['#2a52c0', '#1c3fa8', '#102a70']); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, -98, 5, 0, TAU); c.fill();
    c.strokeStyle = '#e8433a'; c.lineWidth = 5; c.beginPath(); c.arc(0, -76, 32, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); ell(c, -31, -72, 8, 12, ['#ff6a52', '#d9332b', '#7a1410']); ell(c, 31, -72, 8, 12, ['#ff6a52', '#d9332b', '#7a1410']);
  };
  H.pilot = (c, o) => { /* Air Rescue: eagle pilot */
    shadow(c, 44); ell(c, -13, -3, 11, 6, ['#ffcf4a', '#e8a81c', '#a87008']); ell(c, 13, -3, 11, 6, ['#ffcf4a', '#e8a81c', '#a87008']);
    ell(c, 0, -36, 28, 34, ['#8a5a2c', '#6a4018', '#3a2008']); ell(c, 0, -30, 17, 24, ['#fff4dc', '#ecd8b0', '#c0a470'], { out: 0, hi: false });
    ell(c, -28, -36, 10, 22, ['#8a5a2c', '#6a4018', '#3a2008'], { rot: 0.25 }); ell(c, 28, -36, 10, 22, ['#8a5a2c', '#6a4018', '#3a2008'], { rot: -0.25 });
    ell(c, 0, -72, 26, 24, ['#fffaf0', '#f2e8d4', '#c8b894']);
    c.fillStyle = '#e8433a'; c.beginPath(); c.arc(0, -78, 28, Math.PI * 0.98, TAU * 1.02); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = '#fff'; c.fillRect(-4, -106, 8, 24);
    ell(c, -12, -72, 11, 11, ['#e8f6ff', '#9ad0ee', '#4a90c0'], { oc: '#2a3a4a' }); ell(c, 12, -72, 11, 11, ['#e8f6ff', '#9ad0ee', '#4a90c0'], { oc: '#2a3a4a' }); eye(c, -12, -72, 5.5, {}); eye(c, 12, -72, 5.5, {});
    c.fillStyle = '#ffcf4a'; c.beginPath(); c.moveTo(-9, -64); c.quadraticCurveTo(0, -56, 9, -64); c.quadraticCurveTo(10, -50, 0, -48); c.quadraticCurveTo(-10, -50, -9, -64); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
  };
  H.lightbot = (c, o) => { /* Red Light Blue Light: siren robot */
    shadow(c, 40); const ph = Math.sin((o.t || 0) * 6) > 0; ell(c, -14, -4, 12, 7, ['#8a90a0', '#5a6070', '#2e3240']); ell(c, 14, -4, 12, 7, ['#8a90a0', '#5a6070', '#2e3240']);
    c.fillStyle = ph ? 'rgba(255,60,50,.25)' : 'rgba(60,120,255,.25)'; c.beginPath(); c.arc(0, -86, 38, 0, TAU); c.fill();
    c.fillStyle = '#6a7080'; c.beginPath(); c.roundRect(-30, -64, 60, 8, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
    ell(c, 0, -30, 30, 28, ['#d8dce8', '#9aa2b8', '#5a6078']); ell(c, 0, -62, 26, 22, ['#d8dce8', '#9aa2b8', '#5a6078']);
    c.fillStyle = ph ? '#ff4a3a' : '#3a7aff'; c.beginPath(); c.arc(0, -78, 20, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-8, -88, 6, 3, -0.4, 0, TAU); c.fill();
    eye(c, -11, -62, 8, { look: o.look, iris: '#2a52c0' }); eye(c, 11, -62, 8, { look: o.look, iris: '#2a52c0' }); smile(c, 0, -48, 7, { open: false });
    c.fillStyle = '#ff4a3a'; c.beginPath(); c.arc(-12, -30, 6, 0, TAU); c.fill(); c.fillStyle = '#3a7aff'; c.beginPath(); c.arc(12, -30, 6, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.arc(-12, -30, 6, 0, TAU); c.arc(12, -30, 6, 0, TAU); c.stroke();
  };
  H.dispatch = (c, o) => { /* Calling All Cars: fox dispatcher */
    shadow(c, 40); const f = ['#ffa860', '#e8782a', '#a8480c'];
    ell(c, 38, -20, 16, 10, f, { rot: 0.5 }); ell(c, -13, -4, 11, 7, f); ell(c, 13, -4, 11, 7, f); ell(c, 0, -30, 24, 28, ['#2a52c0', '#1c3fa8', '#102a70']); poly(c, [[-8, -52], [0, -40], [8, -52]], '#fff');
    poly(c, [[-26, -66], [-34, -106], [-8, -78]], f[1]); poly(c, [[26, -66], [34, -106], [8, -78]], f[1]);
    ell(c, 0, -60, 28, 24, f); ell(c, 0, -50, 15, 11, ['#fff6e8', '#f8e4c8', '#d8b890'], { out: 0, hi: false }); c.fillStyle = '#1a1208'; c.beginPath(); c.ellipse(0, -54, 4.8, 3.4, 0, 0, TAU); c.fill();
    eye(c, -12, -64, 8, { look: o.look }); eye(c, 12, -64, 8, { look: o.look }); smile(c, 0, -47, 6, { open: true });
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 5; c.beginPath(); c.arc(0, -66, 30, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); ell(c, -29, -60, 8, 11, ['#4a5068', '#2a2e3c', '#12141c']); c.strokeStyle = '#2a2e3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, -50); c.quadraticCurveTo(-26, -40, -10, -44); c.stroke(); ell(c, -9, -44, 4, 3.4, ['#6a7088', '#3a4058', '#12141c']);
  };
  H.firepup = (c, o) => { /* Fire Level: dalmatian firefighter */
    shadow(c, 44); ell(c, -13, -4, 12, 7, ['#fff', '#f2f2f2', '#c8c8c8']); ell(c, 13, -4, 12, 7, ['#fff', '#f2f2f2', '#c8c8c8']);
    ell(c, 0, -30, 28, 30, ['#ffd23a', '#e8a81c', '#a87008']); c.fillStyle = '#d8dce6'; c.fillRect(-28, -34, 56, 6); c.fillRect(-28, -22, 56, 5);
    ell(c, -30, -64, 10, 20, ['#2a2e3c', '#1a1d28', '#0c0e14'], { rot: 0.3 }); ell(c, 30, -64, 10, 20, ['#2a2e3c', '#1a1d28', '#0c0e14'], { rot: -0.3 });
    ell(c, 0, -62, 28, 24, ['#ffffff', '#f6f6f6', '#c8c8c8']); c.fillStyle = '#23262e'; [[-14, -52], [16, -56], [8, -70], [-20, -68]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 3.6, 0, TAU); c.fill(); });
    ell(c, 0, -52, 13, 10, ['#ffffff', '#f2f2f2', '#d4d4d4'], { out: 0, hi: false }); c.fillStyle = '#14161c'; c.beginPath(); c.ellipse(0, -56, 5, 3.6, 0, 0, TAU); c.fill();
    eye(c, -12, -66, 8, { look: o.look }); eye(c, 12, -66, 8, { look: o.look }); smile(c, 0, -48, 6, { open: true });
    c.fillStyle = '#e8433a'; c.beginPath(); c.arc(0, -78, 25, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); ell(c, 0, -78, 32, 6, ['#ff6a52', '#d9332b', '#7a1410']); c.fillStyle = '#ffd23a'; c.beginPath(); c.roundRect(-8, -96, 16, 12, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
  };
  H.lifeguard = (c, o) => { /* Wave Crash: otter lifeguard */
    shadow(c, 44); const f = ['#b88a5a', '#8a5e32', '#523416'];
    c.strokeStyle = OUT; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, -14); c.quadraticCurveTo(54, -18, 48, -48); c.stroke(); c.strokeStyle = f[1]; c.lineWidth = 8; c.stroke();
    ell(c, -13, -4, 12, 7, f); ell(c, 13, -4, 12, 7, f); ell(c, 0, -32, 28, 30, f); ell(c, 0, -28, 17, 22, ['#f2dcb4', '#dcc08e', '#b09a68'], { out: 0, hi: false });
    c.strokeStyle = OUT; c.lineWidth = 15; c.beginPath(); c.arc(0, -34, 29, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); c.strokeStyle = '#ff5a4a'; c.lineWidth = 10; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 10; c.setLineDash([8, 14]); c.stroke(); c.setLineDash([]);
    ell(c, -22, -72, 8, 8, f); ell(c, 22, -72, 8, 8, f); ell(c, 0, -64, 27, 24, f); ell(c, 0, -54, 15, 11, ['#f6e4c0', '#e8d0a0', '#c0a470'], { out: 0, hi: false });
    c.fillStyle = '#1a1208'; c.beginPath(); c.ellipse(0, -58, 5, 3.6, 0, 0, TAU); c.fill(); c.strokeStyle = '#f2e8d0'; c.lineWidth = 1.6; [-1, 1].forEach(s => [-2, 3].forEach(d => { c.beginPath(); c.moveTo(s * 8, -54 + d); c.lineTo(s * 24, -54 + d * 2); c.stroke(); }));
    eye(c, -12, -70, 8, { look: o.look }); eye(c, 12, -70, 8, { look: o.look }); smile(c, 0, -48, 6, { open: true });
    c.fillStyle = '#ff5a4a'; c.beginPath(); c.moveTo(-26, -82); c.lineTo(26, -82); c.lineTo(32, -74); c.lineTo(-32, -74); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
  };
  H.eyebot = (c, o) => { /* Sky Eyes: police drone */
    shadow(c, 40); const sp = (o.t || 0) * 40; c.strokeStyle = '#3a4058'; c.lineWidth = 5; c.lineCap = 'round';
    [[-40, -60], [40, -60], [-40, -22], [40, -22]].forEach((p, i) => { c.beginPath(); c.moveTo(p[0] * 0.5, -44 + (p[1] < -40 ? -6 : 4)); c.lineTo(p[0], p[1]); c.stroke(); const w = 20 + Math.sin(sp + i) * 5; ell(c, p[0], p[1], w, 4, ['#8a90a0', '#5a6070', '#2e3240'], { out: 1.6, hi: false }); });
    ell(c, 0, -44, 34, 28, ['#d8dce8', '#9aa2b8', '#5a6078']); ell(c, 0, -44, 22, 20, ['#10131c', '#0a0c14', '#000']); ell(c, 0, -44, 13, 13, ['#8af0ff', '#2a9ad8', '#0a4a78'], { oc: '#8af0ff', out: 2 }); eye(c, 0, -44, 8, { look: o.look, iris: '#0a2a4a' });
    c.fillStyle = '#e8433a'; c.beginPath(); c.arc(-24, -64, 5, 0, TAU); c.fill(); c.fillStyle = '#3a7aff'; c.beginPath(); c.arc(24, -64, 5, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = 'rgba(138,240,255,.18)'; c.beginPath(); c.moveTo(-10, -30); c.lineTo(10, -30); c.lineTo(34, 0); c.lineTo(-34, 0); c.closePath(); c.fill();
  };

  H.hammy = (c, o) => { /* Orders Up: hamster cashier with paper hat + headset */
    shadow(c, 42); const f = ['#f6d29a', '#e0a860', '#b07a34'];
    ell(c, -13, -5, 11, 7, f); ell(c, 13, -5, 11, 7, f);
    ell(c, 0, -34, 29, 31, ['#e8453a', '#c42f2f', '#7a1612']); ell(c, 0, -28, 17, 20, ['#fff6e0', '#f2e0b8', '#c8a878'], { out: 0, hi: false });
    c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, -44, 5, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    ell(c, -29, -36, 9, 8, f); ell(c, 29, -36, 9, 8, f);
    ell(c, -21, -90, 9, 9, f); ell(c, 21, -90, 9, 9, f); ell(c, -21, -90, 5, 5, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false }); ell(c, 21, -90, 5, 5, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
    ell(c, 0, -68, 31, 27, f); ell(c, -17, -60, 9, 7, ['#ffc8b0', '#ff9a8a', '#e07060'], { out: 0, hi: false }); ell(c, 17, -60, 9, 7, ['#ffc8b0', '#ff9a8a', '#e07060'], { out: 0, hi: false });
    ell(c, 0, -58, 13, 9, ['#fff6e0', '#f2e0b8', '#c8a878'], { out: 0, hi: false });
    eye(c, -11, -73, 7, { look: o.look, blink: o.blink }); eye(c, 11, -73, 7, { look: o.look, blink: o.blink });
    c.fillStyle = '#3a2210'; c.beginPath(); c.ellipse(0, -62, 3.6, 2.8, 0, 0, TAU); c.fill(); smile(c, 0, -55, 6, { open: true });
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-25, -88); c.quadraticCurveTo(-22, -108, 0, -106); c.quadraticCurveTo(22, -108, 25, -88); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke();
    c.fillStyle = '#e8453a'; c.fillRect(-23, -94, 46, 7); c.strokeRect(-23, -94, 46, 7);
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 4; c.beginPath(); c.arc(0, -70, 33, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); ell(c, -32, -66, 6, 9, ['#4a5068', '#2a2e3c', '#12141c']);
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-32, -58); c.quadraticCurveTo(-30, -48, -17, -50); c.stroke(); ell(c, -16, -50, 3.4, 3, ['#6a7088', '#3a4058', '#12141c']);
  };
  H.patty = (c, o) => { /* Build a Burger: smiling burger chef */
    shadow(c, 46);
    ell(c, -14, -6, 11, 7, ['#ffe08a', '#f0b43a', '#a8700c']); ell(c, 14, -6, 11, 7, ['#ffe08a', '#f0b43a', '#a8700c']);
    ell(c, 0, -20, 38, 14, ['#f4c36a', '#d99a3a', '#9a6218']);
    c.fillStyle = '#7ccf4e'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-40, -30); for (let i = 0; i <= 8; i++) c.quadraticCurveTo(-40 + i * 10 + 5, -22 + (i % 2 ? -8 : 4), -40 + (i + 1) * 10, -30); c.lineTo(40, -38); c.lineTo(-40, -38); c.closePath(); c.fill(); c.stroke();
    ell(c, 0, -36, 38, 10, ['#8a4a2a', '#6a3418', '#3a1a0a']);
    poly(c, [[-36, -44], [36, -44], [20, -32], [8, -42], [-8, -30], [-20, -42]], '#ffd23a');
    ell(c, -18, -47, 14, 5, ['#ff7a62', '#e8453a', '#a81c14'], { hi: false }); ell(c, 18, -47, 14, 5, ['#ff7a62', '#e8453a', '#a81c14'], { hi: false });
    c.fillStyle = '#f4c36a'; c.beginPath(); c.moveTo(-42, -52); c.bezierCurveTo(-46, -112, 46, -112, 42, -52); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-16, -92, 14, 6, -0.5, 0, TAU); c.fill();
    c.fillStyle = '#fff6d8'; [[-18, -100, 0.4], [10, -104, -0.3], [28, -90, 0.8], [-30, -86, -0.6], [0, -92, 0.1]].forEach(s => { c.beginPath(); c.ellipse(s[0], s[1], 4, 2.2, s[2], 0, TAU); c.fill(); });
    eye(c, -13, -68, 7, { look: o.look, blink: o.blink }); eye(c, 13, -68, 7, { look: o.look, blink: o.blink }); smile(c, 0, -58, 8, { open: true });
    ell(c, -26, -62, 5, 4, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false }); ell(c, 26, -62, 5, 4, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-20, -104); c.bezierCurveTo(-34, -126, -8, -136, 0, -124); c.bezierCurveTo(10, -138, 34, -126, 20, -104); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke();
  };
  H.rocket = (c, o) => { /* Drive Thru Dash: rabbit driver with cap + headset */
    shadow(c, 42); const f = ['#f4f0ea', '#e0d8cc', '#b0a69a'];
    ell(c, -12, -5, 11, 7, f); ell(c, 12, -5, 11, 7, f);
    ell(c, 0, -32, 24, 29, ['#ffcf4a', '#f0a81c', '#a87008']); ell(c, 0, -30, 7, 18, ['#e8453a', '#c42f2f', '#7a1612'], { out: 0, hi: false });
    ell(c, 30, -34, 9, 8, f); c.fillStyle = '#c8873a'; c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.roundRect(26, -52, 22, 24, 3); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(30, -48, 14, 5);
    ell(c, -13, -108, 8, 22, f, { rot: -0.12 }); ell(c, 13, -108, 8, 22, f, { rot: 0.12 }); ell(c, -13, -106, 4, 16, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false, rot: -0.12 }); ell(c, 13, -106, 4, 16, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false, rot: 0.12 });
    ell(c, 0, -66, 27, 25, f); eye(c, -10, -69, 6.5, { look: o.look, blink: o.blink }); eye(c, 10, -69, 6.5, { look: o.look, blink: o.blink });
    c.fillStyle = '#ff9a9a'; c.beginPath(); c.ellipse(0, -60, 3.6, 2.6, 0, 0, TAU); c.fill(); smile(c, 0, -54, 5, { open: true }); c.fillStyle = '#fff'; c.fillRect(-3, -53, 3, 5); c.fillRect(0, -53, 3, 5); c.strokeStyle = OUT; c.lineWidth = 1.4; c.strokeRect(-3, -53, 3, 5); c.strokeRect(0, -53, 3, 5);
    c.fillStyle = '#e8453a'; c.beginPath(); c.moveTo(-26, -78); c.quadraticCurveTo(0, -102, 26, -78); c.lineTo(34, -76); c.lineTo(-26, -74); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, -88, 5, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#2a2e3c'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-27, -64); c.quadraticCurveTo(-34, -56, -24, -50); c.stroke(); ell(c, -27, -66, 5, 7, ['#4a5068', '#2a2e3c', '#12141c']);
  };
  H.penny = (c, o) => { /* Funchise: pig franchise boss in visor + tie, holding a coin */
    shadow(c, 44); const f = ['#ffc0cc', '#f598ac', '#c86078'];
    ell(c, -13, -5, 11, 7, f); ell(c, 13, -5, 11, 7, f);
    ell(c, 0, -34, 29, 31, ['#2a3350', '#1c2438', '#0c1018']); poly(c, [[-6, -58], [6, -58], [3, -44], [-3, -44]], '#fff', { oc: OUT }); poly(c, [[-5, -58], [5, -58], [0, -52]], '#e8453a'); poly(c, [[-3, -52], [3, -52], [5, -26], [0, -20], [-5, -26]], '#e8453a');
    ell(c, -30, -36, 9, 8, f); ell(c, 30, -34, 9, 8, f);
    c.fillStyle = '#ffd23a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.arc(44, -44, 13, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#c8870c'; c.font = '700 15px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText('$', 44, -39);
    poly(c, [[-24, -86], [-30, -108], [-8, -90]], f[1]); poly(c, [[24, -86], [30, -108], [8, -90]], f[1]);
    ell(c, 0, -66, 29, 26, f);
    ell(c, 0, -60, 14, 10, ['#ffd0da', '#ffa8bc', '#d87088']); c.fillStyle = '#7a2a40'; c.beginPath(); c.ellipse(-4.5, -60, 2.2, 3.2, 0, 0, TAU); c.ellipse(4.5, -60, 2.2, 3.2, 0, 0, TAU); c.fill();
    eye(c, -12, -73, 7, { look: o.look, blink: o.blink }); eye(c, 12, -73, 7, { look: o.look, blink: o.blink }); smile(c, 0, -49, 7, { open: true });
    c.fillStyle = '#3ac26a'; c.beginPath(); c.moveTo(-28, -82); c.quadraticCurveTo(0, -104, 28, -82); c.lineTo(48, -80); c.quadraticCurveTo(46, -74, 28, -75); c.lineTo(-28, -75); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke();
  };
  H.shaky = (c, o) => { /* Roller Shakes: milkshake on roller skates */
    shadow(c, 44);
    [[-16, 1], [16, 1]].forEach(s => { c.fillStyle = '#e8453a'; c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.roundRect(s[0] - 13, -14, 26, 10, 4); c.fill(); c.stroke(); c.fillStyle = '#2a2e3c'; c.beginPath(); c.arc(s[0] - 8, -3, 5, 0, TAU); c.arc(s[0] + 8, -3, 5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(s[0] - 8, -3, 1.8, 0, TAU); c.arc(s[0] + 8, -3, 1.8, 0, TAU); c.fill(); });
    c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-30, -78); c.lineTo(30, -78); c.lineTo(22, -14); c.lineTo(-22, -14); c.closePath(); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.moveTo(-30, -78); c.lineTo(30, -78); c.lineTo(22, -14); c.lineTo(-22, -14); c.closePath(); c.clip(); c.fillStyle = '#e8453a'; for (let i = -3; i < 4; i += 2) { c.fillRect(i * 9 - 4.5, -80, 9, 70); } c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-28, -78, 10, 66); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-30, -78); c.lineTo(30, -78); c.lineTo(22, -14); c.lineTo(-22, -14); c.closePath(); c.stroke();
    ell(c, 0, -90, 36, 18, ['#ffc8dc', '#ff9ac0', '#c86088']); ell(c, -14, -104, 16, 12, ['#fff', '#fbe8f0', '#e0b8c8']); ell(c, 12, -108, 16, 12, ['#fff', '#fbe8f0', '#e0b8c8']); ell(c, 0, -114, 12, 10, ['#fff', '#fbe8f0', '#e0b8c8']);
    ell(c, 2, -124, 6, 6, ['#ff5a5a', '#d82020', '#7a0808']); c.strokeStyle = '#e8453a'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, -118); c.lineTo(30, -138); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(16, -118); c.lineTo(32, -138); c.stroke();
    eye(c, -11, -60, 6.5, { look: o.look, blink: o.blink }); eye(c, 11, -60, 6.5, { look: o.look, blink: o.blink }); smile(c, 0, -46, 8, { open: true });
    ell(c, -19, -50, 5, 3.6, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false }); ell(c, 19, -50, 5, 3.6, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
    ell(c, -34, -44, 7, 7, ['#fff', '#f2f2f2', '#c8c8c8']); ell(c, 34, -44, 7, 7, ['#fff', '#f2f2f2', '#c8c8c8']);
  };

  /* ---------- fashion set ---------- */
  H.curly = (c, o) => { /* Up Do: poodle hairstylist with a pompadour, holding scissors */
    shadow(c, 44); const w = ['#fff4e4', '#f2dcc0', '#c8a888'];
    ell(c, -13, -5, 11, 7, w); ell(c, 13, -5, 11, 7, w);
    ell(c, 0, -34, 28, 31, ['#ff8ab8', '#e8528c', '#a02a5a']); poly(c, [[-9, -58], [0, -50], [9, -58]], '#fff');
    ell(c, -32, -38, 9, 9, w); ell(c, 32, -36, 9, 9, w);
    c.strokeStyle = '#c8c8d8'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(40, -42); c.lineTo(52, -62); c.moveTo(46, -40); c.lineTo(44, -64); c.stroke(); c.strokeStyle = '#e8453a'; c.beginPath(); c.arc(38, -38, 4.2, 0, TAU); c.arc(46, -36, 4.2, 0, TAU); c.stroke();
    ell(c, -33, -76, 13, 20, w, { rot: .25 }); ell(c, 33, -76, 13, 20, w, { rot: -.25 });
    ell(c, 0, -68, 27, 25, w);
    [[-22, -96, 12], [-9, -104, 14], [8, -104, 14], [22, -96, 12], [0, -112, 12], [-15, -112, 10], [15, -112, 10]].forEach(p => ell(c, p[0], p[1], p[2], p[2] * .9, w));
    ell(c, 0, -60, 10, 8, ['#ffe8d0', '#f2c8a0', '#c8987a']); c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -63, 5, 3.6, 0, 0, TAU); c.fill();
    eye(c, -11, -73, 6.5, { look: o.look, blink: o.blink }); eye(c, 11, -73, 6.5, { look: o.look, blink: o.blink }); smile(c, 0, -53, 6.5, { open: true });
    ell(c, -19, -64, 4.4, 3.2, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false }); ell(c, 19, -64, 4.4, 3.2, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
  };
  H.dusty = (c, o) => { /* Nail Saloon: cowgirl cat with a polish bottle */
    shadow(c, 44); const f = ['#ffb86a', '#f0883a', '#b05a1a'];
    ell(c, -13, -5, 11, 7, f); ell(c, 13, -5, 11, 7, f);
    ell(c, 0, -34, 28, 31, ['#e8453a', '#b3201a', '#6e0e0a']); poly(c, [[-5, -60], [5, -60], [0, -50]], '#ffd23a');
    ell(c, -30, -38, 9, 9, f); ell(c, 32, -38, 9, 9, f);
    c.fillStyle = '#ff7ac0'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(37, -58, 14, 18, 3); c.fill(); c.stroke(); c.fillStyle = '#2a2e3c'; c.beginPath(); c.roundRect(40, -68, 8, 11, 2); c.fill(); c.stroke();
    poly(c, [[-26, -86], [-30, -112], [-10, -92]], f[1]); poly(c, [[26, -86], [30, -112], [10, -92]], f[1]); poly(c, [[-24, -90], [-26, -104], [-14, -94]], '#ffc8d0', { out: 0 }); poly(c, [[24, -90], [26, -104], [14, -94]], '#ffc8d0', { out: 0 });
    ell(c, 0, -66, 29, 26, f); ell(c, 0, -58, 16, 11, ['#fff4e0', '#f2dcc0', '#c8a888']);
    c.strokeStyle = '#a05a1a'; c.lineWidth = 3; [[-18, -86, -8, -80], [0, -90, 0, -82], [18, -86, 8, -80]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.stroke(); });
    eye(c, -12, -72, 6.5, { look: o.look, blink: o.blink }); eye(c, 12, -72, 6.5, { look: o.look, blink: o.blink });
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.moveTo(-4, -61); c.lineTo(4, -61); c.lineTo(0, -56); c.closePath(); c.fill(); smile(c, 0, -52, 6, { open: false });
    c.strokeStyle = '#fff'; c.lineWidth = 1.6; [[-30, -58, -18, -56], [-30, -52, -18, -53], [30, -58, 18, -56], [30, -52, 18, -53]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.stroke(); });
    c.fillStyle = '#8a4a1c'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, -86, 42, 8, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-22, -88); c.quadraticCurveTo(-22, -116, 0, -112); c.quadraticCurveTo(22, -116, 22, -88); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffd23a'; c.fillRect(-22, -95, 44, 5);
  };
  H.chic = (c, o) => { /* Purse Vs: living handbag in shades */
    shadow(c, 42);
    c.strokeStyle = '#c8870c'; c.lineWidth = 6; c.beginPath(); c.arc(0, -78, 24, Math.PI, 0); c.stroke(); c.strokeStyle = '#ffd23a'; c.lineWidth = 3; c.beginPath(); c.arc(0, -78, 24, Math.PI, 0); c.stroke();
    ell(c, -16, -6, 8, 6, ['#2a1a3a', '#1a0e28', '#0a0614']); ell(c, 16, -6, 8, 6, ['#2a1a3a', '#1a0e28', '#0a0614']); c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(-16, -12); c.lineTo(-16, -24); c.moveTo(16, -12); c.lineTo(16, -24); c.stroke();
    c.fillStyle = rg(c, 0, -50, 50, ['#ff7ac0', '#e8348a', '#8a1a52'], -15, -70); c.strokeStyle = OUT; c.lineWidth = 2.8; c.beginPath(); c.moveTo(-40, -76); c.lineTo(40, -76); c.lineTo(46, -26); c.quadraticCurveTo(0, -14, -46, -26); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.moveTo(-40, -76); c.quadraticCurveTo(0, -60, 40, -76); c.lineTo(42, -70); c.quadraticCurveTo(0, -52, -42, -70); c.closePath(); c.fill();
    c.fillStyle = '#ffd23a'; c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.roundRect(-9, -70, 18, 11, 3); c.fill(); c.stroke(); c.fillStyle = '#c8870c'; c.beginPath(); c.arc(0, -64, 2.4, 0, TAU); c.fill();
    shades(c, 0, -48, 24); smile(c, 0, -30, 8, { open: true }); ell(c, -26, -34, 5, 3.6, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false }); ell(c, 26, -34, 5, 3.6, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
    ell(c, -48, -44, 7, 7, ['#fff', '#f2f2f2', '#c8c8c8']); ell(c, 48, -44, 7, 7, ['#fff', '#f2f2f2', '#c8c8c8']);
  };
  H.flora = (c, o) => { /* Mani Pedi Ready: spa flamingo in a towel wrap */
    shadow(c, 40); c.strokeStyle = '#ff9ab8'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, -4); c.moveTo(10, -16); c.lineTo(10, -4); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, -4); c.moveTo(10, -16); c.lineTo(10, -4); c.stroke();
    c.strokeStyle = '#ff9ab8'; c.lineWidth = 11; c.beginPath(); c.moveTo(0, -48); c.quadraticCurveTo(-30, -70, -6, -92); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-5, -50); c.quadraticCurveTo(-35, -70, -11, -95); c.moveTo(5, -50); c.quadraticCurveTo(-26, -70, -1, -89); c.stroke();
    ell(c, 0, -32, 28, 24, ['#ffc0d8', '#ff8ab4', '#c8508a']); ell(c, 20, -34, 12, 8, ['#ffa8c8', '#ff7aa8', '#c8508a'], { rot: -.5 });
    c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(-26, -24, 52, 14, 5); c.fill(); c.stroke(); c.fillStyle = '#7ad8e8'; c.fillRect(-26, -19, 52, 3);
    ell(c, -6, -100, 19, 17, ['#ffc0d8', '#ff8ab4', '#c8508a']);
    c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-26, -104); c.quadraticCurveTo(-6, -138, 16, -104); c.quadraticCurveTo(-6, -112, -26, -104); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#7ad8e8'; c.beginPath(); c.arc(-6, -118, 4.4, 0, TAU); c.fill();
    c.fillStyle = '#ffd23a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(6, -102); c.quadraticCurveTo(26, -100, 24, -90); c.quadraticCurveTo(14, -92, 4, -94); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#2a1608'; c.beginPath(); c.moveTo(20, -91); c.quadraticCurveTo(25, -90, 24, -90); c.quadraticCurveTo(18, -92, 20, -91); c.fill();
    eye(c, -10, -100, 6, { look: o.look, blink: o.blink }); eye(c, 3, -100, 5, { look: o.look, blink: o.blink }); ell(c, -17, -94, 4, 3, ['#ffc0c0', '#ff9a9a', '#e07070'], { out: 0, hi: false });
    c.strokeStyle = '#3ac26a'; c.lineWidth = 2.4; c.fillStyle = '#7ae8a8'; c.beginPath(); c.ellipse(-8, -88, 7, 3.6, -.5, 0, TAU); c.fill(); c.stroke();
  };
  H.vogue = (c, o) => { /* Fashion Passion: fox in beret and shades */
    shadow(c, 44); const f = ['#ffa04a', '#e8701c', '#a0440a'];
    ell(c, -13, -5, 11, 7, ['#3a2a2a', '#241818', '#0a0606']); ell(c, 13, -5, 11, 7, ['#3a2a2a', '#241818', '#0a0606']);
    c.fillStyle = '#e8453a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(24, -30); c.quadraticCurveTo(54, -20, 52, -42); c.quadraticCurveTo(40, -50, 24, -44); c.closePath(); c.fill(); c.stroke();
    ell(c, 0, -34, 27, 31, ['#2a2a3a', '#1a1a26', '#08080e']); ell(c, 0, -38, 12, 22, ['#fff', '#f4ecdc', '#c8b898'], { hi: false });
    c.fillStyle = '#e8453a'; c.beginPath(); c.moveTo(-24, -56); c.lineTo(24, -56); c.lineTo(20, -48); c.lineTo(-20, -48); c.closePath(); c.fill(); c.stroke();
    ell(c, -31, -38, 9, 9, f); ell(c, 31, -38, 9, 9, f);
    c.fillStyle = '#2a2a3a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(34, -52, 24, 16, 3); c.fill(); c.stroke(); c.fillStyle = '#ffd23a'; c.fillRect(44, -54, 4, 5);
    poly(c, [[-24, -86], [-30, -114], [-8, -92]], f[1]); poly(c, [[24, -86], [30, -114], [8, -92]], f[1]); poly(c, [[-22, -90], [-26, -106], [-13, -94]], '#2a2a3a', { out: 0 }); poly(c, [[22, -90], [26, -106], [13, -94]], '#2a2a3a', { out: 0 });
    ell(c, 0, -66, 29, 25, f); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-28, -60); c.quadraticCurveTo(-10, -56, 0, -46); c.quadraticCurveTo(10, -56, 28, -60); c.quadraticCurveTo(14, -42, 0, -42); c.quadraticCurveTo(-14, -42, -28, -60); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -56, 4.4, 3.2, 0, 0, TAU); c.fill(); shades(c, 0, -72, 20); smile(c, 0, -49, 6, { open: false });
    c.fillStyle = '#e8453a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.ellipse(-4, -91, 28, 9, -.12, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#c8281e'; c.beginPath(); c.arc(-4, -101, 3.4, 0, TAU); c.fill(); c.stroke();
  };
  H.chrono = (c, o) => { /* Style Era: time-traveling raccoon in a top hat with a clock */
    shadow(c, 44); const f = ['#b8b8c8', '#8a8a9c', '#4a4a5c'];
    ell(c, -13, -5, 11, 7, ['#3a3a4a', '#26262e', '#0a0a10']); ell(c, 13, -5, 11, 7, ['#3a3a4a', '#26262e', '#0a0a10']);
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.fillStyle = f[1]; c.beginPath(); c.moveTo(-22, -22); c.quadraticCurveTo(-58, -34, -52, -62); c.quadraticCurveTo(-40, -48, -26, -42); c.fill(); c.stroke(); c.fillStyle = '#26262e'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-44 - i * 1.5, -34 - i * 9, 6, 3.4, -.6, 0, TAU); c.fill(); }
    ell(c, 0, -34, 27, 31, ['#8a5acc', '#5a2a9a', '#2a0a5a']); c.fillStyle = '#ffd23a'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.arc(0, -30, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -30, 8, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -36); c.moveTo(0, -30); c.lineTo(5, -28); c.stroke();
    ell(c, -30, -38, 9, 9, f); ell(c, 30, -38, 9, 9, f);
    poly(c, [[-24, -84], [-30, -104], [-8, -90]], f[1]); poly(c, [[24, -84], [30, -104], [8, -90]], f[1]);
    ell(c, 0, -66, 29, 25, f); c.fillStyle = '#26262e'; c.beginPath(); c.moveTo(-28, -74); c.quadraticCurveTo(0, -84, 28, -74); c.quadraticCurveTo(24, -58, 14, -64); c.quadraticCurveTo(0, -70, -14, -64); c.quadraticCurveTo(-24, -58, -28, -74); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    ell(c, 0, -52, 14, 10, ['#fff', '#f2f2f2', '#c8c8c8']); c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(0, -56, 4.4, 3.2, 0, 0, TAU); c.fill();
    eye(c, -12, -71, 6, { look: o.look, blink: o.blink }); eye(c, 12, -71, 6, { look: o.look, blink: o.blink }); smile(c, 0, -48, 6.5, { open: true });
    c.fillStyle = '#26262e'; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, -86, 34, 7, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-20, -122, 40, 36, 4); c.fill(); c.stroke(); c.fillStyle = '#ff7ac0'; c.fillRect(-20, -96, 40, 8); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(8, -108, 6, 0, TAU); c.fill(); c.stroke();
  };
  function draw(c, name, x, y, s, o) { o = o || {}; c.save(); c.translate(x, y); c.scale(s * (o.flip ? -1 : 1), s); if (o.bob) c.translate(0, -Math.abs(Math.sin(o.bob)) * 6); H[name](c, o); c.restore(); }
  function mount(id,name,opt){const cv=document.getElementById(id);if(!cv)return;let t=0;(function f(){requestAnimationFrame(f);const w=cv.clientWidth,hh=cv.clientHeight;if(!w)return;t+=1/60;const d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(w*d)){cv.width=Math.round(w*d);cv.height=Math.round(hh*d);}const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,hh);if(cv.dataset.game){const tt=document.getElementById('title');if(tt&&tt.classList.contains('show'))return;}const s=Math.min(hh/125,w/160)*1.0;if(!cv.dataset.game){c.fillStyle='rgba(255,255,255,.14)';c.beginPath();c.ellipse(w/2,hh-8,w*0.34,hh*0.42,0,0,6.3);c.fill();}draw(c,name,w/2,hh-8,s,Object.assign({t:t,bob:t*3.2,look:Math.sin(t)*1,blink:(t%3.4)<0.12},opt||{}));})();}
  return { mount, draw, names: Object.keys(H), eye, ell };
})();
