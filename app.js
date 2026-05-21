'use strict';

// ── DATA ──────────────────────────────────────────────────────────────
let DATA = null;
let currentMonthId = null;
let currentView = 'doctors'; // 'doctors' | 'sectors'

const SECTOR_DEFS = [
  { code: 'VIS', label: 'Bloc viscéral' },
  { code: 'ORT', label: 'Bloc orthopédique' },
  { code: 'DVI', label: 'Pose DVI' },
  { code: 'ORL', label: 'Bloc ORL / Ophtalmo' },
  { code: 'END', label: 'Endoscopies' },
  { code: 'CI',  label: 'Cardiologie interventionnelle' },
  { code: 'RI',  label: 'Radiologie interventionnelle' },
  { code: 'REA', label: 'Réanimation' },
  { code: 'CS',  label: 'Consultation' },
  { code: 'MAT', label: 'Maternité' },
];

const STATUS_CODES = ['G','RG','18','A','CP','F','R','I','E'];

const CODE_LABELS = {
  G: 'Garde 24h', RG: 'Repos de garde', '18': 'Journée 8h–18h',
  A: 'Absence', CP: 'Congés payés', F: 'Formation', R: 'Récup samedi',
  I: 'Indisponible', E: 'Formation ext.',
  VIS:'Bloc viscéral', ORT:'Bloc orthopédique', DVI:'Pose DVI',
  ORL:'ORL / Ophtalmo', END:'Endoscopies', CI:'Cardio interventionnelle',
  RI:'Radio interventionnelle', REA:'Réanimation', CS:'Consultation', MAT:'Maternité',
};

const KPI_DEFS = [
  ['Présents', null],
  ['Gardes G', 'G'],
  ['Repos RG', 'RG'],
  ['Journées 18h', '18'],
  ['Absences A', 'A'],
  ['Congés CP', 'CP'],
  ['Formations F', 'F'],
];

// ── UTILS ──────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/[&<>'"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function normalizeCode(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/\s+/g,'');
  if (s === '18H' || s === 'H18') return '18';
  if (s === 'E' || s === 'E*') return 'F'; // treat E as Formation
  return s;
}

function chipClass(code) {
  const c = normalizeCode(code);
  return 'chip chip-' + (c === '18' ? '18' : c.replace(/[^A-Z0-9]/g,''));
}

function isUnavailable(rawCell) {
  const c = normalizeCode(rawCell);
  return ['G','RG','18','A','CP','F','R','I','E'].includes(c);
}

function isWeekend(wd) { return wd === 'S' || wd === 'D'; }

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── INIT ──────────────────────────────────────────────────────────────
async function init() {
  try {
    DATA = await fetch('./planning.json').then(r => r.json());
  } catch(e) {
    document.body.innerHTML = `<div style="padding:40px;color:#b91c1c;font-family:sans-serif">
      <h2>Erreur de chargement</h2>
      <p>Impossible de charger planning.json. Assurez-vous d'utiliser un serveur HTTP (pas file://).</p>
      <pre>${esc(e.message)}</pre>
    </div>`;
    return;
  }

  // Default to current month
  const now = new Date();
  const found = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth()+1);
  currentMonthId = found ? found.id : DATA.months[0].id;

  buildMonthTabs();
  buildLegend();
  bindEvents();
  render();
}

// ── BIND ──────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('btnToday').addEventListener('click', () => {
    const now = new Date();
    const found = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth()+1);
    if (found) { currentMonthId = found.id; buildMonthTabs(); render(); }
  });
  document.getElementById('btnDoctors').onclick = () => setView('doctors');
  document.getElementById('btnSectors').onclick  = () => setView('sectors');
}

function setView(v) {
  currentView = v;
  document.getElementById('btnDoctors').classList.toggle('active', v === 'doctors');
  document.getElementById('btnSectors').classList.toggle('active', v === 'sectors');
  document.getElementById('searchInput').placeholder =
    v === 'doctors' ? 'Rechercher un médecin…' : 'Filtrer un médecin…';
  render();
}

// ── TABS ──────────────────────────────────────────────────────────────
function buildMonthTabs() {
  const el = document.getElementById('monthTabs');
  el.innerHTML = '';
  DATA.months.forEach(m => {
    const b = document.createElement('button');
    b.textContent = m.label.replace(' 2026','').replace(' 2027','');
    b.className = m.id === currentMonthId ? 'active' : '';
    b.onclick = () => { currentMonthId = m.id; buildMonthTabs(); render(); };
    el.appendChild(b);
  });
}

// ── LEGEND ──────────────────────────────────────────────────────────────
function buildLegend() {
  const el = document.getElementById('legend');
  const codes = ['G','RG','18','A','CP','F','R','REA','VIS','ORT','ORL','DVI','END','CI','RI','CS','MAT'];
  el.innerHTML = codes.map(c =>
    `<span class="${chipClass(c)}" title="${esc(CODE_LABELS[c]||c)}">${esc(c)}</span>`
  ).join('');
}

// ── RENDER ──────────────────────────────────────────────────────────────
function render() {
  const month = DATA.months.find(m => m.id === currentMonthId);
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const doctors = q
    ? month.doctors.filter(d => d.name.toLowerCase().includes(q))
    : month.doctors;

  // Header badge
  document.getElementById('headerBadge').textContent = month.label;

  // KPIs
  renderKpis(month, doctors);

  // Panel
  document.getElementById('panelTitle').textContent =
    (currentView === 'doctors' ? 'Vue médecins — ' : 'Vue secteurs — ') + month.label;

  if (currentView === 'doctors') renderDoctorTable(month, doctors);
  else renderSectorTable(month, doctors);
}

// ── KPIs ──────────────────────────────────────────────────────────────
function countCode(doctors, code) {
  let n = 0;
  doctors.forEach(d => d.cells.forEach(c => { if (normalizeCode(c) === code) n++; }));
  return n;
}

function renderKpis(month, doctors) {
  const el = document.getElementById('kpis');
  // Count present per day (not unavailable)
  const today = todayDateStr();
  const todayIdx = month.days.findIndex(d => d.date === today);
  const presentToday = todayIdx >= 0
    ? doctors.filter(d => !isUnavailable(d.cells[todayIdx])).length
    : null;

  const items = [
    { label: 'Médecins', value: doctors.length, accent: true },
    { label: "Présents aujourd'hui", value: presentToday !== null ? presentToday : '—' },
    { label: 'Gardes G', value: countCode(doctors, 'G') },
    { label: 'Repos RG', value: countCode(doctors, 'RG') },
    { label: 'Journées 18h', value: countCode(doctors, '18') },
    { label: 'Absences A', value: countCode(doctors, 'A') },
    { label: 'Congés CP', value: countCode(doctors, 'CP') },
    { label: 'Formations F', value: countCode(doctors, 'F') },
  ];

  el.innerHTML = items.map(item => `
    <div class="kpi">
      <div class="kpi-label">${esc(item.label)}</div>
      <div class="kpi-value${item.accent ? ' accent' : ''}">${item.value}</div>
    </div>
  `).join('');
}

// ── DOCTOR TABLE ──────────────────────────────────────────────────────
function renderDoctorTable(month, doctors) {
  const today = todayDateStr();
  const table = document.getElementById('planningTable');

  // HEAD
  let html = '<thead><tr>';
  html += `<th class="col-doctor">Médecin</th>`;
  month.days.forEach(d => {
    const wkClass = isWeekend(d.weekday) ? ' weekend' : '';
    const todayClass = d.date === today ? ' today-col' : '';
    html += `<th class="col-day${wkClass}${todayClass}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  // ROWS
  doctors.forEach(doc => {
    html += `<tr><td class="col-doctor">${esc(doc.name.replace('DR ','').replace('PR ','PR '))}</td>`;
    month.days.forEach((d, i) => {
      const raw = String(doc.cells[i] || '').trim();
      const wkClass = isWeekend(d.weekday) ? ' weekend' : '';
      const todayClass = d.date === today ? ' today-col' : '';
      html += `<td class="${wkClass}${todayClass}">`;
      if (raw) {
        const code = normalizeCode(raw);
        html += `<div class="cell-content"><span class="${chipClass(raw)}" title="${esc(CODE_LABELS[code]||raw)}">${esc(raw)}</span></div>`;
      } else {
        html += `<div class="cell-content"><span class="empty">·</span></div>`;
      }
      html += '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

// ── SECTOR TABLE ──────────────────────────────────────────────────────
function renderSectorTable(month, doctors) {
  const today = todayDateStr();
  const table = document.getElementById('planningTable');

  // Build sector → day → [doctor names] from explicit cells
  const sectorMap = {};
  SECTOR_DEFS.forEach(s => {
    sectorMap[s.code] = month.days.map(() => []);
  });

  doctors.forEach(doc => {
    doc.cells.forEach((raw, dayIdx) => {
      const code = normalizeCode(raw);
      if (sectorMap[code]) {
        sectorMap[code][dayIdx].push(doc.name.replace('DR ','').replace('PR ','PR '));
      }
    });
  });

  // Only show sectors that have at least one assignment
  const activeSectors = SECTOR_DEFS.filter(s => sectorMap[s.code].some(d => d.length > 0));

  // HEAD
  let html = '<thead><tr>';
  html += `<th class="col-sector">Secteur / Poste</th>`;
  month.days.forEach(d => {
    const wkClass = isWeekend(d.weekday) ? ' weekend' : '';
    const todayClass = d.date === today ? ' today-col' : '';
    html += `<th class="col-day${wkClass}${todayClass}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  activeSectors.forEach(s => {
    html += `<tr><td class="col-sector"><span class="${chipClass(s.code)}">${esc(s.code)}</span> ${esc(s.label)}</td>`;
    month.days.forEach((d, i) => {
      const names = sectorMap[s.code][i];
      const wkClass = isWeekend(d.weekday) ? ' weekend' : '';
      const todayClass = d.date === today ? ' today-col' : '';
      html += `<td class="sector-cell${wkClass}${todayClass}">`;
      if (names.length) {
        html += names.map(n => `<span class="person-tag">${esc(n)}</span>`).join('');
      } else {
        html += `<span class="empty">·</span>`;
      }
      html += '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

// ── START ──────────────────────────────────────────────────────────────
init();
