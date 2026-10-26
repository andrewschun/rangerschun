import {AXE_DRILL_PLANS} from './axe-drill-data.mjs?v=rangers-organization-20261025';

const yt=(id,title)=>({url:'https://www.youtube.com/watch?v='+id,title,provider:'Driveline Baseball · YouTube'});
const vi=(id,title)=>({url:'https://vimeo.com/'+id,title,provider:'Driveline Baseball · Vimeo'});
export const AXE_DRILL_VIDEOS=Object.freeze({
 open:yt('6t4FASZanQA','Offset Open'),closed:yt('FS2kDqBOM9s','Offset Closed'),rotation:yt('Divh5BtngPg','Offset Rotation'),
 hook:yt('IyCE0hey7-I','Hook ’Em'),kershaw:yt('r3wazOZE-MQ','Kershaw'),step:yt('AkwKO0J2SEM','Step Backs'),walk:yt('d_Bw3KL2om4','Walk Through'),
 rocker:yt('dkdWe-jdATk','Tee Rocker with Axe Bat Speed Trainers'),shuffle:yt('-LRcQhTa7TU','Happy Gilmore with Axe Bat Speed Trainers'),
 heights:yt('A8pCgj4xghU','High, Middle, Low'),high:yt('0BYiG_0saOY','High Tee'),low:yt('Ad3K8y1w6Fc','Low Tee'),
 ladder:yt('OI-5h2fJmH4','Launch Angle Ladder'),fair:yt('mKDzVSejfew','Keep it Fair'),
 overhand:yt('eABSfl070Gc','Overhand Firm Toss'),approach:yt('lqxvizEN69M','Overhand Approach Toss with Axe Bat Speed Trainers'),
 depth:vi('353716458','Depth ladder'),underhand:vi('339463378','Underhand Toss – Regular Stance'),adjust:vi('272704713','Front Toss – Adjustability'),overadjust:vi('272704421','Front Toss – Mixed Pitches')
});
export function axeDrillDemos(drill){
 const name=drill.name.toLowerCase(),v=AXE_DRILL_VIDEOS,links=[];
 const add=(key,label='Watch demo',note='')=>links.push({...v[key],label,note});
 if(name.includes('around the world'))add('fair','Related demo','Ball-flight intent demo. Follow the original Around the World sequence in the drill guide.');
 else if(name.includes('height ladder'))add('ladder');
 else if(name.includes('depth ladder'))add('depth');
 else if(name.includes('adjustability'))add('adjust');
 else if(name.includes('approach'))add('approach');
 else if(name.includes('offset rotation'))add('rotation');
 else if(name.includes('offset open'))add('open','Stance demo');
 else if(name.includes('offset closed'))add('closed','Stance demo');
 else if(name.includes('hook'))add('hook');
 else if(name.includes('kershaw'))add('kershaw');
 else if(name.includes('step back'))add('step');
 else if(name.includes('walk'))add('walk');
 else if(name.includes('rocker'))add('rocker');
 else if(name.includes('gilmore')||name.includes('shuffle'))add('shuffle');
 else if(name.includes('high, middle, low'))add('heights');
 else if(name.startsWith('high tee'))add('high');
 else if(name.startsWith('low tee'))add('low');
 else if(drill.section==='tee')add('heights','Tee setup demo','General tee setup; use this drill’s listed locations.');
 if(drill.section==='toss'&&!name.includes('approach')&&!name.includes('adjustability')){
  const delivery=name.includes('overhand')?'overhand':'underhand';
  if(!links.length)add(delivery);else if(!links.some(l=>l.url===v[delivery].url))add(delivery,'Toss demo');
 }
 return links;
}
export function axeDrillPlan(activity,season,week){
 const key=activity+'/'+(activity==='mini_plyos'?'shared':season)+'/'+Number(week),source=AXE_DRILL_PLANS[key];
 if(!source)throw Error('Choose a valid Axe program week.');
 const bats=activity==='mini_plyos'?['Game bat']:activity==='bat_speed'?['Barrel load','Handle load','Underload','Game bat']:[activity==='short_bat'?'Short trainer':'Long trainer','Game bat',activity==='short_bat'?'Short trainer':'Long trainer','Game bat'];
 return source.map(row=>{const parts=row.parts.map(p=>({...p,reps:p.source_reps+1}));const prescription=parts.map(p=>(p.label?p.label+': ':'')+p.sets+' x '+p.reps).join(' · ');
  return {...row,parts,bats:[...bats],prescription,planned_details:prescription+' per bat in order: '+bats.join(' → ')+'. '+row.ball+'. Coach adjustment: +1 rep per set.',demos:axeDrillDemos(row)};
 });
}
