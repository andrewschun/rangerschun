/** Manually copied end-of-session scores. Separate from individual swing measurements. */
export const BLAST_PCR_METRICS = Object.freeze([
  { key:'plane_score', label:'Plane', letter:'P' },
  { key:'connection_score', label:'Connection', letter:'C' },
  { key:'rotation_score', label:'Rotation', letter:'R' },
].map(Object.freeze));
export const BLAST_PCR_TEAM_SCALE = Object.freeze({ id:'20_80', label:'20–80', min:20, max:80 });
export const BLAST_SESSION_METRICS = Object.freeze([
  {key:'bat_speed_mph',label:'Bat speed',unit:'mph',min:0,exclusiveMin:true},
  {key:'attack_angle_deg',label:'Attack angle',unit:'°',min:-90,max:90},
  {key:'time_to_contact_s',label:'Time to contact',unit:'s',min:0,exclusiveMin:true},
].map(Object.freeze));
// The earlier format is retained only for saved history and queued legacy events.
export const BLAST_PCR_SCALES = Object.freeze([
  BLAST_PCR_TEAM_SCALE,
  { id:'0_100', label:'0–100', min:0, max:100, legacy:true },
].map(Object.freeze));

export function validateBlastPcrSession(record,players){
  if(!record||!players.includes(record.player))throw new TypeError('Choose a player from the roster.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('This session needs a valid identity.');
  if(typeof record.session_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.session_date)||!Number.isFinite(Date.parse(record.session_date+'T12:00:00Z'))||new Date(record.session_date+'T12:00:00Z').toISOString().slice(0,10)!==record.session_date)throw new TypeError('Choose a valid session date.');
  if(record.source!=='blast_motion_manual'||record.entry_scope!=='session')throw new TypeError('Copy these scores from the end-of-session summary in Blast.');
  const scale=BLAST_PCR_SCALES.find(item=>item.id===record.score_scale);
  if(!scale)throw new TypeError('This session needs a valid saved score scale.');
  for(const [key,max]of [['session_label',120],['level_of_play',120],['notes',500]])if(typeof record[key]!=='string'||record[key].length>max)throw new TypeError(`Keep ${key.replaceAll('_',' ')} within ${max} characters.`);
  for(const metric of BLAST_PCR_METRICS){const value=record[metric.key];if(value===null)continue;if(typeof value!=='number'||!Number.isFinite(value)||value<scale.min||value>scale.max)throw new TypeError(`${metric.label} score must be between ${scale.min} and ${scale.max}, or left blank.`);}
  for(const metric of BLAST_SESSION_METRICS){const value=record[metric.key];if(value===null||value===undefined)continue;if(typeof value!=='number'||!Number.isFinite(value)||value<metric.min||(metric.exclusiveMin&&value===metric.min)||(metric.max!==undefined&&value>metric.max))throw new TypeError(`Check session ${metric.label.toLowerCase()} (${metric.unit}).`);}
  if(record.drill!==undefined&&!['tee','front_toss','machine','live','other'].includes(record.drill))throw new TypeError('Choose a session setting; Air Swing is not available.');
  if(record.bat!==undefined&&(typeof record.bat!=='string'||record.bat.length>120))throw new TypeError('Keep bat details within 120 characters.');
  if(![...BLAST_PCR_METRICS,...BLAST_SESSION_METRICS].some(metric=>typeof record[metric.key]==='number'))throw new TypeError('Enter at least one available session reading or PCR score before saving.');
  return true;
}
export function validateBlastPcrRecords(records,players){
  if(!Array.isArray(records))throw new TypeError('Session PCR records must be a list.');
  const seen=new Set();for(const record of records){validateBlastPcrSession(record,players);if(seen.has(record.id))throw new TypeError('Duplicate session identity.');seen.add(record.id);}return true;
}
export function upsertBlastPcrSession(records,record,players){
  validateBlastPcrSession(record,players);
  const matches=records.filter(item=>item.id===record.id);
  if(matches.length>1||matches.some(item=>item.player!==record.player))throw new TypeError('Session identity conflict; this change was not saved.');
  if(!matches.length&&record.score_scale!==BLAST_PCR_TEAM_SCALE.id)throw new TypeError('New session PCR scores use the 20–80 scale.');
  if(matches.length&&record.score_scale!==matches[0].score_scale)throw new TypeError('Keep the original scale for this saved session.');
  const copy={...record};return matches.length?records.map(item=>item.id===record.id?copy:item):[...records,copy];
}
export function blastPcrJournalLabel(record){
  const scale=BLAST_PCR_SCALES.find(item=>item.id===record.score_scale)?.label??record.score_scale;
  return ['Blast session',...BLAST_PCR_METRICS.map(metric=>`${metric.letter} ${record[metric.key]??'—'}`),`Scale ${scale}`,record.session_label].filter(Boolean).join(' · ');
}
export function blastPcrRecordsToCsv(records){
  const keys=['id','player','session_date','session_label','score_scale','level_of_play',...BLAST_PCR_METRICS.map(metric=>metric.key),'source','entry_scope','notes','created_at','updated_at','drill','bat',...BLAST_SESSION_METRICS.map(metric=>metric.key)];
  const cell=value=>'"'+String(typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value??'').replaceAll('"','""')+'"';
  return [keys,...records.map(record=>keys.map(key=>record[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}
