import {WORKOUT_LIBRARY} from './library.mjs?v=schedule-auto-refresh-20261025';

export const WORKOUT_EQUIPMENT=Object.freeze({gym:'Gym',home_bodyweight:'Home — No Equipment',home_bands:'Home — Bands'});
const homeKey=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const HOME_MOVEMENTS={
 inchworm:{name:'Inchworm',demo:'Inchworm',cue:'Walk hands out to a plank and back; keep the movement controlled.'},
 rotation:{name:'Quadruped Extension Rotation',demo:'Quadruped Extension Rotation',side:true,cue:'Rotate through your upper back without forcing the range.'},
 wallslide:{name:'Forearm Wallslides',demo:'Forearm Wallslides',cue:'Keep ribs down and slide within a comfortable range.'},
 windmill:{name:'Side Lying Windmill',demo:'Side Lying Windmill',side:true,cue:'Move slowly through a comfortable upper-back rotation.'},
 jump:{name:'Broad Jumps',demo:'Broad Jumps',cue:'Jump, land softly and hold your landing. Reset between reps; rest 60–120 seconds between sets.'},
 bound:{name:'Lateral Bound and Stick',demo:'Heidens',related:'The demo shows lateral bounds. Hold each landing before the next rep.',side:true,cue:'Bound sideways and hold a balanced landing. Reset each rep; rest 60–120 seconds between sets.'},
 split:{name:'Split Squat',demo:'SPLIT SQUAT',related:'The demo may show added weight. Use bodyweight only for this home plan.',side:true,cue:'Use a split stance; lower slowly and stand with control. Use a wall for balance if needed.'},
 hinge:{name:'Single-leg Hip Hinge',side:true,cue:'With a slight knee bend, reach your hips back while the free leg reaches behind. Keep hips level; use a wall for balance.'},
 bridge:{name:'Single-leg Glute Bridge',demo:'SINGLE-LEG GLUTE BRIDGE (2s Pause @ Top)',side:true,cue:'Lift your hips and pause at the top without arching your lower back.'},
 walkout:{name:'Glute-bridge Walkout',cue:'From a bridge, take small heel steps out and back while keeping hips controlled. One out-and-back is one rep.'},
 deadbug:{name:'Opposite Deadbug',demo:'OPPOSITE DEADBUG',side:true,cue:'Reach opposite arm and leg slowly while keeping your trunk still.'},
 pushup:{name:'Push-up',demo:'Push-up',cue:'Choose a wall, sturdy counter or floor version that lets you keep a straight body. Note the version used.'},
 ytw:{name:'Prone Y–T–W Raise',per_position:true,cue:'Lie face down. Gently raise your arms into Y, T and W positions without shrugging; record reps for each position.'},
 row:{name:'Band Row',cue:'Use an exercise band secured to a suitable anchor. Pull elbows back with your trunk still; note the band resistance.'},
 sideplank:{name:'Side Plank',side:true,cue:'Support on your forearm; use bent knees or straight legs. Keep hips lifted and note the version used.'},
 birddog:{name:'Bird Dog',side:true,cue:'From hands and knees, reach opposite arm and leg while keeping your back and hips still.'},
 reversecrunch:{name:'Reverse Crunch',demo:'Reverse Crunch',cue:'Curl your pelvis gently toward your ribs; lower with control.'},
 pallof:{name:'Band Pallof Press',demo:'STANDING PALLOF PRESS',related:'Follow the same anti-rotation movement with a securely anchored exercise band.',side:true,cue:'Stand sideways to a suitable band anchor, press hands forward and keep your trunk from rotating. Note band resistance.'},
};
function homeDemoFor(def){
 const source=WORKOUT_LIBRARY.exercises.find(e=>homeKey(e.name)===homeKey(def.demo));
 return source?.demo_url?{demo_url:source.demo_url,demo_status:def.related?'related_variation':source.demo_status,demo_note:def.related??source.demo_note}:{};
}
function homeExercise(key,{sets,target,unit='reps',section='Home strength',id}){
 const def=HOME_MOVEMENTS[key],tracking={unit,sets,target,...(def.side?{per_side:true}:{}),...(def.per_position?{per_position:true}:{})};
 const suffix=def.side?' / side':def.per_position?' / position':'';
 return {id:id+'-'+key,name:def.name,section,source_category:'other',prescriptions:[{sets:String(sets),reps:`${target} ${unit==='seconds'?'seconds':'reps'}${suffix}`,effort:section==='Warm-up'?'Controlled movement':section==='Home power'?'Reset between reps':'Controlled reps; rest 60–90 seconds between sets',load:'none'}],home_tracking:tracking,source_note:def.cue,...homeDemoFor(def)};
}
export function makeHomeWorkoutTemplates(templates){
 const plans=[];
 for(const template of templates){
  if(!['strength','speed'].includes(template.category)||!/-cycle-[123]$/.test(template.program_id)||template.equipment_mode)continue;
  for(const equipment of ['home_bodyweight','home_bands']){
   const id=template.id+'--'+equipment,week=template.week,sets=week===3?3:2,reps=[6,8,10,6][week-1],hold=[15,20,25,15][week-1];
   let exercises;
   if(template.category==='speed'){
    exercises=template.exercises.map((e,index)=>{
     if(/band resisted heidens/i.test(e.name))return {...e,id:id+'-'+index,name:'Heidens',source_note:'Home adaptation: use no resistance band; keep the source sets, reps and distances.',...homeDemoFor({demo:'Heidens'})};
     if(/band resisted broad jumps/i.test(e.name))return {...e,id:id+'-'+index,name:'Broad Jumps',source_note:'Home adaptation: jump without a resistance band; keep the source sets and reps.',...homeDemoFor({demo:'Broad Jumps'})};
     if(/lateral hurdle jumps/i.test(e.name))return {...e,id:id+'-'+index,name:'Lateral Line Jumps',demo_url:null,demo_status:null,demo_note:null,source_note:'Home adaptation: use a line on the ground without a hurdle; keep the source sets and reps.'};
     if(/bench t-spine mob/i.test(e.name))return {...e,id:id+'-'+index,name:'Half Kneeling Wall T-Spine Mob',demo_url:null,demo_status:null,demo_note:null,source_note:'Home adaptation: kneel beside a wall and rotate your upper back with control; keep the source reps or time.'};
     if(/trx ys/i.test(e.name))return homeExercise('ytw',{id:id+'-'+index,sets:2,target:6,section:'Home strength'});
     return {...e,id:id+'-'+index};
    });
   }else{
    const lower=[1,3,4].includes(template.day)&&!(!template.source_template_ids&&template.day===4);
    const add=(key,options={})=>homeExercise(key,{id,sets,target:reps,...options});
    if(lower)exercises=[add('inchworm',{sets:1,target:5,section:'Warm-up'}),add('rotation',{sets:1,target:5,section:'Warm-up'}),add(template.day===1?'jump':'bound',{sets:2,target:3,section:'Home power'}),add('split'),add('hinge'),add('bridge'),add('walkout',{target:[6,7,8,6][week-1]}),add(equipment==='home_bands'?'pallof':'deadbug')];
    else exercises=[add('wallslide',{sets:1,target:6,section:'Warm-up'}),add('windmill',{sets:1,target:5,section:'Warm-up'}),add('pushup'),add(equipment==='home_bands'?'row':'ytw'),add('sideplank',{target:hold,unit:'seconds'}),add('birddog'),add('reversecrunch')];
   }
   plans.push({...template,id,name:template.name+' · '+WORKOUT_EQUIPMENT[equipment],equipment_mode:equipment,home_for_template_id:template.id,source_template_ids:template.source_template_ids??[template.id],notes:[],exercises,home_note:(equipment==='home_bands'?'Use an exercise band and a suitable secure anchor. ':'')+(template.category==='speed'?'Use the listed running space, distances and rest. Home substitutions remove bands, hurdles and suspension equipment.':'Team home adaptation. Warm up for 5–10 minutes. Record reps per set or seconds per hold; use exercise notes if sets differ. Rotational medicine-ball throws are covered at team practice.')});
  }
 }
 return plans;
}
export function homeWorkoutFor(templates,template,equipment='gym'){
 if(!template)return template;
 if(equipment==='gym')return templates.find(t=>t.id===(template.home_for_template_id??template.id))??template;
 if(!Object.hasOwn(WORKOUT_EQUIPMENT,equipment))throw Error('Choose a valid equipment option.');
 const base=template.home_for_template_id??template.id;
 return templates.find(t=>t.home_for_template_id===base&&t.equipment_mode===equipment)??template;
}
export function homeResultText(exercise){
 const result=exercise.home_result,plan=exercise.home_tracking;if(!result||!plan)return '';
 return `${plan.sets} sets x ${result.value} ${plan.unit==='seconds'?'seconds':'reps'}${plan.per_side?' / side':plan.per_position?' / position':''}`;
}
export function previousHomeResult(records,{player,exercise,session_date,exclude_id}){
 for(const record of records.filter(r=>r.player===player&&r.id!==exclude_id&&r.session_date<=session_date).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.updated_at??b.created_at??'').localeCompare(String(a.updated_at??a.created_at??'')))){
  const prior=record.exercises.find(e=>e.name===exercise.name&&e.completed===true&&e.home_tracking?.unit===exercise.home_tracking?.unit&&Number.isFinite(e.home_result?.value));
  if(prior)return {exercise:prior,date:record.session_date,title:record.title};
 }
 return null;
}
