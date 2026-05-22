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
      const entry = doc.days[slot.dayIdx]||{};
      if(entry.status && ABSENT_STATUSES.has(entry.status)) return;
      const status=entry.status||'';
      const morningKey = entry.morning && entry.morning.startsWith('CS-') ? 'CS' : entry.morning;
      const afternoonKey = entry.afternoon && entry.afternoon.startsWith('CS-') ? 'CS' : entry.afternoon;
      if(morningKey && smap[morningKey])
        smap[morningKey][dow].am.push({init:doc.initials,status,sector:entry.morning});
      if(afternoonKey && smap[afternoonKey])
        smap[afternoonKey][dow].pm.push({init:doc.initials,status,sector:entry.afternoon});
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
? amNames.map(p=>{ const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null; return `<span class="slot-name" title="${sub?'CS '+esc(sub):''}">${esc(p.init)}</span>`; }).join('')            : '<span class="slot-dash">—</span>'
          }</div>
          <div class="slot">${pmNames.length
? pmNames.map(p=>{ const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null; return `<span class="slot-name" title="${sub?'CS '+esc(sub):''}">${esc(p.init)}</span>`; }).join('')            : '<span class="slot-dash">—</span>'
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
  document.getElementById('exportBtn').onclick=exportExcel;
});

function exportExcel(){
  if(typeof XLSX==='undefined'){ alert('SheetJS non chargé'); return; }
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const week=weeks[currentWeekIdx];
  const daySlots=weekDaysFull(week);
  const DAYS_FR=['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
  const C={red:'CE1126',redMid:'A50E1F',redLight:'FCE8EB',charcoal:'1A1A2E',slate:'374151',muted:'9CA3AF',line:'F3F4F6',lineDark:'E5E7EB',bg:'FAFAFA',white:'FFFFFF',greenBg:'ECFDF5',greenFg:'065F46',amberBg:'FFFBEB',amberFg:'B45309'};

  const st=(bg,fg,bold=false,sz=10,h='center',wrap=false)=>({
    fill:{patternType:'solid',fgColor:{rgb:bg}},
    font:{name:'Calibri',sz,bold,color:{rgb:fg}},
    alignment:{horizontal:h,vertical:'center',wrapText:wrap},
    border:{right:{style:'thin',color:{rgb:C.lineDark}},bottom:{style:'thin',color:{rgb:C.lineDark}}}
  });

  // Build sector assignments
  const sectorRows=SECTORS_DEF.map(s=>({...s,days:Array(7).fill(null).map(()=>({am:[],pm:[]}))}));
  const sectorIdx=Object.fromEntries(sectorRows.map((s,i)=>[s.code,i]));
  const guardsArr=Array(7).fill(null).map(()=>[]);
  const h18Arr=Array(7).fill('');
  const sortiesArr=Array(7).fill(null).map(()=>[]);
  const absentsArr=Array(7).fill(null).map(()=>[]);

  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      const st2=entry.status||'';
      if(st2==='G') guardsArr[dow].push(doc.initials);
      if(st2==='18') h18Arr[dow]=doc.initials;
      if(st2==='RG') sortiesArr[dow].push(doc.initials);
      if(['A','CP','F'].includes(st2)) absentsArr[dow].push(doc.initials);
      if(ABSENT_STATUSES.has(st2)) return;
      const mKey=entry.morning&&entry.morning.startsWith('CS-')?'CS':entry.morning;
      const pKey=entry.afternoon&&entry.afternoon.startsWith('CS-')?'CS':entry.afternoon;
      if(mKey&&sectorIdx[mKey]!==undefined) sectorRows[sectorIdx[mKey]].days[dow].am.push({init:doc.initials,sector:entry.morning});
      if(pKey&&sectorIdx[pKey]!==undefined) sectorRows[sectorIdx[pKey]].days[dow].pm.push({init:doc.initials,sector:entry.afternoon});
    });
  });

  const rows=[];const merges=[];let r=0;

  // Title
  rows.push([{v:`PLANNING · SEMAINE ${week.weekNum} · CHPG MONACO`,s:st(C.red,C.white,true,13)},
    ...Array(14).fill({v:'',s:st(C.red,C.white)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  rows.push([{v:"Service d'Anesthésie-Réanimation",s:st(C.redMid,C.redLight,false,9)},
    ...Array(14).fill({v:'',s:st(C.redMid,C.redLight)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // Day headers — 2 cols per day (AM/PM)
  const dayRow=[{v:'SECTEUR',s:st(C.charcoal,C.white,true,10,'left')}];
  daySlots.forEach((slot,i)=>{
    const isWe=i>=5;
    const bg=isWe?C.slate:C.charcoal;
    const dt=slot?new Date(slot.date):null;
    const ds=dt?dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}).toUpperCase():'';
    dayRow.push({v:`${DAYS_FR[i]}${ds?'\n'+ds:''}`,s:st(bg,isWe?C.muted:C.white,true,9,'center',true)});
    dayRow.push({v:'',s:st(bg,isWe?C.muted:C.white)});
  });
  rows.push(dayRow); r++;

  // AM/PM subheader
  const ampmRow=[{v:'',s:st(C.charcoal,C.white)}];
  daySlots.forEach((_,i)=>{
    const isWe=i>=5;
    ampmRow.push({v:'AM',s:st(isWe?C.slate:C.red,C.white,true,8)});
    ampmRow.push({v:'PM',s:st(isWe?C.slate:C.muted,C.white,true,8)});
  });
  rows.push(ampmRow); r++;

  // Merge day headers across AM/PM cols
  daySlots.forEach((_,i)=>{
    merges.push({s:{r:2,c:1+i*2},e:{r:2,c:2+i*2}});
  });

  // Sector rows
  const activeSectors=sectorRows.filter(s=>s.days.some(d=>d.am.length||d.pm.length));
  activeSectors.forEach(sec=>{
    const row=[{v:sec.label,s:{...st(C.line,C.charcoal,true,10,'left'),border:{right:{style:'medium',color:{rgb:'CCCCCC'}},bottom:{style:'thin',color:{rgb:C.lineDark}}}}}];
    for(let i=0;i<7;i++){
      const isWe=i>=5;
      const bg=isWe?C.bg:C.white;
      const am=sec.days[i].am;
      const pm=sec.days[i].pm;
      const fmtNames=(arr)=>arr.map(p=>{
        const sub=p.sector&&p.sector.includes('-')?` (${p.sector.split('-')[1]})` :'';
        return p.init+sub;
      }).join(', ');
      row.push({v:am.length?fmtNames(am):'—',s:st(bg,am.length?C.charcoal:C.muted,false,9,'center',true)});
      row.push({v:pm.length?fmtNames(pm):'—',s:st(bg,pm.length?C.charcoal:C.muted,false,9,'center',true)});
    }
    rows.push(row); r++;
  });

  // Spacer
  rows.push(Array(15).fill({v:'',s:st(C.line,C.line)}));
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // Gardes section
  rows.push([{v:'GARDES & FONCTIONS',s:st(C.line,C.muted,true,8,'left')},...Array(14).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  const infoRow2=(lbl,valsFn)=>{
    const row=[{v:lbl,s:st(C.line,C.slate,true,9,'left')}];
    for(let i=0;i<7;i++){
      const isWe=i>=5; const v=valsFn(i);
      row.push({v:v||(isWe?'':'—'),s:st(v?C.redLight:(isWe?C.bg:C.white),v?C.red:C.muted,false,9,'center',true)});
      row.push({v:'',s:st(isWe?C.bg:C.white,C.white)});
    }
    return row;
  };

  rows.push(infoRow2('Garde 24h',i=>guardsArr[i].join(' / '))); r++;
  rows.push(infoRow2('8h – 18h',i=>h18Arr[i])); r++;
  rows.push(infoRow2('Sortie de garde',i=>sortiesArr[i].join(' / '))); r++;
  rows.push(infoRow2('Absences / CP / F',i=>absentsArr[i].join(' / '))); r++;

  // Footer
  rows.push([{v:`Généré le ${new Date().toLocaleDateString('fr-FR')}  ·  CHPG Monaco · Confidentiel`,
    s:st(C.charcoal,C.muted,false,7,'center')},...Array(14).fill({v:'',s:st(C.charcoal,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:14}});

  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!merges']=merges;
  ws['!cols']=[{wch:22},...Array(14).fill({wch:10})];
  ws['!rows']=[{hpt:28},{hpt:14},{hpt:32},{hpt:16},...Array(rows.length-4).fill({hpt:20})];
  ws['!pageSetup']={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1};

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,`S${week.weekNum}`);
  XLSX.writeFile(wb,`Planning_S${week.weekNum}_CHPG.xlsx`);
}

init();
