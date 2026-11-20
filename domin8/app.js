const STORAGE_KEY = 'domin8-state-v1';
const defaultState = {
  user: null,
  theme: 'light',
  goal: 500,
  skills: ['Driving', 'Delivery', 'Customer Service'],
  availability: ['Evenings', 'Weekends'],
  earnings: [
    { id: crypto.randomUUID(), title: 'Weekend delivery block', amount: 85, date: today(1) },
    { id: crypto.randomUUID(), title: 'Online micro-task batch', amount: 22, date: today(2) },
    { id: crypto.randomUUID(), title: 'Event helper shift', amount: 125, date: today(4) }
  ],
  savedGigs: [],
  completedLessons: []
};
const gigPool = [
  { id:'g1', title:'Evening grocery delivery block', pay:72, time:'Tonight 6–9 PM', type:'Local', fit:96, skill:'Delivery', desc:'Good for workers who want quick evening income after a 9-to-5 shift.' },
  { id:'g2', title:'Weekend event check-in assistant', pay:125, time:'Saturday 10 AM–3 PM', type:'Local', fit:91, skill:'Customer Service', desc:'Help guests check in, scan tickets, and answer basic venue questions.' },
  { id:'g3', title:'Remote data cleanup task', pay:38, time:'Anytime under 2 hours', type:'Online', fit:84, skill:'Computer', desc:'Flexible online task you can finish around your own schedule.' },
  { id:'g4', title:'Valet support shift', pay:95, time:'Friday 7–11 PM', type:'Local', fit:88, skill:'Driving', desc:'Evening shift with hourly pay plus possible tips.' },
  { id:'g5', title:'Brand ambassador pop-up', pay:110, time:'Sunday 12–4 PM', type:'Local', fit:79, skill:'Sales', desc:'Represent a local brand and hand out samples.' },
  { id:'g6', title:'Paid product feedback', pay:25, time:'Any night this week', type:'Online', fit:74, skill:'Survey', desc:'Simple feedback opportunity for extra cash in small windows.' }
];
const lessons = [
  { id:'l1', title:'Build a $500/month side income plan', mins:7, desc:'Pick a goal, split it into weekly targets, and choose the right gig mix.' },
  { id:'l2', title:'Avoid low-paying side hustle traps', mins:5, desc:'How to calculate real hourly pay after gas, fees, waiting time, and taxes.' },
  { id:'l3', title:'Use 3 income windows per week', mins:6, desc:'Turn evenings and weekends into a repeatable earning rhythm.' },
  { id:'l4', title:'Track cash without overthinking it', mins:4, desc:'A simple system for logging side income and staying motivated.' }
];
let deferredPrompt = null;
let state = loadState();
const view = document.getElementById('view');
const modalRoot = document.getElementById('modalRoot');

function today(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function money(n){ return '$' + Number(n||0).toLocaleString(); }
function loadState(){ try{ return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY))||{}) }; }catch{ return defaultState; } }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),2200); }
function setRoute(route){ location.hash = route; render(); }
function route(){ return location.hash.replace('#','') || 'home'; }
function totalEarned(){ return state.earnings.reduce((a,e)=>a+Number(e.amount||0),0); }
function percent(){ return Math.min(100, Math.round(totalEarned()/state.goal*100)); }
function applyTheme(){ document.body.classList.toggle('dark', state.theme==='dark'); }
function page(title, content){ return `<div class="section-title"><h2>${title}</h2></div>${content}`; }
function updateNav(){ document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.route===route())); }

function home(){
  return `
  <section class="hero">
    <div>
      <span class="eyebrow">⚡ Built for 9-to-5 workers</span>
      <h1>Supplement your income without quitting your 9-to-5.</h1>
      <p>Domin8 helps regular hourly employees find schedule-matched side income, track goals, and build better money habits after work.</p>
      <div class="cta-row">
        <button class="primary-btn" onclick="setRoute('match')">Find My Income Match</button>
        <button class="secondary-btn" onclick="setRoute('dashboard')">Open Dashboard</button>
      </div>
    </div>
    <div class="hero-card">
      <div class="section-title" style="margin-top:0"><h2>Domin Meter</h2><span class="small">${money(totalEarned())} / ${money(state.goal)}</span></div>
      <div class="meter"><span style="width:${percent()}%"></span></div>
      <p class="small">${percent()}% of your monthly side-income goal reached.</p>
      <div class="income-window">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>`<div class="window-row"><strong>${d}</strong><div class="bar-track"><div class="bar" style="width:${[35,48,22,56,75,92,64][i]}%"></div></div></div>`).join('')}
      </div>
    </div>
  </section>
  <section class="stats-grid">
    <div class="stat"><strong>${money(totalEarned())}</strong><small>Tracked side income</small></div>
    <div class="stat"><strong>${state.savedGigs.length}</strong><small>Saved opportunities</small></div>
    <div class="stat"><strong>${state.completedLessons.length}/${lessons.length}</strong><small>Lessons completed</small></div>
  </section>
  <section class="feature-grid">
    <div class="feature"><h3>◎ AI-style matching</h3><p>Filter side gigs by skill, location type, and real availability.</p></div>
    <div class="feature"><h3>▣ Income tracking</h3><p>Log each side-income win and watch your Domin Meter grow.</p></div>
    <div class="feature"><h3>◌ Micro lessons</h3><p>Quick money lessons for workers with limited time.</p></div>
  </section>`;
}
function dashboard(){
  const rows = state.earnings.map(e=>`<div class="gig-card"><div class="gig-head"><div><strong>${e.title}</strong><p>${e.date}</p></div><span class="pay">${money(e.amount)}</span></div><button class="danger-btn" onclick="deleteEarning('${e.id}')">Remove</button></div>`).join('') || `<div class="empty">No earnings logged yet.</div>`;
  return page('Dashboard', `
    <div class="two-grid">
      <div class="card">
        <h3>Monthly Goal</h3><div class="meter"><span style="width:${percent()}%"></span></div>
        <p><strong>${money(totalEarned())}</strong> earned toward <strong>${money(state.goal)}</strong></p>
        <form class="form" onsubmit="updateGoal(event)"><div class="field"><label>Change goal</label><input type="number" min="1" value="${state.goal}" name="goal"></div><button class="primary-btn">Update Goal</button></form>
      </div>
      <div class="card">
        <h3>Add Income</h3>
        <form class="form" onsubmit="addEarning(event)">
          <div class="field"><label>Gig / income name</label><input name="title" required placeholder="Example: Saturday delivery block"></div>
          <div class="field"><label>Amount</label><input type="number" min="1" name="amount" required placeholder="85"></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${today()}" required></div>
          <button class="primary-btn">Add Income</button>
        </form>
      </div>
    </div>
    <div class="section-title"><h2>Income Log</h2><button class="secondary-btn" onclick="exportData()">Export</button></div>
    <div class="two-grid">${rows}</div>`);
}
function match(){
  return page('Income Match', `
    <div class="card">
      <form class="form" onsubmit="saveProfile(event)">
        <div class="two-grid">
          <div class="field"><label>Main skill</label><select name="skill"><option>Driving</option><option>Delivery</option><option>Customer Service</option><option>Computer</option><option>Sales</option><option>Survey</option></select></div>
          <div class="field"><label>Best availability</label><select name="availability"><option>Evenings</option><option>Weekends</option><option>Early mornings</option><option>Flexible remote</option></select></div>
        </div>
        <button class="primary-btn">Update Matches</button>
      </form>
    </div>
    <div class="section-title"><h2>Recommended Gigs</h2><span class="small">Matched around your 9-to-5</span></div>
    <div class="feature-grid">${gigPool.map(g=>gigCard(g)).join('')}</div>`);
}
function gigCard(g){ const saved=state.savedGigs.includes(g.id); return `<div class="gig-card"><div class="gig-head"><div><span class="tag">${g.type} · ${g.fit}% fit</span><h3>${g.title}</h3><p>${g.desc}</p></div><span class="pay">${money(g.pay)}</span></div><p><strong>${g.time}</strong> · ${g.skill}</p><button class="${saved?'secondary-btn':'primary-btn'}" onclick="toggleGig('${g.id}')">${saved?'Saved ✓':'Save Gig'}</button></div>`; }
function gigs(){ const saved = gigPool.filter(g=>state.savedGigs.includes(g.id)); return page('Saved Gigs', `<div class="feature-grid">${saved.length?saved.map(g=>gigCard(g)).join(''):'<div class="empty">No saved gigs yet. Go to Match and save opportunities.</div>'}</div>`); }
function learn(){ return page('Learn', `<div class="feature-grid">${lessons.map(l=>`<div class="lesson-card"><span class="tag">${l.mins} min</span><h3>${l.title}</h3><p>${l.desc}</p><button class="${state.completedLessons.includes(l.id)?'secondary-btn':'primary-btn'}" onclick="completeLesson('${l.id}')">${state.completedLessons.includes(l.id)?'Completed ✓':'Mark Complete'}</button></div>`).join('')}</div>`); }
function render(){ applyTheme(); updateNav(); const r=route(); view.innerHTML = ({home, dashboard, match, gigs, learn}[r]||home)(); }

window.setRoute=setRoute;
window.updateGoal=e=>{ e.preventDefault(); state.goal=Number(e.target.goal.value)||500; saveState(); render(); toast('Goal updated'); };
window.addEarning=e=>{ e.preventDefault(); const f=new FormData(e.target); state.earnings.unshift({id:crypto.randomUUID(),title:f.get('title'),amount:Number(f.get('amount')),date:f.get('date')}); saveState(); render(); toast('Income added'); };
window.deleteEarning=id=>{ state.earnings=state.earnings.filter(e=>e.id!==id); saveState(); render(); toast('Income removed'); };
window.toggleGig=id=>{ state.savedGigs = state.savedGigs.includes(id) ? state.savedGigs.filter(x=>x!==id) : [...state.savedGigs,id]; saveState(); render(); toast(state.savedGigs.includes(id)?'Gig saved':'Gig removed'); };
window.completeLesson=id=>{ if(!state.completedLessons.includes(id)) state.completedLessons.push(id); saveState(); render(); toast('Lesson completed'); };
window.saveProfile=e=>{ e.preventDefault(); const f=new FormData(e.target); state.skills=[f.get('skill')]; state.availability=[f.get('availability')]; saveState(); toast('Matches updated'); };
window.exportData=()=>{ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='domin8-data.json'; a.click(); URL.revokeObjectURL(a.href); };

function openAuth(){ modalRoot.innerHTML=`<div class="modal-backdrop" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>Welcome to Domin8</h2><button class="icon-btn" onclick="modalRoot.innerHTML=''">✕</button></div><form class="form" onsubmit="auth(event)"><div class="field"><label>Name</label><input name="name" value="${state.user?.name||''}" placeholder="Your name" required></div><div class="field"><label>Email</label><input type="email" name="email" value="${state.user?.email||''}" placeholder="you@email.com" required></div><button class="primary-btn">Continue</button><button type="button" class="secondary-btn" onclick="demoGoogle()">Continue with Google</button></form></div></div>`; }
window.auth=e=>{ e.preventDefault(); const f=new FormData(e.target); state.user={name:f.get('name'),email:f.get('email')}; saveState(); modalRoot.innerHTML=''; document.getElementById('authBtn').textContent=state.user.name.split(' ')[0]; toast('Signed in locally'); };
window.demoGoogle=()=>{ state.user={name:'Domin8 User',email:'user@example.com'}; saveState(); modalRoot.innerHTML=''; document.getElementById('authBtn').textContent='User'; toast('Demo login active'); };
window.closeModal=e=>{ if(e.target.classList.contains('modal-backdrop')) modalRoot.innerHTML=''; };

document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>setRoute(b.dataset.route)));
document.getElementById('themeBtn').onclick=()=>{ state.theme=state.theme==='dark'?'light':'dark'; saveState(); render(); };
document.getElementById('authBtn').onclick=openAuth;
window.addEventListener('hashchange', render);
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBtn').classList.remove('hidden'); });
document.getElementById('installBtn').onclick=async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; document.getElementById('installBtn').classList.add('hidden'); };
if(state.user) document.getElementById('authBtn').textContent=state.user.name.split(' ')[0];
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js')); }
render();
