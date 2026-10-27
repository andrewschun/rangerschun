// Rangers device/cloud reconciliation. Pure functions; never overwrite unsent changes.
export const COLLECTIONS=Object.freeze({
  blast:'rangers-blast-v1-',blast_pcr:'rangers-blast-pcr-v1-',
  baseball:'rangers-baseball-throws-v1-',workout:'rangers-workouts-v1-',
  overspeed:'rangers-overspeed-v1-',overspeed_session:'rangers-overspeed-sessions-v1-',
  pulse:'rangers-pulse-v1-'
});
export const ROSTER_SCOPE_NAMES=Object.freeze(['Aidan','Ambrose','Andre','Carson','Carter','Jayden','Joseph','Josh','Max','Michael','Nathan','Raiden','Rory','Walker']);
export function rosterScope(names=ROSTER_SCOPE_NAMES){
  let hash=2166136261;
  for(const char of JSON.stringify(names))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return hash.toString(16);
}
export function journalKey(scope){return 'rangers-coach-journal-v1-'+scope;}
export function readCollection(storage,key,field){
  const raw=storage.getItem(key);
  if(raw===null)return {version:1,[field]:[]};
  const parsed=JSON.parse(raw);
  if(!parsed||parsed.version!==1||!Array.isArray(parsed[field]))throw Error('Existing device records could not be read. Nothing was changed.');
  if(parsed[field].some(item=>!item||typeof item[field==='events'?'event_id':'id']!=='string'))throw Error('Existing device records are invalid. Nothing was changed.');
  return parsed;
}
function validateEvent(event,player,remote=false){
  if(!event||!Object.hasOwn(COLLECTIONS,event.kind)||!['save','delete'].includes(event.operation)||
     typeof event.event_id!=='string'||!event.event_id||event.player!==player||
     !event.record||event.record.player!==player||typeof event.record.id!=='string'||!event.record.id)
    throw Error('The coach sheet returned an invalid entry; no device records were changed.');
  if(remote&&typeof event.received_at!=='string')throw Error('A cloud receipt is missing. Nothing was changed.');
}
export function mergePlayerEvents(storage,{scope,player,remoteEvents}){
  if(typeof scope!=='string'||! /^[a-f0-9]{1,8}$/.test(scope)||typeof player!=='string'||!player||!Array.isArray(remoteEvents)||remoteEvents.length>3500)
    throw Error('The player sync response is invalid.');
  if(JSON.stringify(remoteEvents).length>12000000)throw Error('The cloud history is too large to restore safely.');
  const incoming=new Map();
  for(const event of remoteEvents){validateEvent(event,player,true);if(incoming.has(event.event_id))throw Error('Duplicate cloud event; no records changed.');incoming.set(event.event_id,event);}
  const jKey=journalKey(scope),journal=readCollection(storage,jKey,'events');
  const local=journal.events;
  const localSeen=new Set(local.map(e=>e.event_id));
  const pending=local.filter(e=>e.player===player&&!e.received_at&&!incoming.has(e.event_id));
  for(const event of pending)validateEvent(event,player);
  const changes=new Map(),touched=new Map();
  const apply=event=>{
    let set=changes.get(event.kind),seen=touched.get(event.kind);
    if(!set){set=new Map();changes.set(event.kind,set);seen=new Set();touched.set(event.kind,seen);}
    seen.add(event.record.id);
    if(event.operation==='delete')set.delete(event.record.id);
    else set.set(event.record.id,event.record);
  };
  for(const event of remoteEvents)apply(event);
  for(const event of pending)apply(event);
  const writes=new Map();let restored=0,removed=0;
  for(const [kind,prefix] of Object.entries(COLLECTIONS)){
    const key=prefix+scope, data=readCollection(storage,key,'records'),seen=touched.get(kind)||new Set(),next=changes.get(kind)||new Map();
    const updated=[];
    for(const record of data.records){
      if(!record||typeof record.id!=='string')throw Error('Invalid local record; nothing was changed.');
      if(record.player!==player||!seen.has(record.id))updated.push(record);
      else if(!next.has(record.id))removed++;
    }
    for(const [id,record] of next){
      updated.push(record);restored++;
    }
    if(seen.size)writes.set(key,JSON.stringify({...data,records:updated}));
  }
  const mergedEvents=[...local.map(e=>incoming.has(e.event_id)?{...e,received_at:incoming.get(e.event_id).received_at}:e),
    ...remoteEvents.filter(e=>!localSeen.has(e.event_id))];
  writes.set(jKey,JSON.stringify({...journal,events:mergedEvents}));
  const before=new Map([...writes.keys()].map(key=>[key,storage.getItem(key)])),completed=[];
  try{
    for(const[key,value]of writes){storage.setItem(key,value);completed.push(key);}
  }catch(error){
    for(const key of completed.reverse()){const old=before.get(key);try{if(old===null)storage.removeItem(key);else storage.setItem(key,old);}catch{}}
    throw Error('Storage could not be updated. Existing entries were restored where possible; export a device backup.');
  }
  return {restored,removed,newReceipts:remoteEvents.filter(e=>!localSeen.has(e.event_id)).length,pending:pending.length};
}
export function pendingForPlayer(storage,scope,player){
  const events=readCollection(storage,journalKey(scope),'events').events.filter(e=>e.player===player&&!e.received_at);
  for(const e of events)validateEvent(e,player);
  return events;
}
export function acknowledgeBatch(storage,scope,accepted){
  if(!Array.isArray(accepted)||accepted.some(e=>!e||typeof e.event_id!=='string'||typeof e.received_at!=='string'))throw Error('The coach receipt was invalid.');
  const key=journalKey(scope),data=readCollection(storage,key,'events'),receipt=new Map(accepted.map(e=>[e.event_id,e.received_at]));
  if(receipt.size!==accepted.length)throw Error('Duplicate coach receipt.');
  if(accepted.some(e=>!data.events.some(a=>a.event_id===e.event_id)))throw Error('A receipt did not match a saved entry.');
  storage.setItem(key,JSON.stringify({...data,events:data.events.map(e=>receipt.has(e.event_id)?{...e,received_at:receipt.get(e.event_id)}:e)}));
}
