import { ENTRY_HEADERS } from './journal.mjs?v=combined-workouts-20261025';
import { validateOverSpeedSession,validateOverSpeedSessions,upsertOverSpeedSession } from './overspeed-progression.mjs?v=combined-workouts-20261025';

export function overSpeedSessionsFromJournal(rows,players){
  const col=Object.fromEntries(ENTRY_HEADERS.map((k,i)=>[k,i])),records=new Map(),seen=new Set();
  for(const row of rows){if(row[col.entry_type]!=='overspeed_session')continue;const id=row[col.event_id],player=row[col.player];if(!id||seen.has(id)||!players.includes(player))continue;seen.add(id);const operation=row[col.operation],key=JSON.stringify([player,row[col.record_id]]);
    if(operation==='delete'){records.delete(key);continue;}if(operation!=='save')throw Error('Invalid OverSpeed workout change in coach records.');
    let record;try{record=JSON.parse([row[col.record_json_1],row[col.record_json_2],row[col.record_json_3]].map(v=>v??'').join(''));}catch{throw Error('An OverSpeed workout could not be read.');}
    if(record.player!==player||record.id!==row[col.record_id])throw Error('OverSpeed workout identity mismatch.');validateOverSpeedSession(record,players);records.set(key,record);
  }
  const result=[...records.values()];validateOverSpeedSessions(result,players);return result;
}
export function validateOverSpeedWorkoutBatch(rows,events,players,asOf){
  const known=new Set(rows.map(row=>row[0]));let records=overSpeedSessionsFromJournal(rows,players);
  for(const event of events){if(known.has(event.event_id)||event.kind!=='overspeed_session')continue;
    if(event.operation==='delete')records=records.filter(r=>r.id!==event.record.id||r.player!==event.player);
    else records=upsertOverSpeedSession(records,event.record,players,asOf);known.add(event.event_id);
  }
  return records;
}
