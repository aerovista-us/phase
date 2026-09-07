import{state,$,$$}from'./state.js';
import{displayDuration}from'./warp.js';
import{normalizeRegion}from'./region-model.js';
import{regionOnTrack,normalizeFades}from'./fade-model.js';

for(const t of state.tracks)for(const key of['fadeInStart','fadeInEnd','fadeOutStart','fadeOutEnd'])t[key]=t[key]!=null&&Number.isFinite(Number(t[key]))?Number(t[key]):null;

const style=document.createElement('style');style.textContent=`
.fade-ramp{position:absolute;top:0;bottom:0;pointer-events:none;z-index:2;border-left:1px solid rgba(102,181,168,.5);border-right:1px solid rgba(198,166,107,.5)}
.fade-ramp.in{background:linear-gradient(90deg,rgba(4,7,10,.72),rgba(102,181,168,.035))}
.fade-ramp.out{background:linear-gradient(90deg,rgba(198,166,107,.025),rgba(4,7,10,.72))}
.fade-ramp span{position:absolute;top:5px;left:5px;padding:1px 3px;border-radius:3px;background:rgba(13,19,25,.88);font:700 8px ui-monospace,monospace;color:#9fd2c9;white-space:nowrap}
.fade-ramp.out span{color:#d8c28f}
.fade-track{font:8px ui-monospace,monospace;color:#a8b3ba;white-space:nowrap}
`;
document.head.appendChild(style);

function activeTrack(){return state.tracks[state.activeTrackId]||state.tracks[0]}
function currentRegion(){return normalizeRegion(state.regionStart,state.regionEnd,state.viewDuration)}
function localDuration(t){return Math.max(.001,displayDuration(t)||t.renderedBuffer?.duration||t.buffer?.duration||0)}
function fmt(t){return`${Math.max(0,Number(t)||0).toFixed(2)}s`}

function ensureRamp(lane,kind){let el=lane.querySelector(`:scope > .fade-ramp.${kind}`);if(!el){el=document.createElement('div');el.className=`fade-ramp ${kind}`;const s=document.createElement('span');s.textContent=kind==='in'?'FADE IN':'FADE OUT';el.appendChild(s);lane.appendChild(el)}return el}
function renderTrack(t){
  const lane=$(`#lane-${t.id}`);if(!lane)return;const view=Math.max(1,state.viewDuration||60),offset=Number(t.timelineOffset)||0,f=normalizeFades(t);
  for(const kind of['in','out']){const el=ensureRamp(lane,kind),s=kind==='in'?f.fadeInStart:f.fadeOutStart,e=kind==='in'?f.fadeInEnd:f.fadeOutEnd,show=s!=null&&e!=null&&e>s;el.style.display=show?'block':'none';if(show){el.style.left=`${(offset+s)/view*100}%`;el.style.width=`${(e-s)/view*100}%`}}
}
function renderAll(){state.tracks.forEach(t=>t.buffer&&renderTrack(t));const label=$('#fadeTrack');if(label)label.textContent=activeTrack()?.label||'TRACK'}

function rangeFor(t){const r=currentRegion();if(!r)return null;return regionOnTrack(t.timelineOffset||0,localDuration(t),r.start,r.end)}
function setFade(t,kind){
  if(!t?.buffer)return alert('Load audio first.');const r=rangeFor(t);if(!r){$('#engineState').textContent=`${t.label} DOES NOT OVERLAP REGION`;return false}
  if(kind==='in'){t.fadeInStart=r.start;t.fadeInEnd=r.end}else{t.fadeOutStart=r.start;t.fadeOutEnd=r.end}
  renderAll();window.dispatchEvent(new CustomEvent('phase:fade-change',{detail:{track:t.id,kind,range:r}}));$('#engineState').textContent=`${t.label} FADE ${kind.toUpperCase()} · ${fmt(r.duration)} · LIVE MIX`;return true
}
function crossfade(){
  const r=currentRegion();if(!r){$('#engineState').textContent='SELECT A REGION FIRST';return}const a=state.tracks[0],b=state.tracks[1],ar=rangeFor(a),br=rangeFor(b);if(!a.buffer||!b.buffer||!ar||!br){$('#engineState').textContent='CROSSFADE REGION MUST OVERLAP BOTH TRACKS';return}
  a.fadeOutStart=ar.start;a.fadeOutEnd=ar.end;b.fadeInStart=br.start;b.fadeInEnd=br.end;renderAll();window.dispatchEvent(new CustomEvent('phase:fade-change',{detail:{crossfade:true,region:r}}));$('#engineState').textContent=`CROSSFADE A → B · ${fmt(r.duration)} · LIVE MIX`
}
function clearFades(){const t=activeTrack();if(!t)return;for(const key of['fadeInStart','fadeInEnd','fadeOutStart','fadeOutEnd'])t[key]=null;renderAll();window.dispatchEvent(new CustomEvent('phase:fade-change',{detail:{track:t.id,clear:true}}));$('#engineState').textContent=`${t.label} FADES CLEARED`}

function install(){
  if($('#fadeIn'))return;const label=document.createElement('span');label.className='label section';label.textContent='FADE';const track=document.createElement('span');track.className='fade-track';track.id='fadeTrack';const fi=document.createElement('button'),fo=document.createElement('button'),xf=document.createElement('button'),cl=document.createElement('button');for(const b of[fi,fo,xf,cl])b.className='mode';fi.id='fadeIn';fo.id='fadeOut';xf.id='crossfade';cl.id='clearFades';fi.textContent='IN';fo.textContent='OUT';xf.textContent='A→B';cl.textContent='CLEAR';fi.title='Fade active track in across selected REGION';fo.title='Fade active track out across selected REGION';xf.title='Crossfade Track A out and Track B in across selected REGION';cl.title='Clear fades on active track';$('.modebar').append(label,track,fi,fo,xf,cl);fi.onclick=()=>setFade(activeTrack(),'in');fo.onclick=()=>setFade(activeTrack(),'out');xf.onclick=crossfade;cl.onclick=clearFades;renderAll()
}

document.addEventListener('click',e=>{if(e.target.closest?.('.marker,.lane,.track-head'))setTimeout(renderAll,0)},true);
window.addEventListener('resize',()=>{install();renderAll()});window.addEventListener('phase:region-change',renderAll);window.addEventListener('phase:project-applied',()=>setTimeout(renderAll,0));window.addEventListener('phase:history-applied',()=>setTimeout(renderAll,0));
install();renderAll();
