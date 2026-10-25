import { overSpeedSteps,validateBatSpeedSet } from './overspeed.mjs';
import { OVERSPEED_LIBRARY } from './overspeed-library.mjs';

// Minimum durations/frequencies from the coach-supplied OverSpeed training-cycle chart.
export const OVERSPEED_STAGES=Object.freeze([
  {id:'c1-level1',cycle:1,phase:'Primary training',level:1,weeks:5,per_week:3},
  {id:'c1-level2',cycle:1,phase:'Primary training',level:2,weeks:5,per_week:3},
  {id:'c1-maintenance',cycle:1,phase:'Maintenance',level:2,weeks:4,per_week:1},
  {id:'c2-ramp',cycle:2,phase:'Ramp-up',level:2,weeks:2,per_week:3},
  {id:'c2-level3',cycle:2,phase:'Primary training',level:3,weeks:5,per_week:3},
  {id:'c2-level4',cycle:2,phase:'Primary training',level:4,weeks:5,per_week:3},
  {id:'c2-maintenance',cycle:2,phase:'Maintenance',level:3,weeks:4,per_week:1},
  {id:'c3-ramp',cycle:3,phase:'Ramp-up',level:3,weeks:2,per_week:3},
  {id:'c3-level4',cycle:3,phase:'Primary training',level:4,weeks:5,per_week:3},
  {id:'c3-level5',cycle:3,phase:'Primary training',level:5,weeks:5,per_week:3},
  {id:'c3-maintenance',cycle:3,phase:'Maintenance',level:3,weeks:4,per_week:1},
].map((stage,index)=>Object.freeze({...stage,index,program_id:'overspeed-'+stage.level,label:`Cycle ${stage.cycle} · Level ${stage.level} · ${stage.phase}`,sessions:stage.weeks*stage.per_week})));
export function overspeedDate(value){
  const time=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T12:00:00Z'):NaN;
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new TypeError('Choose a valid OverSpeed training date.');return time;
}
export function overspeedDayOffset(date,days){return new Date(overspeedDate(date)+days*86400000).toISOString().slice(0,10);}
export function overspeedStage(id){const stage=OVERSPEED_STAGES.find(s=>s.id===id);if(!stage)throw new TypeError('Choose an OverSpeed training phase.');return stage;}
export function overspeedSessionDraft(stageId){
  const stage=overspeedStage(stageId),program=OVERSPEED_LIBRARY.programs.find(p=>p.id===stage.program_id);
  return {protocol:'velo_overspeed_cycles_v1',stage_id:stage.id,program_id:program.id,source_sha256:OVERSPEED_LIBRARY.source_sha256,title:stage.label,drills:program.drills.map(d=>({drill_id:d.id,completed:false}))};
}
export function validateOverSpeedSession(record,players){
  if(!record||!players.includes(record.player))throw new TypeError('Choose a player.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('Invalid OverSpeed workout identity.');overspeedDate(record.session_date);
  const expected=overspeedSessionDraft(record.stage_id);
  for(const key of ['protocol','program_id','source_sha256','title'])if(record[key]!==expected[key])throw new TypeError('The OverSpeed workout must match its selected source phase.');
  if(typeof record.notes!=='string'||record.notes.length>500||record.completion_confirmed!==true)throw new TypeError('Confirm the actual workout and keep notes within 500 characters.');
  if(!Array.isArray(record.drills)||record.drills.length!==expected.drills.length||record.drills.some((d,i)=>!d||d.drill_id!==expected.drills[i].drill_id||typeof d.completed!=='boolean'))throw new TypeError('Keep every prescribed drill in its original order.');
  const count=record.drills.filter(d=>d.completed).length;
  if(record.completion_method==='guided_bat_speed'){
    const program=OVERSPEED_LIBRARY.programs.find(p=>p.id===record.program_id),steps=overSpeedSteps(program),ids=record.guided_completed_steps,legacy=record.guided_legacy_drills;
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!steps.some(s=>s.id===id))||!Array.isArray(legacy)||new Set(legacy).size!==legacy.length||legacy.some(id=>!program.drills.some(d=>d.id===id))||!ids.length&&!legacy.length)throw new TypeError('Keep the saved guided steps and earlier reported drills.');
    const links=record.guided_step_records;if(!Array.isArray(links)||links.length!==ids.length||links.some((link,i)=>!link||link.step_id!==ids[i]||typeof link.record_id!=='string'||!link.record_id.trim()||link.record_id.length>120)||new Set(links.map(link=>link.record_id)).size!==links.length)throw new TypeError('Keep each guided step linked to its saved reading.');
    for(const drill of record.drills){const done=legacy.includes(drill.drill_id)||steps.filter(s=>s.drill_id===drill.drill_id).every(s=>ids.includes(s.id));if(drill.completed!==done)throw new TypeError('A guided drill needs every prescribed setup and side before completion.');}
  }else if(!count)throw new TypeError('Mark at least one full drill complete.');
  if(record.completion_status!==(count===record.drills.length?'completed':'partial'))throw new TypeError('Workout completion must match the reported drills.');return true;
}
export function validateOverSpeedSessions(records,players){
  if(!Array.isArray(records))throw new TypeError('OverSpeed workouts could not be read.');const ids=new Set(),dates=new Set();
  for(const r of records){validateOverSpeedSession(r,players);const day=JSON.stringify([r.player,r.session_date]);if(ids.has(r.id)||dates.has(day))throw new TypeError('Only one OverSpeed workout can be logged per player/date.');ids.add(r.id);dates.add(day);}return true;
}
export function overspeedProgression(records,player,asOf){
  overspeedDate(asOf);const selected=records.filter(r=>r.player===player&&r.session_date<=asOf);validateOverSpeedSessions(selected,[player]);const results=[];
  for(const stage of OVERSPEED_STAGES){
    const prior=results.at(-1),unlocked=!prior||prior.complete&&prior.next_date<=asOf,earliest=prior?.next_date??null;
    const stageRecords=selected.filter(r=>r.stage_id===stage.id&&(!earliest||r.session_date>=earliest)).sort((a,b)=>a.session_date.localeCompare(b.session_date)),start=unlocked?stageRecords[0]?.session_date??null:null;
    const weeks=new Map(),credited=[],ignored=[];let last=prior?.last_credited_date??null,lastActual=prior?.last_training_date??null;
    if(start)for(const record of stageRecords){
      if(record.completion_status!=='completed'){lastActual=record.session_date;continue;}const week=Math.floor((overspeedDate(record.session_date)-overspeedDate(start))/604800000);
      const previousActual=lastActual;lastActual=record.session_date;
      if(previousActual&&overspeedDate(record.session_date)-overspeedDate(previousActual)<172800000){ignored.push({id:record.id,reason:'A full day off between credited sessions is required.'});continue;}
      const entries=weeks.get(week)??[];if(entries.length>=stage.per_week){ignored.push({id:record.id,reason:'This training week already has its required sessions.'});continue;}entries.push(record);weeks.set(week,entries);credited.push(record);last=record.session_date;
    }
    const weekRows=[...weeks].map(([index,entries])=>({index,start:overspeedDayOffset(start,index*7),end:overspeedDayOffset(start,index*7+6),opens_next:overspeedDayOffset(start,index*7+7),count:entries.length,complete:entries.length>=stage.per_week&&overspeedDayOffset(start,index*7+7)<=asOf})).sort((a,b)=>a.index-b.index);
    const qualified=weekRows.filter(w=>w.complete),complete=unlocked&&qualified.length>=stage.weeks;
    let nextDate=complete?qualified[stage.weeks-1].opens_next:null;
    // Maintenance may continue for 4+ weeks. Never begin the next phase before the
    // latest credited work and its full intervening day off.
    if(nextDate&&lastActual&&overspeedDayOffset(lastActual,2)>nextDate)nextDate=overspeedDayOffset(lastActual,2);
    results.push({...stage,unlocked,start,earliest,complete,next_date:nextDate,weeks_complete:Math.min(stage.weeks,qualified.length),credited_count:credited.length,last_credited_date:last,last_training_date:lastActual,week_rows:weekRows,ignored,records:stageRecords});
  }
  return {player,as_of:asOf,stages:results,current:results.find(s=>!s.complete)??results.at(-1),all_minimums_complete:results.every(s=>s.complete)};
}
export function canUseOverSpeedProgram(records,player,programId,date){
  if(programId.startsWith('counterweight-'))return Boolean(player);if(!player)return false;
  return overspeedProgression(records,player,date).stages.some(s=>s.program_id===programId&&s.unlocked);
}
export function upsertOverSpeedSession(records,record,players,asOf){
  validateOverSpeedSessions(records,players);validateOverSpeedSession(record,players);overspeedDate(asOf);
  if(record.session_date>asOf)throw new TypeError('Future workouts cannot count toward progression.');
  const existing=records.find(r=>r.id===record.id);
  if(existing&&(existing.player!==record.player||existing.stage_id!==record.stage_id))throw new TypeError('Keep the original player and phase when editing a workout.');
  if(records.some(r=>r.id!==record.id&&r.player===record.player&&r.session_date===record.session_date))throw new TypeError('This player already has a workout for that date. Edit that workout instead.');
  const others=records.filter(r=>r.id!==record.id),stage=overspeedStage(record.stage_id),progress=overspeedProgression(others,record.player,record.session_date);
  if(!progress.stages[stage.index].unlocked)throw new TypeError('This phase is locked. Complete the earlier training weeks, maintenance and ramp-up first.');
  if(others.some(r=>r.player===record.player&&(overspeedStage(r.stage_id).index>stage.index&&r.session_date<=record.session_date||overspeedStage(r.stage_id).index<stage.index&&r.session_date>=record.session_date)))throw new TypeError('Training phases must remain in chronological order.');
  const copy={...record,created_at:existing?.created_at??record.created_at,drills:record.drills.map(d=>({...d}))};return existing?records.map(r=>r.id===record.id?copy:r):[...records,copy];
}
export function overSpeedSessionsCsv(records){
  const rows=[['id','player','date','cycle','phase','level','completion','drill','completed','notes','guided_completed_steps_json','guided_step_records_json','guided_legacy_drills_json'],...records.flatMap(r=>{const s=overspeedStage(r.stage_id);return r.drills.map(d=>[r.id,r.player,r.session_date,s.cycle,s.phase,s.level,r.completion_status,d.drill_id,d.completed,r.notes]);})];
  const cell=v=>'"'+String(typeof v==='string'&&/^\s*[=+@-]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}

export function guidedOverSpeedWorkout(records,speedRecords,{player,date,stage_id,removed_record_ids=[]},players,asOf){
  const draft=overspeedSessionDraft(stage_id),program=OVERSPEED_LIBRARY.programs.find(p=>p.id===draft.program_id),day=records.find(r=>r.player===player&&r.session_date===date);
  if(day&&day.stage_id!==stage_id)throw new TypeError('This date already belongs to another training phase.');
  const raw=speedRecords.filter(r=>r.player===player&&r.session_date===date&&r.program_id===program.id&&r.guided_protocol==='velo_overspeed_steps_v1'&&r.guided_stage_id===stage_id);for(const r of raw)validateBatSpeedSet(r,players);
  const legacy=day?.completion_method==='guided_bat_speed'?[...day.guided_legacy_drills]:day?.drills.filter(d=>d.completed).map(d=>d.drill_id)??[];
  const references=new Map((day?.guided_step_records??[]).filter(link=>!removed_record_ids.includes(link.record_id)).map(link=>[link.step_id,link.record_id]));for(const r of raw)if(!removed_record_ids.includes(r.id))references.set(r.guided_step_id,r.id);
  const ids=overSpeedSteps(program).filter(s=>references.has(s.id)).map(s=>s.id),links=ids.map(id=>({step_id:id,record_id:references.get(id)}));
  if(!ids.length&&!legacy.length)return {record:null,next:records.filter(r=>r!==day)};
  const steps=overSpeedSteps(program),drills=draft.drills.map(d=>({...d,completed:legacy.includes(d.drill_id)||steps.filter(s=>s.drill_id===d.drill_id).every(s=>ids.includes(s.id))}));let hash=2166136261;for(const c of player)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;const stamp=new Date().toISOString();
  const record={...day,...draft,id:day?.id??`os-session-${hash.toString(16)}-${date}`,player,session_date:date,drills,completion_confirmed:true,completion_status:drills.every(d=>d.completed)?'completed':'partial',completion_method:'guided_bat_speed',guided_completed_steps:ids,guided_step_records:links,guided_legacy_drills:legacy,notes:day?.notes??'',created_at:day?.created_at??stamp,updated_at:stamp};
  return {record,next:upsertOverSpeedSession(records,record,players,asOf)};
}
