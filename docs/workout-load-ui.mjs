import { plateLoadTotal } from './workout-load.mjs?v=combined-workouts-20261025';

export function createWorkoutLoadFields(value={},name='Exercise'){
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const number=input=>input.value.trim()===''?null:input.valueAsNumber;
  const root=make('div','workout-load-entry'),grid=make('div','checklist-load'),weightLabel=make('label','weight-number-field','Weight used'),weight=make('input');weight.type='number';weight.min='0';weight.step='any';weight.inputMode='decimal';weight.placeholder='Enter weight';weight.value=value.weight??'';weight.dataset.exercise='weight';weight.setAttribute('aria-label',name+' weight used');weightLabel.append(weight);
  const unitLabel=make('label','','Enter weight as'),unit=make('select');unit.dataset.exercise='weight_unit';unit.setAttribute('aria-label',name+' load unit or plates');
  for(const[v,text]of [['lb','Total weight · lb'],['kg','Total weight · kg'],['plates_lb','Plates on whole bar · lb'],['plates_kg','Plates on whole bar · kg'],['bodyweight','Bodyweight'],['none','No added load']]){const option=make('option','',text);option.value=v;unit.append(option);}unit.value=value.load_entry==='plates'?'plates_'+value.plate_load.unit:value.weight_unit??'lb';unitLabel.append(unit);grid.append(weightLabel,unitLabel);root.append(grid);
  const panel=make('div','plate-load-panel'),help=make('p','plate-load-help','Count every plate across the whole bar. Enter the bar weight separately.'),barLabel=make('label','','Bar weight'),bar=make('input','plate-bar-weight');bar.type='number';bar.min='0';bar.step='any';bar.inputMode='decimal';bar.placeholder='Enter the bar’s weight';bar.value=value.plate_load?.bar_weight??'';bar.setAttribute('aria-label',name+' bar weight');barLabel.append(bar);
  const rows=make('div','plate-load-rows'),add=make('button','secondary-button plate-add','+ Add another plate size');add.type='button';const total=make('p','plate-load-total');total.setAttribute('role','status');total.setAttribute('aria-live','polite');panel.append(help,barLabel,rows,add,total);root.append(panel);
  const plateUnit=()=>unit.value==='plates_kg'?'kg':'lb';let last=unit.value,storedPlateUnit=value.plate_load?.unit??'lb';
  function plateData(){return {basis:'whole_bar',unit:plateUnit(),bar_weight:number(bar),plates:[...rows.children].map(row=>({weight:number(row.querySelector('.plate-weight-input')),count:number(row.querySelector('.plate-count-input'))})).filter(p=>p.weight!==null||p.count!==null)};}
  function update(){
    const labelUnit=plateUnit();bar.setAttribute('aria-label',`${name} bar weight in ${labelUnit}`);help.textContent=`Count every plate across the whole bar. Enter the bar weight separately. All weights below are in ${labelUnit}.`;
    [...rows.children].forEach((row,i)=>{row.querySelector('.plate-weight-input').setAttribute('aria-label',`${name} plate size ${i+1} in ${labelUnit}`);row.querySelector('.plate-count-input').setAttribute('aria-label',`${name} total count of plate size ${i+1} on whole bar`);row.querySelector('.plate-remove').disabled=rows.children.length===1;});add.disabled=rows.children.length>=20;
    try{const result=plateLoadTotal(plateData());weight.value=result??'';total.textContent=result===null?'Enter the bar weight and plate sizes/counts to see the total.':`Total lifted: ${result.toLocaleString('en-CA',{maximumFractionDigits:4})} ${labelUnit} · bar + all plates`;}
    catch(error){weight.value='';total.textContent=error.message;}
  }
  function addRow(plate={weight:null,count:null}){
    if(rows.children.length>=20)return;
    const row=make('div','plate-load-row'),sizeLabel=make('label','','Weight of one plate'),size=make('input','plate-weight-input');size.type='number';size.min='0.01';size.step='any';size.inputMode='decimal';size.placeholder='e.g. 45';size.value=plate.weight??'';sizeLabel.append(size);
    const countLabel=make('label','','Total plates on bar'),count=make('input','plate-count-input');count.type='number';count.min='0';count.step='1';count.inputMode='numeric';count.placeholder='e.g. 2';count.value=plate.count??'';countLabel.append(count);
    const remove=make('button','plate-remove','×');remove.type='button';remove.setAttribute('aria-label','Remove plate size');remove.addEventListener('click',()=>{if(rows.children.length>1){row.remove();update();root.dispatchEvent(new Event('input',{bubbles:true}));}});row.append(sizeLabel,countLabel,remove);rows.append(row);update();
  }
  for(const plate of value.plate_load?.plates?.length?value.plate_load.plates:[{weight:null,count:null}])addRow(plate);
  // Building the inactive plate editor must not overwrite an existing direct weight.
  weight.value=value.weight??'';
  function sync(){const plates=unit.value.startsWith('plates_');grid.classList.toggle('is-plates',plates);panel.hidden=!plates;weightLabel.hidden=plates;weight.disabled=plates||['none','bodyweight'].includes(unit.value);if(['none','bodyweight'].includes(unit.value))weight.value='';if(plates)update();}
  unit.addEventListener('change',()=>{
    if(unit.value.startsWith('plates_')&&storedPlateUnit!==plateUnit()&&(bar.value||[...rows.children].some(r=>r.querySelector('.plate-weight-input').value||r.querySelector('.plate-count-input').value))){if(!window.confirm('Change plate units and clear the entered bar and plates?')){unit.value=last;return;}bar.value='';rows.replaceChildren();addRow();}
    if(last.startsWith('plates_')&&['lb','kg'].includes(unit.value)&&last!=='plates_'+unit.value)weight.value='';
    if(unit.value.startsWith('plates_'))storedPlateUnit=plateUnit();
    last=unit.value;sync();
  });
  panel.addEventListener('input',update);add.addEventListener('click',()=>{addRow();root.dispatchEvent(new Event('input',{bubbles:true}));});sync();
  return {element:root,read:()=>{if(!unit.value.startsWith('plates_'))return {weight:number(weight),weight_unit:unit.value};const load=plateData();let result=null;try{result=plateLoadTotal(load);}catch{}return {load_entry:'plates',plate_load:load,weight:result,weight_unit:plateUnit()};}};
}
