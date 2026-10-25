import { OVERSPEED_LIBRARY } from './overspeed-library.mjs?v=combined-workouts-20261025';
export const BAT_CONFIGURATIONS=Object.freeze({base:'Base bat only',first_sleeve:'Green sleeve',both_sleeves:'Green & black sleeves',game_bat:'Game bat'});
export const BAT_SPEED_DEVICES=Object.freeze({pocket_radar:'Pocket Radar',prgr:'PRGR radar',blast:'Blast Motion',other:'Other device'});
export function summarizeBatSpeeds(swings){
  if(!Array.isArray(swings)||swings.length!==5||swings.some(value=>value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<=0)))throw new TypeError('Use five bat-speed slots; leave unused readings blank and enter positive mph readings.');
  const values=swings.filter(value=>value!==null);if(!values.length)throw new TypeError('Enter at least one bat-speed reading.');
  return {count:values.length,best_mph:Math.max(...values),mean_mph:values.reduce((a,b)=>a+b,0)/values.length};
}
export function validateBatSpeedSet(record,players){
  if(!record||!players.includes(record.player))throw new TypeError('Choose a player.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('Invalid bat-speed set identity.');
  const stamp=typeof record.session_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(record.session_date)?Date.parse(record.session_date+'T12:00:00Z'):NaN;
  if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==record.session_date)throw new TypeError('Choose a valid training date.');
  const program=OVERSPEED_LIBRARY.programs.find(p=>p.id===record.program_id);
  if(!program||!program.drills.some(d=>d.id===record.drill_id))throw new TypeError('Choose a program and one of its drills.');
  if(!Object.hasOwn(BAT_CONFIGURATIONS,record.configuration)||!['dominant','non_dominant'].includes(record.side)||typeof record.puck_used!=='boolean')throw new TypeError('Record the bat configuration, swing side and Puck use.');
  for(const[key,max]of [['bat_label',120],['device_label',100]])if(typeof record[key]!=='string'||!record[key].trim()||record[key].length>max)throw new TypeError(key==='bat_label'?'Enter the actual bat used.':'The saved measuring device is missing.');
  if(!Object.hasOwn(BAT_SPEED_DEVICES,record.device_type)||record.metric!=='bat_speed'||record.unit!=='mph')throw new TypeError('This log records bat speed in mph, with a named measuring device.');
  if(typeof record.notes!=='string'||record.notes.length>300)throw new TypeError('Keep notes within 300 characters.');
  if(record.guided_protocol!==undefined){
    const step=overSpeedSteps(program).find(s=>s.id===record.guided_step_id);
    if(record.guided_protocol!=='velo_overspeed_steps_v1'||record.guided_source_sha256!==OVERSPEED_LIBRARY.source_sha256||!step||step.drill_id!==record.drill_id||step.configuration!==record.configuration||step.side!==record.side||typeof record.guided_stage_id!=='string'||!record.guided_stage_id||record.guided_stage_id.length>60)throw new TypeError('Keep the guided step’s original drill, setup, side and source.');
    if(!Array.isArray(record.swings_mph)||record.swings_mph.length!==5||record.swings_mph.slice(0,step.reps).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0)||record.swings_mph.slice(step.reps).some(v=>v!==null))throw new TypeError(`Enter all ${step.reps} speeds for this step before continuing.`);
  }
  return summarizeBatSpeeds(record.swings_mph);
}
export function upsertBatSpeedSet(records,record,players){
  const stats=validateBatSpeedSet(record,players),matches=records.filter(r=>r.id===record.id);
  if(matches.length>1||matches.some(r=>r.player!==record.player))throw new Error('Bat-speed set identity conflict.');
  const previous=matches[0];if(previous?.guided_protocol&&['session_date','program_id','drill_id','guided_protocol','guided_step_id','guided_stage_id','guided_source_sha256'].some(key=>previous[key]!==record[key]))throw new Error('Keep the original guided step and date when editing its speeds.');
  const copy={...record,swings_mph:[...record.swings_mph],bat_speed_mph:stats.mean_mph,maximum_mph:stats.best_mph,swing_count:stats.count};
  return matches.length?records.map(r=>r.id===copy.id?copy:r):[...records,copy];
}
export function batSpeedContext(record){return JSON.stringify([record.program_id,record.drill_id,record.configuration,record.side,record.puck_used,record.bat_label,record.device_type,record.device_label]);}
export function batSpeedProgress(records,context){
  const selected=records.filter(r=>batSpeedContext(r)===context),groups=new Map();
  for(const record of selected){const values=record.swings_mph.filter(v=>v!==null);if(!groups.has(record.session_date))groups.set(record.session_date,[]);groups.get(record.session_date).push(...values);}
  const days=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,count:values.length,best_mph:Math.max(...values),mean_mph:values.reduce((a,b)=>a+b,0)/values.length}));
  const first=days[0]??null,latest=days.at(-1)??null;return {days,sets:selected.length,first,latest,change_best_mph:days.length>1?latest.best_mph-first.best_mph:null};
}
export function batSpeedCsv(records){
  const rows=[['id','player','session_date','program_id','drill_id','configuration','side','puck_used','bat_label','device_type','device_label','metric','unit','swing_1_mph','swing_2_mph','swing_3_mph','swing_4_mph','swing_5_mph','best_mph','mean_mph','swing_count','notes','guided_protocol','guided_step_id','guided_stage_id','guided_source_sha256'],...records.map(r=>{const stats=summarizeBatSpeeds(r.swings_mph);return[r.id,r.player,r.session_date,r.program_id,r.drill_id,r.configuration,r.side,r.puck_used,r.bat_label,r.device_type,r.device_label,r.metric,r.unit,...r.swings_mph,stats.best_mph,stats.mean_mph,stats.count,r.notes,r.guided_protocol,r.guided_step_id,r.guided_stage_id,r.guided_source_sha256];})];
  const cell=v=>'"'+String(typeof v==='string'&&/^\s*[=+@-]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';return rows.map(r=>r.map(cell).join(',')).join('\r\n');
}

// Expand the source table: each set changes the sleeve setup; Both alternates sides within that set.
export function overSpeedSteps(program){
  if(!program?.drills?.length)throw new TypeError('Choose a source OverSpeed program.');
  return program.drills.flatMap(drill=>{
    if(![1,3].includes(drill.sets)||!['Both','Dom'].includes(drill.side)||![3,5].includes(drill.reps))throw new TypeError('This source drill needs a reviewed step sequence.');
    return ['base','first_sleeve','both_sleeves'].slice(0,drill.sets).flatMap((configuration,index)=>(drill.side==='Both'?['dominant','non_dominant']:['dominant']).map(side=>({id:`${program.id}/${drill.id}/${index+1}/${side}`,program_id:program.id,drill_id:drill.id,drill_name:drill.name,set_number:index+1,configuration,side,reps:drill.reps})));
  });
}
export function overSpeedStepProgress(records,{player,program,date,stage_id,legacy_drills=[],saved_steps=[]}){
  const steps=overSpeedSteps(program),eligible=records.filter(r=>r.player===player&&r.program_id===program.id&&r.session_date===date&&r.guided_protocol==='velo_overspeed_steps_v1'&&r.guided_stage_id===stage_id),saved=new Set([...saved_steps,...eligible.map(r=>r.guided_step_id)]),legacy=new Set(legacy_drills);
  const finished=step=>saved.has(step.id)||legacy.has(step.drill_id),next=steps.find(step=>!finished(step))??null;
  return {steps,next,done:steps.filter(finished).length,total:steps.length,complete:!next,completed_drills:program.drills.filter(d=>steps.filter(s=>s.drill_id===d.id).every(finished)).map(d=>d.id)};
}
