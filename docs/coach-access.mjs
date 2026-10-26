// This browser-only gate does not replace server authorization for shared records.
const COACH_PASSWORD_DIGEST='79799b75d2b1c814ada4dda4b95b6161aa9490f2521e76e312559b699751e24e';
export async function coachPasswordMatches(value,crypto=globalThis.crypto){
 const bytes=new TextEncoder().encode('rangers-coach-access-v1\0'+String(value??''));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===COACH_PASSWORD_DIGEST;
}
export function startCoachAccess({element:$,matches=coachPasswordMatches,onUnlock=()=>{}}){
 const panel=$('coach-access-panel'),content=$('coach-access-content'),input=$('coach-access-password'),error=$('coach-access-error'),submit=$('coach-access-submit');
 let verified=false,attempt=0;
 function render(){panel.hidden=verified;content.hidden=!verified;content.inert=!verified;}
 function lock(){attempt++;verified=false;input.value='';error.hidden=true;submit.disabled=false;render();}
 $('coach-access-form').addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled)return;const token=++attempt;submit.disabled=true;error.hidden=true;
  let valid=false;try{valid=await matches(input.value);}catch{if(token!==attempt)return;error.textContent='The password check could not run. Reload this page and try again.';error.hidden=false;submit.disabled=false;input.value='';return;}
  if(token!==attempt)return;input.value='';submit.disabled=false;
  if(!valid){error.textContent='That password does not match. Try again.';error.hidden=false;input.focus();return;}
  verified=true;render();onUnlock();$('coach-access-lock').focus();
 });
 content.addEventListener('submit',event=>{if(!verified){event.preventDefault();event.stopImmediatePropagation();}},true);
 $('coach-access-lock').addEventListener('click',()=>{lock();input.focus();});
 lock();return {activate(view){if(view!=='coach'){attempt++;input.value='';error.hidden=true;submit.disabled=false;}render();},isVerified:()=>verified,lock};
}
