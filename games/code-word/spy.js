/* Spy art kit: shaded outlined people for crowds, gates and stealth. Origin = feet centre, ~100 units tall. */
window.Spy = (function () {
  const TAU = Math.PI * 2, OUT = '#14141e';
  const SKIN = ['#f6d2b0', '#e8b88a', '#c68a58', '#8d5a36', '#5e3a20'];
  const COATS = ['#4a5568', '#8a6a3a', '#2d3a58', '#6a2a3a', '#3a5a4a', '#222633', '#a8a090', '#7a3a1a'];
  const HAIR = ['#1a1208', '#4a2a10', '#c8a050', '#8a8a92', '#a8361c', '#e8e0d0'];
  const HATS = ['none', 'fedora', 'cap', 'beret', 'top', 'hood', 'cowboy', 'bowler'];
  const GLASS = ['none', 'round', 'shades'];
  const ITEMS = ['none', 'case', 'paper', 'flower', 'umbrella'];
  const NAMES = ['Ava', 'Bruno', 'Chen', 'Dmitri', 'Esme', 'Felix', 'Gwen', 'Hugo', 'Ines', 'Jax', 'Kira', 'Leo', 'Mina', 'Nico', 'Olga', 'Pia', 'Quinn', 'Rex', 'Sven', 'Tara', 'Uma', 'Vlad', 'Wren', 'Xan', 'Yuki', 'Zed'];
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  function lg(c, x0, y0, x1, y1, a, b) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.max(0, Math.min(255, r + k)); g = Math.max(0, Math.min(255, g + k)); b = Math.max(0, Math.min(255, b + k)); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function make(o) { o = o || {}; return Object.assign({ skin: pick(SKIN), coat: pick(COATS), hair: pick(HAIR), hat: pick(HATS), glasses: pick(GLASS), stache: Math.random() < 0.25, item: pick(ITEMS), tie: pick(['#e8433a', '#ffcf4a', '#3a8ae8', '#2fae4c', '#8a3ae8']), name: pick(NAMES) }, o); }
  function ell(c, x, y, rx, ry, fill, ow) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); if (ow !== 0) { c.strokeStyle = OUT; c.lineWidth = ow || 2.2; c.stroke(); } }
  function head(c, p, x, y, r, o) {
    o = o || {}; const look = o.look || 0, mood = o.mood || 'neutral';
    /* hair back */
    if (p.hat !== 'hood' && p.hat !== 'beret') ell(c, x, y - r * 0.15, r * 1.04, r * 1.0, p.hair);
    ell(c, x, y, r * 0.95, r, lg(c, x - r, y - r, x + r, y + r, shade(p.skin.startsWith('#') ? p.skin : '#e8b88a', 14), shade(p.skin, -26)));
    ell(c, x - r * 0.95, y + r * 0.1, r * 0.2, r * 0.26, p.skin); ell(c, x + r * 0.95, y + r * 0.1, r * 0.2, r * 0.26, p.skin);
    /* eyes */
    const ey = y - r * 0.05, ex = r * 0.38;
    if (p.glasses === 'shades') { c.fillStyle = '#10121a'; c.beginPath(); c.roundRect(x - r * 0.86, ey - r * 0.22, r * 0.78, r * 0.5, r * 0.15); c.roundRect(x + r * 0.08, ey - r * 0.22, r * 0.78, r * 0.5, r * 0.15); c.fill(); c.fillRect(x - r * 0.1, ey - r * 0.1, r * 0.2, r * 0.08); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x - r * 0.7, ey - r * 0.14, r * 0.3, r * 0.07); c.fillRect(x + r * 0.24, ey - r * 0.14, r * 0.3, r * 0.07); }
    else {
      [-1, 1].forEach(s => { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + s * ex, ey, r * 0.2, r * 0.25, 0, 0, TAU); c.fill(); c.fillStyle = mood === 'angry' ? '#a01818' : '#1a1208'; c.beginPath(); c.arc(x + s * ex + look * r * 0.07, ey + r * 0.02, r * 0.11, 0, TAU); c.fill(); if (p.glasses === 'round') { c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath(); c.arc(x + s * ex, ey, r * 0.3, 0, TAU); c.stroke(); } });
      if (p.glasses === 'round') { c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x - ex + r * 0.3, ey); c.lineTo(x + ex - r * 0.3, ey); c.stroke(); }
    }
    c.strokeStyle = p.hair; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); const br = mood === 'angry' ? 0.14 : (mood === 'scared' ? -0.1 : 0); c.moveTo(x - ex - r * 0.2, ey - r * 0.38 - br * r); c.lineTo(x - ex + r * 0.2, ey - r * 0.38 + br * r); c.moveTo(x + ex + r * 0.2, ey - r * 0.38 - br * r); c.lineTo(x + ex - r * 0.2, ey - r * 0.38 + br * r); c.stroke();
    c.fillStyle = shade(p.skin, -34); c.beginPath(); c.ellipse(x, y + r * 0.2, r * 0.1, r * 0.13, 0, 0, TAU); c.fill();
    if (p.stache) { c.fillStyle = p.hair; c.beginPath(); c.ellipse(x - r * 0.2, y + r * 0.45, r * 0.26, r * 0.12, 0.25, 0, TAU); c.ellipse(x + r * 0.2, y + r * 0.45, r * 0.26, r * 0.12, -0.25, 0, TAU); c.fill(); }
    c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); if (mood === 'scared') { c.ellipse(x, y + r * 0.62, r * 0.12, r * 0.15, 0, 0, TAU); } else if (mood === 'angry') { c.moveTo(x - r * 0.25, y + r * 0.66); c.quadraticCurveTo(x, y + r * 0.5, x + r * 0.25, y + r * 0.66); } else { c.moveTo(x - r * 0.25, y + r * 0.55); c.quadraticCurveTo(x, y + r * (mood === 'happy' ? 0.82 : 0.65), x + r * 0.25, y + r * 0.55); } c.stroke();
    hat(c, p, x, y, r);
  }
  function hat(c, p, x, y, r) {
    const h = p.hat; c.lineJoin = 'round';
    if (h === 'fedora') { ell(c, x, y - r * 0.62, r * 1.5, r * 0.28, '#3a2e24'); c.fillStyle = '#4a3c2e'; c.beginPath(); c.moveTo(x - r * 0.85, y - r * 0.68); c.quadraticCurveTo(x - r * 0.8, y - r * 1.6, x, y - r * 1.5); c.quadraticCurveTo(x + r * 0.8, y - r * 1.6, x + r * 0.85, y - r * 0.68); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); c.fillStyle = '#c42f2f'; c.fillRect(x - r * 0.84, y - r * 0.9, r * 1.68, r * 0.2); }
    else if (h === 'cap') { c.fillStyle = '#2d5aa8'; c.beginPath(); c.arc(x, y - r * 0.4, r * 1.0, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); ell(c, x + r * 0.75, y - r * 0.42, r * 0.7, r * 0.14, '#1f4488'); }
    else if (h === 'beret') { ell(c, x - r * 0.1, y - r * 0.95, r * 1.2, r * 0.5, '#a8231f'); c.fillStyle = '#a8231f'; c.fillRect(x - r * 0.1, y - r * 1.5, r * 0.1, r * 0.2); }
    else if (h === 'top') { ell(c, x, y - r * 0.7, r * 1.25, r * 0.24, '#1a1a22'); c.fillStyle = '#23232e'; c.beginPath(); c.roundRect(x - r * 0.75, y - r * 2.0, r * 1.5, r * 1.35, r * 0.15); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); c.fillStyle = '#c42f2f'; c.fillRect(x - r * 0.75, y - r * 0.95, r * 1.5, r * 0.2); }
    else if (h === 'hood') { c.fillStyle = p.coat; c.beginPath(); c.arc(x, y - r * 0.1, r * 1.2, Math.PI * 0.95, TAU * 1.02); c.lineTo(x + r * 0.9, y + r * 0.3); c.lineTo(x - r * 0.9, y + r * 0.3); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); ell(c, x, y + r * 0.05, r * 0.75, r * 0.82, p.skin, 0); }
    else if (h === 'cowboy') { ell(c, x, y - r * 0.6, r * 1.7, r * 0.3, '#9a6a34'); c.fillStyle = '#b07a3a'; c.beginPath(); c.moveTo(x - r * 0.8, y - r * 0.66); c.quadraticCurveTo(x - r * 0.9, y - r * 1.5, x - r * 0.3, y - r * 1.35); c.quadraticCurveTo(x, y - r * 1.2, x + r * 0.3, y - r * 1.35); c.quadraticCurveTo(x + r * 0.9, y - r * 1.5, x + r * 0.8, y - r * 0.66); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); }
    else if (h === 'bowler') { ell(c, x, y - r * 0.64, r * 1.2, r * 0.2, '#22222a'); c.fillStyle = '#2c2c36'; c.beginPath(); c.arc(x, y - r * 0.7, r * 0.82, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); }
  }
  function person(c, p, x, y, s, o) {
    o = o || {}; const ph = o.walk || 0, bob = Math.abs(Math.sin(ph)) * 2.5, look = o.look || 0, flip = o.flip ? -1 : 1;
    c.save(); c.translate(x, y); c.scale(s * flip, s);
    if (o.shadow !== false) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 1, 24, 5, 0, 0, TAU); c.fill(); }
    const sw = Math.sin(ph) * 8;
    c.strokeStyle = OUT; c.lineWidth = 2.2;
    [[-8, sw], [8, -sw]].forEach(a => { c.fillStyle = '#23252e'; c.beginPath(); c.roundRect(a[0] - 5, -26, 10, 22, 4); c.fill(); c.stroke(); ell(c, a[0] + 1 + (a[1] > 0 ? 2 : 0), -3 - (a[1] > 0 ? 1.5 : 0), 8, 4, '#15161c'); });
    c.translate(0, -bob);
    if (p.item === 'umbrella') { c.strokeStyle = '#222'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-24, -20); c.lineTo(-24, -62); c.stroke(); c.fillStyle = '#7a2a8a'; c.beginPath(); c.arc(-24, -62, 17, Math.PI, TAU); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    const cg = lg(c, -20, -70, 20, -20, shade(p.coat, 26), shade(p.coat, -28));
    c.fillStyle = cg; c.beginPath(); c.moveTo(-16, -66); c.quadraticCurveTo(-24, -40, -22, -20); c.lineTo(22, -20); c.quadraticCurveTo(24, -40, 16, -66); c.quadraticCurveTo(0, -72, -16, -66); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke();
    c.strokeStyle = shade(p.coat, -50); c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -62); c.lineTo(0, -21); c.stroke(); c.fillStyle = shade(p.coat, -40); [-44, -34, -26].forEach(yy => { c.beginPath(); c.arc(5, yy, 1.8, 0, TAU); c.fill(); });
    c.fillStyle = '#f2f4fa'; c.beginPath(); c.moveTo(-6, -68); c.lineTo(0, -52); c.lineTo(6, -68); c.closePath(); c.fill(); c.fillStyle = p.tie; c.beginPath(); c.moveTo(-2, -60); c.lineTo(2, -60); c.lineTo(3.5, -44); c.lineTo(0, -40); c.lineTo(-3.5, -44); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = shade(p.coat, 14); c.beginPath(); c.moveTo(-17, -67); c.lineTo(-4, -69); c.lineTo(-1, -50); c.closePath(); c.moveTo(17, -67); c.lineTo(4, -69); c.lineTo(1, -50); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    [-1, 1].forEach(sd => { const sa = Math.sin(ph + (sd > 0 ? 0 : Math.PI)) * 6; c.fillStyle = shade(p.coat, -6); c.beginPath(); c.roundRect(sd * 20 - 4 + (sd > 0 ? 0 : -2), -64, 9, 32 + sa * 0.2, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); ell(c, sd * 21, -30 + sa * 0.2, 5, 5, p.skin); });
    if (p.item === 'case') { c.fillStyle = '#6a4a22'; c.beginPath(); c.roundRect(14, -26, 22, 16, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.fillStyle = '#d8b04a'; c.fillRect(22, -28, 6, 3); c.fillRect(24, -20, 3, 3); }
    else if (p.item === 'paper') { c.fillStyle = '#f6f2e0'; c.save(); c.translate(22, -40); c.rotate(0.2); c.fillRect(-8, -10, 16, 20); c.strokeStyle = OUT; c.lineWidth = 1.6; c.strokeRect(-8, -10, 16, 20); c.strokeStyle = '#8a8a8a'; c.lineWidth = 1; for (let i = -6; i < 8; i += 4) { c.beginPath(); c.moveTo(-5, i); c.lineTo(5, i); c.stroke(); } c.restore(); }
    else if (p.item === 'flower') { c.strokeStyle = '#2a7a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(22, -26); c.lineTo(22, -50); c.stroke(); [0, 1, 2, 3, 4].forEach(i => { c.fillStyle = '#ff6a8a'; c.beginPath(); c.arc(22 + Math.cos(i * 1.256) * 4.5, -52 + Math.sin(i * 1.256) * 4.5, 3.4, 0, TAU); c.fill(); }); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(22, -52, 2.6, 0, TAU); c.fill(); }
    head(c, p, 0, -85, 17, { look, mood: o.mood });
    c.restore();
  }
  function describe(p) { const t = []; if (p.hat !== 'none') t.push(p.hat === 'hood' ? 'a hood' : 'a ' + p.hat); if (p.glasses !== 'none') t.push(p.glasses === 'shades' ? 'dark shades' : 'round glasses'); if (p.stache) t.push('a moustache'); if (p.item !== 'none') t.push(p.item === 'case' ? 'a briefcase' : p.item === 'paper' ? 'a document' : p.item === 'flower' ? 'a flower' : 'an umbrella'); return t; }
  /* trait predicates for puzzles */
  function has(p, k) { const [a, b] = k.split(':'); if (a === 'hat') return b === 'any' ? p.hat !== 'none' : p.hat === b; if (a === 'glasses') return p.glasses === b; if (a === 'item') return p.item === b; if (a === 'stache') return p.stache === (b === '1'); return false; }
  function traitLabel(k) { const [a, b] = k.split(':'); if (a === 'hat') return b === 'any' ? 'wears a hat' : (b === 'hood' ? 'wears a hood' : 'wears a ' + b); if (a === 'glasses') return b === 'none' ? 'no glasses' : b === 'shades' ? 'dark shades' : 'round glasses'; if (a === 'item') return b === 'none' ? 'empty-handed' : b === 'case' ? 'carries a briefcase' : b === 'paper' ? 'holds a document' : b === 'flower' ? 'holds a flower' : 'carries an umbrella'; if (a === 'stache') return b === '1' ? 'has a moustache' : 'clean-shaven'; return k; }
  function traitIcon(c, k, x, y, s) { const p = { skin: '#e8b88a', coat: '#4a5568', hair: '#2a1a0a', hat: 'none', glasses: 'none', stache: false, item: 'none', tie: '#e8433a' }; const [a, b] = k.split(':'); if (a === 'hat') p.hat = b === 'any' ? 'fedora' : b; if (a === 'glasses') p.glasses = b; if (a === 'stache') p.stache = b === '1'; c.save(); c.translate(x, y); c.scale(s, s); head(c, p, 0, 0, 15, {}); if (a === 'item') { person(c, Object.assign(p, { item: b }), 0, 40, 0.5, { shadow: false }); } c.restore(); }
  return { make, person, head, describe, has, traitLabel, traitIcon, shade, SKIN, COATS, HAIR, HATS, GLASS, ITEMS, NAMES, ell };
})();
