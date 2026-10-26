import {WORKOUT_TRAINING_DAYS,scheduledWorkout,workoutProgramProgress,workoutIsLocked,workoutCycleLocked,workoutWeekLocked,workoutUnlockedWeek,workoutDayCoverage} from './workout-program.mjs?v=rangers-organization-20261025';

export function startWorkoutSchedule({element:$,flow}){
 const selectors=['workout-plan-cycle','workout-plan-week','workout-plan-day'];let selected=null,queued=false,lastPlayer='',lastRound=0,lastWeekContext='';
 const option=(value,label,disabled=false)=>{const node=document.createElement('option');node.value=String(value);node.textContent=label;node.disabled=disabled;return node;};
 const snapshot=()=>selectors.map(id=>$(id).value),restore=values=>selectors.forEach((id,i)=>{$(id).value=values[i];});
 const today=new Date();$('workout-rest-date').value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 function render({open=false}={}){
  const player=$('workout-player').value,progress=workoutProgramProgress(flow.records(),player);
  if(player&&(player!==lastPlayer||progress.round!==lastRound)){
   const cycle=progress.unlocked_cycle,week=workoutUnlockedWeek(cycle,progress),next=WORKOUT_TRAINING_DAYS.find(d=>!workoutDayCoverage(cycle,week,d.day).every(id=>progress.completed.has(id)));
   restore([cycle,week,next?.day??''].map(String));
  }
  lastPlayer=player;lastRound=progress.round;
  for(const item of $('workout-plan-cycle').children)item.disabled=Number(item.value)>progress.unlocked_cycle;
  if(Number($('workout-plan-cycle').value)>progress.unlocked_cycle)$('workout-plan-cycle').value=String(progress.unlocked_cycle);
  const cycle=$('workout-plan-cycle').value||'1',unlockedWeek=workoutUnlockedWeek(cycle,progress);
  for(const item of $('workout-plan-week').children)item.disabled=Number(item.value)>unlockedWeek;
  if(Number($('workout-plan-week').value)>unlockedWeek)$('workout-plan-week').value=String(unlockedWeek);
  const week=$('workout-plan-week').value||'1',oldDay=$('workout-plan-day').value;
  for(const id of selectors)$(id).disabled=!player;
  const days=WORKOUT_TRAINING_DAYS.map(d=>({...d,complete:workoutDayCoverage(cycle,week,d.day).every(id=>progress.completed.has(id))}));
  $('workout-plan-day').replaceChildren(option('','Choose a day'),...days.map(d=>option(d.day,d.label+(d.complete?' · X completed':''),d.complete)));
  const available=days.filter(d=>!d.complete);
  if(available.some(d=>String(d.day)===oldDay))$('workout-plan-day').value=oldDay;
  else if(player&&available.length)$('workout-plan-day').value=String(available[0].day);
  $('workout-plan-status').textContent=player?`Round ${progress.round} · Cycle ${cycle} · Week ${week}: ${days.filter(d=>d.complete).length} / 7 days complete. Finish all six workouts and Day 7 rest before the next week unlocks. Progress uses this browser’s saved player history.`:'Choose your name, then Cycle, Week and Day. Your scheduled workout loads automatically.';
  if(player&&!available.length)$('workout-plan-status').textContent+=' Week complete — select the next unlocked week or cycle.';
  $('workout-week-context').textContent=player?`${player} · Round ${progress.round} · Cycle ${cycle} · Week ${week}`:'Choose a player to see their training week.';
  for(const day of days){$('workout-week-mark-'+day.day).hidden=!player||!day.complete;$('workout-week-day-'+day.day).classList.toggle('workout-day-completed',Boolean(player&&day.complete));}
  const weekContext=JSON.stringify([player,progress.round,cycle,week]);if(weekContext!==lastWeekContext){const rest=flow.records().find(r=>r.player===player&&r.source_template_id===`workout-rest-cycle-${cycle}-week-${week}`&&(r.program_round??1)===progress.round);$('workout-rest-date').value=rest?.session_date??`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;$('workout-rest-status').textContent='';lastWeekContext=weekContext;}
  $('workout-rest-completed').checked=Boolean(player&&days[6].complete);
  $('workout-rest-completed').disabled=!player||workoutCycleLocked(cycle,progress)||workoutWeekLocked(cycle,progress,week);
  $('workout-rest-date').disabled=$('workout-rest-completed').disabled||$('workout-rest-completed').checked;
  if(open&&player){
   if($('workout-plan-day').value==='7'){if(!flow.openRestDay())return false;}
   else if($('workout-plan-day').value){const template=scheduledWorkout(cycle,week,$('workout-plan-day').value);if(!flow.openScheduledTemplate({template_id:template.id,player}))return false;}
   else if(!flow.hasDraft())flow.openRestDay({completed:true});
  }
  selected=snapshot();return true;
 }
 for(const id of selectors)$(id).addEventListener('change',()=>{const before=selected;if(!render({open:true})&&before){restore(before);render();}});
 $('workout-rest-completed').addEventListener('change',()=>{
  try{flow.setWorkoutRest({player:$('workout-player').value,cycle:Number($('workout-plan-cycle').value),week:Number($('workout-plan-week').value),date:$('workout-rest-date').value,completed:$('workout-rest-completed').checked});$('workout-rest-status').textContent=$('workout-rest-completed').checked?'Rest completion saved.':'Rest completion cleared.';}
  catch(error){$('workout-rest-status').textContent=error.message;}
  render();
 });
 $('workout-player').addEventListener('change',()=>{if(!flow.hasDraft())render({open:true});});
 flow.subscribe(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render({open:!flow.hasDraft()});});});
 render();return {refresh:()=>render()};
}
