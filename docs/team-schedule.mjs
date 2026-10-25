const SCHEDULE_LIMIT=2000000;
function scheduleText(value=''){return value.replace(/\\([nN,;\\])/g,(_,char)=>/[nN]/.test(char)?'\n':char);}
function scheduleProperty(line){let quoted=false,colon=-1;for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;else if(line[i]===':'&&!quoted){colon=i;break;}}if(colon<1)return null;const [name,...parts]=line.slice(0,colon).split(';'),params={};for(const part of parts){const i=part.indexOf('=');if(i>0)params[part.slice(0,i).toUpperCase()]=part.slice(i+1).replace(/^"|"$/g,'');}return {name:name.toUpperCase(),params,value:line.slice(colon+1)};}
function scheduleParts(timestamp,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(timestamp).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
function scheduleWallTime(value,zone){
 const match=value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);if(!match)throw Error('Unsupported calendar date.');const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number),wall=Date.UTC(year,month-1,day,hour,minute,second),date=new Date(wall);
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59)throw Error('Invalid calendar date.');if(match[7])return wall;
 const offsets=new Set();for(const sample of [wall-86400000,wall,wall+86400000]){const p=scheduleParts(sample,zone);offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-sample);}const candidates=[...offsets].map(offset=>wall-offset).filter(timestamp=>{const p=scheduleParts(timestamp,zone);return p.year===year&&p.month===month&&p.day===day&&p.hour===hour&&p.minute===minute&&p.second===second;});if(!candidates.length)throw Error('This event time cannot be resolved in its timezone.');return Math.min(...candidates);
}
function scheduleDate(property,zone){
 if(!property)return null;if(property.params.VALUE==='DATE'||/^\d{8}$/.test(property.value)){const match=property.value.match(/^(\d{4})(\d{2})(\d{2})$/);if(!match)throw Error('Invalid all-day date.');const key=`${match[1]}-${match[2]}-${match[3]}`,utc=Date.parse(key+'T00:00:00Z');if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,10)!==key)throw Error('Invalid all-day date.');return {all_day:true,date:key,timestamp:utc};}
 return {all_day:false,timestamp:scheduleWallTime(property.value,property.params.TZID||zone)};
}
export function parseTeamCalendar(ical){
 if(typeof ical!=='string'||ical.length>SCHEDULE_LIMIT||!ical.trimStart().startsWith('BEGIN:VCALENDAR'))throw Error('The calendar feed is unavailable or invalid.');
 const lines=ical.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,'').split('\n'),stack=[],raw=[],calendar={};let event=null;
 for(const line of lines){const property=scheduleProperty(line);if(!property)continue;if(property.name==='BEGIN'){stack.push(property.value.toUpperCase());if(property.value.toUpperCase()==='VEVENT')event=[];continue;}if(property.name==='END'){if(stack.at(-1)!==property.value.toUpperCase())throw Error('The calendar feed is incomplete.');if(property.value.toUpperCase()==='VEVENT'&&event){raw.push(event);event=null;}stack.pop();continue;}if(stack.at(-1)==='VEVENT'&&event)event.push(property);else if(stack.length===1&&stack[0]==='VCALENDAR')calendar[property.name]=property.value;}
 if(!lines.some(line=>line==='END:VCALENDAR'))throw Error('The calendar feed is incomplete.');
 const zone=calendar['X-WR-TIMEZONE']||'America/Toronto';try{scheduleParts(Date.now(),zone);}catch{throw Error('The calendar timezone is not supported.');}
 const events=new Map();let skipped=0,recurring=0;
 for(const properties of raw){const get=name=>properties.find(p=>p.name===name);try{
  const start=scheduleDate(get('DTSTART'),zone);if(!start)throw Error();const end=scheduleDate(get('DTEND'),zone);if(end&&end.all_day!==start.all_day||end&&end.timestamp<start.timestamp)throw Error();
  const uid=get('UID')?.value??'event-'+raw.indexOf(properties),recurrence=get('RECURRENCE-ID')?.value??'',key=uid+'|'+recurrence,sequence=Number(get('SEQUENCE')?.value??0),modified=get('LAST-MODIFIED')?.value??get('DTSTAMP')?.value??'';
  const item={id:key,title:scheduleText(get('SUMMARY')?.value||'Team event'),location:scheduleText(get('LOCATION')?.value||''),description:scheduleText(get('DESCRIPTION')?.value||''),cancelled:get('STATUS')?.value.toUpperCase()==='CANCELLED',start,end,source_zone:zone,sequence:Number.isFinite(sequence)?sequence:0,modified,recurrence_unexpanded:properties.some(p=>['RRULE','RDATE','EXDATE'].includes(p.name))};
  const prior=events.get(key);if(!prior||item.sequence>prior.sequence||item.sequence===prior.sequence&&item.modified>=prior.modified)events.set(key,item);
 }catch{skipped++;}}
 const result=[...events.values()].sort((a,b)=>a.start.timestamp-b.start.timestamp||a.title.localeCompare(b.title));recurring=result.filter(e=>e.recurrence_unexpanded).length;
 return {name:scheduleText(calendar['X-WR-CALNAME']||'Team schedule'),timezone:zone,events:result,skipped,recurring};
}
export function scheduleDateKey(timestamp,zone='America/Toronto'){const parts=scheduleParts(timestamp,zone);return `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;}
export function selectTeamEvents(calendar,{view='upcoming',query='',now=Date.now(),zone='America/Toronto'}={}){
 const today=scheduleDateKey(now,zone),needle=query.trim().toLocaleLowerCase();return calendar.events.filter(event=>{
  const future=event.start.all_day?(event.end?event.end.date>today:event.start.date>=today):(event.end?.timestamp??event.start.timestamp)>=now;
  return (view==='all'||future)&&(!needle||[event.title,event.location,event.description].join(' ').toLocaleLowerCase().includes(needle));
 });
}
export function formatTeamEventTime(event,zone='America/Toronto'){
 if(event.start.all_day){if(!event.end||event.end.timestamp-event.start.timestamp<=86400000)return 'All day';const last=new Date(event.end.timestamp-86400000);return 'All day · through '+new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',timeZone:'UTC'}).format(last);}
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:true}),start=format.format(event.start.timestamp);if(!event.end)return start;
 const sameDay=scheduleDateKey(event.start.timestamp,zone)===scheduleDateKey(event.end.timestamp,zone);return start+' – '+(sameDay?'':new Intl.DateTimeFormat('en-CA',{timeZone:zone,month:'short',day:'numeric'}).format(event.end.timestamp)+' ')+format.format(event.end.timestamp);
}

export function teamCalendarMonth(year,month){
 if(!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11)throw new TypeError('Choose a valid calendar month.');
 const first=Date.UTC(year,month,1,12),offset=new Date(first).getUTCDay();
 return Array.from({length:42},(_,index)=>{const day=new Date(first+(index-offset)*86400000);return {date:day.toISOString().slice(0,10),day:day.getUTCDate(),in_month:day.getUTCFullYear()===year&&day.getUTCMonth()===month};});
}
export function teamEventOnDate(event,date,zone='America/Toronto'){
 if(event.start.all_day)return event.start.date<=date&&(event.end?date<event.end.date:date===event.start.date);
 const first=scheduleDateKey(event.start.timestamp,zone),last=scheduleDateKey(event.end&&event.end.timestamp>event.start.timestamp?event.end.timestamp-1:event.start.timestamp,zone);return first<=date&&date<=last;
}

/** The public subscription contains event types and times only, never names or notes. */
export function publicTeamCalendarSnapshot(ical,fetched_at){
 const calendar=parseTeamCalendar(ical);
 if(calendar.skipped||calendar.recurring)throw Error('Some TeamSnap dates could not be read.');
 if(typeof fetched_at!=='string'||!Number.isFinite(Date.parse(fetched_at)))throw Error('Invalid calendar retrieval time.');
 const date=value=>value.all_day?value.date.replace(/-/g,''):new Date(value.timestamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const type=event=>/practice|training|workout|bullpen/i.test(event.title)?'Practice':/game|vs\.?|@|tournament|scrimmage/i.test(event.title)?'Game':'Team event';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rangers//Team schedule//EN','X-WR-TIMEZONE:America/Toronto'];
 for(const event of calendar.events){
  // A stable anonymous UID avoids duplicates when an event is added or rescheduled.
  let hashA=2166136261,hashB=5381;for(const char of event.id){const n=char.charCodeAt(0);hashA=Math.imul(hashA^n,16777619);hashB=Math.imul(hashB,33)^n;}
  const uid=/^event-[a-f0-9]{2,16}@rangers-schedule\|$/.test(event.id)?event.id.slice(0,-1):'event-'+(hashA>>>0).toString(16)+(hashB>>>0).toString(16)+'@rangers-schedule';
  lines.push('BEGIN:VEVENT','UID:'+uid,'SEQUENCE:'+Math.max(0,Math.trunc(event.sequence)),'DTSTAMP:'+( /^\d{8}T\d{6}Z$/.test(event.modified)?event.modified:date({timestamp:Date.parse(fetched_at)})),'DTSTART'+(event.start.all_day?';VALUE=DATE':'')+':'+date(event.start));
  if(event.end)lines.push('DTEND'+(event.end.all_day?';VALUE=DATE':'')+':'+date(event.end));
  lines.push('SUMMARY:'+type(event));if(event.cancelled)lines.push('STATUS:CANCELLED');lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return {ical_text:lines.join('\r\n')+'\r\n',fetched_at,source:'TeamSnap',stale:false};
}
