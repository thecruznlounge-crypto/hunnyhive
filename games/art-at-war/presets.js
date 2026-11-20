/* Art at War: hand-inked preset fighters and weapons (drawn with code, then used exactly like player drawings). */
(function (g) {
  'use strict';
  const O = '#1b1b2f', TAU = Math.PI * 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 256; return c; };
  const CHARS = ['Inky', 'Blaze Knight', 'Doodle Ninja', 'Bolt Bot', 'Capt. Crayon', 'Pixie Pop'];
  const WPNS = ['Pencil Sword', 'Brush Hammer', 'Marker Lance', 'Paint Mace', 'Scissor Blades', 'Ruler Whip'];
  function tools(c) {
    return {
      blob(x, y, rx, ry, col, hi, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); const gr = c.createRadialGradient(x - rx * .35, y - ry * .45, rx * .08, x, y, Math.max(rx, ry) * 1.1); gr.addColorStop(0, hi); gr.addColorStop(1, col); c.fillStyle = gr; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke(); },
      box(x, y, w, h, r, col, hi) { Art.rr(c, x, y, w, h, r); const gr = c.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, hi); gr.addColorStop(1, col); c.fillStyle = gr; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke(); },
      poly(pts, col) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke(); },
      limb(x1, y1, x2, y2, col, w) { c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = w + 7; c.strokeStyle = O; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); },
      eye(x, y, r, dx) { c.beginPath(); c.ellipse(x, y, r, r * 1.18, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 4; c.strokeStyle = O; c.stroke(); c.beginPath(); c.arc(x + (dx || 3), y + 2, r * .55, 0, TAU); c.fillStyle = O; c.fill(); c.beginPath(); c.arc(x + (dx || 3) + r * .2, y - r * .15, r * .2, 0, TAU); c.fillStyle = '#fff'; c.fill(); },
      smile(x, y, r, w) { c.beginPath(); c.arc(x, y, r, .15, Math.PI - .15); c.lineWidth = w || 5; c.strokeStyle = O; c.lineCap = 'round'; c.stroke(); }
    };
  }
  function feet(T, col, y) { T.limb(104, y - 20, 100, y + 12, col, 17); T.limb(152, y - 20, 160, y + 12, col, 17); T.blob(97, y + 14, 17, 10, '#2b2b3d', '#555570'); T.blob(166, y + 14, 17, 10, '#2b2b3d', '#555570'); }
  function arms(T, col, y) { T.limb(70, y, 48, y + 26, col, 15); T.limb(186, y, 214, y + 10, col, 15); T.blob(218, y + 12, 11, 11, '#ffd9c0', '#fff0e6'); T.blob(44, y + 28, 10, 10, '#ffd9c0', '#fff0e6'); }
  function char(i) {
    const cv = mk(), c = cv.getContext('2d'), T = tools(c); c.lineJoin = c.lineCap = 'round';
    if (i === 0) { /* Inky: ink drop */
      feet(T, '#2554c7', 216); arms(T, '#2554c7', 150);
      c.beginPath(); c.moveTo(128, 18); c.bezierCurveTo(140, 64, 200, 104, 200, 152); c.bezierCurveTo(200, 198, 168, 222, 128, 222); c.bezierCurveTo(88, 222, 56, 198, 56, 152); c.bezierCurveTo(56, 104, 116, 64, 128, 18); c.closePath();
      const gr = c.createRadialGradient(104, 110, 8, 128, 150, 100); gr.addColorStop(0, '#8fc1ff'); gr.addColorStop(.45, '#3a86ff'); gr.addColorStop(1, '#1f3f9a'); c.fillStyle = gr; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke();
      T.eye(108, 148, 17, 4); T.eye(150, 148, 17, 4); T.smile(130, 170, 16); T.blob(80, 178, 7, 5, '#ff6fb5', '#ff9fd0'); T.blob(178, 178, 7, 5, '#ff6fb5', '#ff9fd0');
      T.blob(90, 80, 9, 14, '#fff', '#fff', -.6); c.globalAlpha = .6; c.fill(); c.globalAlpha = 1;
    } else if (i === 1) { /* Blaze Knight */
      feet(T, '#9aa6bd', 218); arms(T, '#b8c2d6', 156);
      T.blob(128, 178, 46, 42, '#e63946', '#ff7a85'); T.box(84, 188, 88, 16, 6, '#ffb703', '#ffe08a'); T.blob(128, 196, 11, 11, '#ffd23f', '#fff3b0');
      T.blob(128, 100, 62, 60, '#b8c2d6', '#f2f6ff'); T.box(80, 86, 96, 30, 12, '#2b2b3d', '#4a4a66');
      c.beginPath(); c.arc(106, 100, 6, 0, TAU); c.arc(150, 100, 6, 0, TAU); c.fillStyle = '#7be0ff'; c.fill();
      c.beginPath(); c.moveTo(128, 40); c.bezierCurveTo(92, 6, 46, 20, 40, 60); c.bezierCurveTo(70, 40, 104, 50, 128, 58); c.closePath(); c.fillStyle = '#e63946'; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke();
    } else if (i === 2) { /* Doodle Ninja */
      c.beginPath(); c.moveTo(90, 120); c.bezierCurveTo(50, 118, 28, 134, 8, 176); c.lineTo(44, 160); c.lineTo(30, 196); c.bezierCurveTo(64, 174, 90, 160, 104, 140); c.closePath(); c.fillStyle = '#e63946'; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke();
      feet(T, '#2b2b3d', 218); arms(T, '#2b2b3d', 154);
      T.blob(128, 176, 44, 42, '#2b2b3d', '#555580'); T.box(80, 190, 96, 12, 5, '#e63946', '#ff7a85');
      T.blob(128, 100, 60, 58, '#2b2b3d', '#555580'); T.box(76, 84, 104, 34, 14, '#ffe0c2', '#fff2e4');
      c.beginPath(); c.ellipse(104, 102, 11, 7, .25, 0, TAU); c.ellipse(152, 102, 11, 7, -.25, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 4; c.strokeStyle = O; c.stroke();
      c.beginPath(); c.arc(107, 102, 4.5, 0, TAU); c.arc(155, 102, 4.5, 0, TAU); c.fillStyle = O; c.fill();
      T.limb(128, 58, 128, 44, '#2b2b3d', 8);
    } else if (i === 3) { /* Bolt Bot */
      feet(T, '#6b7a99', 216); arms(T, '#8c9bb8', 160);
      c.beginPath(); c.arc(128, 100, 0, 0, 1); T.limb(128, 60, 128, 30, '#6b7a99', 7); T.blob(128, 26, 11, 11, '#ff5d8f', '#ffc0d4');
      T.box(86, 146, 84, 72, 16, '#5a6c8c', '#9db0d0'); T.blob(128, 182, 15, 15, '#7be0ff', '#e6fbff');
      T.box(62, 56, 132, 92, 24, '#9aa9bf', '#e6eefb'); T.box(76, 72, 104, 58, 14, '#161a2e', '#2a3050');
      T.box(92, 86, 24, 20, 7, '#4ff0ff', '#c8ffff'); T.box(140, 86, 24, 20, 7, '#4ff0ff', '#c8ffff'); T.box(106, 114, 44, 7, 3, '#4ff0ff', '#4ff0ff');
      T.blob(54, 102, 9, 20, '#6b7a99', '#9db0d0'); T.blob(202, 102, 9, 20, '#6b7a99', '#9db0d0');
    } else if (i === 4) { /* Captain Crayon */
      feet(T, '#c2680a', 218); arms(T, '#ff9f1c', 150);
      c.beginPath(); c.moveTo(84, 62); c.lineTo(128, 6); c.lineTo(172, 62); c.closePath(); c.fillStyle = '#ffb347'; c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke();
      T.box(84, 56, 88, 164, 22, '#ff9f1c', '#ffd27a'); T.box(84, 134, 88, 44, 0, '#fffaf0', '#fff'); c.fillStyle = '#e63946'; c.fillRect(92, 146, 72, 6); c.fillRect(92, 160, 72, 6);
      T.eye(110, 92, 14, 3); T.box(132, 76, 30, 28, 10, '#1b1b2f', '#333'); T.limb(86, 70, 168, 112, '#1b1b2f', 4); T.smile(128, 118, 13);
      T.poly([[78, 56], [178, 56], [166, 36], [90, 36]], '#2b2b3d'); c.beginPath(); c.arc(128, 46, 6, 0, TAU); c.fillStyle = '#fff'; c.fill();
    } else { /* Pixie Pop */
      c.globalAlpha = .85; T.blob(60, 130, 36, 56, '#7be0c3', '#d8fff3', -.5); T.blob(196, 130, 36, 56, '#7be0c3', '#d8fff3', .5); c.globalAlpha = 1;
      T.limb(112, 196, 108, 226, '#ffd6c4', 12); T.limb(146, 196, 152, 226, '#ffd6c4', 12); T.blob(104, 230, 15, 9, '#ff6fb5', '#ffa8d2'); T.blob(156, 230, 15, 9, '#ff6fb5', '#ffa8d2');
      T.limb(172, 150, 208, 160, '#ffd6c4', 12); T.blob(212, 162, 10, 10, '#ffd6c4', '#fff0e6');
      T.poly([[100, 142], [156, 142], [188, 214], [68, 214]], '#8338ec'); c.fillStyle = '#c9a0ff'; c.fillRect(82, 198, 92, 6);
      T.blob(128, 112, 52, 50, '#ff6fb5', '#ffa8d2'); T.blob(128, 120, 44, 42, '#ffd6c4', '#fff0e6');
      T.eye(111, 120, 11, 2); T.eye(146, 120, 11, 2); T.smile(128, 134, 9, 4);
      T.poly([[74, 84], [182, 84], [128, 4]], '#8338ec'); T.poly([[64, 92], [192, 92], [186, 80], [70, 80]], '#6a24c4');
      c.beginPath(); c.arc(128, 62, 11, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 4; c.strokeStyle = O; c.stroke();
    }
    return cv;
  }
  function wpn(i) {
    const cv = mk(), c = cv.getContext('2d'), T = tools(c); c.lineJoin = c.lineCap = 'round';
    if (i === 0) { /* Pencil sword */
      T.box(14, 108, 22, 40, 6, '#ff9fb5', '#ffd0dc'); T.box(34, 106, 24, 44, 3, '#c0c8d8', '#f1f4fb'); T.box(56, 108, 138, 40, 4, '#ffd23f', '#fff0a0');
      c.fillStyle = '#e8a600'; c.fillRect(56, 126, 138, 4); T.poly([[192, 108], [192, 148], [244, 128]], '#f3d9ae'); T.poly([[226, 120], [226, 136], [244, 128]], '#2b2b3d');
    } else if (i === 1) { /* Brush hammer */
      T.box(14, 118, 140, 20, 8, '#a8642b', '#e0a266'); T.box(138, 84, 40, 88, 6, '#c0c8d8', '#f1f4fb');
      T.box(176, 70, 66, 116, 14, '#e63946', '#ff8a93'); c.strokeStyle = '#a82330'; c.lineWidth = 3; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(190 + k * 11, 82); c.lineTo(190 + k * 11, 176); c.stroke(); }
    } else if (i === 2) { /* Marker lance */
      T.box(14, 114, 72, 28, 6, '#1b1b2f', '#3a3a5a'); T.box(84, 108, 118, 40, 8, '#2ec4b6', '#9ef0e6'); c.fillStyle = '#fff'; c.fillRect(110, 122, 52, 12);
      T.poly([[200, 112], [200, 144], [244, 128]], '#1b9a8e'); T.poly([[228, 122], [228, 134], [244, 128]], '#1b1b2f');
    } else if (i === 3) { /* Paint mace */
      T.box(14, 120, 150, 16, 8, '#a8642b', '#e0a266'); T.poly([[148, 76], [244, 66], [236, 190], [156, 180]], '#9aa6bd');
      c.fillStyle = '#ff5d8f'; c.beginPath(); c.ellipse(196, 76, 46, 12, 0, 0, TAU); c.fill(); c.lineWidth = 6; c.strokeStyle = O; c.stroke();
      c.beginPath(); c.moveTo(166, 80); c.lineTo(166, 110); c.arc(172, 110, 6, Math.PI, 0, true); c.lineTo(178, 80); c.fillStyle = '#ff5d8f'; c.fill(); c.beginPath(); c.moveTo(214, 80); c.lineTo(214, 126); c.arc(220, 126, 6, Math.PI, 0, true); c.lineTo(226, 80); c.fill();
    } else if (i === 4) { /* Scissor blades */
      T.poly([[88, 128], [244, 96], [236, 118]], '#dfe6f2'); T.poly([[88, 128], [244, 160], [236, 138]], '#c0c8d8');
      c.lineWidth = 12; c.strokeStyle = O; c.beginPath(); c.ellipse(46, 100, 24, 18, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(46, 156, 24, 18, 0, 0, TAU); c.stroke();
      c.lineWidth = 7; c.strokeStyle = '#e63946'; c.beginPath(); c.ellipse(46, 100, 24, 18, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(46, 156, 24, 18, 0, 0, TAU); c.stroke();
      T.blob(92, 128, 9, 9, '#ffd23f', '#fff3b0');
    } else { /* Ruler whip */
      T.box(14, 112, 232, 32, 5, '#ffe3a3', '#fff4d0'); c.strokeStyle = '#a8743b'; c.lineWidth = 3; for (let k = 0; k < 20; k++) { c.beginPath(); c.moveTo(30 + k * 11, 112); c.lineTo(30 + k * 11, k % 5 ? 122 : 132); c.stroke(); }
    }
    return cv;
  }
  g.AWPresets = { CHARS, WPNS, char, wpn };
})(window);
