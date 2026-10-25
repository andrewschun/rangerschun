import { startTeamSchedule } from './team-schedule-ui.mjs?v=calendar-location-20261025';
import { installGoogleBridge } from './google-bridge.mjs?v=schedule-auto-refresh-20261025';
import { startTabPlayers } from './tab-players.mjs?v=axe-options-20261025';
import { startThrowingCalendar } from './throwing-calendar-ui.mjs?v=schedule-auto-refresh-20261025';
import { isThrowingWorkout } from './workout-record-tools.mjs?v=schedule-auto-refresh-20261025';
import { startOverSpeedProgression } from './overspeed-progression-ui.mjs?v=schedule-auto-refresh-20261025';
import { startPulse } from './pulse-ui.mjs?v=schedule-auto-refresh-20261025';
import { startBlastPcr } from './blast-pcr-ui.mjs?v=schedule-auto-refresh-20261025';
import { startWorkoutFlow } from './workout-flow.mjs?v=schedule-auto-refresh-20261025';
import { OVERSPEED_LIBRARY } from './overspeed-library.mjs?v=schedule-auto-refresh-20261025';
import { BAT_CONFIGURATIONS, BAT_SPEED_DEVICES, validateBatSpeedSet, upsertBatSpeedSet, summarizeBatSpeeds, batSpeedContext, batSpeedProgress, batSpeedCsv } from './overspeed.mjs?v=schedule-auto-refresh-20261025';
import { startOverSpeed } from './overspeed-ui.mjs?v=schedule-auto-refresh-20261025';
import { workoutActivity, workoutActivityCsv, workoutWeek } from './accountability.mjs?v=schedule-auto-refresh-20261025';
import { startWorkoutAccountability } from './accountability-ui.mjs?v=schedule-auto-refresh-20261025';
import { PLAYER_READING } from './reading-guide.mjs?v=schedule-auto-refresh-20261025';
import { startPlayerReading } from './player-reading.mjs?v=schedule-auto-refresh-20261025';
import { journalChanges, journalToCsv, validateJournalEvent } from './journal.mjs?v=schedule-auto-refresh-20261025';
import { startTeamJournal } from './journal-ui.mjs?v=schedule-auto-refresh-20261025';
import { DRILLS, COLORS, getTargets, getDubsReferences, DUBS_BALLS, summarizeThrows, BLAST_METRICS, validateBlastRecord, summarizeBlast, upsertBlastRecord, filterBlastRecords, blastDailyProgress, blastRecordsToCsv, WORKOUT_CATEGORIES, validateWorkout, upsertWorkout, summarizeWorkouts, workoutsToCsv, BASEBALL_CONTEXTS, BASEBALL_MOUND_DISTANCE_FT, BASEBALL_RADAR_DEVICE, validateBaseballSession, upsertBaseballSession, baseballSessionsToCsv } from './engine.mjs?v=schedule-auto-refresh-20261025';
import { WORKOUT_LIBRARY } from './library.mjs?v=schedule-auto-refresh-20261025';
import { isWorkoutVideoUrl } from './library-tools.mjs?v=schedule-auto-refresh-20261025';

const GOOGLE_BACKEND_CONFIG = {"url": "https://script.google.com/macros/s/AKfycby83qDRwh5DzSU-h-45CdqJBGbO8NcVzssZnTpore_FH8psVHYUtxRpEHIgiJISOISL0g/exec", "origin": "https://andrewschun.github.io"};
installGoogleBridge(GOOGLE_BACKEND_CONFIG);
const TEAM_SCHEDULE_CONFIG = {remote:true,public_url:'https://script.google.com/macros/s/AKfycby83qDRwh5DzSU-h-45CdqJBGbO8NcVzssZnTpore_FH8psVHYUtxRpEHIgiJISOISL0g/exec',snapshot_url:'./team-schedule.json',cache_key:'rangers-team-schedule-v1',subscription_url:"https://ical-cdn.teamsnap.com/team_schedule/896a42c8-2cb3-4e91-a8af-a056eafd6026.ics"};
const $ = id => document.getElementById(id);
const names = Object.fromEntries(COLORS.map(color => [color, color[0].toUpperCase() + color.slice(1)]));
const swatches = { green: '#00a768', blue: '#087ab9', red: '#df493d', orange: '#ef9c11', gray: '#7f858b' };
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function workoutDemoLink(exercise, label) {
  if (!exercise || !isWorkoutVideoUrl(exercise.demo_url)) return null;
  const related=exercise.demo_status==='related_variation';
  const link=el('a','exercise-demo'+(related?' related-demo':''),(label??(related?'Related demo':'Watch demo'))+' ↗');
  link.href=exercise.demo_url;link.target='_blank';link.rel='noopener noreferrer';
  link.setAttribute('aria-label',`${label??(related?'Related demo':'Watch demo')}: ${exercise.name} (opens in a new tab)`);
  if(exercise.demo_note)link.title=exercise.demo_note;
  return link;
}
for(const drill of DRILLS){const link=workoutDemoLink(WORKOUT_LIBRARY.drills[drill],drill);if(link)$('target-drill-demos').append(link);}
let overspeedLog = null;
let workoutOverview = null;
let teamJournal = null;
let tabPlayers = null;
let rows = null;
let currentResult = null;
let selectedColor = 'all';
const sourceMasses = { green: 1000, blue: 450, red: 225, orange: 350, gray: 100 };
let equipmentMode = 'dubs';
let started = false;

// Placeholder aliases only. Selection stays in memory and is never submitted.
const PLAYER_LABELS = Object.freeze(["Aidan", "Ambrose", "Andre", "Carson", "Carter", "Jayden", "Joseph", "Josh", "Max", "Michael", "Nathan", "Raiden", "Rory", "Walker", "Marcus", "Dominic", "Demo"]);
const STORAGE_ROSTER_LABELS = Object.freeze(["Aidan", "Ambrose", "Andre", "Carson", "Carter", "Jayden", "Joseph", "Josh", "Max", "Michael", "Nathan", "Raiden", "Rory", "Walker"]);
let rosterHash=2166136261;
for(const char of JSON.stringify(STORAGE_ROSTER_LABELS)) rosterHash=Math.imul(rosterHash^char.charCodeAt(0),16777619)>>>0;
function populatePlayerDropdown(id) {
  const select = $(id);
  const prompt = el('option', '', 'Choose a player');
  prompt.value = '';
  select.replaceChildren(prompt);
  for (const label of PLAYER_LABELS) {
    const option = el('option', '', label);
    option.value = label;
    select.append(option);
  }
}
populatePlayerDropdown('player');
populatePlayerDropdown('axe-player');

// Workout selection, checklist and journal share one form.
const goWorkoutPane=view=>{tabPlayers?.setCurrent($(view==='throwing'?'throwing-player':'workout-player').value);location.hash='#'+view;};
const workoutFlow=startWorkoutFlow({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,download:downloadFile,onNavigate:goWorkoutPane,onChange:(before,after)=>{teamJournal?.record('workout',before,after);workoutOverview?.refresh();}});
const throwingElement=id=>$(id.startsWith('workout-')?'throwing-'+id.slice(8):id.startsWith('library-')?'throwing-library-'+id.slice(8):id);
const throwingFlow=startWorkoutFlow({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:throwingElement,download:downloadFile,variant:'throwing',sharedStore:workoutFlow,onNavigate:goWorkoutPane});


function displayBalls() {
  return equipmentMode === 'dubs'
    ? DUBS_BALLS.map(ball => ({key:ball.model, label:`${ball.color} · ${ball.mass_g.toLocaleString()} g`, sublabel:ball.model==='DPB-150'?`${ball.model} · PROJECTION`:ball.model, swatch:ball.swatch, filter:`${ball.color} · ${ball.mass_g.toLocaleString()} g`}))
    : COLORS.map(color => ({key:color, label:`${names[color]} · ${sourceMasses[color] === null ? 'mass unconfirmed' : sourceMasses[color].toLocaleString()+' g'}`, sublabel:'DRIVELINE SOURCE', swatch:swatches[color], filter:`${names[color]} · ${sourceMasses[color] === null ? 'mass ?' : sourceMasses[color].toLocaleString()+' g'}`}));
}
function drawFilters() {
  $('ball-filters').replaceChildren();
  for (const ball of [{key:'all',filter:'All balls'}, ...displayBalls()]) {
    const button = el('button', 'ball-filter' + (ball.key === selectedColor ? ' selected' : ''));
    button.type='button';button.dataset.color=ball.key;
    button.setAttribute('aria-pressed',ball.key===selectedColor?'true':'false');
    if(ball.swatch){const dot=el('span','filter-dot');dot.style.setProperty('--ball-color',ball.swatch);dot.setAttribute('aria-hidden','true');button.append(dot);}
    button.append(document.createTextNode(ball.filter));
    button.addEventListener('click',()=>{selectedColor=ball.key;drawFilters();drawBoard();$('result-announcement').textContent=ball.key==='all'?'Showing all balls.':`Showing ${ball.filter}.`;});
    $('ball-filters').append(button);
  }
}
function drawBoard() {
  const board=$('target-board');board.replaceChildren();board.setAttribute('role','table');
  board.setAttribute('aria-label',`${equipmentMode==='dubs'?'unvalidated DUBS references and 150 g projections':'Driveline references'} at ${currentResult?.mound_mph ?? 'unknown'} mph`);
  if(!currentResult?.cells.length)return;
  const header=el('div','board-header');header.setAttribute('role','row');
  for(const label of ['BALL / WEIGHT',...DRILLS]){const cell=el('span');cell.setAttribute('role','columnheader');cell.append(workoutDemoLink(WORKOUT_LIBRARY.drills[label],label)??document.createTextNode(label));header.append(cell);}board.append(header);
  for(const ball of displayBalls().filter(ball=>selectedColor==='all'||selectedColor===ball.key)){
    const row=el('div','ball-row');row.style.setProperty('--ball-color',ball.swatch);row.setAttribute('role','row');row.dataset.ball=ball.key;
    const label=el('div','ball-label');label.setAttribute('role','rowheader');const dot=el('span','ball-dot');dot.setAttribute('aria-hidden','true');
    const text=el('div');text.append(el('strong','',ball.label),el('small','',ball.sublabel));label.append(dot,text);row.append(label);
    for(const drill of DRILLS){
      const value=currentResult.cells.find(cell=>(equipmentMode==='dubs'?cell.ball_model:cell.ball_color)===ball.key&&cell.drill===drill);
      const pending=['mapping_unresolved','reference_unavailable','projection_unavailable'].includes(value.status),projected=value.status==='projected_mass_interpolation',notProjected=value.status==='not_projected',blank=value.target_mph===null;
      const cell=el('div','target-cell'+(blank?' blank':'')+(pending?' pending-reference':'')+(projected?' projected':''));cell.dataset.drill=drill;cell.setAttribute('role','cell');
      const description=notProjected?'Roll-Ins omitted from the requested 150 g projection; no value assigned':pending?'Projection or reference unavailable: required source readings are missing':blank?'blank in the source; no target assigned':projected?`${value.target_mph.toFixed(1)} mph, projected by mass interpolation: ${value.projection.formula}; ${value.projection.baseline_method} mound baseline; unvalidated for DUBS`:`${value.target_mph.toFixed(1)} mph, ${value.status}${equipmentMode==='dubs'?', copied Driveline reference, unvalidated for DUBS':''}`;
      cell.setAttribute('aria-label',`${ball.label}, ${ball.sublabel}, ${drill}: ${description}`);cell.title=description;
      for(const node of [el('span','mobile-drill-label',drill),el('span','target-value',pending?'Pending':blank?'—':value.target_mph.toFixed(1)),el('span','target-unit',pending?'SOURCE NEEDED':projected?'PROJECTED MPH':equipmentMode==='dubs'?'REF MPH':'MPH')]){node.setAttribute('aria-hidden','true');cell.append(node);}row.append(cell);
    }
    board.append(row);
  }
}
for(const button of document.querySelectorAll('[data-equipment-mode]'))button.addEventListener('click',()=>{
  equipmentMode=button.dataset.equipmentMode;selectedColor='all';
  document.querySelectorAll('[data-equipment-mode]').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',active?'true':'false');});
  $('dubs-transfer-note').hidden=equipmentMode!=='dubs';drawFilters();renderTargets(true);
});
drawFilters();

function renderTargets(announce = false) {
  if (!rows) return;
  const input = $('velocity');
  const result = equipmentMode === 'dubs' ? getDubsReferences(input.valueAsNumber, rows) : getTargets(input.valueAsNumber, rows);
  currentResult = result;
  const valid = ['observed','interpolated'].includes(result.status);
  input.setAttribute('aria-invalid', valid ? 'false' : 'true');
  $('velocity-error').hidden = valid;
  $('velocity-error').textContent = valid ? '' : result.status === 'invalid'
    ? 'Enter a mound fastball velocity in mph.'
    : 'Enter 70–86 mph. No targets are assigned outside the screenshot range.';
  $('empty-state').hidden = valid;
  $('target-board').hidden = !valid;
  document.querySelector('.board-footer').hidden = !valid;
  $('export-targets').disabled = !valid;
  $('result-status').className = 'status-pill ' + (valid ? result.status : 'neutral');
  $('result-status').textContent = !valid ? 'No targets available' : equipmentMode === 'dubs' ? 'Unvalidated · includes projections' : result.status === 'observed' ? 'Observed · screenshot' : 'Estimated · interpolation';
  if(valid && equipmentMode==='dubs') $('result-status').className='status-pill '+'interpolated';
  $('result-heading').textContent = valid ? `${equipmentMode === 'dubs' ? 'DUBS references & estimates' : 'targets'} at ${result.mound_mph} mph` : 'A source-backed target starts here.';
  const equipmentLabel=equipmentMode==='dubs'?'DUBS · REFERENCES + 150 G PROJECTIONS':'ORIGINAL DRIVELINE OBSERVATIONS';
  $('result-player').textContent=($('player').value?$('player').value.toUpperCase():'SAMPLE BASELINE')+' · '+equipmentLabel;
  $('board-legend').textContent=equipmentMode==='dubs'?'PROJECTED = 150 g estimate. Roll-Ins omitted. — = no source value or projection.':'— Blank in source. No target assigned.';
  $('empty-state').querySelector('h3').textContent = result.status === 'invalid' ? 'Enter a baseline to see the targets.' : 'That baseline is outside our source range.';
  $('empty-message').textContent = result.status === 'invalid' ? 'Use a measured mound fastball velocity between 70 and 86 mph.' : 'Screenshot observations cover 70–86 mph. Extrapolation is disabled.';
  $('method-result').textContent = valid ? result.status === 'observed'
    ? `At ${result.mound_mph} mph, the original Driveline view’s 19 numeric values and 6 blank combinations come from the supplied screenshot. The complete source set contains 17 screenshots, one for each whole mph from 70 through 86.`
    : `At ${result.mound_mph} mph, nonblank values are linearly interpolated between the ${result.lower_mph} and ${result.upper_mph} mph screenshots, then rounded to one decimal. Blank combinations are retained. This is an estimate, not the original calculator formula.`
    : 'Screenshot observations cover 70–86 mph. Extrapolation is disabled.';
  if(valid && equipmentMode==='dubs') $('method-result').textContent += ' Five DUBS rows copy nominally weight-matched Driveline references. Dark green 150 g has four separate projections: 60% of the gray 100 g reading plus 40% of the red 225 g reading for the same drill and mound baseline, rounded once to 0.1 mph. Decimal baselines also interpolate between neighboring screenshots before final rounding. Roll-Ins are omitted. This assumed straight-line relationship with mass has no 150 g or DUBS validation; no error margin is established.';
  $('source-files').replaceChildren(...result.sources.map(source => el('li', '', source)));
  $('decrease').disabled = valid && result.mound_mph <= 70;
  $('increase').disabled = valid && result.mound_mph >= 86;
  drawBoard();
  if (announce) $('result-announcement').textContent = valid
    ? `${$('result-heading').textContent}. ${$('result-status').textContent}. ${result.cells.filter(cell=>cell.target_mph!==null&&cell.status!=='projected_mass_interpolation').length} numeric references${equipmentMode==='dubs'?` and ${result.cells.filter(cell=>cell.status==='projected_mass_interpolation').length} projected values`:''}; remaining cells are blank or pending.`
    : $('velocity-error').textContent;
}

$('target-form').addEventListener('submit', event => {
  event.preventDefault();
  renderTargets(true);
});
$('velocity').addEventListener('input', () => renderTargets(false));
$('player').addEventListener('change', () => {renderTargets(true); if(!blastDirty&&!blastEditingId&&!blastPcrLog?.hasDraft()){$('blast-player').value=$('player').value;blastSelectedPlayer=$('player').value;clearBlastMetrics();$('blast-bat').value='';resetBlastFilters();renderBlastHistory();blastPcrLog?.changePlayer();}});
for (const [id, delta] of [['decrease', -1], ['increase', 1]]) {
  $(id).addEventListener('click', () => {
    const value = $('velocity').valueAsNumber;
    $('velocity').value = Math.min(86, Math.max(70, Number.isFinite(value) ? Math.round((value + delta) * 10) / 10 : 75));
    renderTargets(true);
  });
}
$('reset-baseline').addEventListener('click', () => {
  $('velocity').value = 75;
  renderTargets(true);
  $('velocity').focus();
});

function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
$('export-targets').addEventListener('click', () => {
  if (!currentResult?.cells.length) return;
  const header = ['mound_mph','equipment_view','ball_model','ball_color','nominal_mass_g','drill','reference_mph','source_value_status','application_status','source_color','source_screenshots','projection_method','projection_basis_json'];
  const data = currentResult.cells.map(cell=>[currentResult.mound_mph,equipmentMode,cell.ball_model??'',cell.ball_color,cell.mass_g??(equipmentMode==='driveline'?sourceMasses[cell.ball_color]:''),cell.drill,cell.target_mph,cell.status,cell.application_status??'original_driveline_reference',cell.source_color??(equipmentMode==='driveline'?cell.ball_color:''),cell.sources.join(' | '),cell.projection?.method??'',cell.projection?JSON.stringify(cell.projection):'']);
  downloadFile(`rangers-${equipmentMode}-references-${currentResult.mound_mph}mph.csv`,[header,...data].map(row=>row.map(csv).join(',')).join('\r\n'));
});
$('download-template').addEventListener('click', () => {
  downloadFile('rangers-baseball-coach-sheet-template.csv', baseballSessionsToCsv([])+'\r\n');
});

// Blast records are separate from PlyoCare target references. No network submission.
populatePlayerDropdown('blast-player');
const today = new Date();
$('blast-date').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
for (const [index, metric] of BLAST_METRICS.entries()) {
  const label = el('label','',metric.label+' '); label.htmlFor = 'blast-'+metric.key;
  label.append(el('span','',metric.unit));
  const input=el('input'); input.id='blast-'+metric.key; input.type='number'; input.inputMode='decimal'; input.step='any'; input.min=metric.exclusiveMin?'0.000001':String(metric.min);
  if(metric.max!==undefined) input.max=String(metric.max);
  input.required=metric.key==='bat_speed_mph'; input.autocomplete='off';
  label.append(input); $(index<3?'blast-main-metrics':'blast-extra-metrics').append(label);
}
let blastEditingId=null,blastDirty=false,blastSelectedPlayer='',blastPcrLog=null;
function clearBlastMetrics() {
  for(const metric of BLAST_METRICS) $('blast-'+metric.key).value=''; $('blast-notes').value=''; $('blast-error').hidden=true;
  blastEditingId=null;blastDirty=false;$('blast-mode-label').textContent='MANUAL DATA ENTRY';$('blast-form-title').textContent='Add a swing';$('blast-cancel-edit').hidden=true;
  $('blast-save').replaceChildren(document.createTextNode('Save swing on this device '),el('span','','+'));
}
// Scope saved records to this exact roster so generic and local copies do not mix players.
const blastStorageKey='rangers-blast-v1-'+rosterHash.toString(16);
let blastRecords=[];
let blastStorageReadable=true;
let blastDeviceSaved=true;
try {
  const saved=localStorage.getItem(blastStorageKey);
  if(saved) {
    const parsed=JSON.parse(saved);
    if(parsed.version!==1 || !Array.isArray(parsed.records)) throw new Error('Unrecognized saved data.');
    const ids=new Set();
    for(const record of parsed.records) {
      validateBlastRecord(record,PLAYER_LABELS);
      if(typeof record.id!=='string'||!record.id||ids.has(record.id)) throw new Error('Invalid saved record identity.');
      ids.add(record.id);
    }
    blastRecords=parsed.records;
  }
} catch {
  blastStorageReadable=false; blastDeviceSaved=false;
  $('blast-storage-status').textContent='Device storage could not be read. New entries stay only in this open page; export before closing. Existing device records will not be overwritten.';
}
// Retain earlier bat descriptions when reopening existing player records.
for(const bat of [...new Set(blastRecords.map(record=>record.bat).filter(Boolean))]){if(![...$('blast-bat').options].some(option=>option.value===bat)){const option=el('option','',bat);option.value=bat;$('blast-bat').append(option);}}
function persistBlast(next) {
  teamJournal?.record('blast',blastRecords,next);
  if(!blastStorageReadable) { blastRecords=next; blastDeviceSaved=false; return true; }
  try { localStorage.setItem(blastStorageKey,JSON.stringify({version:1,records:next})); blastDeviceSaved=true; $('blast-storage-status').textContent=''; }
  catch { blastDeviceSaved=false; $('blast-storage-status').textContent='Device storage is unavailable or full. This change is kept only in the open page. Export the records before closing. Deletions could not be saved to the device.'; }
  blastRecords=next;
  return true;
}
const blastDrills={tee:'Tee',front_toss:'Front toss',machine:'Machine',live:'Live pitching',air_swing:'Air swing',other:'Other'};
const blastFormat=(value,metric)=>value===null||value===undefined?'—':value.toFixed(metric.decimals);
function selectedBlastRecords(){return blastRecords.filter(record=>record.player===$('blast-player').value);}
for(const metric of BLAST_METRICS){const option=el('option','',`${metric.label} (${metric.unit})`);option.value=metric.key;$('blast-trend-metric').append(option);}
function resetBlastFilters(){for(const id of ['blast-filter-from','blast-filter-to','blast-filter-drill','blast-filter-bat'])$(id).value='';}
function editBlastRecord(record){
  if((blastDirty||blastEditingId)&&!window.confirm('Replace your unsaved swing draft with this saved swing?'))return;
  blastEditingId=record.id;$('blast-date').value=record.session_date;$('blast-drill').value=record.drill;$('blast-bat').value=record.bat;$('blast-notes').value=record.notes;
  for(const metric of BLAST_METRICS)$('blast-'+metric.key).value=record[metric.key]??'';
  $('blast-mode-label').textContent='EDITING SAVED SWING';$('blast-form-title').textContent='Edit a swing';$('blast-cancel-edit').hidden=false;$('blast-error').hidden=true;
  $('blast-save').replaceChildren(document.createTextNode('Update saved swing '),el('span','','✓'));blastDirty=false;
  $('blast-form').scrollIntoView({behavior:'smooth',block:'start'});$('blast-bat_speed_mph').focus({preventScroll:true});
}
function renderBlastProgress(records){
  const metric=BLAST_METRICS.find(item=>item.key===$('blast-trend-metric').value),progress=blastDailyProgress(records,metric.key);
  const stat=day=>day?.metrics[metric.key],summary=$('blast-trend-summary');summary.replaceChildren();
  const roundedChange=progress.change===null?null:Number(progress.change.toFixed(metric.decimals));
  const change=roundedChange===null?'—':(roundedChange>0?'+':'')+blastFormat(roundedChange,metric);
  for(const [label,value,note]of [['First daily mean',blastFormat(stat(progress.first)?.mean,metric),progress.first?`${progress.first.date} · n = ${stat(progress.first).count}`:'No reading yet'],['Latest daily mean',blastFormat(stat(progress.latest)?.mean,metric),progress.latest?`${progress.latest.date} · n = ${stat(progress.latest).count}`:'No reading yet'],['Change in daily mean',change,progress.change===null?'Needs two dates with readings':`${progress.first.date} to ${progress.latest.date}`]]){const card=el('article');card.append(el('h3','',label),el('strong','',value),el('span','',metric.unit),el('small','',note));summary.append(card);}
  const chart=$('blast-trend-chart');chart.replaceChildren();const measured=progress.days.filter(day=>day.metrics[metric.key].count>0);
  if(!measured.length){chart.append(el('p','blast-chart-empty',$('blast-player').value?`No ${metric.label.toLowerCase()} readings match these filters. Save a swing with this metric to start tracking.`:'Choose your name and save your first swing to start your chart.'));}
  else{
    const svgNode=(tag,attrs,text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};
    const width=Math.max(280,Math.min(760,chart.clientWidth-16||760)),height=250,pad={left:66,right:30,top:28,bottom:45},values=measured.map(day=>day.metrics[metric.key].mean),min=Math.min(...values),max=Math.max(...values),margin=Math.max((max-min)*.2,Math.abs(max)*.015,10**(-metric.decimals));
    const low=metric.min>=0?Math.max(0,min-margin):min-margin,high=max+margin,start=Date.parse(measured[0].date),end=Date.parse(measured.at(-1).date);
    const x=day=>end===start?(pad.left+width-pad.right)/2:pad.left+(Date.parse(day.date)-start)/(end-start)*(width-pad.left-pad.right),y=value=>height-pad.bottom-(value-low)/(high-low)*(height-pad.top-pad.bottom);
    const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${metric.label} daily means in ${metric.unit}. ${measured.length} dates with readings. See the daily readings table for exact values.`});
    for(let i=0;i<4;i++){const value=low+(high-low)*i/3,yy=y(value);svg.append(svgNode('line',{x1:pad.left,x2:width-pad.right,y1:yy,y2:yy,class:'blast-grid-line'}),svgNode('text',{x:pad.left-12,y:yy+4,'text-anchor':'end',class:'blast-axis-label'},value.toFixed(metric.decimals)));}
    if(measured.length>1)svg.append(svgNode('polyline',{points:measured.map(day=>`${x(day)},${y(day.metrics[metric.key].mean)}`).join(' '),fill:'none',class:'blast-trend-line'}));
    for(const day of measured){const point=svgNode('circle',{cx:x(day),cy:y(day.metrics[metric.key].mean),r:5,class:'blast-trend-point'});point.append(svgNode('title',{},`${day.date}: ${blastFormat(day.metrics[metric.key].mean,metric)} ${metric.unit} · n = ${day.metrics[metric.key].count}`));svg.append(point);}
    svg.append(svgNode('text',{x:pad.left,y:height-12,class:'blast-axis-label'},measured[0].date));if(measured.length>1)svg.append(svgNode('text',{x:width-pad.right,y:height-12,'text-anchor':'end',class:'blast-axis-label'},measured.at(-1).date));chart.append(svg,el('p','blast-chart-caption',`${metric.label} (${metric.unit}) · ${measured.length} dates · plotted range ${low.toFixed(metric.decimals)}–${high.toFixed(metric.decimals)} ${metric.unit}. Gaps connect recorded dates; no missing readings are filled.`));
  }
  const holder=$('blast-daily-table');holder.replaceChildren();$('blast-daily-details').hidden=!progress.days.length;
  if(progress.days.length){const table=el('table','blast-table blast-daily-table');table.append(el('caption','',`${metric.label} daily means after filtering. Counts exclude missing optional readings.`));const head=el('thead'),tr=el('tr');for(const label of ['Date','Swings',`${metric.label} mean (${metric.unit})`,'Metric readings (n)','Bat speed max (mph)']){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');for(const day of [...progress.days].reverse()){const row=el('tr');for(const text of [day.date,day.swing_count,blastFormat(day.metrics[metric.key].mean,metric),day.metrics[metric.key].count,blastFormat(day.metrics.bat_speed_mph.max,BLAST_METRICS[0])])row.append(el('td','',String(text)));body.append(row);}table.append(body);holder.append(table);}
}
function renderBlastHistory(){
  const player=$('blast-player').value;
  const all=selectedBlastRecords();$('blast-legacy-history').hidden=!all.length;const batFilter=$('blast-filter-bat'),previousBat=batFilter.value;batFilter.replaceChildren(el('option','','All bats'));batFilter.options[0].value='';
  for(const bat of [...new Set(all.map(record=>record.bat))].sort()){const option=el('option','',bat||'Bat not recorded');option.value='bat:'+bat;batFilter.append(option);}if([...batFilter.options].some(option=>option.value===previousBat))batFilter.value=previousBat;
  let records=[];$('blast-filter-error').hidden=true;
  try{records=filterBlastRecords(blastRecords,{player,from:$('blast-filter-from').value,to:$('blast-filter-to').value,drill:$('blast-filter-drill').value,bat:batFilter.value?batFilter.value.slice(4):null});}catch(error){$('blast-filter-error').hidden=false;$('blast-filter-error').textContent=error.message;}
  $('blast-history-title').textContent=player?`${player} · ${all.length} swing${all.length===1?'':'s'}${blastDeviceSaved?' saved':' in this page'}`:'Choose a player to view records';
  $('blast-filter-description').textContent=player?`Showing ${records.length} of ${all.length} saved swings for ${player}. Chart, daily table, and summaries use these filters. Player CSV includes all saved swings. Compare the same drill and bat; optional readings have their own counts.`:'Choose your name above to see your saved history. Use the same drill and bat when comparing results. Optional metrics use only their recorded readings.';
  $('blast-export').disabled=!all.length;
  $('blast-delete-player').disabled=!all.length;
  renderBlastProgress(records);
  $('blast-summary').replaceChildren();
  const stats=summarizeBlast(records);
  for(const metric of BLAST_METRICS.slice(0,5)){
    const stat=stats[metric.key], card=el('article');card.append(el('h3','',metric.label+' · mean'),el('strong','',blastFormat(stat.mean,metric)),el('small','',`${metric.unit} · n = ${stat.count}`));
    if(metric.key==='bat_speed_mph') card.append(el('p','',`Maximum ${blastFormat(stat.max,metric)} mph`));
    $('blast-summary').append(card);
  }
  const history=$('blast-history');history.replaceChildren();
  if(!records.length){history.append(el('p','',player?(all.length?'No swings match these filters. Clear filters to see all saved swings.':'No saved swings for this player yet. Add a swing above.'):'Select a player to see their saved swings.'));return;}
  const table=el('table','blast-table');table.append(el('caption','',`${records.length} individual swing${records.length===1?'':'s'} · newest dates first · open All metrics to see every reading`));
  const head=el('thead'),hr=el('tr');
  for(const title of ['Date / context','Bat speed (mph)','Attack angle (°)','Time to contact (s)','Rot. accel. (g)','On-plane (%)','Actions']){const th=el('th','',title);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
  const body=el('tbody');
  for(const record of [...records].reverse().sort((a,b)=>b.session_date.localeCompare(a.session_date))){
    const tr=el('tr'),context=el('td');context.append(el('span','',record.session_date+' · '+blastDrills[record.drill]));
    if(record.bat)context.append(el('small','',record.bat));if(record.notes)context.append(el('small','',record.notes));tr.append(context);
    for(const metric of BLAST_METRICS.slice(0,5))tr.append(el('td','',blastFormat(record[metric.key],metric)));
    const actions=el('td','blast-row-actions'),edit=el('button','blast-edit','Edit'),remove=el('button','','Delete');edit.type=remove.type='button';edit.setAttribute('aria-label',`Edit swing from ${record.session_date} at ${record.bat_speed_mph} mph`);edit.addEventListener('click',()=>editBlastRecord(record));remove.setAttribute('aria-label',`Delete swing from ${record.session_date} at ${record.bat_speed_mph} mph`);
    const details=el('details','blast-all-metrics');details.append(el('summary','','All metrics'));const list=el('dl');for(const metric of BLAST_METRICS)list.append(el('dt','',metric.label),el('dd','',blastFormat(record[metric.key],metric)+' '+metric.unit));details.append(list);
    remove.addEventListener('click',()=>{if(!window.confirm('Delete this swing from this device?'))return; persistBlast(blastRecords.filter(item=>item.id!==record.id));if(blastEditingId===record.id)clearBlastMetrics();renderBlastHistory();$('blast-announcement').textContent=blastDeviceSaved?'Swing removed from this device.':'Removed from the open page; device saving is unavailable.';});
    actions.append(remove,details);tr.append(actions);body.append(tr);
  }
  table.append(body);history.append(table);
}
$('blast-form').addEventListener('input',event=>{if(event.target.id!=='blast-player')blastDirty=true;});
$('blast-player').addEventListener('change',()=>{if((blastDirty||blastEditingId||blastPcrLog?.hasDraft())&&!window.confirm('Switch players and clear unsaved Blast swing or session-score entries?')){$('blast-player').value=blastSelectedPlayer;return;}blastSelectedPlayer=$('blast-player').value;clearBlastMetrics();$('blast-bat').value='';resetBlastFilters();renderBlastHistory();blastPcrLog?.changePlayer();$('blast-announcement').textContent='';});
$('blast-cancel-edit').addEventListener('click',()=>{if(blastDirty&&!window.confirm('Discard your unsaved swing changes?'))return;clearBlastMetrics();});
for(const id of ['blast-filter-from','blast-filter-to','blast-filter-drill','blast-filter-bat','blast-trend-metric'])$(id).addEventListener('change',renderBlastHistory);
$('blast-reset-filters').addEventListener('click',()=>{resetBlastFilters();renderBlastHistory();});
$('blast-export').addEventListener('click',()=>{
  const records=selectedBlastRecords();if(!records.length)return;
  downloadFile('rangers-blast-player-records.csv',blastRecordsToCsv(records));
});
$('blast-delete-player').addEventListener('click',()=>{
  const player=$('blast-player').value,count=selectedBlastRecords().length;
  if(!count||!window.confirm(`Delete all ${count} saved swings for ${player} from this device, including swings outside the current filters? Export first if you need a copy.`))return;
  persistBlast(blastRecords.filter(record=>record.player!==player));clearBlastMetrics();renderBlastHistory();$('blast-announcement').textContent=blastDeviceSaved?`Removed ${count} swings for ${player}.`:'Removed from the open page; deletion could not be saved to the device.';
});
renderBlastHistory();
blastPcrLog=startBlastPcr({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,download:downloadFile,onChange:(before,after)=>teamJournal?.record('blast_pcr',before,after)});

// Regular-baseball readings only. PlyoCare target references do not receive these entries.
populatePlayerDropdown('baseball-player');
const baseballStorageKey='rangers-baseball-throws-v1-'+rosterHash.toString(16);
let baseballRecords=[],baseballStorageReadable=true,baseballDeviceSaved=true,baseballEditingId=null,baseballDirty=false,baseballSelectedPlayer='';
const baseballToday=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
for(let i=0;i<8;i++){
  const label=el('label','',`Throw ${i+1}`);label.htmlFor='baseball-throw-'+(i+1);const input=el('input');input.id=label.htmlFor;input.type='number';input.inputMode='decimal';input.min='0.000001';input.step='any';input.placeholder='—';input.autocomplete='off';input.setAttribute('aria-label',`Baseball throw ${i+1} in mph`);label.append(input,el('small','','MPH'));$('baseball-throws').append(label);
}
try{
  const saved=localStorage.getItem(baseballStorageKey);
  if(saved){const parsed=JSON.parse(saved);if(parsed.version!==1||!Array.isArray(parsed.records))throw new Error('Unrecognized session data.');const ids=new Set();for(const r of parsed.records){validateBaseballSession(r,PLAYER_LABELS);if(ids.has(r.id))throw new Error('Duplicate session identity.');ids.add(r.id);}baseballRecords=parsed.records;}
}catch{baseballStorageReadable=false;baseballDeviceSaved=false;$('baseball-storage-status').textContent='Device storage could not be read. New sessions stay only in this open page; export before closing. Existing device data will not be overwritten.';}
function persistBaseball(next){
  teamJournal?.record('baseball',baseballRecords,next);
  if(baseballStorageReadable){try{localStorage.setItem(baseballStorageKey,JSON.stringify({version:1,records:next}));baseballDeviceSaved=true;$('baseball-storage-status').textContent='';}catch{baseballDeviceSaved=false;$('baseball-storage-status').textContent='Device storage is unavailable or full. Changes stay in this open page; export before closing. Edits and deletions could not be saved to the device.';}}else baseballDeviceSaved=false;baseballRecords=next;
}
function baseballThrows(){return Array.from({length:8},(_,i)=>{const input=$('baseball-throw-'+(i+1));return input.validity.badInput?NaN:input.value.trim()===''?null:input.valueAsNumber;});}
function renderBaseballStats(){
  const raw=baseballThrows(),invalid=raw.some(v=>v!==null&&(!Number.isFinite(v)||v<=0)),slots=invalid?Array(8).fill(null):raw,values=slots.filter(v=>v!==null),stats=summarizeThrows(values),scale=Math.max(70,Math.ceil((stats.max??0)/10)*10);
  raw.forEach((v,i)=>$('baseball-throw-'+(i+1)).setAttribute('aria-invalid',v!==null&&(!Number.isFinite(v)||v<=0)?'true':'false'));
  if(invalid){$('baseball-error').hidden=false;$('baseball-error').textContent='Each recorded baseball throw must be a finite number greater than zero. Correct the highlighted reading to calculate the summary.';}
  else if($('baseball-error').textContent.startsWith('Each recorded baseball throw'))$('baseball-error').hidden=true;
  $('baseball-save').disabled=invalid;
  const topIndices=slots.map((value,index)=>({value,index})).filter(x=>x.value!==null).sort((a,b)=>b.value-a.value).slice(0,5).map(x=>x.index);
  $('throws-chart').replaceChildren();$('sample-values').replaceChildren();$('throws-chart').setAttribute('aria-label',`Current regular-baseball readings; chart starts at zero and ends at ${scale} mph.`);$('baseball-chart-scale').textContent=`0–${scale} MPH SCALE`;
  for(let i=0;i<8;i++){
    const value=slots[i],included=stats.averageTop5!==null&&topIndices.includes(i),column=el('div','chart-column'+(included?' is-top':'')),bar=el('div','chart-bar'+(included?' top-five':''));
    bar.style.height=value===null?'0':`${value/scale*100}%`;if(value===null)bar.style.minHeight='0';column.append(el('span','chart-value',value===null?'—':value.toFixed(1)),bar);column.setAttribute('aria-label',`Baseball throw ${i+1}: ${value===null?'not recorded':value+' mph'+(included?', included in top-five average':'')}`);$('throws-chart').append(column);$('sample-values').append(el('span','',`THROW ${i+1}`));
  }
  $('stat-max').textContent=stats.max===null?'—':stats.max.toFixed(1);$('stat-average').textContent=stats.averageTop5===null?'—':stats.averageTop5.toFixed(1);$('stat-average').title=stats.averageTop5===null?'Incomplete: fewer than five valid baseball throws.':`Unrounded mean: ${stats.averageTop5} mph`;$('stat-average-unit').textContent=stats.averageTop5===null?'INCOMPLETE':'MPH';$('stat-average-note').textContent=stats.averageTop5===null?'Needs at least five valid throws':'Mean of the five highest · shown to 0.1 mph';$('stat-count').textContent=stats.count;
}
function baseballDistanceText(distance){return distance===BASEBALL_MOUND_DISTANCE_FT?'60 ft 6 in':distance===null?'Not recorded':`${distance} ft`;}
function showBaseballDistance(distance){$('baseball-distance').value=baseballDistanceText(distance);$('baseball-distance-help').textContent=distance===BASEBALL_MOUND_DISTANCE_FT?'Regulation mound distance · fixed':'Previously saved distance';}
function resetBaseballDraft(){
  baseballEditingId=null;$('baseball-date').value=baseballToday;$('baseball-context').value='mound_fastball';showBaseballDistance(BASEBALL_MOUND_DISTANCE_FT);$('baseball-radar-note').textContent='Radar: '+BASEBALL_RADAR_DEVICE+' · recorded automatically';$('baseball-notes').value='';for(let i=1;i<=8;i++)$('baseball-throw-'+i).value='';$('baseball-error').hidden=true;$('baseball-cancel-edit').hidden=true;$('baseball-mode-label').textContent='CURRENT SESSION';$('baseball-save').replaceChildren(document.createTextNode('Save baseball session '),el('span','','+'));baseballDirty=false;renderBaseballStats();
}
function chosenBaseballSessions(){return baseballRecords.filter(r=>r.player===$('baseball-player').value).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.created_at??'').localeCompare(String(a.created_at??'')));}
function editBaseballSession(r){
  if(baseballDirty&&!window.confirm('Replace the unsaved baseball session with this saved session?'))return;
  baseballEditingId=r.id;$('baseball-date').value=r.session_date;$('baseball-context').value=r.context;showBaseballDistance(r.distance_ft);$('baseball-radar-note').textContent=r.device?'Radar: '+r.device+' · saved session':'Radar was not recorded for this saved session.';$('baseball-notes').value=r.notes;r.throws.forEach((value,i)=>$('baseball-throw-'+(i+1)).value=value??'');$('baseball-error').hidden=true;$('baseball-cancel-edit').hidden=false;$('baseball-mode-label').textContent='EDITING SAVED BASEBALL SESSION';$('baseball-save').replaceChildren(document.createTextNode('Update baseball session '),el('span','','✓'));baseballDirty=false;renderBaseballStats();$('baseball-throw-1').focus();
}
function renderBaseballHistory(){
  const player=$('baseball-player').value,records=chosenBaseballSessions();$('baseball-history-title').textContent=player?`${player} · ${records.length} baseball session${records.length===1?'':'s'}${baseballDeviceSaved?' saved':' in this page'}`:'Choose a player to view sessions';$('baseball-export').disabled=!records.length;$('baseball-delete-player').disabled=!records.length;$('baseball-history').replaceChildren();
  if(!records.length){$('baseball-history').append(el('p','workout-empty',player?'No baseball sessions recorded yet. Enter your first session above.':'Choose your name to view baseball sessions.'));return;}
  for(const r of records){
    const stats=summarizeThrows(r.throws.filter(v=>v!==null)),card=el('details','workout-record'),heading=el('summary'),text=el('div');text.append(el('span','workout-record-date',r.session_date+' · '+BASEBALL_CONTEXTS[r.context]),el('strong','',`Maximum ${stats.max.toFixed(1)} mph`),el('small','',`${stats.count} / 8 throws · Top-five average ${stats.averageTop5===null?'incomplete':stats.averageTop5.toFixed(1)+' mph'}`));heading.append(text,el('span','workout-expand','+'));card.append(heading);const body=el('div','workout-record-body');
    const attempts=el('div','baseball-attempt-tags');r.throws.forEach((v,i)=>attempts.append(el('span','',`Throw ${i+1}: ${v===null?'—':v+' mph'}`)));body.append(attempts);const meta=[];if(r.distance_ft!==null)meta.push(baseballDistanceText(r.distance_ft));if(r.device)meta.push(r.device);if(meta.length)body.append(el('p','workout-history-help',meta.join(' · ')));if(r.notes)body.append(el('p','workout-record-notes',r.notes));const actions=el('div','workout-record-actions'),edit=el('button','secondary-button','Edit session'),remove=el('button','delete-button','Delete session');edit.type=remove.type='button';edit.addEventListener('click',()=>editBaseballSession(r));remove.addEventListener('click',()=>{if(!window.confirm('Delete this baseball session from this device?'))return;persistBaseball(baseballRecords.filter(x=>x.id!==r.id));if(baseballEditingId===r.id)resetBaseballDraft();renderBaseballHistory();$('baseball-announcement').textContent=baseballDeviceSaved?'Baseball session deleted from this device.':'Removed from this page; device saving is unavailable.';});actions.append(edit,remove);body.append(actions);card.append(body);$('baseball-history').append(card);
  }
}
$('baseball-form').addEventListener('input',event=>{if(event.target.id!=='baseball-player')baseballDirty=true;renderBaseballStats();});
$('baseball-player').addEventListener('change',()=>{if((baseballDirty||baseballEditingId)&&!window.confirm('Switch players and clear this unsaved baseball session?')){$('baseball-player').value=baseballSelectedPlayer;return;}baseballSelectedPlayer=$('baseball-player').value;resetBaseballDraft();renderBaseballHistory();$('baseball-announcement').textContent='';});
$('baseball-cancel-edit').addEventListener('click',()=>{if(baseballDirty&&!window.confirm('Discard unsaved session edits?'))return;resetBaseballDraft();});
$('baseball-form').addEventListener('submit',event=>{
  event.preventDefault();const existing=baseballEditingId?baseballRecords.find(r=>r.id===baseballEditingId):null,record={id:baseballEditingId??globalThis.crypto?.randomUUID?.()??`baseball-${Date.now()}-${Math.random().toString(36).slice(2)}`,player:$('baseball-player').value,session_date:$('baseball-date').value,ball_type:'regular_baseball',velocity_unit:'mph',context:$('baseball-context').value,distance_ft:existing?existing.distance_ft:BASEBALL_MOUND_DISTANCE_FT,device:existing?.device??BASEBALL_RADAR_DEVICE,notes:$('baseball-notes').value.trim(),throws:baseballThrows(),created_at:existing?.created_at??new Date().toISOString()};
  try{persistBaseball(upsertBaseballSession(baseballRecords,record,PLAYER_LABELS));}catch(error){$('baseball-error').hidden=false;$('baseball-error').textContent=error.message;return;}
  const edited=baseballEditingId!==null;resetBaseballDraft();renderBaseballHistory();$('baseball-announcement').textContent=`Baseball session ${edited?'updated':'added'} for ${record.player}. ${baseballDeviceSaved?'Saved on this device.':'Kept in this open page; export before closing.'}`;
});
$('baseball-export').addEventListener('click',()=>{const records=chosenBaseballSessions();if(records.length)downloadFile('rangers-player-baseball-sessions.csv',baseballSessionsToCsv(records));});
$('baseball-delete-player').addEventListener('click',()=>{const player=$('baseball-player').value,count=chosenBaseballSessions().length;if(!count||!window.confirm(`Delete all ${count} baseball sessions for ${player} from this device? Export first if needed.`))return;persistBaseball(baseballRecords.filter(r=>r.player!==player));resetBaseballDraft();renderBaseballHistory();$('baseball-announcement').textContent=baseballDeviceSaved?'Player baseball sessions deleted from this device.':'Removed from this page; device saving is unavailable.';});
resetBaseballDraft();renderBaseballHistory();

workoutOverview=startWorkoutAccountability({players:PLAYER_LABELS,getRecords:()=>workoutFlow.records(),element:$,download:downloadFile,summarize:workoutActivity,toCsv:workoutActivityCsv,weekFor:workoutWeek,onSessionAction:(action,record,{remote})=>{const flow=isThrowingWorkout(record)?throwingFlow:workoutFlow;return action==='restart'?flow.restartSession(record,{confirm:false,journal:!remote}):flow.deleteSession(record,{confirm:false,journal:!remote});}});
const overspeedProtocol=startOverSpeedProgression({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,download:downloadFile,onChange:(before,after)=>teamJournal?.record('overspeed_session',before,after),onProgressChange:()=>overspeedLog?.refreshAccess(),readShared:player=>teamJournal.readOverSpeedProgress(player)});
overspeedLog=startOverSpeed({protocol:overspeedProtocol,library:OVERSPEED_LIBRARY,players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,download:downloadFile,validate:validateBatSpeedSet,upsert:upsertBatSpeedSet,summarize:summarizeBatSpeeds,contextFor:batSpeedContext,progressFor:batSpeedProgress,toCsv:batSpeedCsv,configurations:BAT_CONFIGURATIONS,devices:BAT_SPEED_DEVICES,onChange:(before,after)=>teamJournal?.record('overspeed',before,after),canUseProgram:(id,player,date)=>overspeedProtocol.canUse(id,player,date),beforePlayerChange:()=>overspeedProtocol.confirmPlayerChange(),onPlayerChanged:()=>overspeedProtocol.playerChanged()});
const pulseLog=startPulse({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,download:downloadFile,onChange:(before,after)=>teamJournal?.record('pulse',before,after)});
startPlayerReading(PLAYER_READING);
const teamSchedule=startTeamSchedule({config:TEAM_SCHEDULE_CONFIG,element:$,download:downloadFile,readRemote:()=>{if(!teamJournal)throw Error('Connect with your player code in Coach desk to refresh the schedule.');return teamJournal.readTeamSchedule();}});
document.querySelector('[data-nav="schedule"]').addEventListener('click',()=>{if(location.hash==='#schedule')void teamSchedule.activate();});
startThrowingCalendar({players:PLAYER_LABELS,scope:rosterHash.toString(16),element:$,flow:throwingFlow,subscribe:listener=>workoutFlow.subscribe(listener)});
tabPlayers=startTabPlayers({players:PLAYER_LABELS,element:$});
const routeLabels = { workouts: 'WORKOUT LOG', throwing: 'THROWING ROUTINE', schedule:'TEAM SCHEDULE', targets: 'PLYOCARE LAB', tracker: 'BASEBALL THROWS', pulse: 'DRIVELINE PULSE', blast: 'BLAST MOTION', overspeed: 'OVERSPEED PROGRAM', axe:'AXE BAT', reading: 'PLAYER READING', approach: 'TRAINING APPROACH', coach: 'COACH DESK' };
function route() {
  const key = location.hash.slice(1);
  const view = Object.hasOwn(routeLabels, key) ? key : 'workouts';
  tabPlayers.activate(view);
  for (const name of Object.keys(routeLabels)) {
    $(`view-${name}`).hidden = name !== view;
  }
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('breadcrumb-current').textContent = routeLabels[view];
  if(view==='schedule')teamSchedule.activate();
  if(view==='blast')renderBlastHistory();
  if(view==='coach'){workoutOverview?.refresh();pulseLog.refresh();}
  document.title = `Rangers | ${view === 'targets' ? 'PlyoCare Lab' : {throwing:'Throwing routine',schedule:'Team schedule',tracker:'Baseball throws',pulse:'Driveline Pulse',blast:'Blast Motion',workouts:'Workout log',overspeed:'OverSpeed program',axe:'Axe Bat',reading:'Player reading',approach:'Training approach',coach:'Coach desk'}[view]}`;
  if (started) {
    const heading = $(`view-${view}`).querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
  }
  started = true;
}
window.addEventListener('hashchange', route);
let blastResizeFrame;
window.addEventListener('resize',()=>{cancelAnimationFrame(blastResizeFrame);blastResizeFrame=requestAnimationFrame(()=>{if(!$('view-blast').hidden)renderBlastHistory();});});
route();
const dialog = $('method-dialog');
document.querySelectorAll('[data-open="method-dialog"]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) {const rect=dialog.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();} });

teamJournal=startTeamJournal({players:PLAYER_LABELS,scope:rosterHash.toString(16),getRecords:()=>({blast:blastRecords,blast_pcr:blastPcrLog.records(),workout:workoutFlow.records(),baseball:baseballRecords,overspeed_session:overspeedProtocol.records(),overspeed:overspeedLog.records(),pulse:pulseLog.records()}),element:$,download:downloadFile,changes:journalChanges,toCsv:journalToCsv,validate:validateJournalEvent});

try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Unavailable observation file');
  rows = await response.json();
  renderTargets();
} catch {
  rows = null;
  $('target-board').hidden = true;
  $('result-status').textContent = 'Reference data unavailable';
  $('result-status').className = 'status-pill neutral';
  $('result-heading').textContent = 'Reference data could not load.';
  $('velocity-error').hidden = false;
  $('velocity-error').textContent = 'Reload this page to try again. No targets are shown until the source data is available.';
  $('target-form').querySelectorAll('button, input, select').forEach(node => {node.disabled = true;});
  $('export-targets').disabled = true;
}
