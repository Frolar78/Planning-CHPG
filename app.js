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

const SECTOR_COLORS = {
  VIS:'DDEEFF', REA:'E8E0F0', ORT:'F3AA7D', DVI:'F3AA7D',
  ORL:'FFFFC9', END:'FFFFFF', CI:'E7E6E6',  RI:'E7E6E6',
  MAT:'FFA7A9', CS:'D9EAD3',
};

const SECTOR_LABELS_XL = {
  VIS:'VISCÉRAL', REA:'RÉANIMATION', ORT:'ORTHOPÉDIE', DVI:'POSE DVI',
  ORL:'ORL / OPHTALMO', END:'ENDOSCOPIES', CI:'CARDIO / RADIO INTER.',
  RI:'RADIO INTER.', MAT:'MATERNITÉ', CS:'CONSULTATIONS',
};

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
  document.getElementById('exportBtn').onclick=exportExcel;
  render();
}

// ── MONTH SELECT ───────────────────────────────────────────────────────
function buildMonthSelect(){
  const sel=document.getElementById('monthSelect');
  sel.innerHTML='';
  DATA.months.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id; opt.textContent=m.label;
    if(m.id===currentMonthId) opt.selected=true;
    sel.appendChild(opt);
  });
  sel.onchange=()=>{ currentMonthId=sel.value; currentWeekIdx=0; buildWeekNav(); render(); };
}

// ── WEEK NAV ───────────────────────────────────────────────────────────
function buildWeekNav(){
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const today=todayStr();
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
  let thead=`<thead><tr><th class="th-sector">SECTEUR</th>`;
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

  const smap={};
  SECTORS_DEF.forEach(s=>{ smap[s.code]=Array(7).fill(null).map(()=>({am:[],pm:[]})); });

  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      if(entry.status && ABSENT_STATUSES.has(entry.status)) return;
      const status=entry.status||'';
      const mKey=entry.morning&&entry.morning.startsWith('CS-')?'CS':entry.morning;
      const pKey=entry.afternoon&&entry.afternoon.startsWith('CS-')?'CS':entry.afternoon;
      if(mKey&&smap[mKey]) smap[mKey][dow].am.push({init:doc.initials,status,sector:entry.morning});
      if(pKey&&smap[pKey]) smap[pKey][dow].pm.push({init:doc.initials,status,sector:entry.afternoon});
    });
  });

  const active=SECTORS_DEF.filter(s=>smap[s.code].some(d=>d.am.length||d.pm.length));
  let tbody='<tbody>';
  active.forEach(s=>{
    tbody+=`<tr class="sector-row"><td class="td-sector">
      <div class="sector-label">
        <span class="sector-icon">${s.icon}</span>
        <span class="sector-name-text">${esc(s.label)}</span>
      </div></td>`;
    daySlots.forEach((slot,dow)=>{
      const isWe=slot?isWeekend(slot.weekday):true;
      const isTd=slot?slot.date===today:false;
      const cls=['td-day',isWe?'weekend':'',isTd?'today':''].filter(Boolean).join(' ');
      tbody+=`<td class="${cls}">`;
      if(!slot||(!smap[s.code][dow].am.length&&!smap[s.code][dow].pm.length)){
        tbody+=`<div class="slot-pair"><div class="slot"><span class="slot-dash">—</span></div><div class="slot"><span class="slot-dash">—</span></div></div>`;
      } else {
        const amNames=smap[s.code][dow].am;
        const pmNames=smap[s.code][dow].pm;
        tbody+=`<div class="slot-pair">
          <div class="slot">${amNames.length
            ? amNames.map(p=>{
                const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null;
                const c=p.status==='G'?'slot-name chip-guard':p.status==='18'?'slot-name chip-h18':'slot-name';
                return '<span class="'+c+'" title="'+(sub?'CS '+sub:'')+'">'+(p.init||'')+'</span>';
              }).join('')
            : '<span class="slot-dash">—</span>'
          }</div>
          <div class="slot">${pmNames.length
            ? pmNames.map(p=>{
                const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null;
                const c=p.status==='G'?'slot-name chip-guard':p.status==='18'?'slot-name chip-h18':'slot-name';
                return '<span class="'+c+'" title="'+(sub?'CS '+sub:'')+'">'+(p.init||'')+'</span>';
              }).join('')
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
function renderBottom(month,daySlots,week){
  const guards=Array(7).fill(null).map(()=>[]);
  const h18=Array(7).fill('');
  const sorties=Array(7).fill(null).map(()=>[]);
  const absents=Array(7).fill(null).map(()=>[]);
  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      const st=entry.status||'';
      if(st==='G') guards[dow].push(doc.initials);
      if(st==='18') h18[dow]=doc.initials;
      if(st==='RG') sorties[dow].push(doc.initials);
      if(['A','CP','F'].includes(st)) absents[dow].push({init:doc.initials,reason:st});
    });
  });
  function buildRow(label,cellsFn){
    let row=`<tr><td class="bt-label">${label}</td>`;
    daySlots.forEach((slot,dow)=>{
      const isWe=slot?isWeekend(slot.weekday):true;
      row+=`<td class="bt-cell${isWe?' weekend':''}">${slot?cellsFn(dow):''}</td>`;
    });
    return row+'</tr>';
  }
  let html=`<div class="bottom-tables"><div class="bt-card">
    <div class="bt-card-header">Gardes &amp; fonctions</div>
    <div class="bt-scroll"><table class="bt-table"><tbody>`;
  html+=buildRow('Garde 24h',dow=>guards[dow].length?guards[dow].map(i=>`<span class="name-tag guard">${i}</span>`).join(''):'<span class="bt-dash">—</span>');
  html+=buildRow('8h – 18h',dow=>h18[dow]?`<span class="name-tag h18">${h18[dow]}</span>`:'<span class="bt-dash">—</span>');
  html+=buildRow('Sortie de garde',dow=>sorties[dow].length?sorties[dow].map(i=>`<span class="name-tag rg">${i}</span>`).join(''):'<span class="bt-dash">—</span>');
  html+=buildRow('Absences / CP / F',dow=>absents[dow].length?absents[dow].map(a=>`<span class="name-tag absent" title="${a.reason}">${a.init}</span>`).join(''):'<span class="bt-dash">—</span>');
  html+=`</tbody></table></div></div></div>`;
  document.getElementById('bottomSection').innerHTML=html;
}

// ── EXPORT EXCEL ───────────────────────────────────────────────────────
function exportExcel(){
  if(typeof XLSX==='undefined'){ alert('SheetJS non chargé'); return; }

  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const week=weeks[currentWeekIdx];
  const daySlots=weekDaysFull(week);

  const C={
    red:'CE1126', redDark:'9A0D1C', redLt:'FCE8EB',
    greyHd:'D9D9D9', greyLt:'F2F2F2', we:'EFEFEF',
    white:'FFFFFF', ink:'000000', muted:'595959',
    guard:'FFE0E0', guardFg:'B91C1C',
    h18:'FFF2CC',   h18Fg:'B45309',
    rg:'E2EFDA',    rgFg:'166534',
    abs:'F2F2F2',   absFg:'595959',
    dark:'1A1A2E',
  };

  // Cell style helper
  function st(bg, fg, bold=false, sz=10, h='center', wrap=false){
    return {
      fill:{patternType:'solid', fgColor:{rgb:bg}},
      font:{name:'Arial', sz, bold, color:{rgb:fg}},
      alignment:{horizontal:h, vertical:'center', wrapText:wrap},
      border:{
        left:  {style:'thin', color:{rgb:'CCCCCC'}},
        right: {style:'thin', color:{rgb:'CCCCCC'}},
        top:   {style:'thin', color:{rgb:'CCCCCC'}},
        bottom:{style:'thin', color:{rgb:'CCCCCC'}},
      }
    };
  }
  function stThick(bg,fg,bold=false,sz=10){
    const s=st(bg,fg,bold,sz,'left');
    s.border.left={style:'medium',color:{rgb:'888888'}};
    return s;
  }

  // Build data
  const smap={};
  SECTORS_DEF.forEach(s=>{ smap[s.code]=Array(7).fill(null).map(()=>({am:[],pm:[]})); });
  const guards=Array(7).fill(null).map(()=>[]);
  const h18=Array(7).fill('');
  const sorties=Array(7).fill(null).map(()=>[]);
  const absArr=Array(7).fill(null).map(()=>[]);

  month.doctors.forEach(doc=>{
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      const status=entry.status||'';
      const am=entry.morning||'';
      const pm=entry.afternoon||'';
      if(status==='G') guards[dow].push(doc.initials);
      if(status==='18') h18[dow]=doc.initials;
      if(status==='RG') sorties[dow].push(doc.initials);
      if(['A','CP','F'].includes(status)) absArr[dow].push(doc.initials);
      if(ABSENT_STATUSES.has(status)) return;
      const mKey=am.startsWith('CS-')?'CS':am;
      const pKey=pm.startsWith('CS-')?'CS':pm;
      const mSub=am.includes('-')?am.split('-')[1]:'';
      const pSub=pm.includes('-')?pm.split('-')[1]:'';
      if(mKey&&smap[mKey]) smap[mKey][dow].am.push({init:doc.initials,sub:mSub,status});
      if(pKey&&smap[pKey]) smap[pKey][dow].pm.push({init:doc.initials,sub:pSub,status});
    });
  });

  const rows=[];
  const merges=[];
  let r=0;

  // ── Row 0: Title
  const firstSlot=daySlots.find(s=>s);
  const lastSlot=[...daySlots].reverse().find(s=>s);
  const fmtDate=ds=>{ const d=new Date(ds); return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); };
  const title=`PLANNING ANESTHÉSISTES — Semaine ${week.weekNum} — ${fmtDate(firstSlot.date)} au ${fmtDate(lastSlot.date)}`;
  rows.push([{v:title, s:st(C.red,C.white,true,14)}, ...Array(14).fill({v:'',s:st(C.red,C.white)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // ── Row 1: Subtitle
  rows.push([{v:"CHPG Monaco · Service d'Anesthésie-Réanimation", s:st(C.redDark,C.white,false,10)}, ...Array(14).fill({v:'',s:st(C.redDark,C.white)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // ── Row 2: Spacer
  rows.push(Array(15).fill({v:'',s:st(C.greyLt,C.ink)}));
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // ── Row 3: Day headers
  const dayRow=[{v:'SECTEUR', s:st(C.greyHd,C.muted,true,9,'left')}];
  daySlots.forEach((slot,i)=>{
    const isWe=i>=5;
    const bg=isWe?C.we:C.greyHd;
    const dt=slot?new Date(slot.date):null;
    const ds=dt?dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
    const label=DAYS_FR[i]+(ds?'\n'+ds:'');
    dayRow.push({v:label, s:st(bg,isWe?C.muted:C.ink,true,9,'center',true)});
    dayRow.push({v:'',    s:st(bg,isWe?C.muted:C.ink)});
  });
  rows.push(dayRow);
  // Merge each day across its 2 cols
  daySlots.forEach((_,i)=>{ merges.push({s:{r,c:1+i*2},e:{r,c:2+i*2}}); });
  r++;

  // ── Row 4: AM/PM subheader
  const ampmRow=[{v:'', s:st(C.greyHd,C.ink)}];
  daySlots.forEach((_,i)=>{
    const isWe=i>=5;
    ampmRow.push({v:'AM', s:st(isWe?C.we:C.red,    C.white,true,8)});
    ampmRow.push({v:'PM', s:st(isWe?C.we:'374151', C.white,true,8)});
  });
  rows.push(ampmRow); r++;

  // ── Sector rows
  const activeSectors=SECTORS_DEF.filter(s=>smap[s.code].some(d=>d.am.length||d.pm.length));
  activeSectors.forEach(sec=>{
    const secBg=SECTOR_COLORS[sec.code]||C.white;
    const row=[{v:SECTOR_LABELS_XL[sec.code]||sec.label, s:stThick(secBg,C.ink,true,10)}];
    for(let i=0;i<7;i++){
      const isWe=i>=5;
      const bg=isWe?C.we:(SECTOR_COLORS[sec.code]||C.white);
      const fmt=arr=>arr.length?arr.map(p=>p.init+(p.sub?' ('+p.sub+')':'')).join('\n'):'—';
      row.push({v:fmt(smap[sec.code][i].am), s:st(bg,smap[sec.code][i].am.length?C.ink:C.muted,smap[sec.code][i].am.length>0,9,'center',true)});
      row.push({v:fmt(smap[sec.code][i].pm), s:st(bg,smap[sec.code][i].pm.length?C.ink:C.muted,smap[sec.code][i].pm.length>0,9,'center',true)});
    }
    rows.push(row); r++;
  });

  // ── Spacer
  rows.push(Array(15).fill({v:'',s:st(C.greyLt,C.ink)}));
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  // ── Gardes header
  rows.push([{v:'GARDES & FONCTIONS', s:st(C.greyHd,C.muted,true,9,'left')}, ...Array(14).fill({v:'',s:st(C.greyHd,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:14}}); r++;

  function infoRow(label, vals, bgV, fgV){
    const row=[{v:label, s:st(C.greyLt,C.ink,true,9,'left')}];
    for(let i=0;i<7;i++){
      const isWe=i>=5;
      const v=vals[i]||'';
      const bg=isWe?C.we:(v?bgV:C.white);
      const fg=v?fgV:C.muted;
      // Merge AM+PM cols
      row.push({v:v||'—', s:st(bg,fg,!!v,9,'center',true)});
      row.push({v:'',     s:st(bg,C.white)});
    }
    // Add merges for this row
    for(let i=0;i<7;i++){ merges.push({s:{r,c:1+i*2},e:{r,c:2+i*2}}); }
    return row;
  }

  rows.push(infoRow('Garde 24h',        guards.map(g=>g.join(' / ')),  C.guard, C.guardFg)); r++;
  rows.push(infoRow('8h – 18h',         h18,                            C.h18,   C.h18Fg));   r++;
  rows.push(infoRow('Sortie de garde',  sorties.map(s=>s.join(' / ')), C.rg,    C.rgFg));    r++;
  rows.push(infoRow('Absences / CP / F',absArr.map(a=>a.join(' / ')),  C.abs,   C.absFg));   r++;

  // ── Footer
  rows.push([{v:`Généré le ${new Date().toLocaleDateString('fr-FR')}  ·  CHPG Monaco · Anesthésie-Réanimation  ·  Confidentiel`, s:st(C.dark,C.muted,false,7,'center')}, ...Array(14).fill({v:'',s:st(C.dark,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:14}});

  // ── Build sheet
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!merges']=merges;
  ws['!cols']=[{wch:22},...Array(14).fill({wch:8})];
  ws['!rows']=[
    {hpt:28},{hpt:16},{hpt:6},{hpt:28},{hpt:16},
    ...Array(activeSectors.length).fill({hpt:36}),
    {hpt:8},{hpt:16},{hpt:20},{hpt:20},{hpt:20},{hpt:20},{hpt:14}
  ];

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,`S${week.weekNum}`);
  XLSX.writeFile(wb,`Planning_S${week.weekNum}_CHPG.xlsx`);
}

init();
