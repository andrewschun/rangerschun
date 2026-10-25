import { validateWorkout } from './engine.mjs';
import { ENTRY_HEADERS } from './journal.mjs';
import { workoutExerciseRecorded, workoutChecklistProgress } from './workout-checklist.mjs';

function activityDate(value){
  const time=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T12:00:00Z'):NaN;
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new TypeError('Choose valid workout dates.');
  return time;
}
export function workoutWeek(date){
  const stamp=new Date(activityDate(date)),offset=(stamp.getUTCDay()+6)%7;
  stamp.setUTCDate(stamp.getUTCDate()-offset);const from=stamp.toISOString().slice(0,10);
  stamp.setUTCDate(stamp.getUTCDate()+6);return {from,to:stamp.toISOString().slice(0,10)};
}
export function workoutActualDetails(record){
  if(record.entry_mode==='plan_checklist')return workoutChecklistProgress(record);
  const complete=record.exercises.filter(workoutExerciseRecorded).length;
  return {recorded:complete,total:record.exercises.length,all:complete===record.exercises.length};
}
export function workoutActivity(records,players,{from,to}){
  activityDate(from);activityDate(to);if(from>to)throw new TypeError('The start date must be on or before the end date.');
  if(!Array.isArray(records)||!Array.isArray(players)||new Set(players).size!==players.length)throw new TypeError('Invalid workout overview.');
  const seen=new Set();for(const record of records){validateWorkout(record,players);const key=JSON.stringify([record.player,record.id]);if(seen.has(key))throw new Error('Duplicate workout identity.');seen.add(key);}
  const selected=records.filter(record=>record.session_date>=from&&record.session_date<=to);
  const rows=players.map(player=>{
    const entries=selected.filter(record=>record.player===player).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.coach_last_received_at??b.updated_at??b.created_at??'').localeCompare(String(a.coach_last_received_at??a.updated_at??a.created_at??'')));
    return {player,logged:entries.length,completed:entries.filter(r=>r.completion_status==='completed'&&r.completion_confirmed===true&&workoutActualDetails(r).all).length,partial:entries.filter(r=>r.completion_status==='partial').length,earlier_logs:entries.filter(r=>!r.completion_status).length,details_missing:entries.filter(r=>r.entry_mode!=='plan_checklist'&&!workoutActualDetails(r).all).length,last_workout_date:entries[0]?.session_date??null,records:entries};
  });
  return {from,to,rows,players_logged:rows.filter(row=>row.logged>0).length,players_without_entries:rows.filter(row=>row.logged===0).length,workouts_logged:selected.length,completed_reports:rows.reduce((sum,row)=>sum+row.completed,0)};
}
/** Replay the coach's append-only sheet in row order. Edits replace one record; deletes remove it. */
export function workoutsFromJournal(sheetRows,players){
  const columns=Object.fromEntries(ENTRY_HEADERS.map((key,index)=>[key,index]));
  const records=new Map(),firstReceipt=new Map(),seenEvents=new Set();
  for(const row of sheetRows){
    if(row[columns.entry_type]!=='workout')continue;
    const player=row[columns.player];if(!players.includes(player))continue;
    const eventId=row[columns.event_id];if(!eventId||seenEvents.has(eventId))continue;seenEvents.add(eventId);
    const operation=row[columns.operation];if(!['save','delete'].includes(operation))throw new Error('A workout change in the coach sheet has an invalid operation.');
    const key=JSON.stringify([player,row[columns.record_id]]);
    if(operation==='delete'){records.delete(key);continue;}
    let record;try{record=JSON.parse([row[columns.record_json_1],row[columns.record_json_2],row[columns.record_json_3]].map(v=>v??'').join(''));}catch{throw new Error('A workout in the coach sheet has unreadable exercise details.');}
    if(record.player!==player||record.id!==row[columns.record_id])throw new Error('Workout identity does not match the coach sheet.');
    validateWorkout(record,players);
    const rawReceipt=row[columns.received_at],receipt=rawReceipt instanceof Date?rawReceipt.toISOString():typeof rawReceipt==='string'&&Number.isFinite(Date.parse(rawReceipt))?rawReceipt:null;
    if(!firstReceipt.has(key))firstReceipt.set(key,receipt);
    records.set(key,{...record,coach_first_received_at:firstReceipt.get(key),coach_last_received_at:receipt});
  }
  return [...records.values()];
}
export function workoutActivityCsv(activity){
  const rows=[['player','from_date','to_date','workouts_logged','reported_completed','reported_partial','earlier_logs','entries_missing_actual_details','latest_workout_date'],...activity.rows.map(r=>[r.player,activity.from,activity.to,r.logged,r.completed,r.partial,r.earlier_logs,r.details_missing,r.last_workout_date])];
  const cell=value=>'"'+String(typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value??'').replaceAll('"','""')+'"';
  return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
