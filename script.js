const STORAGE_KEY='makb-transpo-v2';
const DRIVERS=['MK','CY'];
const LOC_LABELS={H:'Home',UB:'Unit Base',ST:'SET'};
const DEFAULTS=[
  {p:'E',from:'H',to:'UB',time:'06:55',driver:'MK'},
  {p:'E',from:'UB',to:'ST',time:'08:15',driver:'MK'},
  {p:'R',from:'H',to:'UB',time:'07:20',driver:'CY'},
  {p:'JO',from:'H',to:'UB',time:'08:10',driver:'CY'},
  {p:'J+R',from:'UB',to:'ST',time:'08:50',driver:'MK'},
  {p:'M',from:'H',to:'UB',time:'08:45',driver:'CY'},
  {p:'M+JO',from:'UB',to:'ST',time:'09:35',driver:'CY'}
];
let data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
let selectedDate=isoDate(new Date());
const $=id=>document.getElementById(id);
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function isoDate(d){return d.toISOString().slice(0,10)}
function addDays(date,n){let d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return isoDate(d)}
function pretty(date){return new Date(date+'T12:00:00').toLocaleDateString('en-IE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function today(){return isoDate(new Date())}
function ensureDay(date){if(!data[date]) data[date]={journeys:date===today()?DEFAULTS.map(j=>({...j,id:uid()})):[]};return data[date]}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function toMin(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function toTime(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function duration(j){return (j.from==='H'&&j.to==='UB')||(j.from==='UB'&&j.to==='H')?15:15}
function endMin(j){return toMin(j.time)+duration(j)}
function endTime(j){return toTime(endMin(j))}
function overlaps(a,b){return toMin(a.time)<endMin(b)&&toMin(b.time)<endMin(a)}
function otherDriver(d){return d==='MK'?'CY':'MK'}
function isFree(driver,trip,ignoreId=null){return !ensureDay(selectedDate).journeys.some(j=>j.driver===driver&&j.id!==ignoreId&&overlaps(j,trip))}
function conflicts(){let list=[];let js=ensureDay(selectedDate).journeys;for(const d of DRIVERS){let mine=js.filter(j=>j.driver===d);for(let i=0;i<mine.length;i++)for(let k=i+1;k<mine.length;k++)if(overlaps(mine[i],mine[k]))list.push({a:mine[i],b:mine[k],driver:d});}return list}
function routeText(j){return `${LOC_LABELS[j.from]} → ${LOC_LABELS[j.to]}`}
function render(focusId=null){let day=ensureDay(selectedDate);$('dateLabel').textContent=pretty(selectedDate);let diff=(new Date(selectedDate)-new Date(today()))/86400000;$('modeLabel').textContent=selectedDate===today()?'🟢 LIVE TODAY':diff>0?'🟡 DRAFT DAY':'🔒 PAST DAY';let cs=conflicts();let bad=new Set();cs.forEach(c=>{bad.add(c.a.id);bad.add(c.b.id)});for(const d of DRIVERS){let el=$(d==='MK'?'mkList':'cyList');el.innerHTML='';day.journeys.filter(j=>j.driver===d).sort((a,b)=>toMin(a.time)-toMin(b.time)).forEach(j=>{let b=document.createElement('button');b.id='trip-'+j.id;b.className='journey '+(bad.has(j.id)?'conflict ':'')+(j.id===focusId?'new-conflict ':'');b.innerHTML=`<div class="time">${j.time}</div><div><div class="route">${routeText(j)}</div><div class="arrive">Arrive ${endTime(j)}</div></div><div class="bubble">${j.p}</div>`;b.onclick=()=>openJourney(j);el.appendChild(b)});let status=$(d==='MK'?'mkStatus':'cyStatus');let dBad=cs.some(c=>c.driver===d);status.textContent=dBad?'Conflict 🔴':'Available ✅';status.className=dBad?'conflict-status':''}
let warning=$('warning');if(!cs.length){warning.classList.add('hidden');warning.innerHTML=''}else{let c=cs[0];let newer=focusId&&(c.a.id===focusId||c.b.id===focusId)?day.journeys.find(j=>j.id===focusId):c.b;let old=newer.id===c.a.id?c.b:c.a;let alt=otherDriver(newer.driver);let canMove=isFree(alt,newer,newer.id);warning.classList.remove('hidden');warning.innerHTML=`🔴 <b>Conflict</b><br>${newer.driver} is already booked.<br><br><b>Clash 1:</b> ${old.p} — ${routeText(old)} — ${old.time}–${endTime(old)}<br><b>Clash 2:</b> ${newer.p} — ${routeText(newer)} — ${newer.time}–${endTime(newer)}<br>${canMove?`<button onclick="moveTrip('${newer.id}','${alt}')">Move ${newer.p} to ${alt}</button>`:'<br>No escort free at this time.'}`;setTimeout(()=>document.getElementById('trip-'+old.id)?.scrollIntoView({behavior:'smooth',block:'center'}),80)}save()}
function openJourney(j=null){$('journeyDialog').showModal();$('dialogTitle').textContent=j?'Edit Journey':'Add Journey';$('journeyId').value=j?.id||'';$('passengers').value=j?.p||'';$('fromLoc').value=j?.from||'H';$('toLoc').value=j?.to||'UB';$('leaveTime').value=j?.time||'09:00';$('driver').value=j?.driver||'MK';$('deleteJourney').classList.toggle('hidden',!j)}
function moveTrip(id,driver){let day=ensureDay(selectedDate);day.journeys=day.journeys.map(j=>j.id===id?{...j,driver}:j);render(id)}
$('journeyForm').addEventListener('submit',e=>{e.preventDefault();let id=$('journeyId').value;let j={id:id||uid(),p:$('passengers').value.trim(),from:$('fromLoc').value,to:$('toLoc').value,time:$('leaveTime').value,driver:$('driver').value};let day=ensureDay(selectedDate);day.journeys=id?day.journeys.map(x=>x.id===id?j:x):[...day.journeys,j];$('journeyDialog').close();render(j.id)});
$('cancelDialog').onclick=()=>$('journeyDialog').close();$('deleteJourney').onclick=()=>{let id=$('journeyId').value;let day=ensureDay(selectedDate);day.journeys=day.journeys.filter(j=>j.id!==id);$('journeyDialog').close();render()};$('addJourney').onclick=()=>openJourney();$('prevDay').onclick=()=>{selectedDate=addDays(selectedDate,-1);render()};$('nextDay').onclick=()=>{selectedDate=addDays(selectedDate,1);render()};$('todayBtn').onclick=()=>{selectedDate=today();render()};$('copyToday').onclick=()=>{if(selectedDate===today())return alert('You are already on today. Go to tomorrow first.');let source=ensureDay(today()).journeys;if(!source.length)return alert('Today has no journeys to copy.');if(confirm('Copy today into this date? This replaces this date only.')){data[selectedDate]={journeys:source.map(j=>({...j,id:uid()}))};render()}};$('clearDay').onclick=()=>{if(confirm('Clear this date only?')){ensureDay(selectedDate).journeys=[];render()}};if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});render();
