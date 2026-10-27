import {rosterScope,mergePlayerEvents,pendingForPlayer,acknowledgeBatch} from './player-cloud-sync-core.mjs';
const panel=document.getElementById('player-cloud-sync');
const form=document.getElementById('player-cloud-sync-form');
const input=document.getElementById('player-cloud-sync-code');
const status=document.getElementById('player-cloud-sync-status');
const submit=document.getElementById('player-cloud-sync-submit');
const playerField=document.getElementById('workout-player');
const scope=rosterScope();
const show=message=>{status.textContent=message;};
function call(method,args){
  return new Promise((resolve,reject)=>{
    let finished=false;
    const timer=setTimeout(()=>{if(!finished){finished=true;reject(Error('The coach connection timed out. No device records were imported.'));}},26000);
    const success=value=>{if(!finished){finished=true;clearTimeout(timer);resolve(value);}};
    const failure=()=>{if(!finished){finished=true;clearTimeout(timer);reject(Error('The coach connection rejected the request. Check your private code or ask the coach to activate cloud restore.'));}};
    try{
      const runner=globalThis.google?.script?.run;
      if(!runner||typeof runner[method]!=='function')throw Error('Secure cloud restore is not enabled on this site.');
      runner.withSuccessHandler(success).withFailureHandler(failure)[method](args);
    }catch(error){if(!finished){finished=true;clearTimeout(timer);reject(error);}}
  });
}
if(panel&&form&&input&&status&&submit&&playerField){
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const player=playerField.value,code=input.value.trim();
    if(!player||panel.closest('.view')?.dataset.playerAccess!=='verified'){
      show('Choose and unlock your player in Workout log first.');return;
    }
    if(!code){show('Enter your private coach-issued submission code, not your jersey password.');return;}
    submit.disabled=true;
    try{
      show('Verifying access to your private coach records…');
      let response=await call('getMyPlayerRecords',{player,code});
      if(response?.version!==1||response.player!==player||!Array.isArray(response.events))throw Error('The coach sheet returned an unexpected player record response.');
      const waiting=pendingForPlayer(localStorage,scope,player);
      for(let i=0;i<waiting.length;i+=5){
        show('Sending your waiting entries to the coach sheet ('+Math.min(i+5,waiting.length)+' of '+waiting.length+')…');
        const batch=waiting.slice(i,i+5);
        const result=await call('writeJournal',{player,code,events:batch.map(({received_at,...e})=>e)});
        const accepted=result?.accepted;
        if(!Array.isArray(accepted)||!accepted.length||accepted.some(e=>!batch.some(b=>b.event_id===e.event_id)))throw Error('The coach did not confirm the waiting entries. Your device copy is unchanged.');
        acknowledgeBatch(localStorage,scope,accepted);
      }
      if(waiting.length){
        show('Loading the latest confirmed records…');
        response=await call('getMyPlayerRecords',{player,code});
        if(response?.version!==1||response.player!==player||!Array.isArray(response.events))throw Error('The updated cloud response was invalid.');
      }
      const count=mergePlayerEvents(localStorage,{scope,player,remoteEvents:response.events});
      show('Cloud sync complete: '+count.restored+' records loaded, '+count.pending+' changes still waiting. Reloading the page…');
      window.setTimeout(()=>window.location.reload(),650);
    }catch(error){show(error?.message||'Sync could not be completed. Your device records were kept.');}
    finally{input.value='';submit.disabled=false;}
  });
}
