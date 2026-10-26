import {axeContext,axeProgress,isAxeWorkout,makeAxeSession,upsertAxeSession,validateAxeSession} from './axe-progress.mjs?v=axe-drill-checklists-20261025';
import {axeDrillPlan} from './axe-drills.mjs?v=axe-drill-checklists-20261025';
import {validateWorkout,workoutsToCsv} from './engine.mjs?v=schedule-auto-refresh-20261025';

export function startAxeCompletion({element:$,players,flow,download=()=>{},refresh,onNavigate}){
 const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let lastContext='',lastWeek=0,draftId=null,reviewId=null,reset=true,mutating=false,drillInputs=[];
 const all=()=>flow.records(),player=()=>$('axe-player').value;
 const chosen=()=>all().filter(r=>isAxeWorkout(r)&&r.player===player()).sort((a,b)=>b.session_date.localeCompare(a.session_date));
 const context=()=>axeContext($('axe-activity').value,$('axe-season').value);
 const dateValid=()=>/^\d{4}-\d{2}-\d{2}$/.test($('axe-workout-date').value)&&$('axe-workout-date').value<=today;
 function error(message){$('axe-completion-error').textContent=message;$('axe-completion-error').hidden=!message;}
 function persist(records,{journal=true}={}){mutating=true;try{flow.commit(records,{journal});}finally{mutating=false;}}
 function load(record,progress,week){
  draftId=record?.id??null;$('axe-workout-date').value=record?.session_date??(progress.sessions.some(r=>r.session_date===today)?'':today);error('');
  const c=context(),plan=axeDrillPlan(c.activity,c.season,week),box=$('axe-drill-checklist');box.replaceChildren();drillInputs=[];
  for(const section of ['tee','toss']){
   const group=make('fieldset','axe-drill-group'),title=make('legend','',section==='tee'?'Tee work':'Front toss'),grid=make('div','axe-drill-grid');group.append(title,grid);
   for(const [i,d]of plan.entries())if(d.section===section){
    const card=make('article','axe-drill-card'),label=make('label','axe-drill-label'),check=make('input'),text=make('span');check.type='checkbox';check.id='axe-drill-'+d.id;check.dataset.axeDrill=d.id;check.checked=record?.entry_mode==='axe_drills_v2'&&record.exercises.find(e=>e.source_exercise_id===d.id)?.completed===true;check.setAttribute('aria-label',`${i+1}. ${d.name} completed`);drillInputs[i]=check;
    text.append(make('strong','',`${i+1}. ${d.name}`),make('small','axe-drill-prescription',d.prescription+' per bat'),make('small','',d.ball));label.append(check,text);card.append(label);
    const links=make('div','axe-drill-demos');for(const demo of d.demos){const a=make('a','exercise-demo',demo.label+' ↗');a.href=demo.url;a.target='_blank';a.rel='noopener noreferrer';a.title=demo.title+' · '+demo.provider;a.setAttribute('aria-label',demo.label+': '+demo.title+' (opens in a new tab)');links.append(a);if(demo.note)card.append(make('p','field-help',demo.note));}card.append(links);grid.append(card);check.addEventListener('change',()=>save(false));
   }
   box.append(group);
  }
  $('axe-bat-order').textContent='Bat order: '+plan[0].bats.join(' → ')+'. Complete the listed sets with each bat in this order.';
  $('axe-drill-legacy-note').hidden=!record||record.entry_mode!=='axe_sections_v1';
 }
 function history(){
  const items=chosen(),box=$('axe-completion-history');box.replaceChildren();$('axe-clear-entries').disabled=$('axe-export-entries').disabled=!items.length;
  if(!items.length){box.append(make('p','workout-history-help',player()?'No Axe workouts saved yet.':'Choose a player to view saved Axe workouts.'));return;}
  for(const record of items){
   const card=make('details','workout-record'),title=make('summary'),body=make('div','workout-record-body');title.append(make('strong','',record.title),make('span','',record.session_date+' · '+(record.completion_status==='completed'?'Completed':'In progress')));card.append(title);
   const list=make('ul','axe-saved-drills');for(const e of record.exercises){const row=make('li','',(e.completed?'✓ ':'○ ')+e.name);if(e.planned_details)row.append(make('small','',e.planned_details));list.append(row);}body.append(list);
   const actions=make('div','workout-record-actions');for(const [label,callback]of [['Edit',()=>editSession(record)],['Restart',()=>restartSession(record)],['Delete',()=>deleteSession(record)]]){const button=make('button',label==='Delete'?'delete-button':'secondary-button',label);button.type='button';button.addEventListener('click',callback);actions.append(button);}body.append(actions);card.append(body);box.append(card);
  }
 }
 function sync(){
  history();const valid=player()&&$('axe-activity').value&&$('axe-season').value;if(!valid){$('axe-completion-form').hidden=true;lastContext='';draftId=null;reviewId=null;reset=true;return;}
  const c=context(),progress=axeProgress(all(),player(),c.activity,c.season),key=JSON.stringify([player(),c.activity,c.season]),review=reviewId?all().find(r=>r.id===reviewId):null;
  if(review&&review.player===player()&&review.axe_program.activity===c.activity&&review.axe_program.season===c.season)$('axe-week').value=String(review.axe_program.week);
  else if(key!==lastContext)$('axe-week').value=String(progress.unlocked);
  let week=Number($('axe-week').value)||progress.unlocked;
  if(week>progress.unlocked&&!review){week=progress.unlocked;$('axe-week').value=String(week);}
  for(const option of $('axe-week').children){if(option.value)option.disabled=Number(option.value)>progress.unlocked&&Number(option.value)!==review?.axe_program.week;}
  const current=all().find(r=>r.id===draftId),same=current&&current.player===player()&&current.axe_program?.activity===c.activity&&current.axe_program.season===c.season&&current.axe_program.week===week;
  if(reset||key!==lastContext||week!==lastWeek||draftId&&!same){const partial=progress.sessions.filter(r=>r.axe_program.week===week&&r.completion_status==='partial').at(-1);load(review??partial,progress,week);reset=false;}
  lastContext=key;lastWeek=week;
  const state=progress.weeks[week-1],editing=Boolean(draftId),working=editing||!state.completed&&week===progress.unlocked;
  $('axe-completion-form').hidden=!working;$('axe-workout-date').max=today;
  const checkedCount=drillInputs.filter(n=>n.checked).length,checked=drillInputs.length>0&&checkedCount===drillInputs.length;
  $('axe-completion-status').textContent=`Week ${week} · ${state.count} / ${state.required} required workouts · ${checkedCount} / ${drillInputs.length} drills checked. A separate date is required for each workout. Progress saves in this browser.`;
  if(progress.complete)$('axe-completion-status').textContent+=' Program complete. Saved entries remain available for corrections.';
  else if(state.completed)$('axe-completion-status').textContent+=' Week complete. Choose your next unlocked week or edit a saved entry.';
  $('axe-completion-save').disabled=!working||!checked||!dateValid();$('axe-completion-save').textContent='Complete workout & continue';

 }
 function save(complete=false){
  try{
   const c=context(),week=Number($('axe-week').value),checks=drillInputs.map(n=>n.checked),existing=all().find(r=>r.id===draftId);
   if(!checks.some(Boolean)){if(existing)persist(all().filter(r=>r.id!==existing.id));draftId=null;reviewId=null;error('');refresh();return false;}
   if(complete&&!checks.every(Boolean))throw Error('Check every Tee work and Front toss drill before continuing.');
   const record=makeAxeSession({player:player(),activity:c.activity,season:c.season,week,date:$('axe-workout-date').value,checks,complete,existing});
   const next=upsertAxeSession(all(),record,{today});validateWorkout(record,players);draftId=record.id;persist(next);error('');
   $('axe-completion-announcement').textContent=complete?'Workout completed. Progress saved on this device.':'Drill progress saved on this device.';
   if(complete){draftId=null;reviewId=null;reset=true;const p=axeProgress(all(),player(),c.activity,c.season);$('axe-week').value=String(p.unlocked);}
   refresh();return true;
  }catch(e){error(e.message);$('axe-completion-save').disabled=true;return false;}
 }
 function editSession(record){
  try{validateAxeSession(record);}catch(e){error(e.message);return false;}
  $('axe-player').value=record.player;$('axe-activity').value=record.axe_program.activity;$('axe-season').value=record.axe_program.season==='shared'?'off_season':record.axe_program.season;reviewId=record.id;draftId=record.id;reset=true;refresh();onNavigate?.('axe');return true;
 }
 function deleteSession(record,{confirm=true,journal=true}={}){
  if(confirm&&!window.confirm(`Delete this Axe workout for ${record.player} on ${record.session_date}? Later weeks may lock again.`))return false;
  persist(all().filter(r=>r.id!==record.id),{journal});if(draftId===record.id){draftId=null;reviewId=null;reset=true;}refresh();return true;
 }
 function restartSession(record,{confirm=true,journal=true}={}){
  if(confirm&&!window.confirm(`Restart this Axe workout for ${record.player}? Its saved checks will be cleared.`))return false;
  deleteSession(record,{confirm:false,journal});$('axe-player').value=record.player;$('axe-activity').value=record.axe_program.activity;$('axe-season').value=record.axe_program.season==='shared'?'off_season':record.axe_program.season;reset=true;refresh();$('axe-week').value=String(record.axe_program.week);lastWeek=0;refresh();$('axe-workout-date').value=record.session_date;return true;
 }
 $('axe-workout-date').addEventListener('change',()=>{error('');if(drillInputs.some(n=>n.checked))save(false);else refresh();});
 $('axe-completion-form').addEventListener('submit',event=>{event.preventDefault();if(!$('axe-completion-save').disabled)save(true);});
 $('axe-clear-entries').addEventListener('click',()=>{const items=chosen();if(!items.length||!window.confirm(`Clear all ${items.length} saved Axe workouts for ${player()}? This resets their Axe program progress on this device. Other players and trackers are kept.`))return;persist(all().filter(r=>!isAxeWorkout(r)||r.player!==player()));draftId=null;reviewId=null;reset=true;refresh();$('axe-completion-announcement').textContent='Axe entries cleared for the selected player.';});
 $('axe-export-entries').addEventListener('click',()=>{if(chosen().length)download('rangers-axe-workouts.csv',workoutsToCsv(chosen()));});
 flow.subscribe(()=>{if(!mutating)refresh();});return {sync,editSession,deleteSession,restartSession,records:chosen};
}
