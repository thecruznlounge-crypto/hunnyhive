/* CardUI - shared menu, setup, profile, rooms, stats and rules screens. */
(function (global) {
  'use strict';
  const K = global.CardKit, $ = K.$;
  const CPU_NAMES = ['Duke', 'Vera', 'Sterling', 'Mae', 'Rook', 'Isla', 'Beau', 'Nova'];

  function init(cfg) {
    const stage = cfg.stage, id = cfg.id;
    const P = K.Profile.get();
    K.setSound(P.sound);
    const skey = 'mypwa.cards.setup.' + id;
    let setup = {};
    cfg.fields.forEach(f => setup[f.key] = f.def);
    try { Object.assign(setup, JSON.parse(localStorage.getItem(skey)) || {}); } catch (e) { }
    const saveSetup = () => { try { localStorage.setItem(skey, JSON.stringify(setup)); } catch (e) { } };
    let inGame = false, menuEl = null;

    function toast(t) {
      let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
      el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
    }

    function cpuRoster(n) {
      const names = K.shuffle(CPU_NAMES.slice()), list = [];
      for (let i = 0; i < n; i++) {
        if (i === 0) list.push({ name: P.name || 'You', av: P.av, human: true });
        else list.push({ name: names[i], av: { g: K.rand(K.AV_GLYPH.length), c: K.rand(K.AV_COLOR.length) }, human: false });
      }
      return list;
    }

    function openSetup() {
      const row = f => {
        const dis = f.enabled && !f.enabled(setup);
        return '<h3>' + f.label + '</h3><div class="seg" data-key="' + f.key + '">' + f.options.map(o => '<button type="button" data-v="' + o.v + '"' + (String(setup[f.key]) === String(o.v) && !dis ? ' class="on"' : '') + (dis ? ' disabled' : '') + '>' + o.t + '</button>').join('') + '</div>' + (f.note ? '<p style="margin-top:4px;font-size:11px;color:var(--muted)">' + f.note + '</p>' : '');
      };
      const room = K.Profile.room();
      const m = K.modal('<h2>New Game</h2>' + cfg.fields.map(row).join('') + '<h3>Room</h3><p>' + room.name + ' &middot; ' + room.mult + 'x credits &nbsp;<a href="#" data-act="rooms" style="color:var(--gold2)">change</a></p><div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="deal">Deal me in</button></div>');
      m.addEventListener('click', e => {
        const b = e.target.closest('.seg button');
        if (b && !b.disabled) {
          const f = cfg.fields.find(x => x.key === b.parentNode.dataset.key);
          const v = b.dataset.v; setup[f.key] = isNaN(+v) ? v : +v; saveSetup();
          m.close(); setTimeout(openSetup, 230); return;
        }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        e.preventDefault();
        if (a.dataset.act === 'rooms') { m.close(); openRooms(openSetup); }
        if (a.dataset.act === 'deal') {
          m.close(); closeMenu(); inGame = true;
          const n = +setup.players || 4;
          cfg.onPlay(Object.assign({}, setup), cpuRoster(n));
        }
      });
    }

    function openProfile(after) {
      let g = P.av.g, c = P.av.c;
      const avs = () => {
        let h = '<div class="avpick">';
        K.AV_GLYPH.forEach((_, i) => h += '<div data-g="' + i + '" class="' + (i === g ? 'sel ' : '') + 'av" style="border:2px solid ' + (i === g ? '#f1dc8e' : 'transparent') + '">' + K.avatarHTML({ g: i, c }, 36) + '</div>');
        h += '</div><div class="avpick">';
        K.AV_COLOR.forEach((col, i) => h += '<div data-c="' + i + '" class="av" style="width:30px;height:30px;border:2px solid ' + (i === c ? '#f1dc8e' : 'transparent') + ';background:radial-gradient(circle at 35% 28%,' + col[0] + ',' + col[1] + ')"></div>');
        return h + '</div>';
      };
      const m = K.modal('<h2>Your Player</h2><div class="prow"><div id="avprev">' + K.avatarHTML({ g, c }, 46) + '</div><input type="text" id="pname" maxlength="12" value="' + (P.name || '').replace(/"/g, '') + '" placeholder="Your name"></div><div id="avs">' + avs() + '</div><div class="row"><button class="btn" data-act="ok">Save</button></div>');
      const redraw = () => { $('#avs', m).innerHTML = avs(); $('#avprev', m).innerHTML = K.avatarHTML({ g, c }, 46); };
      m.addEventListener('click', e => {
        const a = e.target.closest('[data-g]'), b = e.target.closest('[data-c]');
        if (a) { g = +a.dataset.g; redraw(); } else if (b) { c = +b.dataset.c; redraw(); }
        else if (e.target.closest('[data-act=ok]')) { P.name = ($('#pname', m).value || 'You').trim().slice(0, 12) || 'You'; P.av = { g, c }; K.Profile.save(); m.close(); toast('Saved'); if (after) setTimeout(after, 230); }
      });
    }

    function openRooms(after) {
      const draw = () => K.ROOMS.map(r => '<div class="roomcard' + (r.id === P.room ? ' on' : '') + '" data-room="' + r.id + '"><div class="sw" style="background:radial-gradient(circle,' + r.felt[0] + ',' + r.felt[1] + ');border-color:' + r.rail[0] + '"></div><div><b>' + r.name + '</b><small>' + r.blurb + '</small></div><div class="price">' + (P.owned.includes(r.id) ? (r.id === P.room ? 'In use' : 'Owned') : r.cost + ' cr') + '</div></div>').join('');
      const m = K.modal('<h2>Rooms</h2><p style="margin-bottom:8px">You have <b style="color:var(--gold2)">' + P.credits + '</b> credits. Win games to earn more; higher rooms pay more.</p><div id="rl">' + draw() + '</div><div class="row"><button class="btn" data-close>Done</button></div>');
      m.addEventListener('click', e => {
        const r = e.target.closest('[data-room]'); if (!r) return;
        if (K.Profile.buy(r.dataset.room)) { K.sfx.win(); if (inGame) toast('Room changes next deal'); else K.mountTable(stage); } else { toast('Not enough credits'); }
        $('#rl', m).innerHTML = draw();
      });
      m.addEventListener('click', e => { if (e.target.closest('[data-close]') && after) setTimeout(after, 230); });
    }

    function openStats() {
      const s = K.Profile.game(id), pct = s.played ? Math.round(100 * s.won / s.played) : 0;
      const extra = cfg.statExtra ? cfg.statExtra(s) : [];
      const box = (b, l) => '<div class="stat"><b>' + b + '</b><span>' + l + '</span></div>';
      K.modal('<h2>' + (P.name || 'You') + '</h2><div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">' + K.avatarHTML(P.av, 52) + '<div><div style="font-size:12px;color:var(--muted)">Credits</div><div style="font-size:22px;font-weight:900;color:var(--gold2)">' + P.credits + '</div></div></div><div class="statgrid">' +
        box(s.played, 'Games') + box(s.won, 'Wins') + box(pct + '%', 'Win rate') + box(s.roundsWon + '/' + s.rounds, 'Rounds won') + box(s.bestStreak, 'Best streak') + extra.map(x => box(x[0], x[1])).join('') + '</div><div class="row"><button class="btn" data-close>Close</button></div>');
    }

    function openRules() { K.modal('<h2>How to play</h2>' + cfg.rules + '<div class="row"><button class="btn" data-close>Got it</button></div>', { wide: true }); }

    function renderMenu() {
      closeMenu();
      menuEl = document.createElement('div'); menuEl.className = 'menu';
      const fan = cfg.fan.map((c, i, a) => { const t = i - (a.length - 1) / 2; return '<img src="' + K.faceURL(c.r, c.s) + '" style="position:absolute;left:50%;top:50%;width:var(--cw);border-radius:7%;box-shadow:0 6px 16px rgba(0,0,0,.6);transform:translate(-50%,-50%) translateX(' + (t * 34) + 'px) rotate(' + (t * 11) + 'deg)" alt="">'; }).join('');
      menuEl.innerHTML = '<div class="box"><div class="brand"><div class="fan">' + fan + '</div><h1>' + cfg.title + '</h1><p>' + cfg.sub + '</p></div><div class="stack">' +
        (inGame ? '<button class="btn" data-m="resume">Resume</button>' : '') +
        '<button class="btn' + (inGame ? ' ghost' : '') + '" data-m="new">' + (inGame ? 'New game' : 'Play') + '</button>' +
        '<button class="btn ghost" data-m="profile">Player &middot; Stats</button>' +
        '<button class="btn ghost" data-m="rooms">Rooms</button>' +
        '<button class="btn ghost" data-m="rules">How to play</button>' +
        '<button class="btn ghost install install-btn" type="button" hidden>Install app</button>' +
        '<div class="meta">' + K.avatarHTML(P.av, 22) + '<span>' + (P.name || 'You') + ' &middot; <b style="color:var(--gold2)">' + P.credits + '</b> credits</span></div></div></div>';
      stage.appendChild(menuEl);
      if (global.Install) global.Install.mount('.install-btn');
      menuEl.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        if (a === 'resume') closeMenu();
        else if (a === 'new') openSetup();
        else if (a === 'profile') { openProfileStats(); }
        else if (a === 'rooms') openRooms(renderMenu);
        else if (a === 'rules') openRules();
      });
    }
    function openProfileStats() {
      const m = K.modal('<h2>Player</h2><div class="row" style="justify-content:flex-start;margin-top:0"><button class="btn" data-m2="edit">Edit name &amp; avatar</button><button class="btn ghost" data-m2="stats">Stats &amp; credits</button></div>');
      m.addEventListener('click', e => { const b = e.target.closest('[data-m2]'); if (!b) return; m.close(); setTimeout(() => b.dataset.m2 === 'edit' ? openProfile(renderMenu) : openStats(), 230); });
    }
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
    function showMenu() { renderMenu(); }

    return { showMenu, closeMenu, toast, openRules, openStats, setInGame(v) { inGame = v; }, setup: () => setup, P };
  }
  global.CardUI = { init };
})(window);
