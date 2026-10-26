/** Ascending-number challenge with completed times in the existing workout journal. */
export function concentrationNumbers(random=Math.random){
  const values=Array.from({length:100},(_,i)=>i+1);
  for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
  return values;
}
export function concentrationTime(milliseconds){
  const tenths=Math.floor(Math.max(0,milliseconds)/100);
  return `${Math.floor(tenths/600)}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`;
}
export class ConcentrationChallenge{
  constructor({now=()=>performance.now(),random=Math.random}={}){this.now=now;this.random=random;this.newGrid();}
  newGrid(){this.numbers=concentrationNumbers(this.random);this.restart();}
  restart(){this.next=1;this.startedAt=null;this.finishedAt=null;}
  elapsed(){return this.startedAt===null?0:(this.finishedAt??this.now())-this.startedAt;}
  select(number){
    if(number!==this.next||this.next>100)return false;
    if(this.startedAt===null)this.startedAt=this.now();
    this.next++;
    if(this.next===101)this.finishedAt=this.now();
    return true;
  }
}
export function startConcentrationGrid({element,players=[],flow,readRemote,now,random,setTimer=setInterval,clearTimer=clearInterval}){
  const game=new ConcentrationChallenge({now,random});
  const grid=element('concentration-grid'),status=element('concentration-status');
  let timer=null,player='',savedId=null,remoteSummary=null,refreshing=false,refreshVersion=0;
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const picker=element('concentration-player');const placeholder=make('option','','Choose a player');placeholder.value='';picker.replaceChildren(placeholder);for(const name of players){const option=make('option','',name);option.value=name;picker.append(option);}
  function results(){
    const all=concentrationResults(flow.records()),mine=concentrationResults(flow.records(),player),average=concentrationAverage(mine);
    const teamCount=remoteSummary?.session_count??all.length,teamAverage=remoteSummary?remoteSummary.average_ms:concentrationAverage(all);
    const chart=element('concentration-chart');chart.replaceChildren();
    const data=[['Current time',mine[0]?.elapsed_ms??null,mine.length?'Latest completed grid':'Complete your first grid'],['Your average',average,`${mine.length} completed grids on this device`],['Team average',teamAverage,`${teamCount} completed grids · ${remoteSummary?'coach sheet':'this device only'}`]],max=Math.max(1,...data.map(d=>d[1]??0));
    data.forEach(([label,value,note],i)=>{const row=make('div','concentration-chart-row'),heading=make('div','concentration-chart-label');heading.append(make('strong','',label),make('span','',value===null?'—':(value/1000).toFixed(1)+' s'));const track=make('div','concentration-bar-track'),bar=make('div','concentration-bar concentration-bar-'+i);bar.style.width=value===null?'0%':Math.max(.5,value/max*100)+'%';track.setAttribute('aria-hidden','true');track.append(bar);row.append(heading,track,make('small','',note));chart.append(row);});
    const history=element('concentration-history');history.replaceChildren();if(!player||!mine.length)history.append(make('p','field-help','Complete a grid to start collecting your times.'));
    else{const list=make('ol','concentration-results');for(const result of mine)list.append(make('li','',`${result.session_date} · ${concentrationTime(result.elapsed_ms)}`));history.append(list);}
    element('concentration-clear').disabled=!player||!mine.length;
  }
  async function refreshTeam(){
    if(refreshing||!player||!readRemote)return;refreshing=true;const version=++refreshVersion;element('concentration-refresh').disabled=true;element('concentration-team-status').textContent='Refreshing team average…';
    try{const summary=await readRemote();if(!summary||!Number.isInteger(summary.session_count)||summary.session_count<0||(summary.session_count>0&&(!Number.isFinite(summary.average_ms)||summary.average_ms<=0||summary.average_ms>86400000)))throw Error('Invalid team average');if(version!==refreshVersion)return;remoteSummary=summary;element('concentration-team-status').textContent='Team average uses completed grids received by the coach sheet across devices. Newly saved times may appear after syncing.';}
    catch{if(version===refreshVersion){remoteSummary=null;element('concentration-team-status').textContent='Team connection unavailable. The team bar currently includes this device’s completed grids only. Personal times remain saved here.';}}
    finally{refreshing=false;element('concentration-refresh').disabled=false;results();}
  }
  function saveTime(){
    if(savedId||game.next!==101||!player)return;
    try{const record=concentrationRecord(player,game.elapsed());flow.commit([...flow.records(),record]);savedId=record.id;element('concentration-retry').hidden=true;status.textContent=`Grid complete! ${concentrationTime(game.elapsed())} saved for ${player}.`;results();void refreshTeam();}
    catch(error){status.textContent=`Time not saved: ${error.message}`;element('concentration-retry').hidden=false;}
  }
  picker.addEventListener('change',()=>{
    const next=picker.value;if(next===player)return;
    if(game.startedAt!==null&&game.next<=100&&!window.confirm('Switch players and restart this unfinished grid?')){picker.value=player;return;}
    player=next;game.newGrid();render();results();void refreshTeam();
  });
  element('concentration-refresh').addEventListener('click',()=>void refreshTeam());
  element('concentration-retry').addEventListener('click',saveTime);
  element('concentration-clear').addEventListener('click',()=>{if(!player||!window.confirm(`Clear all concentration times for ${player} from this device and send their deletion to the coach sheet? Other activities are kept.`))return;flow.commit(flow.records().filter(r=>r.player!==player||r.source_template_id!==CONCENTRATION_SOURCE));results();void refreshTeam();});
  flow.subscribe(results);
  const stop=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  function update(){
    element('concentration-next').textContent=game.next>100?'Done!':String(game.next);
    element('concentration-progress').textContent=`${game.next-1} / 100`;
    element('concentration-time').textContent=concentrationTime(game.elapsed());
  }
  function render(){
    stop();savedId=null;element('concentration-retry').hidden=true;update();grid.replaceChildren();
    for(const number of game.numbers){
      const button=document.createElement('button');button.type='button';button.className='concentration-number';button.textContent=String(number);button.setAttribute('aria-label',`Number ${number}`);
      button.addEventListener('click',()=>{
        if(!player){status.textContent='Choose a player before starting.';return;}
        if(!game.select(number)){
          button.classList.add('concentration-wrong');
          status.textContent=`Find ${game.next} next. Your progress has not changed.`;
          return;
        }
        for(const cell of grid.children)cell.classList.remove('concentration-wrong');
        button.classList.add('concentration-found');button.disabled=true;
        button.setAttribute('aria-label',`Number ${number}, completed`);
        update();
        if(game.next>100){stop();status.textContent=`Grid complete! Your time: ${concentrationTime(game.elapsed())}.`;saveTime();}
        else{
          status.textContent=`Find ${game.next} next.`;
          if(timer===null)timer=setTimer(update,100);
          // Keep keyboard navigation on the grid after the completed button is disabled.
          [...grid.children].find(cell=>!cell.disabled)?.focus({preventScroll:true});
        }
      });
      grid.append(button);
    }
    status.textContent='Select 1 to begin. Use Tab and Enter if you prefer a keyboard.';
  }
  element('concentration-new').addEventListener('click',()=>{game.newGrid();render();});
  element('concentration-restart').addEventListener('click',()=>{game.restart();render();});
  render();results();
  return {game,refreshTeam,destroy:stop};
}

export const CONCENTRATION_SOURCE='concentration-grid-100';
export function concentrationResults(records,player){
 return records.filter(r=>r.source_template_id===CONCENTRATION_SOURCE&&(!player||r.player===player)&&r.completion_status==='completed'&&r.completion_confirmed===true&&Number.isFinite(r.duration_minutes)&&r.duration_minutes>0&&r.duration_minutes<=1440).map(r=>({...r,elapsed_ms:Math.round(r.duration_minutes*60000)})).sort((a,b)=>String(b.updated_at??b.created_at??b.session_date).localeCompare(String(a.updated_at??a.created_at??a.session_date)));
}
export function concentrationAverage(records){return records.length?records.reduce((sum,r)=>sum+r.elapsed_ms,0)/records.length:null;}
export function concentrationRecord(player,elapsed_ms,{id=globalThis.crypto.randomUUID(),date=new Date()}={}){
 if(!player||!Number.isFinite(elapsed_ms)||elapsed_ms<=0||elapsed_ms>86400000)throw Error('This grid time could not be saved. Start a new grid and try again.');
 const timestamp=date.toISOString();
 return {id,player,session_date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,title:'Concentration Grid · 1–100',category:'other',duration_minutes:Math.round(elapsed_ms)/60000,effort:'',notes:'Completed numbers 1–100 in order. Lower elapsed time is faster.',source_template_id:CONCENTRATION_SOURCE,completion_status:'completed',completion_confirmed:true,created_at:timestamp,updated_at:timestamp,exercises:[{name:'Concentration Grid · 100 numbers',sets:null,reps:null,weight:null,weight_unit:'none',notes:`Elapsed time ${concentrationTime(elapsed_ms)}.`,completed:true}]};
}
