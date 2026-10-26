export const DEMO_RESET_VERSION='demo-reset-20261025-1';
export function prepareDemoReset(storage,scope,players){
 const marker=DEMO_RESET_VERSION+'-'+scope;if(!players.includes('Demo'))return {pending:false,marker};
 try{if(storage.getItem(marker)==='done')return {pending:false,marker};const key='rangers-throwing-calendar-v1-'+scope,raw=storage.getItem(key);if(raw){const calendar=JSON.parse(raw);if(calendar.version===1&&calendar.starts&&Object.hasOwn(calendar.starts,'Demo')){delete calendar.starts.Demo;storage.setItem(key,JSON.stringify(calendar));}}return {pending:true,marker};}
 catch{return {pending:false,marker,error:'Demo reset could not access saved data on this device.'};}
}
export function runDemoReset({storage,scope,state,clear}){
 if(!state.pending)return false;
 for(const action of clear)action('Demo');
 // Confirm the active records are clear before marking this one-time reset as applied.
 for(const prefix of ['rangers-blast-v1-','rangers-blast-pcr-v1-','rangers-workouts-v1-','rangers-baseball-throws-v1-','rangers-pulse-v1-','rangers-overspeed-v1-','rangers-overspeed-sessions-v1-']){
  const raw=storage.getItem(prefix+scope);if(raw&&JSON.parse(raw).records?.some(r=>r.player==='Demo'))throw Error('Demo entries could not all be cleared from device storage.');
 }
 storage.setItem(state.marker,'done');return true;
}
