import{state,$,$$}from'./state.js';
import{displayDuration}from'./warp.js';

state.activeTrackId=Number.isInteger(state.activeTrackId)?state.activeTrackId:0;
for(const t of state.tracks){t.trimIn=Math.max(0,Number(t.trimIn)||0);t.trimOut=Number.isFinite(Number(t.trimOut))?Math.max(t.trimIn,Number(t.trimOut)):null}

const style=document.createElement('style');style.textContent=`
.track.active-track .track-head{box-shadow:inset 3px 0 0 #c6a66b}
.trim-mask{position:absolute;top:0;bottom:0;background:rgba(4,7,10,.58);pointer-events:none;z-index:1}
.trim-edge{position:absolute;top:0;bottom:0;width:2px;background:rgba(198,166,107,.78);pointer-events:none;z-index:2}
.trim-edge.out{background:rgba(102,181,168,.72)}
.markers{z-index:3}
.trim-readout{font:8px ui-monospace,monospace;color:#84939d;white-space:nowrap}
.trim-readout strong{color:#c4b382;font-weight:600}
`;
document.head.appendChild(style);

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function localDuration(t){return Math.max(.001,t?.renderedBuffer?.duration||displayDuration(t)||t?.buffer?.duration||0)}
function activeTrack(){const fromMarker=state.selected?.track;if(Number.isInteger(fromMarker)&&state.tracks[fromMarker])state.activeTrackId=fromMarker;return state.tracks[state.activeTrackId]||state.tracks[0]}
function fmt(t){const m=Math.floor(Math.max(0,t)/60),s=Math.max(0,t)-m*60;return`${m}:${s.toFixed(2).padStart(5,'0')}`}
function localAtPlayhead(t){return clamp((Number(state.playheadTime)||0)-(Number(t.timelineOffset)||0),0,localDuration(t))}

function ensureTrackDecor(t){
  const lane=$(`#lane-${t.id}`),head=$(`#name-${t.id}`)?.closest('.track-head');if(!lane||!head)return null;
  let before=lane.querySelector('.trim-mask.before');if(!before){before=document.createElement('div');before.className='trim-mask before';lane.appendChild(before)}
  let after=lane.querySelector('.trim-mask.after');if(!after){after=document.createElement('div');after.className='trim-mask after';lane.appendChild(after)}
  let edgeIn=lane.querySelector('.trim-edge.in');if(!edgeIn){edgeIn=document.createElement('div');edgeIn.className='trim-edge in';lane.appendChild(edgeIn)}
  let edgeOut=lane.querySelector('.trim-edge.out');if(!edgeOut){edgeOut=document.createElement('div');edgeOut.className='trim-edge out';lane.appendChild(edgeOut)}
  let read=head.querySelector('.trim-readout');if(!read){read=document.createElement('div');read.className='trim-readout';head.appendChild(read)}
  return{lane,before,after,edgeIn,edgeOut,read};
}

function renderTrim(t){
  const d=localDuration(t),ui=ensureTrackDecor(t);if(!ui)return;
  const view=Math.max(1,state.viewDuration||60),offset=Number(t.timelineOffset)||0,input=clamp(Number(t.trimIn)||0,0,d),output=t.trimOut==null?d:clamp(Number(t.trimOut),input,d);
  const trackStart=offset,trackEnd=offset+d,inGlobal=offset+input,outGlobal=offset+output;
  ui.before.style.left=`${trackStart/view*100}%`;ui.before.style.width=`${Math.max(0,input)/view*100}%`;
  ui.after.style.left=`${outGlobal/view*100}%`;ui.after.style.width=`${Math.max(0,trackEnd-outGlobal)/view*100}%`;
  ui.edgeIn.style.left=`${inGlobal/view*100}%`;ui.edgeIn.style.display=input>0.001?'block':'none';
  ui.edgeOut.style.left=`${outGlobal/view*100}%`;ui.edgeOut.style.display=output<d-.001?'block':'none';
  ui.read.innerHTML=`TRIM <strong>${fmt(input)}</strong> → <strong>${t.trimOut==null?'END':fmt(output)}</strong>`;
}
function renderAll(){state.tracks.forEach(t=>{const row=$(`#lane-${t.id}`)?.closest('.track');if(row)row.classList.toggle('active-track',t.id===state.activeTrackId);if(t.buffer)renderTrim(t)});updateButtons()}
function updateButtons(){const t=activeTrack(),label=$('#trimTrack');if(label)label.textContent=t?.label||'TRACK';}
function selectTrack(id){if(!state.tracks[id])return;state.activeTrackId=id;renderAll();$('#engineState').textContent=`ACTIVE · ${state.tracks[id].label}`}

function setIn(){
  const t=activeTrack();if(!t?.buffer)return alert('Load audio first.');const d=localDuration(t),local=localAtPlayhead(t),out=t.trimOut==null?d:clamp(t.trimOut,0,d);
  t.trimIn=Math.min(local,Math.max(0,out-.02));if(t.trimOut!=null&&t.trimOut<=t.trimIn+.019)t.trimOut=null;
  renderAll();$('#engineState').textContent=`${t.label} IN · ${fmt(t.trimIn)} · APPLIED`;
  window.dispatchEvent(new CustomEvent('phase:trim-change',{detail:{track:t.id}}));
}
function setOut(){
  const t=activeTrack();if(!t?.buffer)return alert('Load audio first.');const d=localDuration(t),local=localAtPlayhead(t),input=clamp(t.trimIn||0,0,d);
  if(local<=input+.02){$('#engineState').textContent=`${t.label} OUT MUST FOLLOW IN`;return}
  t.trimOut=local>=d-.02?null:local;renderAll();$('#engineState').textContent=`${t.label} OUT · ${t.trimOut==null?'END':fmt(t.trimOut)} · APPLIED`;
  window.dispatchEvent(new CustomEvent('phase:trim-change',{detail:{track:t.id}}));
}
function clearTrim(){const t=activeTrack();if(!t?.buffer)return;t.trimIn=0;t.trimOut=null;renderAll();$('#engineState').textContent=`${t.label} TRIM CLEARED`;window.dispatchEvent(new CustomEvent('phase:trim-change',{detail:{track:t.id}}))}

function installControls(){
  if($('#setTrimIn'))return;
  const label=document.createElement('span');label.className='label section';label.textContent='TRIM';
  const track=document.createElement('span');track.className='label';track.id='trimTrack';
  const i=document.createElement('button'),o=document.createElement('button'),c=document.createElement('button');i.className=o.className=c.className='mode';i.id='setTrimIn';o.id='setTrimOut';c.id='clearTrim';i.textContent='SET IN';o.textContent='SET OUT';c.textContent='CLEAR';i.title='Set selected track IN at playhead (I)';o.title='Set selected track OUT at playhead (O)';c.title='Clear selected track trim';
  $('.modebar').append(label,track,i,o,c);i.onclick=setIn;o.onclick=setOut;c.onclick=clearTrim;updateButtons();
}

function keyboardClick(id){const b=$(id);if(!b)return;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse'}));b.click()}
document.addEventListener('click',e=>{const marker=e.target.closest?.('.marker');if(marker){selectTrack(+marker.dataset.track);return}const lane=e.target.closest?.('.lane');if(lane&&state.mode==='select')selectTrack(+lane.id.replace('lane-',''));const head=e.target.closest?.('.track-head');if(head&&!e.target.closest('button,input,select')){const lane2=head.parentElement?.querySelector('.lane');if(lane2)selectTrack(+lane2.id.replace('lane-',''))}},true);
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='KeyI'){e.preventDefault();keyboardClick('#setTrimIn')}if(e.code==='KeyO'){e.preventDefault();keyboardClick('#setTrimOut')}});
window.addEventListener('resize',renderAll);window.addEventListener('phase:project-applied',()=>setTimeout(renderAll,0));window.addEventListener('phase:history-applied',()=>setTimeout(renderAll,0));
installControls();renderAll();
