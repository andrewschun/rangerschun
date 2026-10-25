import { WORKOUT_LIBRARY } from './library.mjs?v=combined-workouts-20261025';
import { plateLoadDescription } from './workout-load.mjs?v=combined-workouts-20261025';

export const THROWING_OFF_DAY_SOURCE='throwing-routine-off-day';
export function isThrowingOffDay(record){return record?.source_template_id===THROWING_OFF_DAY_SOURCE;}
export function isThrowingWorkout(record){
  return isThrowingOffDay(record)||WORKOUT_LIBRARY.templates.some(template=>template.id===record.source_template_id&&template.program_id==='throwing-routine');
}
/** Prior actual load only. No target, unit conversion or automatic load entry. */
export function previousWorkoutLoad(records,{player,exercise,session_date,exclude_id}){
  const name=value=>String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!player||!name(exercise.name))return null;
  const eligible=records.filter(record=>record.player===player&&record.id!==exclude_id&&record.session_date<=session_date).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.created_at??'').localeCompare(String(a.created_at??'')));
  for(const record of eligible){
    const prior=record.exercises.find(item=>name(item.name)===name(exercise.name)&&item.completed!==false&&['lb','kg'].includes(item.weight_unit)&&typeof item.weight==='number'&&Number.isFinite(item.weight));
    if(prior)return {record_id:record.id,date:record.session_date,title:record.title,exercise:{...prior}};
  }
  return null;
}
export function previousWorkoutLoadText(prior){
  if(!prior)return '';
  const e=prior.exercise,load=e.load_entry==='plates'?plateLoadDescription(e):`${e.weight} ${e.weight_unit}`;
  return `Last recorded: ${load} · ${prior.date} · ${prior.title}. Reminder only; enter today's actual load.`;
}
