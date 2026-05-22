'use strict';

let DATA = null;
let currentMonthId = null;
let currentView = 'doctors';

const SECTOR_DEFS = [
  { code:'VIS', label:'Bloc viscéral' },
  { code:'REA', label:'Réanimation' },
  { code:'ORT', label:'Bloc orthopédique' },
  { code:'DVI', label:'Pose DVI' },
  { code:'ORL', label:'Bloc ORL / Ophtalmo' },
  { code:'END', label:'Endoscopies' },
  { code:'RI',  label:'Radiologie interventionnelle' },
  { code:'CI',  label:'Cardiologie interventionnelle' },
  { code:'MAT', label:'Maternité' },
  { code:'CS',  label:'Consultation' },
];

const STATUS_SET = new Set(['G','RG','18','A','CP','F','R','I','E']);

const CODE_LABELS = {
  G:'Garde 24h', RG:'Repos de garde', '18':'Journée 8h–18h',
  A:'Absence', CP:'Congés payés', F:'Formation', R:'Récup samedi',
  I:'Indisponible', E:'Formation ext.',
  VIS:'Bloc viscéral', REA:'Réanimation', ORT:'Bloc orthopédique', DVI:'Pose DVI',
  ORL:'ORL / Ophtalmo', END:'Endoscopies', RI:'Radio interventionnelle',
  CI:'Cardio interventionnelle', MAT:'Maternité', CS:'Consultation',
};

const INITIALS_MAP = {
  'DR ALBOUY':'SA','DR ARMANDO':'GA','DR BONNET':'LB','DR BOUREGBA':'MB',
  'DR CATINEAU':'JC','DR FROHLICH':'AFR','DR FERRIERO':'AF','DR GHIGLIONE':'SG',
  'DR GUERIN':'JPG','DR LEVASSEUR':'LUL','DR LEY':'LL','DR MENADE':'RM',
  'DR OPPRECHT':'NO','DR PARTOUCHE':'NP','DR ROUSSEAU':'GR','DR SALA':'NS',
  'DR SEVERAC':'MS','DR SULTAN':'WS','DR SUPLY':'CS','DR TRAN':'DT',
  'DR WIDEHEM':'RW','DR ZAMARON':'FZ','PR PRUNET':'BP',
  'DR ARMAND':'AD','DR DRUGE':'DD','DR GARCIA':'PG',
};
function getInitials(name) {
  return INITIALS_MAP[name] || name.replace('DR ','').replace('PR ','').slice(0,3);
}

// ── CELL PARSER ────────────────────────────────────────────────────────
// Handles: 'VIS', 'G', 'RG', 'G/REA', '18/END', 'CP', ''
function parseCell(raw) {
  const s = String(raw || '').trim().toUpperCase().replace('18H','18');
  if (!s) return { status:'', sector:'' };
  if (s.includes('/')) {
    const [a, b] = s.split('/',2);
    return { status: a, sector: b };
  }
  if (STATUS_SET.has(s)) return { status: s, sector: '' };
  return { status: '', sector: s };
}

function isAbsent(raw) {
  const { status } = parseCell(raw);
  return ['RG','A','CP','F','R','I'].includes(status);
}

function isWeekend(wd) { return wd==='S'||wd==='D'; }

function esc(s) {
  return String(s||'').replace(/[&<>'"]/g,c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function todayStr() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── CHIP RENDERING ─────────────────────────────────────────────────────
function chipHtml(code, label) {
  const cls = 'chip chip-' + (code==='18'?'18':code.replace(/[^A-Z0-9]/g,''));
  return `<span class="${cls}" title="${esc(label||code)}">${esc(code)}</span>`;
}

function cellHtml(raw) {
  const { status, sector } = parseCell(raw);
  if (!status && !sector) return `<span class="empty">·</span>`;
  let html = '';
  if (status) html += chipHtml(status, CODE_LABELS[status]||status);
  if (sector) html += chipHtml(sector, CODE_LABELS[sector]||sector);
  return html;
}

// ── WEEK UTILS ─────────────────────────────────────────────────────────
function isoWeek(dateStr) {
  const dt=new Date(dateStr);
  const tmp=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate()));
  tmp.setUTCDate(tmp.getUTCDate()+4-(tmp.getUTCDay()||7));
  const ys=new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  return Math.ceil((((tmp-ys)/86400000)+1)/7);
}

function getWeeksInMonth(month) {
  const weeks=[]; let cur=null;
  month.days.forEach((d,i)=>{
    const wn=isoWeek(d.date);
    if(!cur||cur.weekNum!==wn){cur={weekNum:wn,days:[]};weeks.push(cur);}
    cur.days.push({date:d.date,dayIdx:i,weekday:d.weekday,dayNum:d.day});
  });
  return weeks;
}

function weekDaysFull(weekInfo) {
  const out=Array(7).fill(null);
  weekInfo.days.forEach(d=>{
    const dt=new Date(d.date);
    let dow=dt.getDay(); if(dow===0)dow=6; else dow-=1;
    out[dow]=d;
  });
  return out;
}

// ── INIT ───────────────────────────────────────────────────────────────
async function init() {
  try {
    DATA=await fetch('./planning.json').then(r=>r.json());
  } catch(e) {
    document.body.innerHTML=`<div style="padding:40px;color:#b91c1c;font-family:sans-serif">
      <h2>Erreur de chargement</h2><p>Impossible de charger planning.json.</p>
      <pre>${esc(e.message)}</pre></div>`;
    return;
  }
  const now=new Date();
  const found=DATA.months.find(m=>m.year===now.getFullYear()&&m.month===now.getMonth()+1);
  currentMonthId=found?found.id:DATA.months[0].id;
  buildMonthTabs(); buildLegend(); buildExportUI(); bindEvents(); render();
}

// ── EVENTS ─────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('searchInput').addEventListener('input',render);
  document.getElementById('btnToday').onclick=()=>{
    const now=new Date();
    const f=DATA.months.find(m=>m.year===now.getFullYear()&&m.month===now.getMonth()+1);
    if(f){currentMonthId=f.id;buildMonthTabs();updateWeekSelector();render();}
  };
  document.getElementById('btnDoctors').onclick=()=>setView('doctors');
  document.getElementById('btnSectors').onclick=()=>setView('sectors');
}

function setView(v) {
  currentView=v;
  document.getElementById('btnDoctors').classList.toggle('active',v==='doctors');
  document.getElementById('btnSectors').classList.toggle('active',v==='sectors');
  render();
}

// ── TABS ───────────────────────────────────────────────────────────────
function buildMonthTabs() {
  const el=document.getElementById('monthTabs'); el.innerHTML='';
  DATA.months.forEach(m=>{
    const b=document.createElement('button');
    b.textContent=m.label.replace(' 2026','').replace(' 2027','');
    b.className=m.id===currentMonthId?'active':'';
    b.onclick=()=>{currentMonthId=m.id;buildMonthTabs();updateWeekSelector();render();};
    el.appendChild(b);
  });
}

function buildLegend() {
  const el=document.getElementById('legend');
  ['G','RG','18','A','CP','F','R','REA','VIS','ORT','ORL','DVI','END','CI','RI','MAT','CS']
    .forEach(c=>{ el.innerHTML+=chipHtml(c,CODE_LABELS[c]||c); });
}

// ── RENDER ─────────────────────────────────────────────────────────────
function render() {
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const doctors=q?month.doctors.filter(d=>d.name.toLowerCase().includes(q)):month.doctors;
  document.getElementById('headerBadge').textContent=month.label;
  renderKpis(month,doctors);
  document.getElementById('panelTitle').textContent=
    (currentView==='doctors'?'Vue médecins — ':'Vue secteurs — ')+month.label;
  if(currentView==='doctors') renderDoctorTable(month,doctors);
  else renderSectorTable(month,doctors);
}

// ── KPIs ───────────────────────────────────────────────────────────────
function countStatus(doctors,code) {
  let n=0;
  doctors.forEach(d=>d.cells.forEach(raw=>{
    const {status}=parseCell(raw);
    if(status===code) n++;
  }));
  return n;
}

function renderKpis(month,doctors) {
  const el=document.getElementById('kpis');
  const today=todayStr();
  const ti=month.days.findIndex(d=>d.date===today);
  const present=ti>=0?doctors.filter(d=>!isAbsent(d.cells[ti])).length:null;
  const items=[
    {label:'Médecins',value:doctors.length,accent:true},
    {label:"Présents aujourd'hui",value:present!==null?present:'—'},
    {label:'Gardes G',value:countStatus(doctors,'G')},
    {label:'Repos RG',value:countStatus(doctors,'RG')},
    {label:'Journées 18h',value:countStatus(doctors,'18')},
    {label:'Absences',value:countStatus(doctors,'A')},
    {label:'Congés',value:countStatus(doctors,'CP')},
    {label:'Formations',value:countStatus(doctors,'F')},
  ];
  el.innerHTML=items.map(item=>`
    <div class="kpi">
      <div class="kpi-label">${esc(item.label)}</div>
      <div class="kpi-value${item.accent?' accent':''}">${item.value}</div>
    </div>`).join('');
}

// ── DOCTOR TABLE ───────────────────────────────────────────────────────
function renderDoctorTable(month,doctors) {
  const today=todayStr();
  let html='<thead><tr><th class="col-doctor">Médecin</th>';
  month.days.forEach(d=>{
    const wk=isWeekend(d.weekday)?' weekend':'';
    const td=d.date===today?' today-col':'';
    html+=`<th class="col-day${wk}${td}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html+='</tr></thead><tbody>';
  doctors.forEach(doc=>{
    html+=`<tr><td class="col-doctor">${esc(doc.name.replace('DR ','').replace('PR ','PR '))}</td>`;
    month.days.forEach((d,i)=>{
      const raw=doc.cells[i]||'';
      const wk=isWeekend(d.weekday)?' weekend':'';
      const td=d.date===today?' today-col':'';
      html+=`<td class="${wk}${td}"><div class="cell-content">${cellHtml(raw)}</div></td>`;
    });
    html+='</tr>';
  });
  html+='</tbody>';
  document.getElementById('planningTable').innerHTML=html;
}

// ── SECTOR TABLE ───────────────────────────────────────────────────────
function renderSectorTable(month,doctors) {
  const today=todayStr();
  // sector -> day -> [names]
  const smap={};
  SECTOR_DEFS.forEach(s=>{smap[s.code]=month.days.map(()=>[]);});

  doctors.forEach(doc=>{
    doc.cells.forEach((raw,di)=>{
      const {sector}=parseCell(raw);
      if(sector && smap[sector]) {
        smap[sector][di].push(doc.name.replace('DR ','').replace('PR ','PR '));
      }
    });
  });

  const active=SECTOR_DEFS.filter(s=>smap[s.code].some(d=>d.length>0));
  let html='<thead><tr><th class="col-sector">Secteur / Poste</th>';
  month.days.forEach(d=>{
    const wk=isWeekend(d.weekday)?' weekend':'';
    const td=d.date===today?' today-col':'';
    html+=`<th class="col-day${wk}${td}">
      <div class="day-num">${d.day}</div>
      <div class="day-wd">${d.weekday}</div>
    </th>`;
  });
  html+='</tr></thead><tbody>';
  active.forEach(s=>{
    html+=`<tr><td class="col-sector">${chipHtml(s.code,s.label)} ${esc(s.label)}</td>`;
    month.days.forEach((d,i)=>{
      const names=smap[s.code][i];
      const wk=isWeekend(d.weekday)?' weekend':'';
      const td=d.date===today?' today-col':'';
      html+=`<td class="sector-cell${wk}${td}">`;
      html+=names.length
        ? names.map(n=>`<span class="person-tag">${esc(n)}</span>`).join('')
        : `<span class="empty">·</span>`;
      html+='</td>';
    });
    html+='</tr>';
  });
  html+='</tbody>';
  document.getElementById('planningTable').innerHTML=html;
}

// ── EXPORT EXCEL ───────────────────────────────────────────────────────
function buildExportUI() {
  const bar=document.createElement('div');
  bar.style.cssText='background:white;border-bottom:1px solid #e5e7eb;padding:8px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
  bar.innerHTML=`
    <span style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em">Export</span>
    <select id="weekSelect" style="border:1.5px solid #e5e7eb;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;color:#1a1a2e;background:white;outline:none;cursor:pointer;"></select>
    <button id="exportBtn" style="background:#CE1126;color:white;border:none;border-radius:8px;padding:7px 16px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      Télécharger Excel
    </button>`;
  document.querySelector('.toolbar').insertAdjacentElement('afterend',bar);
  document.getElementById('exportBtn').onmouseenter=e=>e.currentTarget.style.background='#9a0d1c';
  document.getElementById('exportBtn').onmouseleave=e=>e.currentTarget.style.background='#CE1126';
  document.getElementById('exportBtn').onclick=()=>{
    const month=DATA.months.find(m=>m.id===currentMonthId);
    const weeks=getWeeksInMonth(month);
    exportWeekXLSX(month,weeks[parseInt(document.getElementById('weekSelect').value)]);
  };
  updateWeekSelector();
}

function updateWeekSelector() {
  const sel=document.getElementById('weekSelect');
  if(!sel||!DATA) return;
  const month=DATA.months.find(m=>m.id===currentMonthId);
  const weeks=getWeeksInMonth(month);
  const today=todayStr();
  sel.innerHTML='';
  weeks.forEach((w,i)=>{
    const f=new Date(w.days[0].date);
    const l=new Date(w.days[w.days.length-1].date);
    const opt=document.createElement('option');
    opt.value=i;
    opt.textContent=`Semaine ${w.weekNum}  ·  ${f.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} – ${l.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}`;
    if(w.days.some(d=>d.date===today)) opt.selected=true;
    sel.appendChild(opt);
  });
}

function exportWeekXLSX(month, weekInfo) {
  if(typeof XLSX==='undefined'){alert('SheetJS non chargé');return;}
  const DAYS_FR=['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
  const C={
    red:'CE1126',redMid:'A50E1F',redLight:'FCE8EB',
    charcoal:'1A1A2E',slate:'374151',muted:'9CA3AF',
    line:'F3F4F6',lineDark:'E5E7EB',bg:'FAFAFA',white:'FFFFFF',
    greenBg:'ECFDF5',greenFg:'065F46',
    amberBg:'FFFBEB',amberFg:'B45309',
    blueBg:'EFF6FF',blueFg:'1D4ED8',
    purpleBg:'F5F3FF',purpleFg:'6D28D9',
  };
  const SECTORS_EX=[
    {code:'VIS',label:'Bloc viscéral',         bg:C.blueBg,   fg:C.blueFg},
    {code:'REA',label:'Réanimation',            bg:C.purpleBg, fg:C.purpleFg},
    {code:'ORT',label:'Bloc orthopédique',      bg:C.greenBg,  fg:C.greenFg},
    {code:'DVI',label:'Pose DVI',               bg:C.amberBg,  fg:C.amberFg},
    {code:'ORL',label:'ORL / Ophtalmologie',    bg:C.blueBg,   fg:C.blueFg},
    {code:'END',label:'Endoscopies',            bg:C.greenBg,  fg:C.greenFg},
    {code:'RI', label:'Radio interventionnelle',bg:C.amberBg,  fg:C.amberFg},
    {code:'CI', label:'Cardio interventionnelle',bg:C.amberBg, fg:C.amberFg},
    {code:'MAT',label:'Maternité',              bg:C.purpleBg, fg:C.purpleFg},
    {code:'CS', label:'Consultations',          bg:C.line,     fg:C.slate},
  ];

  const daySlots=weekDaysFull(weekInfo);

  // Build sector assignments using parseCell
  const sectorAssign={};
  SECTORS_EX.forEach(s=>{sectorAssign[s.code]=Array(7).fill(null).map(()=>[]);});
  const gardesREA=Array(7).fill(''),gardesAnesth=Array(7).fill('');
  const h18=Array(7).fill('');
  const sortiesREA=Array(7).fill(''),sortiesAnesth=Array(7).fill('');
  const absents=Array(7).fill(null).map(()=>[]);

  month.doctors.forEach(doc=>{
    const init=getInitials(doc.name);
    daySlots.forEach((slot,dow)=>{
      if(!slot) return;
      const raw=doc.cells[slot.dayIdx]||'';
      const {status,sector}=parseCell(raw);

      // Sector — G et 18 sont postés donc apparaissent dans les secteurs
      if(sector && sectorAssign[sector]) sectorAssign[sector][dow].push(init);

      // Gardes
      if(status==='G'){
        if(!gardesREA[dow]) gardesREA[dow]=init;
        else gardesAnesth[dow]+=(gardesAnesth[dow]?' ':'')+init;
      }
      if(status==='18') h18[dow]=init;
      if(status==='RG'){
        if(!sortiesREA[dow]) sortiesREA[dow]=init;
        else sortiesAnesth[dow]+=(sortiesAnesth[dow]?' ':'')+init;
      }
      if(['A','CP','F','R'].includes(status)) absents[dow].push(init);
    });
  });

  const st=(bg,fg,bold=false,sz=10,hAlign='center',wrap=false)=>({
    fill:{patternType:'solid',fgColor:{rgb:bg}},
    font:{name:'Calibri',sz,bold,color:{rgb:fg}},
    alignment:{horizontal:hAlign,vertical:'center',wrapText:wrap},
    border:{right:{style:'thin',color:{rgb:C.lineDark}},bottom:{style:'thin',color:{rgb:C.lineDark}}}
  });

  const rows=[]; const merges=[]; let r=0;

  // Title
  rows.push([{v:`PLANNING · SEMAINE ${weekInfo.weekNum} · CHPG MONACO`,s:st(C.red,C.white,true,13)},
    ...Array(6).fill({v:'',s:st(C.red,C.white)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Subtitle
  rows.push([{v:"Service d'Anesthésie-Réanimation",s:st(C.redMid,C.redLight,false,9)},
    ...Array(6).fill({v:'',s:st(C.redMid,C.redLight)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Day headers
  const dayRow=[{v:'',s:st(C.charcoal,C.white)}];
  daySlots.forEach((slot,i)=>{
    const isWe=i>=5;
    const dt=slot?new Date(slot.date):null;
    const ds=dt?dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}).toUpperCase():'';
    dayRow.push({v:`${DAYS_FR[i]}${ds?'\n'+ds:''}`,
      s:st(isWe?C.slate:C.charcoal,isWe?C.muted:C.white,true,9,'center',true)});
  });
  rows.push(dayRow); r++;

  // Section secteurs
  rows.push([{v:'  ANESTHÉSISTES AUX BLOCS ET SECTEURS',s:st(C.line,C.muted,true,8,'left')},
    ...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  SECTORS_EX.forEach(sec=>{
    const nbd=sectorAssign[sec.code];
    const row=[{v:`  ${sec.label}`,s:{...st(sec.bg,sec.fg,true,10,'left'),
      border:{right:{style:'medium',color:{rgb:sec.fg}},bottom:{style:'thin',color:{rgb:C.lineDark}}}}}];
    for(let i=0;i<7;i++){
      const isWe=i>=5; const vals=nbd[i]||[];
      row.push({v:vals.length?vals.join('  ·  '):(isWe?'':'—'),
        s:st(isWe?C.bg:C.white,vals.length?C.charcoal:C.muted,vals.length>0,10,'center',true)});
    }
    rows.push(row); r++;
  });

  // Spacer
  rows.push(Array(8).fill({v:'',s:st(C.line,C.line)}));
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Gardes
  rows.push([{v:'  GARDES & FONCTIONS',s:st(C.line,C.muted,true,8,'left')},
    ...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  const irow=(lbl,vals,bg,fg,bold=false)=>{
    const row=[{v:`  ${lbl}`,s:st(C.line,C.slate,true,9,'left')}];
    for(let i=0;i<7;i++){
      const isWe=i>=5; const v=vals[i]||'';
      row.push({v:v||(isWe?'':'—'),s:st(v?bg:(isWe?C.bg:C.white),v?fg:C.muted,bold&&!!v,10)});
    }
    return row;
  };
  rows.push(irow('Garde réanimation',  gardesREA,    C.redLight,C.red,true));   r++;
  rows.push(irow('Garde anesthésie',   gardesAnesth, C.redLight,C.red,true));   r++;
  rows.push(irow('Sortie garde réa',   sortiesREA,   C.greenBg, C.greenFg));    r++;
  rows.push(irow('Sortie garde anesth',sortiesAnesth,C.greenBg, C.greenFg));    r++;
  rows.push(irow('8h – 18h',           h18,          C.amberBg, C.amberFg,true));r++;

  // Spacer
  rows.push(Array(8).fill({v:'',s:st(C.line,C.line)}));
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  // Absences
  rows.push([{v:'  ABSENCES · CONGÉS · FORMATIONS',s:st(C.line,C.muted,true,8,'left')},
    ...Array(6).fill({v:'',s:st(C.line,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}}); r++;

  const maxAbs=Math.max(...absents.map(a=>a.length),1);
  for(let li=0;li<maxAbs;li++){
    const row=[{v:li===0?'  Absents':'',s:st(C.line,C.slate,li===0,9,'left')}];
    for(let i=0;i<7;i++){
      const v=absents[i][li]||'';
      row.push({v,s:st(i>=5?C.bg:C.white,C.slate,false,10)});
    }
    rows.push(row); r++;
  }

  // Footer
  const today=new Date().toLocaleDateString('fr-FR');
  rows.push([{v:`Généré le ${today}  ·  CHPG Monaco · Anesthésie-Réanimation  ·  Confidentiel`,
    s:st(C.charcoal,C.muted,false,7,'center')},
    ...Array(6).fill({v:'',s:st(C.charcoal,C.muted)})]);
  merges.push({s:{r,c:0},e:{r,c:7}});

  const ws_xl=XLSX.utils.aoa_to_sheet(rows);
  ws_xl['!merges']=merges;
  ws_xl['!cols']=[{wch:26},...Array(7).fill({wch:14})];
  ws_xl['!rows']=[{hpt:30},{hpt:14},{hpt:34},...Array(rows.length-3).fill({hpt:22})];

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws_xl,`S${weekInfo.weekNum}`);
  XLSX.writeFile(wb,`Planning_S${weekInfo.weekNum}_CHPG.xlsx`);
}

init();
