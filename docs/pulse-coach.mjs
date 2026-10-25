import { ENTRY_HEADERS } from './journal.mjs';
import { validatePulseRecord, validatePulseRecords } from './pulse.mjs';

export function pulseFromJournal(rows,players){
  const col=Object.fromEntries(ENTRY_HEADERS.map((key,i)=>[key,i])),days=new Map(),locations=new Map(),seen=new Set(),first=new Map();
  for(const row of rows){
    if(row[col.entry_type]!=='pulse')continue;
    const player=row[col.player],event=row[col.event_id];if(!players.includes(player)||!event||seen.has(event))continue;seen.add(event);
    const key=JSON.stringify([player,row[col.record_id]]),operation=row[col.operation];
    if(!['save','delete'].includes(operation))throw Error('A Pulse change in the coach sheet has an invalid operation.');
    let record;try{record=JSON.parse([row[col.record_json_1],row[col.record_json_2],row[col.record_json_3]].map(v=>v??'').join(''));}catch{throw Error('A Pulse summary in the coach sheet could not be read.');}
    if(record.player!==player||record.id!==row[col.record_id])throw Error('Pulse identity does not match the coach sheet.');validatePulseRecord(record,players);
    const day=JSON.stringify([player,record.session_date]);
    if(operation==='delete'){if(days.get(day)?.id===record.id)days.delete(day);locations.delete(key);continue;}
    const raw=row[col.received_at],receipt=raw instanceof Date?raw.toISOString():typeof raw==='string'&&Number.isFinite(Date.parse(raw))?raw:null;
    const priorDay=locations.get(key);if(priorDay&&priorDay!==day&&days.get(priorDay)?.id===record.id)days.delete(priorDay);
    if(!first.has(key))first.set(key,receipt);locations.set(key,day);days.set(day,{...record,coach_first_received_at:first.get(key),coach_last_received_at:receipt});
  }
  // Two phones can independently create the same day before either syncs. Keep the
  // last accepted snapshot for that player/date; never add cumulative daily totals.
  const result=[...days.values()];validatePulseRecords(result,players);return result;
}
