import{state,$,$$}from'./state.js';
import{regionFromDrag,normalizeRegion}from'./region-model.js';

state.regionStart=Number.isFinite(Number(state.regionStart))?Math.max(0,Number(state.regionStart)):null;
state.regionEnd=Number.isFinite(Number(state.regionEnd))?Math.max(0,Number(state.regionEnd)):null;

const style=document.createElement('style');style.textContent=`
.region-band{position:absolute;top:0;bottom:0;background:rgba(198,166,107,.075);border-left:2px solid rgba(198,166,107,.72);border-right:2px solid rgba(102,181,168,.72);pointer-events:none;z-index:2}
.ruler-lines>.region-band{background:rgba(198,166,107,.12);z-index:3}
.region-band .region-label{position:absolute;top:2px;left:5px;padding:1px 4px;border-radius:3px;background:#0d1319;color:#d8c28f;font:700 8px ui-monospace,monospace;white-space:nowrap}
.lane.region-ready{cursor:crosshair}
.region-meta{font:8px ui-monospace,monospace;color:#b6a778;white-space:nowrap}
`;
document.head.appendChild(style);

const fmt=t=>{const m=Math.floor(Math.max(0,t)/60),s=Math.max(0,t)-m*60;return`${m}:${s.toFixed(2).padStart(5,'0')}`};
const current=()=>normalizeRegion(state.regionStart,state.regionEnd,state.viewDuration);

function ensureBands(){
  const hosts=[$('.ruler-lines'),...$$('.lane')].filter(Boolean);
  hosts.forEach((host,i)=>{let b=host.querySelector(':scope > .region-band');if(!b){b=document.createElement('div');b.className='region-band';if(i===0){const label=document.createElement('span');label.className='region-label';b.appendChild(label)}host.appendChild(b)}});
}
function paint(){
  ensureBands();const r=current(),view=Math.max(1,state.viewDuration||60),show=!!r;
  $$('.region-band').forEach(b=>{b.style.display=show?'block':'none';if(show){b.style.left=`${r.start/view*100}%`;b.style.width=`${r.duration/view*100}%`;const label=b.querySelector('.region-label');if(label)label.textContent=`REGION ${fmt(r.start)} → ${fmt(r.end)}`}});
  const meta=$('#regionMeta');if(meta)meta.textContent=r?`${fmt(r.start)} → ${fmt(r.end)} · ${r.duration.toFixed(2)}s`:'NO REGION';
  $$('.lane').forEach(l=>l.classList.toggle('region-ready',state.mode==='region'));
}
function setRegion(r){state.regionStart=r?.start??null;state.regionEnd=r?.end??null;paint();window.dispatchEvent(new CustomEvent('phase:region-change',{detail:r||null}))}
function clearRegion(){setRegion(null);$('#engineState').textContent='REGION CLEARED'}
function regionToLoop(){const r=current();if(!r){$('#engineState').textContent='SELECT A REGION FIRST';return}state.loopStart=r.start;state.loopEnd=r.end;state.loopEnabled=true;state.playheadTime=r.start;window.dispatchEvent(new Event('resize'));$('#engineState').textContent=`REGION → LOOP · ${fmt(r.start)} → ${fmt(r.end)}`}
function activateRegion(){state.mode='region';$$('.mode[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='region'));paint();$('#engineState').textContent='REGION TOOL · DRAG TIMELINE · SHIFT FOR FREE'}

function installControls(){
  if(!$('.mode[data-mode="region"]')){const b=document.createElement('button');b.className='mode';b.dataset.mode='region';b.textContent='REGION';b.title='Drag a project range; follows current snap, Shift for free';const move=$('.mode[data-mode="move"]')||$('.mode[data-mode="anchor"]');move.after(b);b.onclick=activateRegion}
  if(!$('#regionToLoop')){const label=document.createElement('span');label.className='label section';label.textContent='REGION';const meta=document.createElement('span');meta.className='region-meta';meta.id='regionMeta';const loop=document.createElement('button'),clear=document.createElement('button');loop.className=clear.className='mode';loop.id='regionToLoop';clear.id='clearRegion';loop.textContent='→ LOOP';clear.textContent='CLEAR';loop.title='Use selected region as the audition loop';clear.title='Clear arrangement region';$('.modebar').append(label,meta,loop,clear);loop.onclick=regionToLoop;clear.onclick=clearRegion}
  paint();
}

function bindLane(lane){if(lane.dataset.regionBound)return;lane.dataset.regionBound='1';lane.addEventListener('mousedown',e=>{
  if(state.mode!=='region'||e.button!==0)return;
  e.preventDefault();e.stopImmediatePropagation();const rect=lane.getBoundingClientRect(),view=Math.max(1,state.viewDuration||60),at=ev=>Math.max(0,Math.min(view,(ev.clientX-rect.left)/rect.width*view)),anchor=at(e);
  let latest=null;const update=ev=>{latest=regionFromDrag(anchor,at(ev),{viewDuration:view,bpm:state.bpm,snapMode:state.snapMode||'beat',beatsPerBar:state.beatsPerBar||4,free:ev.shiftKey});setRegion(latest);$('#engineState').textContent=latest?`REGION · ${fmt(latest.start)} → ${fmt(latest.end)}${ev.shiftKey?' · FREE':' · SNAP '+String(state.snapMode||'beat').toUpperCase()} · ${state.meter||'4/4'}`:'REGION · DRAG FARTHER'};
  update(e);const move=ev=>update(ev),up=ev=>{update(ev);window.removeEventListener('mousemove',move,true);window.removeEventListener('mouseup',up,true);if(latest)$('#engineState').textContent=`REGION SET · ${fmt(latest.start)} → ${fmt(latest.end)} · ${latest.duration.toFixed(2)}s`};window.addEventListener('mousemove',move,true);window.addEventListener('mouseup',up,true);
},true)}
function bindAll(){installControls();$$('.lane').forEach(bindLane);paint()}

window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='KeyR'){e.preventDefault();activateRegion()}if(e.code==='Escape'&&state.mode==='region'){state.mode='select';$$('.mode[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='select'));paint()}});
window.addEventListener('resize',bindAll);window.addEventListener('phase:project-applied',()=>setTimeout(bindAll,0));window.addEventListener('phase:history-applied',()=>setTimeout(bindAll,0));window.addEventListener('phase:meter-change',()=>setTimeout(paint,0));
bindAll();
