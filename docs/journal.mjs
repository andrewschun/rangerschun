import { validateOverSpeedSession } from './overspeed-progression.mjs';
import { validatePulseRecord } from './pulse.mjs';
import { validateBlastPcrSession, blastPcrJournalLabel, BLAST_SESSION_METRICS } from './blast-pcr.mjs';
import { BLAST_METRICS, validateBlastRecord, validateWorkout, validateBaseballSession, summarizeThrows } from './engine.mjs';
import { validateBatSpeedSet, summarizeBatSpeeds } from './overspeed.mjs';

export const ENTRY_HEADERS = Object.freeze(['event_id','received_at','entry_type','operation','record_id','player','session_date','title_or_drill','bat_or_radar',...BLAST_METRICS.map(m=>m.key),...Array.from({length:8},(_,i)=>'throw_'+(i+1)),'maximum_mph','average_top_5_mph','valid_throw_count','distance_ft','duration_minutes','effort','notes','record_json_1','record_json_2','record_json_3']);
export function validateJournalEvent(event,players){
  if(!event||typeof event.event_id!=='string'||!/^[a-zA-Z0-9_-]{8,120}$/.test(event.event_id))throw new TypeError('Invalid entry identity.');
  if(!['blast','blast_pcr','baseball','workout','overspeed','pulse','overspeed_session'].includes(event.kind)||!['save','delete'].includes(event.operation))throw new TypeError('Unsupported entry type.');
  const record=event.record;
  if(!record||record.player!==event.player||!players.includes(event.player))throw new TypeError('Player identity mismatch.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('Invalid record identity.');
  if(event.kind==='blast')validateBlastRecord(record,players);
  if(event.kind==='blast_pcr')validateBlastPcrSession(record,players);
  if(event.kind==='workout')validateWorkout(record,players);
  if(event.kind==='baseball')validateBaseballSession(record,players);
  if(event.kind==='overspeed')validateBatSpeedSet(record,players);
  if(event.kind==='overspeed_session')validateOverSpeedSession(record,players);
  if(event.kind==='pulse')validatePulseRecord(record,players);
  if(JSON.stringify(event).length>120000)throw new RangeError('This entry is too large to submit.');
  return true;
}
export function journalChanges(kind,before,after,makeId,now){
  const old=new Map(before.map(r=>[r.id,r])),next=new Map(after.map(r=>[r.id,r]));
  return [...after.filter(r=>JSON.stringify(old.get(r.id))!==JSON.stringify(r)).map(record=>({operation:'save',record})),...before.filter(r=>!next.has(r.id)).map(record=>({operation:'delete',record}))]
    .map(({operation,record})=>({event_id:makeId(),client_at:now,kind,operation,player:record.player,record:JSON.parse(JSON.stringify(record))}));
}
export function journalRow(event,received=''){
  const r=event.record,stats=event.kind==='baseball'?summarizeThrows(r.throws.filter(v=>v!==null)):null,speed=event.kind==='overspeed'?summarizeBatSpeeds(r.swings_mph):null;
  const json=JSON.stringify(r),throws=event.kind==='baseball'?r.throws:Array(8).fill(null);
  return [event.event_id,received,event.kind,event.operation,r.id,r.player,r.session_date,event.kind==='blast_pcr'?blastPcrJournalLabel(r):event.kind==='pulse'?'Pulse daily summary':r.title??r.drill??r.context??r.drill_id??'',r.bat??r.device??r.bat_label??'',...BLAST_METRICS.map(m=>event.kind==='blast_pcr'?(BLAST_SESSION_METRICS.some(metric=>metric.key===m.key)?r[m.key]??null:null):m.key==='bat_speed_mph'&&speed?speed.mean_mph:r[m.key]??null),...throws,stats?.max??speed?.best_mph??null,stats?.averageTop5??null,stats?.count??null,r.distance_ft??null,r.duration_minutes??null,r.effort??'',r.notes??'',json.slice(0,40000),json.slice(40000,80000),json.slice(80000,120000)];
}
export function journalToCsv(events){
  const cell=v=>'"'+String(typeof v==='string'&&/^\s*[=+@-]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';
  return [ENTRY_HEADERS,...events.map(e=>journalRow(e,e.received_at??''))].map(row=>row.map(cell).join(',')).join('\r\n');
}
