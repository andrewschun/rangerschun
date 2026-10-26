import {OLD_RANGERS_ORIGIN,NEW_RANGERS_ORIGIN,DEVICE_COPY_CHANNEL,copyDeviceEntries} from './device-migration-core.mjs?v=rangers-organization-20261025';
export function startDeviceMigration({scope,element:$,window=globalThis.window,storage=globalThis.localStorage,crypto=globalThis.crypto}){
 const notice=$('site-address-notice'),message=$('site-address-message'),button=$('device-copy-entries'),again=$('device-copy-again'),status=$('device-copy-status'),marker='rangers-origin-migration-v1-'+scope;
 let pending=null;
 const origin=window?.location?.origin;
 if(origin!==OLD_RANGERS_ORIGIN&&origin!==NEW_RANGERS_ORIGIN)return;
 notice.hidden=false;
 if(origin===OLD_RANGERS_ORIGIN){message.textContent='The team site has a new address. Open it to copy this browser’s saved entries.';$('site-new-address').hidden=false;return;}
 message.textContent='Already logged workouts at the old address? Copy this browser’s saved entries here.';button.hidden=false;again.hidden=false;
 try{notice.hidden=storage.getItem(marker)==='done';}catch{}
 function begin(){
  const nonce=crypto.randomUUID(),url=new URL('/rangerschun/migration-export.html',OLD_RANGERS_ORIGIN);url.hash=new URLSearchParams({scope,nonce}).toString();
  const popup=window.open(url.href,'rangers-entry-copy','popup,width=780,height=680');
  if(!popup){notice.hidden=false;status.textContent='Allow the copy window to open, then try again.';return;}
  pending={nonce,popup};notice.hidden=false;status.textContent='In the old-site window, choose Copy saved entries. Originals stay at the old address.';
 }
 button.addEventListener('click',begin);again.addEventListener('click',begin);
 window.addEventListener('message',event=>{
  const d=event.data;if(!pending||event.origin!==OLD_RANGERS_ORIGIN||event.source!==pending.popup||!d||d.channel!==DEVICE_COPY_CHANNEL||d.nonce!==pending.nonce)return;
  pending=null;
  try{const result=copyDeviceEntries(storage,d.bundle,scope);storage.setItem(marker,'done');status.textContent=`Copied ${result.added} saved entries. Existing entries here were kept. Reloading…`;window.location.reload();}catch(error){status.textContent=error.message;}
 });
}
