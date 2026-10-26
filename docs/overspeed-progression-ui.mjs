import { OVERSPEED_LIBRARY } from './overspeed-library.mjs?v=schedule-auto-refresh-20261025';
import { OVERSPEED_STAGES,overspeedSessionDraft,validateOverSpeedSessions,overspeedProgression,upsertOverSpeedSession,canUseOverSpeedProgram,overSpeedSessionsCsv,guidedOverSpeedWorkout } from './overspeed-progression.mjs?v=schedule-auto-refresh-20261025';

export function startOverSpeedProgression({players,scope,element:$,download,onChange,onProgressChange,readShared}){
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;},option=(value,text)=>{const n=make('option','',text);n.value=value;return n;};
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,key='rangers-overspeed-sessions-v1-'+scope;
  let records=[],readable=true,saved=true,dirty=false,editing=null,selectedStage='',busy=false,viewProgram='',mountSpeeds=null,contextGuard=()=>true,lastDate=today;const completed=new Map();const player=()=>$('overspeed-player').value;
  try{const raw=localStorage.getItem(key);if(raw){const data=JSON.parse(raw);if(data.version!==1)throw Error();validateOverSpeedSessions(data.records,players);records=data.records;}}
  catch{readable=false;saved=false;$('os-protocol-storage').textContent='Saved training progress could not be read. Existing data is preserved. New entries stay in this page; export before closing.';}
  $('os-session-date').value=today;$('os-sync').hidden=!globalThis.google?.script?.run;
  function store(){if(readable)try{localStorage.setItem(key,JSON.stringify({version:1,records}));saved=true;$('os-protocol-storage').textContent='';}catch{saved=false;$('os-protocol-storage').textContent='Device saving is unavailable. Export your completed-workout records before closing.';}}
  function persist(next){const before=records;records=next;store();onChange?.(before,next);onProgressChange?.();}
  function state(){return player()?overspeedProgression(records,player(),today):null;}
  function clearDraft(){lastDate=today;editing=null;dirty=false;selectedStage='';viewProgram='';completed.clear();$('os-session-date').value=today;$('os-session-notes').value='';$('os-session-error').hidden=true;$('os-session-cancel').hidden=true;$('os-session-save').textContent='Save workout notes';}
  function renderChecklist(values){
    if(values){completed.clear();for(const d of values)completed.set(d.drill_id,d.completed);}
    const container=$('os-session-drills');container.replaceChildren();const stage=OVERSPEED_STAGES.find(s=>s.id===$('os-stage').value);
    const p=OVERSPEED_LIBRARY.programs.find(p=>p.id===(viewProgram||stage?.program_id));
    const counts=Boolean(stage&&p?.id===stage.program_id&&player());$('os-session-save').disabled=!counts;$('os-completion-controls').hidden=!counts;
    if(!p||!player()){container.append(make('p','field-help','Choose your name to see your current program and enter readings.'));mountSpeeds?.(null,[]);return;}
    $('os-session-phase').textContent=counts?stage.label:p.name+' · bat-speed logging only; outside the selected training phase';
    const hosts=[];
    for(const drill of p.drills){
      const card=make('article','overspeed-drill-card');card.dataset.drill=drill.id;
      card.append(make('h3','',drill.name),make('p','overspeed-prescription',`${drill.sets} set${drill.sets===1?'':'s'} x ${drill.reps} swings · ${drill.side==='Both'?'both sides':'dominant side'}`),make('p','',drill.description.replace(/\bfirst sleeve\b/gi,'green sleeve').replace(/\bboth sleeves\b/gi,'green & black sleeves')));
      const video=make('a','exercise-demo','Watch exercise demonstration · Level '+p.level+' video ↗');video.href=p.video_url;video.target='_blank';video.rel='noopener noreferrer';card.append(video);
      card.append(make('p','field-help',`Velo Sports’ ${p.name} level demonstration. Source plan: uploaded PDF, page ${p.source_page}.`));
      const host=make('div','overspeed-drill-entry');card.append(host);
      const status=make('p','field-help os-drill-status',counts&&completed.get(drill.id)===true?'Completed · drill recorded.':'In progress · save each prescribed side and setup to complete this drill.');status.setAttribute('role','status');status.dataset.drill=drill.id;card.append(status);hosts.push({drill,host,status,trackWorkout:counts});

      container.append(card);
    }
    mountSpeeds?.(p,hosts);
  }
  function renderHistory(){
    const items=records.filter(r=>r.player===player()).sort((a,b)=>b.session_date.localeCompare(a.session_date)),container=$('os-session-history');container.replaceChildren();$('os-session-export').disabled=!items.length;
    if(!items.length){container.append(make('p','field-help','No OverSpeed workouts saved for this player. Saving bat speed for a drill in the selected phase records its completion here.'));return;}
    for(const record of items){const details=make('details','workout-record'),summary=make('summary');summary.append(make('strong','',record.session_date+' · '+(record.completion_status==='completed'?'Full workout reported':'Partial workout')),make('small','',record.title));details.append(summary);const body=make('div','workout-record-body');for(const drill of record.drills){const name=OVERSPEED_LIBRARY.programs.find(p=>p.id===record.program_id).drills.find(d=>d.id===drill.drill_id).name;body.append(make('p','',`${drill.completed?'✓ Completed':'Not completed'} · ${name}`));}if(record.notes)body.append(make('p','workout-record-notes',record.notes));
      const actions=make('div','workout-record-actions'),edit=make('button','secondary-button','Edit workout'),remove=make('button','delete-button','Delete workout');edit.type=remove.type='button';
      edit.addEventListener('click',()=>{if(dirty&&!window.confirm('Replace unsaved workout completion changes with this saved workout?'))return;editing=record.id;selectedStage=record.stage_id;viewProgram=record.program_id;$('os-stage').value=record.stage_id;$('os-stage').disabled=true;$('os-session-date').value=record.session_date;lastDate=record.session_date;$('os-session-notes').value=record.notes;renderChecklist(record.drills);$('os-session-save').textContent='Update workout';$('os-session-cancel').hidden=false;dirty=false;});
      remove.addEventListener('click',()=>{if(!window.confirm('Delete this workout? Progress will be recalculated and later levels may lock again.'))return;persist(records.filter(r=>r.id!==record.id));clearDraft();render();});actions.append(edit,remove);body.append(actions);details.append(body);container.append(details);
    }
  }
  function render(){
    const progress=state(),stages=$('os-cycle-progress');stages.replaceChildren();const select=$('os-stage'),previous=selectedStage||select.value;select.replaceChildren(option('','Choose a training phase'));select.disabled=!player()||Boolean(editing);
    if(!progress){$('os-progress-summary').textContent='Choose your name first. Higher OverSpeed levels stay locked until the earlier phases are complete.';renderChecklist();renderHistory();return;}
    for(const stage of progress.stages){const row=make('div','os-phase-row'+(stage.complete?' is-complete':stage.unlocked?' is-current':' is-locked'));row.append(make('strong','',stage.label),make('span','',stage.unlocked?`${stage.weeks_complete} / ${stage.weeks} weeks · ${stage.credited_count} credited sessions`:'Locked'),make('small','',`${stage.per_week} full session${stage.per_week===1?'':'s'} / week · ${stage.weeks}${stage.phase==='Maintenance'?'+':''} weeks`));stages.append(row);const item=option(stage.id,stage.label+(stage.unlocked?'':' · Locked'));item.disabled=!stage.unlocked;select.append(item);}
    const available=progress.stages.filter(s=>s.unlocked),chosen=available.find(s=>s.id===previous)??(progress.current.unlocked?progress.current:available.at(-1));select.value=chosen?.id??'';selectedStage=select.value;
    const current=progress.current;$('os-progress-summary').textContent=progress.all_minimums_complete?'All chart minimums completed. Level 3 maintenance may continue.':`${current.label}: ${current.weeks_complete} / ${current.weeks} completed training weeks. ${current.start?'Week 1 began '+current.start+'.':'Log the first workout to begin its training weeks.'}${current.earliest&&!current.unlocked?' This phase opens no earlier than '+current.earliest+'.':''}`;
    if(!editing){const day=records.find(r=>r.player===player()&&r.session_date===$('os-session-date').value&&r.stage_id===$('os-stage').value);if(!dirty){completed.clear();for(const d of day?.drills??[])completed.set(d.drill_id,d.completed);$('os-session-notes').value=day?.notes??'';}renderChecklist();}renderHistory();
  }
  $('os-stage').addEventListener('change',()=>{if(dirty&&!window.confirm('Change phase and clear the unsaved workout notes?')){$('os-stage').value=selectedStage;return;}if(!contextGuard()){$('os-stage').value=selectedStage;return;}selectedStage=$('os-stage').value;viewProgram='';completed.clear();dirty=false;renderChecklist();});
  $('os-session-notes').addEventListener('input',()=>{dirty=true;});
  $('os-session-date').addEventListener('change',()=>{if(dirty&&!window.confirm('Change date and clear unsaved workout notes?')){$('os-session-date').value=lastDate;return;}if(!contextGuard()){$('os-session-date').value=lastDate;return;}lastDate=$('os-session-date').value;if(editing){dirty=true;return;}dirty=false;render();});
  function saveSession(event){
    event.preventDefault();const existing=records.find(r=>r.id===editing)??records.find(r=>r.player===player()&&r.session_date===$('os-session-date').value);let record;
    try{if(existing?.completion_method==='guided_bat_speed'&&existing.session_date!==$('os-session-date').value)throw Error('Keep this guided workout’s saved date. Choose another date outside edit mode to start a new workout.');if(existing&&existing.stage_id!==$('os-stage').value)throw Error('This date already belongs to another training phase. Edit that workout or choose another date.');const draft=overspeedSessionDraft($('os-stage').value),drills=draft.drills.map(d=>({...d,completed:completed.get(d.drill_id)===true})),stamp=new Date().toISOString();let hash=2166136261;for(const c of player())hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
      record={...existing,...draft,id:existing?.id??`os-session-${hash.toString(16)}-${$('os-session-date').value}`,player:player(),session_date:$('os-session-date').value,drills,completion_status:drills.every(d=>d.completed)?'completed':'partial',completion_confirmed:true,notes:$('os-session-notes').value.trim(),created_at:existing?.created_at??stamp,updated_at:stamp};persist(upsertOverSpeedSession(records,record,players,today));
    }catch(error){$('os-session-error').hidden=false;$('os-session-error').textContent=error.message;return;}
    clearDraft();render();const progress=state(),stage=progress.stages.find(s=>s.id===record.stage_id),ignored=stage.ignored.find(item=>item.id===record.id);$('os-session-announcement').textContent=`${existing?'Updated':'Saved'} ${record.completion_status==='completed'?'full':'partial'} workout.${ignored?' Not credited: '+ignored.reason:''} ${saved?'Saved on this device.':'Export before closing.'}`;
  }
  $('os-session-save').addEventListener('click',saveSession);
  $('os-session-cancel').addEventListener('click',()=>{if(dirty&&!window.confirm('Discard unsaved workout changes?'))return;clearDraft();render();});
  $('os-session-export').addEventListener('click',()=>download('rangers-overspeed-workout-completion.csv',overSpeedSessionsCsv(records.filter(r=>r.player===player()))));
  function prepareSpeedCompletion(speed,{editingSpeed=false,nextSpeedRecords=[],manualExtra=false}={}){
    if(speed.guided_protocol==='velo_overspeed_steps_v1'){const day=records.find(r=>r.player===speed.player&&r.session_date===speed.session_date);if(editingSpeed&&day?.guided_step_records?.some(link=>link.step_id===speed.guided_step_id&&link.record_id===speed.id))return ()=>({drill_complete:day.drills.find(d=>d.drill_id===speed.drill_id)?.completed??false,workout_status:day.completion_status,message:'Saved speeds corrected. Workout progress is unchanged.'});return prepareGuidedChange(speed,nextSpeedRecords);}
    if(manualExtra)return ()=>({drill_complete:false,workout_status:null,message:'Extra reading saved. Continue the guided workout to complete its prescribed steps.'});
    if(speed.player!==player())throw Error('Choose the player whose bat speed is being saved.');
    const program=OVERSPEED_LIBRARY.programs.find(p=>p.id===speed.program_id);
    if(program?.family==='counterweight')return ()=>({drill_complete:true,workout_status:null,message:'Drill complete. Counterweight is outside the OverSpeed cycle chart.'});
    const day=records.find(r=>r.player===speed.player&&r.session_date===speed.session_date);
    const selected=OVERSPEED_STAGES.find(s=>s.id===$('os-stage').value);
    const stage=day?.program_id===speed.program_id?OVERSPEED_STAGES.find(s=>s.id===day.stage_id):selected;
    if(!stage||stage.program_id!==speed.program_id)return ()=>({drill_complete:true,workout_status:null,message:'Drill complete. This program is outside the selected training phase; no cycle credit was added.'});
    let next,record;
    try{
      if(day&&day.stage_id!==stage.id)throw Error('This date already belongs to another training phase. Edit that workout or choose another date.');
      const draft=overspeedSessionDraft(stage.id),stamp=new Date().toISOString();let hash=2166136261;for(const c of speed.player)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
      const drills=draft.drills.map(d=>({...d,completed:d.drill_id===speed.drill_id||day?.drills.find(prior=>prior.drill_id===d.drill_id)?.completed===true}));
      const sameContext=$('os-session-date').value===speed.session_date&&$('os-stage').value===stage.id;
      record={...day,...draft,id:day?.id??`os-session-${hash.toString(16)}-${speed.session_date}`,player:speed.player,session_date:speed.session_date,drills,completion_status:drills.every(d=>d.completed)?'completed':'partial',completion_confirmed:true,completion_method:'bat_speed_save',notes:sameContext?$('os-session-notes').value.trim():day?.notes??'',created_at:day?.created_at??stamp,updated_at:stamp};
      next=upsertOverSpeedSession(records,record,players,today);
    }catch(error){
      if(!editingSpeed)throw error;
      return ()=>({drill_complete:false,workout_status:null,message:'Bat speed updated. Workout completion was not changed: '+error.message});
    }
    return ()=>{
      // The speed form validates both records before applying either save.
      $('os-session-date').value=record.session_date;selectedStage=record.stage_id;viewProgram=record.program_id;$('os-stage').value=record.stage_id;
      completed.clear();for(const d of record.drills)completed.set(d.drill_id,d.completed);$('os-session-notes').value=record.notes;dirty=false;editing=null;
      persist(next);render();
      const progress=state(),phase=progress.stages.find(s=>s.id===record.stage_id),ignored=phase.ignored.find(item=>item.id===record.id);
      const message=record.completion_status==='completed'?'Drill complete. All drills saved: workout complete.':'Drill complete. Partial workout saved; finish the remaining drills.';
      $('os-session-announcement').textContent=message+(ignored?' No cycle credit: '+ignored.reason:'')+(saved?' Saved on this device.':' Export workout history before closing; device saving is unavailable.');
      return {drill_complete:true,workout_status:record.completion_status,message:$('os-session-announcement').textContent};
    };
  }
  function guidedContext(programId,date=$('os-session-date').value){
    const program=OVERSPEED_LIBRARY.programs.find(p=>p.id===programId),day=records.find(r=>r.player===player()&&r.session_date===date&&r.program_id===programId),selected=OVERSPEED_STAGES.find(s=>s.id===$('os-stage').value);
    const stageId=program?.family==='counterweight'?'counterweight':day?.stage_id??(selected?.program_id===programId?selected.id:'practice');
    return {stage_id:stageId,step_records:day?.guided_step_records??[],saved_steps:day?.guided_completed_steps??[],legacy_drills:day?(day.completion_method==='guided_bat_speed'?day.guided_legacy_drills:day.drills.filter(d=>d.completed).map(d=>d.drill_id)):[]};
  }
  function prepareGuidedChange(speed,nextSpeeds,{removedRecordIds=[]}={}){
    const stage=OVERSPEED_STAGES.find(s=>s.id===speed.guided_stage_id);
    if(!stage)return ()=>({drill_complete:false,workout_status:null,message:'Step saved. Continue to the next prescribed step.'});
    if(stage.program_id!==speed.program_id)throw Error('The guided step must match its training phase.');
    const update=guidedOverSpeedWorkout(records,nextSpeeds,{player:speed.player,date:speed.session_date,stage_id:stage.id,removed_record_ids:removedRecordIds},players,today);
    const sameContext=player()===speed.player&&$('os-session-date').value===speed.session_date&&$('os-stage').value===stage.id;
    if(update.record&&sameContext&&dirty){update.record.notes=$('os-session-notes').value.trim();update.next=upsertOverSpeedSession(records,update.record,players,today);}
    return ()=>{
      persist(update.next);if(player()===speed.player){dirty=false;editing=null;lastDate=speed.session_date;$('os-session-date').value=speed.session_date;selectedStage=stage.id;viewProgram=speed.program_id;$('os-stage').value=stage.id;render();}
      const record=update.record,drill=record?.drills.find(d=>d.drill_id===speed.drill_id),message=!record?'Guided workout progress removed.':record.completion_status==='completed'?'All prescribed steps saved. Workout complete.':drill?.completed?'Drill complete. Continue to the next drill.':'Step saved. Continue to the next side or bat setup.';
      $('os-session-announcement').textContent=message+(saved?' Saved on this device.':' Export workout history before closing; device saving is unavailable.');return {drill_complete:drill?.completed??false,workout_status:record?.completion_status??null,message:$('os-session-announcement').textContent};
    };
  }
  async function sync(){
    if(busy)return;if(dirty&&!window.confirm('Refresh progress and discard unsaved workout notes?'))return;if(!contextGuard())return;busy=true;$('os-sync').disabled=true;
    try{const response=await readShared(player());if(response.player!==player())throw Error('Choose the connected player to load their progress.');let merged=new Map(response.sessions.map(r=>[r.id,r]));for(const event of response.pending){if(event.operation==='delete')merged.delete(event.record.id);else merged.set(event.record.id,event.record);}const next=[...records.filter(r=>r.player!==player()),...merged.values()];validateOverSpeedSessions(next,players);records=next;store();clearDraft();render();onProgressChange?.();$('os-sync-status').textContent='Loaded your coach-received workout records and kept your waiting changes.';}
    catch(error){$('os-sync-status').textContent=error.message;}finally{busy=false;$('os-sync').disabled=false;}
  }
  $('os-sync').addEventListener('click',()=>void sync());render();
  return {clearPlayer(name){if(!players.includes(name))return false;persist(records.filter(r=>r.player!==name));if(player()===name){clearDraft();render();}return true;},records:()=>[...records].sort((a,b)=>a.session_date.localeCompare(b.session_date)),canUse:(programId,p,date)=>Boolean(p)&&(date||today)<=today&&canUseOverSpeedProgram(records,p,programId,date||today),confirmPlayerChange:()=>!dirty||window.confirm('Switch players and clear unsaved workout completion changes?'),playerChanged:()=>{clearDraft();render();},setProgram:id=>{viewProgram=id;renderChecklist();},attachSpeedForms:callback=>{mountSpeeds=callback;renderChecklist();},prepareSpeedCompletion,prepareGuidedChange,guidedContext,setContextGuard:guard=>{contextGuard=guard;},sync};
}
