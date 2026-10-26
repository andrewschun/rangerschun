/** An in-memory, ascending-number challenge. No player records are written. */
export function concentrationNumbers(random=Math.random){
  const values=Array.from({length:100},(_,i)=>i+1);
  for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
  return values;
}
export function concentrationTime(milliseconds){
  const tenths=Math.floor(Math.max(0,milliseconds)/100);
  return `${Math.floor(tenths/600)}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`;
}
export class ConcentrationChallenge{
  constructor({now=()=>performance.now(),random=Math.random}={}){this.now=now;this.random=random;this.newGrid();}
  newGrid(){this.numbers=concentrationNumbers(this.random);this.restart();}
  restart(){this.next=1;this.startedAt=null;this.finishedAt=null;}
  elapsed(){return this.startedAt===null?0:(this.finishedAt??this.now())-this.startedAt;}
  select(number){
    if(number!==this.next||this.next>100)return false;
    if(this.startedAt===null)this.startedAt=this.now();
    this.next++;
    if(this.next===101)this.finishedAt=this.now();
    return true;
  }
}
export function startConcentrationGrid({element,now,random,setTimer=setInterval,clearTimer=clearInterval}){
  const game=new ConcentrationChallenge({now,random});
  const grid=element('concentration-grid'),status=element('concentration-status');
  let timer=null;
  const stop=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  function update(){
    element('concentration-next').textContent=game.next>100?'Done!':String(game.next);
    element('concentration-progress').textContent=`${game.next-1} / 100`;
    element('concentration-time').textContent=concentrationTime(game.elapsed());
  }
  function render(){
    stop();update();grid.replaceChildren();
    for(const number of game.numbers){
      const button=document.createElement('button');button.type='button';button.className='concentration-number';button.textContent=String(number);button.setAttribute('aria-label',`Number ${number}`);
      button.addEventListener('click',()=>{
        if(!game.select(number)){
          button.classList.add('concentration-wrong');
          status.textContent=`Find ${game.next} next. Your progress has not changed.`;
          return;
        }
        for(const cell of grid.children)cell.classList.remove('concentration-wrong');
        button.classList.add('concentration-found');button.disabled=true;
        button.setAttribute('aria-label',`Number ${number}, completed`);
        update();
        if(game.next>100){stop();status.textContent=`Grid complete! Your time: ${concentrationTime(game.elapsed())}. Try a new grid when you are ready.`;}
        else{
          status.textContent=`Find ${game.next} next.`;
          if(timer===null)timer=setTimer(update,100);
          // Keep keyboard navigation on the grid after the completed button is disabled.
          [...grid.children].find(cell=>!cell.disabled)?.focus({preventScroll:true});
        }
      });
      grid.append(button);
    }
    status.textContent='Select 1 to begin. Use Tab and Enter if you prefer a keyboard.';
  }
  element('concentration-new').addEventListener('click',()=>{game.newGrid();render();});
  element('concentration-restart').addEventListener('click',()=>{game.restart();render();});
  render();
  return {game,destroy:stop};
}
