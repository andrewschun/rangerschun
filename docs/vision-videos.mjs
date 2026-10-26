/** Verified short-video rotation. No completion or click records are collected. */
export const VISION_VIDEO_TIME_ZONE='America/Toronto';
export const VISION_VIDEO_EPOCH='2026-10-26';
export const VISION_VIDEOS=Object.freeze([
  {
    "id": "bbk_ufmkYdE",
    "title": "FPS Eye Warm-Up & Training for Improved Performance",
    "channel": "Neurobuff",
    "duration_seconds": 276,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=bbk_ufmkYdE"
  },
  {
    "id": "29pQZZWdooY",
    "title": "Advanced FPS Eye Training - Improve Reaction Time & Tracking",
    "channel": "Neurobuff",
    "duration_seconds": 252,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=29pQZZWdooY"
  },
  {
    "id": "s-CBRvo32p4",
    "title": "Schulte Table Peripheral Vision Training - Improve Situational Awareness",
    "channel": "Neurobuff",
    "duration_seconds": 277,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=s-CBRvo32p4"
  },
  {
    "id": "E7HOlJ_OhEo",
    "title": "FPS Eye Training - Improve Reaction Time & Tracking",
    "channel": "Neurobuff",
    "duration_seconds": 229,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=E7HOlJ_OhEo"
  },
  {
    "id": "53yCBaWT5yY",
    "title": "How Fast is your Brain? - 5 Mental Processing Speed Exercises",
    "channel": "Neurobuff",
    "duration_seconds": 231,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=53yCBaWT5yY"
  },
  {
    "id": "RhdUV4F_ybM",
    "title": "Peripheral Vision Training - Improve Situational Awareness",
    "channel": "Neurobuff",
    "duration_seconds": 247,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=RhdUV4F_ybM"
  },
  {
    "id": "YDweIPg2REg",
    "title": "Advanced FPS Eye Training - Improve Your Tracking Fast",
    "channel": "EyeQ Pro",
    "duration_seconds": 254,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=YDweIPg2REg"
  },
  {
    "id": "Ng6crV7WWBY",
    "title": "Only 2% Can Stay Focused Until the End",
    "channel": "EyeQ Pro",
    "duration_seconds": 188,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=Ng6crV7WWBY"
  },
  {
    "id": "RfhXEMFp-_c",
    "title": "FPS Eye Training for Gaming: Improve Reaction Time & Aim Tracking",
    "channel": "EyeQ Pro",
    "duration_seconds": 231,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=RfhXEMFp-_c"
  },
  {
    "id": "pQEUWgsYM60",
    "title": "Esports Eye Training - Improve Reaction Time & Peripheral Vision for Gamers",
    "channel": "paladox",
    "duration_seconds": 185,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=pQEUWgsYM60"
  },
  {
    "id": "pRsYN3kTKeE",
    "title": "Smooth Pursuit Exercise 11 Soccer Ball Moving Fixed Background",
    "channel": "360NeuroHealth",
    "duration_seconds": 29,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=pRsYN3kTKeE"
  },
  {
    "id": "euXarbA5vw4",
    "title": "Smooth Pursuit Exercise 8 Moving Basketball on Moving Background",
    "channel": "360NeuroHealth",
    "duration_seconds": 30,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=euXarbA5vw4"
  },
  {
    "id": "qTCROeWsl2E",
    "title": "10 Seconds Left with Center Target and Box Breathing",
    "channel": "360NeuroHealth",
    "duration_seconds": 125,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=qTCROeWsl2E"
  },
  {
    "id": "UQJ47hPOwfI",
    "title": "120 Seconds Down with Moving Target",
    "channel": "360NeuroHealth",
    "duration_seconds": 137,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=UQJ47hPOwfI"
  },
  {
    "id": "gCR5EbuNcIE",
    "title": "DARKMODE FPS Eye Training Warmup 2025 (HIGH RES)",
    "channel": "Incubator",
    "duration_seconds": 386,
    "verified_on": "2026-10-26",
    "verification_url": "https://www.youtube.com/watch?v=gCR5EbuNcIE"
  }
].map(video=>Object.freeze(video)));
export function eligibleVisionVideos(videos=VISION_VIDEOS){
 const seen=new Set();return videos.filter(v=>v&&/^[A-Za-z0-9_-]{11}$/.test(v.id)&&typeof v.title==='string'&&v.title.trim()&&Number.isInteger(v.duration_seconds)&&v.duration_seconds>0&&v.duration_seconds<=480&&!seen.has(v.id)&&seen.add(v.id));
}
export function visionDayNumber(now=new Date()){
 const date=new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Choose a valid time.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:VISION_VIDEO_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return Math.floor(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/86400000)-(Number(parts.hour)<1?1:0);
}
export function visionRotation(now=new Date(),videos=VISION_VIDEOS){
 const eligible=eligibleVisionVideos(videos);if(!eligible.length)return null;
 const day=visionDayNumber(now),epoch=Date.parse(VISION_VIDEO_EPOCH+'T00:00:00Z')/86400000,index=((day-epoch)%eligible.length+eligible.length)%eligible.length;
 return {video:eligible[index],index,total:eligible.length,day,label:new Date(day*86400000).toISOString().slice(0,10)};
}
export function visionNextChange(now=new Date()){
 const start=new Date(now).getTime(),day=visionDayNumber(now);let low=start,high=start+27*3600000;
 while(high-low>1){const mid=Math.floor((low+high)/2);if(visionDayNumber(mid)===day)low=mid;else high=mid;}
 return new Date(high);
}
export function visionVideoDuration(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function startVisionVideos({element:$,now=()=>new Date(),setTimer=setTimeout,clearTimer=clearTimeout,document:doc=globalThis.document,window:win=globalThis.window}={}){
 let previousDay=null,timer=null;
 const make=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const list=$('vision-video-list');list.replaceChildren();
 for(const video of eligibleVisionVideos()){const item=make('li'),link=make('a',video.title);link.href='https://www.youtube.com/watch?v='+video.id;link.target='_blank';link.rel='noopener noreferrer';item.append(link,make('span',` · ${visionVideoDuration(video.duration_seconds)}`));list.append(item);}
 function refresh(){
  const time=now(),choice=visionRotation(time);if(!choice)return;if(timer!==null)clearTimer(timer);timer=setTimer(refresh,Math.max(1,visionNextChange(time).getTime()-new Date(time).getTime()));timer?.unref?.();if(choice.day===previousDay)return;previousDay=choice.day;
  const video=choice.video;$('vision-video-title').textContent=video.title;$('vision-video-link').href='https://www.youtube.com/watch?v='+video.id;$('vision-video-image').src='https://i.ytimg.com/vi/'+video.id+'/mqdefault.jpg';
  $('vision-video-meta').textContent=`${visionVideoDuration(video.duration_seconds)} · ${video.channel}`;
  $('vision-video-position').textContent=`Video ${choice.index+1} of ${choice.total} · ${choice.label}`;
  $('vision-video-count').textContent=`See the ${choice.total}-video rotation`;
 }
 const onVisible=()=>{if(doc.visibilityState!=='hidden')refresh();};
 refresh();doc.addEventListener?.('visibilitychange',onVisible);win?.addEventListener?.('focus',refresh);
 return {refresh,destroy(){clearTimer(timer);doc.removeEventListener?.('visibilitychange',onVisible);win?.removeEventListener?.('focus',refresh);}};
}
