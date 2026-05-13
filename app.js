let DATA = null;
let currentMonth = null;
let currentView = 'doctors';

const sectorDefs = [
  { code: 'REA', label: 'Réanimation' },
  { code: 'VIS', label: 'Bloc viscéral' },
  { code: 'ORT', label: 'Bloc ortho' },
  { code: 'ORL', label: 'ORL / Ophtalmo' },
  { code: 'MAT', label: 'Maternité' },
  { code: 'CS', label: 'Consultation' },
  { code: 'RI', label: 'Radio inter' },
  { code: 'CI', label: 'Cardio inter' },
  { code: 'END', label: 'Endoscopie' },
  { code: 'G', label: 'Gardes 24h' },
  { code: '18', label: '18H — 8h–18h' },
  { code: 'RG', label: 'Repos de garde' },
  { code: 'CP', label: 'Congés' },
  { code: 'F', label: 'Formation' },
  { code: 'A', label: 'Absence' },
];

const codeLabels = Object.fromEntries(sectorDefs.map(s => [s.code, s.label]));
const kpiDefs = [
  ['G', 'Gardes 24h'], ['18', 'Journées 18h'], ['RG', 'Repos garde'], ['A', 'Absences A'], ['CP', 'Congés'], ['F', 'Formations']
];

function norm(v){ return String(v || '').trim(); }
function clean(v){ return norm(v).toUpperCase().replace(/\s+/g, ' '); }
function canonicalCode(v){
  const x = clean(v).replace('18H', '18');
  for(const s of sectorDefs){ if(s.aliases.map(a => clean(a).replace('18H','18')).includes(x)) return s.code; }
  return x;
}
function codeClass(c){ const x = canonicalCode(c); return x === '18' ? 'H18' : x.replace(/[^a-zA-Z0-9]/g, ''); }
function isWeekend(w){ return w === 'S' || w === 'D'; }
function escapeHtml(str){ return norm(str).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }

async function init(){
  DATA = await fetch('./planning.json').then(r => r.json());
  currentMonth = DATA.months[0].id;
  const now = new Date();
  const found = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth() + 1);
  if(found) currentMonth = found.id;
  buildTabs(); buildLegend(); bind(); render();
}

function bind(){
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('todayBtn').addEventListener('click', () => {
    const now = new Date();
    const f = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth() + 1);
    if(f){ currentMonth = f.id; buildTabs(); render(); }
  });
  document.getElementById('doctorViewBtn').onclick = () => setView('doctors');
  document.getElementById('sectorViewBtn').onclick = () => setView('sectors');
}

function setView(view){
  currentView = view;
  document.getElementById('doctorViewBtn').classList.toggle('active', view === 'doctors');
  document.getElementById('sectorViewBtn').classList.toggle('active', view === 'sectors');
  const search = document.getElementById('searchInput');
  search.placeholder = view === 'doctors' ? 'Rechercher un médecin…' : 'Filtrer un médecin dans les secteurs…';
  render();
}

function buildTabs(){
  const el = document.getElementById('monthTabs'); el.innerHTML = '';
  DATA.months.forEach(m => {
    const b = document.createElement('button');
    b.textContent = m.label.replace(' 2026', '');
    b.className = m.id === currentMonth ? 'active' : '';
    b.onclick = () => { currentMonth = m.id; buildTabs(); render(); };
    el.appendChild(b);
  });
}

function buildLegend(){
  const el = document.getElementById('legend'); el.innerHTML = '';
  ['G','18','RG','A','CP','F','R','I','REA','VIS','ORT','ORL','MAT','CS','RI','CI','END'].forEach(c => {
    const s = document.createElement('span');
    s.className = 'chip ' + codeClass(c);
    s.textContent = c;
    s.title = codeLabels[c] || c;
    el.appendChild(s);
  });
}

function filteredDoctors(m){
  const q = norm(document.getElementById('searchInput').value).toLowerCase();
  if(!q) return m.doctors;
  return m.doctors.filter(d => d.name.toLowerCase().includes(q));
}

function render(){
  const m = DATA.months.find(x => x.id === currentMonth);
  const doctors = filteredDoctors(m);
  document.getElementById('monthLabel').textContent = m.label;
  document.getElementById('doctorCount').textContent = currentView === 'doctors' ? doctors.length : activeSectorCount(m, doctors);
  document.getElementById('viewLabel').textContent = currentView === 'doctors' ? 'médecins affichés' : 'secteurs utilisés';
  document.getElementById('tableTitle').textContent = currentView === 'doctors' ? 'Vue médecins — ' + m.label : 'Vue secteurs — ' + m.label;
  document.getElementById('tableHint').textContent = currentView === 'doctors'
    ? 'Chaque ligne correspond à un médecin. Utilise la vue secteurs pour voir qui est affecté à chaque poste.'
    : 'Chaque ligne correspond à un secteur/poste. Dans ton fichier actuel, seuls les codes présents peuvent être reconstruits automatiquement.';
  renderKpis(m, doctors);
  currentView === 'doctors' ? renderDoctorTable(m, doctors) : renderSectorTable(m, doctors);
}

function countCode(doctors, codes){
  let n = 0;
  const wanted = codes.map(canonicalCode);
  doctors.forEach(d => d.cells.forEach(v => { if(wanted.includes(canonicalCode(v))) n++; }));
  return n;
}

function renderKpis(m, doctors){
  const el = document.getElementById('kpis'); el.innerHTML = '';
  const vals = [['Médecins', doctors.length], ...kpiDefs.map(([code, label]) => [label, countCode(doctors, [code])])];
  vals.forEach(([label, val]) => {
    const div = document.createElement('div'); div.className = 'kpi';
    div.innerHTML = `<small>${escapeHtml(label)}</small><strong>${val}</strong>`;
    el.appendChild(div);
  });
}

function renderDoctorTable(m, doctors){
  const table = document.getElementById('planningTable');
  let html = '<thead><tr><th class="doctor">Médecin</th>';
  m.days.forEach(d => { html += `<th class="day ${isWeekend(d.weekday)?'weekend-head':''}"><div>${d.day}</div><small>${d.weekday}</small></th>`; });
  html += '</tr></thead><tbody>';
  doctors.forEach(doc => {
    html += `<tr><th class="doctor">${escapeHtml(doc.name)}</th>`;
    m.days.forEach((d, i) => {
      const val = norm(doc.cells[i]); const wk = isWeekend(d.weekday) ? ' weekend' : '';
      html += `<td class="cell${wk}">${val ? `<span class="chip ${codeClass(val)}" title="${escapeHtml(codeLabels[canonicalCode(val)] || val)}">${escapeHtml(val)}</span>` : '<span class="empty">·</span>'}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>'; table.innerHTML = html;
}
function isUnavailable(code){
  const x = canonicalCode(code);
  return ['G','18','RG','CP','F','A','R','I'].includes(x);
}

function shuffle(arr){
  return [...arr].sort(() => Math.random() - 0.5);
}

function autoAssignments(m, doctors){

  const map = {};

  m.days.forEach((day, dayIndex) => {

    const weekday = day.weekday;

    const rules = isWeekend(weekday)
      ? {
          REA: 2,
          MAT: 1
        }
      : {
          REA: 3,
          VIS: 3,
          ORT: 2,
          ORL: 1,
          MAT: 1,
          CS: 1,
          RI: 1,
          CI: 1,
          END: 1
        };

    const available = shuffle(
      doctors.filter(doc => {
        const val = norm(doc.cells[dayIndex]);
        return !isUnavailable(val);
      })
    );

    map[dayIndex] = {};

    Object.entries(rules).forEach(([sector, count]) => {

      map[dayIndex][sector] = [];

      for(let i = 0; i < count; i++){

        const picked = available.shift();

        if(picked){
          map[dayIndex][sector].push({
            name: picked.name,
            raw: sector
          });
        }
      }
    });

  });

  return map;
}

function buildSectorMatrix(m, doctors){
  const matrix = new Map(sectorDefs.map(s => [s.code, { ...s, days: m.days.map(() => []) }]));
  const unknowns = new Map();
  doctors.forEach(doc => {
    doc.cells.forEach((v, i) => {
      const raw = norm(v); if(!raw) return;
      const code = canonicalCode(raw);
      const target = matrix.get(code) || unknowns.get(code) || { code, label: 'Autre : ' + raw, aliases: [raw], days: m.days.map(() => []) };
      target.days[i].push({ name: doc.name, raw });
      if(!matrix.has(code)) unknowns.set(code, target);
    });
  });
  return [...matrix.values(), ...unknowns.values()].filter(row => row.days.some(day => day.length));
}

function activeSectorCount(m, doctors){ return buildSectorMatrix(m, doctors).length; }

function renderSectorTable(m, doctors){
  const rows = buildSectorMatrix(m, doctors);
  const table = document.getElementById('planningTable');
  let html = '<thead><tr><th class="doctor sector-col">Secteur / poste</th>';
  m.days.forEach(d => { html += `<th class="sector-day ${isWeekend(d.weekday)?'weekend-head':''}"><div>${d.day}</div><small>${d.weekday}</small></th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += `<tr><th class="doctor sector-col"><span class="chip ${codeClass(row.code)}">${escapeHtml(row.code)}</span><span>${escapeHtml(row.label)}</span></th>`;
    m.days.forEach((d, i) => {
      const wk = isWeekend(d.weekday) ? ' weekend' : '';
      const names = row.days[i];
      html += `<td class="sector-cell${wk}">`;
      if(names.length){
        html += names.map(x => `<div class="person" title="${escapeHtml(x.raw)}">${escapeHtml(x.name)}</div>`).join('');
      }else{
        html += '<span class="empty">·</span>';
      }
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody>'; table.innerHTML = html;
}

init().catch(err => { document.body.innerHTML = '<pre>Erreur de chargement : ' + escapeHtml(err.message) + '</pre>'; });