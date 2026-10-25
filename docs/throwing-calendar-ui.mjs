import {THROWING_SCHEDULE,THROWING_ROUTINES,throwingDate,throwingChoices,throwingDayRecord} from './throwing-schedule.mjs?v=schedule-auto-refresh-20261025';
import {isThrowingOffDay} from './workout-record-tools.mjs?v=schedule-auto-refresh-20261025';

export function startThrowingCalendar({players,scope,element:$,flow,subscribe}){
 const key='rangers-throwing-calendar-v1-'+scope,make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const player=()=>$('throwing-player').value;
 let starts={},readable=true,saving=true,active='',offContext=null,lastPlayer=player();
 try{const raw=localStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(value.version!==1||!value.starts||typeof value.starts!=='object'||Array.isArray(value.starts))throw Error();for(const [name,date] of Object.entries(value.starts))if(!players.includes(name)||!throwingDate(date,1,1))throw Error();starts=value.starts;}}
 catch{readable=false;$('throwing-calendar-message').textContent='Saved calendar dates could not be read. Existing data is preserved; choose a Day 1 date for this page.';}
 const shortDate=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 function render(){
  const name=player(),start=starts[name]??'',body=$('throwing-calendar-body');body.replaceChildren();$('throwing-calendar-start').disabled=!name;$('throwing-calendar-start').value=start;
  let full=0,partial=0;
  for(const row of THROWING_SCHEDULE){
   const tr=make('tr',row.phase==='De-load Week'?'throwing-plan-deload':''),phase=make('td','throwing-plan-phase',row.phase),week=make('th','','Week '+row.week);week.scope='row';tr.append(phase,week);
   row.days.forEach((routine,index)=>{
    const day=index+1,state=throwingDayRecord(flow.records(),{player:name,start,week:row.week,day}),id=row.week+'-'+day;
    if(state.completed)full++;if(state.partial)partial++;
    const td=make('td'),type=routine==='Off'?'off':routine==='Hybrid A'?'hybrid-a':routine==='Hybrid B'?'hybrid-b':routine.startsWith('Recovery')?'recovery':'velocity';
    const button=make('button','throwing-calendar-day throwing-plan-routine '+type+(state.completed?' is-done':''));button.type='button';button.disabled=!name||!start;button.dataset.week=String(row.week);button.dataset.day=String(day);button.setAttribute('aria-pressed',id===active?'true':'false');
    if(state.date)button.append(make('small','throwing-calendar-date',shortDate(state.date)));
    button.append(make('span','',routine));if(state.completed)button.append(make('strong','throwing-calendar-x','X'));else if(state.partial)button.append(make('small','throwing-calendar-partial','In progress'));
    button.setAttribute('aria-label',`${name||'Choose a player'} · Week ${row.week}, Day ${day}${state.date?' · '+state.date:''} · ${routine}${state.completed?' · Completed, X':state.partial?' · In progress':''}`);
    button.addEventListener('click',()=>choose(row.week,day));td.append(button);tr.append(td);
   });body.append(tr);
  }
  $('throwing-calendar-summary').textContent=!name?'Choose your name above to see your own calendar.':!start?`${name}: choose the date of Day 1 to start your calendar.`:`${name} · ${full} completed${partial?' · '+partial+' in progress':''} · X = a completed routine or Off day ${flow.storageState?.().saved===false?'in this open page; export before closing':'saved on this device'}.`;
  if(offContext&&offContext.player===name&&offContext.start===start)offContext.check.checked=flow.records().some(r=>isThrowingOffDay(r)&&r.player===name&&r.session_date===offContext.date&&r.completion_status==='completed'&&r.completion_confirmed===true);
 }
 function open(week,day,routine){
  const date=throwingDate(starts[player()]??'',week,day);
  if(!date||!player())return false;
  if(routine==='Off'){
   active=week+'-'+day;const name=player(),start=starts[name],box=$('throwing-calendar-choice'),label=make('label','throwing-off-complete'),check=make('input');check.type='checkbox';check.checked=flow.records().some(r=>isThrowingOffDay(r)&&r.player===name&&r.session_date===date&&r.completion_status==='completed'&&r.completion_confirmed===true);check.setAttribute('aria-label',`Off day completed for ${name} on ${date}`);
   label.append(check,make('span','','1. Off day completed'));box.replaceChildren(make('p','',`Week ${week}, Day ${day} · ${shortDate(date)} · ${name}`),label,make('p','field-help','Check to save your Off day and add an X. Uncheck to undo.'));box.hidden=false;
   offContext={player:name,start,date,check};
   if(!flow.hasDraft?.())$('throwing-form').hidden=true;
   check.addEventListener('change',()=>{
    if(player()!==name||starts[name]!==start){check.checked=!check.checked;return;}
    try{flow.setOffDay({player:name,date,completed:check.checked});$('throwing-calendar-message').textContent=check.checked?`Off day completed for ${name} on ${date}.`:`Off day completion removed for ${name} on ${date}.`;render();}
    catch(error){check.checked=!check.checked;$('throwing-calendar-message').textContent=error.message;}
   });
   $('throwing-calendar-message').textContent=`Week ${week}, Day ${day} · ${shortDate(date)}: check off your Off day below.`;render();box.scrollIntoView?.({behavior:'smooth',block:'nearest'});return true;
  }
  if(!flow.openTemplate({template_id:THROWING_ROUTINES[routine],date,player:player()}))return false;
  offContext=null;
  active=week+'-'+day;$('throwing-form').hidden=false;$('throwing-calendar-choice').hidden=true;$('throwing-calendar-message').textContent=`Week ${week}, Day ${day} · ${shortDate(date)}: ${routine}. Check off the routine below and save. A full saved routine adds an X.`;render();$('throwing-form').scrollIntoView?.({behavior:'smooth',block:'start'});$('throwing-form-title').tabIndex=-1;$('throwing-form-title').focus({preventScroll:true});return true;
 }
 function openChoice(week,day,routine){
  if(!open(week,day,routine))return;
  const choices=throwingChoices(week,day);if(choices.length<2)return;
  const box=routine==='Off'?$('throwing-calendar-choice'):make('div','throwing-calendar-alternatives');
  if(routine!=='Off'){box.append(make('p','field-help','Showing '+routine+' for this day.'));$('throwing-library-content').append(box);}
  for(const alternative of choices.filter(value=>value!==routine)){
   const button=make('button','secondary-button','Use '+alternative+' instead');button.type='button';button.addEventListener('click',()=>openChoice(week,day,alternative));box.append(button);
  }
 }
 function choose(week,day){
  const choices=throwingChoices(week,day);if(!choices.length)return;
  const saved=throwingDayRecord(flow.records(),{player:player(),start:starts[player()]??'',week,day}).record;
  const routine=choices.find(value=>value==='Off'?isThrowingOffDay(saved):saved?.source_template_id===THROWING_ROUTINES[value])??choices[0];
  openChoice(week,day,routine);
 }
 $('throwing-player').addEventListener('change',()=>{if(player()===lastPlayer){render();return;}lastPlayer=player();active='';offContext=null;$('throwing-form').hidden=true;$('throwing-calendar-choice').hidden=true;if(readable)$('throwing-calendar-message').textContent='';render();});
 $('throwing-calendar-start').addEventListener('change',()=>{
  const name=player(),date=$('throwing-calendar-start').value,prior=starts[name]??'';
  if(!name||!throwingDate(date,1,1)){$('throwing-calendar-message').textContent='Choose a valid Day 1 date.';$('throwing-calendar-start').value=prior;return;}
  if(prior&&prior!==date&&!window.confirm('Change this player’s calendar dates? Saved workout dates stay unchanged.')){$('throwing-calendar-start').value=prior;return;}
  starts[name]=date;active='';offContext=null;$('throwing-calendar-choice').hidden=true;
  if(!flow.hasDraft?.())$('throwing-form').hidden=true;
  if(readable)try{localStorage.setItem(key,JSON.stringify({version:1,starts}));saving=true;}catch{saving=false;}
  $('throwing-calendar-message').textContent=readable&&saving?'Day 1 date saved for '+name+'.': 'Calendar date is kept in this page only; device saving is unavailable.';render();
 });
 $('throwing-form').addEventListener('submit',()=>{
  // The flow closes only after validation and saving succeed; failed entries remain open.
  if(!$('throwing-form').hidden||flow.hasDraft?.())return;
  active='';offContext=null;$('throwing-calendar-choice').hidden=true;
  $('throwing-calendar-message').textContent='Routine saved. Choose another calendar day, or reopen a saved day or history entry to correct it.';render();
 });
 $('throwing-form').hidden=true;subscribe(()=>render());render();return {render};
}
