/* Arctic Games - shared character renderer.
   Draws four upright, shaded characters on a canvas 2D context.
   Origin (0,0) is the point between the feet. Design box is ~100 wide x 115 tall. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
  }
  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
  }
  function ell(ctx, cx, cy, rx, ry, fill, stroke, lw, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function glossy(ctx, cx, cy, rx, ry, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 0.35 : a;
    ell(ctx, cx - rx * 0.28, cy - ry * 0.45, rx * 0.45, ry * 0.22, '#fff', null, 0, -0.5);
    ctx.restore();
  }

  /* Eyes with highlight; mood changes lids and brows. */
  function eyes(ctx, x, y, gap, size, o, colorWhite) {
    const mood = o.mood || 'neutral';
    const lx = (o.lx || 0) * size * 0.35, ly = (o.ly || 0) * size * 0.3;
    const blink = o.blink ? 0.12 : 1;
    for (let side = -1; side <= 1; side += 2) {
      const ex = x + side * gap;
      if (mood === 'dizzy') {
        ctx.strokeStyle = '#0b2545'; ctx.lineWidth = size * 0.28; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - size * 0.6, y - size * 0.6); ctx.lineTo(ex + size * 0.6, y + size * 0.6);
        ctx.moveTo(ex + size * 0.6, y - size * 0.6); ctx.lineTo(ex - size * 0.6, y + size * 0.6); ctx.stroke();
        continue;
      }
      if (colorWhite) ell(ctx, ex, y, size * 1.1, size * 1.25 * blink, '#fff');
      ell(ctx, ex + lx, y + ly, size * 0.78, size * 0.95 * blink, '#0b1a33');
      if (blink > 0.5) {
        ell(ctx, ex + lx - size * 0.25, y + ly - size * 0.3, size * 0.28, size * 0.28, '#fff');
        ell(ctx, ex + lx + size * 0.22, y + ly + size * 0.25, size * 0.13, size * 0.13, 'rgba(255,255,255,.8)');
      }
      if (mood === 'angry') {
        ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = size * 0.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - side * size * 1.1, y - size * 1.9 + size * 0.4 * 0);
        ctx.lineTo(ex + side * size * 0.9, y - size * 1.05); ctx.stroke();
      } else if (mood === 'scared') {
        ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = size * 0.3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - side * size * 0.9, y - size * 1.2);
        ctx.lineTo(ex + side * size * 0.8, y - size * 1.7); ctx.stroke();
      }
    }
  }

  function mouth(ctx, x, y, w, o, col) {
    const mood = o.mood || 'neutral';
    ctx.strokeStyle = col || '#0b1a33'; ctx.lineWidth = w * 0.18; ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'win') {
      ctx.fillStyle = '#b3243b';
      ctx.moveTo(x - w, y - 1); ctx.quadraticCurveTo(x, y + w * 1.6, x + w, y - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8fa0'; ell(ctx, x, y + w * 0.55, w * 0.45, w * 0.25, '#ff8fa0');
    } else if (mood === 'angry') {
      ctx.moveTo(x - w * 0.7, y + w * 0.35); ctx.quadraticCurveTo(x, y - w * 0.25, x + w * 0.7, y + w * 0.35); ctx.stroke();
    } else if (mood === 'scared' || mood === 'dizzy') {
      ell(ctx, x, y + 1, w * 0.4, w * 0.5, '#7a1f33');
    } else {
      ctx.moveTo(x - w * 0.7, y); ctx.quadraticCurveTo(x, y + w * 0.75, x + w * 0.7, y); ctx.stroke();
    }
  }

  function scarf(ctx, y, w, c1, c2, wob) {
    ctx.fillStyle = lin(ctx, 0, y - 8, 0, y + 12, [[0, c1], [1, c2]]);
    ctx.beginPath();
    ctx.moveTo(-w, y - 3);
    ctx.quadraticCurveTo(0, y + 14, w, y - 3);
    ctx.lineTo(w - 3, y + 9);
    ctx.quadraticCurveTo(0, y + 25, -w + 3, y + 9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.35, y + 12);
    ctx.lineTo(w * 0.75 + wob, y + 36);
    ctx.lineTo(w * 0.35 + wob, y + 33);
    ctx.lineTo(w * 0.12, y + 16);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w + 6, y + 4); ctx.quadraticCurveTo(0, y + 20, w - 6, y + 4); ctx.stroke();
  }

  const DRAW = {
    penguin(ctx, o) {
      const t = o.t || 0, wig = Math.sin(t * 6) * 0.08 * (o.moving || 0) + (o.arm || 0);
      // feet
      ell(ctx, -17, -4, 15, 7, lin(ctx, 0, -11, 0, 3, [[0, '#ffb25c'], [1, '#e8731a']]));
      ell(ctx, 17, -4, 15, 7, lin(ctx, 0, -11, 0, 3, [[0, '#ffb25c'], [1, '#e8731a']]));
      // flippers
      ctx.save(); ctx.translate(-37, -55); ctx.rotate(0.35 + wig);
      ell(ctx, 0, 14, 10, 28, lin(ctx, -10, 0, 10, 0, [[0, '#2c4d7a'], [1, '#10264a']])); ctx.restore();
      ctx.save(); ctx.translate(37, -55); ctx.rotate(-0.35 - wig);
      ell(ctx, 0, 14, 10, 28, lin(ctx, -10, 0, 10, 0, [[0, '#10264a'], [1, '#2c4d7a']])); ctx.restore();
      // body
      ell(ctx, 0, -55, 40, 52, rad(ctx, -12, -78, 4, 70, [[0, '#3b628f'], [0.5, '#1a345c'], [1, '#0c1d3c']]));
      // belly
      ell(ctx, 0, -46, 27, 40, rad(ctx, -6, -62, 3, 48, [[0, '#ffffff'], [1, '#cfe6f6']]));
      // face patches
      ell(ctx, -15, -78, 15, 17, lin(ctx, 0, -95, 0, -60, [[0, '#ffffff'], [1, '#d9eefb']]));
      ell(ctx, 15, -78, 15, 17, lin(ctx, 0, -95, 0, -60, [[0, '#ffffff'], [1, '#d9eefb']]));
      eyes(ctx, 0, -78, 15, 5.2, o, false);
      // cheeks
      ctx.globalAlpha = 0.35; ell(ctx, -26, -66, 6, 4, '#ff7f9a'); ell(ctx, 26, -66, 6, 4, '#ff7f9a'); ctx.globalAlpha = 1;
      // beak
      ctx.fillStyle = lin(ctx, 0, -76, 0, -58, [[0, '#ffc46b'], [1, '#f0801f']]);
      ctx.beginPath(); ctx.moveTo(-9, -72); ctx.quadraticCurveTo(0, -78, 9, -72); ctx.quadraticCurveTo(7, -60, 0, -57); ctx.quadraticCurveTo(-7, -60, -9, -72); ctx.fill();
      if (o.mood === 'win') mouth(ctx, 0, -55, 9, o);
      scarf(ctx, -50, 28, '#ff5a6e', '#c42a45', Math.sin(t * 5) * 3);
      glossy(ctx, -14, -92, 22, 22, 0.25);
    },
    seal(ctx, o) {
      const t = o.t || 0;
      // tail flippers
      ctx.save(); ctx.translate(-26, -8); ctx.rotate(-0.4);
      ell(ctx, 0, 0, 20, 8, lin(ctx, 0, -8, 0, 8, [[0, '#8da6c0'], [1, '#5e7a99']])); ctx.restore();
      ctx.save(); ctx.translate(26, -8); ctx.rotate(0.4);
      ell(ctx, 0, 0, 20, 8, lin(ctx, 0, -8, 0, 8, [[0, '#8da6c0'], [1, '#5e7a99']])); ctx.restore();
      // body
      ell(ctx, 0, -46, 46, 46, rad(ctx, -14, -68, 4, 74, [[0, '#b5c9de'], [0.55, '#8ea8c3'], [1, '#5f7b9a']]));
      ell(ctx, 0, -32, 31, 28, rad(ctx, -4, -42, 3, 40, [[0, '#f4f9fd'], [1, '#d3e2ef']]));
      // spots
      ell(ctx, -30, -64, 5, 4, 'rgba(70,95,125,.45)'); ell(ctx, 32, -56, 4, 3, 'rgba(70,95,125,.45)'); ell(ctx, 22, -76, 3.5, 3, 'rgba(70,95,125,.45)');
      // front flippers
      const w = Math.sin(t * 6) * 0.1 * (o.moving || 0) + (o.arm || 0);
      ctx.save(); ctx.translate(-43, -38); ctx.rotate(0.6 + w);
      ell(ctx, 0, 8, 8, 19, lin(ctx, -8, 0, 8, 0, [[0, '#7d97b3'], [1, '#556f8d']])); ctx.restore();
      ctx.save(); ctx.translate(43, -38); ctx.rotate(-0.6 - w);
      ell(ctx, 0, 8, 8, 19, lin(ctx, -8, 0, 8, 0, [[0, '#556f8d'], [1, '#7d97b3']])); ctx.restore();
      // muzzle
      ell(ctx, 0, -50, 21, 15, rad(ctx, 0, -54, 2, 26, [[0, '#fbfdff'], [1, '#d7e5f1']]));
      eyes(ctx, 0, -68, 17, 5.6, o, false);
      ell(ctx, 0, -56, 8.5, 5.5, rad(ctx, -2, -58, 1, 9, [[0, '#46506a'], [1, '#0b1a33']]));
      ell(ctx, -2.5, -58, 2.2, 1.4, 'rgba(255,255,255,.8)');
      ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, -46); ctx.stroke();
      mouth(ctx, 0, -46, 8, o);
      // whiskers
      ctx.strokeStyle = 'rgba(11,26,51,.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-12, -52); ctx.lineTo(-36, -58); ctx.moveTo(-12, -48); ctx.lineTo(-36, -46);
      ctx.moveTo(12, -52); ctx.lineTo(36, -58); ctx.moveTo(12, -48); ctx.lineTo(36, -46);
      ctx.stroke();
      // beanie
      ctx.fillStyle = lin(ctx, 0, -110, 0, -80, [[0, '#ffd45e'], [1, '#e6a21c']]);
      ctx.beginPath(); ctx.moveTo(-34, -80); ctx.quadraticCurveTo(0, -128, 34, -80); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, -86, 0, -72, [[0, '#f0b231'], [1, '#c4860f']]);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-37, -86, 74, 14, 7) : ctx.rect(-37, -86, 74, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
      for (let i = -24; i <= 24; i += 12) { ctx.beginPath(); ctx.moveTo(i, -85); ctx.lineTo(i, -73); ctx.stroke(); }
      ell(ctx, 0, -113, 9, 9, rad(ctx, -2, -115, 1, 10, [[0, '#ffffff'], [1, '#cfe3f2']]));
      glossy(ctx, -16, -78, 28, 20, 0.25);
    },
    bear(ctx, o) {
      const t = o.t || 0, w = Math.sin(t * 6) * 0.08 * (o.moving || 0) + (o.arm || 0);
      const fur = [[0, '#ffffff'], [0.6, '#f3ede1'], [1, '#d9d2c4']];
      // feet
      ell(ctx, -20, -6, 17, 9, rad(ctx, -22, -10, 1, 20, fur), '#c3bcae', 1.5);
      ell(ctx, 20, -6, 17, 9, rad(ctx, 18, -10, 1, 20, fur), '#c3bcae', 1.5);
      ell(ctx, -20, -5, 7, 4, '#6e665a'); ell(ctx, 20, -5, 7, 4, '#6e665a');
      // arms
      ctx.save(); ctx.translate(-38, -52); ctx.rotate(0.3 + w);
      ell(ctx, 0, 10, 12, 24, rad(ctx, -3, 0, 2, 30, fur), '#c3bcae', 1.5); ctx.restore();
      ctx.save(); ctx.translate(38, -52); ctx.rotate(-0.3 - w);
      ell(ctx, 0, 10, 12, 24, rad(ctx, 3, 0, 2, 30, fur), '#c3bcae', 1.5); ctx.restore();
      // body
      ell(ctx, 0, -42, 40, 40, rad(ctx, -10, -62, 4, 66, fur), '#c3bcae', 1.5);
      ell(ctx, 0, -34, 24, 26, 'rgba(255,255,255,.6)');
      // ears
      ell(ctx, -25, -100, 13, 13, rad(ctx, -27, -104, 1, 16, fur), '#c3bcae', 1.5);
      ell(ctx, 25, -100, 13, 13, rad(ctx, 23, -104, 1, 16, fur), '#c3bcae', 1.5);
      ell(ctx, -25, -99, 7, 7, '#e9b3a4'); ell(ctx, 25, -99, 7, 7, '#e9b3a4');
      // head
      ell(ctx, 0, -75, 36, 33, rad(ctx, -10, -92, 4, 60, fur), '#c3bcae', 1.5);
      ell(ctx, 0, -66, 17, 13, rad(ctx, 0, -70, 2, 22, [[0, '#ffffff'], [1, '#e8e1d3']]), '#d7cfc1', 1.2);
      eyes(ctx, 0, -80, 15, 4.8, o, false);
      ell(ctx, 0, -70, 7.5, 5, rad(ctx, -2, -72, 1, 8, [[0, '#46506a'], [1, '#0b1a33']]));
      ell(ctx, -2.2, -71.5, 2, 1.2, 'rgba(255,255,255,.8)');
      ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -65); ctx.lineTo(0, -61); ctx.stroke();
      mouth(ctx, 0, -61, 8, o);
      ctx.globalAlpha = 0.3; ell(ctx, -27, -68, 6, 4, '#ff8aa0'); ell(ctx, 27, -68, 6, 4, '#ff8aa0'); ctx.globalAlpha = 1;
      scarf(ctx, -44, 30, '#2fc2ae', '#177a6c', Math.sin(t * 5) * 3);
      glossy(ctx, -12, -92, 22, 20, 0.35);
    },
    orca(ctx, o) {
      const t = o.t || 0, w = Math.sin(t * 6) * 0.08 * (o.moving || 0) + (o.arm || 0);
      // tail flukes
      ctx.fillStyle = '#0c1626';
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-34, -10, -34, 3); ctx.quadraticCurveTo(-18, 0, -4, -2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -8); ctx.quadraticCurveTo(34, -10, 34, 3); ctx.quadraticCurveTo(18, 0, 4, -2); ctx.closePath(); ctx.fill();
      // dorsal fin
      ctx.fillStyle = lin(ctx, 0, -125, 0, -90, [[0, '#2b3a54'], [1, '#0c1626']]);
      ctx.beginPath(); ctx.moveTo(-10, -92); ctx.quadraticCurveTo(-4, -128, 14, -128); ctx.quadraticCurveTo(10, -108, 14, -92); ctx.closePath(); ctx.fill();
      // flippers
      ctx.save(); ctx.translate(-42, -48); ctx.rotate(0.5 + w);
      ell(ctx, 0, 10, 10, 25, lin(ctx, -10, 0, 10, 0, [[0, '#26364f'], [1, '#0c1626']])); ctx.restore();
      ctx.save(); ctx.translate(42, -48); ctx.rotate(-0.5 - w);
      ell(ctx, 0, 10, 10, 25, lin(ctx, -10, 0, 10, 0, [[0, '#0c1626'], [1, '#26364f']])); ctx.restore();
      // body
      ell(ctx, 0, -54, 44, 52, rad(ctx, -14, -80, 4, 76, [[0, '#3d506f'], [0.5, '#17243a'], [1, '#080f1b']]));
      // belly
      ell(ctx, 0, -34, 29, 28, rad(ctx, -4, -44, 3, 40, [[0, '#ffffff'], [1, '#cfe3f2']]));
      // eye patches
      ctx.save(); ctx.translate(-17, -76); ctx.rotate(-0.3); ell(ctx, 0, 0, 14, 8, '#fff'); ctx.restore();
      ctx.save(); ctx.translate(17, -76); ctx.rotate(0.3); ell(ctx, 0, 0, 14, 8, '#fff'); ctx.restore();
      eyes(ctx, 0, -76, 16, 4.6, o, false);
      mouth(ctx, 0, -58, 11, o, '#f4fbff');
      ctx.globalAlpha = 0.3; ell(ctx, -27, -62, 5, 3.5, '#ff8aa0'); ell(ctx, 27, -62, 5, 3.5, '#ff8aa0'); ctx.globalAlpha = 1;
      // headband
      ctx.fillStyle = lin(ctx, 0, -104, 0, -86, [[0, '#7ad9f2'], [1, '#2a9fcc']]);
      ctx.beginPath(); ctx.moveTo(-40, -86); ctx.quadraticCurveTo(0, -112, 40, -86); ctx.lineTo(38, -97); ctx.quadraticCurveTo(0, -122, -38, -97); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(38, -92); ctx.lineTo(54 + Math.sin(t * 6) * 3, -84); ctx.lineTo(40, -82); ctx.closePath(); ctx.fill();
      glossy(ctx, -14, -98, 24, 20, 0.28);
    }
  };

  const INFO = {
    bear:    { key: 'bear',    name: 'Polar Bear', tag: 'The Heavyweight', color: '#f6f1e7', accent: '#2fc2ae', weight: 5, speed: 2, grip: 4,
               gr: 'Ground Pound: a stomp that shoves everyone nearby.', pl: 'Heavy Roll: pins scatter wide, curve is hard to steer.' },
    penguin: { key: 'penguin', name: 'Penguin',    tag: 'The Slider',      color: '#1a345c', accent: '#ff5a6e', weight: 2, speed: 5, grip: 3,
               gr: 'Belly Slide: a fast dash toward the nearest rival.',   pl: 'Steady Aim: a long, steady aim line.' },
    seal:    { key: 'seal',    name: 'Seal',       tag: 'The Trickster',   color: '#8ea8c3', accent: '#ffd45e', weight: 3, speed: 4, grip: 2,
               gr: 'Flop Turn: swerve mid-slide to chase a rival.',         pl: 'Big Curve: the most spin of any animal.' },
    orca:    { key: 'orca',    name: 'Orca',       tag: 'The Smasher',     color: '#17243a', accent: '#7ad9f2', weight: 4, speed: 3, grip: 3,
               gr: 'Breach: leap and land with a shockwave.',               pl: 'Splash: pins you hit knock down their neighbors.' }
  };

  /* draw(ctx, kind, x, y, scale, opts)
     opts: t (seconds), mood, lx/ly (look -1..1), blink, moving (0..1), arm (rad),
           tilt (rad), sx/sy (squash), alpha, shadow (bool), flash (0..1), flip */
  function draw(ctx, kind, x, y, scale, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.shadow) {
      ctx.save();
      ctx.globalAlpha = 0.28 * (o.alpha == null ? 1 : o.alpha);
      ell(ctx, 0, 0, 40 * scale * (o.sx || 1), 10 * scale, '#07182e');
      ctx.restore();
    }
    ctx.scale(scale * (o.flip ? -1 : 1), scale);
    if (o.tilt) ctx.rotate(o.tilt);
    const bob = Math.sin((o.t || 0) * 3.2) * 1.6 * (o.idle === false ? 0 : 1);
    ctx.translate(0, bob);
    ctx.scale(o.sx || 1, o.sy || 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.lineJoin = 'round';
    DRAW[kind](ctx, o);
    if (o.flash) {
      ctx.globalCompositeOperation = 'source-atop';
    }
    ctx.restore();
  }

  /* Draw into a small canvas element (for menus). */
  function portrait(canvas, kind, mood) {
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const s = Math.min(w / 112, h / 130);
    draw(c, kind, w / 2, h - 8, s, { shadow: true, mood: mood || 'neutral', idle: false });
  }

  global.Chars = { draw, portrait, INFO, KINDS: ['bear', 'penguin', 'seal', 'orca'], ell, lin, rad };
})(window);
