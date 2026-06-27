const LOC={H:'Home',UB:'Unit Base',ST:'SET'};
const STORAGE='makb-transpo-v2';
const $=id=>document.getElementById(id);
const todayISO=()=>new Date().toISOString().slice(0,10);
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const niceDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('en-IE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const toTime=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');

let app=JSON.parse(localStorage.getItem(STORAGE)||'null')||{currentDate:todayISO(),settings:{minsHU:15,minsUS:15},schedules:{}};
function save(){localStorage.setItem(STORAGE,JSON.stringify(app))}
function blankSchedule(){return{journeys:[]}}
function sampleSchedule(){return{journeys:[
  {id:crypto.randomUUID(),p:'E',from:LOC.H,to:LOC.UB,time:'06:55',driver:'MK'},
  {id:crypto.randomUUID(),p:'E',from:LOC.UB,to:LOC.ST,time:'08:15',driver:'MK'},
  {id:crypto.randomUUID(),p:'R',from:LOC.H,to:LOC.UB,time:'07:20',driver:'CY'},
  {id:crypto.randomUUID(),p:'J + R',from:LOC.UB,to:LOC.ST,time:'08:50',driver:'MK'},
  {id:crypto.randomUUID(),p:'JO',from:LOC.H,to:LOC.UB,time:'08:10',driver:'CY'},
  {id:crypto.randomUUID(),p:'M',from:LOC.H,to:LOC.UB,time:'08:45',driver:'CY'},
  {id:crypto.randomUUID(),p:'M + JO',from:LOC.UB,to:LOC.ST,time:'09:35',driver:'CY'}
]}}
function schedule(iso=app.currentDate){if(!app.schedules[iso]) app.schedules[iso]=iso===todayISO()?sampleSchedule():blankSchedule();return app.schedules[iso]}
function tripMins(j){if(j.from===LOC.H&&j.to===LOC.UB)return app.settings.minsHU;if(j.from===LOC.UB&&j.to===LOC.ST)return app.settings.minsUS;return 15}
function endMin(j){return toMin(j.time)+tripMins(j)}
function endTime(j){return toTime(endMin(j))}
function overlaps(a,b){return toMin(a.time)<endMin(b)&&toMin(b.time)<endMin(a)}
function otherDriver(d){return d==='MK'?'CY':'MK'}
function isFree(driver,trip,ignoreId){return !schedule().journeys.some(j=>j.driver===driver&&j.id!==ignoreId&&overlaps(j,trip))}
function findConflicts(){const out=[];for(const d of ['MK','CY']){const js=schedule().journeys.filter(j=>j.driver===d);for(let i=0;i<js.length;i++)for(let k=i+1;k<js.length;k++)if(overlaps(js[i],js[k]))out.push([js[i],js[k],d])}return out}
function setDate(iso){app.currentDate=iso;render()}
function cloneTodayToCurrent(){const source=schedule(todayISO());app.schedules[app.currentDate]={journeys:source.journeys.map(j=>({...j,id:crypto.randomUUID()}))};render()}
function moveTrip(id,driver){schedule().journeys=schedule().journeys.map(j=>j.id===id?{...j,driver}:j);render(id)}
window.moveTrip=moveTrip;

function render(focusId=null){
  const s=schedule();
  $('dateTitle').textContent=niceDate(app.currentDate);
  const today=todayISO();
  $('scheduleStatus').textContent=app.currentDate===today?'🟢 LIVE TODAY':app.currentDate>today?'🟡 DRAFT':'🔒 PAST DAY';
  const conflicts=findConflicts(); const bad=new Set(); conflicts.forEach(([a,b])=>{bad.add(a.id);bad.add(b.id)});
  for(const d of ['MK','CY']){
    const list=$(d==='MK'?'mkList':'cyList'); list.innerHTML='';
    s.journeys.filter(j=>j.driver===d).sort((a,b)=>toMin(a.time)-toMin(b.time)).forEach(j=>{
      const btn=document.createElement('button'); btn.id='trip-'+j.id; btn.className='journey '+(bad.has(j.id)?'conflict ':'')+(j.id===focusId?'new-conflict ':'');
      btn.innerHTML=`<div class="time">${j.time}</div><div><div class="route">${j.from} → ${j.to}</div><div class="arrive">Arrive ${endTime(j)}</div></div><div class="bubble">${j.p}</div>`;
      btn.onclick=()=>openJourney(j); list.appendChild(btn);
    })
  }
  $('mkStatus').textContent=conflicts.some(c=>c[2]==='MK')?'Conflict 🔴':'Available ✅';
  $('cyStatus').textContent=conflicts.some(c=>c[2]==='CY')?'Conflict 🔴':'Available ✅';
  const warning=$('warning'); warning.classList.toggle('hidden',conflicts.length===0);
  if(conflicts.length){
    const [a,b,d]=conflicts[0]; const newer=focusId&&[a.id,b.id].includes(focusId)?s.journeys.find(j=>j.id===focusId):b; const old=newer.id===a.id?b:a; const alt=otherDriver(newer.driver); const can=isFree(alt,newer,newer.id);
    warning.innerHTML=`🔴 <b>Conflict</b><br>${newer.driver} is double-booked.<br><br>Existing: <b>${old.p}</b> ${old.from} → ${old.to}, ${old.time}–${endTime(old)}<br>Clashing: <b>${newer.p}</b> ${newer.from} → ${newer.to}, ${newer.time}–${endTime(newer)}<br><br>${can?`✅ Fix: <button onclick="moveTrip('${newer.id}','${alt}')">Move ${newer.p} to ${alt}</button>`:'No escort is free at this time.'}`;
    setTimeout(()=>document.getElementById('trip-'+old.id)?.scrollIntoView({behavior:'smooth',block:'center'}),80);
  }
  save();
}

function openJourney(j=null,driver='MK'){$('journeyDialog').showModal();$('dialogTitle').textContent=j?'Edit Journey':'Add Journey';$('journeyId').value=j?.id||'';$('passengers').value=j?.p||'';$('fromLoc').value=j?.from||LOC.H;$('toLoc').value=j?.to||LOC.UB;$('leaveTime').value=j?.time||'09:00';$('driver').value=j?.driver||driver;$('deleteJourney').classList.toggle('hidden',!j)}
$('journeyForm').addEventListener('submit',e=>{e.preventDefault();const id=$('journeyId').value;const j={id:id||crypto.randomUUID(),p:$('passengers').value,from:$('fromLoc').value,to:$('toLoc').value,time:$('leaveTime').value,driver:$('driver').value};const s=schedule();s.journeys=id?s.journeys.map(x=>x.id===id?j:x):[...s.journeys,j];$('journeyDialog').close();render(j.id)});
$('deleteJourney').onclick=()=>{schedule().journeys=schedule().journeys.filter(j=>j.id!==$('journeyId').value);$('journeyDialog').close();render()};
$('prevDay').onclick=()=>setDate(addDays(app.currentDate,-1));$('nextDay').onclick=()=>setDate(addDays(app.currentDate,1));$('todayBtn').onclick=()=>setDate(todayISO());$('tomorrowBtn').onclick=()=>setDate(addDays(todayISO(),1));$('copyTodayBtn').onclick=()=>{if(app.currentDate===todayISO())return alert('Choose tomorrow or another day first.'); if(confirm('Copy today’s schedule to this day?'))cloneTodayToCurrent()};$('addJourneyBtn').onclick=()=>openJourney();document.querySelectorAll('.add-driver').forEach(b=>b.onclick=()=>openJourney(null,b.dataset.driver));$('settingsBtn').onclick=()=>{$('minsHU').value=app.settings.minsHU;$('minsUS').value=app.settings.minsUS;$('settingsDialog').showModal()};$('settingsForm').addEventListener('submit',e=>{e.preventDefault();app.settings.minsHU=Number($('minsHU').value)||15;app.settings.minsUS=Number($('minsUS').value)||15;$('settingsDialog').close();render()});
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
