/** Plate counts always cover the whole bar; the bar is entered separately. */
export function plateLoadTotal(load){
  if(!load||load.basis!=='whole_bar'||!['lb','kg'].includes(load.unit)||!Array.isArray(load.plates)||load.plates.length>20)throw new TypeError('Choose plate units and count plates across the whole bar.');
  if(load.bar_weight!==null&&(typeof load.bar_weight!=='number'||!Number.isFinite(load.bar_weight)||load.bar_weight<0))throw new TypeError('Enter a bar weight of at least zero, or leave it blank.');
  let total=load.bar_weight??0,complete=load.bar_weight!==null;
  for(const plate of load.plates){
    if(!plate||plate.weight!==null&&(typeof plate.weight!=='number'||!Number.isFinite(plate.weight)||plate.weight<=0))throw new TypeError('Each plate size must be greater than zero.');
    if(plate.count!==null&&(!Number.isSafeInteger(plate.count)||plate.count<0))throw new TypeError('Plate counts must be whole numbers of at least zero.');
    if(plate.count===0)continue;
    if(plate.weight===null||plate.count===null){complete=false;continue;}
    total+=plate.weight*plate.count;
  }
  if(!Number.isFinite(total))throw new TypeError('The plate total is too large.');
  return complete?total:null;
}
export function validateExercisePlateLoad(exercise){
  if(exercise.load_entry===undefined&&exercise.plate_load===undefined)return true;
  if(exercise.load_entry!=='plates')throw new TypeError('Choose a valid workout load entry method.');
  const total=plateLoadTotal(exercise.plate_load);
  if(exercise.weight_unit!==exercise.plate_load.unit)throw new TypeError('Plate units must match the saved total weight.');
  if(total===null){if(exercise.weight!==null)throw new TypeError('An unfinished plate entry cannot have a total weight.');if(exercise.completed===true)throw new TypeError('Enter the bar weight and each plate size/count for the completed exercise.');}
  else if(typeof exercise.weight!=='number'||Math.abs(exercise.weight-total)>1e-9*Math.max(1,total))throw new TypeError('Total weight must equal the entered bar weight plus all plates on the bar.');
  return true;
}
export function plateLoadDescription(exercise){
  if(exercise.load_entry!=='plates')return '';
  const load=exercise.plate_load,total=plateLoadTotal(load),format=value=>Number(value).toLocaleString('en-CA',{maximumFractionDigits:4});
  const plates=load.plates.filter(p=>p.count>0&&p.weight!==null).map(p=>`${p.count} × ${format(p.weight)} ${load.unit}`).join(' + ');
  return `${plates||'No plates recorded'} (whole bar) + ${load.bar_weight===null?'bar weight not entered':format(load.bar_weight)+' '+load.unit+' bar'}${total===null?' · entry incomplete':' = '+format(total)+' '+load.unit+' total'}`;
}
