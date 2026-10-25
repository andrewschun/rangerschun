import { WORKOUT_TEMPLATES, workoutPrescriptionLines } from './library-tools.mjs?v=compact-workouts-20261025';

/** Loads marked n/a need no weight entry. Blank lifting loads are actual-weight fields, not targets. */
export function checklistWeightRequired(exercise,category){
  category=exercise.source_category??category;
  const loads=(exercise.prescriptions??[]).map(p=>p.load).filter(v=>v!==null&&v!==undefined&&String(v).trim());
  if(loads.some(v=>/\b(?:lb|lbs|kg)\b/i.test(String(v).replace(/(\d)([a-z])/ig,'$1 $2'))))return true;
  if(loads.length&&loads.every(v=>/^(?:n\/?a|bw|bodyweight|none)$/i.test(String(v).trim())))return false;
  const bodyweightOnly=['forearm wallslides','trx row'];
  return category==='strength'&&!bodyweightOnly.includes(exercise.name.trim().toLowerCase());
}
export function workoutChecklistDraft(template){
  if(!template||template.log_enabled===false)throw new TypeError('This workout is available for reference only.');
  return {title:template.name,category:template.category,source_template_id:template.id,entry_mode:'plan_checklist',exercises:template.exercises.map(exercise=>({name:exercise.name,sets:null,reps:null,weight:null,weight_unit:checklistWeightRequired(exercise,template.category)?'lb':'none',notes:'',source_exercise_id:exercise.id,planned_details:workoutPrescriptionLines(exercise).join('\n'),completed:false,completion_basis:'as_prescribed',weight_required:checklistWeightRequired(exercise,template.category),...(exercise.completion_group?{completion_group:exercise.completion_group}:{})}))};
}
export function workoutExerciseRecorded(exercise){
  if(typeof exercise.completed==='boolean')return exercise.completed&&(!exercise.weight_required||['bodyweight','none'].includes(exercise.weight_unit)||typeof exercise.weight==='number');
  return (Number.isInteger(exercise.sets)&&Number.isInteger(exercise.reps)&&(!['lb','kg'].includes(exercise.weight_unit)||typeof exercise.weight==='number'))||Boolean(exercise.notes?.trim());
}
export function workoutChecklistProgress(record){
  const groups=new Map();for(const[index,e]of record.exercises.entries()){const key=e.completion_group?'group:'+e.completion_group:'exercise:'+index;groups.set(key,Boolean(groups.get(key))||workoutExerciseRecorded(e));}
  const recorded=[...groups.values()].filter(Boolean).length;return {recorded,total:groups.size,all:recorded===groups.size};
}
export function validateWorkoutChecklist(record){
  const template=WORKOUT_TEMPLATES.find(t=>t.id===record.source_template_id);
  if(!template||template.log_enabled===false)throw new TypeError('Choose an available workout or throwing routine.');
  const expected=workoutChecklistDraft(template);
  if(record.category!==expected.category||record.title!==expected.title)throw new TypeError('Keep the selected workout name and type with its checklist.');
  if(record.exercises.length!==expected.exercises.length)throw new TypeError('Keep every planned exercise in the checklist; leave unfinished exercises unchecked.');
  for(const[index,exercise]of record.exercises.entries()){
    const plan=expected.exercises[index];
    if(exercise.source_exercise_id!==plan.source_exercise_id||exercise.name!==plan.name||exercise.planned_details!==plan.planned_details||exercise.weight_required!==plan.weight_required||exercise.completion_basis!=='as_prescribed'||typeof exercise.completed!=='boolean')throw new TypeError('The exercise checklist does not match its selected workout plan.');
    if(exercise.completion_group!==plan.completion_group)throw new TypeError('Keep the source routine’s alternative exercise groups.');
    if(template.completion_only&&(exercise.weight!==null||exercise.weight_unit!=='none'||exercise.load_entry!==undefined||exercise.plate_load!==undefined))throw new TypeError('Throwing routines log completion checkboxes only; no measured loads or velocities are entered here.');
    if(exercise.sets!==null||exercise.reps!==null)throw new TypeError('Checklist completion confirms the listed sets/reps. Use the detailed editor for different actual sets/reps.');
    if(exercise.completed&&exercise.weight_required&&['lb','kg'].includes(exercise.weight_unit)&&exercise.weight===null)throw new TypeError(`${exercise.name}: enter the weight used, or select Bodyweight / no added load.`);
  }
  const count=record.exercises.filter(e=>e.completed).length;
  if(!count)throw new TypeError('Check at least one exercise you completed before saving.');
  if(record.completion_status!==(workoutChecklistProgress(record).all?'completed':'partial')||record.completion_confirmed!==true)throw new TypeError('Workout completion must match the exercise checkboxes.');
  return true;
}
