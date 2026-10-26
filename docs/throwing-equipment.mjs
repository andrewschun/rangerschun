import {DUBS_BALLS,MARV_BALLS} from './engine.mjs?v=schedule-auto-refresh-20261025';
import {DRIVELINE_BALL_SWATCHES} from './driveline-colors.mjs?v=schedule-auto-refresh-20261025';
export const THROWING_PLYO_BRANDS=Object.freeze({dubs:'DUBS',driveline:'Driveline',marv:'MARV'});
const THROWING_SOURCE_MASSES=Object.freeze({gray:100,'dark green':125,yellow:150,red:225,purple:275,orange:350,blue:450,maroon:700,green:1000,pink:1500});
const throwingColorPattern=()=>/\b(dark[ -]green|gray|grey|yellow|red|purple|orange|blue|maroon|green|pink)\b/gi;
const throwingPlyoName=name=>/plyocare|janitors|step behinds|drop steps|step backs/i.test(name);
export function throwingBallFor(sourceColor,brand='driveline'){
 const color=sourceColor.toLowerCase().replace('-',' ').replace('grey','gray'),mass=THROWING_SOURCE_MASSES[color];if(!mass)throw Error('Unknown source ball');
 if(!Object.hasOwn(THROWING_PLYO_BRANDS,brand))throw Error('Choose a plyoball brand.');
 if(brand==='driveline')return {color:color[0].toUpperCase()+color.slice(1),mass_g:mass,swatch:DRIVELINE_BALL_SWATCHES[color],label:`${color[0].toUpperCase()+color.slice(1)} ${mass.toLocaleString('en-US')} g`,source_mass_g:mass,closest:false};
 const balls=[...(brand==='marv'?MARV_BALLS:DUBS_BALLS)].sort((a,b)=>a.mass_g-b.mass_g),ball=balls.reduce((best,b)=>Math.abs(b.mass_g-mass)<Math.abs(best.mass_g-mass)?b:best);
 return {...ball,label:`${ball.color} ${brand==='marv'?ball.mass_oz+' oz':ball.mass_g.toLocaleString('en-US')+' g'}`,source_mass_g:mass,closest:ball.mass_g!==mass};
}
export function throwingLightBall(brand){return throwingBallFor('yellow',brand);}
export function throwingSetupFromNotes(notes){
 const match=String(notes??'').match(/^Plyoballs: (Driveline|DUBS|MARV)\nLong toss: (Standard|Plyoball alternative)\n\n/);
 return match?{brand:Object.keys(THROWING_PLYO_BRANDS).find(k=>THROWING_PLYO_BRANDS[k]===match[1]),longTossPlyo:match[2]==='Plyoball alternative',notes:String(notes).slice(match[0].length)}:{brand:'driveline',longTossPlyo:false,notes:String(notes??'')};
}
export function throwingSetupNotes(setup,notes=''){return `Plyoballs: ${THROWING_PLYO_BRANDS[setup.brand]}\nLong toss: ${setup.longTossPlyo?'Plyoball alternative':'Standard'}\n\n${notes}`;}
export function throwingExerciseDisplay(exercise,setup){
 const original=String(exercise.planned_details??''),longToss=/long toss/i.test(exercise.name),balls=[];
 if(longToss&&setup.longTossPlyo){const ball=throwingLightBall(setup.brand);return {name:'Plyoball alternative to long toss',parts:[`Use ${THROWING_PLYO_BRANDS[setup.brand]} `,{text:ball.label,swatch:ball.swatch},'. Complete your coach-assigned plyoball drill and throw count. No long-toss distance or compression-throw target.'],balls:[ball],affected:true,longTossAlternative:true};}
 if(!throwingPlyoName(exercise.name))return {name:exercise.name,parts:[original],balls:[],affected:false,longTossAlternative:false};
 const parts=[];let end=0;
 for(const match of original.matchAll(throwingColorPattern())){if(match.index>end)parts.push(original.slice(end,match.index));const ball=throwingBallFor(match[0],setup.brand);balls.push(ball);parts.push({text:ball.label+(ball.closest?' (closest)':''),swatch:ball.swatch});end=match.index+match[0].length;}
 if(end<original.length)parts.push(original.slice(end));return {name:exercise.name,parts,balls,affected:balls.length>0,longTossAlternative:false};
}
export function throwingDisplayText(display){return display.parts.map(p=>typeof p==='string'?p:p.text).join('');}
export function appendThrowingDisplay(container,display){
 for(const part of display.parts){if(typeof part==='string'){container.append(document.createTextNode(part));continue;}const label=document.createElement('span'),dot=document.createElement('span');label.className='driveline-ball-label';dot.className='driveline-color-dot';dot.style.setProperty('--driveline-ball-color',part.swatch);dot.setAttribute('aria-hidden','true');label.append(dot,document.createTextNode(part.text));container.append(label);}return container;
}
export function stripThrowingEquipmentNote(notes){return String(notes??'').replace(/^(?:Ball setup|Long-toss alternative): [^\n]*\n?/,'');}
export function throwingExerciseNotes(exercise,setup,notes=''){
 const display=throwingExerciseDisplay(exercise,setup);if(!display.affected)return notes;
 const labels=[...new Set(display.balls.map(b=>b.label))].join(', '),prefix=display.longTossAlternative?'Long-toss alternative':'Ball setup';return `${prefix}: ${THROWING_PLYO_BRANDS[setup.brand]} ${labels}${display.longTossAlternative?' instead of long toss':''}.\n${notes}`;
}
