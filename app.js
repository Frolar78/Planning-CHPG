'use strict';

// ── CONFIG ─────────────────────────────────────────────────────────────
const SECTORS_DEF = [
  { code:'VIS', label:'Bloc viscéral',           icon:'🫀' },
  { code:'REA', label:'Réanimation',              icon:'🫁' },
  { code:'ORT', label:'Orthopédie',               icon:'🦴' },
  { code:'DVI', label:'Pose DVI',                 icon:'💉' },
  { code:'ORL', label:'ORL / Ophtalmologie',      icon:'👁️' },
  { code:'END', label:'Endoscopies',              icon:'🔬' },
  { code:'CI',  label:'Cardio interventionnelle', icon:'🫀' },
  { code:'RI',  label:'Radio interventionnelle',  icon:'📡' },
  { code:'MAT', label:'Maternité',                icon:'👶' },
  { code:'CS',  label:'Consultation',             icon:'📋' },
];

const DAYS_FR = ['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
// ── STATE ──────────────────────────────────────────────────────────────
let DATA = null;
let currentMonthId = null;
let currentWeekIdx = 0;

// ── UTILS ──────────────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function isWeekend(wd){ return wd==='S'||wd==='D'; }
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function isoWeek(dateStr){
  const dt=new Date(dateStr);
  const tmp=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));
  tmp.setUTCDate(tmp.getUTCDate()+4-(tmp.getUTCDay()||7));
  const ys=new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  return Math.ceil((((tmp-ys)/86400000)+1)/7);
}

function getWeeksInMonth(month){
  const weeks=[]; let cur=null;
  month.days.forEach((d,i)=>{
    const wn=isoWeek(d.date);
    if(!cur||cur.weekNum!==wn){ cur={weekNum:wn,days:[]}; weeks.push(cur); }
    cur.days.push({...d,dayIdx:i});
  });
  return weeks;
}

function weekDaysFull(weekInfo){
  const out=Array(7).fill(null);
  weekInfo.days.forEach(d=>{
    const dt=new Date(d.date);
    let dow=dt.getDay(); if(dow===0)dow=6; else dow-=1;
    out[dow]=d;
  });
  return out;
}

// ── INIT ───────────────────────────────────────────────────────────────
async function init(){
  try{
    DATA=await fetch('./planning.json').then(r=>r.json());
  }catch(e){
    document.body.innerHTML=`<div style="padding:40px;font-family:sans-serif;color:#CE1126"><h2>Erreur de chargement</h2><pre>${esc(e.message)}</pre></div>`;
    return;
  }
  const now=new Date();
  const found=DATA.months.find(m=>m.year===now.getFullYear()&&m.month===now.getMonth()+1);
  currentMonthId=found?found.id:DATA.months[0].id;
  buildMonthSelect();
  buildWeekNav();
  render();
}

// ── MONTH SELECT ───────────────────────────────────────────────────────
function buildMonthSelect(){
  const sel=document.getElementById('monthSelect');
  sel.innerHTML='';
  DATA.months.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id;
    opt.textContent=m.label;
    if(m.id===currentMonthId) opt.selected=true;
    sel.appendChild(opt);
  });
  sel.onchange=()=>{
    currentMonthId=sel.value;
    currentWeekIdx=0;
    buildWeekNav();
    render();
  };
}

// ── WEEK NAV ───────────────────────────────────────────────────────────
function buildWeekNav(){
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const today=todayStr();

  // Auto-select current week
  const todayWk=weeks.findIndex(w=>w.days.some(d=>d.date===today));
  if(todayWk>=0) currentWeekIdx=todayWk;

  const container=document.getElementById('weekPills');
  container.innerHTML='';
  weeks.forEach((w,i)=>{
    const first=new Date(w.days[0].date);
    const last=new Date(w.days[w.days.length-1].date);
    const fmt=dt=>dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    const btn=document.createElement('button');
    btn.className='week-pill'+(i===currentWeekIdx?' active':'');
    btn.textContent=`S${w.weekNum} · ${fmt(first)}–${fmt(last)}`;
    btn.onclick=()=>{ currentWeekIdx=i; buildWeekNav(); render(); };
    container.appendChild(btn);
  });
}

// ── MAIN RENDER ────────────────────────────────────────────────────────
function render(){
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const week=weeks[currentWeekIdx];
  if(!week) return;
  const daySlots=weekDaysFull(week);
  renderTable(month,daySlots,week);
  renderBottom(month,daySlots,week);
}

// ── TABLE ──────────────────────────────────────────────────────────────
function renderTable(month,daySlots,week){
  const today=todayStr();

  // Header
  let thead=`<thead><tr>
    <th class="th-sector">SECTEUR</th>`;

  daySlots.forEach((slot,i)=>{
    if(!slot){ thead+=`<th class="th-day weekend"></th>`; return; }
    const isWe=isWeekend(slot.weekday);
    const isTd=slot.date===today;
    const cls=['th-day',isWe?'weekend':'',isTd?'today':''].filter(Boolean).join(' ');
    thead+=`<th class="${cls}">
      <div class="day-name">${DAYS_FR[i]}</div>
      <div class="day-date">${slot.day}</div>
      <div class="am-pm-labels">
        <div class="am-pm-label">AM</div>
        <div class="am-pm-label pm">PM</div>
      </div>
    </th>`;
  });
  thead+=`</tr></thead>`;

  // Build sector→day→slot data
  const smap={};
  SECTORS_DEF.forEach(s=>{ smap[s.code]=Array(7).fill(null).map(()=>({am:[],pm:[]})); });

  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      if(entry.status && ABSENT_STATUSES.has(entry.status)) return;
      const status=entry.status||'';
      if(entry.morning && smap[entry.morning])
        smap[entry.morning][dow].am.push({init:doc.initials,status});
      if(entry.afternoon && smap[entry.afternoon])
        smap[entry.afternoon][dow].pm.push({init:doc.initials,status});
    });
  });

  // Active sectors only
  const active=SECTORS_DEF.filter(s=>
    smap[s.code].some(d=>d.am.length||d.pm.length)
  );

  // Rows
  let tbody='<tbody>';
  active.forEach(s=>{
    tbody+=`<tr class="sector-row">
      <td class="td-sector">
        <div class="sector-label">
          <span class="sector-icon">${s.icon}</span>
          <span class="sector-name-text">${esc(s.label)}</span>
        </div>
      </td>`;

    daySlots.forEach((slot,dow)=>{
      const isWe=slot?isWeekend(slot.weekday):true;
      const isTd=slot?slot.date===today:false;
      const cls=['td-day',isWe?'weekend':'',isTd?'today':''].filter(Boolean).join(' ');
      tbody+=`<td class="${cls}">`;

      if(!slot||(!smap[s.code][dow].am.length&&!smap[s.code][dow].pm.length)){
        tbody+=`<div class="slot-pair">
          <div class="slot"><span class="slot-dash">—</span></div>
          <div class="slot"><span class="slot-dash">—</span></div>
        </div>`;
      } else {
        const amNames=smap[s.code][dow].am;
        const pmNames=smap[s.code][dow].pm;
        tbody+=`<div class="slot-pair">
          <div class="slot">${amNames.length
            ? amNames.map(p=>`<span class="slot-name ${p.status==='G'?'is-guard':p.status==='18'?'is-h18':''}">${esc(p.init)}</span>`).join('')
            : '<span class="slot-dash">—</span>'
          }</div>
          <div class="slot">${pmNames.length
            ? pmNames.map(p=>`<span class="slot-name ${p.status==='G'?'is-guard':p.status==='18'?'is-h18':''}">${esc(p.init)}</span>`).join('')
            : '<span class="slot-dash">—</span>'
          }</div>
        </div>`;
      }
      tbody+=`</td>`;
    });
    tbody+=`</tr>`;
  });
  tbody+='</tbody>';

  document.getElementById('planningTable').innerHTML=thead+tbody;
}

// ── BOTTOM SECTION ─────────────────────────────────────────────────────
function renderBottom(month, daySlots, week){
  const guards  = Array(7).fill(null).map(()=>[]);
  const h18     = Array(7).fill('');
  const sorties = Array(7).fill(null).map(()=>[]);
  const absents = Array(7).fill(null).map(()=>[]);

  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry = doc.days[slot.dayIdx]||{};
      const st = entry.status||'';
      if(st==='G')  guards[dow].push(doc.initials);
      if(st==='18') h18[dow] = doc.initials;
      if(st==='RG') sorties[dow].push(doc.initials);
      if(['A','CP','F'].includes(st)) absents[dow].push({init:doc.initials, reason:st});
    });
  });

  function buildRow(label, cellsFn){
    let row = `<tr><td class="bt-label">${label}</td>`;
    daySlots.forEach((slot,dow)=>{
      const isWe = slot ? isWeekend(slot.weekday) : true;
      row += `<td class="bt-cell${isWe?' weekend':''}">${slot ? cellsFn(dow) : ''}</td>`;
    });
    return row + '</tr>';
  }

  let html = `<div class="bottom-tables"><div class="bt-card">
    <div class="bt-card-header">Gardes &amp; fonctions</div>
    <div class="bt-scroll"><table class="bt-table"><tbody>`;

  html += buildRow('Garde 24h', dow =>
    guards[dow].length
      ? guards[dow].map(i=>`<span class="name-tag guard">${i}</span>`).join('')
      : '<span class="bt-dash">—</span>'
  );
  html += buildRow('8h – 18h', dow =>
    h18[dow] ? `<span class="name-tag h18">${h18[dow]}</span>` : '<span class="bt-dash">—</span>'
  );
  html += buildRow('Sortie de garde', dow =>
    sorties[dow].length
      ? sorties[dow].map(i=>`<span class="name-tag rg">${i}</span>`).join('')
      : '<span class="bt-dash">—</span>'
  );
  html += buildRow('Absences / CP / F', dow =>
    absents[dow].length
      ? absents[dow].map(a=>`<span class="name-tag absent" title="${a.reason}">${a.init}</span>`).join('')
      : '<span class="bt-dash">—</span>'
  );

  html += `</tbody></table></div></div></div>`;
  document.getElementById('bottomSection').innerHTML = html;
}

// ── EXPORT EXCEL ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('exportBtn').onclick=()=>{
    if(typeof XLSX==='undefined'){ alert('SheetJS non chargé'); return; }
    const month=DATA.months.find(m=>m.id===currentMonthId);
    const weeks=getWeeksInMonth(month);
    alert('Export en cours de développement — semaine '+weeks[currentWeekIdx].weekNum);
  };
});

init();
