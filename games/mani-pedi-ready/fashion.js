/* Fashion - drawing helpers shared by the fashion games (heads + hair, hands + nails, purses, outfit pieces). */
(function (g) {
  'use strict';
  const TAU = Math.PI * 2, OUT = '#3a1230';
  const SKIN = ['#ffdcb8', '#f5c08a', '#d89a64', '#a8683c', '#7a4426', '#5a3018'];
  const HAIR = { black: '#2a1c24', brown: '#6a3a1c', blonde: '#f2cf6a', red: '#d0402c', pink: '#ff7ac0', blue: '#4a8ae8', purple: '#a05ae8', teal: '#2ac8b8', silver: '#d4d6e4' };
  const shade = (hex, k) => { if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]; const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; r = Math.max(0, Math.min(255, Math.round(r * k))); gg = Math.max(0, Math.min(255, Math.round(gg * k))); b = Math.max(0, Math.min(255, Math.round(b * k))); return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1); };
  function grad(c, x, y, r, col) { const gr = c.createRadialGradient(x - r * .3, y - r * .4, 1, x, y, r * 1.1); gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(.7, col); gr.addColorStop(1, shade(col, .7)); return gr; }
  function blob(c, x, y, rx, ry, col, o) { o = o || {}; c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.fillStyle = grad(c, 0, 0, Math.max(rx, ry), col); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill(); if (o.out !== 0) { c.strokeStyle = OUT; c.lineWidth = o.out || 2.4; c.stroke(); } c.restore(); }
  function rr(c, x, y, w, h, r, fill, lw) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); if (lw !== 0) { c.strokeStyle = OUT; c.lineWidth = lw || 2.4; c.stroke(); } }
  function pth(c, pts, fill, lw) { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); if (lw !== 0) { c.strokeStyle = OUT; c.lineWidth = lw || 2.4; c.lineJoin = 'round'; c.stroke(); } }

  /* ---------- hair ---------- */
  const STYLES = ['bun', 'pony', 'braid', 'curls', 'bob', 'mohawk', 'pixie', 'afro'];
  function hairBack(c, st, col) {
    if (st === 'afro') { blob(c, 0, -14, 64, 62, col); }
    if (st === 'bob') { blob(c, -40, 12, 18, 44, col); blob(c, 40, 12, 18, 44, col); blob(c, 0, -8, 46, 48, col); }
    if (st === 'pony') { c.save(); c.translate(46, -26); c.rotate(.3); blob(c, 0, 30, 15, 42, col); blob(c, 0, 66, 11, 22, col); c.restore(); }
    if (st === 'braid') { for (let i = 0; i < 7; i++) blob(c, -42 + Math.sin(i * 1.2) * 4, 8 + i * 14, 11 - i * .6, 9, i % 2 ? shade(col, .85) : col); blob(c, 0, -10, 46, 46, col); }
  }
  function hairFront(c, st, col) {
    const cap = () => { c.fillStyle = grad(c, 0, -30, 50, col); c.beginPath(); c.moveTo(-44, -6); c.quadraticCurveTo(-48, -62, 0, -64); c.quadraticCurveTo(48, -62, 44, -6); c.quadraticCurveTo(34, -34, 0, -38); c.quadraticCurveTo(-34, -34, -44, -6); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); };
    if (st === 'bun') { blob(c, 0, -78, 20, 18, col); cap(); c.strokeStyle = shade(col, .7); c.lineWidth = 1.6; c.beginPath(); c.arc(0, -78, 11, .3, 2.6); c.stroke(); }
    else if (st === 'pony') { cap(); blob(c, 40, -34, 8, 8, '#ff7ac0'); }
    else if (st === 'braid') { cap(); }
    else if (st === 'curls') { cap(); [[-42, -24], [-46, -4], [-32, -44], [-14, -56], [14, -56], [32, -44], [46, -4], [42, -24], [0, -62]].forEach(p => blob(c, p[0], p[1], 13, 13, col)); [[-40, 14], [40, 14]].forEach(p => blob(c, p[0], p[1], 12, 12, col)); }
    else if (st === 'bob') { cap(); c.fillStyle = grad(c, 0, -24, 40, col); c.beginPath(); c.moveTo(-36, -30); c.quadraticCurveTo(0, -18, 36, -30); c.lineTo(34, -40); c.quadraticCurveTo(0, -46, -34, -40); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    else if (st === 'mohawk') { [[-24, -50, -30], [-12, -62, -14], [0, -70, 0], [12, -62, 14], [24, -50, 30]].forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(p[2] * Math.PI / 180); pth(c, [[-9, 10], [0, -34], [9, 10]], col); c.restore(); }); blob(c, -38, -8, 6, 14, shade(col, .6), { out: 0 }); blob(c, 38, -8, 6, 14, shade(col, .6), { out: 0 }); }
    else if (st === 'pixie') { cap(); pth(c, [[-44, -8], [-28, -44], [-4, -30], [16, -42], [40, -14], [44, -8], [46, -30], [0, -66], [-46, -30]], col, 2.4); }
    else if (st === 'afro') { c.fillStyle = grad(c, 0, -34, 60, col); c.beginPath(); c.moveTo(-46, -8); c.quadraticCurveTo(-50, -68, 0, -66); c.quadraticCurveTo(50, -68, 46, -8); c.quadraticCurveTo(36, -36, 0, -40); c.quadraticCurveTo(-36, -36, -46, -8); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); }
  }
  function acc(c, a) {
    if (a === 'bow') { pth(c, [[0, -64], [-24, -80], [-24, -50]], '#ff4fa3'); pth(c, [[0, -64], [24, -80], [24, -50]], '#ff4fa3'); blob(c, 0, -64, 7, 7, '#ff8ac8'); }
    else if (a === 'flower') { for (let i = 0; i < 5; i++) { const an = i * TAU / 5; blob(c, -26 + Math.cos(an) * 9, -52 + Math.sin(an) * 9, 7, 7, '#fff'); } blob(c, -26, -52, 6, 6, '#ffd23a'); }
    else if (a === 'tiara') { pth(c, [[-26, -56], [-20, -78], [-10, -62], [0, -84], [10, -62], [20, -78], [26, -56]], '#ffd23a'); blob(c, 0, -74, 4, 4, '#7ad8ff', { out: 1.5 }); }
    else if (a === 'clip') { c.save(); c.translate(28, -50); c.rotate(.4); blob(c, -6, 0, 8, 6, '#7a5ae8', { rot: -.5 }); blob(c, 6, 0, 8, 6, '#a98aff', { rot: .5 }); c.restore(); }
    else if (a === 'band') { c.strokeStyle = '#ff4fa3'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-42, -22); c.quadraticCurveTo(0, -70, 42, -22); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); }
    else if (a === 'shades') { c.fillStyle = '#12141c'; c.beginPath(); c.roundRect(-32, -16, 26, 16, 6); c.roundRect(6, -16, 26, 16, 6); c.fill(); c.fillRect(-8, -12, 16, 4); }
  }
  /* head(c, x, y, s, {skin, style, color, acc, t, mood}) - head centered at (x,y) face center; neck + shoulders below */
  function head(c, x, y, s, o) {
    o = o || {}; const skin = o.skin || SKIN[1], col = HAIR[o.color] || o.color || HAIR.brown, blink = ((o.t || 0) % 3.6) < .12, mood = o.mood == null ? 1 : o.mood;
    c.save(); c.translate(x, y); c.scale(s, s);
    hairBack(c, o.style, col);
    c.fillStyle = shade(skin, .92); c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(-14, 28, 28, 34, 8); c.fill(); c.stroke();
    c.fillStyle = o.top || '#ff7ac0'; c.beginPath(); c.moveTo(-58, 96); c.quadraticCurveTo(-52, 56, -14, 54); c.lineTo(14, 54); c.quadraticCurveTo(52, 56, 58, 96); c.closePath(); c.fill(); c.stroke();
    blob(c, -41, 2, 6, 10, skin); blob(c, 41, 2, 6, 10, skin);
    blob(c, 0, 0, 40, 46, skin);
    hairFront(c, o.style, col);
    const eyeY = 2, look = o.look || 0;
    [-15, 15].forEach(ex => { if (blink) { c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(ex - 7, eyeY); c.quadraticCurveTo(ex, eyeY + 4, ex + 7, eyeY); c.stroke(); } else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, eyeY, 7.5, 8.5, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.fillStyle = '#3a2418'; c.beginPath(); c.ellipse(ex + look * 2, eyeY + 1, 5, 6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + look * 2 - 1.6, eyeY - 2, 1.8, 0, TAU); c.fill(); } });
    blob(c, -26, 18, 7, 4.5, '#ff9ab0', { out: 0 }); blob(c, 26, 18, 7, 4.5, '#ff9ab0', { out: 0 });
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
    if (mood > .6) { c.moveTo(-12, 26); c.quadraticCurveTo(0, 38, 12, 26); } else if (mood > .3) { c.moveTo(-9, 31); c.lineTo(9, 31); } else { c.moveTo(-11, 34); c.quadraticCurveTo(0, 24, 11, 34); } c.stroke();
    if (o.acc === 'shades') { c.save(); c.translate(0, 8); acc(c, 'shades'); c.restore(); } else if (o.acc) acc(c, o.acc);
    c.restore();
  }
  /* ---------- hand ---------- */
  const FING = [[-33, 44], [-11, 54], [11, 50], [33, 38]];
  function handNails() { const n = FING.map(f => ({ x: f[0], y: -34 - f[1] + 9, rx: 8.6, ry: 11 })); n.push({ x: -69, y: -9, rx: 8.6, ry: 11, rot: -.9 }); return n; }
  /* hand(c,x,y,s,{skin,nails:[{c:'#hex',p:'stripe'|'dot'|'heart'|'glitter'|'tip'|null,cov:0..1}]}) */
  function hand(c, x, y, s, o) {
    o = o || {}; const skin = o.skin || SKIN[1]; c.save(); c.translate(x, y); c.scale(s, s);
    FING.forEach(f => { c.fillStyle = skin; c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.roundRect(f[0] - 10, -34 - f[1], 20, f[1] + 20, 10); c.fill(); c.stroke(); });
    c.save(); c.translate(-44, 12); c.rotate(-.9); c.fillStyle = skin; c.beginPath(); c.roundRect(-10, -38, 20, 54, 10); c.fill(); c.stroke(); c.restore();
    c.fillStyle = grad(c, 0, 0, 60, skin); c.beginPath(); c.roundRect(-46, -40, 92, 92, 26); c.fill(); c.stroke();
    c.fillStyle = shade(skin, .93); c.beginPath(); c.roundRect(-34, 50, 68, 40, 8); c.fill(); c.stroke();
    c.restore();
  }
  function nail(c, wx, wy, s, n, nl) { /* draw one nail polish at world (wx,wy) with scale s */
    c.save(); c.translate(wx, wy); c.scale(s, s); if (nl.rot) c.rotate(nl.rot); const rx = nl.rx, ry = nl.ry;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.strokeStyle = 'rgba(80,30,60,.55)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill(); c.stroke();
    if (n && n.c && n.cov > 0) { c.save(); c.beginPath(); c.ellipse(0, 0, rx - .6, ry - .6, 0, 0, TAU); c.clip(); c.fillStyle = n.c; c.fillRect(-rx, ry - 2 * ry * Math.min(1, n.cov), 2 * rx, 2 * ry); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-rx * .35, -ry * .35, rx * .22, ry * .38, .2, 0, TAU); c.fill();
      if (n.cov >= .99 && n.p) pattern(c, n.p, rx, ry); c.restore(); }
    c.restore();
  }
  function pattern(c, p, rx, ry) {
    if (p === 'stripe') { c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-rx, -ry * .1, 2 * rx, ry * .35); }
    else if (p === 'dot') { c.fillStyle = 'rgba(255,255,255,.9)'; [[-.35, -.4], [.35, -.1], [-.2, .4]].forEach(d => { c.beginPath(); c.arc(d[0] * rx, d[1] * ry, rx * .26, 0, TAU); c.fill(); }); }
    else if (p === 'heart') { c.fillStyle = '#fff'; c.font = (rx * 1.6) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♥', 0, ry * .1); }
    else if (p === 'glitter') { for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? '#fff' : '#ffe38a'; c.fillRect(Math.sin(i * 7.3) * rx * .8, Math.cos(i * 5.1) * ry * .85, 2.2, 2.2); } }
    else if (p === 'tip') { c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(-rx, -ry, 2 * rx, ry * .5); }
  }
  /* ---------- purses ---------- */
  const PSHAPE = ['tote', 'clutch', 'satchel', 'bucket', 'round', 'hobo'];
  function purse(c, x, y, s, o) {
    const col = o.color || '#e8348a', trim = o.trim || '#ffd23a', dk = shade(col, .72), lt = shade(col, 1.2); c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
    const handle = (r, w, h0) => { c.strokeStyle = trim; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(0, h0, r, Math.PI, 0); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); };
    const body = (path) => { c.fillStyle = (() => { const gr = c.createLinearGradient(-40, -30, 40, 40); gr.addColorStop(0, lt); gr.addColorStop(.6, col); gr.addColorStop(1, dk); return gr; })(); path(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke(); };
    const sh = o.shape;
    if (sh === 'tote') { handle(22, 0, -14); body(() => { c.beginPath(); c.moveTo(-36, -14); c.lineTo(36, -14); c.lineTo(42, 38); c.quadraticCurveTo(0, 46, -42, 38); c.closePath(); }); c.fillStyle = dk; c.fillRect(-36, -14, 72, 8); }
    else if (sh === 'clutch') { body(() => { c.beginPath(); c.roundRect(-44, -18, 88, 50, 10); }); c.fillStyle = dk; c.beginPath(); c.moveTo(-44, -18); c.lineTo(44, -18); c.lineTo(0, 8); c.closePath(); c.fill(); c.stroke(); blob(c, 0, 8, 6, 6, trim, { out: 1.8 }); }
    else if (sh === 'satchel') { handle(18, 0, -18); body(() => { c.beginPath(); c.roundRect(-38, -18, 76, 54, 8); }); c.fillStyle = dk; c.beginPath(); c.roundRect(-38, -18, 76, 24, [8, 8, 0, 0]); c.fill(); c.stroke(); rr(c, -7, 0, 14, 14, 3, trim, 2); }
    else if (sh === 'bucket') { handle(20, 0, -8); body(() => { c.beginPath(); c.moveTo(-32, -8); c.lineTo(32, -8); c.lineTo(26, 38); c.quadraticCurveTo(0, 46, -26, 38); c.closePath(); }); c.strokeStyle = trim; c.lineWidth = 3; c.beginPath(); c.moveTo(-32, -2); c.quadraticCurveTo(0, 6, 32, -2); c.stroke(); }
    else if (sh === 'round') { handle(18, 0, -22); body(() => { c.beginPath(); c.arc(0, 8, 36, 0, TAU); }); c.strokeStyle = trim; c.lineWidth = 3; c.beginPath(); c.arc(0, 8, 28, .2, TAU - .2); c.stroke(); blob(c, 0, -18, 5, 5, trim, { out: 1.6 }); }
    else { handle(24, 0, -10); body(() => { c.beginPath(); c.moveTo(-40, -6); c.quadraticCurveTo(0, -22, 40, -6); c.quadraticCurveTo(48, 30, 18, 38); c.quadraticCurveTo(-4, 44, -26, 38); c.quadraticCurveTo(-48, 30, -40, -6); }); c.strokeStyle = dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-34, 4); c.quadraticCurveTo(0, -8, 34, 4); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-20, 4, 6, 14, .3, 0, TAU); c.fill();
    if (o.charm) { c.font = '22px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(o.charm, 30, 44); }
    c.restore();
  }
  /* ---------- outfit pieces (Fashion Passion) ---------- */
  /* piece(c, item, x, y, s) - item {slot, shape, color}; (x,y) = piece center in closet tile coordinates (size ~ 100) */
  function piece(c, it, x, y, s) {
    const col = it.color, dk = shade(col, .7), lt = shade(col, 1.2); c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
    const fill = () => { const gr = c.createLinearGradient(-30, -30, 30, 30); gr.addColorStop(0, lt); gr.addColorStop(1, dk); return gr; };
    const sh = it.shape;
    if (it.slot === 'top') {
      c.fillStyle = fill(); c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath();
      if (sh === 'tank') { c.moveTo(-22, -34); c.lineTo(-14, -34); c.quadraticCurveTo(0, -18, 14, -34); c.lineTo(22, -34); c.lineTo(26, 34); c.lineTo(-26, 34); }
      else if (sh === 'crop') { c.moveTo(-40, -22); c.lineTo(-18, -34); c.quadraticCurveTo(0, -20, 18, -34); c.lineTo(40, -22); c.lineTo(34, -6); c.lineTo(24, -10); c.lineTo(24, 14); c.lineTo(-24, 14); c.lineTo(-24, -10); c.lineTo(-34, -6); }
      else if (sh === 'blouse') { c.moveTo(-40, -22); c.lineTo(-16, -34); c.lineTo(0, -22); c.lineTo(16, -34); c.lineTo(40, -22); c.lineTo(38, 8); c.lineTo(26, 6); c.lineTo(28, 34); c.lineTo(-28, 34); c.lineTo(-26, 6); c.lineTo(-38, 8); }
      else { c.moveTo(-42, -20); c.lineTo(-16, -34); c.quadraticCurveTo(0, -24, 16, -34); c.lineTo(42, -20); c.lineTo(44, 24); c.lineTo(30, 24); c.lineTo(30, 36); c.lineTo(-30, 36); c.lineTo(-30, 24); c.lineTo(-44, 24); }
      c.closePath(); c.fill(); c.stroke();
      if (sh === 'jacket') { c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 36); c.stroke(); c.fillStyle = '#ffd23a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-5, -8 + i * 14, 2.2, 0, TAU); c.fill(); } }
    } else if (it.slot === 'bottom') {
      c.fillStyle = fill(); c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath();
      if (sh === 'skirt') { c.moveTo(-22, -30); c.lineTo(22, -30); c.lineTo(44, 30); c.quadraticCurveTo(0, 38, -44, 30); }
      else if (sh === 'jeans') { c.moveTo(-26, -34); c.lineTo(26, -34); c.lineTo(28, 38); c.lineTo(6, 38); c.lineTo(0, -4); c.lineTo(-6, 38); c.lineTo(-28, 38); }
      else if (sh === 'shorts') { c.moveTo(-26, -30); c.lineTo(26, -30); c.lineTo(30, 6); c.lineTo(6, 6); c.lineTo(0, -8); c.lineTo(-6, 6); c.lineTo(-30, 6); }
      else { c.moveTo(-22, -30); c.lineTo(22, -30); c.lineTo(34, 38); c.lineTo(-34, 38); }
      c.closePath(); c.fill(); c.stroke(); c.fillStyle = dk; c.fillRect(-23, -34, 46, 6);
    } else if (it.slot === 'shoes') {
      const one = (dx) => { c.save(); c.translate(dx, 0); c.fillStyle = fill(); c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath();
        if (sh === 'heels') { c.moveTo(-10, -16); c.lineTo(8, -16); c.lineTo(10, 8); c.lineTo(26, 18); c.lineTo(26, 24); c.lineTo(-10, 24); c.closePath(); c.fill(); c.stroke(); c.fillStyle = OUT; c.fillRect(-10, 24, 4, 12); }
        else if (sh === 'boots') { c.moveTo(-12, -30); c.lineTo(8, -30); c.lineTo(8, 4); c.lineTo(28, 14); c.lineTo(28, 28); c.lineTo(-12, 28); c.closePath(); c.fill(); c.stroke(); }
        else if (sh === 'sandals') { c.moveTo(-12, 12); c.lineTo(28, 14); c.lineTo(28, 24); c.lineTo(-12, 26); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = shade(col, 1.3); c.lineWidth = 4; c.beginPath(); c.moveTo(2, 14); c.lineTo(2, 4); c.lineTo(18, 14); c.stroke(); }
        else { c.moveTo(-14, -2); c.lineTo(6, -2); c.lineTo(10, 8); c.lineTo(30, 14); c.lineTo(30, 28); c.lineTo(-14, 28); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-14, 22, 44, 6); }
        c.restore(); };
      one(-30); c.save(); c.scale(-1, 1); c.translate(-0, 0); one(-30); c.restore();
    } else if (it.slot === 'hat') {
      c.fillStyle = fill(); c.strokeStyle = OUT; c.lineWidth = 2.6;
      if (sh === 'sun') { c.beginPath(); c.ellipse(0, 8, 46, 12, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-24, 8); c.quadraticCurveTo(-24, -26, 0, -26); c.quadraticCurveTo(24, -26, 24, 8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffd23a'; c.fillRect(-24, -2, 48, 6); }
      else if (sh === 'beanie') { c.beginPath(); c.moveTo(-32, 14); c.quadraticCurveTo(-34, -30, 0, -30); c.quadraticCurveTo(34, -30, 32, 14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = dk; c.fillRect(-33, 6, 66, 12); blob(c, 0, -32, 8, 8, '#fff'); }
      else if (sh === 'cap') { c.beginPath(); c.moveTo(-30, 12); c.quadraticCurveTo(-30, -26, 4, -26); c.quadraticCurveTo(30, -24, 30, 12); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.ellipse(34, 12, 24, 6, 0, 0, TAU); c.fillStyle = dk; c.fill(); c.stroke(); }
      else { c.beginPath(); c.ellipse(0, 14, 40, 8, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-22, -26, 44, 40, 6); c.fill(); c.stroke(); c.fillStyle = '#ff4fa3'; c.fillRect(-22, 0, 44, 8); }
    } else if (it.slot === 'bag') { purse(c, 0, 0, 1, { shape: sh, color: col, trim: '#ffd23a' }); }
    c.restore();
  }
  /* model(c,x,y,s,{skin,style,color,outfit:{top,bottom,shoes,hat,bag},t}) - full body, (x,y) = head center */
  function model(c, x, y, s, o) {
    o = o || {}; const skin = o.skin || SKIN[1], f = o.outfit || {}; c.save(); c.translate(x, y); c.scale(s, s);
    /* legs */
    c.fillStyle = shade(skin, .96); c.strokeStyle = OUT; c.lineWidth = 2.4;
    [[-14, 0], [14, 0]].forEach(l => { c.beginPath(); c.roundRect(l[0] - 9, 150, 18, 96, 8); c.fill(); c.stroke(); });
    /* torso base (skin) */
    c.beginPath(); c.roundRect(-30, 62, 60, 96, 14); c.fill(); c.stroke();
    [[-44, 0], [44, 0]].forEach(a => { c.beginPath(); c.roundRect(a[0] - 8, 66, 16, 84, 8); c.fill(); c.stroke(); });
    if (f.bottom) piece(c, f.bottom, 0, 168, 1.1);
    if (f.top) piece(c, f.top, 0, 104, 1.3);
    if (f.shoes) piece(c, f.shoes, 0, 246, 1.0);
    if (f.bag) piece(c, f.bag, 52, 150, .5);
    head(c, 0, 0, 1, { skin, style: o.style, color: o.color, acc: o.acc, t: o.t, mood: o.mood, top: 'rgba(0,0,0,0)' });
    if (f.hat) piece(c, f.hat, 0, -40, 1.0);
    c.restore();
  }

  /* tiny particle / floating-text helper */
  function fx(ctx, Food) {
    let parts = []; const rnd = (a, b) => a + Math.random() * (b - a);
    return {
      say(txt, x, y, col, size) { if (parts.some(q => q.txt === txt && q.age < .5)) return; parts.push({ txt, x, y, age: 0, life: 1.1, col, size }); },
      burst(x, y, cols, n) { for (let i = 0; i < (n || 14); i++) parts.push({ x, y, vx: rnd(-170, 170), vy: rnd(-260, -50), age: 0, life: .9, c: cols[i % cols.length] }); },
      update(dt) { parts.forEach(q => { q.age += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; } else q.y -= 34 * dt; }); parts = parts.filter(q => q.age < q.life); },
      draw(u) { parts.forEach(q => { const k = 1 - q.age / q.life; if (q.txt) { ctx.globalAlpha = Math.min(1, k * 2); Food.text(ctx, q.txt, q.x, q.y, (q.size || 22) * u, q.col || '#fff'); ctx.globalAlpha = 1; } else { ctx.globalAlpha = Math.max(0, Math.min(1, k)); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } }); },
      clear() { parts = []; }
    };
  }
  g.Fashion = { SKIN, HAIR, STYLES, PSHAPE, shade, blob, rr, pth, head, hand, handNails, nail, pattern, purse, piece, model, FING, fx };
})(window);
