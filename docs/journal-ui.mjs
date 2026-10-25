// Integrated by app.mjs after the player device journals have loaded.
// Apps Script is the only remote transport. A static preview never claims submission.
export function startTeamJournal({players,scope,getRecords,element,download,changes,toCsv,validate}){
  const key='rangers-coach-journal-v1-'+scope;
  let events=[],readable=true,saving=true,busy=false,credentials=null,lastError='',publicEntry=false,settingsReady=false;
  const remote=Boolean(globalThis.google?.script?.run);
  let finishSettings;const settingsLoaded=new Promise(resolve=>{finishSettings=resolve;});if(!remote)finishSettings(false);
  if(remote){
    const note=document.getElementById('blast-coach-sheet-status');if(note)note.textContent='One private coach spreadsheet receives entries after you connect with your player code below.';
    const blastNote=document.getElementById('blast-team-connection');if(blastNote)blastNote.textContent='Use your player code in Coach desk to send saved entries. This is separate from a Blast sensor-account connection.';
  }
  try{const saved=localStorage.getItem(key);if(saved){const data=JSON.parse(saved);if(data.version!==1||!Array.isArray(data.events))throw Error();const ids=new Set();for(const event of data.events){validate(event,players);if(ids.has(event.event_id))throw Error();ids.add(event.event_id);}events=data.events;}}
  catch{readable=false;lastError='Saved coach entries could not be read. Existing data is preserved; export new entries before closing.';}
  const makeId=()=>globalThis.crypto?.randomUUID?.()??`entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function persist(){if(!readable)return;try{localStorage.setItem(key,JSON.stringify({version:1,events}));saving=true;}catch{saving=false;lastError='Device storage is full or unavailable. Export entries before closing.';}}
  function render(){
    const pending=events.filter(e=>!e.received_at),count=pending.length;
    element('team-journal-status').textContent=lastError||(busy?'Sending entries to coach…':remote?(publicEntry?`${count} entr${count===1?'y':'ies'} waiting · saved entries send automatically; no player code needed.`:!settingsReady?'Checking the coach connection…':credentials?`${count} entr${count===1?'y':'ies'} waiting · connected as ${credentials.player}.`:'Enter your coach-issued code to send your saved entries.'):'Coach connection pending · entries are saved on this device.');
    element('team-journal-summary').textContent=`${events.length} saved change${events.length===1?'':'s'} · ${events.length-count} confirmed by the coach sheet · ${count} waiting${saving?'':' · device saving unavailable'}`;
    element('team-journal-export').disabled=!events.length;element('team-connect').disabled=!remote||busy;element('team-journal-auth').hidden=!remote||!settingsReady;
  }
  async function flush(){
    if(!remote||!settingsReady||(!publicEntry&&!credentials)||busy)return;
    const selected=publicEntry?{player:events.find(e=>!e.received_at)?.player}:credentials,batch=events.filter(e=>!e.received_at&&e.player===selected.player).slice(0,5);if(!batch.length){render();return;}
    busy=true;lastError='';render();
    try{
      const result=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('The coach sheet did not confirm receipt. Entries remain waiting; try Send waiting entries.')),25000);
        globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error(publicEntry?'Could not send entries. Check your connection and that the player is in the coach roster. Entries remain waiting.':'Could not send entries. Check your player code and connection; your entries remain waiting.'));}).writeJournal({player:selected.player,...(publicEntry?{}:{code:selected.code}),events:batch.map(({received_at,...event})=>event)});
      });
      if(!result||!Array.isArray(result.accepted)||result.accepted.some(a=>!batch.some(e=>e.event_id===a.event_id)||typeof a.received_at!=='string'))throw Error('Receipt was not verified. Entries remain waiting.');
      const accepted=new Map(result.accepted.map(a=>[a.event_id,a.received_at]));
      events=events.map(e=>accepted.has(e.event_id)?{...e,received_at:accepted.get(e.event_id)}:e);persist();
      if(!result.accepted.length)throw Error('No entries were confirmed. Entries remain waiting.');
    }catch(error){lastError=error.message;credentials=null;}
    finally{busy=false;render();}
    if(!lastError&&events.some(e=>!e.received_at&&(publicEntry||e.player===credentials?.player)))void flush();
  }
  function record(kind,before,after){
    const created=changes(kind,before,after,makeId,new Date().toISOString());
    if(!created.length)return;
    for(const event of created)validate(event,players);events.push(...created);persist();render();void flush();
  }
  // Bring existing device records into this one journal once, without inventing earlier changes.
  for(const[kind,records]of Object.entries(getRecords())){
    const seen=new Set(events.filter(e=>e.kind===kind).map(e=>e.record.id));
    record(kind,[],records.filter(r=>!seen.has(r.id)));
  }
  const select=element('team-journal-player');
  for(const player of players){const option=document.createElement('option');option.value=player;option.textContent=player;select.append(option);}
  element('team-journal-export').addEventListener('click',()=>download('rangers-all-entry-changes.csv',toCsv(events)));
  element('team-connect-form').addEventListener('submit',async e=>{e.preventDefault();if(publicEntry){lastError='';void flush();return;}const player=select.value,code=element('team-journal-code').value.trim();if(!player||!code){lastError='Choose your name and enter your coach-issued code.';render();return;}busy=true;lastError='';render();try{const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connection was not confirmed. Try again.')),25000);globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Check your player code and connection.'));}).verifyPlayer(player,code);});if(result?.verified!==true)throw Error('Connection was not confirmed.');credentials={player,code};element('team-journal-code').value='';}catch(error){credentials=null;lastError=error.message;}finally{busy=false;render();}void flush();});
  async function readOverSpeedProgress(player){
    if(publicEntry)throw Error('Without player sign-in, progress stays on this device. Shared player history is private.');
    if(!remote||!credentials||credentials.player!==player)throw Error('Connect as this player in Coach desk, then refresh your progress.');
    const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Your progress did not load. Existing records are unchanged.')),25000);globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Progress access was not confirmed. Reconnect with your player code.'));}).getMyOverSpeedSessions({player,code:credentials.code});});
    if(!result||result.player!==player||!Array.isArray(result.sessions))throw Error('Your progress response could not be verified.');
    return {...result,pending:events.filter(e=>e.kind==='overspeed_session'&&e.player===player&&!e.received_at)};
  }
  window.addEventListener('online',()=>void flush());render();
  async function readTeamSchedule(){
    if(remote&&!settingsReady)await settingsLoaded;
    if(!remote||!settingsReady||(!publicEntry&&!credentials))throw Error('The coach connection is not ready. Try again shortly.');
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Schedule refresh timed out.')),25000);globalThis.google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('Schedule refresh was not confirmed. Try again.'));}).getTeamSchedule(publicEntry?{}:{player:credentials.player,code:credentials.code});});
  }
  if(remote){
    const timer=setTimeout(()=>{finishSettings(false);lastError='The coach connection did not load. Reload to retry; entries remain on this device.';render();},25000);
    globalThis.google.script.run.withSuccessHandler(settings=>{
      clearTimeout(timer);settingsReady=true;publicEntry=settings?.public_player_entry===true;
      if(publicEntry){
        select.closest('label').hidden=true;element('team-journal-code').closest('label').hidden=true;element('team-journal-code').value='';element('team-connect').textContent='Send waiting entries';
        const help=element('team-journal-auth').querySelector('p');if(help)help.textContent='Choose your name in each entry form and save. No player code is required. The coach sheet remains private.';
        for(const id of ['blast-coach-sheet-status','blast-team-connection']){const note=document.getElementById(id);if(note)note.textContent='Saved entries send automatically to the private coach sheet. No player code required.';}
        const pulse=document.getElementById('pulse-storage')?.closest('.blast-storage-note')?.querySelector('p');if(pulse)pulse.textContent='Choose the same date shown in Pulse. Copy the daily totals; unavailable readings stay blank. Entries save on this device and send to the private coach sheet without a player code.';
        const sync=document.getElementById('os-sync');if(sync)sync.hidden=true;
        const osNote=document.getElementById('os-protocol-storage')?.nextElementSibling;if(osNote)osNote.textContent='Progress stays in this browser. Completed entries send to the private coach sheet without a player code. Choosing a name is not sign-in.';
      }
      finishSettings(true);render();void flush();
    }).withFailureHandler(()=>{clearTimeout(timer);finishSettings(false);lastError='The coach connection did not load. Reload to retry; entries remain on this device.';render();}).getConnectionSettings();
  }
  return {record,readOverSpeedProgress,readTeamSchedule};
}
