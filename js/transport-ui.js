import{state,$,$$}from'./state.js';
import{ensureAudio,stopAudio}from'./audio.js';
import{projectPlaybackWindow,phraseLoopAt,clampPlayhead}from'./transport-model.js';

const dbToGain=db=>Math.pow(10,(Number(db)||0)/20);
state.playheadTime=Number.isFinite(state.playheadTime)?state.playheadTime:0;
state.loopBars=Number.isFinite(state.loopBars)?state.loopBars:8;
state.loopEnabled=!!state.loopEnabled;
state.loopStart=Number.isFinite(state.loopStart)?state.loopStart:0;
state.loopEnd=Number.isFinite(state.loopEnd)?state.loopEnd:0;
state.transportActive=false;

const style=document.createElement('style');style.textContent=`
.transport-time{min-width:70px;padding:0 7px;font:11px ui-monospace,monospace;color:#b8c3ca;text-align:center}
.transport-playhead{position:absolute;top:0;bottom:0;width:1px;background:#c6a66b;pointer-events:none;z-index:7;box-shadow:0 0 0 1px rgba(198,166,107,.08)}
.ruler-lines .transport-playhead{width:2px;background:#d4b675}
.loop-band{position:absolute;top:0;bottom:0;background:rgba(102,181,168,.035);border-left:1px solid rgba(102,181,168,.32);border-right:1px solid rgba(102,181,168,.32);pointer-events:none;z-index:1}
.ruler-lines .loop-band{background:rgba(102,181,168,.08);z-index:1}
.loop-toggle.active{border-color:#66b5a8!important;background:#1d302d!important;color:#d8eee8!important}
`;
document.head.appendChild(style);

let token=0,baseCtx=0,baseProject=0,playLimit=Infinity;

function fmtTime(t){const m=Math.floor(Math.max(0,t)/60),s=Math.max(0,t)-m*60;return`${m}:${s.toFixed(2).padStart(5,'0')}`}
function eligible(){const solo=state.tracks.some(t=>t.solo);return state.tracks.filter(t=>(t.renderedBuffer||t.buffer)&&!t.mute&&(!solo||t.solo))}
function trackStart(t){return Number.isFinite(t.renderedOffset)?t.renderedOffset:0}

function updateReadout(){const el=$('#transportTime');if(el)el.textContent=fmtTime(state.playheadTime);const loop=$('#loopToggle');if(loop){loop.classList.toggle('active',state.loopEnabled);loop.textContent=state.loopEnabled?'LOOP ON':'LOOP OFF'}const size=$('#loopBars');if(size)size.value=String(state.loopBars||8)}
function ensureVisuals(){
  const hosts=[$('.ruler-lines'),...$$('.lane')].filter(Boolean);
  hosts.forEach(host=>{
    let p=host.querySelector(':scope > .transport-playhead');if(!p){p=document.createElement('div');p.className='transport-playhead';host.appendChild(p)}
    let b=host.querySelector(':scope > .loop-band');if(!b){b=document.createElement('div');b.className='loop-band';host.appendChild(b)}
  });
}
function paintVisuals(){
  ensureVisuals();const view=Math.max(1,state.viewDuration||60),left=`${clampPlayhead(state.playheadTime,view)/view*100}%`;
  $$('.transport-playhead').forEach(p=>p.style.left=left);
  const start=Math.max(0,state.loopStart||0),end=Math.max(start,state.loopEnd||0),show=state.loopEnabled&&end>start;
  $$('.loop-band').forEach(b=>{b.style.display=show?'block':'none';if(show){b.style.left=`${start/view*100}%`;b.style.width=`${Math.max(0,end-start)/view*100}%`}});
  updateReadout();
}
function setPlayhead(time,{scroll=false}={}){
  state.playheadTime=clampPlayhead(time,state.viewDuration);paintVisuals();
  if(scroll){const line=$('#lane-0 .transport-playhead'),timeline=$('#timeline');if(line&&timeline){const r=line.getBoundingClientRect(),tr=timeline.getBoundingClientRect();if(r.left>tr.right-90)timeline.scrollLeft+=timeline.clientWidth*.55;else if(r.left<tr.left+170)timeline.scrollLeft=Math.max(0,timeline.scrollLeft-timeline.clientWidth*.55)}}
}

function resetButtons(){const p=$('#play');if(p)p.textContent='▶ PLAY'}
function stopTransport({keep=true}={}){
  if(state.transportActive&&keep&&state.playing&&state.audioCtx){const now=Math.max(0,state.audioCtx.currentTime-baseCtx);setPlayhead(Math.min(Number.isFinite(playLimit)?playLimit:state.viewDuration,baseProject+now))}
  token++;state.transportActive=false;stopAudio();resetButtons();
}

function schedule(from,to=Infinity){
  stopTransport({keep:false});const tracks=eligible();if(!tracks.length)return false;
  const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const my=++token,base=ctx.currentTime+.025;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks){
    const buffer=t.renderedBuffer||t.buffer,w=projectPlaybackWindow(trackStart(t),buffer.duration,from,to);if(!w)continue;
    const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=.82*dbToGain(t.gainDb)/Math.sqrt(Math.max(1,tracks.length));src.connect(gain).connect(ctx.destination);src.start(base+w.delay,w.sourceOffset,w.duration);state.sources.push(src);
    const end=w.delay+w.duration;if(end>lastEnd){lastEnd=end;last=src}
  }
  if(!state.sources.length)return false;
  state.playing=true;state.transportActive=true;baseCtx=base;baseProject=from;playLimit=to;setPlayhead(from);$('#play').textContent='❚❚ STOP';
  $('#engineState').textContent=`PLAYING FROM ${fmtTime(from)}${state.dirty?' · LAST RENDER':''}${state.loopEnabled?' · LOOP':''}`;
  if(last)last.onended=()=>{if(my!==token||!state.transportActive)return;if(state.loopEnabled){setPlayhead(state.loopStart);schedule(state.loopStart,state.loopEnd)}else{state.transportActive=false;state.playing=false;setPlayhead(Number.isFinite(to)?to:Math.min(state.viewDuration,from+lastEnd));resetButtons();$('#engineState').textContent='PLAYBACK STOPPED'}};
  return true;
}

function playFromPlayhead(){
  if(state.playing){stopTransport();return false}
  let from=clampPlayhead(state.playheadTime,state.viewDuration);if(from>=state.viewDuration-.01)from=0;
  if(state.loopEnabled){if(from<state.loopStart||from>=state.loopEnd)from=state.loopStart;return schedule(from,state.loopEnd)}
  return schedule(from,Infinity);
}

function recalcLoop(){
  const r=phraseLoopAt(state.playheadTime,state.bpm,state.loopBars);state.loopStart=r.start;state.loopEnd=r.end;if(state.loopEnd>state.viewDuration){state.viewDuration=state.loopEnd*1.02;window.dispatchEvent(new Event('resize'))}paintVisuals();
}
function toggleLoop(){state.loopEnabled=!state.loopEnabled;if(state.loopEnabled)recalcLoop();paintVisuals();$('#engineState').textContent=`LOOP ${state.loopEnabled?'ON':'OFF'}${state.loopEnabled?` · ${state.loopBars} BARS`:''}`}

function installControls(){
  if(!$('#rewindPhase')){const b=document.createElement('button');b.className='btn';b.id='rewindPhase';b.textContent='|◀';b.title='Return playhead to project start';$('.transport').prepend(b);b.onclick=()=>{const was=state.transportActive;stopTransport({keep:false});setPlayhead(0);if(was)schedule(0,state.loopEnabled?state.loopEnd:Infinity)}}
  if(!$('#transportTime')){const t=document.createElement('span');t.className='transport-time';t.id='transportTime';$('#stop').after(t)}
  if(!$('#loopToggle')){
    const label=document.createElement('span');label.className='label section';label.textContent='AUDITION';
    const toggle=document.createElement('button');toggle.className='mode loop-toggle';toggle.id='loopToggle';toggle.textContent='LOOP OFF';
    const size=document.createElement('select');size.className='snap-select';size.id='loopBars';size.innerHTML='<option value="4">4 BARS</option><option value="8">8 BARS</option><option value="16">16 BARS</option><option value="32">32 BARS</option>';size.value=String(state.loopBars);
    $('.modebar').append(label,toggle,size);toggle.onclick=toggleLoop;size.onchange=()=>{state.loopBars=+size.value||8;if(state.loopEnabled)recalcLoop();$('#engineState').textContent=`LOOP SIZE · ${state.loopBars} BARS`};
  }
  $('#play').onclick=playFromPlayhead;$('#stop').onclick=()=>stopTransport();paintVisuals();
}

function bindRuler(){const ruler=$('.ruler-lines');if(!ruler||ruler.dataset.seekBound)return;ruler.dataset.seekBound='1';ruler.addEventListener('mousedown',e=>{
  if(e.button!==0)return;e.preventDefault();const was=state.transportActive;stopTransport({keep:false});const rect=ruler.getBoundingClientRect();
  const seek=ev=>setPlayhead((ev.clientX-rect.left)/rect.width*state.viewDuration);
  seek(e);const move=ev=>seek(ev),up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);if(was)playFromPlayhead()};window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
})}

window.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea'))return;
  if(e.code==='Home'){e.preventDefault();const was=state.transportActive;stopTransport({keep:false});setPlayhead(0);if(was)playFromPlayhead()}
  if(e.code==='KeyL'){e.preventDefault();toggleLoop()}
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();const beat=60/Math.max(1,state.bpm),dir=e.code==='ArrowRight'?1:-1,was=state.transportActive;stopTransport({keep:false});setPlayhead(state.playheadTime+dir*beat);if(state.loopEnabled)recalcLoop();if(was)playFromPlayhead()}
});

function restoreTransport(){installControls();bindRuler();if(state.loopEnabled)recalcLoop();else paintVisuals()}
function tick(){
  if(state.transportActive&&state.playing&&state.audioCtx){const elapsed=Math.max(0,state.audioCtx.currentTime-baseCtx),next=baseProject+elapsed;if(Number.isFinite(playLimit)&&next>=playLimit)setPlayhead(playLimit,{scroll:true});else setPlayhead(next,{scroll:true})}
  else paintVisuals();requestAnimationFrame(tick);
}

installControls();bindRuler();window.addEventListener('resize',()=>{installControls();bindRuler();paintVisuals()});window.addEventListener('phase:project-applied',()=>setTimeout(restoreTransport,0));window.addEventListener('phase:history-applied',()=>setTimeout(restoreTransport,0));tick();
