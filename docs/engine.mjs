import { validateWorkoutChecklist, workoutExerciseRecorded } from './workout-checklist.mjs?v=schedule-auto-refresh-20261025';
import { validateExercisePlateLoad } from './workout-load.mjs?v=schedule-auto-refresh-20261025';
/** Exact screenshot references and labeled interpolation. No training prescription. */
export const DRILLS = Object.freeze(['Roll-Ins', 'Step Backs', 'Janitors', 'Drop Steps', 'Walking Windups']);
export const COLORS = Object.freeze(['green', 'blue', 'red', 'orange', 'gray']);
export const RANGE = Object.freeze({ min: 70, max: 86 });

function roundToTenth(value) {
  return Math.round((value + 1e-10) * 10) / 10;
}

function resultError(status, message, velocity) {
  return {
    status,
    message,
    mound_mph: typeof velocity === 'number' && Number.isFinite(velocity) ? velocity : null,
    lower_mph: null,
    upper_mph: null,
    range: { ...RANGE },
    cells: [],
    sources: [],
  };
}

/**
 * Input velocity must be a number. Read an HTML number input with valueAsNumber.
 * Original observations remain unrounded. Only interpolated targets round to 0.1 mph.
 * Blanks retain both source observations and never become zero-valued targets.
 */
export function getTargets(velocity, rows) {
  if (typeof velocity !== 'number' || !Number.isFinite(velocity)) {
    return resultError('invalid', 'Enter a finite fastball velocity in mph.', velocity);
  }
  if (velocity < RANGE.min || velocity > RANGE.max) {
    return resultError('out_of_range', 'Screenshot sources cover 70–86 mph. Extrapolation is disabled.', velocity);
  }
  if (!Array.isArray(rows)) throw new TypeError('Screenshot observations must be an array.');

  const lower = Math.floor(velocity);
  const upper = Math.ceil(velocity);
  const status = lower === upper ? 'observed' : 'interpolated';
  const cells = [];
  for (const ball_color of COLORS) {
    for (const drill of DRILLS) {
      const observations = [...new Set([lower, upper])].map(mound_mph => {
        const matches = rows.filter(row => row.mound_mph === mound_mph && row.ball_color === ball_color && row.drill === drill);
        if (matches.length !== 1) throw new Error(`Expected one observation for ${mound_mph} mph / ${ball_color} / ${drill}.`);
        const row = matches[0];
        if (!(row.target_mph === null || (typeof row.target_mph === 'number' && Number.isFinite(row.target_mph) && row.target_mph > 0)) || typeof row.source !== 'string' || !row.source) {
          throw new Error('Invalid screenshot observation.');
        }
        return { mound_mph: row.mound_mph, target_mph: row.target_mph, status: row.status, source: row.source };
      });
      const isBlank = observations.some(row => row.target_mph === null);
      const target_mph = isBlank ? null : status === 'observed'
        ? observations[0].target_mph
        : roundToTenth(observations[0].target_mph + (observations[1].target_mph - observations[0].target_mph) * (velocity - lower));
      cells.push({
        ball_color,
        drill,
        target_mph,
        status: isBlank ? 'blank_in_screenshot' : status,
        sources: [...new Set(observations.map(row => row.source))],
        observations,
      });
    }
  }
  return {
    status,
    message: status === 'observed'
      ? 'Observed in the user-supplied screenshot; colors, drills, and blanks are retained.'
      : `Linearly interpolated between the ${lower} and ${upper} mph screenshots; rounded to 0.1 mph.`,
    mound_mph: velocity,
    lower_mph: lower,
    upper_mph: upper,
    range: { ...RANGE },
    cells,
    sources: [...new Set(cells.flatMap(cell => cell.sources))],
  };
}

/** Pure summary only. Does not read, store, submit, or mutate any throw data. */
export function summarizeThrows(values) {
  if (!Array.isArray(values)) throw new TypeError('Throws must be an array.');
  if (values.length > 8) throw new RangeError('Enter at most 8 throws.');
  // Array.from also exposes sparse holes as undefined, which must not be ignored.
  if (Array.from(values).some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
    throw new TypeError('Each throw must be a finite number greater than zero.');
  }
  const sorted = [...values].sort((a, b) => b - a);
  const top5 = sorted.slice(0, 5);
  return {
    count: values.length,
    max: sorted[0] ?? null,
    averageTop5: values.length >= 5 ? top5.reduce((sum, value) => sum + value, 0) / 5 : null,
    top5,
  };
}

/** Nominal mass crosswalk from the user-supplied chart. This does not validate DUBS velocities. */
export const DUBS_BALLS = Object.freeze([
  { model: 'DPB-1000', mass_g: 1000, color: 'Black', swatch: '#303334', source_color: 'green', mapping_status: 'nominal_mass_match' },
  { model: 'DPB-450', mass_g: 450, color: 'Red', swatch: '#e5484b', source_color: 'blue', mapping_status: 'nominal_mass_match' },
  { model: 'DPB-350', mass_g: 350, color: 'Orange', swatch: '#f0832a', source_color: 'orange', mapping_status: 'nominal_mass_match' },
  { model: 'DPB-225', mass_g: 225, color: 'Yellow / gold', swatch: '#e0ad29', source_color: 'red', mapping_status: 'nominal_mass_match' },
  { model: 'DPB-150', mass_g: 150, color: 'Dark green', swatch: '#35584b', source_color: null, mapping_status: 'projection_only' },
  { model: 'DPB-100', mass_g: 100, color: 'Light blue', swatch: '#72a2c9', source_color: 'gray', mapping_status: 'nominal_mass_match' },
].map(ball => Object.freeze(ball)));

/** Coach-requested heuristic, not an empirical DUBS velocity model. Never projects Roll-Ins. */
function projectDubs150(original, drill) {
  if (drill === 'Roll-Ins') return { target_mph: null, status: 'not_projected', sources: [], observations: [], application_status: 'no_dubs_projection' };
  const basis = [{ ball_color: 'gray', mass_g: 100, coefficient: 0.6 }, { ball_color: 'red', mass_g: 225, coefficient: 0.4 }].map(item => {
    const source = original.cells.find(cell => cell.ball_color === item.ball_color && cell.drill === drill);
    return { ...item, observations: source.observations.map(observation => ({ ...observation })) };
  });
  const sources = [...new Set(basis.flatMap(item => item.observations.map(observation => observation.source)))];
  const projection = { method: 'linear_nominal_mass_interpolation', target_mass_g: 150, formula: '0.6 × Driveline gray 100 g + 0.4 × Driveline red 225 g', baseline_method: original.status, basis, validation: 'not_validated_for_dubs' };
  // Use the unrounded source anchors for decimal baselines; round only the final estimate.
  if (basis.some(item => item.observations.some(observation => observation.target_mph === null))) return { target_mph: null, status: 'projection_unavailable', sources, observations: [], projection, application_status: 'unvalidated_dubs_projection' };
  const unrounded_mph = basis.reduce((total, item) => {
    const lower = item.observations[0].target_mph, upper = item.observations.at(-1).target_mph;
    const reference = lower + (upper - lower) * (original.mound_mph - original.lower_mph);
    return total + item.coefficient * reference;
  }, 0);
  return { target_mph: roundToTenth(unrounded_mph), status: 'projected_mass_interpolation', sources, observations: [], projection: { ...projection, unrounded_mph }, application_status: 'unvalidated_dubs_projection' };
}

export function getDubsReferences(velocity, rows) {
  const original = getTargets(velocity, rows);
  if (!original.cells.length) return { ...original, application_status: 'unvalidated_dubs_transfer' };
  const cells = DUBS_BALLS.flatMap(ball => DRILLS.map(drill => {
    const source = ball.source_color ? original.cells.find(cell => cell.ball_color === ball.source_color && cell.drill === drill) : null;
    return {
      ball_model: ball.model, mass_g: ball.mass_g, ball_color: ball.color,
      drill, target_mph: source?.target_mph ?? null,
      status: source ? source.status : ball.mapping_status,
      source_color: ball.source_color,
      sources: source?.sources ?? [], observations: source?.observations ?? [],
      application_status: 'unvalidated_dubs_transfer',
      mapping_status: ball.mapping_status,
      ...(ball.model === 'DPB-150' ? projectDubs150(original, drill) : {}),
    };
  }));
  return { ...original, cells, application_status: 'unvalidated_dubs_transfer',
    message: 'Five nominal-mass rows copy Driveline references. Dark green 150 g has four coach-requested projections: 60% of gray 100 g plus 40% of red 225 g, rounded to 0.1 mph. Roll-Ins are not projected. Neither the copied references nor the projections are validated DUBS velocities.' };
}

/** Blast metric bounds validate units, not player performance or age norms. */
export const BLAST_METRICS = Object.freeze([
  { key: 'bat_speed_mph', label: 'Bat speed', unit: 'mph', min: 0, exclusiveMin: true, decimals: 1 },
  { key: 'attack_angle_deg', label: 'Attack angle', unit: '°', min: -90, max: 90, decimals: 1 },
  { key: 'time_to_contact_s', label: 'Time to contact', unit: 's', min: 0, exclusiveMin: true, decimals: 3 },
  { key: 'rotational_acceleration_g', label: 'Rotational acceleration', unit: 'g', min: 0, decimals: 1 },
  { key: 'on_plane_efficiency_pct', label: 'On-plane efficiency', unit: '%', min: 0, max: 100, decimals: 1 },
  { key: 'peak_hand_speed_mph', label: 'Peak hand speed', unit: 'mph', min: 0, decimals: 1 },
  { key: 'vertical_bat_angle_deg', label: 'Vertical bat angle', unit: '°', min: -90, max: 90, decimals: 1 },
  { key: 'early_connection_deg', label: 'Early connection', unit: '°', min: 0, max: 180, decimals: 1 },
  { key: 'connection_at_impact_deg', label: 'Connection at impact', unit: '°', min: 0, max: 180, decimals: 1 },
  { key: 'power_kw', label: 'Power', unit: 'kW', min: 0, decimals: 2 },
].map(Object.freeze));

export function validateBlastRecord(record, players) {
  if (!record || !players.includes(record.player)) throw new TypeError('Choose a player from the roster.');
  if (typeof record.session_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.session_date) || new Date(record.session_date + 'T12:00:00Z').toISOString().slice(0, 10) !== record.session_date) throw new TypeError('Choose a valid session date.');
  if (!['tee', 'front_toss', 'machine', 'live', 'air_swing', 'other'].includes(record.drill)) throw new TypeError('Choose a session context.');
  if (typeof record.bat !== 'string' || record.bat.length > 120 || typeof record.notes !== 'string' || record.notes.length > 300) throw new TypeError('Keep bat details within 120 characters and notes within 300.');
  for (const metric of BLAST_METRICS) {
    const value = record[metric.key];
    if (value === null && metric.key !== 'bat_speed_mph') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < metric.min || (metric.exclusiveMin && value === metric.min) || (metric.max !== undefined && value > metric.max)) throw new TypeError(`Check ${metric.label.toLowerCase()} (${metric.unit}).`);
  }
  return true;
}

export function summarizeBlast(records) {
  return Object.fromEntries(BLAST_METRICS.map(metric => {
    const values = records.map(record => record[metric.key]).filter(value => typeof value === 'number' && Number.isFinite(value));
    return [metric.key, { count: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, max: values.length ? Math.max(...values) : null }];
  }));
}

export function upsertBlastRecord(records, record, players) {
  validateBlastRecord(record, players);
  if (typeof record.id !== 'string' || !record.id.trim() || record.id.length > 120) throw new TypeError('This swing needs a valid record ID.');
  const matches=records.filter(item=>item.id===record.id);
  if(matches.length>1 || matches.some(item=>item.player!==record.player)) throw new Error('Swing identity conflict; this change was not saved.');
  const copy={...record};
  return matches.length ? records.map(item=>item.id===copy.id?copy:item) : [...records,copy];
}

export function filterBlastRecords(records, {player, from='', to='', drill='', bat=null}={}) {
  if(!player) return [];
  for(const value of [from,to]) {
    if(!value) continue;
    const stamp=/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T12:00:00Z'):NaN;
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value) throw new TypeError('Choose valid tracking dates.');
  }
  if(from&&to&&from>to) throw new TypeError('The start date must be on or before the end date.');
  return records.filter(record=>record.player===player&&(!from||record.session_date>=from)&&(!to||record.session_date<=to)&&(!drill||record.drill===drill)&&(bat===null||record.bat===bat));
}

export function blastDailyProgress(records, metricKey='bat_speed_mph') {
  if(!BLAST_METRICS.some(metric=>metric.key===metricKey)) throw new TypeError('Choose a Blast metric to track.');
  const groups=new Map();
  for(const record of records) { if(!groups.has(record.session_date))groups.set(record.session_date,[]);groups.get(record.session_date).push(record); }
  const days=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,entries])=>({date,swing_count:entries.length,metrics:summarizeBlast(entries),drills:[...new Set(entries.map(r=>r.drill))],bats:[...new Set(entries.map(r=>r.bat))]}));
  const measured=days.filter(day=>day.metrics[metricKey].count>0),first=measured[0]??null,latest=measured.at(-1)??null;
  return {days,first,latest,measured_day_count:measured.length,change:measured.length>=2?latest.metrics[metricKey].mean-first.metrics[metricKey].mean:null};
}

export function blastRecordsToCsv(records) {
  const keys=['id','player','session_date','drill','bat',...BLAST_METRICS.map(metric=>metric.key),'notes'];
  const cell=value=>{const safe=typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;return '"'+String(safe??'').replaceAll('"','""')+'"';};
  return [keys,...records.map(record=>keys.map(key=>record[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}

export const WORKOUT_CATEGORIES = Object.freeze({strength:'Strength',speed:'Speed / conditioning',mobility:'Mobility',baseball:'Baseball practice',other:'Other'});
export function validateWorkout(record, players) {
  if (!record || !Array.isArray(players) || !players.includes(record.player)) throw new TypeError('Choose a player from the roster.');
  if (typeof record.id !== 'string' || !record.id.trim() || record.id.length > 120) throw new TypeError('This workout needs a valid record ID.');
  const stamp = typeof record.session_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.session_date) ? Date.parse(record.session_date+'T12:00:00Z') : NaN;
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10) !== record.session_date) throw new TypeError('Choose a valid workout date.');
  if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 120) throw new TypeError('Enter a workout name, up to 120 characters.');
  if (!Object.hasOwn(WORKOUT_CATEGORIES,record.category)) throw new TypeError('Choose a workout type.');
  if (record.duration_minutes !== null && (typeof record.duration_minutes !== 'number' || !Number.isFinite(record.duration_minutes) || record.duration_minutes <= 0 || record.duration_minutes > 1440)) throw new TypeError('Duration must be in minutes, greater than zero and no more than one day.');
  if (!['','easy','moderate','hard'].includes(record.effort)) throw new TypeError('Choose an effort level or leave it blank.');
  if (typeof record.notes !== 'string' || record.notes.length > 500) throw new TypeError('Keep session notes within 500 characters.');
  if (record.source_template_id !== undefined && (typeof record.source_template_id !== 'string' || record.source_template_id.length > 120)) throw new TypeError('The source plan reference is invalid.');
  if (!Array.isArray(record.exercises) || record.exercises.length < 1 || record.exercises.length > 30) throw new TypeError('Add between 1 and 30 exercises.');
  for (const [i, exercise] of record.exercises.entries()) {
    const prefix='Exercise '+(i+1)+': ';
    if (!exercise || typeof exercise.name !== 'string' || !exercise.name.trim() || exercise.name.length > 120) throw new TypeError(prefix+'enter a name, up to 120 characters.');
    for (const key of ['sets','reps']) if (exercise[key] !== null && (!Number.isInteger(exercise[key]) || exercise[key] < 1 || exercise[key] > 999)) throw new TypeError(prefix+key+' must be a whole number from 1 to 999, or blank.');
    if (!['lb','kg','bodyweight','none'].includes(exercise.weight_unit)) throw new TypeError(prefix+'choose a load unit.');
    if (['bodyweight','none'].includes(exercise.weight_unit) && exercise.weight !== null) throw new TypeError(prefix+'bodyweight and no-load entries must leave weight blank.');
    if (exercise.weight !== null && (typeof exercise.weight !== 'number' || !Number.isFinite(exercise.weight) || exercise.weight < 0)) throw new TypeError(prefix+'weight must be a number at least zero, or blank.');
    validateExercisePlateLoad(exercise);
    if (typeof exercise.notes !== 'string' || exercise.notes.length > 200) throw new TypeError(prefix+'keep exercise notes within 200 characters.');
    for (const [key, limit] of [['source_exercise_id',120],['planned_details',2000]]) if (exercise[key] !== undefined && (typeof exercise[key] !== 'string' || exercise[key].length > limit)) throw new TypeError(prefix+'the source plan details are invalid.');
  }
  if(record.entry_mode==='plan_checklist')validateWorkoutChecklist(record);
  else if(record.completion_status!==undefined){
    if(!['completed','partial'].includes(record.completion_status)||record.completion_confirmed!==true)throw new TypeError('Choose a workout status and confirm that these are your actual results.');
    const recorded=record.exercises.filter(workoutExerciseRecorded).length;
    if(record.completion_status==='completed'&&recorded!==record.exercises.length)throw new TypeError('Enter actual sets, reps and load, or time/distance details, for each completed exercise.');
    if(record.completion_status==='partial'&&(!recorded||!record.notes.trim()))throw new TypeError('For a partial workout, record what you completed and explain what you changed or left out in session notes.');
  }
  return true;
}
export function upsertWorkout(records, record, players) {
  validateWorkout(record,players);
  const matches=records.filter(r=>r.id===record.id);
  if (matches.length>1 || matches.some(r=>r.player!==record.player)) throw new Error('Workout identity conflict; this change was not saved.');
  const copy={...record,exercises:record.exercises.map(exercise=>({...exercise,...(exercise.plate_load?{plate_load:{...exercise.plate_load,plates:exercise.plate_load.plates.map(p=>({...p}))}}:{})}))};
  return matches.length ? records.map(r=>r.id===copy.id?copy:r) : [...records,copy];
}
export function summarizeWorkouts(records) {
  const durations=records.map(r=>r.duration_minutes).filter(x=>typeof x==='number'&&Number.isFinite(x));
  return {session_count:records.length,exercise_count:records.reduce((sum,r)=>sum+r.exercises.length,0),duration_count:durations.length,duration_minutes:durations.length?durations.reduce((a,b)=>a+b,0):null,last_date:records.length?records.map(r=>r.session_date).sort().at(-1):null};
}
export function workoutsToCsv(records) {
  const keys=['workout_id','player','session_date','workout_name','category','duration_minutes','effort','exercise','sets','reps_per_set','weight','weight_unit','exercise_notes','session_notes','source_template_id','source_exercise_id','planned_details','completion_status','completion_confirmed','first_logged_at_device','last_edited_at_device','exercise_completed','completion_basis','weight_required','load_entry','plate_basis','plate_unit','bar_weight','plates','completion_group','equipment_mode','home_result_unit','home_result_per_set','home_sets'];
  const cells=value=>{
    const safe=typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;
    return '"'+String(safe??'').replaceAll('"','""')+'"';
  };
  const lines=records.flatMap(r=>r.exercises.map(e=>[r.id,r.player,r.session_date,r.title,r.category,r.duration_minutes,r.effort,e.name,e.sets,e.reps,e.weight,e.weight_unit,e.notes,r.notes,r.source_template_id,e.source_exercise_id,e.planned_details,r.completion_status,r.completion_confirmed,r.created_at,r.updated_at,e.completed,e.completion_basis,e.weight_required,e.load_entry,e.plate_load?.basis,e.plate_load?.unit,e.plate_load?.bar_weight,e.plate_load?JSON.stringify(e.plate_load.plates):'',e.completion_group,r.equipment_mode??'gym',e.home_result?.unit,e.home_result?.value,e.home_tracking?.sets]));
  return [keys,...lines].map(row=>row.map(cells).join(',')).join('\r\n');
}

export const BASEBALL_CONTEXTS=Object.freeze({mound_fastball:'Mound fastballs',flat_ground:'Flat-ground throws',position_throw:'Position throws',other:'Other baseball throws'});
export const BASEBALL_MOUND_DISTANCE_FT=60.5;
export const BASEBALL_RADAR_DEVICE='Pocket Radar';
export function validateBaseballSession(record,players){
  if(!record||!players.includes(record.player))throw new TypeError('Choose a player from the roster.');
  if(typeof record.id!=='string'||!record.id.trim()||record.id.length>120)throw new TypeError('This session needs a valid record ID.');
  const stamp=typeof record.session_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(record.session_date)?Date.parse(record.session_date+'T12:00:00Z'):NaN;
  if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==record.session_date)throw new TypeError('Choose a valid session date.');
  if(record.ball_type!=='regular_baseball'||record.velocity_unit!=='mph')throw new TypeError('This tracker records regular-baseball velocities in mph.');
  if(!Object.hasOwn(BASEBALL_CONTEXTS,record.context))throw new TypeError('Choose a baseball throwing context.');
  if(record.distance_ft!==null&&(typeof record.distance_ft!=='number'||!Number.isFinite(record.distance_ft)||record.distance_ft<=0))throw new TypeError('Distance must be positive feet, or blank.');
  if(typeof record.device!=='string'||record.device.length>100||typeof record.notes!=='string'||record.notes.length>300)throw new TypeError('Keep radar details within 100 characters and notes within 300.');
  if(!Array.isArray(record.throws)||record.throws.length!==8)throw new TypeError('A session has exactly eight attempt slots. Leave unused slots blank.');
  for(const value of record.throws)if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<=0))throw new TypeError('Each recorded throw must be a number greater than zero.');
  const stats=summarizeThrows(record.throws.filter(v=>v!==null));
  if(!stats.count)throw new TypeError('Enter at least one baseball throw before saving.');
  return stats;
}
export function upsertBaseballSession(records,record,players){
  const stats=validateBaseballSession(record,players);
  const matches=records.filter(r=>r.id===record.id);
  if(matches.length>1||matches.some(r=>r.player!==record.player))throw new Error('Session identity conflict; this change was not saved.');
  if(!matches.length&&record.distance_ft!==BASEBALL_MOUND_DISTANCE_FT)throw new TypeError('New baseball sessions use the fixed mound distance of 60 ft 6 in.');
  if(matches.length&&record.distance_ft!==matches[0].distance_ft)throw new TypeError('Keep the original distance when editing a saved session.');
  const copy={...record,throws:[...record.throws],valid_throw_count:stats.count,maximum_mph:stats.max,average_top_5_mph:stats.averageTop5,summary_status:stats.averageTop5===null?'incomplete_top5':'complete'};
  return matches.length?records.map(r=>r.id===copy.id?copy:r):[...records,copy];
}
export function baseballSessionsToCsv(records){
  const header=['session_id','player','session_date','ball_type','throwing_context','distance_ft','radar_device','velocity_unit',...Array.from({length:8},(_,i)=>'throw_'+(i+1)),'valid_throw_count','maximum_mph','average_top_5_mph','summary_status','notes'];
  const safe=value=>{const v=typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;return '"'+String(v??'').replaceAll('"','""')+'"';};
  const data=records.map(r=>{const stats=summarizeThrows(r.throws.filter(v=>v!==null));return[r.id,r.player,r.session_date,r.ball_type,r.context,r.distance_ft,r.device,r.velocity_unit,...r.throws,stats.count,stats.max,stats.averageTop5,stats.averageTop5===null?'incomplete_top5':'complete',r.notes];});
  return[header,...data].map(row=>row.map(safe).join(',')).join('\r\n');
}
