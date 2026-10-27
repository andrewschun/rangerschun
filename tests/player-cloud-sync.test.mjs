import assert from 'node:assert/strict';
import test from 'node:test';
import {rosterScope,mergePlayerEvents,pendingForPlayer,acknowledgeBatch,COLLECTIONS} from '../docs/player-cloud-sync-core.mjs';
const store=()=>{let m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const event=(id,kind,op,player,recordId,received)=>({event_id:id,kind,operation:op,player,record:{id:recordId,player,session_date:'2026-10-01'},...(received?{received_at:received}:{})});
test('Scope remains compatible with existing local records',()=>assert.match(rosterScope(),/^[a-f0-9]{1,8}$/));
test('Restore keeps other players, prevents resurrection, keeps pending edits',()=>{
 const scope=rosterScope(),storage=store(),key=COLLECTIONS.workout+scope,stamp='2026-10-26T16:00:00Z';
 storage.setItem(key,JSON.stringify({version:1,records:[{id:'old',player:'Aidan'},{id:'other',player:'Ambrose'}]}));
 const localEvent=event('unsent111','workout','save','Aidan','old');
 storage.setItem('rangers-coach-journal-v1-'+scope,JSON.stringify({version:1,events:[localEvent]}));
 const cloud=[event('received1','workout','delete','Aidan','old',stamp),event('received2','workout','save','Aidan','new',stamp)];
 const out=mergePlayerEvents(storage,{scope,player:'Aidan',remoteEvents:cloud});
 const ids=JSON.parse(storage.getItem(key)).records.map(r=>r.id).sort();
 assert.deepEqual(ids,['new','old','other']);assert.equal(out.pending,1);
});
test('Receipt stops a pending deletion being replayed',()=>{
 const scope=rosterScope(),storage=store(),key=COLLECTIONS.workout+scope,stamp='2026-10-26T16:00:00Z';
 storage.setItem(key,JSON.stringify({version:1,records:[{id:'old',player:'Aidan'}]}));
 const deletion=event('receipt111','workout','delete','Aidan','old');
 storage.setItem('rangers-coach-journal-v1-'+scope,JSON.stringify({version:1,events:[deletion]}));
 mergePlayerEvents(storage,{scope,player:'Aidan',remoteEvents:[{...deletion,received_at:stamp}]});
 assert.deepEqual(JSON.parse(storage.getItem(key)).records,[]);
 assert.deepEqual(pendingForPlayer(storage,scope,'Aidan'),[]);
});
test('Wrong player response does not change storage',()=>{
 const s=store(),scope=rosterScope(),key=COLLECTIONS.workout+scope;
 s.setItem(key,'{"version":1,"records":[]}');
 assert.throws(()=>mergePlayerEvents(s,{scope,player:'Aidan',remoteEvents:[event('cloud123','workout','save','Ambrose','bad','2026-10-27T01:00:00Z')]}));
 assert.equal(s.getItem(key),'{"version":1,"records":[]}');
});
test('Batch acknowledgement verifies event IDs',()=>{
 const scope=rosterScope(),s=store(),key='rangers-coach-journal-v1-'+scope;
 const e=event('local111','blast','save','Aidan','swing1');
 s.setItem(key,JSON.stringify({version:1,events:[e]}));
 assert.throws(()=>acknowledgeBatch(s,scope,[{event_id:'unknown',received_at:'x'}]));
 acknowledgeBatch(s,scope,[{event_id:'local111',received_at:'2026-10-27T01:00:00Z'}]);
 assert.equal(pendingForPlayer(s,scope,'Aidan').length,0);
});
