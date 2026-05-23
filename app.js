'use strict';

// ── CONFIG ─────────────────────────────────────────────────────────────
const SECTORS_DEF = [
  { code:'VIS', label:'Bloc viscéral',           icon:'activity' },
  { code:'REA', label:'Réanimation',              icon:'heart-pulse' },
  { code:'ORT', label:'Orthopédie',               icon:'bone' },
  { code:'DVI', label:'Pose DVI',                 icon:'syringe' },
  { code:'ORL', label:'ORL / Ophtalmologie',      icon:'eye' },
  { code:'END', label:'Endoscopies',              icon:'microscope' },
  { code:'CI',  label:'Cardio interventionnelle', icon:'heart' },
  { code:'RI',  label:'Radio interventionnelle',  icon:'scan' },
  { code:'MAT', label:'Maternité',                icon:'baby' },
  { code:'CS',  label:'Consultation',             icon:'stethoscope' },
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
      <i data-lucide="${esc(s.icon)}" class="sector-icon-svg"></i>
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
? (()=>{
                const chips=amNames.map(p=>{
                  const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null;
                  const c=p.status==='G'?'slot-name chip-guard':p.status==='18'?'slot-name chip-h18':'slot-name';
                  return '<span class="'+c+'" title="'+(sub?'CS '+sub:'')+'">'+(p.init||'')+'</span>';
                });
                if(chips.length%2!==0) chips.push('<span class="slot-name-spacer"></span>');
                return chips.join('');
              })()
            : '<span class="slot-dash">—</span>'
          }</div>
          <div class="slot">${pmNames.length
? (()=>{
                const chips=pmNames.map(p=>{
                  const sub=p.sector&&p.sector.includes('-')?p.sector.split('-')[1]:null;
                  const c=p.status==='G'?'slot-name chip-guard':p.status==='18'?'slot-name chip-h18':'slot-name';
                  return '<span class="'+c+'" title="'+(sub?'CS '+sub:'')+'">'+(p.init||'')+'</span>';
                });
                if(chips.length%2!==0) chips.push('<span class="slot-name-spacer"></span>');
                return chips.join('');
              })()
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

setTimeout(()=>{ if(typeof lucide!=='undefined') lucide.createIcons(); }, 0);

// ── EXPORT EXCEL ───────────────────────────────────────────────────────
async function exportExcel(){
  if(typeof ExcelJS==='undefined'){ alert('ExcelJS non chargé'); return; }

  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const week=weeks[currentWeekIdx];
  const daySlots=weekDaysFull(week);

  const DOCTORS_INFO=[
    ['PR PRUNET','BP','81409'],['DR ALBOUY','SA','85019'],['DR ARMANDO','GA','81867'],
    ['DR BONNET','LB','81322'],['DR BOUREGBA','MB','81859'],['DR CATINEAU','JC','81268'],
    ['DR FROHLICH','AFR','82616'],['DR FERRIERO','AF','82565'],['DR GHIGLIONE','SG','81809'],
    ['DR GUERIN','JPG','82022'],['DR LEVASSEUR','LUL','82558'],['DR LEY','LL','82132'],
    ['DR MENADE','RM','81378'],['DR OPPRECHT','NO','82188'],['DR PARTOUCHE','NP','81806'],
    ['DR ROUSSEAU','GR','81860'],['DR SUPLY','CS','82578'],['DR SEVERAC','MS','82401'],
    ['DR SULTAN','WS','81348'],['DR TRAN','DT','83783'],['DR ZAMARON','FZ','82481'],
    ['DR WIDEHEM','RW','82101'],['DR SALA','NS','81397'],
  ];
  const SPECIAL_DECT=[
    ['Garde réa','83636'],['Garde bloc/mater','82103'],
    ['Secrétariat Tamaris','81380'],['Secrétariat réa','89819'],
  ];
  const SECTOR_COLORS_XL={
    VIS:'DDEEFF',REA:'E8E0F0',ORT:'F3AA7D',DVI:'F3AA7D',
    ORL:'FFFFC9',END:'FFFFFF',CI:'E7E6E6',RI:'E7E6E6',
    MAT:'FFA7A9',CS:'D9EAD3',
  };
  const SECTOR_LABELS_XL={
    VIS:'VISCÉRAL',REA:'RÉANIMATION',ORT:'ORTHOPÉDIE',DVI:'POSE DVI',
    ORL:'ORL / OPHTALMO',END:'ENDOSCOPIES',CI:'CARDIO / RADIO INTER.',
    RI:'RADIO INTER.',MAT:'MATERNITÉ',CS:'CONSULTATIONS',
  };
  const SECTORS_XL=['VIS','REA','ORT','DVI','ORL','END','CI','RI','MAT','CS'];
  const DAYS_FR_XL=['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
  const C={
    red:'CE1126',redDark:'9A0D1C',greyHd:'D9D9D9',
    greyLt:'F2F2F2',we:'EFEFEF',white:'FFFFFF',ink:'000000',muted:'595959',
    guard:'FFE0E0',guardFg:'B91C1C',h18:'FFF2CC',h18Fg:'B45309',
    rg:'E2EFDA',rgFg:'166534',abs:'F2F2F2',absFg:'595959',dark:'1A1A2E',
  };

  // Build data
  const smap={};
  SECTORS_XL.forEach(s=>{ smap[s]=Array(7).fill(null).map(()=>({am:[],pm:[]})); });
  const guards=Array(7).fill(null).map(()=>[]);
  const h18=Array(7).fill('');
  const sorties=Array(7).fill(null).map(()=>[]);
  const absents=Array(7).fill(null).map(()=>[]);

  month.doctors.forEach(doc=>{
    let init=doc.initials;
    if(init==='CSU') init='CS';
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const entry=doc.days[slot.dayIdx]||{};
      const st=entry.status||'';
      const am=entry.morning||'';
      const pm=entry.afternoon||'';
      if(st==='G') guards[dow].push(init);
      if(st==='18') h18[dow]=init;
      if(st==='RG') sorties[dow].push(init);
      if(['A','CP','F'].includes(st)) absents[dow].push(init);
      if(ABSENT_STATUSES.has(st)) return;
      const amKey=am.startsWith('CS-')?'CS':am;
      const pmKey=pm.startsWith('CS-')?'CS':pm;
      const amSub=am.includes('-')?am.split('-')[1]:'';
      const pmSub=pm.includes('-')?pm.split('-')[1]:'';
      if(amKey&&smap[amKey]) smap[amKey][dow].am.push({init,sub:amSub,status:st});
      if(pmKey&&smap[pmKey]) smap[pmKey][dow].pm.push({init,sub:pmSub,status:st});
    });
  });

  const colStart=dow=>dow<5?2+dow*4:22+(dow-5)*2;

  // ExcelJS
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(`Semaine ${week.weekNum}`,{
    pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1}
  });
  ws.views=[{showGridLines:false}];

  // Column widths
  ws.getColumn(1).width=20;
  for(let dow=0;dow<5;dow++){
    const cs=colStart(dow);
    for(let ci=0;ci<4;ci++) ws.getColumn(cs+ci).width=6.5;
  }
  for(let dow=5;dow<7;dow++){
    const cs=colStart(dow);
    ws.getColumn(cs).width=6.5; ws.getColumn(cs+1).width=6.5;
  }
  ws.getColumn(26).width=2;
  ws.getColumn(27).width=20;
  ws.getColumn(28).width=8;
  ws.getColumn(29).width=9;

  const thin={style:'thin',color:{argb:'FFCCCCCC'}};
  const thick={style:'medium',color:{argb:'FF888888'}};
  const bAll={top:thin,bottom:thin,left:thin,right:thin};
  const bThick={top:thin,bottom:thin,left:thick,right:thin};

  function fill(hex){ return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+hex}}; }
  function font(bold,sz,hex){ return {name:'Arial',bold,size:sz,color:{argb:'FF'+hex}}; }
  function align(h,v,wrap){ return {horizontal:h,vertical:v,wrapText:!!wrap}; }

  function setCell(ws,r,c,val,f,fi,al,bo){
    const cell=ws.getCell(r,c);
    if(val!==undefined) cell.value=val;
    if(f) cell.font=f;
    if(fi) cell.fill=fi;
    if(al) cell.alignment=al;
    if(bo) cell.border=bo;
    return cell;
  }

  function merge(ws,r1,c1,r2,c2){ ws.mergeCells(r1,c1,r2,c2); }

  let row=1;

  // Title
  const firstSlot=daySlots.find(s=>s);
  const lastSlot=[...daySlots].reverse().find(s=>s);
  const fmtD=ds=>new Date(ds).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const title=`PLANNING ANESTHÉSISTES — Semaine ${week.weekNum} — ${fmtD(firstSlot.date)} au ${fmtD(lastSlot.date)}`;
  merge(ws,row,1,row,25);
  setCell(ws,row,1,title,font(true,13,'FFFFFF'),fill(C.red),align('center','middle'));
  ws.getRow(row).height=26; row++;

  merge(ws,row,1,row,25);
  setCell(ws,row,1,"CHPG Monaco · Service d'Anesthésie-Réanimation",
    font(false,9,'FFFFFF'),fill(C.redDark),align('center','middle'));
  ws.getRow(row).height=14; row++;

  ws.getRow(row).height=5; row++;

  // Day headers
  ws.getRow(row).height=26;
  setCell(ws,row,1,'SECTEUR',font(true,9,C.muted),fill(C.greyHd),align('center','middle'),bAll);
  for(let dow=0;dow<7;dow++){
    const cs=colStart(dow); const isWe=dow>=5; const n=isWe?2:4;
    merge(ws,row,cs,row,cs+n-1);
    const slot=daySlots[dow];
    let val=DAYS_FR_XL[dow];
    if(slot){
      const dt=new Date(slot.date);
      val=DAYS_FR_XL[dow]+'\n'+dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    }
    setCell(ws,row,cs,val,
      font(true,10,isWe?C.muted:C.ink),
      fill(isWe?C.we:C.greyHd),
      align('center','middle',true),bAll);
  }
  row++;

  // AM/PM subheader
  ws.getRow(row).height=14;
  setCell(ws,row,1,'',null,fill(C.greyHd),null,bAll);
  for(let dow=0;dow<7;dow++){
    const cs=colStart(dow); const isWe=dow>=5;
    if(isWe){
      merge(ws,row,cs,row,cs+1);
      setCell(ws,row,cs,'GARDE 24H',font(true,7,'AAAAAA'),fill(C.we),align('center','middle'),bAll);
    } else {
      merge(ws,row,cs,row,cs+1);
      setCell(ws,row,cs,'AM',font(true,8,'FFFFFF'),fill(C.red),align('center','middle'),bAll);
      merge(ws,row,cs+2,row,cs+3);
      setCell(ws,row,cs+2,'PM',font(true,8,'FFFFFF'),fill('374151'),align('center','middle'),bAll);
    }
  }
  row++;

  // Sector rows
  const active=SECTORS_XL.filter(s=>smap[s].some(d=>d.am.length||d.pm.length));
  const getCsBg=(n,def)=>n.sub?SECTOR_COLORS_XL[n.sub]||def:def;

  active.forEach(sec=>{
    const secBg=SECTOR_COLORS_XL[sec]||'FFFFFF';
    let maxRows=1;
    for(let dow=0;dow<7;dow++){
      const am=smap[sec][dow].am.slice(0,4);
      const pm=smap[sec][dow].pm.slice(0,4);
      if(dow<5) maxRows=Math.max(maxRows,Math.max(am.length?Math.ceil(am.length/2):1,pm.length?Math.ceil(pm.length/2):1));
      else maxRows=Math.max(maxRows,am.length?Math.ceil(am.length/2):1);
    }
    for(let ro=0;ro<maxRows;ro++) ws.getRow(row+ro).height=16;
    if(maxRows>1) merge(ws,row,1,row+maxRows-1,1);
    setCell(ws,row,1,SECTOR_LABELS_XL[sec]||sec,font(true,9,C.ink),fill(secBg),align('left','middle'),bThick);

    for(let dow=0;dow<7;dow++){
      const cs=colStart(dow); const isWe=dow>=5; const bg=isWe?C.we:secBg;
      if(isWe){
        const names=smap[sec][dow].am;
        merge(ws,row,cs,row+maxRows-1,cs+1);
        setCell(ws,row,cs,names[0]?names[0].init:'—',
          font(!!names[0],10,names[0]?C.ink:C.muted),fill(bg),align('center','middle'),bAll);
      } else {
        const amN=smap[sec][dow].am.slice(0,4);
        const pmN=smap[sec][dow].pm.slice(0,4);
        const amP=[]; for(let i=0;i<amN.length;i+=2) amP.push(amN.slice(i,i+2));
        const pmP=[]; for(let i=0;i<pmN.length;i+=2) pmP.push(pmN.slice(i,i+2));
        if(!amP.length) amP.push([]);
        if(!pmP.length) pmP.push([]);
        for(let pi=0;pi<maxRows;pi++){
          const ap=amP[pi]||[];
          for(let ni=0;ni<2;ni++){
            const n=ap[ni];
            const cbg=n?getCsBg(n,bg):bg;
            setCell(ws,row+pi,cs+ni,n?n.init:'',font(!!n,9,C.ink),fill(cbg),align('center','middle'),bAll);
          }
          const pp=pmP[pi]||[];
          for(let ni=0;ni<2;ni++){
            const n=pp[ni];
            const cbg=n?getCsBg(n,bg):bg;
            setCell(ws,row+pi,cs+2+ni,n?n.init:'',font(!!n,9,C.ink),fill(cbg),align('center','middle'),bAll);
          }
        }
      }
    }
    row+=maxRows;
  });

  // Spacer
  ws.getRow(row).height=6;
  merge(ws,row,1,row,25); ws.getCell(row,1).fill=fill(C.greyLt); row++;

  // Gardes header
  merge(ws,row,1,row,25);
  setCell(ws,row,1,'GARDES & FONCTIONS',font(true,9,C.muted),fill(C.greyHd),align('left','middle'));
  ws.getRow(row).height=14; row++;

  function gardeRow(label,vals,bgV,fgV){
    ws.getRow(row).height=18;
    setCell(ws,row,1,label,font(true,9,C.ink),fill(C.greyLt),align('left','middle'),bAll);
    for(let dow=0;dow<7;dow++){
      const cs=colStart(dow); const isWe=dow>=5; const n=isWe?2:4;
      merge(ws,row,cs,row,cs+n-1);
      const v=vals[dow];
      setCell(ws,row,cs,v||'—',
        font(!!v,9,v?fgV:C.muted),
        fill(isWe&&!v?C.we:v?bgV:'FFFFFF'),
        align('center','middle'),bAll);
    }
  }

  gardeRow('Garde 24h',guards.map(g=>g.join(' / ')),C.guard,C.guardFg); row++;
  gardeRow('8h – 18h',h18,C.h18,C.h18Fg); row++;
  gardeRow('Sortie de garde',sorties.map(s=>s.join(' / ')),C.rg,C.rgFg); row++;
  gardeRow('Absences / CP / F',absents.map(a=>a.join(' / ')),C.abs,C.absFg); row++;

  // Footer
  merge(ws,row,1,row,25);
  setCell(ws,row,1,`Généré le ${new Date().toLocaleDateString('fr-FR')}  ·  CHPG Monaco · Anesthésie-Réanimation  ·  Confidentiel`,
    font(false,7,'999999'),fill(C.dark),align('center','middle'));
  ws.getRow(row).height=12;

  // Right table
  merge(ws,1,27,1,29);
  setCell(ws,1,27,'ANESTHÉSISTES & N° DECT',font(true,10,'FFFFFF'),fill(C.red),align('center','middle',true));
  ws.getRow(2).height=8;
  for(let c=27;c<=29;c++) ws.getCell(2,c).fill=fill(C.red);

  ws.getRow(3).height=18;
  for(const [col,lbl,h] of [[27,'NOM','left'],[28,'INIT.','center'],[29,'DECT','center']]){
    setCell(ws,3,col,lbl,font(true,9,'FFFFFF'),fill('374151'),align(h,'middle'),bAll);
  }

  let r2=4;
  for(const [name,init,dect] of DOCTORS_INFO){
    ws.getRow(r2).height=13;
    setCell(ws,r2,27,name,font(false,9,C.ink),null,align('left','middle'),bAll);
    setCell(ws,r2,28,init,font(false,9,C.ink),null,align('center','middle'),bAll);
    setCell(ws,r2,29,dect,font(false,9,C.ink),null,align('center','middle'),bAll);
    r2++;
  }
  ws.getRow(r2).height=6; r2++;
  for(const [lbl,dect] of SPECIAL_DECT){
    ws.getRow(r2).height=13;
    merge(ws,r2,27,r2,28);
    setCell(ws,r2,27,lbl,font(true,8,C.muted),fill(C.greyLt),align('left','middle'),bAll);
    setCell(ws,r2,29,dect,font(false,8,C.ink),null,align('center','middle'),bAll);
    r2++;
  }

  // Download
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`Planning_S${week.weekNum}_CHPG.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

init();
