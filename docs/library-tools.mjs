import { WORKOUT_LIBRARY } from './library.mjs';

/** Navigation only: existing source IDs and prescriptions remain unchanged. */
export function workoutCycleForProgram(programId) {
  return String(programId??'').match(/-cycle-([123])$/)?.[1]??null;
}
export function workoutTypeForProgram(programId) {
  if(programId==='custom')return 'custom';
  const program=WORKOUT_LIBRARY.programs.find(item=>item.id===programId);
  return program?.category==='strength'?'lift':program?.category==='speed'?'conditioning':program?.id==='throwing-routine'?'throwing':program?.id.startsWith('med-ball-')?'med_ball':null;
}
export function workoutProgramChoices(cycle) {
  if(!['1','2','3'].includes(String(cycle)))return [];
  const types=[['med_ball','Med Ball'],['lift','Lift'],['conditioning','Conditioning']];
  return [...types.flatMap(([type,label])=>WORKOUT_LIBRARY.programs.filter(program=>workoutTypeForProgram(program.id)===type&&(type==='throwing'||workoutCycleForProgram(program.id)===String(cycle))).map(program=>({id:program.id,type,label}))),{id:'custom',type:'custom',label:'Custom workout / detailed entry'}];
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
