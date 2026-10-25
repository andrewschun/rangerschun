// Manual daily readouts from Driveline PULSE. Workload/ACR values are never inferred here.
export const PULSE_METRICS=Object.freeze([
  {key:'total_throws',label:'Total throws',unit:'throws',integer:true,min:0,primary:true},
  {key:'high_effort_throws',label:'High-effort throws',unit:'throws',integer:true,min:0,primary:true},
  {key:'one_day_workload',label:'1-day workload',unit:'Pulse workload',min:0,primary:true},
  {key:'average_torque_nm',label:'Average elbow torque',unit:'N·m',min:0,primary:true},
  {key:'acute_workload',label:'Acute workload',unit:'Pulse workload',min:0},
  {key:'chronic_workload',label:'Chronic workload',unit:'Pulse workload',min:0},
  {key:'ac_ratio',label:'Acute : chronic ratio',unit:'ratio',min:0},
  {key:'average_arm_speed_rpm',label:'Average arm speed',unit:'rpm',min:0},
  {key:'max_arm_speed_rpm',label:'Maximum arm speed',unit:'rpm',min:0},
  {key:'arm_health_score',label:'Arm health score',unit:'1–10 · 10 feels best',integer:true,min:1,max:10},
]);
export function validatePulseRecord(record,players){
  if(!record||!Array.isArray(players)||!players.includes(record.player))throw new TypeError('Choose a player from the roster.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('This Pulse summary needs a valid record ID.');
  const time=typeof record.session_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(record.session_date)?Date.parse(record.session_date+'T12:00:00Z'):NaN;
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==record.session_date)throw new TypeError('Choose a valid Pulse date.');
  if(record.source!=='driveline_pulse_manual'||record.entry_scope!=='day')throw new TypeError('Record the daily readout from your Pulse app.');
  if(typeof record.notes!=='string'||record.notes.length>500)throw new TypeError('Keep Pulse notes within 500 characters.');
  let count=0;
  for(const metric of PULSE_METRICS){const value=record[metric.key];if(value===null)continue;count++;
    if(typeof value!=='number'||!Number.isFinite(value)||value<metric.min||(metric.max!==undefined&&value>metric.max)||(metric.integer&&!Number.isSafeInteger(value)))throw new TypeError(`${metric.label}: enter ${metric.integer?'a whole number':'a number'} ${metric.max!==undefined?`from ${metric.min} to ${metric.max}`:`of at least ${metric.min}`}, or leave it blank.`);
  }
  if(!count)throw new TypeError('Enter at least one reading from your Pulse app. Leave unavailable readings blank.');
  if(record.total_throws!==null&&record.high_effort_throws!==null&&record.high_effort_throws>record.total_throws)throw new TypeError('High-effort throws cannot exceed total throws for the same day.');
  if(record.average_arm_speed_rpm!==null&&record.max_arm_speed_rpm!==null&&record.average_arm_speed_rpm>record.max_arm_speed_rpm)throw new TypeError('Average arm speed cannot exceed maximum arm speed for the same day.');
  return true;
}
export function validatePulseRecords(records,players){
  if(!Array.isArray(records))throw new TypeError('Pulse records could not be read.');
  const ids=new Set(),days=new Set();for(const record of records){validatePulseRecord(record,players);const day=JSON.stringify([record.player,record.session_date]);if(ids.has(record.id)||days.has(day))throw new TypeError('Duplicate Pulse record or player date. Existing data has been preserved.');ids.add(record.id);days.add(day);}return true;
}
export function upsertPulseRecord(records,record,players){
  validatePulseRecords(records,players);validatePulseRecord(record,players);
  const match=records.find(r=>r.id===record.id),day=records.find(r=>r.player===record.player&&r.session_date===record.session_date);
  if(match&&match.player!==record.player)throw new Error('Pulse identity conflict; this change was not saved.');
  if(day&&day.id!==record.id)throw new Error('This player already has a Pulse summary for that date. Open that date to update it.');
  const copy={...record,...(match?.created_at?{created_at:match.created_at}:{})};return match?records.map(r=>r.id===record.id?copy:r):[...records,copy];
}
export function latestPulseRecords(records,players){
  validatePulseRecords(records,players);return players.map(player=>({player,record:records.filter(r=>r.player===player).sort((a,b)=>b.session_date.localeCompare(a.session_date))[0]??null}));
}
export function pulseRecordsToCsv(records){
  const keys=['id','player','session_date','source','entry_scope',...PULSE_METRICS.map(m=>m.key),'notes','created_at','updated_at'];
  const cell=value=>'"'+String(typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value??'').replaceAll('"','""')+'"';
  return [keys,...records.map(r=>keys.map(key=>r[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}
