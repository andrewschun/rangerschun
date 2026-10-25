import { plateLoadDescription } from './workout-load.mjs';
import { formatWeightedBaseballOunces } from './library-tools.mjs';
export function startWorkoutAccountability({players,getRecords,element,download,summarize,toCsv,weekFor,onSessionAction}){
  const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const remote=Boolean(globalThis.google?.script?.run);
  let snapshot=null,coachCode='',busy=false,current=null;
  const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const week=weekFor(date);element('accountability-from').value=week.from;element('accountability-to').value=week.to;
  element('accountability-coach-auth').hidden=!remote;
  function receipt(value){return value?new Date(value).toLocaleString():'Not recorded';}
  function detailsFor(row){
    const details=node('details','accountability-details'),summary=node('summary','',row.records.length?'View workout details':'No workout details');details.append(summary);
    for(const record of row.records){
      const entry=node('article','accountability-entry');entry.dataset.recordId=record.id;entry.dataset.player=record.player;entry.append(node('h4','',`${record.session_date} · ${record.title}`));
      const status=record.completion_status==='completed'?'Player reported completed':record.completion_status==='partial'?'Player reported partial':'Earlier log · completion not confirmed';entry.append(node('p','accountability-record-status',status));
      const meta=[];if(record.duration_minutes!==null)meta.push(`${record.duration_minutes} minutes`);if(record.effort)meta.push(`${record.effort} effort`);if(meta.length)entry.append(node('p','',meta.join(' · ')));
      const list=node('ul');for(const exercise of record.exercises){
        const item=node('li');item.append(node('strong','',exercise.name));const actual=[];if(typeof exercise.completed==='boolean')actual.push(exercise.completed?'Completed as listed':exercise.completion_group&&record.exercises.some(e=>e.completion_group===exercise.completion_group&&e.completed)?'Alternative not selected':'Not completed');if(exercise.sets!==null)actual.push(`${exercise.sets} sets`);if(exercise.reps!==null)actual.push(`${exercise.reps} reps/set`);if(exercise.load_entry==='plates')actual.push(plateLoadDescription(exercise));else if(exercise.weight!==null)actual.push(`${exercise.weight} ${exercise.weight_unit}`);if(exercise.weight_unit==='bodyweight')actual.push('bodyweight');if(exercise.weight_required&&exercise.weight_unit==='none')actual.push('No added load');if(exercise.notes)actual.push(exercise.notes);item.append(node('span','',actual.length?actual.join(' · '):'Actual results not recorded'));if(exercise.planned_details)item.append(node('small','exercise-plan',formatWeightedBaseballOunces(exercise.planned_details)));list.append(item);
      }entry.append(list);if(record.notes)entry.append(node('p','',`Player notes: ${record.notes}`));
      if(snapshot){entry.append(node('small','',`Coach first received: ${receipt(record.coach_first_received_at)} · Latest received change: ${receipt(record.coach_last_received_at)}`));}
      else{entry.append(node('small','',`First saved on device: ${receipt(record.created_at)} · Last edited on device: ${receipt(record.updated_at??record.created_at)}. Device times are not coach receipts.`));}
      if(onSessionAction){const actions=node('div','workout-record-actions');for(const[action,label]of [['restart','Restart session'],['delete','Delete session']]){const button=node('button',action==='delete'?'delete-button':'secondary-button',label);button.type='button';let eventId=null;button.addEventListener('click',async()=>{
        if(busy||!window.confirm(`${label} for ${record.player}: “${record.title}” on ${record.session_date}? ${action==='restart'?'Saved results will be removed and a fresh draft opened; unsaved entries in that form will be cleared.':'This removes this session from the active history.'}`))return;
        busy=true;button.disabled=true;element('accountability-error').hidden=true;
        try{
          if(snapshot){eventId??=globalThis.crypto?.randomUUID?.()??`coach-${Date.now()}-${Math.random().toString(36).slice(2)}`;const response=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Coach change was not confirmed. Refresh before trying again.')),25000);globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Coach change was not confirmed. Reconnect or refresh the coach records.'));}).mutateCoachWorkout({code:coachCode,action,player:record.player,record_id:record.id,event_id:eventId,expected_received_at:record.coach_last_received_at});});if(!response||!Array.isArray(response.records)||!Array.isArray(response.players))throw Error('Coach change response could not be verified.');summarize(response.records,response.players,{from:element('accountability-from').value,to:element('accountability-to').value});snapshot=response;}
          await onSessionAction(action,record,{remote:Boolean(snapshot)});render();
        }catch(error){element('accountability-error').textContent=error.message;element('accountability-error').hidden=false;}finally{busy=false;button.disabled=false;}
      });actions.append(button);}entry.append(actions);}
      details.append(entry);
    }return details;
  }
  function render(){
    const error=element('accountability-error');error.hidden=true;
    try{current=summarize(snapshot?.records??getRecords(),snapshot?.players??players,{from:element('accountability-from').value,to:element('accountability-to').value});}
    catch(problem){current=null;error.hidden=false;error.textContent=problem.message;element('accountability-export').disabled=true;element('accountability-players').replaceChildren();element('accountability-summary').replaceChildren();return;}
    element('accountability-source').textContent=snapshot?`Coach sheet · refreshed ${receipt(snapshot.as_of)}`:'This device only · shared Google records are not loaded';
    element('accountability-scope').textContent=snapshot?'These are workouts received by the private coach sheet. Refresh to check for new player submissions.':'This view shows only workouts saved in this browser. Entries on other phones will appear here after Google activation and coach sign-in.';
    const cards=element('accountability-summary');cards.replaceChildren();
    for(const[label,value]of [['Players with logs',`${current.players_logged} / ${current.rows.length}`],['Players with no entries',current.players_without_entries],['Workout logs',current.workouts_logged],['Reported completed',current.completed_reports]]){const card=node('article');card.append(node('span','',label),node('strong','',String(value)));cards.append(card);}
    const body=element('accountability-players');body.replaceChildren();
    const show=element('accountability-filter').value;
    const shown=current.rows.filter(row=>show==='all'||(show==='logged'?row.logged>0:row.logged===0));
    for(const row of shown){
      const tr=node('tr');tr.append(node('th','',row.player));tr.firstChild.scope='row';
      const state=node('td');state.append(node('span','status-pill '+(row.logged?'observed':'neutral'),row.logged?'Has logs':'No entry'));tr.append(state,node('td','',String(row.logged)),node('td','',String(row.completed)),node('td','',String(row.partial)),node('td','',row.last_workout_date??'—'));
      const info=node('td');if(row.logged){info.append(detailsFor(row));if(row.earlier_logs)info.append(node('small','accountability-note',`${row.earlier_logs} earlier log${row.earlier_logs===1?'':'s'} without confirmation`));if(row.details_missing)info.append(node('small','accountability-note',`${row.details_missing} entr${row.details_missing===1?'y':'ies'} with missing actual details`));}else info.textContent='No workout recorded in this date range.';tr.append(info);body.append(tr);
    }
    if(!shown.length){const tr=node('tr'),td=node('td','','No players match this filter.');td.colSpan=7;tr.append(td);body.append(tr);}
    element('accountability-export').disabled=false;
  }
  async function loadShared(){
    if(!remote||busy)return;busy=true;element('accountability-refresh').disabled=true;element('accountability-refresh').textContent='Loading coach records…';
    try{
      const code=element('accountability-code').value.trim()||coachCode;
      const response=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Coach records did not load. Your existing view is unchanged; try again.')),25000);globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Coach access was not confirmed. Sign in as the coach or enter the coach code from the private sheet.'));}).getCoachWorkouts({code});});
      if(!response||!Array.isArray(response.players)||!Array.isArray(response.records)||typeof response.as_of!=='string')throw Error('The coach response could not be verified.');
      summarize(response.records,response.players,{from:element('accountability-from').value,to:element('accountability-to').value});snapshot=response;coachCode=code;element('accountability-code').value='';render();
    }catch(problem){element('accountability-error').hidden=false;element('accountability-error').textContent=problem.message;}
    finally{busy=false;element('accountability-refresh').disabled=false;element('accountability-refresh').textContent='Load / refresh coach sheet';}
  }
  for(const id of ['accountability-from','accountability-to','accountability-filter'])element(id).addEventListener('change',render);
  element('accountability-this-week').addEventListener('click',()=>{element('accountability-from').value=week.from;element('accountability-to').value=week.to;render();});
  element('accountability-export').addEventListener('click',()=>{if(current)download('rangers-workout-activity.csv',toCsv(current));});
  element('accountability-coach-form').addEventListener('submit',event=>{event.preventDefault();void loadShared();});
  element('accountability-device').addEventListener('click',()=>{snapshot=null;coachCode='';element('accountability-code').value='';render();});
  render();return {refresh:()=>{if(!snapshot)render();}};
}
