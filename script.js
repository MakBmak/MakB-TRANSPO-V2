const STORAGE_KEY='makb-transpo-v21';
const LOC_LABELS={H:'Home',UB:'Unit Base',ST:'SET'};
const DEFAULTS=[
 {p:'E',from:'H',to:'UB',time:'06:55',driver:'MK'},
 {p:'R',from:'H',to:'UB',time:'07:20',driver:'CY'},
 {p:'JB',from:'H',to:'UB',time:'07:50',driver:'CY'},
 {p:'JOS',from:'H',to:'UB',time:'08:10',driver:'MK'},
 {p:'E',from:'UB',to:'ST',time:'08:15',driver:'CY'},
 {p:'M',from:'H',to:'UB',time:'08:45',driver:'MK'},
 {p:'JB & ROS',from:'UB',to:'ST',time:'08:50',driver:'CY'},
 {p:'M & JOS',from:'UB',to:'ST',time:'09:35',driver:'MK'}
];
let data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{settings:{drivers:['MK','CY'],times:{HUB:15,UBST:15}},days:{}};
if(!data.settings)data.settings={drivers:['MK','CY'],times:{HUB:15,UBST:15}};
if(!data.settings.drivers)data.settings.drivers=['MK','CY'];
if(!data.settings.times)data.settings.times={HUB:15,UBST:15};
if(!data.days)data.days={};
let selectedDate=isoDate(new Date());
let settingsDraft=[];
const $=id=>document.getElementById(id);
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function isoDate(d){return d.toISOString().slice(0,10)}
function addDays(date,n){let d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return isoDate(d)}
function pretty(date){return new Date(date+'T12:00:00').toLocaleDateString('en-IE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function today(){return isoDate(new Date())}
function ensureDay(date){if(!data.days[date]) data.days[date]={journeys:date===today()?DEFAULTS.map(j=>({...j,id:uid()})):[]};return data.days[date]}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function toMin(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function toTime(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function duration(j){
  if((j.from==='H'&&j.to==='UB')||(j.from==='UB'&&j.to==='H')) return Number(data.settings.times.HUB)||15;
  if((j.from==='UB'&&j.to==='ST')||(j.from==='ST'&&j.to==='UB')) return Number(data.settings.times.UBST)||15;
  return (Number(data.settings.times.HUB)||15)+(Number(data.settings.times.UBST)||15);
}
function endMin(j){return toMin(j.time)+duration(j)}
function endTime(j){return toTime(endMin(j))}
function overlaps(a,b){return toMin(a.time)<endMin(b)&&toMin(b.time)<endMin(a)}
function routeText(j){return `${LOC_LABELS[j.from]} → ${LOC_LABELS[j.to]}`}
function otherDrivers(driver){return data.settings.drivers.filter(d=>d!==driver)}
function isFree(driver,trip,ignoreId=null){return !ensureDay(selectedDate).journeys.some(j=>j.driver===driver&&j.id!==ignoreId&&overlaps(j,trip))}
function conflicts(){let list=[];let js=ensureDay(selectedDate).journeys;for(const d of data.settings.drivers){let mine=js.filter(j=>j.driver===d);for(let i=0;i<mine.length;i++){for(let k=i+1;k<mine.length;k++){if(overlaps(mine[i],mine[k]))list.push({a:mine[i],b:mine[k],driver:d})}}}return list}
function fillDriverSelect(){let s=$('driver');s.innerHTML='';data.settings.drivers.forEach(d=>{let o=document.createElement('option');o.value=d;o.textContent=d;s.appendChild(o)})}
function render(focusId=null){
  const day=ensureDay(selectedDate);$('dateLabel').textContent=pretty(selectedDate);let diff=(toMin('12:00')&&((new Date(selectedDate)-new Date(today()))/86400000));$('modeLabel').textContent=selectedDate===today()?'LIVE TODAY':diff>0?'DRAFT DAY':'PAST DAY';
  const cs=conflicts();const bad=new Set();cs.forEach(c=>{bad.add(c.a.id);bad.add(c.b.id)});
  const grid=$('driverGrid');grid.innerHTML='';
  data.settings.drivers.forEach(driver=>{
    const card=document.createElement('section');card.className='driver-card';
    const dBad=cs.some(c=>c.driver===driver);
    card.innerHTML=`<div class="driver-title"><span>🚗 ${driver}</span><span class="${dBad?'conflict-status':''}">${dBad?'Conflict 🔴':'Available ✅'}</span></div><div class="journey-list" id="list-${driver}"></div>`;
    grid.appendChild(card);
    const list=card.querySelector('.journey-list');
    day.journeys.filter(j=>j.driver===driver).sort((a,b)=>toMin(a.time)-toMin(b.time)).forEach(j=>{
      const b=document.createElement('button');b.id='trip-'+j.id;b.className='journey '+(bad.has(j.id)?'conflict ':'')+(j.id===focusId?'new-conflict ':'');
      b.innerHTML=`<div class="time">${j.time}</div><div><div class="route">${routeText(j)}</div><div class="arrive">Arrive ${endTime(j)}</div></div><div class="bubble">${j.p}</div>`;
      b.onclick=()=>openJourney(j);list.appendChild(b);
    });
  });
  const warning=$('warning');
  if(!cs.length){warning.classList.add('hidden');warning.innerHTML=''} else {
    const c=cs[0];const newer=focusId&&(c.a.id===focusId||c.b.id===focusId)?day.journeys.find(j=>j.id===focusId):c.b;const old=newer.id===c.a.id?c.b:c.a;
    const freeAlt=otherDrivers(newer.driver).find(d=>isFree(d,newer,newer.id));
    warning.classList.remove('hidden');warning.innerHTML=`🔴 <b>Conflict</b><br>${newer.driver} is already booked.<br><br>Clash 1: <b>${old.p}</b> — ${routeText(old)} — ${old.time}–${endTime(old)}<br>Clash 2: <b>${newer.p}</b> — ${routeText(newer)} — ${newer.time}–${endTime(newer)}<br>${freeAlt?`<button onclick="moveTrip('${newer.id}','${freeAlt}')">Move ${newer.p} to ${freeAlt}</button>`:'<br>No escort free at this time.'}`;
    setTimeout(()=>document.getElementById('trip-'+old.id)?.scrollIntoView({behavior:'smooth',block:'center'}),80);
  }
  save();
}
function openJourney(j=null){fillDriverSelect();$('journeyDialog').showModal();$('dialogTitle').textContent=j?'Edit Journey':'Add Journey';$('journeyId').value=j?.id||'';$('passengers').value=j?.p||'';$('fromLoc').value=j?.from||'H';$('toLoc').value=j?.to||'UB';$('leaveTime').value=j?.time||'09:00';$('driver').value=j?.driver||data.settings.drivers[0];$('deleteJourney').classList.toggle('hidden',!j)}
function moveTrip(id,driver){let day=ensureDay(selectedDate);day.journeys=day.journeys.map(j=>j.id===id?{...j,driver}:j);render(id)}
function openSettings(){settingsDraft=[...data.settings.drivers];$('timeHUB').value=data.settings.times.HUB;$('timeUBST').value=data.settings.times.UBST;renderDriverSettings();$('settingsDialog').showModal()}
function renderDriverSettings(){const box=$('driverSettings');box.innerHTML='';settingsDraft.forEach((name,i)=>{const div=document.createElement('div');div.className='driver-setting';div.innerHTML=`<div><label>Driver ${i+1} name</label><input value="${name}" data-driver-index="${i}" required></div><button type="button" class="danger-light" data-remove-driver="${i}">Remove</button>`;box.appendChild(div)});box.querySelectorAll('input').forEach(inp=>inp.oninput=()=>settingsDraft[Number(inp.dataset.driverIndex)]=inp.value.trim());box.querySelectorAll('[data-remove-driver]').forEach(btn=>btn.onclick=()=>{if(settingsDraft.length<=1)return alert('You need at least one driver.');settingsDraft.splice(Number(btn.dataset.removeDriver),1);renderDriverSettings()})}
$('journeyForm').addEventListener('submit',e=>{e.preventDefault();let id=$('journeyId').value;let j={id:id||uid(),p:$('passengers').value.trim(),from:$('fromLoc').value,to:$('toLoc').value,time:$('leaveTime').value,driver:$('driver').value};let day=ensureDay(selectedDate);day.journeys=id?day.journeys.map(x=>x.id===id?j:x):[...day.journeys,j];$('journeyDialog').close();render(j.id)});
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();const oldDrivers=[...data.settings.drivers];const newDrivers=settingsDraft.map(d=>d.trim()).filter(Boolean);if(!newDrivers.length)return alert('Add at least one driver.');data.settings.times.HUB=Number($('timeHUB').value)||15;data.settings.times.UBST=Number($('timeUBST').value)||15;data.settings.drivers=[...new Set(newDrivers)];Object.values(data.days).forEach(day=>day.journeys.forEach(j=>{const idx=oldDrivers.indexOf(j.driver);if(idx>=0&&data.settings.drivers[idx])j.driver=data.settings.drivers[idx];if(!data.settings.drivers.includes(j.driver))j.driver=data.settings.drivers[0]}));$('settingsDialog').close();render()});
$('cancelDialog').onclick=()=>$('journeyDialog').close();$('deleteJourney').onclick=()=>{let id=$('journeyId').value;let day=ensureDay(selectedDate);day.journeys=day.journeys.filter(j=>j.id!==id);$('journeyDialog').close();render()};$('addJourney').onclick=()=>openJourney();$('settingsBtn').onclick=openSettings;$('cancelSettings').onclick=()=>$('settingsDialog').close();$('addDriverBtn').onclick=()=>{settingsDraft.push('NEW');renderDriverSettings()};$('prevDay').onclick=()=>{selectedDate=addDays(selectedDate,-1);render()};$('nextDay').onclick=()=>{selectedDate=addDays(selectedDate,1);render()};$('todayBtn').onclick=()=>{selectedDate=today();render()};$('copyToday').onclick=()=>{if(selectedDate===today())return alert('You are already on today. Go to tomorrow first.');let source=ensureDay(today()).journeys;if(!source.length)return alert('Today has no journeys to copy.');if(confirm('Copy today into this date? This replaces this date only.')){data.days[selectedDate]={journeys:source.map(j=>({...j,id:uid()}))};render()}};$('clearDay').onclick=()=>{if(confirm('Clear this date only?')){ensureDay(selectedDate).journeys=[];render()}};if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});render();
