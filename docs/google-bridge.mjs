// GitHub Pages has no Apps Script runtime. A hidden Google HTML-service page
// relays only the existing, validated server methods and returns real receipts.
export const GOOGLE_BRIDGE_METHODS=Object.freeze(['getConnectionSettings','verifyPlayer','writeJournal','getTeamSchedule','getConcentrationSummary','getMyOverSpeedSessions','getCoachWorkouts','getCoachPulse','mutateCoachWorkout']);
export function isGoogleBridgeOrigin(origin){
 try{const url=new URL(origin);return url.origin===origin&&url.protocol==='https:'&&(url.hostname==='script.google.com'||url.hostname==='script.googleusercontent.com'||url.hostname.endsWith('-script.googleusercontent.com'));}catch{return false;}
}
export function createGoogleBridge(config,{window=globalThis.window,document=globalThis.document,crypto=globalThis.crypto,timeoutMs=20000}={}){
 const url=new URL(config.url);
 if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error('Invalid Google deployment URL.');
 if(!/^https:\/\/[a-zA-Z0-9-]+\.github\.io$/.test(config.origin)||window.location.origin!==config.origin)throw Error('This coach connection is not configured for this website.');
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join(''),channel='rangers-google-bridge-v1';
 const pending=new Map();let peer=null,peerOrigin='',closed=false,counter=0;
 function send(entry){if(peer)peer.postMessage({channel,nonce,type:'request',id:entry.id,method:entry.method,args:entry.args},peerOrigin);}
 function receive(event){
  const data=event.data;
  if(closed||!isGoogleBridgeOrigin(event.origin)||!data||data.channel!==channel||data.nonce!==nonce||!event.source)return;
  if(data.type==='ready'){
   if(peer&&peer!==event.source)return;peer=event.source;peerOrigin=event.origin;
   for(const entry of pending.values())if(!entry.sent){entry.sent=true;send(entry);}return;
  }
  if(event.source!==peer||event.origin!==peerOrigin||data.type!=='response')return;
  const entry=pending.get(data.id);if(!entry)return;
  clearTimeout(entry.timer);pending.delete(data.id);
  if(data.ok===true)entry.resolve(data.value);else entry.reject(Error(typeof data.error==='string'?data.error:'The coach sheet did not confirm this request.'));
 }
 window.addEventListener('message',receive);
 const frame=document.createElement('iframe');frame.hidden=true;frame.title='Private coach sheet connection';frame.referrerPolicy='no-referrer';url.searchParams.set('mode','github-bridge');url.searchParams.set('nonce',nonce);url.searchParams.set('origin',config.origin);frame.src=url.href;document.body.append(frame);
 function call(method,args=[]){
  if(closed)return Promise.reject(Error('The coach connection is closed.'));
  if(!GOOGLE_BRIDGE_METHODS.includes(method)||!Array.isArray(args)||args.length>2)return Promise.reject(Error('Unsupported coach request.'));
  try{if(JSON.stringify(args).length>700000)return Promise.reject(Error('The coach request is too large.'));}catch{return Promise.reject(Error('Invalid coach request.'));}
  return new Promise((resolve,reject)=>{
   const id=nonce+'-'+(++counter),entry={id,method,args,resolve,reject,sent:Boolean(peer)};
   entry.timer=setTimeout(()=>{pending.delete(id);reject(Error('The Google coach connection did not respond. Entries remain waiting.'));},timeoutMs);
   pending.set(id,entry);if(peer)send(entry);
  });
 }
 function runner(success,failure){
  const api={withSuccessHandler(fn){return runner(fn,failure);},withFailureHandler(fn){return runner(success,fn);}};
  for(const method of GOOGLE_BRIDGE_METHODS)api[method]=(...args)=>{void call(method,args).then(value=>success?.(value),error=>failure?.(error));};
  return api;
 }
 return {run:runner(),call,dispose(){closed=true;window.removeEventListener('message',receive);frame.remove();for(const e of pending.values()){clearTimeout(e.timer);e.reject(Error('The coach connection closed.'));}pending.clear();}};
}
export function installGoogleBridge(config){
 if(!config||globalThis.google?.script?.run)return null;
 if(globalThis.location?.origin!==config.origin)return null;
 const bridge=createGoogleBridge(config);globalThis.google={script:{run:bridge.run}};return bridge;
}
