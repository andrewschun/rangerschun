export const TAB_PLAYER_IDS={workouts:'workout-player',throwing:'throwing-player',targets:'player',tracker:'baseball-player',pulse:'pulse-player',blast:'blast-player',overspeed:'overspeed-player',axe:'axe-player',concentration:'concentration-player'};
// Each existing form handles its own unsaved-change guard before this listener runs.
// Only the tab being opened is synchronized; hidden drafts are left untouched.
export function startTabPlayers({players,element:$}){
 let current='';
 for(const id of Object.values(TAB_PLAYER_IDS)){
  const select=$(id);
  select.addEventListener('change',()=>{current=select.value;});
 }
 return {setCurrent(player){if(player===''||players.includes(player))current=player;},current:()=>current,activate(view){
   const id=TAB_PLAYER_IDS[view];if(!id)return;
   const select=$(id);if(!select||select.value===current)return;
   select.value=current;select.dispatchEvent(new Event('change',{bubbles:true}));current=select.value;
 }};
}
