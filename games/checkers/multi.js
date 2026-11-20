/* Multi - room-code online play over Supabase Realtime (broadcast + presence). Inactive until multiplayer-config.js is filled in. */
(function (global) {
  'use strict';
  const K = global.CardKit, $ = K.$;
  const CFG = global.MP_CONFIG || {};
  const Multi = { available: !!(CFG.url && CFG.anonKey), session: null };
  let lib = null;
  function loadLib() {
    if (lib) return lib;
    lib = new Promise((res, rej) => {
      if (global.supabase && global.supabase.createClient) return res(global.supabase);
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
      s.onload = () => res(global.supabase); s.onerror = () => { lib = null; rej(new Error('Could not load the online library. Check your connection.')); }; document.head.appendChild(s);
    });
    return lib;
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const codeGen = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

  /* lobby({game, title, min, max, onStart(session), onCancel}) */
  Multi.lobby = function (o) {
    if (!Multi.available) {
      K.modal('<h2>Online play</h2><p>Online play is not switched on yet. Add your Supabase project URL and anon key to <b>multiplayer-config.js</b> and reload. Until then you can play against the CPU or on one device.</p><div class="row"><button class="btn" data-close>OK</button></div>');
      return;
    }
    const P = K.Profile.get(), me = { id: uid(), name: P.name || 'Player', av: P.av };
    let sb = null, ch = null, code = '', started = false, closed = false, seq = 0; const handlers = {}, seen = {};
    const m = K.modal('<h2>' + o.title + ' online</h2><div id="mpbody"></div>', { sticky: true });
    const body = $('#mpbody', m);
    const stop = () => { closed = true; try { ch && sb.removeChannel(ch); } catch (e) { } };
    const cancel = () => { stop(); m.close(); o.onCancel && o.onCancel(); };
    const home = () => {
      body.innerHTML = '<p style="margin-bottom:10px">Play a friend anywhere. One of you creates a room and shares the 4-letter code.</p><div class="row" style="justify-content:center"><button class="btn" data-a="create">Create room</button></div><h3>Join a room</h3><div class="prow"><input type="text" id="mpcode" maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:.3em;text-align:center;font-weight:800"><button class="btn sm" data-a="join">Join</button></div><div id="mperr" style="color:#ff9aa6;font-size:12px;min-height:16px;margin-top:6px"></div><div class="row"><button class="btn ghost" data-a="cancel">Cancel</button></div>';
    };
    home();
    const err = t => { const e = $('#mperr', m); if (e) e.textContent = t; };
    const players = () => { if (!ch) return []; const st = ch.presenceState(), out = []; Object.values(st).forEach(arr => arr.forEach(x => out.push(x))); return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); };
    const send = (t, d) => { try { ch.send({ type: 'broadcast', event: 'm', payload: { t, d, from: me.id, seq: ++seq } }); } catch (e) { } };
    const render = () => {
      if (started) return; const ps = players(), host = ps[0] && ps[0].id === me.id;
      body.innerHTML = '<p>Room code</p><div style="font-size:40px;font-weight:900;letter-spacing:.25em;color:var(--gold2);text-align:center;margin:4px 0 10px">' + code + '</div><div class="plist">' + ps.map(p => '<div class="prow">' + K.avatarHTML(p.av, 28) + '<b style="flex:1">' + p.name + (p.id === me.id ? ' (you)' : '') + '</b><span class="tag" style="width:auto">' + (p === ps[0] ? 'host' : '') + '</span></div>').join('') + '</div><p style="margin-top:8px;color:var(--muted);font-size:12px">' + (ps.length < o.min ? 'Waiting for ' + (o.min - ps.length) + ' more player' + (o.min - ps.length > 1 ? 's' : '') + '...' : host ? 'Ready. ' + (o.max > ps.length ? 'Empty seats are filled by CPU players.' : '') : 'Waiting for the host to start...') + '</p><div class="row"><button class="btn ghost" data-a="cancel">Leave</button>' + (host ? '<button class="btn" data-a="start"' + (ps.length < o.min ? ' disabled' : '') + '>Start game</button>' : '') + '</div>';
    };
    const dispatch = pl => {
      if (pl.from === me.id) return; if (seen[pl.from] && pl.seq <= seen[pl.from]) return; seen[pl.from] = pl.seq;
      if (pl.t === 'start' && !started) { begin(pl.d); return; }
      (handlers[pl.t] || []).forEach(f => f(pl.d, pl.from));
    };
    function begin(d) {
      started = true; const ps = players(); const order = d.order.map(id => ps.find(p => p.id === id) || { id, name: 'Player', av: { g: 0, c: 0 } });
      const mine = order.findIndex(p => p.id === me.id); if (mine < 0) { err('Room is full'); return; }
      m.close();
      const sess = Multi.session = {
        game: o.game, me: mine, meId: me.id, players: order.map(p => ({ id: p.id, name: p.name, av: p.av })), seed: d.seed, settings: d.settings || {}, isHost: order[0].id === me.id,
        send, on(t, f) { (handlers[t] = handlers[t] || []).push(f); return () => { handlers[t] = (handlers[t] || []).filter(x => x !== f); }; },
        onLeave: null, close() { stop(); Multi.session = null; }
      };
      o.onStart(sess);
    }
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'cancel') return cancel();
      if (a === 'start') { const ps = players(); if (ps.length < o.min) return; const order = K.shuffle(ps.map(p => p.id)); const d = { order, seed: Math.floor(Math.random() * 2147483647), settings: o.settings || {} }; send('start', d); begin(d); return; }
      if (a === 'create' || a === 'join') {
        code = a === 'create' ? codeGen() : ($('#mpcode', m).value || '').toUpperCase().trim(); if (code.length !== 4) return err('Enter the 4-letter code');
        body.innerHTML = '<p>Connecting...</p>';
        try {
          const S = await loadLib(); if (closed) return; sb = S.createClient(CFG.url, CFG.anonKey, { realtime: { params: { eventsPerSecond: 10 } } });
          ch = sb.channel('mp:' + o.game + ':' + code, { config: { broadcast: { self: false }, presence: { key: me.id } } });
          ch.on('presence', { event: 'sync' }, render).on('presence', { event: 'leave' }, ({ leftPresences }) => { const ss = Multi.session; if (closed || !ss) return; (leftPresences || []).forEach(p => { if (p.id !== me.id && ss.players.some(x => x.id === p.id)) ss.onLeave && ss.onLeave(p.id); }); }).on('broadcast', { event: 'm' }, ({ payload }) => dispatch(payload));
          ch.subscribe(async st => { if (st === 'SUBSCRIBED') { await ch.track({ id: me.id, name: me.name, av: me.av, t: Date.now() }); render(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { if (!started) { body.innerHTML = '<p>Could not connect. Check the Supabase URL and key, and your internet connection.</p><div class="row"><button class="btn" data-a="cancel">Close</button></div>'; } else if (Multi.session && Multi.session.onLeave) Multi.session.onLeave('net'); } });
        } catch (er) { body.innerHTML = '<p>' + (er.message || 'Connection failed') + '</p><div class="row"><button class="btn" data-a="cancel">Close</button></div>'; }
      }
    });
  };
  global.Multi = Multi;
})(window);
