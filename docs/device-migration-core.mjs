export const OLD_RANGERS_ORIGIN='https://andrewschun.github.io';
export const NEW_RANGERS_ORIGIN='https://rangerschun.github.io';
export const DEVICE_COPY_CHANNEL='rangers-device-copy-v1';
const DEVICE_COLLECTIONS=Object.freeze({'rangers-blast-v1-':'blast','rangers-blast-pcr-v1-':'blast_pcr','rangers-workouts-v1-':'workout','rangers-baseball-throws-v1-':'baseball','rangers-pulse-v1-':'pulse','rangers-overspeed-v1-':'overspeed','rangers-overspeed-sessions-v1-':'overspeed_session'});
export function migrationKeys(scope){if(!/^[a-f0-9]{1,8}$/.test(scope))throw Error('Invalid team storage reference.');return [...Object.keys(DEVICE_COLLECTIONS),'rangers-coach-journal-v1-','rangers-throwing-calendar-v1-','demo-reset-20261025-1-'].map(p=>p+scope);}
function readMigrationValue(key,raw,scope){
 if(typeof raw!=='string'||raw.length>5000000)throw Error('Saved entries are too large or unreadable.');
 if(key==='demo-reset-20261025-1-'+scope){if(raw!=='done')throw Error('Invalid reset marker.');return raw;}
 const value=JSON.parse(raw);if(!value||value.version!==1)throw Error('Saved entries use an unsupported format.');
 if(key==='rangers-throwing-calendar-v1-'+scope){if(!value.starts||typeof value.starts!=='object'||Array.isArray(value.starts))throw Error('Calendar dates could not be read.');return value;}
 const field=key==='rangers-coach-journal-v1-'+scope?'events':'records',id=field==='events'?'event_id':'id';
 if(!Array.isArray(value[field])||value[field].some(r=>!r||typeof r[id]!=='string'||!r[id]))throw Error('Saved entries could not be read.');return value;
}
export function collectDeviceEntries(storage,scope){
 const items=[];for(const key of migrationKeys(scope)){const value=storage.getItem(key);if(value!==null){readMigrationValue(key,value,scope);items.push({key,value});}}
 return {version:1,scope,items};
}
export function copyDeviceEntries(storage,bundle,scope){
 const allowed=new Set(migrationKeys(scope));if(!bundle||bundle.version!==1||bundle.scope!==scope||!Array.isArray(bundle.items)||bundle.items.length>allowed.size||JSON.stringify(bundle).length>10000000)throw Error('The entry copy did not match this team.');
 const incoming=new Map();for(const item of bundle.items){if(!item||!allowed.has(item.key)||incoming.has(item.key))throw Error('The entry copy included an unexpected item.');incoming.set(item.key,readMigrationValue(item.key,item.value,scope));}
 const journalKey='rangers-coach-journal-v1-'+scope,journalRaw=storage.getItem(journalKey),journal=journalRaw?readMigrationValue(journalKey,journalRaw,scope):{version:1,events:[]};
 const protectedRecords=new Set(journal.events.map(e=>e.kind+'/'+e.record?.id)),writes=new Map();let added=0,kept=0;
 for(const [key,value]of incoming){
  const raw=storage.getItem(key),current=raw===null?null:readMigrationValue(key,raw,scope);
  if(typeof value==='string'){writes.set(key,value);continue;}
  if(key==='rangers-throwing-calendar-v1-'+scope){writes.set(key,JSON.stringify({version:1,starts:{...value.starts,...current?.starts}}));continue;}
  const field=key===journalKey?'events':'records',id=field==='events'?'event_id':'id',existing=current?.[field]??[],known=new Set(existing.map(r=>r[id])),kind=Object.entries(DEVICE_COLLECTIONS).find(([prefix])=>key===prefix+scope)?.[1];
  const append=value[field].filter(r=>{if(known.has(r[id])){kept++;return false;}if(protectedRecords.has((field==='events'?r.kind:kind)+'/'+(field==='events'?r.record?.id:r.id))){kept++;return false;}known.add(r[id]);if(field==='records')added++;return true;});
  writes.set(key,JSON.stringify({version:1,[field]:field==='events'?[...append,...existing]:[...existing,...append]}));
 }
 const before=new Map([...writes.keys()].map(key=>[key,storage.getItem(key)])),written=[];
 try{for(const [key,value]of writes){storage.setItem(key,value);written.push(key);}}catch(error){for(const key of written.reverse()){const prior=before.get(key);if(prior===null)storage.removeItem(key);else storage.setItem(key,prior);}throw Error('The copy could not be saved. Your original entries are still at the old address.');}
 return {added,kept};
}
