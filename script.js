const STORE='transportCoordinatorColourV1';
const todayKey=()=>new Date().toISOString().slice(0,10);
const addDays=(key,n)=>{const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const fmtDate=key=>new Date(key+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
const uid=()=>crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
const $=id=>document.getElementById(id);
const defaultData={
  currentDate:todayKey(),
  drivers:[{id:'mk',name:'MK',emoji:'🚗'},{id:'cy',name:'CY',emoji:'🚙'}],
  places:['Home','Unit Base','SET'],
  routes:{'Home||Unit Base':15,'Unit Base||SET':15},
  schedules:{}
};
function sampleSchedule(){return[
{id:uid(),p:'E',from:'Home',to:'Unit Base',time:'06:55',driver:'mk'},
{id:uid(),p:'JOS',from:'Home',to:'Unit Base',time:'08:10',driver:'mk'},
{id:uid(),p:'M',from:'Home',to:'Unit Base',time:'08:45',driver:'mk'},
{id:uid(),p:'M & JOS',from:'Unit Base',to:'SET',time:'09:35',driver:'mk'},
{id:uid(),p:'ROS',from:'Home',to:'Unit Base',time:'07:20',driver:'cy'},
{id:uid(),p:'JB',from:'Home',to:'Unit Base',time:'07:50',driver:'cy'},
{id:uid(),p:'E',from:'Unit Base',to:'SET',time:'08:15',driver:'cy'},
{id:uid(),p:'JB & ROS',from:'Unit Base',to:'SET',time:'08:50',driver:'cy'}]}
let data=JSON.parse(localStorage.getItem(STORE)||'null')||defaultData;
if(!data.schedules[data.currentDate]) data.schedules[data.currentDate]=sampleSchedule();
function save(){localStorage.setItem(STORE,JSON.stringify(data))}
function mins(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function time(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function routeKey(a,b){return `${a}||${b}`}
function duration(j){return Number(data.routes[routeKey(j.from,j.to)] ?? data.routes[routeKey(j.to,j.from)] ?? 15)}
function endM(j){return mins(j.time)+duration(j)}
function overlaps(a,b){return mins(a.time)<endM(b)&&mins(b.time)<endM(a)}
function schedule(){return data.schedules[data.currentDate]||(data.schedules[data.currentDate]=[])}
function conflicts(){let out=[];for(const d of data.drivers){let js=schedule().filter(j=>j.driver===d.id);for(let i=0;i<js.length;i++)for(let k=i+1;k<js.length;k++)if(overlaps(js[i],js[k]))out.push([js[i],js[k],d]);}return out}
function driverName(id){return data.drivers.find(d=>d.id===id)?.name||id}
function canMove(j,driverId){return !schedule().some(x=>x.id!==j.id&&x.driver===driverId&&overlaps(x,j))}
function moveJourney(id,driverId){const j=schedule().find(x=>x.id===id); if(j) j.driver=driverId; render(id)}
window.moveJourney=moveJourney;
function optionList(sel,items,value){sel.innerHTML=items.map(x=>`<option ${x===value?'selected':''}>${x}</option>`).join('')}
function driverOptions(sel,value){sel.innerHTML=data.drivers.map(d=>`<option value="${d.id}" ${d.id===value?'selected':''}>${d.name}</option>`).join('')}
function render(focusId=null){
 $('dateLabel').textContent=fmtDate(data.currentDate)+(data.currentDate===todayKey()?' • LIVE':' • DRAFT');
 const bad=new Set(); const cs=conflicts(); cs.forEach(([a,b])=>{bad.add(a.id);bad.add(b.id)});
 const board=$('driversBoard'); board.innerHTML='';
 for(const d of data.drivers){
  const js=schedule().filter(j=>j.driver===d.id).sort((a,b)=>mins(a.time)-mins(b.time));
  const hasBad=js.some(j=>bad.has(j.id));
  const card=document.createElement('section'); card.className='driver-card';
  card.innerHTML=`<div class="driver-head"><div class="driver-name"><span class="car">${d.emoji||'🚗'}</span>${d.name}</div><div class="status ${hasBad?'bad':''}">${hasBad?'Conflict':'Available ✅'}</div></div><div class="journeys"></div>`;
  const list=card.querySelector('.journeys');
  if(!js.length) list.innerHTML='<div class="empty">No journeys</div>';
  for(const j of js){
   const btn=document.createElement('button'); btn.className='journey '+(bad.has(j.id)?'conflict ':'')+(j.id===focusId?'focus':''); btn.id='trip-'+j.id;
   btn.innerHTML=`<div class="journey-time">${j.time}</div><div class="route-box"><div class="place">${j.from}</div><div class="arrow">↓</div><div class="place">${j.to}</div><div class="meta">Arrive ${time(endM(j))} • ${duration(j)} mins</div></div><div class="passenger-chip">${j.p}</div>`;
   btn.onclick=()=>openJourney(j); list.appendChild(btn);
  }
  board.appendChild(card);
 }
 const warn=$('warning'); warn.classList.toggle('hidden',!cs.length);
 if(cs.length){const [a,b,d]=cs[0]; const j=focusId&&(a.id===focusId||b.id===focusId)?schedule().find(x=>x.id===focusId):b; const other=data.drivers.find(x=>x.id!==j.driver&&canMove(j,x.id)); warn.innerHTML=`🔴 <b>Conflict</b><br>${driverName(j.driver)} has overlapping journeys.<br><br><b>${a.p}</b> ${a.from} → ${a.to}, ${a.time}–${time(endM(a))}<br><b>${b.p}</b> ${b.from} → ${b.to}, ${b.time}–${time(endM(b))}<br>${other?`<button onclick="moveJourney('${j.id}','${other.id}')">Move ${j.p} to ${other.name}</button>`:'<br>No free driver found for this time.'}`}
 save();
}
function openJourney(j=null){
 $('journeyId').value=j?.id||''; $('journeyTitle').textContent=j?'Edit Journey':'Add Journey'; $('passenger').value=j?.p||''; optionList($('fromPlace'),data.places,j?.from||data.places[0]); optionList($('toPlace'),data.places,j?.to||data.places[1]||data.places[0]); $('leaveTime').value=j?.time||'09:00'; driverOptions($('driverSelect'),j?.driver||data.drivers[0].id); $('deleteJourney').classList.toggle('hidden',!j); $('journeyDialog').showModal();
}
$('addJourney').onclick=()=>openJourney();
$('journeyForm').onsubmit=e=>{e.preventDefault(); const id=$('journeyId').value||uid(); const j={id,p:$('passenger').value.trim()||'Passenger',from:$('fromPlace').value,to:$('toPlace').value,time:$('leaveTime').value,driver:$('driverSelect').value}; const s=schedule(); const i=s.findIndex(x=>x.id===id); if(i>=0)s[i]=j; else s.push(j); $('journeyDialog').close(); render(id)};
$('deleteJourney').onclick=()=>{data.schedules[data.currentDate]=schedule().filter(j=>j.id!==$('journeyId').value); $('journeyDialog').close(); render()};
$('prevDay').onclick=()=>{data.currentDate=addDays(data.currentDate,-1);render()}; $('nextDay').onclick=()=>{data.currentDate=addDays(data.currentDate,1);render()}; $('todayBtn').onclick=()=>{data.currentDate=todayKey();render()};
function renderSettings(){
 const ds=$('driversSettings'); ds.innerHTML=''; data.drivers.forEach((d,i)=>{const r=document.createElement('div');r.className='row';r.innerHTML=`<input value="${d.name}" data-driver="${d.id}"><button type="button" class="remove" data-remove-driver="${d.id}">×</button>`;ds.appendChild(r)});
 const ps=$('placesSettings'); ps.innerHTML=''; data.places.forEach((p,i)=>{const r=document.createElement('div');r.className='row';r.innerHTML=`<input value="${p}" data-place-index="${i}"><button type="button" class="remove" data-remove-place="${i}">×</button>`;ps.appendChild(r)});
 const rs=$('routesSettings'); rs.innerHTML=''; Object.entries(data.routes).forEach(([k,v])=>{const [a,b]=k.split('||'); const r=document.createElement('div');r.className='route-row';r.innerHTML=`<select data-route-from>${data.places.map(p=>`<option ${p===a?'selected':''}>${p}</option>`).join('')}</select><select data-route-to>${data.places.map(p=>`<option ${p===b?'selected':''}>${p}</option>`).join('')}</select><input type="number" min="1" value="${v}" data-route-mins><button type="button" class="remove" data-remove-route>×</button>`;rs.appendChild(r)});
}
$('settingsBtn').onclick=()=>{renderSettings();$('settingsDialog').showModal()};
$('addDriver').onclick=()=>{if(data.drivers.length>=5){alert('Maximum 5 drivers');return} data.drivers.push({id:uid(),name:'Driver '+(data.drivers.length+1),emoji:'🚗'}); renderSettings()};
$('addPlace').onclick=()=>{data.places.push('New Place'); renderSettings()};
$('addRoute').onclick=()=>{if(data.places.length<2)return; data.routes[routeKey(data.places[0],data.places[1])]=15; renderSettings()};
$('settingsDialog').addEventListener('click',e=>{ if(e.target.dataset.removeDriver){if(data.drivers.length<=1)return; data.drivers=data.drivers.filter(d=>d.id!==e.target.dataset.removeDriver); renderSettings()} if(e.target.dataset.removePlace){data.places.splice(Number(e.target.dataset.removePlace),1); renderSettings()} if(e.target.dataset.removeRoute!==undefined){e.target.closest('.route-row').remove()} });
$('settingsForm').onsubmit=e=>{e.preventDefault(); document.querySelectorAll('[data-driver]').forEach(inp=>{const d=data.drivers.find(x=>x.id===inp.dataset.driver); if(d)d.name=inp.value.trim()||d.name}); const oldPlaces=[...data.places]; data.places=[...document.querySelectorAll('[data-place-index]')].map(i=>i.value.trim()).filter(Boolean); schedule().forEach(j=>{const fi=oldPlaces.indexOf(j.from), ti=oldPlaces.indexOf(j.to); if(fi>=0)j.from=data.places[fi]||j.from; if(ti>=0)j.to=data.places[ti]||j.to}); const routes={}; document.querySelectorAll('.route-row').forEach(r=>{const a=r.querySelector('[data-route-from]').value,b=r.querySelector('[data-route-to]').value,m=Number(r.querySelector('[data-route-mins]').value)||15; if(a&&b&&a!==b)routes[routeKey(a,b)]=m}); data.routes=routes; $('settingsDialog').close(); render()};
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
