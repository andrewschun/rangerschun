import { PULSE_METRICS, validatePulseRecords, upsertPulseRecord, latestPulseRecords, pulseRecordsToCsv } from './pulse.mjs?v=schedule-auto-refresh-20261025';

export function startPulse({players,scope,element:$,download,onChange}){
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const key='rangers-pulse-v1-'+scope,remote=Boolean(globalThis.google?.script?.run),now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let records=[],readable=true,saved=true,dirty=false,player='',date=today,snapshot=null,coachCode='',busy=false;
  const prompt=node('option','','Choose a player');prompt.value='';$('pulse-player').replaceChildren(prompt);for(const label of players){const option=node('option','',label);option.value=label;$('pulse-player').append(option);}
  $('pulse-date').value=today;
  for(const metric of PULSE_METRICS){
    const label=node('label','',metric.label),input=node('input');input.id='pulse-'+metric.key;input.type='number';input.inputMode=metric.integer?'numeric':'decimal';input.min=String(metric.min);if(metric.max!==undefined)input.max=String(metric.max);input.step=metric.integer?'1':'any';input.placeholder='—';input.autocomplete='off';label.htmlFor=input.id;label.append(input,node('small','',metric.unit));$(metric.primary?'pulse-primary-metrics':'pulse-extra-metrics').append(label);
  }
  try{const raw=localStorage.getItem(key);if(raw){const data=JSON.parse(raw);if(data.version!==1)throw Error();validatePulseRecords(data.records,players);records=data.records;}}
  catch{readable=false;saved=false;$('pulse-storage').textContent='Saved Pulse records could not be read. Existing data is preserved. New entries stay in this open page; export before closing.';}
  const selected=()=>records.filter(r=>r.player===$('pulse-player').value).sort((a,b)=>b.session_date.localeCompare(a.session_date));
  const value=(r,key)=>r?.[key]===null||r?.[key]===undefined?'—':String(r[key]);
  function persist(next){const before=records;records=next;if(readable){try{localStorage.setItem(key,JSON.stringify({version:1,records}));saved=true;$('pulse-storage').textContent='';}catch{saved=false;$('pulse-storage').textContent='Device saving is unavailable. Changes stay in this open page; export before closing.';}}onChange?.(before,next);renderCoach();}
  function loadDay(){
    const record=records.find(r=>r.player===$('pulse-player').value&&r.session_date===$('pulse-date').value);
    for(const metric of PULSE_METRICS)$('pulse-'+metric.key).value=record?.[metric.key]??'';$('pulse-notes').value=record?.notes??'';
    $('pulse-save').textContent=record?'Update daily Pulse summary':'Save daily Pulse summary';$('pulse-day-status').textContent=record?'Saved summary loaded for this date. Saving updates this day’s record.':'Copy the totals for this date from Pulse after syncing your sensor. One summary is kept per day.';$('pulse-error').hidden=true;dirty=false;
  }
  function renderHistory(){
    const all=selected(),box=$('pulse-history');box.replaceChildren();$('pulse-export').disabled=$('pulse-delete-player').disabled=!all.length;
    $('pulse-history-title').textContent=$('pulse-player').value?`${$('pulse-player').value} · ${all.length} Pulse day${all.length===1?'':'s'}`:'Choose a player to see Pulse history';
    if(!all.length){box.append(node('p','workout-empty','No Pulse summaries saved for this player yet.'));return;}
    for(const record of all){
      const card=node('details','workout-record'),heading=node('summary'),text=node('div');text.append(node('span','workout-record-date',record.session_date+' · DAILY PULSE SUMMARY'),node('strong','',`${value(record,'total_throws')} throws · Workload ${value(record,'one_day_workload')}`),node('small','',`High effort ${value(record,'high_effort_throws')} · Average torque ${value(record,'average_torque_nm')} N·m`));heading.append(text,node('span','workout-expand','+'));card.append(heading);
      const body=node('div','workout-record-body'),metrics=node('dl','pulse-record-metrics');for(const metric of PULSE_METRICS){const group=node('div');group.append(node('dt','',`${metric.label} · ${metric.unit}`),node('dd','',value(record,metric.key)));metrics.append(group);}body.append(metrics);if(record.notes)body.append(node('p','workout-record-notes',record.notes));
      const actions=node('div','workout-record-actions'),edit=node('button','secondary-button','Edit day'),remove=node('button','delete-button','Delete day');edit.type=remove.type='button';
      edit.addEventListener('click',()=>{if(dirty&&!window.confirm('Replace the unsaved Pulse readings with this saved day?'))return;$('pulse-date').value=record.session_date;date=record.session_date;loadDay();$('pulse-date').focus();});
      remove.addEventListener('click',()=>{if(!window.confirm(`Delete the Pulse summary for ${record.session_date} from this device?`))return;persist(records.filter(r=>r.id!==record.id));if($('pulse-date').value===record.session_date)loadDay();renderHistory();$('pulse-announcement').textContent=saved?'Pulse summary deleted from this device.':'Removed from this page; device saving is unavailable.';});actions.append(edit,remove);body.append(actions);card.append(body);box.append(card);
    }
  }
  function renderCoach(){
    const list=latestPulseRecords(snapshot?.records??records,snapshot?.players??players),body=$('pulse-coach-rows');body.replaceChildren();
    $('pulse-coach-source').textContent=snapshot?'Coach sheet · latest saved day per player':'This device only · latest saved day per player';$('pulse-coach-scope').textContent=snapshot?`Received coach records, refreshed ${new Date(snapshot.as_of).toLocaleString()}. Daily snapshots are not added together.`:'This overview includes only this browser’s Pulse entries. Other phones require Google activation and coach access. A missing entry does not mean a player did not throw.';
    for(const item of list){const row=node('tr'),name=node('th','',item.player);name.scope='row';row.append(name);for(const text of [item.record?.session_date??'No entry',value(item.record,'total_throws'),value(item.record,'high_effort_throws'),value(item.record,'one_day_workload'),value(item.record,'average_torque_nm'),value(item.record,'ac_ratio')])row.append(node('td','',text));body.append(row);}
    $('pulse-coach-export').disabled=!list.some(item=>item.record);
  }
  $('pulse-form').addEventListener('input',event=>{if(!['pulse-player','pulse-date'].includes(event.target.id))dirty=true;});
  for(const id of ['pulse-player','pulse-date'])$(id).addEventListener('change',()=>{
    if(dirty&&!window.confirm('Change player or date and discard the unsaved Pulse readings?')){$('pulse-player').value=player;$('pulse-date').value=date;return;}
    player=$('pulse-player').value;date=$('pulse-date').value;loadDay();renderHistory();$('pulse-announcement').textContent='';
  });
  $('pulse-reset').addEventListener('click',()=>{if(dirty&&!window.confirm('Discard the unsaved Pulse changes?'))return;loadDay();});
  $('pulse-form').addEventListener('submit',event=>{
    event.preventDefault();const existing=records.find(r=>r.player===$('pulse-player').value&&r.session_date===$('pulse-date').value),timestamp=new Date().toISOString();
    const record={id:existing?.id??globalThis.crypto?.randomUUID?.()??`pulse-${Date.now()}-${Math.random().toString(36).slice(2)}`,player:$('pulse-player').value,session_date:$('pulse-date').value,source:'driveline_pulse_manual',entry_scope:'day',notes:$('pulse-notes').value.trim(),created_at:existing?.created_at??timestamp,updated_at:timestamp};for(const metric of PULSE_METRICS){const input=$('pulse-'+metric.key);record[metric.key]=input.value.trim()===''?null:input.valueAsNumber;}
    try{persist(upsertPulseRecord(records,record,players));}catch(error){$('pulse-error').hidden=false;$('pulse-error').textContent=error.message;return;}
    loadDay();renderHistory();$('pulse-announcement').textContent=`${existing?'Updated':'Saved'} Pulse summary for ${record.player} on ${record.session_date}. ${saved?'Saved on this device.':'Kept in this open page; export before closing.'}`;
  });
  $('pulse-export').addEventListener('click',()=>download('rangers-pulse-player-history.csv',pulseRecordsToCsv(selected())));
  $('pulse-delete-player').addEventListener('click',()=>{const all=selected();if(!all.length||!window.confirm(`Delete all ${all.length} Pulse summaries for ${$('pulse-player').value} from this device? Export first if needed.`))return;persist(records.filter(r=>r.player!==$('pulse-player').value));loadDay();renderHistory();$('pulse-announcement').textContent=saved?'Player Pulse summaries deleted from this device.':'Removed from this page; device saving is unavailable.';});
  $('pulse-coach-auth').hidden=!remote;
  $('pulse-coach-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!remote||busy)return;busy=true;$('pulse-coach-refresh').disabled=true;$('pulse-coach-error').hidden=true;
    try{const code=$('pulse-coach-code').value.trim()||coachCode,result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Coach Pulse records did not load. Your existing view is unchanged.')),25000);globalThis.google.script.run.withSuccessHandler(r=>{clearTimeout(timer);resolve(r);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Coach access was not confirmed. Use the coach account or the private coach code.'));}).getCoachPulse({code});});
      if(!result||!Array.isArray(result.players)||!Array.isArray(result.records)||typeof result.as_of!=='string')throw Error('The coach response could not be verified.');validatePulseRecords(result.records,result.players);snapshot=result;coachCode=code;$('pulse-coach-code').value='';renderCoach();
    }catch(error){$('pulse-coach-error').textContent=error.message;$('pulse-coach-error').hidden=false;}finally{busy=false;$('pulse-coach-refresh').disabled=false;}
  });
  $('pulse-coach-device').addEventListener('click',()=>{snapshot=null;coachCode='';$('pulse-coach-code').value='';$('pulse-coach-error').hidden=true;renderCoach();});
  $('pulse-coach-export').addEventListener('click',()=>download('rangers-pulse-coach-records.csv',pulseRecordsToCsv(snapshot?.records??records)));
  loadDay();renderHistory();renderCoach();return {records:()=>records,refresh:()=>{if(!snapshot)renderCoach();}};
}
