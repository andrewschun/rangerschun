export function createWorkoutLoadFields(value={},name='Exercise'){
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const root=make('div','workout-load-entry'),grid=make('div','checklist-load'),weightLabel=make('label','weight-number-field','Weight used'),weight=make('input');weight.type='number';weight.min='0';weight.step='any';weight.inputMode='decimal';weight.placeholder='Enter weight';weight.value=value.weight??'';weight.dataset.exercise='weight';weight.setAttribute('aria-label',name+' weight used');weightLabel.append(weight);
 const unitLabel=make('label','','Weight unit'),unit=make('select');unit.dataset.exercise='weight_unit';unit.setAttribute('aria-label',name+' weight unit');
 for(const[v,text]of [['lb','Total weight · lb'],['kg','Total weight · kg'],['bodyweight','Bodyweight'],['none','No added load']]){const option=make('option','',text);option.value=v;unit.append(option);}unit.value=value.weight_unit??'lb';unitLabel.append(unit);grid.append(weightLabel,unitLabel);root.append(grid);
 function sync(){weight.disabled=['none','bodyweight'].includes(unit.value);if(weight.disabled)weight.value='';}
 unit.addEventListener('change',sync);sync();
 return {element:root,read:()=>{const actual=weight.value.trim()===''?null:weight.valueAsNumber;
  // Preserve an unchanged historical plate record; new/changed loads use ordinary total weight.
  if(value.load_entry==='plates'&&unit.value===value.weight_unit&&actual===value.weight)return {weight:actual,weight_unit:unit.value,load_entry:'plates',plate_load:JSON.parse(JSON.stringify(value.plate_load))};
  return {weight:actual,weight_unit:unit.value};
 }};
}
