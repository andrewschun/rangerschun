import {THROWING_OFF_DAY_SOURCE} from './workout-record-tools.mjs?v=combined-workouts-20261025';
const velocity='Velocity OR PlyoCare Velo';
const standard=['Hybrid A','Off','Hybrid B',velocity,'Recovery','Hybrid B','Recovery'];
const recovery=['Hybrid A','Off','Recovery',velocity,'Recovery','Hybrid B','Recovery'];
export const THROWING_SCHEDULE=Array.from({length:13},(_,i)=>{
  const week=i+1,deload=[5,9,13].includes(week);
  const days=week===1?['Off','Hybrid B','Recovery','Hybrid B','Hybrid B','Recovery','Off']:deload?['Off','Off','Hybrid B','Hybrid A',week===5?'Recovery':'Recovery/Off','Hybrid B','Recovery']:[3,7,11].includes(week)?recovery:standard;
  return {week,phase:week===1?'First Week':deload?'De-load Week':'Velocity Building',days:[...days]};
});
export const THROWING_ROUTINES={
 'Hybrid A':'throwing-routine-hybrid-a','Hybrid B':'throwing-routine-hybrid-b',Recovery:'throwing-routine-recovery',Velocity:'throwing-routine-velocity-day','PlyoCare Velo':'throwing-routine-plyocare-velocity'
};
export function throwingDate(start,week,day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isInteger(week)||week<1||week>13||!Number.isInteger(day)||day<1||day>7)return null;
 const base=new Date(start+'T12:00:00Z');if(!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==start)return null;
 base.setUTCDate(base.getUTCDate()+(week-1)*7+day-1);return base.toISOString().slice(0,10);
}
export function throwingChoices(week,day){
 const routine=THROWING_SCHEDULE[week-1]?.days[day-1];
 return routine===velocity?['Velocity','PlyoCare Velo']:routine==='Recovery/Off'?['Recovery','Off']:routine?[routine]:[];
}
export function throwingDayRecord(records,{player,start,week,day}){
 const date=throwingDate(start,week,day),ids=throwingChoices(week,day).map(r=>r==='Off'?THROWING_OFF_DAY_SOURCE:THROWING_ROUTINES[r]).filter(Boolean);
 if(!player||!date||!ids.length)return {date,completed:false,partial:false,record:null};
 const matching=records.filter(r=>r.player===player&&r.session_date===date&&ids.includes(r.source_template_id));
 const full=matching.filter(r=>r.completion_confirmed===true&&r.completion_status==='completed');
 return {date,completed:full.length>0,partial:!full.length&&matching.length>0,record:full.at(-1)??matching.at(-1)??null};
}
