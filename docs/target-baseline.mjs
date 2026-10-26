import {validateBaseballSession,BASEBALL_CONTEXTS} from './engine.mjs?v=schedule-auto-refresh-20261025';
/** Use the latest dated saved session with a complete top-five statistic, not unsaved readings. */
export function latestSavedTopFiveBaseline(records,player){
 if(!player)return null;
 const candidates=[];
 for(const record of records){if(record?.player!==player)continue;let stats;try{stats=validateBaseballSession(record,[player]);}catch{continue;}if(stats.averageTop5===null)continue;
  candidates.push({session_id:record.id,session_date:record.session_date,context:record.context,average_mph:stats.averageTop5,count:stats.count,value:stats.averageTop5.toFixed(1),stamp:String(record.updated_at??record.created_at??'')});
 }
 candidates.sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.stamp.localeCompare(a.stamp)||b.session_id.localeCompare(a.session_id));
 const source=candidates[0];return source?{...source,key:JSON.stringify([source.session_id,source.session_date,source.context,source.value])}:null;
}
export function createTargetBaselineState(getRecords){
 const players=new Map();
 function state(player){const source=latestSavedTopFiveBaseline(getRecords(),player),key=source?.key??'example';let value=players.get(player);if(!value||value.key!==key){value={key,manual:null};players.set(player,value);}return {state:value,source};}
 function snapshot(player){const {state:value,source}=state(player);return {player,source,value:value.manual??source?.value??'75',manual:value.manual!==null,origin:value.manual!==null?'manual':source?'latest_saved_top_five':'example'};}
 return {snapshot,manual(player,value){const current=state(player),baseline=current.source?.value??'75';current.state.manual=value.trim()!==''&&Number(value)===Number(baseline)?null:String(value);return snapshot(player);},reset(player){state(player).state.manual=null;return snapshot(player);}};
}
export function startTargetBaseline({element:$,getRecords,getPlayer,onChange=()=>{}}){
 const state=createTargetBaselineState(getRecords),input=$('velocity'),note=$('target-baseline-source'),useAverage=$('target-use-average');
 function paint(writeValue=true){const value=state.snapshot(getPlayer());if(writeValue)input.value=value.value;
  note.textContent=value.source?`${value.manual?'Manual baseline. Latest saved top-five average:':'Using latest saved top-five average:'} ${value.source.value} mph · ${value.source.session_date} · ${BASEBALL_CONTEXTS[value.source.context]} · ${value.source.count} throws on this device. You can adjust the number.`:value.player?'No saved session with five valid throws for this player on this device. Using a 75 mph example; adjust as needed.':'Choose a player to use their latest saved top-five average. A 75 mph example is shown.';
  useAverage.hidden=!value.source||!value.manual;useAverage.textContent=value.source?`Use ${value.source.value} mph top-five average`:'Use top-five average';return value;
 }
 const api={select:()=>paint(),manual(value){state.manual(getPlayer(),value);return paint(false);},reset(){state.reset(getPlayer());const value=paint();onChange('reset');return value;},refresh(){const previous=input.value,value=paint();if(previous!==value.value)onChange('records');return value;},snapshot:()=>state.snapshot(getPlayer())};
 useAverage.addEventListener('click',()=>{api.reset();input.focus();});paint();return api;
}
