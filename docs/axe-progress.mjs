import {axeDrillPlan} from './axe-drills.mjs?v=axe-drill-checklists-20261025';
import {AXE_PROGRAMS} from './axe-programs.mjs?v=compact-workouts-20261025';

// Coach requires the maximum listed days in every source week.
export const AXE_WEEKLY_DAYS=Object.freeze({in_season:[3,3,3,3,3,4,4,4,4,4,5,5],off_season:[3,3,3,4,4,4,4,5,5,5,5,5]});
export const AXE_WEEKLY_MAX=Object.freeze({in_season:[3,3,3,3,3,4,4,4,4,4,5,5],off_season:[3,3,3,4,4,4,4,5,5,5,5,5]});
export const AXE_MINI_DAYS=[3,3,3,3,4,6]; // Coach chose the detailed Week6 page's six sessions.
export const AXE_ENTRY_MODE='axe_drills_v2';
export const AXE_LEGACY_MODE='axe_sections_v1';
export function isAxeWorkout(record){return [AXE_ENTRY_MODE,AXE_LEGACY_MODE].includes(record?.entry_mode);}
export function axeSeason(activity,season){return activity==='mini_plyos'?'shared':season;}
export function axeContext(activity,season){const program=AXE_PROGRAMS.find(p=>p.id===activity);if(!program||!['in_season','off_season','shared'].includes(season)||activity!=='mini_plyos'&&season==='shared')throw Error('Choose an Axe activity and season.');return {program,activity,season:axeSeason(activity,season)};}
export function axeRequiredSessions(activity,season,week){const {program}=axeContext(activity,season);if(!Number.isInteger(week)||week<1||week>program.week_count)throw Error('Choose a valid program week.');return activity==='mini_plyos'?AXE_MINI_DAYS[week-1]:AXE_WEEKLY_DAYS[season][week-1];}
export function axeMaximumSessions(activity,season,week){axeRequiredSessions(activity,season,week);return activity==='mini_plyos'?AXE_MINI_DAYS[week-1]:AXE_WEEKLY_MAX[season][week-1];}
function validDate(date){const stamp=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T12:00:00Z'):NaN;return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===date;}
export function validateAxeSession(record){
 if(!isAxeWorkout(record)||!record.axe_program)throw Error('Choose an Axe workout.');
 const meta=record.axe_program,{program,season}=axeContext(meta.activity,meta.season),required=axeRequiredSessions(meta.activity,season,meta.week);
 if(meta.source_sha256!==program.sha256||meta.season!==season||!validDate(record.session_date)||typeof record.player!=='string'||!record.player)throw Error('The Axe workout source or player does not match.');
 const legacy=record.entry_mode===AXE_LEGACY_MODE,plan=legacy?[{id:'axe-tee',name:'Tee work'},{id:'axe-front-toss',name:'Front toss'}]:axeDrillPlan(meta.activity,season,meta.week);
 if(!Array.isArray(record.exercises)||record.exercises.length!==plan.length||record.exercises.some((e,i)=>e.source_exercise_id!==plan[i].id||e.name!==plan[i].name||typeof e.completed!=='boolean'||e.sets!==null||e.reps!==null||e.weight!==null||e.weight_unit!=='none'||!legacy&&(e.completion_group!==plan[i].section||e.planned_details!==plan[i].planned_details)))throw Error('Keep every scheduled drill and its coach-adjusted reps with this workout.');
 if(!legacy&&(meta.rep_adjustment!==1||meta.drill_revision!==2))throw Error('Use the current drill checklist and coach-adjusted reps.');
 const full=record.exercises.every(e=>e.completed);if(!['completed','partial'].includes(record.completion_status)||record.completion_status==='completed'&&!full||record.completion_confirmed!==true)throw Error('Check every Tee work and Front toss drill before continuing.');
 if(!record.exercises.some(e=>e.completed))throw Error('Check at least one completed drill before saving.');
 return true;
}
export function axeRecords(records,player,activity,season){const context=axeContext(activity,season);return records.filter(r=>isAxeWorkout(r)&&r.player===player&&r.axe_program?.activity===activity&&r.axe_program?.season===context.season);}
export function axeProgress(records,player,activity,season){
 const {program}=axeContext(activity,season),sessions=axeRecords(records,player,activity,season),weeks=[];
 for(let week=1;week<=program.week_count;week++){
  const done=sessions.filter(r=>{try{validateAxeSession(r);return r.axe_program.week===week&&r.completion_status==='completed';}catch{return false;}});
  const count=new Set(done.map(r=>r.session_date)).size,required=axeRequiredSessions(activity,season,week);const maximum=axeMaximumSessions(activity,season,week),weeksComplete=count>=required;weeks.push({week,count,required,maximum,completed:weeksComplete});
 }
 const next=weeks.find(w=>!w.completed);return {weeks,unlocked:next?.week??program.week_count,complete:!next,sessions};
}
export function makeAxeSession({player,activity,season,week,date,checks=[],complete=false,existing,now=new Date().toISOString(),id}){
 const {program,season:canonical}=axeContext(activity,season),plan=axeDrillPlan(activity,canonical,week);
 return {id:existing?.id??id??globalThis.crypto.randomUUID(),player,session_date:date,title:`Axe Bats · ${program.label} · ${canonical==='shared'?'Shared plan':canonical==='off_season'?'Off-season':'In-season'} · Week ${week}`,category:'baseball',duration_minutes:null,effort:'',notes:complete?'Every scheduled drill confirmed complete. Coach adjustment: one extra rep per set.':'Drill progress saved. Check all drills and select Complete workout & continue.',source_template_id:`axe-${activity}-${canonical}-week-${week}`,entry_mode:AXE_ENTRY_MODE,axe_program:{activity,season:canonical,week,source_sha256:program.sha256,rep_adjustment:1,drill_revision:2},completion_status:complete?'completed':'partial',completion_confirmed:true,created_at:existing?.created_at??now,updated_at:now,exercises:plan.map((d,i)=>({name:d.name,source_exercise_id:d.id,completion_group:d.section,completed:checks[i]===true,sets:null,reps:null,weight:null,weight_unit:'none',notes:'',planned_details:d.planned_details}))};
}
export function upsertAxeSession(records,record,{today}={}){
 validateAxeSession(record);const old=records.find(r=>r.id===record.id),m=record.axe_program;
 if(today&&record.session_date>today)throw Error('Choose today or an earlier workout date. Future workouts cannot count as complete.');
 if(old&&(old.player!==record.player||!isAxeWorkout(old)||['activity','season','week','source_sha256'].some(key=>old.axe_program[key]!==m[key])))throw Error('Keep the saved workout with its original player, activity, season and week.');
 const context=axeRecords(records,record.player,m.activity,m.season);
 if(context.some(r=>r.id!==record.id&&r.session_date===record.session_date))throw Error('A workout is already recorded on this date. Edit that saved entry or choose a different date.');
 if(!old){const progress=axeProgress(records,record.player,m.activity,m.season);if(progress.complete||m.week!==progress.unlocked)throw Error('Finish the current program week before continuing. Completed weeks can be corrected through history.');}
 return old?records.map(r=>r.id===record.id?record:r):[...records,record];
}

