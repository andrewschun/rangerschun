import {startAxeCompletion} from './axe-completion-ui.mjs?v=axe-drill-checklists-20261025';
import {AXE_PROGRAMS} from './axe-programs.mjs?v=compact-workouts-20261025';

export function axeProgramPage(activity,season,week){
 const program=AXE_PROGRAMS.find(p=>p.id===activity),w=Number(week);
 if(!program||!['off_season','in_season'].includes(season)||!Number.isInteger(w)||w<1||w>program.week_count)return null;
 let page,crop=null;
 if(activity==='bat_speed'){
  page=(season==='off_season'?16:19)+Math.floor((w-1)/4);
 }else if(activity==='mini_plyos')page=w+3;
 else{page=(season==='in_season'?0:6)+Math.ceil(w/2);crop={x:0,y:w%2?0:.5,width:1,height:.5};}
 return {program,page,asset:program.pages[page-1],crop,week:w};
}
export function startAxePrograms({element:$,players,flow,download,onNavigate}){
 const option=(value,label)=>{const n=document.createElement('option');n.value=String(value);n.textContent=label;return n;};
 const showImage=(image,asset,label)=>{image.src=asset.image;image.alt=label;image.width=asset.width;image.height=asset.height;};
 let previousActivity='';
 const completion=startAxeCompletion({element:$,players,flow,download,onNavigate,refresh:()=>render()});
 function guide(program,page){
  const asset=program.pages[Number(page)-1];if(!asset)return;
  showImage($('axe-guide-image'),asset,`${program.source} · PDF page ${asset.page}`);$('axe-guide-full').href=asset.image;
  $('axe-source-videos').replaceChildren();for(const [index,url]of asset.videos.entries()){
   const a=document.createElement('a');a.className='secondary-button';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`Source video ${index+1} ↗`;$('axe-source-videos').append(a);
  }
 }
 function render(){
  const player=$('axe-player').value,activity=$('axe-activity').value,program=AXE_PROGRAMS.find(p=>p.id===activity),season=$('axe-season').value;
  $('axe-season').disabled=!player||!program;$('axe-week').disabled=!player||!program||!season;
  if(activity!==previousActivity){
   $('axe-week').replaceChildren(option('','Choose a week'),...Array.from({length:program?.week_count??0},(_,i)=>option(i+1,'Week '+(i+1))));
   $('axe-guide-page').replaceChildren(...(program?.pages??[]).map(p=>option(p.page,'Page '+p.page)));
   if(program)$('axe-guide-page').value=activity==='mini_plyos'?'3':activity==='bat_speed'?'7':'13';
   previousActivity=activity;
  }
  completion.sync();
  const selection=axeProgramPage(activity,season,$('axe-week').value);
  $('axe-program-view').hidden=!player||!selection;
  $('axe-program-prompt').hidden=Boolean(player&&selection);
  if(!player||!selection)return;
  const {asset,crop,week}=selection;
  $('axe-program-heading').textContent=`${program.label} · ${season==='off_season'?'Off-season':'In-season'} · Week ${week}`;
  const position=activity==='bat_speed'?['upper left','lower left','upper right','lower right'][(week-1)%4]:null;
  $('axe-program-source').textContent=`${program.source} · PDF page ${asset.page}.${position?' Week '+week+' is at the '+position+' of the source page.':''} Original source table.${activity==='bat_speed'?' Use the coach-assigned standard or advanced version.':''}`;
  $('axe-program-full').href=asset.image;showImage($('axe-program-image'),asset,`${program.label}, ${season.replace('_',' ')}, Week ${week}, original PDF table`);
  const frame=$('axe-program-crop'),image=$('axe-program-image');
  frame.classList.toggle('is-cropped',Boolean(crop));
  if(crop){frame.style.aspectRatio=String(asset.width*crop.width/(asset.height*crop.height));image.style.width=(100/crop.width)+'%';image.style.left=(-100*crop.x/crop.width)+'%';image.style.top=(-100*crop.y/crop.height)+'%';}
  else{frame.style.aspectRatio='auto';image.style.width='100%';image.style.left='0';image.style.top='0';}
  const messages=[];
  if(activity==='mini_plyos')messages.push('The supplied Mini Plyos guide has one six-week plan, with no separate in-season version. Both season choices display that same source plan.');
  if(activity==='mini_plyos'&&week===6)messages.push('Your coach selected six sessions from the detailed Week 6 page. The overview lists four days; the detailed page lists six days and eleven drills.');
  if(activity==='mini_plyos'&&[1,4].includes(week))messages.push('The original header and drill-row swing totals differ. Your checklist follows the listed drill rows with your coach’s extra rep in every set.');
  $('axe-program-note').textContent=messages.join(' ');$('axe-program-note').hidden=!messages.length;
  guide(program,$('axe-guide-page').value);
 }
 for(const id of ['axe-player','axe-activity','axe-season','axe-week'])$(id).addEventListener('change',render);
 $('axe-guide-page').addEventListener('change',()=>{const p=AXE_PROGRAMS.find(p=>p.id===$('axe-activity').value);if(p)guide(p,$('axe-guide-page').value);});
 render();return {refresh:render,...completion};
}
