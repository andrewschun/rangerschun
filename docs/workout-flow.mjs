import {workoutProgramProgress,workoutIsLocked,workoutRound,workoutCoverage} from './workout-program.mjs?v=training-plans-20261025';
import { isThrowingWorkout, isThrowingOffDay, THROWING_OFF_DAY_SOURCE, previousWorkoutLoad, previousWorkoutLoadText } from './workout-record-tools.mjs?v=schedule-auto-refresh-20261025';
import { createWorkoutLoadFields } from './workout-load-ui.mjs?v=schedule-auto-refresh-20261025';
import { plateLoadDescription } from './workout-load.mjs?v=schedule-auto-refresh-20261025';
import { WORKOUT_LIBRARY } from './library.mjs?v=schedule-auto-refresh-20261025';
import { appendDrivelineBallText } from './driveline-colors.mjs?v=schedule-auto-refresh-20261025';
import { WORKOUT_PROGRAMS, WORKOUT_TEMPLATES, findWorkoutDemo, isWorkoutVideoUrl, workoutPrescriptionLines, workoutCycleForProgram, workoutTypeForProgram, workoutProgramChoices, formatWeightedBaseballOunces } from './library-tools.mjs?v=schedule-auto-refresh-20261025';
import { workoutChecklistDraft, workoutExerciseRecorded, workoutChecklistProgress } from './workout-checklist.mjs?v=schedule-auto-refresh-20261025';
import { WORKOUT_CATEGORIES, validateWorkout, upsertWorkout, summarizeWorkouts, workoutsToCsv } from './engine.mjs?v=schedule-auto-refresh-20261025';

export function startWorkoutFlow({players,scope,element:$,download,onChange,variant='workouts',sharedStore=null,onNavigate}){
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const option=(value,text)=>{const n=make('option','',text);n.value=value;return n;};
  const number=input=>input.value.trim()===''?null:input.valueAsNumber;
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const key='rangers-workouts-v1-'+scope,throwing=variant==='throwing',listeners=new Set();
  const inScope=record=>isThrowingWorkout(record)===throwing;
  let records=[],readable=true,saved=true,editing=null,dirty=false,selectedPlayer='',sourceId='',mode='empty',selection={cycle:'1',program:'',day:'',week:''};
  try{
    const raw=sharedStore?null:localStorage.getItem(key);
    if(raw){const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.records))throw Error();const ids=new Set();for(const r of data.records){validateWorkout(r,players);if(ids.has(r.id))throw Error();ids.add(r.id);}records=data.records;}
  }catch{readable=false;saved=false;$('workout-storage-status').textContent='Device storage could not be read. New workouts stay in this open page; export before closing. Existing saved data will not be overwritten.';}
  if(sharedStore){records=sharedStore.records();({readable,saved}=sharedStore.storageState());}
  function persist(next,{journal=true}={}){
    if(sharedStore){sharedStore.commit(next,{journal});return;}
    const before=records;
    if(readable){try{localStorage.setItem(key,JSON.stringify({version:1,records:next}));saved=true;$('workout-storage-status').textContent='';}catch{saved=false;$('workout-storage-status').textContent='Device saving is unavailable. Changes stay in this open page; export before closing.';}}
    records=next;if(journal)onChange?.(before,next);renderHistory();refreshReminders();for(const listener of listeners)listener();
  }
  function reminder(exercise){const text=make('p','previous-load-reminder');text.reminderExercise=exercise;setReminder(text);return text;}
  function setReminder(node){const prior=previousWorkoutLoad(records,{player:$('workout-player').value,exercise:node.reminderExercise,session_date:$('workout-date').value,exclude_id:editing});node.textContent=previousWorkoutLoadText(prior);node.hidden=!prior;}
  function refreshReminders(){for(const node of $('workout-exercises').querySelectorAll('.previous-load-reminder'))setReminder(node);}
  function demo(exercise){
    if(!exercise||!isWorkoutVideoUrl(exercise.demo_url))return null;
    const related=exercise.demo_status==='related_variation',link=make('a','exercise-demo',related?'Related demo ↗':'Watch demo ↗');link.href=exercise.demo_url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`${related?'Related demo':'Watch demo'}: ${exercise.name} (opens in a new tab)`);if(exercise.demo_note)link.title=exercise.demo_note;return link;
  }
  function exerciseNote(value){
    const details=make('details','checklist-notes'),summary=make('summary','','Add exercise notes'),input=make('input');input.type='text';input.maxLength=200;input.value=value.notes??'';input.placeholder='Different loads, timing, or anything to tell your coach';input.dataset.exercise='notes';input.setAttribute('aria-label',`${value.name} notes`);details.append(summary,input);if(value.notes)details.open=true;return details;
  }
  function addCheck(value,index){
    const position=Number.isInteger(index)?index+1:$('workout-exercises').children.length+1,row=make('article','workout-checklist-row');row.workoutPlan={...value};row.dataset.checklistNumber=String(position);
    const label=make('label','checklist-complete'),check=make('input');check.type='checkbox';check.checked=value.completed;check.dataset.exercise='completed';check.setAttribute('aria-label',`${position}. Completed listed sets and reps: ${value.name}`);
    const text=make('span'),title=make('strong'),number=make('span','checklist-item-number',position+'.');number.setAttribute('aria-hidden','true');title.append(number,document.createTextNode(value.name));text.append(title,make('small','','Completed listed sets / reps'));label.append(check,text);
    const content=make('div','checklist-prescription'),source=pickedTemplate()?.exercises.find(e=>e.id===value.source_exercise_id);
    if(source?.section)content.append(make('small','checklist-section',source.section));
    const planText=make('p','exercise-plan'),displayPlan=formatWeightedBaseballOunces(value.planned_details);if(pickedTemplate()?.completion_only)appendDrivelineBallText(planText,displayPlan);else planText.textContent=displayPlan||'Follow the listed workout instructions.';content.append(planText);if(value.completion_group)content.append(make('small','demo-note','Choose one of the workbook’s velocity options.'));
    if(source?.source_note)content.append(make('p','demo-note',source.source_note));
    const reference=findWorkoutDemo(value.name,value.source_exercise_id),link=demo(reference);if(link)content.append(link);if(reference?.demo_status==='related_variation')content.append(make('small','demo-note',reference.demo_note));
    if(value.weight_required){row.workoutLoad=createWorkoutLoadFields(value,value.name);content.append(row.workoutLoad.element,reminder(value));}
    content.append(exerciseNote(value));row.append(label,content);$('workout-exercises').append(row);
    const sync=()=>{if(check.checked&&value.completion_group)for(const peer of $('workout-exercises').children){if(peer!==row&&peer.workoutPlan?.completion_group===value.completion_group){peer.querySelector('[data-exercise="completed"]').checked=false;peer.classList.toggle('is-completed',false);}}row.classList.toggle('is-completed',check.checked);refreshCount();};check.addEventListener('change',sync);sync();
  }
  function addManual(value={name:'',sets:null,reps:null,weight:null,weight_unit:'lb',notes:''}){
    if($('workout-exercises').children.length>=30)return;
    const row=make('div','workout-exercise-row');row.workoutPlan={...value};row.append(make('span','exercise-number',''));
    const grid=make('div','workout-exercise-fields');
    for(const[k,labelText,type]of [['name','Exercise','text'],['sets','Sets','number'],['reps','Reps / set','number']]){
      const label=make('label',k==='name'?'exercise-name-field':k==='notes'?'exercise-notes-field':'',labelText),input=make(type==='select'?'select':'input');input.dataset.exercise=k;
      {input.type=type;input.value=value[k]??'';input.autocomplete='off';if(type==='number'){input.min=k==='weight'?'0':'1';input.step=k==='weight'?'any':'1';input.inputMode=k==='weight'?'decimal':'numeric';if(k!=='weight')input.max='999';}else input.maxLength=k==='name'?120:200;}
      label.append(input);grid.append(label);
    }
    row.workoutLoad=createWorkoutLoadFields(value,value.name||'Exercise');grid.append(row.workoutLoad.element);
    const noteLabel=make('label','exercise-notes-field','Time, distance, or set details'),noteInput=make('input');noteInput.type='text';noteInput.maxLength=200;noteInput.dataset.exercise='notes';noteInput.value=value.notes??'';noteLabel.append(noteInput);grid.append(noteLabel);
    const reference=make('div','exercise-reference'),lastLoad=reminder(value);grid.append(reference,lastLoad);
    const showReference=()=>{reference.replaceChildren();const name=grid.querySelector('[data-exercise="name"]').value.trim();lastLoad.reminderExercise={...value,name};setReminder(lastLoad);if(name.toLowerCase()===value.name.toLowerCase()&&value.planned_details)reference.append(make('p','exercise-plan',formatWeightedBaseballOunces(value.planned_details)));const link=demo(findWorkoutDemo(name,value.source_exercise_id));if(link)reference.append(link);};grid.querySelector('[data-exercise="name"]').addEventListener('input',showReference);showReference();
    const remove=make('button','workout-remove-exercise','×');remove.type='button';remove.addEventListener('click',()=>{if($('workout-exercises').children.length>1){row.remove();dirty=true;refreshCount();}});row.append(grid,remove);$('workout-exercises').append(row);refreshCount();
  }
  function refreshCount(){
    const rows=[...$('workout-exercises').children];
    if(mode==='checklist'){const groups=new Map();rows.forEach((row,i)=>{const key=row.workoutPlan.completion_group||'exercise:'+i;groups.set(key,Boolean(groups.get(key))||row.querySelector('[data-exercise="completed"]')?.checked);});$('workout-exercise-count').textContent=`${[...groups.values()].filter(Boolean).length} / ${groups.size} completed`;}
    else if(mode==='manual'){
      rows.forEach((row,i)=>{row.querySelector('.exercise-number').textContent=String(i+1).padStart(2,'0');row.querySelectorAll('[data-exercise]').forEach(input=>input.setAttribute('aria-label',`Exercise ${i+1} ${input.dataset.exercise.replaceAll('_',' ')}`));const remove=row.querySelector('.workout-remove-exercise');remove.disabled=rows.length===1;remove.setAttribute('aria-label',`Remove exercise ${i+1}`);});$('workout-exercise-count').textContent=`${rows.length} / 30`;$('workout-add-exercise').disabled=rows.length>=30;
    }else $('workout-exercise-count').textContent=mode==='reference'?'Reference only':'Choose a workout';
  }
  function pickedTemplate(){return WORKOUT_TEMPLATES.find(t=>t.program_id===$('library-program').value&&t.day===Number($('library-day').value)&&t.week===Number($('library-week').value));}
  function captureSelection(){selection={cycle:$('library-cycle').value,program:$('library-program').value,day:$('library-day').value,week:$('library-week').value};}
  function fillPrograms(cycle,preferred=''){
    const choices=throwing?[{id:'throwing-routine',type:'throwing',label:'Throwing Routine'}]:workoutProgramChoices(cycle).filter(choice=>choice.type!=='throwing'),select=$('library-program');select.replaceChildren(option('','Choose a workout type'),...choices.map(choice=>option(choice.id,choice.label)));
    const match=choices.find(choice=>choice.id===preferred)??choices.find(choice=>choice.type===workoutTypeForProgram(preferred));if(match)select.value=match.id;else if(throwing)select.value='throwing-routine';
  }
  function fillDays(day){
    const program=WORKOUT_PROGRAMS.find(p=>p.id===$('library-program').value),select=$('library-day');select.replaceChildren();select.disabled=!program;
    if(program){for(const d of program.days)select.append(option(String(d.number),d.label));if(day&&program.days.some(d=>String(d.number)===day))select.value=day;}else select.append(option('','Choose a day'));
  }
  function fillWeeks(week){
    const templates=WORKOUT_TEMPLATES.filter(t=>t.program_id===$('library-program').value&&t.day===Number($('library-day').value)),select=$('library-week');select.replaceChildren();
    if(templates.length){for(const t of templates)select.append(option(String(t.week),t.week_label));if(week&&templates.some(t=>String(t.week)===week))select.value=week;}else select.append(option('','Choose a week'));select.disabled=templates.length<=1;
  }
  function restoreSelection(){$('library-cycle').value=selection.cycle;fillPrograms(selection.cycle,selection.program);fillDays(selection.day);fillWeeks(selection.week);}
  function renderPlanHeading(template){
    const content=$('library-content');content.replaceChildren();if(!template){content.append(make('p','library-empty',mode==='manual'?'Enter your actual workout details below.':'Select your workout to see its exercises and demo links.'));return;}
    const heading=make('div','library-plan-heading');heading.append(make('h3','',template.name),make('span','',`${template.exercises.length} exercises · ${template.source_template_ids?'med ball first, then lift':'workbook plan'}`));content.append(heading);
    const program=WORKOUT_PROGRAMS.find(p=>p.id===template.program_id),notes=[...(program?.notes??[]),...(template.notes??[])];
    if(notes.length){const details=make('details','library-program-notes');details.append(make('summary','','Read the workbook’s program notes'));notes.sort((a,b)=>{const ac=a.cell.replace(/\d/g,''),bc=b.cell.replace(/\d/g,'');return ac.length-bc.length||ac.localeCompare(bc)||parseInt(a.cell.replace(/\D/g,''))-parseInt(b.cell.replace(/\D/g,''));});let column='',last=0,p=null;for(const note of notes){const c=note.cell.replace(/\d/g,''),r=Number(note.cell.replace(/\D/g,''));if(c!==column||r>last+1||!p){p=make('p');details.append(p);}p.append(document.createTextNode((p.textContent?' ':'')+note.text));column=c;last=r;}content.append(details);}
  }
  function referenceRows(template){
    for(const exercise of template.exercises){const row=make('article','library-exercise'),body=make('div'),prescription=make('p','library-prescription');appendDrivelineBallText(prescription,formatWeightedBaseballOunces(workoutPrescriptionLines(exercise).join('\n')));body.append(make('h4','',exercise.name),prescription);if(exercise.source_note)body.append(make('p','demo-note',exercise.source_note));row.append(body);const link=demo(exercise);if(link)row.append(link);$('workout-exercises').append(row);}
    const extra=make('div','library-extra-demos');extra.append(make('h4','','More throwing & recovery demos'));for(const exercise of [WORKOUT_LIBRARY.drills['Step Backs'],...WORKOUT_LIBRARY.throwing_extras]){const link=demo(exercise);if(link)extra.append(link);}$('workout-exercises').append(extra);
  }
  function setMode(next){
    $('workout-form').hidden=false;
    mode=next;const manual=mode==='manual';$('workout-manual-fields').hidden=!manual;$('workout-manual-confirm').hidden=!manual;$('workout-add-exercise').hidden=!manual;$('workout-save').disabled=!['manual','checklist'].includes(mode);
    $('workout-exercises').classList.toggle('is-checklist',mode==='checklist');
    $('workout-exercises-title').textContent=manual?'Actual exercise details':mode==='reference'?'Throwing routine · reference only':'Exercise checklist';
    $('workout-exercise-help').textContent=manual?'Enter the sets, reps and loads you completed, or add time / distance details.':'A check confirms you finished the listed sets and reps. Unfinished exercises stay unchecked.';
    $('workout-save-help').textContent=manual?'Confirm your actual results before saving. For a partial workout, explain changes in session notes.':mode==='reference'?'Actual PlyoCare throw entry remains on hold.':'Check completed exercises and enter weight or plates used. Plate counts cover the whole bar.';
  }
  function resetDraft({allowLocked=false}={}){
    editing=null;sourceId='';$('workout-date').value=today;$('workout-title').value='';$('workout-category').value='strength';$('workout-completion').value='';$('workout-confirm').checked=false;$('workout-duration').value='';$('workout-effort').value='';$('workout-notes').value='';$('workout-exercises').replaceChildren();$('workout-error').hidden=true;$('workout-cancel-edit').hidden=true;$('workout-mode-label').textContent='CHOOSE & COMPLETE';$('workout-form-title').textContent=throwing?'Your throwing routine':'Your workout';$('workout-save').textContent=throwing?'Save throwing routine +':'Save workout +';
    const template=pickedTemplate(),locked=!throwing&&!allowLocked&&template&&workoutIsLocked(template,workoutProgramProgress(records,$('workout-player').value));setMode(locked?'locked':$('library-program').value==='custom'?'manual':template?(template.log_enabled===false?'reference':'checklist'):'empty');renderPlanHeading(template);
    $('library-cycle-note').hidden=$('library-program').value!=='throwing-routine';
    $('workout-template-status').hidden=!template;$('workout-template-status').textContent=mode==='reference'?'Reference only. Original ball colors and effort notes are retained. Actual PlyoCare entry remains on hold.':template?'Check each exercise after completing its listed plan. Enter the actual weight used; planned loads are not filled in.':'';
    if(template?.completion_only){$('workout-exercises-title').textContent='Throwing routine checklist';$('workout-exercise-help').textContent='Check completed warm-up, throwing and recovery exercises. Where the workbook lists alternatives, choose one.';$('workout-template-status').textContent='Log routine completion with checkboxes. Ball colours, listed sets and effort notes are retained; no PlyoCare velocities are entered here.';$('workout-save-help').textContent='Save full or partial routine completion. No velocity or load entry is needed.';}
    if(mode==='checklist'){const draft=workoutChecklistDraft(template);sourceId=draft.source_template_id;$('workout-title').value=draft.title;$('workout-category').value=draft.category;draft.exercises.forEach(addCheck);}
    else if(mode==='reference')referenceRows(template);else if(mode==='manual')addManual();else $('workout-exercises').append(make('p','workout-empty','Choose a workout above to begin.'));
    $('workout-extra-demos').replaceChildren();if(template?.completion_only){const box=$('workout-extra-demos');box.append(make('h4','','More throwing & recovery demos'));for(const item of [WORKOUT_LIBRARY.drills['Step Backs'],...WORKOUT_LIBRARY.throwing_extras]){const link=demo(item);if(link)box.append(link);}}
    if(locked){$('workout-template-status').hidden=false;$('workout-template-status').textContent='Completed workout locked until all three cycles are finished. Choose another scheduled day, or edit the original entry in history to correct it.';}
    refreshCount();dirty=false;
  }
  function chosen(){return records.filter(r=>r.player===$('workout-player').value&&inScope(r)).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.created_at??'').localeCompare(String(a.created_at??'')));}
  function description(exercise,record){
    const parts=[];
    if(typeof exercise.completed==='boolean')parts.push(exercise.completed?'Completed as listed':exercise.completion_group&&record.exercises.some(e=>e.completion_group===exercise.completion_group&&e.completed)?'Alternative not selected':'Not completed');
    else{if(exercise.sets!==null)parts.push(`${exercise.sets} sets`);if(exercise.reps!==null)parts.push(`${exercise.reps} reps / set`);}
    if(exercise.load_entry==='plates')parts.push(plateLoadDescription(exercise));else if(exercise.weight!==null)parts.push(`${exercise.weight} ${exercise.weight_unit}`);else if(exercise.completed!==false){if(exercise.weight_unit==='bodyweight')parts.push('Bodyweight');else if(exercise.weight_required&&exercise.weight_unit==='none')parts.push('No added load');}
    return parts.join(' · ')||'Actual numbers not recorded';
  }
  function edit(record){
    if(isThrowingOffDay(record)){$('workout-announcement').textContent='To change this Off day, open its calendar day and uncheck Off day completed.';onNavigate?.(variant);return false;}
    if((dirty||editing)&&!window.confirm('Replace the unsaved workout draft with this saved workout?'))return;
    const sourceTemplate=WORKOUT_TEMPLATES.find(t=>t.id===record.source_template_id),template=record.entry_mode==='plan_checklist'?sourceTemplate:null;
    selectedPlayer=record.player;$('workout-player').value=record.player;
    $('library-cycle').value=workoutCycleForProgram(sourceTemplate?.program_id)||$('library-cycle').value||'1';fillPrograms($('library-cycle').value,template?template.program_id:'custom');fillDays(template?String(template.day):'');fillWeeks(template?String(template.week):'');captureSelection();resetDraft({allowLocked:true});
    editing=record.id;sourceId=record.source_template_id??'';$('workout-date').value=record.session_date;$('workout-title').value=record.title;$('workout-category').value=record.category;$('workout-completion').value=record.completion_status??'';$('workout-duration').value=record.duration_minutes??'';$('workout-effort').value=record.effort;$('workout-notes').value=record.notes;
    $('workout-exercises').replaceChildren();record.exercises.forEach(template?addCheck:addManual);$('workout-mode-label').textContent='EDITING SAVED WORKOUT';$('workout-form-title').textContent='Edit workout';$('workout-save').textContent='Update workout ✓';$('workout-cancel-edit').hidden=false;dirty=false;refreshCount();$('workout-date').focus();onNavigate?.(variant);return true;
  }
  function renderHistory(){
    const player=$('workout-player').value,items=chosen(),stats=summarizeWorkouts(items);$('workout-history-title').textContent=player?`${player} · ${items.length} ${throwing?'routine day':'workout'}${items.length===1?'':'s'}${saved?' saved':' in this page'}`:'Choose a player to view workouts';$('workout-export').disabled=$('workout-delete-player').disabled=!items.length;
    $('workout-summary').replaceChildren();const done=items.reduce((n,r)=>n+r.exercises.filter(workoutExerciseRecorded).length,0);
    for(const[label,value,note]of [[throwing?'Routine days logged':'Workouts logged',stats.session_count,'For the selected player'],[throwing?'Activities completed':'Exercises completed',done,'Checks or actual details recorded'],['Minutes recorded',stats.duration_minutes??'—',`${stats.duration_count} workouts with duration`],['Most recent workout',stats.last_date??'—','Recorded session date']]){const card=make('article');card.append(make('h3','',label),make('strong',label==='Most recent workout'?'workout-date-stat':'',String(value)),make('small','',note));$('workout-summary').append(card);}
    const history=$('workout-history');history.replaceChildren();if(!items.length)history.append(make('p','workout-empty',player?'No workouts logged yet. Check off your first workout above.':'Choose your name to see your workout journal.'));
    for(const record of items){const card=make('details','workout-record'),heading=make('summary'),text=make('div'),meta=[record.completion_status==='completed'?'Reported completed':record.completion_status==='partial'?'Partly completed':'Earlier log · not confirmed'];if(record.entry_mode==='plan_checklist'){const p=workoutChecklistProgress(record);meta.push(`${p.recorded} / ${p.total} completed`);}else meta.push(isThrowingOffDay(record)?'Rest day confirmation':`${record.exercises.length} exercises`);if(record.duration_minutes!==null)meta.push(`${record.duration_minutes} min`);text.append(make('span','workout-record-date',`${record.session_date} · ${WORKOUT_CATEGORIES[record.category]}`),make('strong','',record.title),make('small','',meta.join(' · ')));heading.append(text,make('span','workout-expand','+'));card.append(heading);
      const body=make('div','workout-record-body'),list=make('ol','workout-record-exercises');for(const exercise of record.exercises){const li=make('li');li.append(make('strong','',exercise.name),make('p','',description(exercise,record)));if(exercise.planned_details)li.append(make('small','exercise-plan',formatWeightedBaseballOunces(exercise.planned_details)));const link=demo(findWorkoutDemo(exercise.name,exercise.source_exercise_id));if(link)li.append(link);if(exercise.notes)li.append(make('small','',exercise.notes));list.append(li);}body.append(list);if(record.notes)body.append(make('p','workout-record-notes',record.notes));
      const actions=make('div','workout-record-actions'),editButton=make('button','secondary-button','Edit workout'),remove=make('button','delete-button','Delete workout');editButton.type=remove.type='button';editButton.addEventListener('click',()=>edit(record));remove.addEventListener('click',()=>{if(!window.confirm(`Delete “${record.title}” from this device?`))return;persist(records.filter(r=>r.id!==record.id));if(editing===record.id)resetDraft();renderHistory();$('workout-announcement').textContent=saved?'Workout deleted from this device.':'Removed from this page; device saving is unavailable.';});const restart=make('button','secondary-button workout-restart','Restart session');restart.type='button';restart.addEventListener('click',()=>restartSession(record));if(isThrowingOffDay(record)){remove.textContent='Undo Off day';actions.append(remove);}else actions.append(editButton,restart,remove);body.append(actions);card.append(body);history.append(card);
    }
  }
  function exerciseFields(row){
    if(mode==='checklist'){const plan={...row.workoutPlan};delete plan.load_entry;delete plan.plate_load;return {...plan,...(row.workoutLoad?.read()??{weight:null,weight_unit:'none'}),completed:row.querySelector('[data-exercise="completed"]').checked,notes:row.querySelector('[data-exercise="notes"]').value.trim()};}
    const fields=Object.fromEntries([...row.querySelectorAll('[data-exercise]')].map(input=>[input.dataset.exercise,input.type==='number'?number(input):input.value.trim()])),plan=row.workoutPlan;Object.assign(fields,row.workoutLoad.read());
    if(fields.name.toLowerCase()===plan.name.toLowerCase()){if(plan.source_exercise_id)fields.source_exercise_id=plan.source_exercise_id;if(plan.planned_details)fields.planned_details=plan.planned_details;}return fields;
  }
  $('workout-player').replaceChildren(option('','Choose a player'),...players.map(p=>option(p,p)));
  const initialCycle=$('library-cycle').value,initialProgram=throwing?'throwing-routine':$('library-program').value,initialDay=$('library-day').value,initialWeek=$('library-week').value;
  $('library-cycle').replaceChildren(...['1','2','3'].map(cycle=>option(cycle,'Cycle '+cycle)));$('library-cycle').value=['1','2','3'].includes(initialCycle)?initialCycle:'1';
  fillPrograms($('library-cycle').value,initialProgram);fillDays(initialDay);fillWeeks(initialWeek);captureSelection();
  for(const id of ['library-cycle','library-program','library-day','library-week'])$(id).addEventListener('change',()=>{
    if((dirty||editing)&&!window.confirm('Change the workout and clear your unsaved entries?')){restoreSelection();return;}
    if(id==='library-cycle'){fillPrograms($('library-cycle').value,selection.program);fillDays();fillWeeks();}else if(id==='library-program'){fillDays();fillWeeks();}else if(id==='library-day')fillWeeks($('library-week').value);captureSelection();resetDraft();
  });
  $('workout-form').addEventListener('input',event=>{if(!['workout-player','library-cycle','library-program','library-day','library-week','workout-plan-cycle','workout-plan-week','workout-plan-day'].includes(event.target.id))dirty=true;});
  $('workout-form').addEventListener('change',event=>{if(!['workout-player','library-cycle','library-program','library-day','library-week','workout-plan-cycle','workout-plan-week','workout-plan-day'].includes(event.target.id))dirty=true;});
  $('workout-player').addEventListener('change',()=>{if((dirty||editing)&&!window.confirm('Switch players and clear this unsaved workout draft?')){$('workout-player').value=selectedPlayer;return;}selectedPlayer=$('workout-player').value;resetDraft();renderHistory();$('workout-announcement').textContent='';});
  $('workout-add-exercise').addEventListener('click',()=>{addManual();dirty=true;$('workout-exercises').lastElementChild.querySelector('[data-exercise="name"]').focus();});
  $('workout-cancel-edit').addEventListener('click',()=>{if(dirty&&!window.confirm('Discard your unsaved workout edits?'))return;resetDraft();});
  $('workout-form').addEventListener('submit',event=>{
    event.preventDefault();if(!['manual','checklist'].includes(mode))return;const existing=records.find(r=>r.id===editing),timestamp=new Date().toISOString(),exercises=[...$('workout-exercises').children].map(exerciseFields);
    const record={id:editing??globalThis.crypto?.randomUUID?.()??`workout-${Date.now()}-${Math.random().toString(36).slice(2)}`,player:$('workout-player').value,session_date:$('workout-date').value,title:$('workout-title').value.trim(),category:$('workout-category').value,duration_minutes:number($('workout-duration')),effort:$('workout-effort').value,notes:$('workout-notes').value.trim(),exercises,completion_status:mode==='checklist'?(workoutChecklistProgress({exercises}).all?'completed':'partial'):$('workout-completion').value,completion_confirmed:mode==='checklist'||$('workout-confirm').checked,created_at:existing?.created_at??timestamp,updated_at:timestamp};if(sourceId)record.source_template_id=sourceId;if(mode==='checklist')record.entry_mode='plan_checklist';
    if(!throwing&&sourceId&&workoutCoverage(sourceId).length){const progress=workoutProgramProgress(records,record.player);if(!editing&&workoutIsLocked(sourceId,progress)){$('workout-error').hidden=false;$('workout-error').textContent='This workout is already completed. Finish all three cycles before starting it again, or edit its saved entry to correct a mistake.';return;}record.program_round=existing?workoutRound(existing):progress.round;}
    try{persist(upsertWorkout(records,record,players));}catch(error){$('workout-error').hidden=false;$('workout-error').textContent=error.message;return;}
    const wasEditing=Boolean(editing),progress=record.entry_mode==='plan_checklist'?workoutChecklistProgress(record):null;resetDraft();renderHistory();$('workout-announcement').textContent=`Workout ${wasEditing?'updated':'saved'} for ${record.player}. ${progress?`${progress.recorded} / ${progress.total} completed. `:''}${saved?'Saved on this device.':'Kept in this open page; export before closing.'}`;
  });
  $('workout-export').addEventListener('click',()=>{if(chosen().length)download(throwing?'rangers-player-throwing-sessions.csv':'rangers-player-workouts.csv',workoutsToCsv(chosen()));});
  $('workout-delete-player').addEventListener('click',()=>{const player=$('workout-player').value,count=chosen().length;if(!count||!window.confirm(`Delete all ${count} workouts for ${player} from this device? Export first if you need a copy.`))return;persist(records.filter(r=>r.player!==player||!inScope(r)));resetDraft();renderHistory();$('workout-announcement').textContent=saved?'Player workouts deleted from this device.':'Removed from this page; device saving is unavailable.';});
  for(const item of WORKOUT_LIBRARY.link_review)$('library-link-review').append(make('li','',`${item.sheet} ${item.cell} · ${item.text}: ${item.status==='related_variation'?'related variation':item.status==='repaired_from_workbook'?'matching workbook link':'Driveline replacement'}${item.note?' · '+item.note:''}`));
  function deleteSession(record,{confirm=true,journal=true}={}){
    if(confirm&&!window.confirm(`Delete “${record.title}” for ${record.player} on ${record.session_date}?`))return false;
    persist(records.filter(item=>item.id!==record.id),{journal});if(editing===record.id)resetDraft();renderHistory();return true;
  }
  function restartSession(record,{confirm=true,journal=true}={}){
    if(confirm&&!window.confirm(`Restart “${record.title}” for ${record.player}? Its saved results will be removed and a fresh draft opened. Unsaved entries in this form will be cleared.`))return false;
    if(isThrowingOffDay(record)){deleteSession(record,{confirm:false,journal});$('workout-announcement').textContent='Off day confirmation cleared. Open its calendar day to check it off again.';onNavigate?.(variant);return true;}
    dirty=false;editing=null;deleteSession(record,{confirm:false,journal});edit(record);resetDraft();$('workout-player').value=record.player;selectedPlayer=record.player;$('workout-date').value=record.session_date;
    if(mode==='manual'){$('workout-title').value=record.title;$('workout-category').value=record.category;$('workout-exercises').replaceChildren();record.exercises.forEach(exercise=>addManual({name:exercise.name,sets:null,reps:null,weight:null,weight_unit:'lb',notes:'',...(exercise.planned_details?{planned_details:exercise.planned_details}:{}),...(exercise.source_exercise_id?{source_exercise_id:exercise.source_exercise_id}:{})}));}
    refreshReminders();renderHistory();$('workout-announcement').textContent='Session restarted. Check off the work and enter actual loads before saving again.';onNavigate?.(variant);return true;
  }
  function openTemplate({template_id,date,player}){
    const template=WORKOUT_TEMPLATES.find(t=>t.id===template_id&&t.program_id==='throwing-routine');
    if(!throwing||!template||!players.includes(player)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const matching=records.filter(r=>r.player===player&&r.session_date===date&&r.source_template_id===template_id).sort((a,b)=>String(a.updated_at??a.created_at??'').localeCompare(String(b.updated_at??b.created_at??'')));
    if(matching.length)return edit(matching.at(-1))===true;
    if((dirty||editing)&&!window.confirm('Open this calendar workout and clear the unsaved draft?'))return false;
    selectedPlayer=player;$('workout-player').value=player;
    fillPrograms('1','throwing-routine');fillDays(String(template.day));fillWeeks(String(template.week));captureSelection();resetDraft();$('workout-date').value=date;refreshReminders();renderHistory();onNavigate?.(variant);return true;
  }
  function openScheduledTemplate({template_id,player}){
    const template=WORKOUT_TEMPLATES.find(t=>t.id===template_id);
    if(throwing||!template||!players.includes(player)||workoutIsLocked(template,workoutProgramProgress(records,player)))return false;
    const round=workoutProgramProgress(records,player).round,partial=records.find(r=>r.player===player&&r.source_template_id===template_id&&workoutRound(r)===round&&r.completion_status==='partial');
    if(partial)return edit(partial)===true;
    if((dirty||editing)&&!window.confirm('Change the workout and clear your unsaved entries?'))return false;
    selectedPlayer=player;$('workout-player').value=player;$('library-cycle').value=workoutCycleForProgram(template.program_id);fillPrograms($('library-cycle').value,template.program_id);fillDays(String(template.day));fillWeeks(String(template.week));captureSelection();resetDraft();renderHistory();return true;
  }
  function setOffDay({player,date,completed}){
    if(!throwing||!players.includes(player)||typeof completed!=='boolean'||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a player and a valid Off day.');
    const stamp=Date.parse(date+'T12:00:00Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date)throw Error('Choose a valid Off day date.');
    const existing=records.filter(r=>isThrowingOffDay(r)&&r.player===player&&r.session_date===date);
    if(!completed){if(existing.length)persist(records.filter(r=>!existing.some(prior=>prior.id===r.id)));return true;}
    if(existing.some(r=>r.completion_status==='completed'&&r.completion_confirmed===true))return true;
    const timestamp=new Date().toISOString(),record={id:existing[0]?.id??globalThis.crypto?.randomUUID?.()??`off-${Date.now()}-${Math.random().toString(36).slice(2)}`,player,session_date:date,title:'Throwing routine · Off day',category:'other',duration_minutes:null,effort:'',notes:'Scheduled throwing Off day completed.',source_template_id:THROWING_OFF_DAY_SOURCE,completion_status:'completed',completion_confirmed:true,created_at:existing[0]?.created_at??timestamp,updated_at:timestamp,exercises:[{name:'Off day completed',sets:null,reps:null,weight:null,weight_unit:'none',notes:'Rest day confirmation.',completed:true}]};
    persist(upsertWorkout(records,record,players));return true;
  }
  $('workout-date').addEventListener('change',refreshReminders);
  if(sharedStore)sharedStore.subscribe(()=>{records=sharedStore.records();({readable,saved}=sharedStore.storageState());$('workout-storage-status').textContent=saved?'':'Device saving is unavailable; export before closing.';renderHistory();refreshReminders();});
  resetDraft();renderHistory();return {records:()=>records,commit:persist,subscribe:listener=>listeners.add(listener),storageState:()=>({readable,saved}),hasDraft:()=>dirty||Boolean(editing),editSession:edit,restartSession,deleteSession,openTemplate,openScheduledTemplate,setOffDay};
}
