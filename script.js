const STORE='makb-transpo-v2-clean';
const defaultState={
  travel:{HUB:15,UBST:15},
  drivers:[{id:id(),name:'MK'},{id:id(),name:'CY'}],
  selectedDate:todayKey(),
  schedules:{}
};
function id(){return Math.random().toString(36).slice(2,10)}
function todayKey(){return new Date().toISOString().slice(0,10)}
function clone(x){return JSON.parse(JSON.stringify(x))}
let state=JSON.parse(localStorage.getItem(STORE)||'null')||clone(defaultState);
if(!state.schedules[todayKey()]) state.schedules[todayKey()]=sampleJourneys();
const $=s=>document.querySelector(s);
const driversGrid=$('#driversGrid'), warning=$('#warning');
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function schedule(){return state.schedules[state.selectedDate] ||= []}
function min(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function time(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function dur(j){if(j.from==='H'&&j.to==='UB')return Number(state.travel.HUB)||15;if(j.from==='UB'&&j.to==='ST')return Number(state.travel.UBST)||15;return 15}
function end(j){return min(j.time)+dur(j)}
function label(loc){return ({H:'Home',UB:'Unit Base',ST:'SET'}[loc]||loc)}
function route(j){return `${label(j.from)} → ${label(j.to)}`}
function overlaps(a,b){return min(a.time)<end(b)&&min(b.time)<end(a)}
function sampleJourneys(){const mk='mk', cy='cy';return []}
function ensureOldIds(){if(state.drivers.length&&state.drivers[0].id!=='mk'){state.drivers[0].id='mk'}if(state.drivers.length>1&&state.drivers[1].id!=='cy'){state.drivers[1].id='cy'}}
ensureOldIds();
if(schedule().length===0 && state.selectedDate===todayKey()){
 state.schedules[state.selectedDate]=[
  {id:id(),p:'E',from:'H',to:'UB',time:'06:55',driver:'mk'},
  {id:id(),p:'JOS',from:'H',to:'UB',time:'08:10',driver:'mk'},
  {id:id(),p:'M',from:'H',to:'UB',time:'08:45',driver:'mk'},
  {id:id(),p:'M & JOS',from:'UB',to:'ST',time:'09:35',driver:'mk'},
  {id:id(),p:'ROS',from:'H',to:'UB',time:'07:20',driver:'cy'},
  {id:id(),p:'JB',from:'H',to:'UB',time:'07:50',driver:'cy'},
  {id:id(),p:'E',from:'UB',to:'ST',time:'08:15',driver:'cy'},
  {id:id(),p:'JB & ROS',from:'UB',to:'ST',time:'08:50',driver:'cy'}
 ];
}
function conflicts(){const out=[];for(const d of state.drivers){const js=schedule().filter(j=>j.driver===d.id);for(let i=0;i<js.length;i++)for(let k=i+1;k<js.length;k++)if(overlaps(js[i],js[k]))out.push({a:js[i],b:js[k],driver:d});}return out}
function isFree(driverId,trip,ignore){return !schedule().some(j=>j.driver===driverId&&j.id!==ignore&&overlaps(j,trip))}
function render(focusId=null){
 const bad=new Set(); const cs=conflicts(); cs.forEach(c=>{bad.add(c.a.id);bad.add(c.b.id)});
 driversGrid.innerHTML='';
 state.drivers.forEach(d=>{
  const card=document.createElement('section');card.className='driver-card';
  const hasBad=schedule().some(j=>j.driver===d.id&&bad.has(j.id));
  card.innerHTML=`<div class="driver-head"><div class="driver-title">🚗 ${d.name}</div><div class="status ${hasBad?'bad':''}">${hasBad?'Conflict 🔴':'Available ✅'}</div></div><div class="list"></div>`;
  const list=card.querySelector('.list');
  schedule().filter(j=>j.driver===d.id).sort((a,b)=>min(a.time)-min(b.time)).forEach(j=>{
   const btn=document.createElement('button');btn.className=`journey ${bad.has(j.id)?'conflict':''} ${j.id===focusId?'focus':''}`;btn.id='trip-'+j.id;
   btn.innerHTML=`<div class="time">${j.time}</div><div><div class="route">${route(j)}</div><div class="arrive">Arrive ${time(end(j))}</div></div><div class="bubble">${j.p}</div>`;
   btn.onclick=()=>openJourney(j); list.appendChild(btn);
  });
  driversGrid.appendChild(card);
 });
 renderWarning(cs,focusId); save();
}
function renderWarning(cs,focusId){
 if(!cs.length){warning.classList.add('hidden');warning.innerHTML='';return}
 const c=cs[0]; const newer=focusId==c.a.id?c.a:focusId==c.b.id?c.b:c.b; const old=newer.id===c.a.id?c.b:c.a;
 const alternatives=state.drivers.filter(d=>d.id!==newer.driver&&isFree(d.id,newer,newer.id));
 warning.classList.remove('hidden');
 warning.innerHTML=`🔴 <b>Conflict</b><br>${c.driver.name} is double booked.<br><br>Clash 1: <b>${old.p}</b> ${route(old)} ${old.time}–${time(end(old))}<br>Clash 2: <b>${newer.p}</b> ${route(newer)} ${newer.time}–${time(end(newer))}<br>${alternatives.length?`<button data-move="${alternatives[0].id}">Move ${newer.p} to ${alternatives[0].name}</button>`:'<br>No other driver is free at this time.'}`;
 const mv=warning.querySelector('[data-move]'); if(mv) mv.onclick=()=>{newer.driver=mv.dataset.move;render(newer.id)};
 setTimeout(()=>document.getElementById('trip-'+old.id)?.scrollIntoView({behavior:'smooth',block:'center'}),80);
}
function fillDriverSelect(){const sel=$('#driverInput');sel.innerHTML=state.drivers.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
function openJourney(j){fillDriverSelect();$('#journeyTitle').textContent=j?'Edit Journey':'Add Journey';$('#journeyId').value=j?.id||'';$('#passengerInput').value=j?.p||'';$('#fromInput').value=j?.from||'H';$('#toInput').value=j?.to||'UB';$('#timeInput').value=j?.time||'09:00';$('#driverInput').value=j?.driver||state.drivers[0].id;$('#deleteJourneyBtn').classList.toggle('hidden',!j);journeyDialog.showModal()}
$('#journeyForm').onsubmit=e=>{e.preventDefault();const existing=$('#journeyId').value;const j={id:existing||id(),p:$('#passengerInput').value.trim(),from:$('#fromInput').value,to:$('#toInput').value,time:$('#timeInput').value,driver:$('#driverInput').value};if(existing){const i=schedule().findIndex(x=>x.id===existing);schedule()[i]=j}else schedule().push(j);journeyDialog.close();render(j.id)};
$('#deleteJourneyBtn').onclick=()=>{state.schedules[state.selectedDate]=schedule().filter(j=>j.id!==$('#journeyId').value);journeyDialog.close();render()};
$('#addJourneyBtn').onclick=()=>openJourney();
$('#settingsBtn').onclick=()=>{renderSettings();settingsDialog.showModal()};
function renderSettings(){ $('#timeHUB').value=state.travel.HUB; $('#timeUBST').value=state.travel.UBST; const box=$('#driversSettings'); box.innerHTML=''; state.drivers.forEach((d,i)=>{const row=document.createElement('div');row.className='driver-setting';row.innerHTML=`<label>Driver ${i+1}<input data-driver-name="${d.id}" value="${d.name}"></label><button type="button" data-del="${d.id}" ${state.drivers.length<=1?'disabled':''}>Delete</button>`;box.appendChild(row)});box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('Delete this driver? Journeys stay but will need another driver.')){state.drivers=state.drivers.filter(d=>d.id!==b.dataset.del);schedule().forEach(j=>{if(j.driver===b.dataset.del)j.driver=state.drivers[0].id});renderSettings()}})}
$('#addDriverBtn').onclick=()=>{if(state.drivers.length>=5){alert('Maximum 5 drivers');return}state.drivers.push({id:id(),name:'Driver '+(state.drivers.length+1)});renderSettings()};
$('#settingsForm').onsubmit=e=>{e.preventDefault();state.travel.HUB=Number($('#timeHUB').value)||15;state.travel.UBST=Number($('#timeUBST').value)||15;document.querySelectorAll('[data-driver-name]').forEach(inp=>{const d=state.drivers.find(x=>x.id===inp.dataset.driverName);if(d)d.name=inp.value.trim()||d.name});settingsDialog.close();render()};
$('#clearBtn').onclick=()=>{if(confirm('Clear this day?')){state.schedules[state.selectedDate]=[];render()}};
$('#copyBtn').onclick=()=>{state.schedules[state.selectedDate]=clone(state.schedules[todayKey()]||[]).map(j=>({...j,id:id()}));render()};
$('#todayBtn').onclick=()=>{state.selectedDate=todayKey();render()};
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
