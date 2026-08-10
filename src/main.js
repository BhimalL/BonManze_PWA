/* ═══════════════════════════════════════════════════
   DOM SYNTAX & APPLICATION BRAIN
═══════════════════════════════════════════════════ */

// 1. Data Definitions
const BASE_DAYS = [
  { key: 'MON', label: 'Monday',    date: 'Mon 4 Aug' },
  { key: 'TUE', label: 'Tuesday',   date: 'Tue 5 Aug' },
  { key: 'WED', label: 'Wednesday', date: 'Wed 6 Aug' },
  { key: 'THU', label: 'Thursday',  date: 'Thu 7 Aug' },
  { key: 'FRI', label: 'Friday',    date: 'Fri 8 Aug' },
];

let DAYS = BASE_DAYS.map(d => ({ ...d }));

const baseKeyOf = dk => String(dk || '').split('_')[0];
const dayOf     = dk => DAYS.find(d => d.key === dk) || BASE_DAYS.find(d => d.key === baseKeyOf(dk));
const slotsFor  = bk => DAYS.filter(d => baseKeyOf(d.key) === bk);

function addDaySlot(baseKey) {
  const base = BASE_DAYS.find(d => d.key === baseKey);
  const seq  = slotsFor(baseKey).filter(d => d.additional).length + 1;
  const key  = `${baseKey}_${seq}`;
  const idx  = DAYS.map(d => baseKeyOf(d.key)).lastIndexOf(baseKey);
  DAYS.splice(idx + 1, 0, { key, label: base.label, date: base.date, additional: true, seq });
  MENUS[key] = MENUS[baseKey]; // Inherits menu items mapping
  return key;
}

const MENUS = {
  MON: [
    { id: 'veg', emoji: '🥦', name: 'Veg Curry',    desc: 'Creole spices · Local pumpkin & peas', price: 130, photo: '/veg_curry.jpg' },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry',desc: 'Home-style Mauritian masala',        price: 150, photo: '/chicken_curry.jpg' },
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry',   desc: 'Fresh local fish · Ginger infusion',   price: 190, photo: '/fish_curry.jpg' }
  ],
  TUE: [
    { id: 'len', emoji: '🥦', name: 'Lentil Curry', desc: 'Vegan yellow split-pea curry',         price: 125, photo: '/veg_curry.jpg' },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry',desc: 'Spiced · Onion & fresh tomato',        price: 150, photo: '/chicken_curry.jpg' },
    { id: 'prn', emoji: '🦐', name: 'Prawn Curry',  desc: 'Lemongrass & coconut milk',            price: 210, photo: '/fish_curry.jpg' }
  ],
  WED: [
    { id: 'veg', emoji: '🥦', name: 'Veg Curry',    desc: 'Seasonal vegetables, direct from market', price: 130, photo: '/veg_curry.jpg' },
    { id: 'beef',emoji: '🥩', name: 'Beef Curry',  desc: 'Slow-cooked in savory gravy',          price: 220, photo: '/chicken_curry.jpg' },
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry',   desc: 'Tamarind & crushed garlic',            price: 190, photo: '/fish_curry.jpg' }
  ],
  THU: [
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry',desc: 'Tandoori-spiced yoghurt marinade',    price: 150, photo: '/chicken_curry.jpg' },
    { id: 'shp', emoji: '🦐', name: 'Shrimp Curry', desc: 'Coconut cream · Mild spices',           price: 205, photo: '/fish_curry.jpg' },
    { id: 'veg', emoji: '🥦', name: 'Veg Curry',    desc: 'Aromatic coconut masala',              price: 130, photo: '/veg_curry.jpg' }
  ],
  FRI: [
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry',   desc: 'Tamarind special Friday slow-boil',    price: 190, photo: '/fish_curry.jpg' },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry',desc: 'Fresh thyme & rosemary special',       price: 150, photo: '/chicken_curry.jpg' },
    { id: 'pan', emoji: '🧀', name: 'Paneer Curry', desc: 'Sautéed paneer in spinach curry',      price: 160, photo: '/veg_curry.jpg' }
  ],
};

const BASES = [
  { id: 'wrice', emoji: '🍚', name: 'White Rice',      up: 0 },
  { id: 'brice', emoji: '🌾', name: 'Brown Rice',      up: 15 },
  { id: 'quin',  emoji: '🌿', name: 'Quinoa',          up: 25 },
  { id: 'cous',  emoji: '🫓', name: 'Couscous',        up: 20 },
  { id: 'caul',  emoji: '🥦', name: 'Cauliflower Rice',up: 20 },
];

const DHALS  = [{ id: 'moong', emoji: '🟡', name: 'Yellow Dhal' }, { id: 'red', emoji: '🟤', name: 'Red Lentil Dhal' }];
const SALADS = [{ id: 'garden',emoji: '🥗', name: 'Garden Salad' }, { id: 'slaw', emoji: '🥙', name: 'Creole Slaw' }];

const BEVERAGES = [
  { id: 'alouda',   emoji: '🥤', name: 'Alouda',       price: 35 },
  { id: 'lemonade', emoji: '🍋', name: 'Lemonade',     price: 30 },
  { id: 'water',    emoji: '💧', name: 'Mineral Water',price: 0 },
];

const DESSERTS = [
  { id: 'gateau',  emoji: '🍡', name: 'Gateau Piment', price: 25 },
  { id: 'fruits',  emoji: '🍌', name: 'Fruit Salad',   price: 30 },
  { id: 'cake',    emoji: '🎂', name: 'Coconut Cake',  price: 0 },
];

const ST = {
  confirmed: { label: 'Confirmed',  tone: 'ok' },
  preparing: { label: 'Preparing',  tone: 'warn' },
  delivering:{ label: 'En Route',   tone: 'info' },
  delivered: { label: 'Delivered',  tone: 'ok' },
  cancelled: { label: 'Cancelled',  tone: 'bad' },
};

const PAY_METHODS = {
  juice:  { icon: '💳', label: 'MCB Juice',        sub: 'Approve in Juice banking application', settle: 'now' },
  maucas: { icon: '📱', label: 'MauCAS QR',         sub: "Scan driver's MauCAS QR upon receipt", settle: 'door' },
  cash:   { icon: '💵', label: 'Cash on Delivery', sub: 'Pay the driver in cash on arrival',  settle: 'door' },
};

const isDoorMethod = m => !!m && PAY_METHODS[m].settle === 'door';

const WEEK2 = {
  label: 'Week of 11–15 Aug 2026', range: '11–15 Aug',
  days: [
    ['Mon 11 Aug', 'Lamb Curry · Rs 220', 'Chicken Curry · Rs 150', 'Veg Curry · Rs 130'],
    ['Tue 12 Aug', 'Fish Curry · Rs 190', 'Prawn Curry · Rs 210', 'Lentil Curry · Rs 125'],
    ['Wed 13 Aug', 'Beef Curry · Rs 220', 'Chicken Curry · Rs 150', 'Paneer Curry · Rs 160'],
    ['Thu 14 Aug', 'Shrimp Curry · Rs 205', 'Fish Curry · Rs 190', 'Veg Curry · Rs 130'],
    ['Fri 15 Aug', 'Chicken Curry · Rs 150', 'Lamb Curry · Rs 220', 'Veg Curry · Rs 130'],
  ],
};

// 2. Global State Variables
let cart = {};
let orderConfirmed = false;
let storeCredit = 0;
let simTimers = {};
let week2Sent = false;
let notifications = [];
let unreadNotifs = 0;
let currentPage = 'home';

// Customizer Wizard State
let wizardStep = 1; // 1: Curry, 2: Base, 3: Sides
let pendingCurry = null;
let pendingBase = null;
let pendingDhal = null;
let pendingSalad = null;
let pendingBev = null;
let pendingDes = null;
let pendingNote = '';
let buildMode = 'new'; // 'new' | 'additional' | 'edit'
let buildKey = null;
let additionalMode = false;
let additionalDay = null;
let additionalReplace = false;
let aoCart = {};

// UI Navigation States
let openDays = {};
let presetCurry = null;
let paySession = null;
let rateKey = null;
let selectedStars = 0;

// Scratch Card State
let scratchCardDrawn = false;
let isAudioEnabled = true;

// Web Audio API Elements
let audioCtx = null;

// Initialize sound context
function initAudio() {
  if (!isAudioEnabled) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 3. Web Audio Synthesis Functions
function playSizzleSound() {
  if (!isAudioEnabled) return;
  initAudio();
  const bufferSize = audioCtx.sampleRate * 0.4;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  filter.Q.value = 3.0;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noise.start();
}

function playPourSound() {
  if (!isAudioEnabled) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(360, audioCtx.currentTime + 0.6);
  
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.65);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.65);
}

function playCrunchSound() {
  if (!isAudioEnabled) return;
  initAudio();
  const bufferSize = audioCtx.sampleRate * 0.08;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2200;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  noise.start();
}

function playChimeSound() {
  if (!isAudioEnabled) return;
  initAudio();
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.8);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.8);
  });
}

function playBellSound() {
  if (!isAudioEnabled) return;
  initAudio();
  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(980, now);
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1400, now);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.2);
  osc2.stop(now + 1.2);
}

// 4. Utility Functions
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nowT() {
  const d = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function mealPrice(dk, item) {
  const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
  const c = MENUS[menuKey].find(x => x.id === item.curry);
  const b = BASES.find(x => x.id === item.base);
  const v = item.beverage && item.beverage !== 'none' ? BEVERAGES.find(x => x.id === item.beverage) : null;
  const s = item.dessert && item.dessert !== 'none' ? DESSERTS.find(x => x.id === item.dessert) : null;
  return (c?.price || 0) + (b?.up || 0) + (v?.price || 0) + (s?.price || 0);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function notify(icon, title, body) {
  notifications.unshift({ icon, title, body, time: nowT() });
  unreadNotifs++;
  const b = document.getElementById('notif-badge');
  b.style.display = '';
  b.textContent = unreadNotifs > 9 ? '9+' : unreadNotifs;
  toast(title);
  renderNotifs();
}

function renderNotifs() {
  const el = document.getElementById('nf-body');
  document.getElementById('nf-sub').textContent = notifications.length ? `${notifications.length} update${notifications.length !== 1 ? 's' : ''}` : 'Order updates';
  el.innerHTML = notifications.length
    ? notifications.map(n => `<div class="notif"><div class="ni">${n.icon}</div><div class="nb"><b>${n.title}</b><p>${n.body}</p></div><div class="nt">${n.time}</div></div>`).join('')
    : `<div class="empty" style="padding:24px 0"><div class="ee">🔔</div><p>No updates yet. Log items and menu announcements show up here.</p></div>`;
}

// 5. Navigation Router
function go(page) {
  currentPage = page;
  ['home', 'order', 'profile'].forEach(p => {
    document.getElementById('pg-' + p).classList.toggle('active', p === page);
    document.getElementById('tab-' + p).classList.toggle('on', p === page);
  });
  const m = document.getElementById('app-main');
  if (m) m.scrollTop = 0;
  if (page === 'home') renderHome();
  if (page === 'order') renderOrder();
  syncBars();
}

function openMenuPage() {
  renderMenu();
  document.getElementById('pg-menu').classList.add('on');
  document.querySelector('#pg-menu .fp-body').scrollTop = 0;
}

function closeMenuPage() {
  document.getElementById('pg-menu').classList.remove('on');
  renderHome();
  renderOrder();
}

function openSheet(id) {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.getElementById('scrim').classList.add('on');
  if (id === 'sh-notif') {
    unreadNotifs = 0;
    document.getElementById('notif-badge').style.display = 'none';
  }
}

function closeSheet() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  document.getElementById('scrim').classList.remove('on');
}

// 6. Theme Engine
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.getElementById('theme-btn').textContent = t === 'dark' ? '☼' : '☾';
  document.getElementById('theme-color-meta').content = t === 'dark' ? '#0B0E0F' : '#FAF6EE';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

// 7. Sound settings toggles
function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  const label = isAudioEnabled ? 'Enabled' : 'Disabled';
  document.getElementById('settings-audio-label').textContent = label;
  document.getElementById('audio-toggle-btn').textContent = isAudioEnabled ? '🔊' : '🔇';
  toast(`Audio effects ${isAudioEnabled ? 'turned on' : 'muted'}`);
  initAudio();
}

// 8. Dynamic Curry Photo Showcase updates
function updateShowcasePhoto(curryId) {
  const photoEl = document.getElementById('dish-showcase-photo');
  if (!photoEl) return;
  
  let src = '/chicken_curry.jpg'; // default fallback
  if (curryId === 'veg' || curryId === 'len' || curryId === 'pan') src = '/veg_curry.jpg';
  else if (curryId === 'fsh' || curryId === 'prn' || curryId === 'shp') src = '/fish_curry.jpg';
  
  photoEl.src = src;
  
  // Animation bounce
  photoEl.style.transform = 'scale(1.05)';
  setTimeout(() => { photoEl.style.transform = 'scale(1)'; }, 250);
}

// Render the interactive text overlay capsules on the hero photo
function renderShowcaseOverlay() {
  const pillsEl = document.getElementById('dish-overlay-pills');
  if (!pillsEl) return;
  
  const menuKey = MENUS[buildKey] ? buildKey : baseKeyOf(buildKey);
  const curryObj = MENUS[menuKey].find(c => c.id === pendingCurry);
  const baseObj = BASES.find(b => b.id === pendingBase);
  const dhalObj = pendingDhal && pendingDhal !== 'none' ? DHALS.find(d => d.id === pendingDhal) : null;
  const saladObj = pendingSalad && pendingSalad !== 'none' ? SALADS.find(s => s.id === pendingSalad) : null;
  
  let h = '';
  if (curryObj) h += `<span class="overlay-pill" id="pill-curry" onclick="jumpToWizardStep(1)">🍛 ${curryObj.name}</span>`;
  if (baseObj) h += `<span class="overlay-pill" id="pill-base" onclick="jumpToWizardStep(2)">🌾 ${baseObj.name}</span>`;
  if (dhalObj) h += `<span class="overlay-pill" id="pill-dhal" onclick="jumpToWizardStep(3)">🫘 ${dhalObj.name}</span>`;
  if (saladObj) h += `<span class="overlay-pill" id="pill-salad" onclick="jumpToWizardStep(3)">🥗 ${saladObj.name}</span>`;
  
  pillsEl.innerHTML = h;
}

// 9. Customizer Wizard Logic
function openBuild(mode, dk) {
  buildMode = mode;
  buildKey = dk;
  wizardStep = 1;
  
  const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
  const src = mode === 'edit' ? cart[dk] : (mode === 'additional' ? aoCart[baseKeyOf(dk)] : cart[dk]);
  
  const preset = presetCurry && MENUS[menuKey].some(c => c.id === presetCurry) ? presetCurry : null;
  presetCurry = null;
  
  pendingCurry = preset || src?.curry || MENUS[menuKey][0].id;
  pendingBase  = src?.base  || null;
  pendingDhal  = src?.dhal  ?? null;
  pendingSalad = src?.salad ?? null;
  pendingBev   = src?.beverage || 'none';
  pendingDes   = src?.dessert  || 'none';
  pendingNote  = src?.note || '';
  
  const day = dayOf(dk);
  document.getElementById('build-title').textContent = mode === 'edit' ? `Edit ${day.label}` : `${day.label} — Customise`;
  document.getElementById('build-sub').textContent = day.date;
  
  document.getElementById('meal-note').value = pendingNote;
  
  showWizardStep(1);
  updateShowcasePhoto(pendingCurry);
  renderShowcaseOverlay();
  
  document.getElementById('pg-build').classList.add('on');
}

function closeBuild() {
  document.getElementById('pg-build').classList.remove('on');
  if (buildMode === 'additional') additionalReplace = false;
  buildMode = 'new';
  buildKey = null;
  pendingNote = '';
}

function showWizardStep(step) {
  wizardStep = step;
  
  // Progress indicators
  document.getElementById('wizard-progress-fill').style.width = `${step * 33.3}%`;
  [1, 2, 3].forEach(s => {
    document.getElementById(`wiz-step-${s}`).classList.toggle('active', s === step);
    document.getElementById(`panel-step-${s}`).classList.toggle('active', s === step);
  });
  
  // Bottom footer button controls
  const prevBtn = document.getElementById('wiz-prev-btn');
  const nextBtn = document.getElementById('wiz-next-btn');
  
  prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
  nextBtn.textContent = step === 3 ? (buildMode === 'edit' ? 'Save Changes' : 'Add to Order') : 'Next →';
  
  renderStepOptions();
  updateBuildFoot();
}

function wizardNext() {
  if (wizardStep < 3) {
    // Validate that base is selected before advancing from step 2
    if (wizardStep === 2 && !pendingBase) {
      toast('Please choose a Base foundation first');
      return;
    }
    showWizardStep(wizardStep + 1);
  } else {
    addMealToCart();
  }
}

function wizardPrev() {
  if (wizardStep > 1) {
    showWizardStep(wizardStep - 1);
  }
}

function jumpToWizardStep(step) {
  // Prevent jumping to Step 3 if Base (Step 2) is not chosen yet
  if (step === 3 && !pendingBase) {
    toast('Select a Base foundation first');
    return;
  }
  showWizardStep(step);
}

function selectCurryItem(cid) {
  pendingCurry = cid;
  playSizzleSound();
  updateShowcasePhoto(cid);
  renderShowcaseOverlay();
  renderStepOptions();
  updateBuildFoot();
  
  // Auto-advance to Step 2 for a frictionless path
  setTimeout(() => {
    if (wizardStep === 1) showWizardStep(2);
  }, 350);
}

function selectBaseItem(bid) {
  pendingBase = bid;
  playCrunchSound();
  renderShowcaseOverlay();
  renderStepOptions();
  updateBuildFoot();
  
  // Auto-advance to Step 3
  setTimeout(() => {
    if (wizardStep === 2) showWizardStep(3);
  }, 350);
}

function selectSidesExtra(kind, id) {
  if (kind === 'dhal') {
    pendingDhal = id;
    if (id !== 'none') playCrunchSound();
  } else if (kind === 'salad') {
    pendingSalad = id;
    if (id !== 'none') playCrunchSound();
  } else if (kind === 'bev') {
    pendingBev = id;
    if (id !== 'none') playPourSound();
  } else if (kind === 'des') {
    pendingDes = id;
    if (id !== 'none') playCrunchSound();
  }
  
  renderShowcaseOverlay();
  renderStepOptions();
  updateBuildFoot();
}

function updatePendingNote(val) {
  pendingNote = val;
}

// 10. Options Rendering inside Customizer Panels
function renderStepOptions() {
  const menuKey = MENUS[buildKey] ? buildKey : baseKeyOf(buildKey);
  
  // Curry step options
  if (wizardStep === 1) {
    const el = document.getElementById('curry-options-container');
    el.innerHTML = MENUS[menuKey].map(c => `
      <button class="opt-card ${pendingCurry === c.id ? 'on' : ''}" onclick="selectCurryItem('${c.id}')">
        <div class="op-img"><img src="${c.photo}" alt="${c.name}"></div>
        <div class="op-info">
          <div class="op-title">${c.emoji} ${c.name}</div>
          <div class="op-desc">${c.desc}</div>
        </div>
        <div class="op-price">Rs ${c.price}</div>
      </button>
    `).join('');
  }
  
  // Base step options
  if (wizardStep === 2) {
    const el = document.getElementById('base-options-container');
    el.innerHTML = BASES.map(b => `
      <button class="opt-card ${pendingBase === b.id ? 'on' : ''}" onclick="selectBaseItem('${b.id}')">
        <div class="op-info">
          <div class="op-title">${b.emoji} ${b.name}</div>
          <div class="op-desc">${b.up ? `Premium selection` : 'Included standard'}</div>
        </div>
        <div class="op-price">${b.up ? `+Rs ${b.up}` : 'Included'}</div>
      </button>
    `).join('');
  }
  
  // Sides & Extras options
  if (wizardStep === 3) {
    // Dhal
    const dhalEl = document.getElementById('sides-dhal-container');
    dhalEl.innerHTML = `<div class="grp-lbl">🫘 Dhal Selection<span class="opt">Included</span></div>
      <div class="chips">
        ${DHALS.map(d => `<button class="chip ${pendingDhal === d.id ? 'on' : ''}" onclick="selectSidesExtra('dhal','${d.id}')">${d.emoji} ${d.name}</button>`).join('')}
        <button class="chip none ${pendingDhal === 'none' ? 'on' : ''}" onclick="selectSidesExtra('dhal','none')">✕ No Dhal</button>
      </div>`;
      
    // Salad
    const saladEl = document.getElementById('sides-salad-container');
    saladEl.innerHTML = `<div class="grp-lbl">🥗 Fresh Salad<span class="opt">Included</span></div>
      <div class="chips">
        ${SALADS.map(s => `<button class="chip ${pendingSalad === s.id ? 'on' : ''}" onclick="selectSidesExtra('salad','${s.id}')">${s.emoji} ${s.name}</button>`).join('')}
        <button class="chip none ${pendingSalad === 'none' ? 'on' : ''}" onclick="selectSidesExtra('salad','none')">✕ No Salad</button>
      </div>`;
      
    // Beverage
    const bevEl = document.getElementById('sides-beverage-container');
    bevEl.innerHTML = `<div class="grp-lbl">🥤 Drinks<span class="opt">Optional extra</span></div>
      <div class="chips">
        ${BEVERAGES.map(b => `<button class="chip ${pendingBev === b.id ? 'on' : ''}" onclick="selectSidesExtra('bev','${b.id}')">
          ${b.emoji} ${b.name} ${b.price ? `<span class="up">+Rs ${b.price}</span>` : '<span class="free">free</span>'}
        </button>`).join('')}
        <button class="chip none ${pendingBev === 'none' ? 'on' : ''}" onclick="selectSidesExtra('bev','none')">✕ None</button>
      </div>`;
      
    // Dessert
    const desEl = document.getElementById('sides-dessert-container');
    desEl.innerHTML = `<div class="grp-lbl">🍮 Sweet Treats<span class="opt">Optional extra</span></div>
      <div class="chips">
        ${DESSERTS.map(d => `<button class="chip ${pendingDes === d.id ? 'on' : ''}" onclick="selectSidesExtra('des','${d.id}')">
          ${d.emoji} ${d.name} ${d.price ? `<span class="up">+Rs ${d.price}</span>` : '<span class="free">free</span>'}
        </button>`).join('')}
        <button class="chip none ${pendingDes === 'none' ? 'on' : ''}" onclick="selectSidesExtra('des','none')">✕ None</button>
      </div>`;
  }
}

function buildTotal() {
  const menuKey = MENUS[buildKey] ? buildKey : baseKeyOf(buildKey);
  const c = MENUS[menuKey].find(x => x.id === pendingCurry);
  const b = BASES.find(x => x.id === pendingBase);
  const v = pendingBev && pendingBev !== 'none' ? BEVERAGES.find(x => x.id === pendingBev) : null;
  const s = pendingDes && pendingDes !== 'none' ? DESSERTS.find(x => x.id === pendingDes) : null;
  return (c?.price || 0) + (b?.up || 0) + (v?.price || 0) + (s?.price || 0);
}

function updateBuildFoot() {
  const ready = pendingCurry && pendingBase && pendingDhal !== null && pendingSalad !== null;
  const btn = document.getElementById('wiz-next-btn');
  document.getElementById('build-total').textContent = `Rs ${buildTotal()}`;
  if (wizardStep === 3) {
    btn.disabled = !ready;
  } else {
    btn.disabled = false;
  }
}

function addMealToCart() {
  if (!pendingBase || pendingDhal === null || pendingSalad === null) return;
  const skipped = [];
  if (pendingDhal === 'none') skipped.push('🫘 Dhal');
  if (pendingSalad === 'none') skipped.push('🥗 Salad');
  
  const freeBev = BEVERAGES.find(b => b.price === 0);
  const freeDes = DESSERTS.find(d => d.price === 0);
  if (freeBev && (!pendingBev || pendingBev === 'none')) skipped.push(`${freeBev.emoji} ${freeBev.name} (free)`);
  if (freeDes && (!pendingDes || pendingDes === 'none')) skipped.push(`${freeDes.emoji} ${freeDes.name} (free)`);
  
  if (skipped.length) {
    document.getElementById('skip-title').textContent = `Skip free items?`;
    document.getElementById('skip-body').innerHTML = `
      You chose to exclude:<br><br>
      <strong>${skipped.join('<br>')}</strong><br><br>
      These additions are included free with your selection. Skip them anyway?`;
    openSheet('sh-skip');
    return;
  }
  commitMealToCart();
}

function backToBuild() {
  closeSheet();
}

function commitMealToCart() {
  const key = buildKey, mode = buildMode;
  const meal = {
    curry: pendingCurry,
    base: pendingBase,
    dhal: pendingDhal,
    salad: pendingSalad,
    beverage: pendingBev || 'none',
    dessert: pendingDes || 'none',
    note: pendingNote.trim(),
  };

  if (mode === 'additional') {
    aoCart[baseKeyOf(key)] = { ...meal, replace: additionalReplace };
    openDays[baseKeyOf(key)] = false;
    closeBuild();
    closeSheet();
    renderMenu();
    toast('Extra meal pending — confirm adding to My Order below');
    return;
  }
  if (mode === 'edit') {
    Object.assign(cart[key], meal);
    closeBuild();
    closeSheet();
    renderMenu();
    renderOrder();
    renderHome();
    toast('Meal updated');
    return;
  }
  cart[key] = {
    ...meal,
    status: 'confirmed',
    expanded: false,
    deliveryConfirmed: false,
    rated: false,
    payMethod: null,
    paid: false,
  };
  openDays[baseKeyOf(key)] = false;
  closeBuild();
  closeSheet();
  renderMenu();
  renderOrder();
  renderHome();
  toast(`${dayOf(key).label} added · Rs ${mealPrice(key, cart[key])}`);
}

// 11. Extra Meals Flow
function startAdditional(dk) {
  additionalMode = true;
  aoCart = {};
  openMenuPage();
  if (dk) {
    setTimeout(() => pickDayForAdditional(dk), 120);
  } else {
    toast('Choose a day to add an extra meal');
  }
}

function pickDayForAdditional(dk) {
  additionalDay = dk;
  const booked = slotsFor(dk).filter(x => cart[x.key] && cart[x.key].status !== 'cancelled');
  if (booked.length) {
    const it = cart[booked[0].key];
    const menuKey = MENUS[booked[0].key] ? booked[0].key : baseKeyOf(booked[0].key);
    const c = MENUS[menuKey].find(x => x.id === it.curry);
    const b = BASES.find(x => x.id === it.base);
    const extras = booked.filter(x => x.additional).length;
    document.getElementById('ex-title').textContent = `${dayOf(dk).label} already selected`;
    document.getElementById('ex-body').innerHTML = `
      Your order for <strong>${dayOf(dk).label}</strong> includes:
      <div class="panel">
        <strong>${c.emoji} ${c.name}</strong> · ${b.name}
        <div style="color:var(--primary);font-size:12px;margin-top:3px">✓ Confirmed${it.paid ? ' · Paid' : ''}</div>
      </div>
      ${extras ? `<div style="color:var(--accent-deep);font-size:12.5px;margin-bottom:10px">➕ Plus ${extras} extra meal${extras !== 1 ? 's' : ''} already scheduled.</div>` : ''}
      What would you like to do?`;
    openSheet('sh-extra');
  } else {
    additionalReplace = false;
    openBuild('additional', dk);
  }
}

function chooseAdditionalMode(mode) {
  additionalReplace = (mode === 'replace');
  closeSheet();
  setTimeout(() => openBuild('additional', additionalDay), 140);
}

function editAoMeal(dk) {
  additionalReplace = !!aoCart[dk]?.replace;
  openBuild('additional', dk);
}

function removeAoMeal(dk) {
  delete aoCart[dk];
  renderMenu();
  toast('Extra meal removed');
}

function cancelAdditionalOrder() {
  const n = Object.keys(aoCart).length;
  if (!n) {
    discardAdditionalOrder(true);
    return;
  }
  document.getElementById('dc-body').innerHTML = `
    You drafted <strong>${n} extra meal${n !== 1 ? 's' : ''}</strong>.
    Discarding them leaves your confirmed order unaffected. Discard anyway?`;
  openSheet('sh-discard');
}

function discardAdditionalOrder(silent) {
  closeSheet();
  const n = Object.keys(aoCart).length;
  aoCart = {};
  additionalMode = false;
  additionalDay = null;
  additionalReplace = false;
  renderMenu();
  renderOrder();
  renderHome();
  if (!silent && n) toast('Extra meals discarded');
}

function commitAdditionalToOrder() {
  const keys = Object.keys(aoCart);
  if (!keys.length) return;

  let added = 0;
  keys.forEach(dk => {
    const ao = aoCart[dk];
    const meal = {
      curry: ao.curry,
      base: ao.base,
      dhal: ao.dhal,
      salad: ao.salad,
      beverage: ao.beverage || 'none',
      dessert: ao.dessert || 'none',
      note: ao.note || '',
      status: 'confirmed',
      expanded: false,
      deliveryConfirmed: false,
      rated: false,
      payMethod: null,
      paid: false,
    };
    const occupied = cart[dk] && cart[dk].status !== 'cancelled';
    if (!occupied) {
      cart[dk] = meal;
    } else if (ao.replace) {
      const prev = cart[dk];
      if (prev.paid) {
        storeCredit += mealPrice(dk, prev);
        document.getElementById('pro-credit').textContent = `Rs ${storeCredit}`;
        toast(`Rs ${mealPrice(dk, prev)} refunded as store credit`);
      }
      cart[dk] = { ...meal, status: prev.status, simStarted: prev.simStarted, cutoffPassed: prev.cutoffPassed };
    } else {
      cart[addDaySlot(dk)] = meal;
    }
    added++;
  });

  aoCart = {};
  additionalMode = false;
  additionalDay = null;
  additionalReplace = false;
  
  document.getElementById('pg-menu').classList.remove('on');
  renderMenu();
  renderOrder();
  renderHome();
  go('order');
  
  notify('➕', 'Extra meals added', `${added} extra meal${added !== 1 ? 's' : ''} added to your order.`);
}

// 12. Checkout & Payment Handling
function checkout() {
  const active = activeSlots();
  if (!active.length) return;
  active.forEach(d => {
    cart[d.key].payMethod = null;
    cart[d.key].paid = false;
  });
  orderConfirmed = true;
  
  // Award points on checkout (15 points to reach 100)
  document.getElementById('pro-points').textContent = '100';
  document.getElementById('loyalty-bar').style.width = '100%';
  document.getElementById('loyalty-hint').textContent = '🥇 Gold Tier Reached! Claim your loyalty gift.';
  document.getElementById('pro-badge').textContent = '🥇 Gold Tier';
  document.getElementById('scratch-win-btn').style.display = 'block'; // Reveal scratch reward card
  
  playChimeSound();
  renderMenu();
  renderOrder();
  renderHome();
  
  notify('✅', 'Order confirmed!', `${active.length} meals registered · checkout complete. Play your loyalty scratch card in your profile!`);
}

function payBalance() {
  const slots = unpaidSlots();
  if (!slots.length) return;
  openPayMethodSheet({
    keys: slots.map(d => d.key),
    amount: slots.reduce((t, d) => t + mealPrice(d.key, cart[d.key]), 0),
    what: slots.length === 1 ? `${slots[0].label} · ${slots[0].date}` : `${slots.length} meals · total balance`,
  });
}

function openMealPay(dk) {
  const it = cart[dk], day = dayOf(dk);
  openPayMethodSheet({
    keys: [dk],
    amount: mealPrice(dk, it),
    what: `${day.label}${day.additional ? ` · extra ${day.seq}` : ''} (${day.date})`,
  });
}

function openPayMethodSheet({ keys, amount, what }) {
  if (!keys.length) return;
  paySession = {
    keys,
    amount,
    what,
    method: null,
    ref: 'BMZ-PAY-' + Math.floor(Math.random() * 900000 + 100000)
  };
  renderPaySheet();
  openSheet('sh-pay');
}

function renderPaySheet() {
  const ps = paySession;
  if (!ps) return;
  const t = document.getElementById('pay-title');
  const sub = document.getElementById('pay-sub');
  const body = document.getElementById('pay-body');
  const foot = document.getElementById('pay-foot');

  if (!ps.method) {
    t.textContent = `Pay Rs ${ps.amount}`;
    sub.textContent = ps.what;
    body.innerHTML = `
      <div style="color:var(--muted);font-size:12.5px;margin-bottom:12px">Choose a payout channel:</div>
      ${Object.entries(PAY_METHODS).map(([k, m]) => `
        <button class="pick" onclick="pickMethod('${k}')">
          <span class="pi">${m.icon}</span>
          <span class="pt"><b>${m.label}</b><span>${m.sub}</span></span>
          <span class="pw" style="color:${m.settle === 'now' ? 'var(--primary)' : 'var(--accent-deep)'}">${m.settle === 'now' ? 'Pay Now' : 'At Door'}</span>
        </button>`).join('')}`;
    foot.innerHTML = `<button class="btn outline block" onclick="cancelPayNow()">Settle Later</button>`;
    return;
  }

  const m = PAY_METHODS[ps.method];
  t.textContent = m.label;
  sub.textContent = `Rs ${ps.amount} · ${ps.what}`;

  if (m.settle === 'now') {
    body.innerHTML = `
      Confirming will simulate a redirect connection to your <strong>Juice by MCB</strong> bank app to authorize:
      <div class="panel">
        <div class="drow"><span class="dl">Merchant</span><span class="dv">BonManzE Ltd</span></div>
        <div class="drow"><span class="dl">Reference</span><span class="dv mono">${ps.ref}</span></div>
        <div class="drow"><span class="dl">Summary</span><span class="dv">${esc(ps.what)}</span></div>
        <div class="drow"><span class="dl">Amount</span><span class="dv" style="color:var(--primary);font-weight:800">Rs ${ps.amount}</span></div>
      </div>`;
  } else {
    const instruction = ps.method === 'maucas'
      ? `The driver will bring a Mauritian banking QR on delivery. Scan it to execute payment of <strong style="color:var(--primary)">Rs ${ps.amount}</strong>.`
      : `Have <strong style="color:var(--primary)">Rs ${ps.amount}</strong> cash ready on hand for the delivery driver.`;
    body.innerHTML = `
      ${instruction}
      <div class="panel">
        <div class="ph">Payment Reference</div>
        <div class="drow"><span class="dl">Ref Code</span><span class="dv mono">${ps.ref}</span></div>
        <div class="drow"><span class="dl">Recipient</span><span class="dv">BonManzE Delivery</span></div>
        <div class="drow"><span class="dl">Summary</span><span class="dv">${esc(ps.what)}</span></div>
        <div class="drow"><span class="dl">Amount Due</span><span class="dv" style="color:var(--accent-deep);font-weight:800">Rs ${ps.amount}</span></div>
      </div>`;
  }
  foot.innerHTML = `
    <button class="btn primary block" onclick="commitPayment()">${m.settle === 'now' ? 'Authorise Payment' : 'Confirm Order Option'}</button>
    <button class="btn outline block" onclick="payBackToMethods()">← Select Another Option</button>`;
}

function pickMethod(k) {
  if (paySession) {
    paySession.method = k;
    renderPaySheet();
  }
}

function payBackToMethods() {
  if (paySession) {
    paySession.method = null;
    renderPaySheet();
  }
}

function cancelPayNow() {
  paySession = null;
  closeSheet();
}

function commitPayment() {
  const ps = paySession;
  if (!ps || !ps.method) return;
  const m = PAY_METHODS[ps.method];
  
  ps.keys.forEach(k => {
    const it = cart[k];
    if (!it) return;
    it.payMethod = ps.method;
    it.payRef = ps.ref;
    if (m.settle === 'now') it.paid = true;
  });
  
  paySession = null;
  closeSheet();
  
  if (m.settle === 'now') {
    playChimeSound();
    notify('✅', 'Payment verified!', `Rs ${ps.amount} successfully processed. Thank you!`);
  } else {
    toast(`Payment option confirmed! Rs ${ps.amount} due on delivery.`);
  }
  
  renderOrder();
  renderHome();
}

// 13. Cancel Meals
function openCancel(dk) {
  const it = cart[dk];
  const day = dayOf(dk);
  const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
  const c = MENUS[menuKey].find(x => x.id === it.curry);
  const b = BASES.find(x => x.id === it.base);
  const price = mealPrice(dk, it);
  
  document.getElementById('cx-title').textContent = `Cancel ${day.additional ? `extra meal ${day.seq}` : day.label}?`;
  document.getElementById('cx-body').innerHTML = `
    Are you sure you want to cancel your order for <strong>${day.label} (${day.date})</strong>?
    <div class="panel">
      <strong>${c.emoji} ${c.name}</strong> · ${b.name}
    </div>
    ${it.paid ? `💰 <strong>Rs ${price} store credit</strong> will be instantly refunded to your balance.` : 'No payment was made yet. No fee applied.'}
    <div class="help" style="margin-top: 10px;">⚠️ Cancellations must be completed before the 9:00 AM cutoff on the delivery day.</div>`;
    
  const btn = document.getElementById('cx-btn');
  btn.textContent = it.paid ? '🗑️ Yes, Cancel & Get Credit' : '🗑️ Yes, Cancel Meal';
  btn.onclick = () => doCancel(dk, it.paid ? price : 0);
  openSheet('sh-cancel');
}

function doCancel(dk, credit) {
  ['::1', '::2', '::3'].forEach(suffix => clearTimeout(simTimers[dk + suffix]));
  cart[dk].status = 'cancelled';
  cart[dk].expanded = true;
  
  if (credit > 0) {
    storeCredit += credit;
    document.getElementById('pro-credit').textContent = `Rs ${storeCredit}`;
  }
  
  closeSheet();
  renderMenu();
  renderOrder();
  renderHome();
  notify('❌', 'Meal Cancelled', `Your delivery for ${dayOf(dk).label} was cancelled.`);
}

// 14. Logistics Status Milestones Simulation
function runSimulation() {
  if (!orderConfirmed) {
    toast('Confirm your checkout details first');
    return;
  }
  
  const pending = activeSlots().filter(d => cart[d.key].status === 'confirmed' && !cart[d.key].simStarted);
  if (!pending.length) {
    toast('No pending deliveries left to simulate');
    return;
  }
  
  pending.forEach(d => {
    cart[d.key].cutoffPassed = true;
    cart[d.key].logs = [
      { time: '09:00 AM', text: '🔒 Cutoff passed. Meal choices locked for preparation.' }
    ];
  });
  
  renderOrder();
  notify('👨‍🍳', 'Kitchen prep started', `${pending.length} meals locked and being prepared by Chef Anil.`);
  
  pending.forEach((d, idx) => {
    const dk = d.key;
    const offset = idx * 4500;
    cart[dk].simStarted = true;
    
    // Milestone 1: Preparing
    simTimers[dk + '::1'] = setTimeout(() => {
      if (cart[dk]?.status === 'confirmed') {
        cart[dk].status = 'preparing';
        cart[dk].logs.push({ time: '11:15 AM', text: '👨‍🍳 Chef Anil started tempering Mauritian curry spices.' });
        cart[dk].logs.push({ time: '11:30 AM', text: '🌡️ Temperature check completed: 78°C. Food safe.' });
        renderOrder();
        renderHome();
      }
    }, 2500 + offset);
    
    // Milestone 2: En Route (Driver logs & comments)
    simTimers[dk + '::2'] = setTimeout(() => {
      if (cart[dk]?.status === 'preparing') {
        cart[dk].status = 'delivering';
        cart[dk].driverComment = "Scooter cargo locked. Just passing Grand River bridge, traffic is smooth!";
        cart[dk].logs.push({ time: '11:45 AM', text: '🍱 Packed in hot-holding thermal courier cells.' });
        cart[dk].logs.push({ time: '11:58 AM', text: '🛵 Handed to courier Rundhir (+230 5712 3456). En Route.' });
        renderOrder();
        renderHome();
        notify('🛵', 'Meal is En Route!', `Rundhir is riding to ABC Group, Ebene with your lunch.`);
      }
    }, 7000 + offset);
    
    // Milestone 3: Delivered
    simTimers[dk + '::3'] = setTimeout(() => {
      if (cart[dk]?.status === 'delivering') {
        cart[dk].status = 'delivered';
        cart[dk].driverComment = "Arrived in the Ebene Block B lobby! Left it at the reception counter.";
        cart[dk].logs.push({ time: '12:12 PM', text: '📦 Delivered at ABC Group, Block B reception desk.' });
        
        playBellSound();
        renderOrder();
        renderHome();
        notify('📦', 'Lunch Delivered!', `Your meal for ${dayOf(dk).label} has arrived at Block B reception.`);
      }
    }, 12000 + offset);
  });
  
  // Settle driver cash payments if applicable
  setTimeout(settleDoorPayments, 15000 + (pending.length - 1) * 4500);
}

function settleDoorPayments() {
  const groups = {};
  activeSlots().forEach(d => {
    const it = cart[d.key];
    if (!it.paid && isDoorMethod(it.payMethod) && it.payRef) {
      (groups[it.payRef] = groups[it.payRef] || []).push(d.key);
    }
  });
  
  let collected = 0;
  Object.values(groups).forEach(keys => {
    if (keys.some(k => cart[k].status === 'delivered')) {
      keys.forEach(k => {
        if (!cart[k].paid) {
          collected += mealPrice(k, cart[k]);
          cart[k].paid = true;
        }
      });
    }
  });
  
  renderOrder();
  renderHome();
  if (collected) {
    notify('💰', 'Payment collected', `Driver collected Rs ${collected} for the delivered meals.`);
  }
}

function runNextWeek() {
  if (!orderConfirmed) {
    toast('Confirm current week checkout first');
    return;
  }
  if (week2Sent) {
    toast('Next week\'s menu is already online');
    return;
  }
  week2Sent = true;
  renderMenu();
  renderHome();
  notify('📅', 'Next week\'s menu is live!', `Order now for ${WEEK2.label} from your menu tab.`);
}

// 15. Loyalty Canvas Scratch Card Game
function openScratchCard() {
  openSheet('sh-scratch');
  
  if (scratchCardDrawn) return;
  scratchCardDrawn = true;
  
  const canvas = document.getElementById('scratch-canvas');
  const ctx = canvas.getContext('2d');
  
  // Create solid silver scratch layer
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Brushed metallic noise texture details
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 15, 1);
  }
  
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 15);
  }
  
  // Scratch card title text
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#3F4E44';
  ctx.textAlign = 'center';
  ctx.fillText('🎁 Scratch with mouse/finger!', canvas.width / 2, 70);
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BonManzE Gold Loyalty Reward', canvas.width / 2, 94);
  
  // Mouse / Touch Scratch triggers
  let isScratching = false;
  
  function scratch(e) {
    if (!isScratching) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    
    // Check cleared area
    checkClearedPercentage();
  }
  
  canvas.addEventListener('mousedown', () => { isScratching = true; initAudio(); });
  canvas.addEventListener('mousemove', scratch);
  window.addEventListener('mouseup', () => { isScratching = false; });
  
  canvas.addEventListener('touchstart', (e) => { isScratching = true; initAudio(); e.preventDefault(); });
  canvas.addEventListener('touchmove', (e) => { scratch(e); e.preventDefault(); });
  window.addEventListener('touchend', () => { isScratching = false; });
  
  function checkClearedPercentage() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let clearedCount = 0;
    
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) clearedCount++;
    }
    
    const percentage = clearedCount / (canvas.width * canvas.height);
    if (percentage > 0.55) {
      // Clear remaining overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById('scratch-claim-btn').disabled = false;
      playBellSound();
    }
  }
}

function claimScratchReward() {
  storeCredit += 50;
  document.getElementById('pro-credit').textContent = `Rs ${storeCredit}`;
  document.getElementById('scratch-win-btn').style.display = 'none'; // Hide scratch reward button
  
  closeSheet();
  toast('🎉 Rs 50 store credit added to your profile!');
  playChimeSound();
}

function copyReferralCode() {
  const code = document.getElementById('ref-codebox').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast('📋 Referral code copied to clipboard!');
  }).catch(() => {
    toast('Copied: ' + code);
  });
}

// 16. Confirmation Deliver
function openDeliver(dk) {
  const it = cart[dk];
  const day = dayOf(dk);
  const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
  const c = MENUS[menuKey].find(x => x.id === it.curry);
  const b = BASES.find(x => x.id === it.base);
  const dhal = it.dhal && it.dhal !== 'none' ? DHALS.find(x => x.id === it.dhal) : null;
  const salad = it.salad && it.salad !== 'none' ? SALADS.find(x => x.id === it.salad) : null;
  const bev = it.beverage && it.beverage !== 'none' ? BEVERAGES.find(x => x.id === it.beverage) : null;
  const des = it.dessert && it.dessert !== 'none' ? DESSERTS.find(x => x.id === it.dessert) : null;
  const price = mealPrice(dk, it);

  let dueMsg = '';
  if (it.paid) {
    dueMsg = `<span class="badge outline" data-tone="ok">✅ Fully Paid</span> Paid in full. No payment due at the door.`;
  } else if (!it.payMethod) {
    dueMsg = `💰 <strong>Rs ${price} due.</strong> Choose a payment option (Juice, MauCAS, Cash) in My Order first.`;
  } else if (it.payMethod === 'juice') {
    dueMsg = `💳 <strong>Rs ${price} pending via MCB Juice</strong>. Complete payment inside your order screen.`;
  } else {
    dueMsg = it.payMethod === 'maucas'
      ? `📱 <strong>Scan MauCAS QR for Rs ${price}</strong> on receipt.`
      : `💵 <strong>Rs ${price} due in cash</strong> to the delivery driver.`;
  }

  document.getElementById('dv-title').textContent = `${day.label} Delivery`;
  document.getElementById('dv-sub').textContent = `${day.date}${day.additional ? ` · Extra ${day.seq}` : ''}`;
  document.getElementById('dv-body').innerHTML = `
    Please confirm that you have received your lunch box:
    <div class="panel">
      <div class="drow"><span class="dl">Curry</span><span class="dv">${c.emoji} ${c.name}</span></div>
      <div class="drow"><span class="dl">Base</span><span class="dv">${b.emoji} ${b.name}</span></div>
      ${dhal ? `<div class="drow"><span class="dl">Dhal</span><span class="dv">${dhal.emoji} ${dhal.name}</span></div>` : ''}
      ${salad ? `<div class="drow"><span class="dl">Salad</span><span class="dv">${salad.emoji} ${salad.name}</span></div>` : ''}
      ${bev ? `<div class="drow"><span class="dl">Drink</span><span class="dv">${bev.emoji} ${bev.name}</span></div>` : ''}
      ${des ? `<div class="drow"><span class="dl">Dessert</span><span class="dv">${des.emoji} ${des.name}</span></div>` : ''}
      <div class="drow"><span class="dl">Total</span><span class="dv" style="color:var(--primary);font-weight:800">Rs ${price}</span></div>
    </div>
    ${dueMsg}`;
  document.getElementById('dv-btn').onclick = () => confirmDeliver(dk);
  openSheet('sh-deliver');
}

function confirmDeliver(dk) {
  cart[dk].deliveryConfirmed = true;
  cart[dk].expanded = true;
  closeSheet();
  renderOrder();
  renderHome();
  toast('✅ Delivery receipt confirmed. Enjoy your lunch!');
}

// 17. Rating Meals
const STAR_LABELS = { 1: 'Poor', 2: 'Mediocre', 3: 'Good', 4: 'Very Good', 5: 'Excellent!' };

function openRate(dk) {
  rateKey = dk;
  selectedStars = 0;
  const day = dayOf(dk);
  document.getElementById('rt-sub').textContent = `${day.label}${day.additional ? ` · Extra ${day.seq}` : ''} (${day.date})`;
  document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
  document.getElementById('star-lbl').textContent = '';
  document.getElementById('rate-note').value = '';
  document.getElementById('rate-btn').disabled = true;
  openSheet('sh-rate');
}

function selectStar(n) {
  selectedStars = n;
  document.querySelectorAll('.star').forEach((s, idx) => s.classList.toggle('lit', idx < n));
  document.getElementById('star-lbl').textContent = STAR_LABELS[n] || '';
  document.getElementById('rate-btn').disabled = false;
}

function submitRating() {
  if (!selectedStars || !rateKey) return;
  const it = cart[rateKey];
  it.rated = true;
  it.stars = selectedStars;
  it.comment = document.getElementById('rate-note').value.trim();
  closeSheet();
  renderOrder();
  toast(`Thank you! ${selectedStars}★ rating shared with our culinary crew.`);
}

// 18. Receipts
function openReceipt(dk) {
  const it = cart[dk];
  const day = dayOf(dk);
  const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
  const c = MENUS[menuKey].find(x => x.id === it.curry);
  const b = BASES.find(x => x.id === it.base);
  const dhal = it.dhal && it.dhal !== 'none' ? DHALS.find(x => x.id === it.dhal) : null;
  const salad = it.salad && it.salad !== 'none' ? SALADS.find(x => x.id === it.salad) : null;
  const bev = it.beverage && it.beverage !== 'none' ? BEVERAGES.find(x => x.id === it.beverage) : null;
  const des = it.dessert && it.dessert !== 'none' ? DESSERTS.find(x => x.id === it.dessert) : null;
  const price = mealPrice(dk, it);
  const ref = `BMZ-2026-08-${dk.replace('_', '-X')}`;

  document.getElementById('rc-sub').textContent = `${day.label} · ${day.date}`;
  document.getElementById('rc-body').innerHTML = `
    <div class="receipt">
      <div class="receipt-top">
        <div style="font-size:32px">🍛</div>
        <div style="font-weight:800;font-size:17px;color:var(--primary)">BonManzE</div>
        <div style="font-size:11px;color:var(--muted)">Mauritian Lunch Deliveries</div>
      </div>
      <div class="drow"><span class="dl">Date</span><span class="dv">${day.date}</span></div>
      ${day.additional ? `<div class="drow"><span class="dl">Order Type</span><span class="dv" style="color:var(--accent-deep)">Extra Meal ${day.seq}</span></div>` : ''}
      ${it.note ? `<div class="drow"><span class="dl">Recipient</span><span class="dv" style="color:var(--accent-deep)">🎁 ${esc(it.note)}</span></div>` : ''}
      <div class="drow"><span class="dl">Customer</span><span class="dv">Bhimal L.</span></div>
      <div class="drow"><span class="dl">Location</span><span class="dv">ABC Group, Ebene</span></div>
      <div class="drow"><span class="dl">Payout Method</span><span class="dv">${PAY_METHODS[it.payMethod]?.icon || ''} ${PAY_METHODS[it.payMethod]?.label || '—'}</span></div>
      ${it.payRef ? `<div class="drow"><span class="dl">Ref Number</span><span class="dv mono">${it.payRef}</span></div>` : ''}
      <div class="divider"></div>
      <div class="drow"><span class="dl">${c.emoji} ${c.name}</span><span class="dv">Rs ${c.price}</span></div>
      <div class="drow"><span class="dl">${b.emoji} ${b.name}</span><span class="dv">${b.up ? `+Rs ${b.up}` : 'Included'}</span></div>
      ${dhal ? `<div class="drow"><span class="dl">${dhal.emoji} ${dhal.name}</span><span class="dv">Included</span></div>` : ''}
      ${salad ? `<div class="drow"><span class="dl">${salad.emoji} ${salad.name}</span><span class="dv">Included</span></div>` : ''}
      ${bev ? `<div class="drow"><span class="dl">${bev.emoji} ${bev.name}</span><span class="dv">${bev.price ? `+Rs ${bev.price}` : 'Free'}</span></div>` : ''}
      ${des ? `<div class="drow"><span class="dl">${des.emoji} ${des.name}</span><span class="dv">${des.price ? `+Rs ${des.price}` : 'Free'}</span></div>` : ''}
      <div class="tot"><span>Total Settled</span><span class="ta">Rs ${price}</span></div>
      <div style="text-align:center;margin-top:12px"><span class="badge outline" data-tone="ok" style="font-size:12px;padding:6px 14px">✅ PAID IN FULL</span></div>
      <div style="text-align:center;margin-top:8px" class="mono help">${ref}</div>
    </div>`;
  openSheet('sh-receipt');
}

// 19. Home Dashboard renderer
function renderHome() {
  const active = activeSlots();
  const owed = balanceDue();
  const total = orderTotal();

  document.getElementById('home-head').innerHTML = orderConfirmed
    ? "Your week<br>is locked in."
    : active.length ? "Your order<br>is taking shape." : "Authentic Mauritian<br>lunch delivered.";
    
  document.getElementById('home-lede').textContent = orderConfirmed
    ? (owed > 0 ? `Rs ${owed} outstanding · pay anytime before receipt` : 'All paid · deliveries arrive between 11:30–12:00')
    : 'Order by Sunday noon · Hot deliveries Mon–Fri';

  const cta = document.getElementById('home-cta');
  if (!active.length) {
    cta.innerHTML = 'Browse Week\'s Menu <span>→</span>';
    cta.onclick = openMenuPage;
  } else if (!orderConfirmed) {
    cta.innerHTML = 'Review &amp; Checkout <span>→</span>';
    cta.onclick = () => go('order');
  } else {
    cta.innerHTML = 'Add Extra Meals <span>→</span>';
    cta.onclick = openMenuPage;
  }

  const el = document.getElementById('home-summary');
  if (!active.length) {
    el.innerHTML = '';
    return;
  }

  const needsReceipt = active.find(d => cart[d.key].status === 'delivered' && !cart[d.key].deliveryConfirmed);
  const needsRating  = active.find(d => cart[d.key].status === 'delivered' && cart[d.key].deliveryConfirmed && cart[d.key].paid && !cart[d.key].rated);

  let attn = null;
  if (!orderConfirmed) {
    attn = { icon: '🍽️', tone: '', title: `${active.length} meals drafted`, sub: `Rs ${total} · not yet verified`, cta: 'Complete Checkout →', action: `go('order')` };
  } else if (owed > 0) {
    const n = unpaidSlots().length;
    attn = { icon: '💳', tone: 'tone-warn', title: `Rs ${owed} outstanding`, sub: `${n} unpaid meal${n !== 1 ? 's' : ''}`, cta: 'Pay Outstanding Balance →', action: 'payFromHome()' };
  } else if (needsReceipt) {
    attn = { icon: '📦', tone: 'tone-warn', title: 'Lunch has arrived!', sub: `Confirm receipt for ${dayOf(needsReceipt.key).label}`, cta: 'Confirm Receipt →', action: `confirmFromHome('${needsReceipt.key}')` };
  } else if (needsRating) {
    attn = { icon: '⭐', tone: '', title: 'How was it?', sub: `Share feedback on your ${dayOf(needsRating.key).label} meal`, cta: 'Rate Meal →', action: `rateFromHome('${needsRating.key}')` };
  }

  const shown = active.slice(0, 6);
  const emojiRow = shown.map(d => {
    const it = cart[d.key];
    const menuKey = MENUS[d.key] ? d.key : baseKeyOf(d.key);
    const c = MENUS[menuKey].find(x => x.id === it.curry);
    return `<span class="status-chip">${c.emoji}</span>`;
  }).join('') + (active.length > shown.length ? `<span class="status-chip mute">+${active.length - shown.length}</span>` : '');

  const tone = attn ? attn.tone : 'tone-ok';
  const icon = attn ? attn.icon : '✅';

  el.innerHTML = `
    <div class="status-card ${tone}">
      <div class="status-top">
        <div class="status-emojis">${emojiRow}</div>
        <button class="linklike" onclick="go('order')">Review Order List ›</button>
      </div>
      <div class="status-body">
        <div class="status-icon">${icon}</div>
        <div>
          <div class="status-title">${attn ? attn.title : 'All scheduled deliveries set'}</div>
          <div class="status-sub">${attn ? attn.sub : `${active.length} meals scheduled · Rs ${total} total · fully paid`}</div>
        </div>
      </div>
      ${attn ? `<button class="btn primary block" onclick="${attn.action}">${attn.cta}</button>` : ''}
    </div>`;
}

window.payFromHome = () => { go('order'); payBalance(); };
window.confirmFromHome = (dk) => { go('order'); openDeliver(dk); };
window.rateFromHome = (dk) => { go('order'); openRate(dk); };

// 20. Menu list renderer
function renderMenu() {
  let html = '';
  BASE_DAYS.forEach(d => {
    const dk = d.key;
    const booked = slotsFor(dk).filter(x => cart[x.key] && cart[x.key].status !== 'cancelled');
    const aoItem = aoCart[dk];

    let mine = booked.map(x => {
      const it = cart[x.key];
      const menuKey = MENUS[x.key] ? x.key : baseKeyOf(x.key);
      const c = MENUS[menuKey].find(y => y.id === it.curry);
      const b = BASES.find(y => y.id === it.base);
      return `
        <div class="mine ${x.additional ? 'extra' : ''}">
          <strong>${c.emoji} ${c.name}</strong> · ${b.name}
          <div style="color:var(--muted);font-size:11.5px">${x.additional ? `Extra meal ${x.seq}` : 'Scheduled'} · Rs ${mealPrice(x.key, it)}</div>
          ${it.note ? `<div class="who">🎁 For: ${esc(it.note)}</div>` : ''}
        </div>`;
    }).join('');

    if (aoItem) {
      const c = MENUS[dk].find(y => y.id === aoItem.curry);
      const b = BASES.find(y => y.id === aoItem.base);
      mine += `
        <div class="mine extra">
          <strong>${c.emoji} ${c.name}</strong> · ${b.name}
          <div style="color:var(--accent-deep);font-size:11.5px;font-weight:700">Pending extra selection · Rs ${mealPrice(dk, aoItem)}</div>
          ${aoItem.note ? `<div class="who">🎁 For: ${esc(aoItem.note)}</div>` : ''}
        </div>`;
    }

    let foot = '';
    if (additionalMode) {
      foot = aoItem
        ? `<button class="btn soft sm" style="flex:1" onclick="editAoMeal('${dk}')">✏️ Edit</button>
           <button class="btn danger sm" style="flex:1" onclick="removeAoMeal('${dk}')">🗑️ Remove</button>`
        : `<button class="btn warn sm block" onclick="pickDayForAdditional('${dk}')">➕ Add Extra Meal</button>`;
    } else if (!orderConfirmed) {
      foot = booked.length
        ? `<button class="btn soft sm" style="flex:1" onclick="openBuild('edit','${booked[0].key}')">✏️ Edit Customisation</button>
           <button class="btn danger sm" style="flex:1" onclick="removeMeal('${booked[0].key}')">🗑️ Remove Meal</button>`
        : `<button class="btn primary sm block" onclick="openBuild('new','${dk}')">+ Customise &amp; Add</button>`;
    } else {
      foot = `<button class="btn outline sm block" onclick="startAdditional('${dk}')">➕ Add Extra Meal to Order</button>`;
    }

    const cheapest = Math.min(...MENUS[dk].map(c => c.price));
    const chosen = booked.length || aoItem;
    const chip = booked.length
      ? `<span class="badge" data-tone="ok">${booked.length} meal${booked.length !== 1 ? 's' : ''}</span>`
      : aoItem ? `<span class="badge" data-tone="warn">Drafted</span>`
      : `<span class="badge" data-tone="mute">From Rs ${cheapest}</span>`;

    html += `
      <div class="card dcard ${openDays[dk] ? 'open' : ''}" id="dcard-${dk}">
        <div class="day-head" onclick="toggleDayCard('${dk}')">
          <div style="flex:1">
            <span class="day-name">${d.label}</span><span class="date-pill">${d.date}</span>
            <div class="day-hint">${chosen ? 'Tap to view your selection details' : `${MENUS[dk].length} curries available today`}</div>
          </div>
          ${chip}
          <div class="chev">▾</div>
        </div>
        ${mine ? `<div style="padding:0 0 4px"></div>${mine}` : ''}
        <div class="day-menu">
          ${MENUS[dk].map(c => `
            <button class="opt-row" onclick="chooseCurry('${dk}','${c.id}')">
              <span class="oe-thumb"><img src="${c.photo}" alt="${c.name}"></span>
              <span class="on"><strong>${c.emoji} ${c.name}</strong><small>${c.desc}</small></span>
              <span class="op">Rs ${c.price}</span><span class="go">›</span>
            </button>`).join('')}
          <div class="day-foot">${foot}</div>
        </div>
      </div>`;
  });

  if (week2Sent) {
    html += `
      <div class="section-title">Following Week Preview</div>
      <div class="card">
        <div class="day-head">
          <div style="flex:1">
            <span class="day-name">${WEEK2.range}</span><span class="date-pill">${WEEK2.label}</span>
          </div>
          <span class="badge" data-tone="warn">Opens Sunday</span>
        </div>
        ${WEEK2.days.map(r => `
          <div class="opt-row">
            <span class="on"><strong>${r[0]}</strong><small>${r.slice(1).join(' · ')}</small></span>
          </div>`).join('')}
        <div style="padding:12px;text-align:center;color:var(--muted);font-size:11.5px;background:var(--bg-elev);border-top:1px solid var(--line-soft)">
          🔒 Next week ordering starts Sunday noon.
        </div>
      </div>`;
  }

  document.getElementById('day-cards').innerHTML = html;
  document.getElementById('extra-banner').style.display = additionalMode ? '' : 'none';
  document.getElementById('menu-title').textContent = additionalMode ? 'Add Extra Meals' : "This week's menu";
  
  if (additionalMode) {
    const n = Object.keys(aoCart).length;
    document.getElementById('extra-banner-sub').textContent = n
      ? `${n} meal${n !== 1 ? 's' : ''} pending confirmation`
      : 'Select a day below to build an extra meal.';
  }
  syncBars();
}

window.toggleDayCard = (dk) => {
  openDays[dk] = !openDays[dk];
  renderMenu();
};

function chooseCurry(dk, cid) {
  presetCurry = cid;
  const booked = slotsFor(dk).filter(x => cart[x.key] && cart[x.key].status !== 'cancelled');
  if (additionalMode) {
    pickDayForAdditional(dk);
    return;
  }
  if (!orderConfirmed) {
    if (booked.length) openBuild('edit', booked[0].key);
    else openBuild('new', dk);
    return;
  }
  startAdditional(dk);
}

window.removeMeal = (dk) => {
  delete cart[dk];
  toast('Meal removed from order');
  renderMenu();
  renderOrder();
  renderHome();
};

// 21. Order List view renderer (Timeline & Logs)
function renderOrder() {
  const slots = DAYS.filter(d => cart[d.key]);
  const active = activeSlots();
  const el = document.getElementById('order-body');

  if (!slots.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="ee">🍱</div>
        <h3>No meals selected yet</h3>
        <p>Pick items from the menu to populate your weekly lunch schedule.</p>
        <button class="btn primary" onclick="openMenuPage()">Browse Menu Options</button>
      </div>`;
    syncBars();
    return;
  }

  const owed = balanceDue();
  const total = orderTotal();
  const paidCount = active.length - unpaidSlots().length;
  const allDone = active.length > 0 && active.every(d => ['delivered', 'cancelled'].includes(cart[d.key].status));
  const badge = !orderConfirmed ? ['Draft', 'mute'] : allDone ? ['Completed', 'ok'] : ['Active', 'ok'];

  let html = `
    <div class="card card-pad" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800;color:var(--primary)">My Weekly Schedule</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:2px">${
          !orderConfirmed ? `${active.length} meals drafted · click checkout to lock`
          : `${active.length} meals confirmed · ${owed > 0 ? `Rs ${owed} due` : 'Fully Paid'}`}</div>
      </div>
      <span class="badge" data-tone="${badge[1]}">${badge[0]}</span>
    </div>`;

  html += `<div class="card" style="padding:0">`;
  slots.forEach(d => {
    const dk = d.key, it = cart[dk];
    const menuKey = MENUS[dk] ? dk : baseKeyOf(dk);
    const c = MENUS[menuKey].find(x => x.id === it.curry);
    const b = BASES.find(x => x.id === it.base);
    const dhal = it.dhal && it.dhal !== 'none' ? DHALS.find(x => x.id === it.dhal) : null;
    const salad = it.salad && it.salad !== 'none' ? SALADS.find(x => x.id === it.salad) : null;
    const bev = it.beverage && it.beverage !== 'none' ? BEVERAGES.find(x => x.id === it.beverage) : null;
    const des = it.dessert && it.dessert !== 'none' ? DESSERTS.find(x => x.id === it.dessert) : null;
    const price = mealPrice(dk, it);
    const st = ST[it.status || 'confirmed'];
    const cancelled = it.status === 'cancelled';

    let pill = '';
    if (!cancelled) {
      if (it.paid) pill = `<span class="badge outline" data-tone="ok">✅ PAID</span>`;
      else if (isDoorMethod(it.payMethod)) pill = `<span class="badge" data-tone="mute">${PAY_METHODS[it.payMethod].icon} AT DOOR</span>`;
      else pill = `<span class="badge outline" data-tone="warn">💰 NOT PAID</span>`;
    }

    const steps = [['confirmed', '✅', 'Confirm'], ['preparing', '👨‍🍳', 'Prep'], ['delivering', '🛵', 'Transit'], ['delivered', '📦', 'Arrived']];
    const ci = steps.findIndex(s => s[0] === it.status);
    let track = `<div class="track">`;
    steps.forEach((s, idx) => {
      const done = ci > idx, now = ci === idx;
      track += `<div class="tstep ${done ? 'done' : now ? 'now' : ''}"><div class="tdot">${done ? '✓' : s[1]}</div><span>${s[2]}</span></div>`;
      if (idx < steps.length - 1) track += `<div class="tline ${done ? 'done' : ''}"></div>`;
    });
    track += `</div>`;

    // Timeline Log rendering
    let logsHtml = '';
    if (it.logs && it.logs.length) {
      logsHtml = `
        <div class="logistics-timeline">
          <div class="logistics-title">Logistics logs</div>
          ${it.driverComment ? `<div class="driver-commentary-bubble"><div class="driver-commentary-text">🛵 Rundhir: "${esc(it.driverComment)}"</div></div>` : ''}
          ${it.logs.map(l => `
            <div class="log-entry">
              <span class="log-time">${l.time}</span>
              <span class="log-text">${esc(l.text)}</span>
            </div>
          `).join('')}
        </div>`;
    }

    let acts = '';
    if (cancelled) {
      acts = `<div style="color:var(--danger);font-size:12.5px;margin-top:8px;font-weight:700">❌ Cancelled · Store credit returned.</div>`;
    } else if (it.status === 'delivered') {
      acts = it.deliveryConfirmed
        ? `<div style="color:var(--primary);font-size:13px;margin-top:8px;font-weight:700">✓ Received &amp; confirmed.</div>
           <div class="actions">
             <button class="btn soft" onclick="openReceipt('${dk}')">🧾 Receipt</button>
             ${it.rated ? `<span style="font-size:12px;color:var(--muted);padding:8px">Rating: ${it.stars}★</span>` : `<button class="btn soft" onclick="openRate('${dk}')">⭐ Rate Meal</button>`}
           </div>`
        : `<div class="actions"><button class="btn primary" onclick="openDeliver('${dk}')">📦 Confirm Receipt</button></div>`;
    } else if (it.status === 'delivering') {
      acts = `<div style="color:var(--info);font-size:12.5px;margin-top:8px;font-weight:700">🛵 Meal is currently with the courier.</div>`;
    } else if (it.status === 'preparing') {
      acts = `<div style="color:var(--accent-deep);font-size:12.5px;margin-top:8px;font-weight:700">👨‍🍳 Cooking in the kitchen.</div>`;
    } else if (it.cutoffPassed) {
      acts = `<div style="color:var(--muted);font-size:12px;margin-top:8px">🔒 Preparation locked. Changes disabled.</div>`;
    } else {
      acts = `
        <div class="actions">
          <button class="btn soft" onclick="openBuild('edit','${dk}')">✏️ Edit Meal</button>
          <button class="btn danger" onclick="openCancel('${dk}')">✕ Cancel Meal</button>
        </div>`;
    }

    const payAct = (!cancelled && !it.paid)
      ? `<div class="actions"><button class="btn ${isDoorMethod(it.payMethod) ? 'outline' : 'primary'}" onclick="openMealPay('${dk}')">
          ${isDoorMethod(it.payMethod) ? '🔄 Settle / Change Payment' : `💰 Settle Rs ${price} Now`}
         </button></div>`
      : '';

    html += `
      <div class="meal ${it.expanded ? 'open' : ''} ${d.additional ? 'extra' : ''}" id="meal-${dk}">
        <div class="meal-head" onclick="toggleMeal('${dk}')">
          <div class="meal-emoji">${cancelled ? '❌' : c.emoji}</div>
          <div class="meal-info">
            <div class="meal-title">
              ${d.label}${d.additional ? `<span class="tag-extra">EXTRA ${d.seq}</span>` : ''}
              <span class="date-pill" style="margin-left: 6px">${d.date}</span>
            </div>
            <div class="meal-desc">${cancelled ? 'Cancelled order' : `${c.name} · ${b.name}`}</div>
            ${it.note ? `<div class="meal-who">🎁 For: ${esc(it.note)}</div>` : ''}
          </div>
          <div class="meal-right">
            ${cancelled ? '' : `<div class="meal-price">Rs ${price}</div>`}
            <div style="display:flex;gap:4px;margin-top:4px">${pill}<span class="badge" data-tone="${st.tone}">${st.label}</span></div>
          </div>
          <div class="chev">▾</div>
        </div>
        
        <div class="meal-body">
          ${cancelled ? '' : `
            ${track}
            ${logsHtml}
            <div class="drow"><span class="dl">Selected Curry</span><span class="dv">${c.emoji} ${c.name} (Rs ${c.price})</span></div>
            <div class="drow"><span class="dl">Base Base</span><span class="dv">${b.emoji} ${b.name} (${b.up ? `+Rs ${b.up}` : 'Included'})</span></div>
            <div class="drow"><span class="dl">Lentil Dhal</span><span class="dv">${dhal ? `${dhal.emoji} ${dhal.name}` : 'None'}</span></div>
            <div class="drow"><span class="dl">Garden Salad</span><span class="dv">${salad ? `${salad.emoji} ${salad.name}` : 'None'}</span></div>
            ${bev ? `<div class="drow"><span class="dl">Beverage Extra</span><span class="dv">${bev.emoji} ${bev.name} (+Rs ${bev.price})</span></div>` : ''}
            ${des ? `<div class="drow"><span class="dl">Dessert Extra</span><span class="dv">${des.emoji} ${des.name} (+Rs ${des.price})</span></div>` : ''}
            ${it.note ? `<div class="drow"><span class="dl">Handover Label</span><span class="dv" style="color:var(--accent-deep)">🎁 ${esc(it.note)}</span></div>` : ''}
            <div class="drow"><span class="dl">Total Price</span><span class="dv" style="color:var(--primary);font-weight:800">Rs ${price}</span></div>
          `}
          ${acts}
          ${payAct}
        </div>
      </div>`;
  });
  html += `</div>`;

  if (orderConfirmed) {
    html += `
      <button class="btn warn block" style="margin-top:12px" onclick="openMenuPage()">➕ Add Another Extra Meal</button>`;
  } else {
    html += `
      <button class="btn outline block" style="margin-top:12px" onclick="openMenuPage()">🍛 Schedue Another Day</button>`;
  }

  el.innerHTML = html;
  syncBars();
}

window.toggleMeal = (dk) => {
  if (cart[dk]) {
    cart[dk].expanded = !cart[dk].expanded;
    renderOrder();
  }
};

// 22. Interactive state bar syncer
function syncBars() {
  const active = activeSlots();
  const owed = balanceDue(), total = orderTotal();
  const paidCount = active.length - unpaidSlots().length;

  const tb = document.getElementById('order-badge');
  if (active.length) {
    tb.style.display = '';
    tb.textContent = active.length;
    tb.classList.toggle('warn', orderConfirmed && owed > 0);
  } else {
    tb.style.display = 'none';
  }

  const pb = document.getElementById('paybar');
  const showPay = currentPage === 'order' && active.length > 0;
  const menuOpen = document.getElementById('pg-menu').classList.contains('on');
  
  pb.style.display = showPay ? '' : 'none';
  
  if (showPay) {
    const lbl = document.getElementById('paybar-lbl');
    const amt = document.getElementById('paybar-amt');
    const note = document.getElementById('paybar-note');
    const btn = document.getElementById('paybar-btn');
    
    if (!orderConfirmed) {
      lbl.textContent = 'Subtotal';
      amt.textContent = `Rs ${total}`;
      note.style.display = 'none';
      btn.textContent = 'Checkout Schedule →';
      btn.className = 'btn primary';
    } else if (owed > 0) {
      lbl.textContent = paidCount > 0 ? 'Balance Due' : 'Outstanding';
      amt.textContent = `Rs ${owed}`;
      note.style.display = '';
      note.textContent = `${unpaidSlots().length} meal${unpaidSlots().length !== 1 ? 's' : ''} unpaid`;
      btn.textContent = 'Pay Balance';
      btn.className = 'btn primary';
    } else {
      lbl.textContent = 'Schedule Total';
      amt.textContent = `Rs ${total}`;
      note.style.display = '';
      note.textContent = 'Paid in Full ✅';
      btn.textContent = 'Locked & Paid';
      btn.className = 'btn soft';
    }
  }

  // Extra meal selection tray
  const tray = document.getElementById('ao-tray');
  const keys = Object.keys(aoCart);
  const showTray = menuOpen && additionalMode && keys.length > 0;
  tray.style.display = showTray ? '' : 'none';
  if (showTray) {
    const t = keys.reduce((s, k) => s + mealPrice(k, aoCart[k]), 0);
    document.getElementById('ao-tray-lbl').textContent = `${keys.length} extra meal${keys.length !== 1 ? 's' : ''} pending`;
    document.getElementById('ao-tray-amt').textContent = `Rs ${t}`;
  }

  // Browse back control bar
  const mTray = document.getElementById('menu-tray');
  const showMenuTray = menuOpen && !additionalMode;
  mTray.style.display = showMenuTray ? '' : 'none';
  if (showMenuTray) {
    const lbl = document.getElementById('menu-tray-lbl');
    const amt = document.getElementById('menu-tray-amt');
    const btn = document.getElementById('menu-tray-btn');
    
    if (orderConfirmed) {
      lbl.textContent = 'Tap day curry to add additional meals';
      amt.textContent = '';
      btn.textContent = 'View My Order →';
    } else if (active.length) {
      lbl.textContent = `${active.length} meals selected`;
      amt.textContent = `Rs ${total}`;
      btn.textContent = 'Continue to Schedule →';
    } else {
      lbl.textContent = 'Choose days to configure meals';
      amt.textContent = '';
      btn.textContent = 'View My Order →';
    }
  }

  document.getElementById('bar-sub').textContent = orderConfirmed && owed > 0
    ? `Rs ${owed} outstanding balance` : 'Mauritian home-made meal delivery';
}

function activeSlots() { return DAYS.filter(d => cart[d.key] && cart[d.key].status !== 'cancelled'); }
function unpaidSlots() { return activeSlots().filter(d => !cart[d.key].paid); }
function balanceDue()   { return unpaidSlots().reduce((t, d) => t + mealPrice(d.key, cart[d.key]), 0); }
function orderTotal()   { return activeSlots().reduce((t, d) => t + mealPrice(d.key, cart[d.key]), 0); }
function refGroup(ref)  { return ref ? activeSlots().filter(d => cart[d.key].payRef === ref) : []; }

function finishMenuBrowsing() {
  closeMenuPage();
  go('order');
}

function paybarAction() {
  if (!orderConfirmed) return checkout();
  if (balanceDue() > 0) return payBalance();
}

// 23. App reset
function resetApp() {
  Object.values(simTimers).forEach(clearTimeout);
  simTimers = {};
  cart = {};
  DAYS = BASE_DAYS.map(d => ({ ...d }));
  
  Object.keys(MENUS).forEach(k => {
    if (k.includes('_')) delete MENUS[k];
  });
  
  orderConfirmed = false;
  storeCredit = 0;
  week2Sent = false;
  aoCart = {};
  additionalMode = false;
  notifications = [];
  unreadNotifs = 0;
  openDays = {};
  presetCurry = null;
  scratchCardDrawn = false;
  
  document.getElementById('notif-badge').style.display = 'none';
  document.getElementById('pro-credit').textContent = 'Rs 0';
  document.getElementById('pro-points').textContent = '85';
  document.getElementById('loyalty-bar').style.width = '85%';
  document.getElementById('loyalty-hint').textContent = '🎁 15 points left to claim Gold rewards!';
  document.getElementById('pro-badge').textContent = '🥈 Silver Tier';
  document.getElementById('scratch-win-btn').style.display = 'none';
  
  closeSheet();
  document.getElementById('pg-menu').classList.remove('on');
  document.getElementById('pg-build').classList.remove('on');
  
  renderNotifs();
  renderMenu();
  renderOrder();
  renderHome();
  go('home');
  toast('Application state reset');
}

// 24. PWA installer plumbing
const APP_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="#123F24"/><text x="256" y="345" font-size="256" text-anchor="middle">🍛</text></svg>`);

function setupPWA() {
  const swRow = document.getElementById('pwa-sw-row');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => { 
        swRow.textContent = 'Active ✅'; 
        swRow.style.color = 'var(--primary)'; 
      })
      .catch(() => { 
        swRow.textContent = 'Register failed'; 
      });
  } else {
    swRow.textContent = location.protocol.startsWith('http') ? 'Unsupported' : 'Local folder';
  }
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  document.getElementById('install-btn').style.display = '';
  const row = document.getElementById('pwa-install-row');
  row.innerHTML = `<button class="btn primary sm" onclick="doInstall()">Add to Home Screen</button>`;
});

function doInstall() {
  if (!installPrompt) {
    toast('Access this PWA over HTTPS to install it on your device');
    return;
  }
  installPrompt.prompt();
  installPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      toast('Installing BonManzE...');
      document.getElementById('install-btn').style.display = 'none';
    }
  });
}

if (window.matchMedia('(display-mode: standalone)').matches) {
  document.getElementById('pwa-install-row').textContent = 'Installed';
}

// 25. Boot Binding
window.addEventListener('load', () => {
  // Bind stars
  document.getElementById('star-row').addEventListener('click', e => {
    const s = e.target.closest('.star');
    if (s) selectStar(Number(s.dataset.v));
  });
  
  document.getElementById('rate-btn').addEventListener('click', submitRating);
  
  // Bind home CTA to trigger menu
  document.getElementById('home-cta').addEventListener('click', () => {
    if (!activeSlots().length) openMenuPage();
  });
  
  applyTheme('light');
  setupPWA();
  renderNotifs();
  renderMenu();
  renderOrder();
  renderHome();
  go('home');
});

// Map window variables for HTML onclick attributes
window.go = go;
window.openMenuPage = openMenuPage;
window.closeMenuPage = closeMenuPage;
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.toggleTheme = toggleTheme;
window.toggleAudio = toggleAudio;
window.openBuild = openBuild;
window.closeBuild = closeBuild;
window.jumpToWizardStep = jumpToWizardStep;
window.wizardNext = wizardNext;
window.wizardPrev = wizardPrev;
window.selectCurryItem = selectCurryItem;
window.selectBaseItem = selectBaseItem;
window.selectSidesExtra = selectSidesExtra;
window.updatePendingNote = updatePendingNote;
window.startAdditional = startAdditional;
window.pickDayForAdditional = pickDayForAdditional;
window.chooseAdditionalMode = chooseAdditionalMode;
window.editAoMeal = editAoMeal;
window.removeAoMeal = removeAoMeal;
window.cancelAdditionalOrder = cancelAdditionalOrder;
window.discardAdditionalOrder = discardAdditionalOrder;
window.commitAdditionalToOrder = commitAdditionalToOrder;
window.paybarAction = paybarAction;
window.payBalance = payBalance;
window.openMealPay = openMealPay;
window.pickMethod = pickMethod;
window.payBackToMethods = payBackToMethods;
window.cancelPayNow = cancelPayNow;
window.commitPayment = commitPayment;
window.openCancel = openCancel;
window.runSimulation = runSimulation;
window.runNextWeek = runNextWeek;
window.resetApp = resetApp;
window.openScratchCard = openScratchCard;
window.claimScratchReward = claimScratchReward;
window.copyReferralCode = copyReferralCode;
window.openDeliver = openDeliver;
window.openRate = openRate;
window.openReceipt = openReceipt;
window.doInstall = doInstall;
