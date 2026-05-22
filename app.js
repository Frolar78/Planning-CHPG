'use strict';

// ── STATE ──────────────────────────────────────────────────────────────
let DATA = null;
let currentMonthId = null;
let currentView = 'doctors';

// ── UTILS ──────────────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/[&<>'"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isWeekend(wd) { return wd === 'S' || wd === 'D'; }

function isAbsent(dayEntry) {
  return ABSENT_STATUSES.has(dayEntry.status) || (!dayEntry.morning && !dayEntry.status);
}

function getDoctorById(id) { return DOCTORS.find(d => d.id === id); }
function getSectorByCode(code) { return SECTOR_MAP[code]; }
function getStatusInfo(code) { return STATUSES[code]; }
function getInitials(id) { return getDoctorById(id)?.initials || id.slice(0,3); }

// ── WEEK UTILS ─────────────────────────────────────────────────────────
function isoWeek(dateStr) {
  const dt = new Date(dateStr);
  const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - ys) / 86400000) + 1) / 7);
}

function getWeeksInMonth(month) {
  const weeks = []; let cur = null;
  month.days.forEach((d, i) => {
    const wn = isoWeek(d.date);
    if (!cur || cur.weekNum !== wn) { cur = {weekNum: wn, days: []}; weeks.push(cur); }
    cur.days.push({...d, dayIdx: i});
  });
  return weeks;
}

function weekDaysFull(weekInfo) {
  const out = Array(7).fill(null);
  weekInfo.days.forEach(d => {
    const dt = new Date(d.date);
    let dow = dt.getDay();
    if (dow === 0) dow = 6; else dow -= 1;
    out[dow] = d;
  });
  return out;
}

// ── CHIP HELPERS ───────────────────────────────────────────────────────
function sectorChipStyle(code) {
  const s = getSectorByCode(code);
  if (!s) return '';
  return `background:${s.bg};color:${s.color};border-color:${s.color}33`;
}

function statusBadgeStyle(code) {
  const st = getStatusInfo(code);
  if (!st) return '';
  return `background:${st.bg};color:${st.color};border:1px solid ${st.border}`;
}

// ── RENDER CELL (doctor view) ──────────────────────────────────────────
function renderCell(dayEntry, isWe, isToday) {
  const cls = ['cell', isWe ? 'weekend' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');

  // Absent
  if (dayEntry.status && ABSENT_STATUSES.has(dayEntry.status)) {
    const st = getStatusInfo(dayEntry.status);
    const style = st ? `background:${st.bg};color:${st.color};border-color:${st.border}` : '';
    return `<td class="${cls}">
      <div class="cell-absent">
        <span class="absent-chip" style="${style}">${esc(dayEntry.status)}</span>
      </div>
    </td>`;
  }

  // Empty
  if (!dayEntry.status && !dayEntry.morning) {
    return `<td class="${cls}">
      <div class="cell-absent"><span class="slot-empty">·</span></div>
    </td>`;
  }

  // Posted (with or without status G/18)
  const statusHtml = dayEntry.status
    ? `<div class="cell-status">
        <span class="status-badge" style="${statusBadgeStyle(dayEntry.status)}">${esc(dayEntry.status)}</span>
       </div>`
    : `<div class="cell-status"></div>`;

  const amSec = getSectorByCode(dayEntry.morning);
  const pmSec = getSectorByCode(dayEntry.afternoon);

  const amHtml = amSec
    ? `<div class="slot slot-am" style="${sectorChipStyle(dayEntry.morning)}" title="${esc(amSec.label)}">${esc(dayEntry.morning)}</div>`
    : `<div class="slot slot-am slot-empty">·</div>`;

  const pmHtml = pmSec
    ? `<div class="slot" style="${sectorChipStyle(dayEntry.afternoon)}" title="${esc(pmSec.label)}">${esc(dayEntry.afternoon)}</div>`
    : `<div class="slot slot-empty">·</div>`;

  return `<td class="${cls}">
    <div class="cell-posted">
      ${statusHtml}
      <div class="cell-slots">${amHtml}${pmHtml}</div>
    </div>
  </td>`;
}

// ── INIT ───────────────────────────────────────────────────────────────
async function init() {
  try {
    DATA = await fetch('./planning.json').then(r => r.json());
  } catch(e) {
    document.body.innerHTML = `<div style="padding:40px;color:#b91c1c;font-family:sans-serif">
      <h2>Erreur de chargement</h2><pre>${esc(e.message)}</pre></div>`;
    return;
  }
  const now = new Date();
  const found = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth()+1);
  currentMonthId = found ? found.id : DATA.months[0].id;

  buildMonthTabs();
  buildLegend();
  buildExportUI();
  bindEvents();
  render();
}

// ── EVENTS ─────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('btnToday').onclick = () => {
    const now = new Date();
    const f = DATA.months.find(m => m.year === now.getFullYear() && m.month === now.getMonth()+1);
    if (f) { currentMonthId = f.id; buildMonthTabs(); updateWeekSelector(); render(); }
  };
  document.getElementById('btnDoctors').onclick = () => setView('doctors');
  document.getElementById('btnSectors').onclick  = () => setView('sectors');
}

function setView(v) {
  currentView = v;
  document.getElementById('btnDoctors').classList.toggle('active', v === 'doctors');
  document.getElementById('btnSectors').classList.toggle('active', v === 'sectors');
  render();
}

// ── TABS ───────────────────────────────────────────────────────────────
function buildMonthTabs() {
  const el = document.getElementById('monthTabs'); el.innerHTML = '';
  DATA.months.forEach(m => {
    const b = document.createElement('button');
    b.textContent = m.label.replace(' 2026','').replace(' 2027','');
    b.className = m.id === currentMonthId ? 'active' : '';
    b.onclick = () => { currentMonthId = m.id; buildMonthTabs(); updateWeekSelector(); render(); };
    el.appendChild(b);
  });
}

// ── LEGEND ─────────────────────────────────────────────────────────────
function buildLegend() {
  const el = document.getElementById('legend');
  // Statuts
  Object.entries(STATUSES).forEach(([code, st]) => {
    el.innerHTML += `<span class="legend-chip" style="background:${st.bg};color:${st.color};border-color:${st.border}" title="${esc(st.label)}">${esc(code)}</span>`;
  });
  // Secteurs
  SECTORS.forEach(s => {
    el.innerHTML += `<span class="legend-chip" style="${sectorChipStyle(s.code)};border:1px solid ${s.color}33" title="${esc(s.label)}">${esc(s.code)}</span>`;
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────
function render() {
  const month = DATA.months.find(m => m.id === currentMonthId);
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const doctors = q
    ? month.doctors.filter(d => (getDoctorById(d.id)?.name || d.id).toLowerCase().includes(q))
    : month.doctors;

  document.getElementById('headerBadge').textContent = month.label;
  document.getElementById('panelTitle').textContent =
    (currentView === 'doctors' ? 'Vue médecins — ' : 'Vue secteurs — ') + month.label;

  renderKpis(month, doctors);
  if (currentView === 'doctors') renderDoctorTable(month, doctors);
  else renderSectorTable(month, doctors);
}

// ── KPIs ───────────────────────────────────────────────────────────────
function renderKpis(month, doctors) {
  const el = document.getElementById('kpis');
  const today = todayStr();
  const ti = month.days.findIndex(d => d.date === today);

  const count = (code) => doctors.reduce((n, doc) =>
    n + doc.days.filter(d => d.status === code).length, 0);

  const presentToday = ti >= 0
    ? doctors.filter(d => !isAbsent(d.days[ti])).length
    : null;

  const items = [
    {label:'Médecins', value: doctors.length, accent: true},
    {label:"Présents aujourd'hui", value: presentToday ?? '—'},
    {label:'Gardes G', value: count('G')},
    {label:'Repos RG', value: count('RG')},
    {label:'Journées 18h', value: count('18')},
    {label:'Absences', value: count('A')},
    {label:'Congés', value: count('CP')},
    {label:'Formations', value: count('F')},
  ];

  el.innerHTML = items.map(item => `
    <div class="kpi">
      <div class="kpi-label">${esc(item.label)}</div>
      <div class="kpi-value${item.accent?' accent':''}">${item.value}</div>
    </div>`).join('');
}

// ── DOCTOR TABLE ───────────────────────────────────────────────────────
function renderDoctorTable(month, doctors) {
  const today = todayStr();
  let html = '<thead><tr><th class="col-name">Médecin</th>';

  month.days.forEach(d => {
    const wk = isWeekend(d.weekday) ? ' weekend' : '';
    const td = d.date === today ? ' today' : '';
    html += `<th class="col-day${wk}${td}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  doctors.forEach(doc => {
    const info = getDoctorById(doc.id);
    const name = info ? info.name.replace('DR ','').replace('PR ','PR ') : doc.id;
    html += `<tr><td class="col-name">${esc(name)}</td>`;
    month.days.forEach((d, i) => {
      html += renderCell(doc.days[i] || {status:'',morning:'',afternoon:''}, isWeekend(d.weekday), d.date === today);
    });
    html += '</tr>';
  });

  html += '</tbody>';
  document.getElementById('planningTable').innerHTML = html;
}

// ── SECTOR TABLE ───────────────────────────────────────────────────────
function renderSectorTable(month, doctors) {
  const today = todayStr();

  // Build: sector → day → { am: [{id, status}], pm: [{id, status}] }
  const smap = {};
  SECTORS.forEach(s => {
    smap[s.code] = month.days.map(() => ({am:[], pm:[]}));
  });

  doctors.forEach(doc => {
    doc.days.forEach((entry, di) => {
      if (isAbsent(entry)) return;
      if (entry.morning && smap[entry.morning]) {
        smap[entry.morning][di].am.push({id: doc.id, status: entry.status});
      }
      if (entry.afternoon && smap[entry.afternoon]) {
        // avoid double-counting if same sector am/pm
        if (entry.afternoon !== entry.morning) {
          smap[entry.afternoon][di].pm.push({id: doc.id, status: entry.status});
        } else {
          // same sector: just mark pm as same
          smap[entry.afternoon][di].pm.push({id: doc.id, status: entry.status});
        }
      }
    });
  });

  const activeSectors = SECTORS.filter(s =>
    smap[s.code].some(d => d.am.length > 0 || d.pm.length > 0)
  );

  let html = '<thead><tr><th class="col-sector">Secteur / Poste</th>';
  month.days.forEach(d => {
    const wk = isWeekend(d.weekday) ? ' weekend' : '';
    const td = d.date === today ? ' today' : '';
    html += `<th class="col-day${wk}${td}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  activeSectors.forEach(s => {
    html += `<tr>
      <td class="col-sector">
        <div class="sector-row-label">
          <span class="sector-code-chip" style="${sectorChipStyle(s.code)};border:1px solid ${s.color}33">${esc(s.code)}</span>
          <span class="sector-name">${esc(s.label)}</span>
        </div>
      </td>`;

    month.days.forEach((d, i) => {
      const isWe = isWeekend(d.weekday);
      const isTo = d.date === today;
      const slot = smap[s.code][i];
      html += `<td class="sector-cell${isWe?' weekend':''}${isTo?' today':''}">`;

      if (slot.am.length === 0 && slot.pm.length === 0) {
        html += `<span class="empty-slot">·</span>`;
      } else {
        html += `<div class="sector-slots">
          <div class="sector-slot">
            <div class="sector-slot-label">AM</div>`;
        slot.am.forEach(p => {
          const cls = p.status === 'G' ? 'is-guard' : p.status === '18' ? 'is-h18' : '';
          const init = getInitials(p.id);
          const title = p.status ? `${init} (${p.status})` : init;
          html += `<span class="person-tag ${cls}" title="${esc(title)}">${esc(init)}${p.status==='G'?'🔴':p.status==='18'?'🟡':''}</span>`;
        });
        html += `</div><div class="sector-slot">
            <div class="sector-slot-label">PM</div>`;
        slot.pm.forEach(p => {
          const cls = p.status === 'G' ? 'is-guard' : p.status === '18' ? 'is-h18' : '';
          const init = getInitials(p.id);
          html += `<span class="person-tag ${cls}" title="${esc(getInitials(p.id))}">${esc(init)}</span>`;
        });
        html += `</div></div>`;
      }
      html += '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  document.getElementById('planningTable').innerHTML = html;
}

// ── EXPORT ─────────────────────────────────────────────────────────────
function buildExportUI() {
  const bar = document.createElement('div');
  bar.className = 'export-bar';
  bar.innerHTML = `
    <span class="export-label">Export</span>
    <select id="weekSelect" class="export-select"></select>
    <button id="exportBtn" class="export-btn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      Excel
    </button>`;
  document.querySelector('.toolbar').insertAdjacentElement('afterend', bar);
  document.getElementById('exportBtn').onclick = () => {
    const month = DATA.months.find(m => m.id === currentMonthId);
    const weeks = getWeeksInMonth(month);
    exportWeekXLSX(month, weeks[parseInt(document.getElementById('weekSelect').value)]);
  };
  updateWeekSelector();
}

function updateWeekSelector() {
  const sel = document.getElementById('weekSelect');
  if (!sel || !DATA) return;
  const month = DATA.months.find(m => m.id === currentMonthId);
  const weeks = getWeeksInMonth(month);
  const today = todayStr();
  sel.innerHTML = '';
  weeks.forEach((w, i) => {
    const f = new Date(w.days[0].date);
    const l = new Date(w.days[w.days.length-1].date);
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `S${w.weekNum} · ${f.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} – ${l.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}`;
    if (w.days.some(d => d.date === today)) opt.selected = true;
    sel.appendChild(opt);
  });
}

function exportWeekXLSX(month, weekInfo) {
  if (typeof XLSX === 'undefined') { alert('SheetJS non chargé'); return; }

  const DAYS_FR = ['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
  const C = {
    red:'CE1126', redMid:'A50E1F', redLight:'FCE8EB',
    charcoal:'1A1A2E', slate:'374151', muted:'9CA3AF',
    line:'F3F4F6', lineDark:'E5E7EB', bg:'FAFAFA', white:'FFFFFF',
    greenBg:'ECFDF5', greenFg:'065F46',
    amberBg:'FFFBEB', amberFg:'B45309',
  };

  const daySlots = weekDaysFull(weekInfo);
  const st = (bg, fg, bold=false, sz=10, h='center', wrap=false) => ({
    fill: {patternType:'solid', fgColor:{rgb:bg}},
    font: {name:'Calibri', sz, bold, color:{rgb:fg}},
    alignment: {horizontal:h, vertical:'center', wrapText:wrap},
    border: {right:{style:'thin',color:{rgb:C.lineDark}}, bottom:{style:'thin',color:{rgb:C.lineDark}}}
  });

  // Build sector assignments
  const sectorRows = SECTORS.map(s => ({
    ...s,
    days: Array(7).fill(null).map(() => ({am:[], pm:[]}))
  }));
  const sectorIdx = Object.fromEntries(sectorRows.map((s,i) => [s.code, i]));

  const gardesREA = Array(7).fill(''), gardesAnesth = Array(7).fill('');
  const h18 = Array(7).fill('');
  const sortiesREA = Array(7).fill(''), sortiesAnesth = Array(7).fill('');
  const absents = Array(7).fill(null).map(() => []);

  month.doctors.forEach(doc => {
    const init = getInitials(doc.id);
    daySlots.forEach((slot, dow) => {
      if (!slot) return;
      const entry = doc.days[slot.dayIdx] || {};
      const {status, morning, afternoon} = entry;

      if (status && ABSENT_STATUSES.has(status)) {
        if (status === 'RG') {
          if (!sortiesREA[dow]) sortiesREA[dow] = init;
          else sortiesAnesth[dow] += (sortiesAnesth[dow]?' ':'')+init;
        } else {
          absents[dow].push(init);
        }
        return;
      }

      if (status === 'G') {
        if (!gardesREA[dow]) gardesREA[dow] = init;
        else gardesAnesth[dow] += (gardesAnesth[dow]?' ':'')+init;
      }
      if (status === '18') h18[dow] = init;

      if (morning && sectorIdx[morning] !== undefined)
        sectorRows[sectorIdx[morning]].days[dow].am.push({init, status});
      if (afternoon && sectorIdx[afternoon] !== undefined)
        sectorRows[sectorIdx[afternoon]].days[dow].pm.push({init, status});
    });
  });

  const rows = []; const merges = []; let r = 0;

  // Title
  rows.push([{v:`PLANNING · SEMAINE ${weekInfo.weekNum} · CHPG MONACO`, s:st(C.red,C.white,true,13)},
    ...Array(6).fill({v:'',s:st(C.red,C.white)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  rows.push([{v:"Service d'Anesthésie-Réanimation", s:st(C.redMid,C.redLight,false,9)},
    ...Array(6).fill({v:'',s:st(C.redMid,C.redLight)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Day headers
  const dayRow = [{v:'', s:st(C.charcoal,C.white)}];
  daySlots.forEach((slot, i) => {
    const isWe = i >= 5;
    const dt = slot ? new Date(slot.date) : null;
    const ds = dt ? dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}).toUpperCase() : '';
    dayRow.push({v:`${DAYS_FR[i]}${ds?'\n'+ds:''}`, s:st(isWe?C.slate:C.charcoal, isWe?C.muted:C.white, true, 9,'center',true)});
  });
  rows.push(dayRow); r++;

  // Sectors
  rows.push([{v:'  ANESTHÉSISTES AUX BLOCS ET SECTEURS', s:st(C.line,C.muted,true,8,'left')},
    ...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  sectorRows.forEach(sec => {
    const hasAny = sec.days.some(d => d.am.length || d.pm.length);
    if (!hasAny) return;
    const secColor = sec.color.replace('#','');
    const row = [{v:`  ${sec.label}`, s:{...st(sec.bg.replace('#',''),secColor,true,10,'left'),
      border:{right:{style:'medium',color:{rgb:secColor}},bottom:{style:'thin',color:{rgb:C.lineDark}}}}}];
    for (let i=0; i<7; i++) {
      const isWe = i >= 5;
      const d = sec.days[i];
      const amNames = d.am.map(p => p.init + (p.status==='G'?' G':p.status==='18'?' 18':'')).join(' / ');
      const pmNames = d.pm.map(p => p.init).join(' / ');
      const text = [amNames && `AM: ${amNames}`, pmNames && `PM: ${pmNames}`].filter(Boolean).join('\n');
      row.push({v: text || (isWe?'':'—'), s:st(isWe?C.bg:C.white, text?C.charcoal:C.muted, !!text, 9,'center',true)});
    }
    rows.push(row); r++;
  });

  // Spacer
  rows.push(Array(8).fill({v:'',s:st(C.line,C.line)}));
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Gardes
  rows.push([{v:'  GARDES & FONCTIONS',s:st(C.line,C.muted,true,8,'left')},...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  const irow = (lbl, vals, bg, fg, bold=false) => {
    const row = [{v:`  ${lbl}`, s:st(C.line,C.slate,true,9,'left')}];
    for (let i=0; i<7; i++) {
      const isWe=i>=5; const v=vals[i]||'';
      row.push({v:v||(isWe?'':'—'), s:st(v?bg:(isWe?C.bg:C.white),v?fg:C.muted,bold&&!!v,10)});
    }
    return row;
  };

  rows.push(irow('Garde réanimation',  gardesREA,    C.redLight, C.red, true));   r++;
  rows.push(irow('Garde anesthésie',   gardesAnesth, C.redLight, C.red, true));   r++;
  rows.push(irow('Sortie garde réa',   sortiesREA,   C.greenBg,  C.greenFg));     r++;
  rows.push(irow('Sortie garde anesth',sortiesAnesth,C.greenBg,  C.greenFg));     r++;
  rows.push(irow('8h – 18h',           h18,          C.amberBg,  C.amberFg,true));r++;

  // Spacer
  rows.push(Array(8).fill({v:'',s:st(C.line,C.line)}));
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Absences
  rows.push([{v:'  ABSENCES · CONGÉS · FORMATIONS',s:st(C.line,C.muted,true,8,'left')},...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  const maxAbs = Math.max(...absents.map(a => a.length), 1);
  for (let li=0; li<maxAbs; li++) {
    const row = [{v:li===0?'  Absents':'', s:st(C.line,C.slate,li===0,9,'left')}];
    for (let i=0; i<7; i++) {
      const v=absents[i][li]||'';
      row.push({v, s:st(i>=5?C.bg:C.white,C.slate,false,10)});
    }
    rows.push(row); r++;
  }

  // Footer
  const today = new Date().toLocaleDateString('fr-FR');
  rows.push([{v:`Généré le ${today}  ·  CHPG Monaco · Anesthésie-Réanimation  ·  Confidentiel`,
    s:st(C.charcoal,C.muted,false,7,'center')}, ...Array(6).fill({v:'',s:st(C.charcoal,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}});

  const ws_xl = XLSX.utils.aoa_to_sheet(rows);
  ws_xl['!merges'] = merges;
  ws_xl['!cols'] = [{wch:26}, ...Array(7).fill({wch:15})];
  ws_xl['!rows'] = [{hpt:30},{hpt:14},{hpt:34},...Array(rows.length-3).fill({hpt:22})];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws_xl, `S${weekInfo.weekNum}`);
  XLSX.writeFile(wb, `Planning_S${weekInfo.weekNum}_CHPG.xlsx`);
}

init();
