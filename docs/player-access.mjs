import {TAB_PLAYER_IDS} from './tab-players.mjs?v=player-jersey-check-20261025';

// A browser-only jersey check. It does not authenticate Google requests or protect public assets.
export async function jerseyCodeMatches(player,code,hashes,crypto=globalThis.crypto){
 const value=String(code??'').trim().replace(/^#/,'');
 if(!/^\d{1,3}$/.test(value)||!Object.hasOwn(hashes??{},player))return false;
 const bytes=new TextEncoder().encode('rangers-jersey-v1\0'+player+'\0'+value);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===hashes[player];
}
export function startPlayerAccess({players,hashes,element:$,matches=jerseyCodeMatches}){
 const verified=new Set(),accepted=new Map(),allowed=new WeakSet();let pending=null,attempt=0;
 const dialog=$('player-access-dialog'),input=$('player-access-code'),error=$('player-access-error'),submit=$('player-access-submit');
 function render(){
  for(const [view,id]of Object.entries(TAB_PLAYER_IDS)){
   const select=$(id),section=$('view-'+view),unlocked=verified.has(select.value),bar=[...section.children].find(n=>n.classList.contains('tab-player-bar'));
   section.dataset.playerAccess=unlocked?'verified':'locked';$('access-message-'+view).hidden=unlocked;
   for(const child of section.children)if(child!==bar&&!child.classList.contains('page-heading')&&!child.classList.contains('player-access-message'))child.inert=!unlocked;
   if(bar)for(const field of bar.children)if(!field.contains(select))field.inert=!unlocked;
  }
 }
 function dismiss(){attempt++;pending=null;input.value='';error.hidden=true;submit.disabled=false;if(dialog.open)dialog.close();render();}
 function request(select,name){
  attempt++;pending={select,name};input.value='';error.hidden=true;
  const configured=Object.hasOwn(hashes??{},name);input.disabled=!configured;submit.disabled=!configured;
  $('player-access-name').textContent=name;$('player-access-help').textContent=configured?'Enter your jersey number to continue.':'Your jersey number has not been set up yet. Please ask your coach.';
  if(!dialog.open)dialog.showModal();if(configured)input.focus();render();
 }
 for(const [view,id]of Object.entries(TAB_PLAYER_IDS)){
  const select=$(id);accepted.set(id,select.value);select.addEventListener('focus',()=>accepted.set(id,select.value),true);
  select.addEventListener('change',event=>{
   const name=select.value;
   if(allowed.has(select)){allowed.delete(select);return;}
   if(!name||event.isTrusted===false&&verified.has(name)){queueMicrotask(()=>{accepted.set(id,select.value);render();});return;}
   event.stopImmediatePropagation();select.value=accepted.get(id)??'';request(select,name);
  },true);
  // Direct history/coach actions can set a player without dispatching a picker change.
  $('view-'+view).addEventListener('submit',event=>{
   if(verified.has(select.value))return;
   event.preventDefault();event.stopImmediatePropagation();if(select.value)request(select,select.value);
  },true);
 }
 $('player-access-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!pending||submit.disabled)return;
  const selected=pending,token=++attempt;submit.disabled=true;error.hidden=true;
  let valid=false;try{valid=await matches(selected.name,input.value,hashes);}catch{if(token===attempt){error.textContent='The jersey check could not run. Please reload this page and try again.';error.hidden=false;submit.disabled=false;}return;}
  if(token!==attempt)return;
  if(!valid){error.textContent='That jersey number does not match. Try again.';error.hidden=false;submit.disabled=false;input.value='';input.focus();return;}
  verified.add(selected.name);dialog.close();pending=null;input.value='';submit.disabled=false;
  allowed.add(selected.select);selected.select.value=selected.name;selected.select.dispatchEvent(new Event('change',{bubbles:true}));
  accepted.set(selected.select.id,selected.select.value);render();
 });
 $('player-access-cancel').addEventListener('click',dismiss);
 dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 render();return {activate(view){const id=TAB_PLAYER_IDS[view];if(!id)return;render();const select=$(id);if(select.value&&!verified.has(select.value))request(select,select.value);},isVerified:player=>verified.has(player)};
}
