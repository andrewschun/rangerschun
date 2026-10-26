import {WORKOUT_LIBRARY} from './library.mjs?v=schedule-auto-refresh-20261025';
import {WORKOUT_TEMPLATES} from './library-tools.mjs?v=compact-workouts-20261025';

export const WORKOUT_TRAINING_DAYS=[
 {day:1,label:'Day 1 · Med Ball + Heavy Lower',type:'combined',sourceDay:1},
 {day:2,label:'Day 2 · Light Upper',type:'lift',sourceDay:2},
 {day:3,label:'Day 3 · Conditioning',type:'conditioning',sourceDay:1},
 {day:4,label:'Day 4 · Med Ball + Light Lower',type:'combined',sourceDay:4},
 {day:5,label:'Day 5 · Heavy Upper',type:'lift',sourceDay:4},
 {day:6,label:'Day 6 · Conditioning',type:'conditioning',sourceDay:2},
 {day:7,label:'Day 7 · Rest',type:'rest'},
];
const required=WORKOUT_LIBRARY.templates.filter(t=>t.program_id!=='throwing-routine'&&t.log_enabled!==false);
export function workoutRestId(cycle,week){return `workout-rest-cycle-${Number(cycle)}-week-${Number(week)}`;}
export function workoutRestContext(value){const match=String(typeof value==='object'?value?.source_template_id:value).match(/^workout-rest-cycle-([123])-week-([1234])$/);return match?{cycle:Number(match[1]),week:Number(match[2])}:null;}
const restIds=[1,2,3].flatMap(c=>[1,2,3,4].map(w=>workoutRestId(c,w)));
const requiredIds=new Set([...required.map(t=>t.id),...restIds]);
export function workoutRound(record){return Number.isInteger(record?.program_round)&&record.program_round>0?record.program_round:1;}
export function workoutCoverage(templateOrId){
 if(workoutRestContext(templateOrId))return [typeof templateOrId==='string'?templateOrId:templateOrId.source_template_id];
 const t=typeof templateOrId==='string'?WORKOUT_TEMPLATES.find(t=>t.id===templateOrId):templateOrId;
 return t?(t.source_template_ids??[t.id]).filter(id=>requiredIds.has(id)):[];
}
export function workoutProgramProgress(records,player){
 const rounds=new Map();
 for(const record of records){
  if(record.player!==player||record.completion_status!=='completed'||record.completion_confirmed!==true)continue;
  const round=workoutRound(record);if(!rounds.has(round))rounds.set(round,new Set());
  for(const id of workoutCoverage(record.source_template_id))rounds.get(round).add(id);
 }
 let round=1;while(rounds.get(round)?.size===requiredIds.size)round++;
 const completed=rounds.get(round)??new Set();
 const weeks=[1,2,3].flatMap(cycle=>[1,2,3,4].map(week=>{
  const days=WORKOUT_TRAINING_DAYS.map(d=>({day:d.day,complete:workoutDayCoverage(cycle,week,d.day).every(id=>completed.has(id))}));
  return {cycle,week,days,days_completed:days.filter(d=>d.complete).length,complete:days.every(d=>d.complete)};
 }));
 const cycles=[1,2,3].map(cycle=>{const ids=[...required.filter(t=>t.program_id.endsWith('-cycle-'+cycle)).map(t=>t.id),...restIds.filter(id=>workoutRestContext(id).cycle===cycle)],count=ids.filter(id=>completed.has(id)).length;return {cycle,count,total:ids.length,complete:count===ids.length,days_completed:weeks.filter(w=>w.cycle===cycle).reduce((n,w)=>n+w.days_completed,0),days_total:28};});
 const unlocked_cycle=cycles.find(c=>!c.complete)?.cycle??3;
 return {round,completed,cycles,weeks,unlocked_cycle,completed_count:completed.size,completed_days:weeks.reduce((n,w)=>n+w.days_completed,0),total_days:84,total:requiredIds.size,finished_rounds:round-1};
}
export function workoutIsLocked(template,progress){return workoutCoverage(template).some(id=>progress.completed.has(id));}
export function scheduledWorkout(cycle,week,day){
 const route=WORKOUT_TRAINING_DAYS.find(d=>d.day===Number(day));if(!route||route.type==='rest')return null;
 const c=Number(cycle),w=Number(week);
 const program=route.type==='combined'?`med-ball-lift-cycle-${c}`:route.type==='conditioning'?`conditioning-cycle-${c}`:c===1?'beginner-lift-cycle-1':`beginner-cycle-${c}`;
 return WORKOUT_TEMPLATES.find(t=>t.program_id===program&&t.week===w&&t.day===route.sourceDay)??null;
}

export function workoutCycleLocked(templateOrCycle,progress){
 const template=typeof templateOrCycle==='object'?templateOrCycle:WORKOUT_TEMPLATES.find(t=>t.id===templateOrCycle);
 const cycle=template?Number(template.program_id.match(/-cycle-([123])$/)?.[1]):Number(templateOrCycle);
 return Number.isInteger(cycle)&&cycle>=1&&cycle<=3&&cycle>progress.unlocked_cycle;
}

export function workoutDayCoverage(cycle,week,day){return Number(day)===7?[workoutRestId(cycle,week)]:workoutCoverage(scheduledWorkout(cycle,week,day));}
export function workoutUnlockedWeek(cycle,progress){return progress.weeks.find(w=>w.cycle===Number(cycle)&&!w.complete)?.week??4;}
export function workoutWeekLocked(templateOrId,progress,week){
 const rest=workoutRestContext(templateOrId),template=typeof templateOrId==='object'?templateOrId:WORKOUT_TEMPLATES.find(t=>t.id===templateOrId);
 const cycle=rest?.cycle??(template?Number(template.program_id.match(/-cycle-([123])$/)?.[1]):Number(templateOrId));
 const targetWeek=rest?.week??template?.week??Number(week);
 return cycle>=1&&cycle<=3&&targetWeek>=1&&targetWeek<=4&&targetWeek>workoutUnlockedWeek(cycle,progress);
}
