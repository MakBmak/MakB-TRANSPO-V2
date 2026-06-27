const STORAGE_KEY = "makbTranspoV2";
const DRIVERS = ["MK", "CY"];
const LABELS = { H: "Home", UB: "Unit Base", ST: "SET" };

const sampleJourneys = [
  { p:"E", from:"H", to:"UB", time:"06:55", driver:"MK" },
  { p:"E", from:"UB", to:"ST", time:"08:15", driver:"MK" },
  { p:"J+R", from:"UB", to:"ST", time:"08:50", driver:"MK" },
  { p:"R", from:"H", to:"UB", time:"07:20", driver:"CY" },
  { p:"JO", from:"H", to:"UB", time:"08:10", driver:"CY" },
  { p:"M", from:"H", to:"UB", time:"08:45", driver:"CY" },
  { p:"M+JO", from:"UB", to:"ST", time:"09:35", driver:"CY" }
];

let app = loadApp();
let selectedDate = todayKey();
let lastEditedId = null;
const $ = id => document.getElementById(id);

function newId(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2); }
function withIds(list){ return list.map(j => ({ id:newId(), ...j })); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function offsetDate(key, days){ const d = new Date(key + "T12:00:00"); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function tomorrowKey(){ return offsetDate(todayKey(), 1); }

function loadApp(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if(saved && saved.schedules) return saved;
  return {
    minsHU: 15,
    minsUS: 15,
    schedules: { [todayKey()]: withIds(sampleJourneys) }
  };
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(app)); }
function schedule(){ if(!app.schedules[selectedDate]) app.schedules[selectedDate] = []; return app.schedules[selectedDate]; }
function setSchedule(dateKey, journeys){ app.schedules[dateKey] = journeys; save(); }

function toMin(t){ const [h,m] = t.split(":").map(Number); return h*60+m; }
function toTime(m){ m=((m%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function tripMin(j){
  if(j.from==="H" && j.to==="UB") return app.minsHU;
  if(j.from==="UB" && j.to==="ST") return app.minsUS;
  if(j.from==="UB" && j.to==="H") return app.minsHU;
  if(j.from==="ST" && j.to==="UB") return app.minsUS;
  if(j.from==="H" && j.to==="ST") return app.minsHU + app.minsUS;
  if(j.from==="ST" && j.to==="H") return app.minsUS + app.minsHU;
  return Math.max(app.minsHU, app.minsUS);
}
function startMin(j){ return toMin(j.time); }
function endMin(j){ return startMin(j) + tripMin(j); }
function endTime(j){ return toTime(endMin(j)); }
function overlaps(a,b){ return startMin(a) < endMin(b) && startMin(b) < endMin(a); }
function otherDriver(d){ return d === "MK" ? "CY" : "MK"; }
function isFree(driver, trip, ignoreId=null){
  return !schedule().some(j => j.driver===driver && j.id!==ignoreId && overlaps(j, trip));
}
function findConflicts(){
  const list = [];
  for(const d of DRIVERS){
    const js = schedule().filter(j => j.driver===d);
    for(let i=0;i<js.length;i++){
      for(let k=i+1;k<js.length;k++){
        if(overlaps(js[i],js[k])) list.push({ a:js[i], b:js[k], driver:d });
      }
    }
  }
  return list;
}
function dateLabel(key){
  const d = new Date(key + "T12:00:00");
  const nice = d.toLocaleDateString(undefined,{weekday:"long", day:"numeric", month:"long"});
  if(key===todayKey()) return "Today · " + nice;
  if(key===tomorrowKey()) return "Tomorrow Draft · " + nice;
  return nice;
}
function dayStatus(key){
  if(key===todayKey()) return ["LIVE", ""];
  if(key>todayKey()) return ["DRAFT", "draft"];
  return ["ARCHIVED", "archived"];
}

function render(focusId=null){
  const conflicts = findConflicts();
  const bad = new Set();
  conflicts.forEach(c => { bad.add(c.a.id); bad.add(c.b.id); });

  $("timeHU").textContent = app.minsHU + " min";
  $("timeUS").textContent = app.minsUS + " min";
  $("scheduleDateLabel").textContent = dateLabel(selectedDate);
  const [status, cls] = dayStatus(selectedDate);
  $("scheduleStatus").textContent = status;
  $("scheduleStatus").className = "status-pill " + cls;
  $("dayTitle").textContent = selectedDate===todayKey() ? "Today's Schedule" : "Schedule";

  for(const d of DRIVERS){
    const list = $(d==="MK" ? "mkList" : "cyList");
    list.innerHTML = "";
    schedule().filter(j => j.driver===d).sort((a,b)=>startMin(a)-startMin(b)).forEach(j => {
      const btn = document.createElement("button");
      btn.id = "trip-" + j.id;
      btn.className = "journey " + (bad.has(j.id) ? "conflict " : "") + (j.id===focusId ? "new-conflict " : "");
      btn.innerHTML = `
        <div class="time">${j.time}</div>
        <div>
          <div class="route">${LABELS[j.from]} → ${LABELS[j.to]}</div>
          <div class="arrive">Arrive ${endTime(j)} · ${tripMin(j)} min</div>
        </div>
        <div class="bubble">${j.p}</div>`;
      btn.onclick = () => openJourney(j);
      list.appendChild(btn);
    });
  }

  $("mkStatus").textContent = schedule().some(j=>j.driver==="MK" && bad.has(j.id)) ? "Conflict 🔴" : "Available ✅";
  $("cyStatus").textContent = schedule().some(j=>j.driver==="CY" && bad.has(j.id)) ? "Conflict 🔴" : "Available ✅";
  renderWarning(conflicts, focusId);
  save();
}

function renderWarning(conflicts, focusId){
  const warning = $("warning");
  warning.classList.toggle("hidden", conflicts.length===0);
  if(!conflicts.length){ warning.innerHTML = ""; return; }

  const c = conflicts.find(x => x.a.id===focusId || x.b.id===focusId) || conflicts[0];
  const newer = focusId && (c.a.id===focusId || c.b.id===focusId) ? schedule().find(j=>j.id===focusId) : c.b;
  const old = newer.id===c.a.id ? c.b : c.a;
  const alt = otherDriver(newer.driver);
  const canMove = isFree(alt, newer, newer.id);

  warning.innerHTML = `
    🔴 <b>Conflict</b><br>
    <b>${newer.driver}</b> is already booked at this time.<br><br>
    Existing: <b>${old.p}</b> — ${LABELS[old.from]} → ${LABELS[old.to]}, ${old.time}–${endTime(old)}<br>
    Clashing: <b>${newer.p}</b> — ${LABELS[newer.from]} → ${LABELS[newer.to]}, ${newer.time}–${endTime(newer)}<br><br>
    ${canMove
      ? `✅ Suggested fix: <button onclick="moveTrip('${newer.id}','${alt}')">Move ${newer.p} to ${alt}</button>`
      : `No escort is free for that time. Try changing the time or deleting one trip.`}
    <button onclick="scrollToTrip('${old.id}')">Show conflict</button>
  `;
  setTimeout(()=>scrollToTrip(old.id), 120);
}

function scrollToTrip(id){
  document.getElementById("trip-"+id)?.scrollIntoView({behavior:"smooth", block:"center"});
}
function moveTrip(id, newDriver){
  setSchedule(selectedDate, schedule().map(j => j.id===id ? {...j, driver:newDriver} : j));
  lastEditedId = id;
  render(id);
}

function openJourney(j=null, driver=null){
  $("journeyDialog").showModal();
  $("dialogTitle").textContent = j ? "Edit Journey" : "Add Journey";
  $("journeyId").value = j?.id || "";
  $("passengers").value = j?.p || "";
  $("fromLoc").value = j?.from || "H";
  $("toLoc").value = j?.to || "UB";
  $("leaveTime").value = j?.time || "09:00";
  $("driver").value = j?.driver || driver || "MK";
  $("deleteJourney").classList.toggle("hidden", !j);
}

$("journeyForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("journeyId").value;
  const j = {
    id: id || newId(),
    p: $("passengers").value.trim(),
    from: $("fromLoc").value,
    to: $("toLoc").value,
    time: $("leaveTime").value,
    driver: $("driver").value
  };
  setSchedule(selectedDate, id ? schedule().map(x => x.id===id ? j : x) : [...schedule(), j]);
  lastEditedId = j.id;
  $("journeyDialog").close();
  render(j.id);
});
$("deleteJourney").onclick = () => {
  const id = $("journeyId").value;
  setSchedule(selectedDate, schedule().filter(j => j.id!==id));
  $("journeyDialog").close();
  render();
};
$("addJourney").onclick = () => openJourney();
document.querySelectorAll(".add-driver").forEach(b => b.onclick = () => openJourney(null, b.dataset.driver));

$("prevDay").onclick = () => { selectedDate = offsetDate(selectedDate, -1); lastEditedId=null; render(); };
$("nextDay").onclick = () => { selectedDate = offsetDate(selectedDate, 1); lastEditedId=null; render(); };
$("todayBtn").onclick = () => { selectedDate = todayKey(); render(); };
$("tomorrowBtn").onclick = () => { selectedDate = tomorrowKey(); render(); };

$("copyTodayBtn").onclick = () => {
  const today = app.schedules[todayKey()] || [];
  if(!today.length){ alert("Today has no journeys to copy."); return; }
  if(confirm("Copy today's schedule into this selected day? This replaces this day's current draft.")){
    setSchedule(selectedDate, today.map(j => ({...j, id:newId()})));
    render();
  }
};
$("clearDayBtn").onclick = () => {
  if(confirm("Clear all journeys for this selected day?")){
    setSchedule(selectedDate, []);
    render();
  }
};
$("resetBtn").onclick = () => {
  if(confirm("Reset the selected day to the sample schedule?")){
    setSchedule(selectedDate, withIds(sampleJourneys));
    render();
  }
};
$("exportBtn").onclick = async () => {
  const lines = [`MakB TRANSPO — ${dateLabel(selectedDate)}`, ""];
  for(const d of DRIVERS){
    lines.push(`${d}:`);
    const js = schedule().filter(j=>j.driver===d).sort((a,b)=>startMin(a)-startMin(b));
    if(!js.length) lines.push("  No journeys");
    js.forEach(j => lines.push(`  ${j.time} ${j.p}: ${LABELS[j.from]} → ${LABELS[j.to]} arrives ${endTime(j)}`));
    lines.push("");
  }
  try{ await navigator.clipboard.writeText(lines.join("\n")); alert("Schedule copied to clipboard."); }
  catch{ alert(lines.join("\n")); }
};

function openSettings(){
  $("setHU").value = app.minsHU;
  $("setUS").value = app.minsUS;
  $("settingsDialog").showModal();
}
$("settingsBtn").onclick = openSettings;
$("changeTimes").onclick = openSettings;
$("settingsForm").addEventListener("submit", e => {
  e.preventDefault();
  app.minsHU = Number($("setHU").value) || 15;
  app.minsUS = Number($("setUS").value) || 15;
  $("settingsDialog").close();
  render(lastEditedId);
});

render();
