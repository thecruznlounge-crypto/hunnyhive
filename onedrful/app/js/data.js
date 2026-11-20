/* ONEDRFUL data layer.
   One interface (window.DB) used by the UI. In mock mode it reads/writes localStorage.
   In API mode it calls the backend contract in api/README.md and keeps a local cache so
   the app still opens and shows the last known data offline. */
(function () {
  'use strict';
  const CFG = window.ONEDRFUL_CONFIG;
  const KEY = 'onedrful_v2';
  const OUTBOX = 'onedrful_outbox';

  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const code = () => 'PRM-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const days = (n) => Date.now() - n * 864e5;

  function seed() {
    const offers = [
      { id: 'off_001', icon: 'transport', title: 'Luxury transportation', business: 'Miami Ride Partner', bizId: 'biz_mrp', category: 'transport', payout: 250, payoutType: 'flat', desc: 'Refer sprinter, shuttle, charter and group ride bookings anywhere in South Florida.', tag: 'High payout', terms: 'Pay after completed trip', proof: ['Tracked link', 'Customer claim code', 'Receipt upload'], trust: 98, speed: 3, disputes: 1, active: true, created: days(40) },
      { id: 'off_002', icon: 'nightlife', title: 'Nightclubs & VIP tables', business: 'Weekend Host Group', bizId: 'biz_whg', category: 'nightlife', payout: 100, payoutType: 'flat', desc: 'Connect groups to clubs, VIP tables, lounges and nightlife experiences.', tag: 'Weekends', terms: 'Pay after customer check-in', proof: ['Tracked link', 'QR check-in'], trust: 94, speed: 5, disputes: 3, active: true, created: days(32) },
      { id: 'off_003', icon: 'travel', title: 'Hotels & resorts', business: 'StayLink Travel', bizId: 'biz_slt', category: 'travel', payout: 12, payoutType: 'percent', desc: 'Earn a commission on hotel stays and hospitality bookings you send.', tag: 'Commission', terms: 'Pay after completed stay', proof: ['Tracked link', 'Booking confirmation'], trust: 91, speed: 14, disputes: 4, active: true, created: days(28) },
      { id: 'off_004', icon: 'events', title: 'Events & tickets', business: 'Local Events Co.', bizId: 'biz_lec', category: 'nightlife', payout: 40, payoutType: 'flat', desc: 'Promote concerts, parties, comedy shows and local experiences.', tag: 'Fast payout', terms: 'Pay after ticket scan', proof: ['Tracked link', 'Ticket scan'], trust: 96, speed: 2, disputes: 2, active: true, created: days(20) },
      { id: 'off_005', icon: 'wellness', title: 'Fitness & wellness', business: 'FitLife Studio', bizId: 'biz_fls', category: 'wellness', payout: 35, payoutType: 'flat', desc: 'Share gym memberships, classes, personal trainers and wellness promos.', tag: 'Recurring', terms: 'Pay after membership start', proof: ['Tracked link', 'Customer claim code'], trust: 89, speed: 7, disputes: 5, active: true, created: days(14) },
      { id: 'off_006', icon: 'transport', title: 'Airport & cruise transfers', business: 'Cruise Transfer Pros', bizId: 'biz_ctp', category: 'transport', payout: 85, payoutType: 'flat', desc: 'Refer groups who need airport pickups, cruise port transfers and hotel shuttles.', tag: 'Local', terms: 'Pay after completed transfer', proof: ['Tracked link', 'Receipt upload'], trust: 97, speed: 4, disputes: 1, active: true, created: days(9) },
      // Owned by the on-device business account (shown in Business mode)
      { id: 'off_me1', icon: 'transport', title: 'Party bus charters', business: 'My Business', bizId: 'me', category: 'transport', payout: 150, payoutType: 'flat', desc: 'Birthday, bachelorette and night-out party bus bookings, 4-hour minimum.', tag: 'New offer', terms: 'Pay after completed trip', proof: ['Tracked link', 'Customer claim code', 'Receipt upload'], trust: 100, speed: 0, disputes: 0, active: true, created: days(6) }
    ];
    const r = (id, offerId, status, ago, customer, clicks) => ({ id, offerId, code: code(), status, created: days(ago), updated: days(Math.max(0, ago - 1)), customer, clicks, receipt: status === 'proof' || status === 'approved' || status === 'paid' ? 'receipt.jpg' : null, owner: 'me' });
    const referrals = [
      r('ref_01', 'off_001', 'paid', 21, 'Group of 12 · Brickell', 44),
      r('ref_02', 'off_006', 'approved', 9, 'Cruise group · Port Miami', 18),
      r('ref_03', 'off_002', 'proof', 4, 'Birthday table · 8 guests', 23),
      r('ref_04', 'off_004', 'lead', 2, 'Comedy night · 4 tickets', 12),
      r('ref_05', 'off_001', 'shared', 1, null, 6),
      r('ref_06', 'off_005', 'rejected', 12, 'Trial class only', 9)
    ];
    // Incoming referrals for the business account's own offer
    const incoming = [
      { id: 'ref_b1', offerId: 'off_me1', code: code(), status: 'proof', created: days(3), updated: days(1), customer: 'Bachelorette · 14 guests', clicks: 31, receipt: 'receipt.jpg', owner: 'prm_jay', promoter: 'Jay R.' },
      { id: 'ref_b2', offerId: 'off_me1', code: code(), status: 'lead', created: days(2), updated: days(1), customer: 'Sweet 16 · 20 guests', clicks: 15, receipt: null, owner: 'prm_ana', promoter: 'Ana M.' },
      { id: 'ref_b3', offerId: 'off_me1', code: code(), status: 'approved', created: days(5), updated: days(2), customer: 'Corporate night out', clicks: 22, receipt: 'receipt.jpg', owner: 'prm_kev', promoter: 'Kevin T.' }
    ];
    return {
      profile: null, // set during onboarding
      payout: { method: 'Cash App', handle: '' },
      offers,
      referrals: referrals.concat(incoming),
      reports: [],
      seededAt: Date.now()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked */ }
    const s = seed();
    save(s);
    return s;
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* quota or private mode */ }
  }

  let state = load();

  // ---------- Outbox (API mode) ----------
  function outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } }
  function setOutbox(list) { try { localStorage.setItem(OUTBOX, JSON.stringify(list)); } catch (e) {} }
  async function send(method, path, body) {
    const res = await fetch(CFG.API_BASE + path, {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.status === 204 ? null : res.json();
  }
  async function write(method, path, body) {
    if (CFG.USE_MOCK) return null;
    if (!navigator.onLine) { setOutbox(outbox().concat({ method, path, body, at: Date.now() })); return null; }
    try { return await send(method, path, body); }
    catch (e) { setOutbox(outbox().concat({ method, path, body, at: Date.now() })); return null; }
  }
  async function flush() {
    if (CFG.USE_MOCK || !navigator.onLine) return 0;
    const list = outbox(); const left = [];
    for (const item of list) {
      try { await send(item.method, item.path, item.body); } catch (e) { left.push(item); }
    }
    setOutbox(left);
    return list.length - left.length;
  }
  async function refresh() {
    if (CFG.USE_MOCK || !navigator.onLine) return false;
    try {
      const [offers, dash] = await Promise.all([
        send('GET', '/offers'),
        send('GET', state.profile && state.profile.type === 'business' ? '/business/dashboard' : '/promoters/dashboard')
      ]);
      if (Array.isArray(offers)) state.offers = offers;
      if (dash && Array.isArray(dash.referrals)) state.referrals = dash.referrals;
      save(state);
      return true;
    } catch (e) { return false; }
  }

  // ---------- Public API ----------
  const listeners = new Set();
  const emit = () => { save(state); listeners.forEach(fn => fn()); };

  window.DB = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    outboxCount: () => outbox().length,
    flush, refresh,

    setProfile(p) {
      state.profile = Object.assign({}, state.profile || {}, p);
      emit();
      return write('POST', '/auth/register', { accountType: state.profile.type, name: state.profile.name });
    },
    setPayout(pref) {
      state.payout = pref; emit();
      return write('PATCH', '/promoters/payout-preference', pref);
    },

    offer: (id) => state.offers.find(o => o.id === id),
    offerFor: (ref) => state.offers.find(o => o.id === ref.offerId),

    createOffer(o) {
      const offer = Object.assign({
        id: uid('off'), icon: o.category, bizId: 'me', business: (state.profile && state.profile.business) || 'My Business',
        tag: 'New offer', trust: 100, speed: 0, disputes: 0, active: true, created: Date.now()
      }, o);
      state.offers.unshift(offer); emit();
      write('POST', '/offers', offer);
      return offer;
    },
    toggleOffer(id) {
      const o = this.offer(id); if (!o) return;
      o.active = !o.active; emit();
      write('PATCH', '/offers/' + id, { active: o.active });
    },

    // Promoter: create (or reuse) my referral link for an offer
    linkFor(offerId) {
      let ref = state.referrals.find(r => r.offerId === offerId && r.owner === 'me' && r.status === 'shared');
      if (!ref) {
        ref = { id: uid('ref'), offerId, code: code(), status: 'shared', created: Date.now(), updated: Date.now(), customer: null, clicks: 0, receipt: null, owner: 'me' };
        state.referrals.unshift(ref); emit();
        write('POST', '/referrals/link', { offerId, promoterId: 'me' });
      }
      return ref;
    },
    url(ref) {
      const o = this.offerFor(ref);
      const slug = (o ? o.title : 'offer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return CFG.LINK_BASE + slug + '?ref=' + ref.code;
    },
    setStatus(id, status, extra) {
      const r = state.referrals.find(x => x.id === id); if (!r) return;
      Object.assign(r, extra || {}, { status, updated: Date.now() }); emit();
      const map = { approved: 'approve', rejected: 'reject', paid: 'paid', lead: 'claim', proof: 'receipt' };
      write('POST', '/referrals/' + id + '/' + (map[status] || 'status'), Object.assign({ status }, extra || {}));
    },
    bumpClicks(id, n) {
      const r = state.referrals.find(x => x.id === id); if (!r) return;
      r.clicks += n; emit();
    },
    report(offerId, reason) {
      state.reports.push({ offerId, reason, at: Date.now() }); emit();
      write('POST', '/offers/' + offerId + '/report', { reason });
    },

    exportJSON() {
      return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'ONEDRFUL', version: CFG.VERSION, data: state }, null, 2);
    },
    async wipe() {
      await write('DELETE', '/account', null);
      try { localStorage.removeItem(KEY); localStorage.removeItem(OUTBOX); localStorage.removeItem('onedrful_theme'); } catch (e) {}
      if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.startsWith('onedrful-data')).map(k => caches.delete(k))); }
      state = seed(); save(state); listeners.forEach(fn => fn());
    },
    resetDemo() { state = Object.assign(seed(), { profile: state.profile, payout: state.payout }); emit(); }
  };
})();
