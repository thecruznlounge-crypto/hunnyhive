/* ONEDRFUL 2.0 — app (vanilla JS, no build step) */
(function () {
  'use strict';
  const CFG = window.ONEDRFUL_CONFIG;
  const DB = window.DB;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  // ---------- Helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const CATS = { transport: 'Transportation', nightlife: 'Nightlife', travel: 'Travel', events: 'Events', wellness: 'Wellness' };
  const catIcon = (c) => `<span class="cat" data-c="${esc(c)}">${icon(CATS[c] ? 'c-' + c : 'c-other')}</span>`;
  const STEPS = [['shared', 'Shared'], ['lead', 'Lead'], ['proof', 'Proof'], ['approved', 'Approved'], ['paid', 'Paid']];
  const STATUS = { shared: 'Link shared', lead: 'Customer claimed', proof: 'Proof sent', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' };
  const cap = (t) => t ? t[0].toUpperCase() + t.slice(1) : t;
  const EST_BOOKING = 800; // used to estimate % commissions

  function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const payHTML = (o) => o.payoutType === 'percent' ? `${o.payout}<small>%</small>` : `<small>$</small>${Number(o.payout).toLocaleString('en-US')}`;
  const payText = (o) => o.payoutType === 'percent' ? `${o.payout}%` : money(o.payout);
  const perText = (o) => o.payoutType === 'percent' ? 'of each booking' : String(o.terms || '').replace(/^Pay after /i, 'per ');
  const refValue = (r) => { const o = DB.offerFor(r); if (!o) return 0; return o.payoutType === 'percent' ? Math.round(o.payout / 100 * EST_BOOKING) : Number(o.payout); };

  const isBiz = () => !!(DB.state.profile && DB.state.profile.type === 'business');
  const myRefs = () => DB.state.referrals.filter((r) => r.owner === 'me');
  const bizRefs = () => DB.state.referrals.filter((r) => { const o = DB.offerFor(r); return o && o.bizId === 'me' && r.owner !== 'me'; });
  const refs = () => (isBiz() ? bizRefs() : myRefs());
  const marketOffers = () => DB.state.offers.filter((o) => o.bizId !== 'me' && o.active);
  const myOffers = () => DB.state.offers.filter((o) => o.bizId === 'me');
  const needsAction = () => isBiz()
    ? bizRefs().filter((r) => r.status === 'proof' || r.status === 'lead' || r.status === 'approved').length
    : myRefs().filter((r) => r.status === 'lead' || r.status === 'approved').length;

  function totals() {
    const list = refs();
    const sum = (st) => list.filter((r) => st.includes(r.status)).reduce((a, r) => a + refValue(r), 0);
    return { waiting: sum(['lead', 'proof']), approved: sum(['approved']), paid: sum(['paid']), clicks: list.reduce((a, r) => a + (r.clicks || 0), 0), count: list.length };
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, opts) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>` + (opts && opts.action ? `<button type="button">${esc(opts.action)}</button>` : '');
    if (opts && opts.action) $('button', el).onclick = () => { el.classList.remove('show'); opts.onAction(); };
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), (opts && opts.ms) || 2600);
  }

  // ---------- Confirm ----------
  function confirmBox(title, text, okLabel) {
    const d = $('#confirm');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmOk').textContent = okLabel || 'Confirm';
    return new Promise((resolve) => {
      if (typeof d.showModal !== 'function') { resolve(window.confirm(title + '\n\n' + text)); return; }
      d.returnValue = '';
      d.showModal();
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    });
  }

  // ---------- Clipboard / share ----------
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (er) {}
      t.remove(); return ok;
    }
  }
  async function shareLink(title, text, url) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (await copy(url)) toast('Link copied'); else toast('Copy failed. Press and hold the link to copy it.');
  }
  function qrBlob(url) {
    return new Promise((res) => QR.toCanvas(url, 1024).toBlob(res, 'image/png'));
  }
  async function saveQR(url, name) {
    const blob = await qrBlob(url);
    const file = new File([blob], name + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('QR code saved');
  }

  // ---------- Components ----------
  function stub(o, opts) {
    const disputesOk = o.disputes <= 2;
    const own = o.bizId === 'me';
    const meta = own
      ? `<span>${o.active ? 'Live' : 'Paused'}</span><span>${DB.state.referrals.filter((r) => r.offerId === o.id && r.owner !== 'me').length} referrals</span>`
      : `<span class="ok">${o.trust}% pay on time</span><span>Pays in ~${o.speed}d</span><span class="${disputesOk ? '' : 'warn'}">${o.disputes}% disputes</span>`;
    return `<button class="stub${o.active ? '' : ' paused'}" data-offer="${esc(o.id)}" aria-label="${esc(o.title)}, ${esc(payText(o))} ${esc(perText(o))}">
      <div class="stub-main">
        <div class="stub-head">${catIcon(o.icon || o.category)}<div><div class="stub-title">${esc(o.title)}</div><div class="stub-biz">${esc(o.business)}</div></div></div>
        ${opts && opts.compact ? '' : `<p class="stub-desc">${esc(o.desc)}</p>`}
        <div class="stub-meta">${meta}</div>
      </div>
      <div class="stub-pay"><span class="stub-amt">${payHTML(o)}</span><span class="stub-per">${esc(perText(o))}</span></div>
    </button>`;
  }

  function trail(status, mini) {
    const failed = status === 'rejected';
    const idx = failed ? -1 : STEPS.findIndex((s) => s[0] === status);
    return `<ol class="trail${mini ? ' mini' : ''}" aria-label="Proof trail: ${esc(STATUS[status])}">` + STEPS.map((s, i) => {
      let c = '';
      if (failed) c = i === 0 ? 'done' : i === 1 ? 'fail' : '';
      else c = i < idx ? 'done' : i === idx ? (status === 'paid' ? 'done' : 'now') : '';
      return `<li class="${c}"><i class="dot"></i><span>${failed && i === 1 ? 'Rejected' : s[1]}</span></li>`;
    }).join('') + '</ol>';
  }

  function refCard(r) {
    const o = DB.offerFor(r) || {};
    const who = isBiz() ? (r.promoter || 'Promoter') : (r.customer || 'Waiting for first customer');
    const sub = isBiz() ? (r.customer || '—') : o.business;
    return `<button class="ref-card" data-ref="${esc(r.id)}">
      <div class="ref-top">${catIcon(o.icon || o.category)}
        <div class="row-main"><div class="row-title">${esc(isBiz() ? who : o.title)}</div><div class="row-sub">${esc(isBiz() ? sub : who)}</div></div>
        <div class="row-end"><span class="num ${r.status === 'rejected' ? 'muted' : 'cash'}">${o.payoutType === 'percent' ? '~' : ''}${money(refValue(r))}</span><span class="status" data-s="${r.status}">${STATUS[r.status]}</span></div>
      </div>
      ${trail(r.status, true)}
    </button>`;
  }

  function empty(ic, title, text, cta) {
    return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${cta || ''}</div>`;
  }

  // ---------- Navigation ----------
  const NAV = [
    { id: 'home', label: 'Home', icon: 'i-home' },
    { id: 'offers', label: 'Offers', icon: 'i-offers' },
    { id: 'activity', label: 'Activity', icon: 'i-activity', badge: true },
    { id: 'trust', label: 'Trust', icon: 'i-trust' },
    { id: 'me', label: 'Me', icon: 'i-me' }
  ];
  const TITLES = { home: 'Home', offers: 'Offers', activity: 'Activity', trust: 'Trust', me: 'Me', new: 'New offer' };
  const LEGACY = { offers: 'offers', business: 'new', wallet: 'me', ledger: 'trust', accounts: 'me', how: 'home' };

  function parseRoute() {
    let h = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (LEGACY[h]) h = LEGACY[h];
    const [name, id] = h.split('/');
    const valid = TITLES[name] ? name : 'home';
    return { name: valid, id: id || null };
  }
  function go(path, replace) {
    const h = '#/' + path;
    if (replace) location.replace(h); else location.hash = h;
  }

  function renderNav(active) {
    const n = needsAction();
    const items = NAV.map((t) => `<a class="tab" href="#/${t.id}" ${t.id === active ? 'aria-current="page"' : ''}>
      <span class="ico">${icon(t.icon)}</span><span>${t.label}</span>${t.badge && n ? `<span class="badge-dot">${n}</span>` : ''}</a>`).join('');
    $('#tabbar').innerHTML = items;
    $('#railNav').innerHTML = (isBiz() ? `<a class="new-btn" href="#/new" aria-label="New offer">${icon('i-plus')}<span>New offer</span></a>` : '') + items;
    const t = totals();
    $('#railFoot').innerHTML = `<div class="rail-wallet"><span>${isBiz() ? 'Owed to promoters' : 'Expected payouts'}</span><strong>${money(isBiz() ? t.approved : t.waiting + t.approved)}</strong></div>`;
    const mp = $('#modePill');
    mp.innerHTML = `${icon('i-swap')}<b>${isBiz() ? 'Business' : 'Earning'}</b>`;
    mp.setAttribute('aria-label', `Account mode: ${isBiz() ? 'Business' : 'Earning'}. Switch mode`);
  }

  // ---------- Views ----------
  const views = {};

  views.home = () => {
    const t = totals();
    const name = (DB.state.profile && DB.state.profile.name) || '';
    const hr = new Date().getHours();
    const greet = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (name ? ', ' + name.split(' ')[0] : '');
    const biz = isBiz();
    const hero = biz ? t.approved : t.waiting + t.approved;
    const parts = [['Waiting', t.waiting, 'var(--hold)'], ['Approved', t.approved, 'var(--signal)'], ['Paid', t.paid, 'var(--cash)']];
    const total = parts.reduce((a, p) => a + p[1], 0) || 1;
    const attention = refs().filter((r) => biz ? ['proof', 'lead', 'approved'].includes(r.status) : ['lead', 'approved'].includes(r.status)).slice(0, 4);
    const recent = refs().slice().sort((a, b) => b.updated - a.updated).slice(0, 4);
    const top = marketOffers().slice().sort((a, b) => (b.payoutType === 'flat' ? b.payout : b.payout * 8) - (a.payoutType === 'flat' ? a.payout : a.payout * 8)).slice(0, 4);

    return `
      <div class="page-head"><h2>${esc(greet)}</h2><p class="lede">${biz ? 'Here’s what your promoters sent you.' : 'Here’s what your referrals are worth right now.'}</p></div>
      <div class="home-grid">
        <div class="wallet" role="group" aria-label="Payout summary">
          <div class="wallet-top">
            <div class="wallet-label"><span>${biz ? 'Owed to promoters' : 'Expected payouts'}</span><span>${t.count} referrals</span></div>
            <div class="wallet-amt">${money(hero)}</div>
            <div class="wallet-sub">${biz ? 'Approved referrals you still need to pay directly.' : 'Paid to you directly by each business after approval.'}</div>
          </div>
          <div class="wallet-perf" aria-hidden="true"></div>
          <div class="wallet-split">${parts.map((p) => `<div><span>${p[0]}</span><strong>${money(p[1])}</strong></div>`).join('')}</div>
          <div class="wallet-bar" aria-hidden="true">${parts.map((p) => `<i style="flex:${Math.max(p[1] / total, 0.02)};background:${p[2]}"></i>`).join('')}</div>
        </div>
        <div>
          <div class="quick">
            ${biz
              ? `<a class="btn primary" href="#/new">${icon('i-plus')}New offer</a>
                 <a class="btn ghost" href="#/activity">${icon('i-check')}Review referrals</a>
                 <a class="btn ghost" href="#/offers?mine">${icon('i-offers')}My offers</a>
                 <a class="btn ghost" href="#/trust">${icon('i-trust')}Trust score</a>`
              : `<a class="btn primary" href="#/offers">${icon('i-search')}Find offers</a>
                 <a class="btn ghost" href="#/activity">${icon('i-activity')}My referrals</a>
                 <button class="btn ghost" data-act="share-last">${icon('i-share')}Share last link</button>
                 <a class="btn ghost" href="#/me">${icon('i-me')}Payout method</a>`}
          </div>
          <div style="margin-top:24px">
            <div class="section-title"><h2>${biz ? 'Needs your review' : 'Your next steps'}</h2>${attention.length ? '<a href="#/activity">See all</a>' : ''}</div>
            <div class="list">${attention.length ? attention.map(refCard).join('') : empty('i-check', 'All caught up', biz ? 'New referrals show up here when a customer claims a promoter’s code.' : 'When a customer uses your code, you’ll add proof here.')}</div>
          </div>
        </div>
      </div>
      ${biz ? `
      <section><div class="section-title"><h2>Your offers</h2><a href="#/new">Add offer</a></div>
        <div class="offer-grid">${myOffers().map((o) => stub(o)).join('') || empty('i-offers', 'No offers yet', 'Post your first referral payout so promoters can start sending customers.', '<a class="btn primary" href="#/new">Post an offer</a>')}</div></section>`
      : `
      <section><div class="section-title"><h2>Top payouts</h2><a href="#/offers">All offers</a></div>
        <div class="shelf">${top.map((o) => stub(o, { compact: true })).join('')}</div></section>`}
      <section><div class="section-title"><h2>Recent activity</h2></div>
        <div class="list">${recent.length ? recent.map(refCard).join('') : empty('i-activity', 'Nothing yet', 'Generate a link from any offer to start tracking.')}</div></section>`;
  };

  const offerFilter = { q: '', cat: 'all', sort: 'pay', mine: false };
  views.offers = () => {
    const biz = isBiz();
    if (location.hash.includes('?mine')) offerFilter.mine = true;
    const base = biz && offerFilter.mine ? myOffers() : marketOffers();
    const counts = base.reduce((m, o) => { m[o.category] = (m[o.category] || 0) + 1; return m; }, {});
    return `
      <div class="page-head"><h2>${biz && offerFilter.mine ? 'Your offers' : 'Referral offers'}</h2>
        <p class="lede">${biz && offerFilter.mine ? 'Pause, share or check results for each payout you post.' : 'Each business pays you directly when your referral is approved. Pick one, share your link or QR code.'}</p></div>
      ${biz ? `<div class="seg" role="group" aria-label="Which offers" style="max-width:420px">
          <button data-mine="0" aria-pressed="${!offerFilter.mine}">Marketplace</button>
          <button data-mine="1" aria-pressed="${offerFilter.mine}">Your offers</button></div>` : ''}
      <div style="display:grid;gap:12px">
        <div style="display:flex;gap:10px">
          <label class="search" style="flex:1"><span class="hidden">Search offers</span>${icon('i-search')}<input id="q" type="search" inputmode="search" enterkeyhint="search" placeholder="Search party bus, hotels, nightlife…" value="${esc(offerFilter.q)}" autocomplete="off" /></label>
          ${biz ? `<a class="btn primary" href="#/new" aria-label="New offer">${icon('i-plus')}<span class="hide-sm">New</span></a>` : ''}
        </div>
        <div class="chips" role="group" aria-label="Category">
          <button class="chip" data-cat="all" aria-pressed="${offerFilter.cat === 'all'}">All <span class="count">${base.length}</span></button>
          ${Object.keys(CATS).filter((c) => counts[c]).map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${offerFilter.cat === c}">${icon('c-' + c)}${CATS[c]} <span class="count">${counts[c]}</span></button>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span class="muted" id="resultCount" style="font-size:.88rem"></span>
          <label class="field" style="display:flex;align-items:center;gap:8px"><span class="label" style="white-space:nowrap">Sort by</span>
            <select id="sort" style="min-height:40px;width:auto">
              <option value="pay" ${offerFilter.sort === 'pay' ? 'selected' : ''}>Highest payout</option>
              <option value="trust" ${offerFilter.sort === 'trust' ? 'selected' : ''}>Most reliable</option>
              <option value="fast" ${offerFilter.sort === 'fast' ? 'selected' : ''}>Fastest to pay</option>
              <option value="new" ${offerFilter.sort === 'new' ? 'selected' : ''}>Newest</option>
            </select></label>
        </div>
      </div>
      <div class="offer-grid" id="offerGrid"></div>`;
  };
  function paintOffers() {
    const grid = $('#offerGrid'); if (!grid) return;
    const base = isBiz() && offerFilter.mine ? myOffers() : marketOffers();
    const q = offerFilter.q.trim().toLowerCase();
    const list = base.filter((o) => (offerFilter.cat === 'all' || o.category === offerFilter.cat) &&
      (!q || [o.title, o.desc, o.business, CATS[o.category]].join(' ').toLowerCase().includes(q)));
    const val = (o) => (o.payoutType === 'percent' ? o.payout / 100 * EST_BOOKING : o.payout);
    const sorters = { pay: (a, b) => val(b) - val(a), trust: (a, b) => b.trust - a.trust, fast: (a, b) => a.speed - b.speed, new: (a, b) => b.created - a.created };
    list.sort(sorters[offerFilter.sort]);
    $('#resultCount').textContent = list.length + (list.length === 1 ? ' offer' : ' offers');
    grid.innerHTML = list.map((o) => stub(o)).join('') || `<div class="card" style="grid-column:1/-1">${empty('i-search', 'No offers match', 'Try a different word or clear the category filter.', '<button class="btn ghost" data-act="clear-filter">Clear filters</button>')}</div>`;
  }

  const actFilter = { s: 'open' };
  views.activity = () => {
    const biz = isBiz();
    const t = totals();
    const groups = biz
      ? [['open', 'Needs review', ['lead', 'proof']], ['topay', 'To pay', ['approved']], ['paid', 'Paid', ['paid']], ['rejected', 'Rejected', ['rejected']], ['all', 'All', null]]
      : [['open', 'In progress', ['shared', 'lead', 'proof']], ['topay', 'Approved', ['approved']], ['paid', 'Paid', ['paid']], ['rejected', 'Rejected', ['rejected']], ['all', 'All', null]];
    const list = refs();
    const g = groups.find((x) => x[0] === actFilter.s) || groups[0];
    const shown = list.filter((r) => !g[2] || g[2].includes(r.status)).sort((a, b) => b.updated - a.updated);
    return `
      <div class="page-head"><h2>${biz ? 'Referrals to review' : 'Your referrals'}</h2>
        <p class="lede">${biz ? 'Check the proof, approve or reject, then pay the promoter directly and mark it paid.' : 'Every referral follows the same proof trail: shared, customer claim, proof, approval, payment.'}</p></div>
      <div class="stats">
        <div class="stat"><span>Waiting</span><strong class="hold">${money(t.waiting)}</strong></div>
        <div class="stat"><span>${biz ? 'To pay' : 'Approved'}</span><strong>${money(t.approved)}</strong></div>
        <div class="stat"><span>Paid</span><strong class="cash">${money(t.paid)}</strong></div>
        <div class="stat"><span>Link clicks</span><strong>${t.clicks.toLocaleString('en-US')}</strong></div>
      </div>
      <div>
        <div class="chips" role="group" aria-label="Filter referrals" style="margin-bottom:12px">
          ${groups.map((x) => { const n = list.filter((r) => !x[2] || x[2].includes(r.status)).length; return `<button class="chip" data-afilter="${x[0]}" aria-pressed="${x[0] === g[0]}">${x[1]} <span class="count">${n}</span></button>`; }).join('')}
        </div>
        <div class="list">${shown.map(refCard).join('') || empty('i-activity', 'Nothing here', biz ? 'Referrals for your offers will land here.' : 'Pick an offer and share your link to start a referral.', biz ? '' : '<a class="btn primary" href="#/offers">Browse offers</a>')}</div>
      </div>`;
  };

  views.trust = () => {
    const seen = {};
    const bizes = DB.state.offers.filter((o) => o.bizId !== 'me' && !seen[o.bizId] && (seen[o.bizId] = 1)).sort((a, b) => b.trust - a.trust);
    const myPaid = bizRefs().filter((r) => r.status === 'paid').length;
    return `
      <div class="page-head"><h2>Payout trust</h2><p class="lede">Businesses pay promoters directly, so every business earns a public score for paying on time.</p></div>
      ${isBiz() ? `<div class="card" style="display:grid;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><strong>Your trust score</strong><span class="score ${myPaid ? 'cash' : 'muted'}">${myPaid ? '100' : '—'}</span></div>
        <p class="muted" style="font-size:.9rem">${myPaid ? 'Keep paying approved referrals quickly to hold this score.' : 'Not rated yet. Your score starts once you pay your first approved referral.'}</p></div>` : ''}
      <div class="two-col">
        <section><div class="section-title"><h2>Most reliable businesses</h2></div>
          <div class="list">${bizes.map((o) => `<div class="trust-row">${catIcon(o.icon || o.category)}
            <div style="min-width:0"><div class="row-title">${esc(o.business)}</div><div class="row-sub">Pays in ~${o.speed} days · ${o.disputes}% disputes</div>
            <div class="meter" aria-hidden="true"><i class="${o.trust < 92 ? 'mid' : ''}" style="width:${o.trust}%"></i></div></div>
            <span class="score ${o.trust >= 92 ? 'cash' : 'hold'}">${o.trust}</span></div>`).join('')}</div></section>
        <section><div class="section-title"><h2>How the score works</h2></div>
          <div class="card explain">
            <div><span class="cat" data-c="wellness">${icon('i-check')}</span><div><h4>Paid on time</h4><p>The share of approved referrals the business paid within the time it promised.</p></div></div>
            <div><span class="cat" data-c="transport">${icon('i-activity')}</span><div><h4>Payout speed</h4><p>Average days from approval to the promoter confirming they were paid.</p></div></div>
            <div><span class="cat" data-c="travel">${icon('i-flag')}</span><div><h4>Disputes</h4><p>Rejections a promoter challenged with proof. Settled disputes still count.</p></div></div>
            <div><span class="cat" data-c="nightlife">${icon('i-qr')}</span><div><h4>Offline sales count too</h4><p>QR check-ins, claim codes and receipt uploads prove referrals that never touch a website.</p></div></div>
          </div></section>
      </div>`;
  };

  let installEvt = null;
  views.me = () => {
    const p = DB.state.profile || {};
    const pay = DB.state.payout || {};
    const theme = (() => { try { return localStorage.getItem('onedrful_theme') || 'system'; } catch (e) { return 'system'; } })();
    const pending = DB.outboxCount();
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `
      <div class="page-head"><h2>${esc(p.name || 'Your account')}</h2><p class="lede">${isBiz() ? esc(p.business || 'Business account') : 'Individual promoter account'}</p></div>
      <div class="two-col">
        <div style="display:grid;gap:28px">
          <section><div class="section-title"><h2>Account</h2></div>
            <div class="card form">
              <div class="field"><span class="label">Account type</span>
                <div class="seg" role="group" aria-label="Account type">
                  <button data-type="individual" aria-pressed="${!isBiz()}">I earn from referrals</button>
                  <button data-type="business" aria-pressed="${isBiz()}">I run a business</button></div></div>
              <div class="field"><label for="pName">Your name</label><input id="pName" autocomplete="name" value="${esc(p.name || '')}" placeholder="First and last name" /></div>
              ${isBiz() ? `<div class="field"><label for="pBiz">Business name</label><input id="pBiz" autocomplete="organization" value="${esc(p.business || '')}" placeholder="Shown on your offers" /></div>` : ''}
              <button class="btn ghost" data-act="save-profile">Save account</button>
            </div></section>
          ${!isBiz() ? `<section><div class="section-title"><h2>How businesses pay you</h2></div>
            <div class="card form">
              <p class="muted" style="font-size:.9rem">Shown to a business only after it approves one of your referrals. ONEDRFUL never holds your money.</p>
              <div class="form-split">
                <div class="field"><label for="payMethod">Method</label><select id="payMethod">${['Cash App', 'Zelle', 'Venmo', 'PayPal', 'Invoice / ACH', 'Check'].map((m) => `<option ${pay.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
                <div class="field"><label for="payHandle">Handle or instructions</label><input id="payHandle" value="${esc(pay.handle || '')}" placeholder="$cashtag, phone or email" autocomplete="off" /><span class="err">Add where the business should send your payout.</span></div>
              </div>
              <button class="btn primary" data-act="save-payout">Save payout method</button>
            </div></section>` : ''}
        </div>
        <div style="display:grid;gap:28px">
          <section><div class="section-title"><h2>Appearance</h2></div>
            <div class="seg" role="group" aria-label="Theme">
              ${['system', 'dark', 'light'].map((t) => `<button data-theme-set="${t}" aria-pressed="${theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
            </div></section>
          <section><div class="section-title"><h2>App</h2></div>
            <div class="list">
              ${!standalone ? `<button class="set-row" data-act="install">${icon('i-download')}<div class="row-main"><span class="row-title">Install ONEDRFUL</span><span class="row-sub">${installEvt ? 'Adds the app to your home screen' : 'Use your browser menu: Add to Home screen'}</span></div>${icon('i-chev')}</button>` : ''}
              <div class="set-row">${icon(navigator.onLine ? 'i-check' : 'i-offline')}<div class="row-main"><span class="row-title">${navigator.onLine ? 'Ready to work offline' : 'You’re offline'}</span><span class="row-sub">${pending ? pending + ' change' + (pending > 1 ? 's' : '') + ' will sync when you reconnect' : 'Everything is saved on this device'}</span></div></div>
              <button class="set-row" data-act="update">${icon('i-swap')}<div class="row-main"><span class="row-title">Check for updates</span><span class="row-sub">Version ${esc(CFG.VERSION)}</span></div>${icon('i-chev')}</button>
            </div></section>
          <section><div class="section-title"><h2>Data and privacy</h2></div>
            <div class="list">
              <button class="set-row" data-act="export">${icon('i-download')}<div class="row-main"><span class="row-title">Download my data</span><span class="row-sub">A JSON copy of everything stored for you</span></div>${icon('i-chev')}</button>
              <a class="set-row" href="./privacy.html">${icon('i-trust')}<div class="row-main"><span class="row-title">Privacy policy</span></div>${icon('i-chev')}</a>
              <a class="set-row" href="./terms.html">${icon('i-offers')}<div class="row-main"><span class="row-title">Terms of use</span></div>${icon('i-chev')}</a>
              <a class="set-row" href="mailto:${esc(CFG.SUPPORT_EMAIL)}">${icon('i-me')}<div class="row-main"><span class="row-title">Contact support</span><span class="row-sub">${esc(CFG.SUPPORT_EMAIL)}</span></div>${icon('i-chev')}</a>
              ${CFG.USE_MOCK ? `<button class="set-row" data-act="reset">${icon('i-swap')}<div class="row-main"><span class="row-title">Reset demo data</span><span class="row-sub">Restore the sample offers and referrals</span></div></button>` : ''}
              <button class="set-row danger" data-act="delete">${icon('i-x')}<div class="row-main"><span class="row-title">Delete account and data</span><span class="row-sub">Removes your profile, referrals and settings</span></div></button>
            </div></section>
        </div>
      </div>`;
  };

  views.new = () => {
    if (!isBiz()) {
      return `<div class="card">${empty('i-offers', 'Posting offers is for business accounts', 'Switch to a business account to post a referral payout. You can switch back any time.', '<button class="btn primary" data-act="to-biz">Switch to business</button>')}</div>`;
    }
    return `
      <div class="page-head"><h2>Post a referral payout</h2><p class="lede">Promoters see this offer in the marketplace. You pay them directly once you approve a referral.</p></div>
      <div class="two-col">
        <form class="card form" id="offerForm" novalidate>
          <div class="field"><label for="fTitle">Offer name</label><input id="fTitle" maxlength="60" placeholder="e.g. Party bus charters" required /><span class="err">Give the offer a name.</span></div>
          <div class="form-split">
            <div class="field"><label for="fCat">Category</label><select id="fCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
            <div class="field"><span class="label">Payout type</span><div class="seg" role="group" aria-label="Payout type"><button type="button" data-ptype="flat" aria-pressed="true">Flat $</button><button type="button" data-ptype="percent" aria-pressed="false">Percent</button></div></div>
          </div>
          <div class="field"><label for="fAmt" id="fAmtLabel">Payout per referral</label><div class="input-affix"><span id="fAffix">$</span><input id="fAmt" inputmode="decimal" placeholder="150" required /></div><span class="err">Enter a payout amount above zero.</span></div>
          <div class="field"><label for="fDesc">What should promoters send you?</label><textarea id="fDesc" maxlength="200" placeholder="Who the customer is and what they book" required></textarea><span class="err">Add a short description.</span><span class="hint" id="fDescCount">0 / 200</span></div>
          <div class="field"><label for="fTerms">You pay after</label><select id="fTerms">
            ${['Pay after completed sale', 'Pay after completed trip', 'Pay after approved lead', 'Pay after receipt upload', 'Pay after customer check-in', 'Pay after ticket scan'].map((t) => `<option>${t}</option>`).join('')}</select></div>
          <div class="field"><span class="label">Proof you need</span><div class="checks">
            ${['Tracked link', 'Customer claim code', 'Receipt upload', 'QR check-in'].map((p, i) => `<label><input type="checkbox" name="proof" value="${p}" ${i < 2 ? 'checked' : ''}/>${p}</label>`).join('')}</div></div>
          <button class="btn primary block" type="submit">Publish offer</button>
        </form>
        <section><div class="section-title"><h2>Preview</h2></div><div id="offerPreview"></div>
          <p class="muted" style="font-size:.85rem;margin-top:12px">Your trust score starts at 100 and moves with how fast you pay approved referrals.</p></section>
      </div>`;
  };

  // ---------- Sheets ----------
  let sheetPushed = false;
  function openSheet(html, labelId) {
    const sheet = $('#sheet'), scrim = $('#scrim');
    $('#sheetBody').innerHTML = html;
    sheet.setAttribute('aria-labelledby', labelId || 'sheetTitle');
    sheet.hidden = false; scrim.hidden = false;
    requestAnimationFrame(() => { sheet.classList.add('show'); scrim.classList.add('show'); });
    $('#sheetBody').scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const f = $('.sheet-close', sheet); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function hideSheet() {
    const sheet = $('#sheet'), scrim = $('#scrim');
    if (sheet.hidden) return;
    sheet.classList.remove('show'); scrim.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!sheet.classList.contains('show')) { sheet.hidden = true; scrim.hidden = true; } }, 280);
  }
  function closeSheet() {
    const r = parseRoute();
    if (!r.id) { hideSheet(); return; }
    if (sheetPushed) { sheetPushed = false; history.back(); } else go(r.name, true);
  }
  const sheetHead = (o, sub) => `<div class="sheet-head">${catIcon(o.icon || o.category)}<div style="flex:1;min-width:0"><h2 id="sheetTitle">${esc(o.title)}</h2><p class="muted" style="font-size:.9rem">${esc(sub)}</p></div><button class="icon-btn sheet-close" data-act="close" aria-label="Close">${icon('i-x')}</button></div>`;

  function linkBlock(r, o) {
    const url = DB.url(r);
    return `<div class="qr-wrap"><div class="qr">${QR.toSVG(url, { margin: 2 })}</div>
      <div style="display:grid;gap:8px;min-width:0"><strong>Your link and QR code</strong><div class="link-box">${esc(url)}</div><span class="muted" style="font-size:.8rem">Claim code <b class="num" style="color:var(--text)">${esc(r.code)}</b></span></div></div>
      <div class="btn-row">
        <button class="btn primary" data-act="share" data-ref="${r.id}">${icon('i-share')}Share link</button>
        <button class="btn ghost" data-act="copy" data-ref="${r.id}">${icon('i-copy')}Copy</button>
        <button class="btn ghost" data-act="saveqr" data-ref="${r.id}">${icon('i-qr')}Save QR</button>
      </div>`;
  }

  function offerSheet(o) {
    const own = o.bizId === 'me';
    const link = !own && DB.state.referrals.find((r) => r.offerId === o.id && r.owner === 'me' && r.status === 'shared');
    const its = DB.state.referrals.filter((r) => r.offerId === o.id && r.owner !== 'me');
    const owed = its.filter((r) => r.status === 'approved').reduce((a, r) => a + refValue(r), 0);
    return `${sheetHead(o, o.business + ' · ' + (CATS[o.category] || 'Other'))}
      <div class="stub" style="cursor:default"><div class="stub-main"><p style="font-size:.95rem">${esc(o.desc)}</p></div>
        <div class="stub-pay"><span class="stub-amt">${payHTML(o)}</span><span class="stub-per">${esc(perText(o))}</span></div></div>
      ${own ? `<div class="kv"><div><span>Referrals</span><strong>${its.length}</strong></div><div><span>Approved</span><strong>${its.filter((r) => r.status === 'approved' || r.status === 'paid').length}</strong></div><div><span>You owe</span><strong class="hold">${money(owed)}</strong></div></div>`
        : `<div class="kv"><div><span>Pays on time</span><strong class="cash">${o.trust}%</strong></div><div><span>Pays within</span><strong>~${o.speed}d</strong></div><div><span>Disputes</span><strong class="${o.disputes > 2 ? 'hold' : ''}">${o.disputes}%</strong></div></div>`}
      <div style="display:grid;gap:10px"><strong>${own ? 'You pay after' : 'You get paid after'}</strong><p class="muted">${esc(cap(String(o.terms || 'approval').replace(/^Pay after /i, '')))}. ${own ? 'You pay the promoter directly.' : 'The business pays you directly using your saved payout method.'}</p>
        <div class="proof-list">${(o.proof || ['Tracked link']).map((p) => `<span>${icon('i-check')}${esc(p)}</span>`).join('')}</div></div>
      ${own
        ? `<div class="btn-row"><button class="btn ghost" data-act="toggle-offer" data-offer-id="${o.id}">${o.active ? 'Pause offer' : 'Resume offer'}</button><a class="btn primary" href="#/activity">Review referrals</a></div>`
        : (link ? linkBlock(link, o) : `<button class="btn primary block" data-act="get-link" data-offer-id="${o.id}">${icon('i-qr')}Get my link and QR code</button>`)}
      ${own ? '' : `<p class="muted" style="font-size:.8rem">ONEDRFUL records the proof trail and never holds payouts. <button class="link-btn" data-act="report" data-offer-id="${o.id}" style="display:inline;min-height:0">Report this offer</button></p>`}`;
  }

  function refSheet(r) {
    const o = DB.offerFor(r) || {};
    const biz = isBiz();
    const pay = DB.state.payout || {};
    let actions = '';
    if (!biz) {
      if (r.status === 'shared') actions = `${linkBlock(r, o)}
        <div class="card form"><div class="field"><label for="claimNote">Customer used your code?</label><input id="claimNote" placeholder="e.g. Birthday group of 10" /><span class="hint">Record the claim so the business can match it.</span></div>
        <button class="btn ghost" data-act="claim" data-ref="${r.id}">Record customer claim</button></div>`;
      else if (r.status === 'lead') actions = `<div class="card form"><strong>Add proof of the sale</strong><p class="muted" style="font-size:.9rem">Upload the receipt, booking confirmation or a photo of the check-in.</p>
        <label class="btn primary block" style="cursor:pointer">${icon('i-upload')}Upload proof<input type="file" accept="image/*,application/pdf" capture="environment" data-upload="${r.id}" hidden /></label></div>`;
      else if (r.status === 'proof') actions = `<div class="card"><strong>Waiting on ${esc(o.business)}</strong><p class="muted" style="font-size:.9rem;margin-top:4px">They usually review within ${o.speed || 3} days. You’ll see the status change here.</p></div>`;
      else if (r.status === 'approved') actions = `<div class="card form"><strong>Approved — ${esc(o.business)} owes you ${money(refValue(r))}</strong><p class="muted" style="font-size:.9rem">They’ll pay you by ${esc(pay.method || 'your payout method')}${pay.handle ? ' at ' + esc(pay.handle) : ''}. Mark it once the money arrives.</p>
        <button class="btn good" data-act="received" data-ref="${r.id}">${icon('i-check')}I got paid</button></div>`;
      else if (r.status === 'paid') actions = `<div class="card"><strong class="cash">Paid ${money(refValue(r))}</strong><p class="muted" style="font-size:.9rem;margin-top:4px">This payout counts toward ${esc(o.business)}’s trust score.</p></div>`;
      else if (r.status === 'rejected') actions = `<div class="card form"><strong>Rejected by ${esc(o.business)}</strong><p class="muted" style="font-size:.9rem">${r.dispute ? 'Dispute opened. Support will review the proof trail with both sides.' : 'If you have proof the customer booked, open a dispute.'}</p>
        ${r.dispute ? '' : `<button class="btn danger" data-act="dispute" data-ref="${r.id}">${icon('i-flag')}Open a dispute</button>`}</div>`;
    } else {
      if (r.status === 'lead') actions = `<div class="card form"><strong>Customer claimed ${esc(r.promoter || 'the promoter')}’s code</strong><p class="muted" style="font-size:.9rem">Approve when the sale is done, or reject if it never happened.</p>
        <div class="btn-row"><button class="btn good" data-act="approve" data-ref="${r.id}">${icon('i-check')}Approve</button><button class="btn danger" data-act="reject" data-ref="${r.id}">${icon('i-x')}Reject</button></div></div>`;
      else if (r.status === 'proof') actions = `<div class="card form"><strong>Proof received</strong><p class="muted" style="font-size:.9rem">${icon('i-upload').replace('<svg', '<svg style="display:inline;width:16px;height:16px;vertical-align:-3px"')} ${esc(r.receipt || 'receipt')}</p>
        <div class="btn-row"><button class="btn good" data-act="approve" data-ref="${r.id}">${icon('i-check')}Approve</button><button class="btn danger" data-act="reject" data-ref="${r.id}">${icon('i-x')}Reject</button></div></div>`;
      else if (r.status === 'approved') actions = `<div class="card form"><strong>Pay ${esc(r.promoter || 'the promoter')} ${money(refValue(r))}</strong><p class="muted" style="font-size:.9rem">Send the payout directly with their saved method, then mark it paid. Paying fast raises your trust score.</p>
        <button class="btn primary" data-act="markpaid" data-ref="${r.id}">${icon('i-check')}Mark as paid</button></div>`;
      else actions = `<div class="card"><strong class="${r.status === 'paid' ? 'cash' : 'stop'}">${STATUS[r.status]}</strong></div>`;
    }
    return `${sheetHead(o, biz ? (r.promoter || 'Promoter') + ' · ' + (r.customer || '') : o.business)}
      <div style="display:grid;gap:10px"><span class="status" data-s="${r.status}">${STATUS[r.status]} · ${ago(r.updated)}</span>${trail(r.status)}</div>
      <div class="kv"><div><span>Worth</span><strong class="cash">${o.payoutType === 'percent' ? '~' : ''}${money(refValue(r))}</strong></div><div><span>Link clicks</span><strong>${r.clicks}</strong></div><div><span>Started</span><strong style="font-size:.95rem">${ago(r.created)}</strong></div></div>
      ${actions}`;
  }

  // ---------- Render ----------
  let current = null;
  function render(force) {
    const r = parseRoute();
    const changed = force || !current || current.name !== r.name;
    if (changed) {
      const view = $('#view');
      view.innerHTML = views[r.name]();
      view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
      if (!force) window.scrollTo(0, 0);
      $('#viewTitle').textContent = TITLES[r.name];
      document.title = TITLES[r.name] + ' · ONEDRFUL';
      $('#backBtn').classList.toggle('hidden', r.name !== 'new');
      if (r.name === 'offers') paintOffers();
      if (r.name === 'new') wireOfferForm();
    }
    renderNav(r.name);
    current = r;
    // Sheet state from route
    if (r.id && r.name === 'offers') { const o = DB.offer(r.id); o ? openSheet(offerSheet(o)) : go('offers', true); }
    else if (r.id && r.name === 'activity') { const x = DB.state.referrals.find((q) => q.id === r.id); x ? openSheet(refSheet(x)) : go('activity', true); }
    else hideSheet();
  }
  function refreshSheet() {
    const r = parseRoute();
    if (!r.id || $('#sheet').hidden) return;
    const st = $('#sheetBody').scrollTop;
    if (r.name === 'offers') { const o = DB.offer(r.id); if (o) $('#sheetBody').innerHTML = offerSheet(o); }
    if (r.name === 'activity') { const x = DB.state.referrals.find((q) => q.id === r.id); if (x) $('#sheetBody').innerHTML = refSheet(x); }
    $('#sheetBody').scrollTop = st;
  }

  // ---------- Offer form ----------
  function wireOfferForm() {
    const f = $('#offerForm'); if (!f) return;
    let ptype = 'flat';
    const preview = () => {
      const o = {
        id: 'preview', icon: $('#fCat').value, category: $('#fCat').value, title: $('#fTitle').value || 'Your offer name',
        business: (DB.state.profile && DB.state.profile.business) || 'Your business', bizId: 'me', active: true,
        payout: parseFloat($('#fAmt').value) || 0, payoutType: ptype, desc: $('#fDesc').value || 'Describe who promoters should send you.', terms: $('#fTerms').value
      };
      $('#offerPreview').innerHTML = stub(o).replace('<button', '<div').replace(/<\/button>$/, '</div>');
      $('#fDescCount').textContent = $('#fDesc').value.length + ' / 200';
    };
    $$('[data-ptype]', f).forEach((b) => b.addEventListener('click', () => {
      ptype = b.dataset.ptype;
      $$('[data-ptype]', f).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#fAffix').textContent = ptype === 'flat' ? '$' : '%';
      $('#fAmtLabel').textContent = ptype === 'flat' ? 'Payout per referral' : 'Commission percent';
      $('#fAmt').placeholder = ptype === 'flat' ? '150' : '10';
      preview();
    }));
    f.addEventListener('input', (e) => { const fld = e.target.closest('.field'); if (fld) fld.classList.remove('invalid'); preview(); });
    f.addEventListener('change', preview);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#fTitle').value.trim(), desc = $('#fDesc').value.trim(), amt = parseFloat($('#fAmt').value);
      let bad = null;
      const mark = (id, ok) => { $(id).closest('.field').classList.toggle('invalid', !ok); if (!ok && !bad) bad = $(id); };
      mark('#fTitle', !!title); mark('#fAmt', amt > 0 && (ptype === 'flat' || amt <= 100)); mark('#fDesc', !!desc);
      if (bad) { bad.focus(); return; }
      const proof = $$('input[name="proof"]:checked', f).map((x) => x.value);
      const o = DB.createOffer({ title, category: $('#fCat').value, payout: ptype === 'flat' ? Math.round(amt) : amt, payoutType: ptype, desc, terms: $('#fTerms').value, proof: proof.length ? proof : ['Tracked link'] });
      toast('Offer published');
      offerFilter.mine = true;
      go('offers/' + o.id);
    });
    preview();
  }

  // ---------- Events (delegated) ----------
  document.addEventListener('click', async (e) => {
    const offerBtn = e.target.closest('[data-offer]');
    if (offerBtn && offerBtn.tagName === 'BUTTON') { sheetPushed = true; go('offers/' + offerBtn.dataset.offer); return; }
    const refBtn = e.target.closest('button.ref-card');
    if (refBtn) { sheetPushed = true; go('activity/' + refBtn.dataset.ref); return; }

    const cat = e.target.closest('[data-cat]');
    if (cat) { offerFilter.cat = cat.dataset.cat; $$('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(c === cat))); paintOffers(); return; }
    const mine = e.target.closest('[data-mine]');
    if (mine) { offerFilter.mine = mine.dataset.mine === '1'; offerFilter.cat = 'all'; if (location.hash.includes('?')) go('offers', true); render(true); return; }
    const af = e.target.closest('[data-afilter]');
    if (af) { actFilter.s = af.dataset.afilter; render(true); return; }
    const th = e.target.closest('[data-theme-set]');
    if (th) { setTheme(th.dataset.themeSet); $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === th))); return; }
    const ty = e.target.closest('[data-type]');
    if (ty) { setMode(ty.dataset.type); return; }

    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    const ref = a.dataset.ref && DB.state.referrals.find((x) => x.id === a.dataset.ref);
    switch (act) {
      case 'close': closeSheet(); break;
      case 'get-link': {
        const r = DB.linkFor(a.dataset.offerId);
        refreshSheet();
        toast('Link ready. Share it or save the QR code.');
        void r; break;
      }
      case 'share': { const o = DB.offerFor(ref); DB.bumpClicks(ref.id, 0); await shareLink(o.title + ' — ' + o.business, `Book ${o.title.toLowerCase()} with ${o.business} using my link:`, DB.url(ref)); break; }
      case 'copy': toast((await copy(DB.url(ref))) ? 'Link copied' : 'Copy failed. Press and hold the link to copy it.'); break;
      case 'saveqr': { const o = DB.offerFor(ref); await saveQR(DB.url(ref), 'onedrful-' + o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')); break; }
      case 'share-last': {
        const r = myRefs().filter((x) => x.status === 'shared').sort((x, y) => y.updated - x.updated)[0];
        if (!r) { toast('No link yet. Pick an offer first.'); go('offers'); break; }
        const o = DB.offerFor(r); await shareLink(o.title, 'Book with my link:', DB.url(r)); break;
      }
      case 'claim': { const note = ($('#claimNote').value || '').trim() || 'Customer claim'; DB.setStatus(ref.id, 'lead', { customer: note }); refreshSheet(); toast('Claim recorded. Add proof once they book.'); break; }
      case 'received': DB.setStatus(ref.id, 'paid'); refreshSheet(); toast('Marked as paid'); break;
      case 'dispute': ref.dispute = true; DB.setStatus(ref.id, 'rejected', { dispute: true }); refreshSheet(); toast('Dispute opened'); break;
      case 'approve': DB.setStatus(ref.id, 'approved'); refreshSheet(); toast('Referral approved. Pay the promoter next.'); break;
      case 'reject': if (await confirmBox('Reject this referral?', 'The promoter is told it was rejected and can open a dispute with proof.', 'Reject')) { DB.setStatus(ref.id, 'rejected'); refreshSheet(); toast('Referral rejected'); } break;
      case 'markpaid': DB.setStatus(ref.id, 'paid'); refreshSheet(); toast('Marked as paid'); break;
      case 'toggle-offer': DB.toggleOffer(a.dataset.offerId); refreshSheet(); toast(DB.offer(a.dataset.offerId).active ? 'Offer resumed' : 'Offer paused'); break;
      case 'report': if (await confirmBox('Report this offer?', 'Tell us it looks misleading, unsafe or not real. Our team reviews every report.', 'Report offer')) { DB.report(a.dataset.offerId, 'user_report'); toast('Report sent. Thanks.'); } break;
      case 'clear-filter': offerFilter.q = ''; offerFilter.cat = 'all'; render(true); break;
      case 'to-biz': setMode('business'); break;
      case 'save-profile': DB.setProfile({ name: $('#pName').value.trim(), business: $('#pBiz') ? $('#pBiz').value.trim() : (DB.state.profile || {}).business }); toast('Account saved'); break;
      case 'save-payout': {
        const h = $('#payHandle').value.trim();
        $('#payHandle').closest('.field').classList.toggle('invalid', !h);
        if (!h) { $('#payHandle').focus(); break; }
        DB.setPayout({ method: $('#payMethod').value, handle: h }); toast('Payout method saved'); break;
      }
      case 'install':
        if (installEvt) { installEvt.prompt(); const c = await installEvt.userChoice; installEvt = null; if (c.outcome === 'accepted') toast('Installing ONEDRFUL'); render(true); }
        else toast('Open your browser menu and choose Add to Home screen.', { ms: 4000 });
        break;
      case 'update': checkUpdate(true); break;
      case 'export': {
        const blob = new Blob([DB.exportJSON()], { type: 'application/json' });
        const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'onedrful-my-data.json';
        document.body.appendChild(l); l.click(); l.remove(); toast('Data downloaded'); break;
      }
      case 'reset': if (await confirmBox('Reset demo data?', 'Sample offers and referrals are restored. Your name and payout method stay.', 'Reset')) { DB.resetDemo(); render(true); toast('Demo data restored'); } break;
      case 'delete':
        if (await confirmBox('Delete your account and data?', 'This removes your profile, referrals, offers and settings from this device' + (CFG.USE_MOCK ? '' : ' and from ONEDRFUL servers') + '. It can’t be undone.', 'Delete everything')) {
          await DB.wipe(); applyTheme('system'); go('home', true); showOnboarding(); toast('Account and data deleted');
        }
        break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { offerFilter.q = e.target.value; paintOffers(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'sort') { offerFilter.sort = e.target.value; paintOffers(); }
    if (e.target.matches('[data-upload]')) {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('That file is over 10 MB. Try a smaller photo.'); return; }
      DB.setStatus(e.target.dataset.upload, 'proof', { receipt: file.name });
      refreshSheet(); toast('Proof uploaded. The business will review it.');
    }
  });

  $('#scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  $('#backBtn').addEventListener('click', () => (history.length > 1 ? history.back() : go('home')));
  $('#modePill').addEventListener('click', () => setMode(isBiz() ? 'individual' : 'business'));
  window.addEventListener('hashchange', () => render());
  window.addEventListener('scroll', () => $('#appbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });

  // Swipe down to close sheet (phone)
  (function () {
    const sheet = $('#sheet'); let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', (e) => { if ($('#sheetBody').scrollTop > 0 || innerWidth >= 720) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    sheet.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sheet.addEventListener('touchend', () => { if (y0 == null) return; sheet.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; });
  })();

  // ---------- Mode + theme ----------
  function setMode(type) {
    if ((type === 'business') === isBiz()) return;
    DB.setProfile({ type });
    offerFilter.mine = false; actFilter.s = 'open';
    const r = parseRoute();
    if (r.id) go(r.name, true);
    render(true);
    toast(type === 'business' ? 'Switched to your business account' : 'Switched to earning');
  }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
    const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
    $$('meta[name="theme-color"]').forEach((m) => { m.setAttribute('content', dark ? '#090a16' : '#f3f4fa'); if (t !== 'system') m.removeAttribute('media'); });
  }
  function setTheme(t) { try { localStorage.setItem('onedrful_theme', t); } catch (e) {} applyTheme(t); }

  // ---------- Onboarding ----------
  function showOnboarding() {
    const ob = $('#onboard');
    let type = 'individual';
    ob.innerHTML = `<div class="ob">
      <img class="ob-logo" src="./assets/icons/icon.svg" alt="ONEDRFUL" width="64" height="64" />
      <div style="display:grid;gap:10px"><h1 id="obTitle">Get paid for the customers you send.</h1>
      <p>Businesses post referral payouts. You share a tracked link or QR code. When the sale is approved, the business pays you directly.</p></div>
      <div class="ob-choices" role="group" aria-label="Account type">
        <button class="ob-choice" data-ob="individual" aria-pressed="true">${catIcon('wellness').replace('c-wellness', 'i-share')}<div><strong>I earn from referrals</strong><span>Share offers with friends, clients and followers.</span></div><span class="radio"></span></button>
        <button class="ob-choice" data-ob="business" aria-pressed="false">${catIcon('transport').replace('c-transport', 'i-offers')}<div><strong>I run a business</strong><span>Post payouts and approve the customers promoters send.</span></div><span class="radio"></span></button>
      </div>
      <div class="field"><label for="obName">What should we call you?</label><input id="obName" autocomplete="given-name" placeholder="Your first name" /></div>
      <button class="btn primary block" id="obGo">Continue</button>
      <p class="ob-fine">By continuing you agree to the <a href="./terms.html">Terms</a> and <a href="./privacy.html">Privacy policy</a>. You can switch account type later in Me.</p>
    </div>`;
    ob.hidden = false;
    $$('[data-ob]', ob).forEach((b) => b.addEventListener('click', () => { type = b.dataset.ob; $$('[data-ob]', ob).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    $('#obGo').addEventListener('click', () => {
      const name = $('#obName').value.trim();
      DB.setProfile({ type, name, business: type === 'business' ? (name ? name + '’s business' : 'My Business') : '' });
      ob.hidden = true; ob.innerHTML = '';
      render(true);
    });
  }

  // ---------- Online / offline ----------
  function netState(announce) {
    const off = !navigator.onLine;
    $('#netPill').classList.toggle('hidden', !off);
    if (!announce) return;
    if (off) toast('You’re offline. Changes are saved on this device.', { ms: 3500 });
    else DB.flush().then((n) => { toast(n ? `Back online. Synced ${n} change${n > 1 ? 's' : ''}.` : 'Back online'); DB.refresh().then((ok) => ok && render(true)); });
  }
  window.addEventListener('online', () => netState(true));
  window.addEventListener('offline', () => netState(true));

  // ---------- Install ----------
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (parseRoute().name === 'me') render(true); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('ONEDRFUL installed'); });

  // ---------- Service worker + updates ----------
  let swReg = null;
  function promptUpdate(worker) {
    toast('A new version is ready', { action: 'Update', ms: 15000, onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }) });
  }
  async function checkUpdate(manual) {
    if (!swReg) { if (manual) toast('Updates turn on after the app is installed or loaded over HTTPS.'); return; }
    try { await swReg.update(); } catch (e) {}
    if (swReg.waiting) promptUpdate(swReg.waiting);
    else if (manual) toast(navigator.onLine ? 'You have the latest version' : 'Connect to the internet to check for updates');
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    window.addEventListener('load', async () => {
      try {
        swReg = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
        if (swReg.waiting && navigator.serviceWorker.controller) promptUpdate(swReg.waiting);
        swReg.addEventListener('updatefound', () => {
          const w = swReg.installing;
          w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w); });
        });
        setInterval(() => swReg.update().catch(() => {}), 60 * 60 * 1000);
      } catch (e) { /* SW unsupported here */ }
    });
  }

  // ---------- Boot ----------
  DB.subscribe(() => renderNav(parseRoute().name));
  try { applyTheme(localStorage.getItem('onedrful_theme') || 'system'); } catch (e) { applyTheme('system'); }
  if (!location.hash) go('home', true);
  render(true);
  netState(false);
  if (!DB.state.profile) showOnboarding();
  if (navigator.onLine) DB.flush().then(() => DB.refresh()).then((ok) => ok && render(true));
  window.ONEDRFUL = { toast, render, go };
})();
