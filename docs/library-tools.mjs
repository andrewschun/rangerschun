import { WORKOUT_LIBRARY } from './library.mjs?v=combined-workouts-20261025';

// Team weekly Day 4 is source Lift Day 3. Keep original workbook plans intact
// so older sessions still reopen with their original exercises and identity.
const combinedPrograms=[],combinedTemplates=[];
for(const cycle of [1,2,3]){
  const med=WORKOUT_LIBRARY.programs.find(p=>p.id===`med-ball-cycle-${cycle}`),lift=WORKOUT_LIBRARY.programs.find(p=>p.category==='strength'&&p.id.endsWith(`-cycle-${cycle}`));
  const program={id:`med-ball-lift-cycle-${cycle}`,name:`Med Ball + Lift Cycle ${cycle}`,category:'strength',week_count:4,days:[{number:1,label:'Day 1 · Med Ball + Heavy Lower'},{number:4,label:'Day 4 · Med Ball + Light Lower'}],notes:lift.notes};
  combinedPrograms.push(program);
  for(const [day,medDay,liftDay] of [[1,1,1],[4,2,3]])for(const week of [1,2,3,4]){
    const find=(id,d)=>WORKOUT_LIBRARY.templates.find(t=>t.program_id===id&&t.day===d&&t.week===week),medPlan=find(med.id,medDay),liftPlan=find(lift.id,liftDay);
    if(!medPlan||!liftPlan)throw Error('A combined workout is missing its source plan.');
    combinedTemplates.push({id:`${program.id}-day-${day}-week-${week}`,program_id:program.id,name:`Med Ball + Lift · Cycle ${cycle} · Day ${day} · ${liftPlan.week_label}`,category:'strength',day,day_label:program.days.find(d=>d.number===day).label,week,week_label:liftPlan.week_label,source_template_ids:[medPlan.id,liftPlan.id],exercises:[...medPlan.exercises.map(e=>({...e,source_category:medPlan.category,section:'Med Ball · '+(e.section||'')})),...liftPlan.exercises.map(e=>({...e,source_category:liftPlan.category,section:'Lift · '+(e.section||'')}))]});
  }
}
export const WORKOUT_PROGRAMS=[...WORKOUT_LIBRARY.programs,...combinedPrograms];
export const WORKOUT_TEMPLATES=[...WORKOUT_LIBRARY.templates,...combinedTemplates];

/** Navigation only: existing source IDs and prescriptions remain unchanged. */
export function workoutCycleForProgram(programId) {
  return String(programId??'').match(/-cycle-([123])$/)?.[1]??null;
}
export function workoutTypeForProgram(programId) {
  if(programId==='custom')return 'custom';
  if(/^med-ball-lift-cycle-[123]$/.test(programId))return 'med_ball_lift';
  const program=WORKOUT_LIBRARY.programs.find(item=>item.id===programId);
  return program?.category==='strength'?'lift':program?.category==='speed'?'conditioning':program?.id==='throwing-routine'?'throwing':program?.id.startsWith('med-ball-')?'med_ball':null;
}
export function workoutProgramChoices(cycle) {
  if(!['1','2','3'].includes(String(cycle)))return [];
  const types=[['med_ball_lift','Med Ball + Lift'],['med_ball','Med Ball'],['lift','Lift'],['conditioning','Conditioning']];
  return [...types.flatMap(([type,label])=>WORKOUT_PROGRAMS.filter(program=>workoutTypeForProgram(program.id)===type&&workoutCycleForProgram(program.id)===String(cycle)).map(program=>({id:program.id,type,label}))),{id:'custom',type:'custom',label:'Custom workout / detailed entry'}];
}

export function isWorkoutVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['vimeo.com','www.vimeo.com','youtube.com','www.youtube.com','youtu.be','www.tiktok.com','tiktok.com'].includes(url.hostname) && url.pathname !== '/';
  } catch { return false; }
}

const exerciseNameKey = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function findWorkoutDemo(name, sourceId) {
  const key = exerciseNameKey(name);
  if (!key) return null;
  const source = WORKOUT_LIBRARY.exercises.find(item => item.id === sourceId);
  if (source && exerciseNameKey(source.name) === key && isWorkoutVideoUrl(source.demo_url)) return source;
  // Match exact exercise wording only; related movements do not share a video automatically.
  const candidates = WORKOUT_LIBRARY.exercises.filter(item => exerciseNameKey(item.name) === key && isWorkoutVideoUrl(item.demo_url));
  return candidates.find(item => item.demo_status !== 'related_variation') ?? candidates[0] ?? null;
}

export function workoutPrescriptionLines(exercise) {
  const plans = exercise.prescriptions ?? [];
  return plans.map((plan, index) => {
    if (Object.hasOwn(plan, 'sets')) {
      return [plan.sets ? `Sets: ${plan.sets}` : '', plan.reps, plan.effort].filter(Boolean).join(' · ') || 'Details not specified';
    }
    const text = [plan.reps, plan.load ? `Load / intensity: ${plan.load}` : ''].filter(Boolean).join(' · ') || 'Details not specified';
    return plans.length > 1 ? `Set ${index + 1}: ${text}` : text;
  });
}

/** Clarify the weighted-baseball list for display; keep saved source prescriptions intact. */
export function formatWeightedBaseballOunces(text) {
  return String(text??'').replace(/\(5,\s*6,\s*5,\s*4,\s*3\)/g,'(5oz, 6oz, 5oz, 4oz, 3oz)');
}

export function workoutTemplateDraft(template) {
  if (!template || template.log_enabled === false) throw new TypeError('This workout is available for reference only.');
  if(template.completion_only)throw new TypeError('Use completion checkboxes for throwing routines; measured throw entry remains on hold.');
  return {
    title: template.name, category: template.category,
    source_template_id: template.id,
    exercises: template.exercises.map(exercise => ({
      name: exercise.name, sets: null, reps: null, weight: null, weight_unit: 'lb', notes: '',
      source_exercise_id: exercise.id,
      planned_details: workoutPrescriptionLines(exercise).join('\n'),
    })),
  };
}
