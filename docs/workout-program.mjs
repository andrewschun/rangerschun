import {WORKOUT_LIBRARY} from './library.mjs?v=schedule-auto-refresh-20261025';
import {WORKOUT_TEMPLATES} from './library-tools.mjs?v=schedule-auto-refresh-20261025';

export const WORKOUT_TRAINING_DAYS=[
 {day:1,label:'Day 1 · Med Ball + Heavy Lower',type:'combined',sourceDay:1},
 {day:2,label:'Day 2 · Light Upper',type:'lift',sourceDay:2},
 {day:3,label:'Day 3 · Conditioning',type:'conditioning',sourceDay:1},
 {day:4,label:'Day 4 · Med Ball + Light Lower',type:'combined',sourceDay:4},
 {day:5,label:'Day 5 · Heavy Upper',type:'lift',sourceDay:4},
 {day:6,label:'Day 6 · Conditioning',type:'conditioning',sourceDay:2},
];
const required=WORKOUT_LIBRARY.templates.filter(t=>t.program_id!=='throwing-routine'&&t.log_enabled!==false);
const requiredIds=new Set(required.map(t=>t.id));
export function workoutRound(record){return Number.isInteger(record?.program_round)&&record.program_round>0?record.program_round:1;}
export function workoutCoverage(templateOrId){
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
 let completedDays=0;for(const c of [1,2,3])for(const w of [1,2,3,4])for(const d of WORKOUT_TRAINING_DAYS){if(workoutCoverage(scheduledWorkout(c,w,d.day)).every(id=>completed.has(id)))completedDays++;}
 return {round,completed,completed_count:completed.size,completed_days:completedDays,total_days:72,total:requiredIds.size,finished_rounds:round-1};
}
export function workoutIsLocked(template,progress){return workoutCoverage(template).some(id=>progress.completed.has(id));}
export function scheduledWorkout(cycle,week,day){
 const route=WORKOUT_TRAINING_DAYS.find(d=>d.day===Number(day));if(!route)return null;
 const c=Number(cycle),w=Number(week);
 const program=route.type==='combined'?`med-ball-lift-cycle-${c}`:route.type==='conditioning'?`conditioning-cycle-${c}`:c===1?'beginner-lift-cycle-1':`beginner-cycle-${c}`;
 return WORKOUT_TEMPLATES.find(t=>t.program_id===program&&t.week===w&&t.day===route.sourceDay)??null;
}
