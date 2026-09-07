import{state,$}from'./state.js';
import{suggestPhraseBoundaries,nearestPhraseSuggestion}from'./phrase-model.js';

state.showPhraseSuggestions=state.showPhraseSuggestions!==false;
const cache=new Map();
const style=document.createElement('style');style.textContent=`
.phrase-suggest-layer{position:absolute;inset:0;pointer-events:none;z-index:5}
.phrase-suggest-line{position:absolute;top:0;bottom:0;width:1px;background:rgba(198,166,107,.20);pointer-events:none}
.phrase-suggest-line.b{background:rgba(102,181,168,.20)}
.phrase-suggest-cap{position:absolute;top:5px;left:0;transform:translateX(-50%);height:18px;min-width:22px;padding:0 4px;border:1px solid rgba(198,166,107,.45);border-radius:4px;background:#111820;color:#d7bf89;font:700 8px ui-monospace,monospace;cursor:pointer;pointer-events:auto;white-space:nowrap}
.phrase-suggest-cap.b{border-color:rgba(102,181,168,.5);color:#9fd2c9}
.phrase-toggle.active{border-color:#66b5a8!important;background:#1d302d!important;color:#d8eee8!important}
`;
document.head.appendChild(style);

function analysisSignature(track){const a=track.analysis,b=a?.beats||[],first=b[0],mid=b[Math.floor(b.length/2)],last=b.at(-1);return`${a?.bpm}|${a?.meter}|${a?.beatsPerBar}|${b.length}|${Number(first?.accent||0).toFixed(3)}|${Number(mid?.accent||0).toFixed(3)}|${Number(last?.accent||0).toFixed(3)}|${a?.tempoUserAdjusted?'u':''}`}
function baseSuggestions(track){const sig=analysisSignature(track),old=cache.get(track.id);if(old?.sig===sig)return old.items;const items=suggestPhraseBoundaries(track);cache.set(track.id,{sig,items});return items}
function suggestions(track){return baseSuggestions(track).map(s=>{const m=track.markers?.[s.beatIndex];return{...s,projectTime:(track.timelineOffset||0)+(m?.targetTime??s.time)}})}
function chooseTrack(){if(Number.isInteger(state.selected?.track))return state.tracks[state.selected.track];const sel=$('#tempoTrack');return state.tracks[Number(sel?.value)||0]||state.tracks[0]}
function selectSuggestion(track,item,{movePlayhead=true}={}){
  if(!track||!item)return;const marker=$(`.marker[data-track="${track.id}"][data-beat="${item.beatIndex}"]`);if(marker)marker.click();
  if(movePlayhead){state.playheadTime=Math.max(0,item.projectTime);window.dispatchEvent(new Event('resize'))}
  $('#engineState').textContent=`${track.label} PHRASE SUGGESTION · BAR ${item.bar} · ${Math.round(item.confidence*100)}% · CLICK ALIGN @ TO USE`;
}
function paintTrack(track){
  const lane=$(`#lane-${track.id}`);if(!lane)return;lane.querySelector(':scope > .phrase-suggest-layer')?.remove();if(!state.showPhraseSuggestions||!track.analysis?.beats?.length)return;
  const view=Math.max(1,state.viewDuration||60),layer=document.createElement('div');layer.className='phrase-suggest-layer';
  for(const item of suggestions(track)){if(item.projectTime<0||item.projectTime>view)continue;const line=document.createElement('div');line.className='phrase-suggest-line'+(track.id?' b':'');line.style.left=`${item.projectTime/view*100}%`;const cap=document.createElement('button');cap.className='phrase-suggest-cap'+(track.id?' b':'');cap.textContent=`P${item.bar}`;cap.title=`Likely phrase entrance · bar ${item.bar} · ${Math.round(item.confidence*100)}% confidence`;cap.onclick=e=>{e.stopPropagation();selectSuggestion(track,item)};line.appendChild(cap);layer.appendChild(line)}lane.appendChild(layer);
}
function paint(){state.tracks.forEach(paintTrack);const b=$('#phraseToggle');if(b){b.classList.toggle('active',state.showPhraseSuggestions);b.textContent=state.showPhraseSuggestions?'PHRASES ON':'PHRASES OFF'}}
function navigate(direction){const track=chooseTrack(),items=suggestions(track);if(!items.length)return $('#engineState').textContent=`${track.label} · NO PHRASE SUGGESTIONS YET`;const projectItems=items.map(x=>({...x,time:x.projectTime})),item=nearestPhraseSuggestion(projectItems,state.playheadTime,{direction});selectSuggestion(track,item)}
function install(){
  if($('#phraseToggle'))return;const label=document.createElement('span');label.className='label section';label.textContent='STRUCTURE';const prev=document.createElement('button'),toggle=document.createElement('button'),next=document.createElement('button');prev.className=toggle.className=next.className='mode';prev.id='phrasePrev';toggle.id='phraseToggle';next.id='phraseNext';prev.textContent='◀ PHRASE';toggle.textContent='PHRASES ON';next.textContent='PHRASE ▶';prev.title='Select previous suggested phrase entrance on the active track';toggle.title='Show or hide advisory phrase entrance suggestions';next.title='Select next suggested phrase entrance on the active track';prev.onclick=()=>navigate(-1);next.onclick=()=>navigate(1);toggle.onclick=()=>{state.showPhraseSuggestions=!state.showPhraseSuggestions;paint();$('#engineState').textContent=`PHRASE SUGGESTIONS ${state.showPhraseSuggestions?'ON':'OFF'}`};const d=$('#tempoDouble');if(d)d.after(label,prev,toggle,next);else $('.modebar')?.append(label,prev,toggle,next);paint()
}
function markerSignature(track){const ms=track.markers||[];let sum=0,weighted=0;for(let i=0;i<ms.length;i++){const v=Number(ms[i].targetTime)||0;sum+=v;weighted+=v*(i+1)}return`${ms.length}|${sum.toFixed(3)}|${weighted.toFixed(3)}`}
let last='';setInterval(()=>{install();const sig=`${Number(state.viewDuration||0).toFixed(2)}|${state.tracks.map(t=>`${Number(t.timelineOffset||0).toFixed(3)}:${markerSignature(t)}:${analysisSignature(t)}`).join(';')}`;if(sig!==last){last=sig;paint()}},350);
window.addEventListener('resize',()=>setTimeout(paint,0));window.addEventListener('phase:meter-change',()=>{cache.clear();setTimeout(paint,0)});window.addEventListener('phase:project-applied',()=>{cache.clear();setTimeout(paint,0)});window.addEventListener('phase:history-applied',()=>setTimeout(paint,0));
install();paint();
