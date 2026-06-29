const KEY='tc_v31';
const todayKey=()=>new Date().toISOString().slice(0,10);
const id=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
const defaults={
  places:['Home','Unit Base','SET'],
  drivers:['MK','CY'],
  routeTimes:{'Home|||Unit Base':15,'Unit Base|||SET':15},
  schedules:{}
};
function sample(){return[
 {id:id(),p:'E',from:'Home',to:'Unit Base',time:'06:55',driver:'MK'},
 {id:id(),p:'JOS',from:'Home',to:'Unit Base',time:'08:10',driver:'MK'},
 {id:id(),p:'M',from:'Home',to:'Unit Base',time:'08:45',driver:'MK'},
 {id:id(),p:'M & JOS',from:'Unit Base',to:'SET',time:'09:35',driver:'MK'},
 {id:id(),p:'ROS',from:'Home',to:'Unit Base',time:'07:20',driver:'CY'},
 {id:id(),p:'JB',from:'Home',to:'Unit Base',time:'07:50',driver:'CY'},
 {id:id(),p:'E',from:'Unit Base',to:'SET',time:'08:15',driver:'CY'},
 {id:id(),p:'JB & ROS',from:'Unit Base',to:'SET',time:'08:50',driver:'CY'}
]}
let state=JSON.parse(localStorage.getItem(KEY)||'null')||defaults;
if(!state.schedules[todayKey()]) state.schedules[todayKey()]=sample();
let currentDate=todayKey(), focusId=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function rk(a,b){return `${a}|||${b}`}
function mins(a,b){return Number(state.routeTimes[rk(a,b)]||15)}
function toMin(t){let [h,m]=t.split(':').map(Number);return h*60+m}
function toTime(m){m=(m+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function end(j){return toMin(j.time)+mins(j.from,j.to)}
function overlap(a,b){return toMin(a.time)<end(b)&&toMin(b.time)<end(a)}
function day(){return state.schedules[currentDate]||(state.schedules[currentDate]=[])}
function conflictList(){let out=[];for(const d of state.drivers){let js=day().filter(j=>j.driver===d);for(let i=0;i<js.length;i++)for(let k=i+1;k<js.length;k++)if(overlap(js[i],js[k]))out.push([js[i],js[k],d])}return out}
function freeDrivers(trip,ignore){return state.drivers.filter(d=>!day().some(j=>j.id!==ignore&&j.driver===d&&overlap(j,{...trip,driver:d})))}
function opts(sel,arr,val){sel.innerHTML=arr.map(x=>`<option ${x===val?'selected':''}>${x}</option>`).join('')}
function render(){
 $('#datePick').value=currentDate; $('#subtitle').textContent=`${currentDate} • pickup points and destinations are editable`;
 const bad=new Set(); const conflicts=conflictList(); conflicts.forEach(([a,b])=>{bad.add(a.id);bad.add(b.id)});
 const wrap=$('#drivers'); wrap.innerHTML='';
 for(const d of state.drivers){
   const trips=day().filter(j=>j.driver===d).sort((a,b)=>toMin(a.time)-toMin(b.time));
   const card=document.createElement('section'); card.className='driver';
   const has=trips.some(j=>bad.has(j.id));
   card.innerHTML=`<div class="driverHead"><h2>🚗 ${d}</h2><span class="status ${has?'bad':''}">${has?'Conflict 🔴':'Available ✅'}</span></div>`;
   trips.forEach(j=>{const b=document.createElement('button'); b.className=`journey ${bad.has(j.id)?'conflict':''} ${j.id===focusId?'focus':''}`; b.innerHTML=`<div class="time">${j.time}</div><div><div class="route">${j.from} → ${j.to}</div><div class="arrive">Arrive ${toTime(end(j))} • ${mins(j.from,j.to)} mins</div></div><div class="bubble">${j.p}</div>`; b.onclick=()=>openJourney(j); card.appendChild(b)});
   wrap.appendChild(card);
 }
 const w=$('#warning'); w.classList.toggle('hidden',!conflicts.length);
 if(conflicts.length){const [a,b,d]=conflicts[0]; const newest=focusId&&(a.id===focusId||b.id===focusId)?day().find(j=>j.id===focusId):b; const old=newest.id===a.id?b:a; const free=freeDrivers(newest,newest.id).filter(x=>x!==newest.driver); w.innerHTML=`🔴 <b>Conflict</b><br>${d} is already booked.<br><br>Clash 1: <b>${old.p}</b> ${old.from} → ${old.to}, ${old.time}–${toTime(end(old))}<br>Clash 2: <b>${newest.p}</b> ${newest.from} → ${newest.to}, ${newest.time}–${toTime(end(newest))}<br>${free[0]?`<br>✅ Fix available: <button onclick="moveTrip('${newest.id}','${free[0]}')">Move ${newest.p} to ${free[0]}</button>`:'<br>No other driver is free at this time.'}`;}
 save();
}
function moveTrip(jid,d){const j=day().find(x=>x.id===jid); if(j)j.driver=d; focusId=jid; render()}
function openJourney(j){$('#journeyDlg').showModal(); $('#journeyId').value=j?.id||''; $('#passenger').value=j?.p||''; opts($('#from'),state.places,j?.from||state.places[0]); opts($('#to'),state.places,j?.to||state.places[Math.min(1,state.places.length-1)]); opts($('#driver'),state.drivers,j?.driver||state.drivers[0]); $('#time').value=j?.time||'09:00'; $('#deleteJourney').classList.toggle('hidden',!j); routeHint();}
function routeHint(){const a=$('#from').value,b=$('#to').value; $('#routeHint').textContent=`Travel time: ${mins(a,b)} minutes. Change this in Settings → Travel Times.`}
['from','to'].forEach(x=>$('#'+x).addEventListener('change',routeHint));
$('#journeyForm').onsubmit=e=>{e.preventDefault(); const jid=$('#journeyId').value; const j={id:jid||id(),p:$('#passenger').value,from:$('#from').value,to:$('#to').value,time:$('#time').value,driver:$('#driver').value}; if(jid){const i=day().findIndex(x=>x.id===jid); day()[i]=j}else day().push(j); focusId=j.id; $('#journeyDlg').close(); render()};
$('#deleteJourney').onclick=()=>{state.schedules[currentDate]=day().filter(j=>j.id!==$('#journeyId').value); $('#journeyDlg').close(); render()};
$('#addJourneyBtn').onclick=()=>openJourney();
$('#datePick').onchange=e=>{currentDate=e.target.value; focusId=null; render()};
$('#clearBtn').onclick=()=>{if(confirm('Clear this day?')){state.schedules[currentDate]=[];render()}};
$('#copyBtn').onclick=()=>{const src=state.schedules[todayKey()]||[]; state.schedules[currentDate]=src.map(j=>({...j,id:id()})); render()};
$('#settingsBtn').onclick=()=>{renderSettings();$('#settingsDlg').showModal()};
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$$('.tabPanel').forEach(p=>p.classList.add('hidden'));$('#'+t.dataset.tab).classList.remove('hidden')});
function renderSettings(){
 $('#places').innerHTML=`<h3>Pickup points & destinations</h3><div class="addLine"><input id="newPlace" placeholder="New place, e.g. Hotel"><button type="button" onclick="addPlace()">Add Place</button></div>`+state.places.map((p,i)=>`<div class="row"><input value="${p}" onchange="renamePlace(${i},this.value)"><button type="button" class="small danger" onclick="delPlace(${i})">Delete</button></div>`).join('');
 $('#routes').innerHTML=`<h3>Travel Times</h3><p class="hint">Add times for the routes you use. If a route is missing, the app uses 15 minutes.</p><div class="row row3"><select id="rFrom">${state.places.map(p=>`<option>${p}</option>`).join('')}</select><select id="rTo">${state.places.map(p=>`<option>${p}</option>`).join('')}</select><input id="rMin" type="number" value="15" min="1"><button type="button" onclick="addRoute()">Save Route</button></div>`+Object.entries(state.routeTimes).map(([k,v])=>{let [a,b]=k.split('|||');return`<div class="row row3"><b>${a} → ${b}</b><span>${v} mins</span><span></span><button type="button" class="small danger" onclick="delRoute('${k}')">Delete</button></div>`}).join('');
 $('#driversTab').innerHTML=`<h3>Drivers, up to 5</h3><div class="addLine"><input id="newDriver" placeholder="New driver"><button type="button" onclick="addDriver()">Add Driver</button></div>`+state.drivers.map((d,i)=>`<div class="row"><input value="${d}" onchange="renameDriver(${i},this.value)"><button type="button" class="small danger" onclick="delDriver(${i})">Delete</button></div>`).join('');
}
function addPlace(){const v=$('#newPlace').value.trim(); if(v&&!state.places.includes(v)){state.places.push(v);renderSettings();render()}}
function renamePlace(i,v){const old=state.places[i]; v=v.trim(); if(!v)return; state.places[i]=v; for(const sch of Object.values(state.schedules))sch.forEach(j=>{if(j.from===old)j.from=v;if(j.to===old)j.to=v}); const next={}; for(const [k,m] of Object.entries(state.routeTimes)){let [a,b]=k.split('|||'); if(a===old)a=v;if(b===old)b=v; next[rk(a,b)]=m} state.routeTimes=next; renderSettings();render()}
function delPlace(i){if(state.places.length<=2)return alert('Keep at least two places.'); const p=state.places[i]; if(confirm('Delete '+p+'?')){state.places.splice(i,1); for(const k of Object.keys(state.routeTimes))if(k.includes(p+'|||')||k.includes('|||'+p))delete state.routeTimes[k]; renderSettings();render()}}
function addRoute(){state.routeTimes[rk($('#rFrom').value,$('#rTo').value)]=Number($('#rMin').value)||15;renderSettings();render()}
function delRoute(k){delete state.routeTimes[k];renderSettings();render()}
function addDriver(){const v=$('#newDriver').value.trim(); if(state.drivers.length>=5)return alert('Maximum 5 drivers.'); if(v&&!state.drivers.includes(v)){state.drivers.push(v);renderSettings();render()}}
function renameDriver(i,v){const old=state.drivers[i]; v=v.trim(); if(!v)return; state.drivers[i]=v; for(const sch of Object.values(state.schedules))sch.forEach(j=>{if(j.driver===old)j.driver=v}); renderSettings();render()}
function delDriver(i){if(state.drivers.length<=1)return alert('Keep at least one driver.'); const d=state.drivers[i]; if(day().some(j=>j.driver===d)&&!confirm('This driver has journeys today. Delete anyway?'))return; state.drivers.splice(i,1); renderSettings();render()}
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
