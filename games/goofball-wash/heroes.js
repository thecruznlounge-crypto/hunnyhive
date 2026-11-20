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
  function draw(c, name, x, y, s, o) { o = o || {}; c.save(); c.translate(x, y); c.scale(s * (o.flip ? -1 : 1), s); if (o.bob) c.translate(0, -Math.abs(Math.sin(o.bob)) * 6); H[name](c, o); c.restore(); }
  function mount(id,name,opt){const cv=document.getElementById(id);if(!cv)return;let t=0;(function f(){requestAnimationFrame(f);const w=cv.clientWidth,hh=cv.clientHeight;if(!w)return;t+=1/60;const d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(w*d)){cv.width=Math.round(w*d);cv.height=Math.round(hh*d);}const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,hh);if(cv.dataset.game){const tt=document.getElementById('title');if(tt&&tt.classList.contains('show'))return;}const s=Math.min(hh/125,w/160)*1.0;if(!cv.dataset.game){c.fillStyle='rgba(255,255,255,.14)';c.beginPath();c.ellipse(w/2,hh-8,w*0.34,hh*0.42,0,0,6.3);c.fill();}draw(c,name,w/2,hh-8,s,Object.assign({t:t,bob:t*3.2,look:Math.sin(t)*1,blink:(t%3.4)<0.12},opt||{}));})();}
  return { mount, draw, names: Object.keys(H), eye, ell };
})();
