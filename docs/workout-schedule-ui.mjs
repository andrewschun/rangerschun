import {WORKOUT_TRAINING_DAYS,scheduledWorkout,workoutProgramProgress,workoutIsLocked,workoutCycleLocked} from './workout-program.mjs?v=coach-access-programs-20261025';

export function startWorkoutSchedule({element:$,flow}){
 const selectors=['workout-plan-cycle','workout-plan-week','workout-plan-day'];let selected=null,queued=false,lastPlayer='',lastRound=0;
 const option=(value,label,disabled=false)=>{const node=document.createElement('option');node.value=String(value);node.textContent=label;node.disabled=disabled;return node;};
 const snapshot=()=>selectors.map(id=>$(id).value);
 const restore=values=>{selectors.forEach((id,i)=>{$(id).value=values[i];});};
 function render({open=false}={}){
  const player=$('workout-player').value,progress=workoutProgramProgress(flow.records(),player);
  if(player&&(player!==lastPlayer||progress.round!==lastRound)){let next=null;for(const c of [1,2,3])for(const w of [1,2,3,4])for(const d of WORKOUT_TRAINING_DAYS){const template=scheduledWorkout(c,w,d.day);if(!next&&!workoutIsLocked(template,progress)&&!workoutCycleLocked(template,progress))next=[c,w,d.day];}if(next)restore(next.map(String));}
  lastPlayer=player;lastRound=progress.round;
  for(const option of $('workout-plan-cycle').children)option.disabled=Number(option.value)>progress.unlocked_cycle;
  if(Number($('workout-plan-cycle').value)>progress.unlocked_cycle&&!flow.hasDraft())$('workout-plan-cycle').value=String(progress.unlocked_cycle);
  const cycle=$('workout-plan-cycle').value||'1',week=$('workout-plan-week').value||'1',oldDay=$('workout-plan-day').value;
  for(const id of selectors)$(id).disabled=!player;
  const days=WORKOUT_TRAINING_DAYS.map(d=>({...d,template:scheduledWorkout(cycle,week,d.day)}));
  $('workout-plan-day').replaceChildren(option('','Choose a day'),...days.map(d=>option(d.day,d.label+(workoutIsLocked(d.template,progress)?' · completed / locked':workoutCycleLocked(d.template,progress)?' · finish current cycle':''),workoutIsLocked(d.template,progress)||workoutCycleLocked(d.template,progress))));
  const available=days.filter(d=>!workoutIsLocked(d.template,progress)&&!workoutCycleLocked(d.template,progress));
  if(available.some(d=>String(d.day)===oldDay))$('workout-plan-day').value=oldDay;
  else if(player&&available.length)$('workout-plan-day').value=String(available[0].day);
  $('workout-plan-status').textContent=player?`Round ${progress.round} · ${progress.completed_days} / ${progress.total_days} scheduled workout days completed. Cycle ${progress.unlocked_cycle}: ${progress.cycles[progress.unlocked_cycle-1].days_completed} / 24 days complete. Finish this cycle before the next one unlocks. Finished workouts unlock after all three cycles. Progress uses this browser’s saved player history.`:'Choose your name, then Cycle, Week and Day. Your scheduled workout loads automatically.';
  if(player&&!available.length)$('workout-plan-status').textContent+=' This week is complete. Choose another week or cycle. If part of a combined day was logged separately, use history to correct or restart its saved entry.';
  if(open&&player&&$('workout-plan-day').value){
   const template=scheduledWorkout(cycle,week,$('workout-plan-day').value);
   if(!flow.openScheduledTemplate({template_id:template.id,player}))return false;
  }
  selected=snapshot();return true;
 }
 for(const id of selectors)$(id).addEventListener('change',()=>{const before=selected;if(!render({open:true})&&before){restore(before);render();}});
 $('workout-player').addEventListener('change',()=>{if(!flow.hasDraft())render({open:true});});
 flow.subscribe(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render({open:!flow.hasDraft()});});});
 render();return {refresh:()=>render()};
}
