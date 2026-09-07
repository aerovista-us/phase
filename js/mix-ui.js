import{state,$,markCurrent}from'./state.js';
import{ensureAudio,stopAudio}from'./audio.js';
import{projectPlaybackWindow}from'./transport-model.js';
import{cancelActiveRender}from'./render.js';
import{stemSourcesNeedRender,renderTrackSources,clearInactiveRenderState,sourceRenderStats,usingStemSources}from'./stem-render.js';
import{dbToGain,eligibleTracks,playbackParts,exportItemsForTracks}from'./source-model.js';
import{renderMix,downloadWav}from'./export.js';
import{firstDownbeatIndex}from'./arrangement.js';
import{applyGainEnvelope}from'./fade-model.js';
import{trackHasPlayableAudio}from'./stems.js';
export{dbToGain};

for(const t of state.tracks)t.gainDb=Number.isFinite(t.gainDb)?t.gainDb:0;

const style=document.createElement('style');style.textContent=`
.mix-row{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;margin-top:2px}
.mix-row input[type="range"]{width:100%;min-width:68px;accent-color:#66b5a8}
.mix-db{font:9px ui-monospace,monospace;color:#9eabb4;min-width:36px;text-align:right}
`;
document.head.appendChild(style);

function ensureAuditionButton(){if($('#auditionAlign'))return;const btn=document.createElement('button');btn.className='btn';btn.id='auditionAlign';btn.textContent='AUDITION ALIGN';btn.title='Play a short window around the chosen alignment point';$('#stop').after(btn)}
function addMixControls(){for(const t of state.tracks){const head=$(`#name-${t.id}`)?.closest('.track-head');if(!head||$(`#gain-${t.id}`))continue;const row=document.createElement('div');row.className='mix-row';row.innerHTML=`<span class="tiny-label">LEVEL</span><input id="gain-${t.id}" type="range" min="-24" max="6" step="0.5" value="${t.gainDb}"><span class="mix-db" id="gainDb-${t.id}">${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB</span>`;head.appendChild(row);const input=$(`#gain-${t.id}`);input.oninput=()=>{t.gainDb=+input.value;$(`#gainDb-${t.id}`).textContent=`${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB`;$('#engineState').textContent=`${t.label} LEVEL · ${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB`}}}

function eligible(){return eligibleTracks(state.tracks)}
function resetTransport(){const p=$('#play'),a=$('#auditionAlign');if(p)p.textContent='▶ PLAY';if(a)a.textContent='AUDITION ALIGN'}
function fadeItem(t,offset){return{offset,fadeInStart:t.fadeInStart,fadeInEnd:t.fadeInEnd,fadeOutStart:t.fadeOutStart,fadeOutEnd:t.fadeOutEnd}}

function playMix(){
  if(state.playing){stopAudio();resetTransport();return false}const tracks=eligible();if(!tracks.length)return false;const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks)for(const part of playbackParts(t)){const buffer=part.buffer,offset=part.offset,w=projectPlaybackWindow(offset,buffer.duration,0,Infinity,t.trimIn||0,t.trimOut==null?buffer.duration:t.trimOut);if(!w)continue;const src=ctx.createBufferSource(),gain=ctx.createGain(),baseGain=.82*dbToGain(t.gainDb)*part.gain/Math.sqrt(Math.max(1,tracks.length));src.buffer=buffer;applyGainEnvelope(gain.gain,baseGain,fadeItem(t,offset),w.projectStart,w.projectEnd,base+w.delay);src.connect(gain).connect(ctx.destination);src.start(base+w.delay,w.sourceOffset,w.duration);state.sources.push(src);if(w.projectEnd>lastEnd){lastEnd=w.projectEnd;last=src}}
  if(!state.sources.length)return false;state.playing=true;$('#play').textContent='❚❚ STOP';if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport()}};return true
}

function alignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
function auditionMix(seconds=12){
  if(state.rendering)return false;if(state.dirty){$('#engineState').textContent='AUDITION NEEDS CURRENT AUDIO · RENDER CHANGES FIRST';return false}const a=state.tracks[0];if(!a.buffer||!a.markers.length)return false;const tracks=eligible();if(!tracks.length)return false;const ai=alignIndex(a),center=(a.renderedOffset??a.timelineOffset??0)+(a.markers[ai]?.targetTime||0),start=Math.max(0,center-4),end=start+seconds;stopAudio();const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks)for(const part of playbackParts(t)){const buffer=part.buffer,offset=part.offset,w=projectPlaybackWindow(offset,buffer.duration,start,end,t.trimIn||0,t.trimOut==null?buffer.duration:t.trimOut);if(!w)continue;const src=ctx.createBufferSource(),gain=ctx.createGain(),baseGain=.82*dbToGain(t.gainDb)*part.gain/Math.sqrt(Math.max(1,tracks.length));src.buffer=buffer;applyGainEnvelope(gain.gain,baseGain,fadeItem(t,offset),w.projectStart,w.projectEnd,base+w.delay);src.connect(gain).connect(ctx.destination);src.start(base+w.delay,w.sourceOffset,w.duration);state.sources.push(src);if(w.delay+w.duration>lastEnd){lastEnd=w.delay+w.duration;last=src}}
  if(!state.sources.length)return false;state.playing=true;$('#auditionAlign').textContent='■ STOP AUDITION';$('#engineState').textContent=`AUDITION · ${start.toFixed(2)}s → ${end.toFixed(2)}s`;if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport();$('#engineState').textContent='AUDITION COMPLETE'}};return true
}

function statsText(tracks){const stats=tracks.flatMap(sourceRenderStats).filter(s=>s&&Number.isFinite(s.totalGrains)&&s.totalGrains>0);if(!stats.length)return'PLACEMENT / DIRECT PCM';const processed=stats.reduce((n,s)=>n+(s.processedGrains||0),0),total=stats.reduce((n,s)=>n+(s.totalGrains||0),0),pct=total?Math.round(processed/total*100):0,quality=String(stats[0].quality||'balanced').toUpperCase(),reused=stats.every(s=>s.reused);return`${quality} · ${reused?'REUSED RENDER':'DSP '+pct+'% OF GRAIN WORK'}`}

export async function makeAudioCurrent(){
  if(state.rendering)return;if(!state.dirty){$('#engineState').textContent='AUDIO CURRENT';return}const loaded=state.tracks.filter(t=>t.buffer);if(!loaded.length)return;
  stopAudio();state.rendering=true;const render=$('#render');render.disabled=false;render.textContent='■ CANCEL RENDER';$('#engineState').textContent='PREPARING MIX…';
  try{
    let done=0,work=loaded.filter(t=>stemSourcesNeedRender(t));
    for(const t of loaded){
      if(!stemSourcesNeedRender(t)){clearInactiveRenderState(t);t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();continue}
      const out=await renderTrackSources(t,p=>{$('#engineState').textContent=`RENDERING ${t.label}${usingStemSources(t)?' STEMS':''} · ${Math.round(p*100)}% · ${done+1}/${Math.max(1,work.length)}`});if(!usingStemSources(t))t.renderedBuffer=out;t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();done++;
    }
    markCurrent();window.dispatchEvent(new Event('resize'));$('#engineState').textContent=`AUDIO CURRENT · ${statsText(loaded)}`;
  }catch(err){if(err?.name==='AbortError'){$('#engineState').textContent='RENDER CANCELLED · VISUAL CHANGES STILL PENDING';return}console.error(err);$('#engineState').textContent='RENDER FAILED';alert('Render failed: '+(err?.message||err))}
  finally{state.rendering=false;render.disabled=false;render.textContent='⚡ RENDER CHANGES'}
}

async function exportMix(){if(state.rendering)return;if(state.dirty)await makeAudioCurrent();if(state.dirty||state.rendering)return;const tracks=state.tracks.filter(trackHasPlayableAudio),items=exportItemsForTracks(tracks);if(!items.length)return alert('Load audio first.');const btn=$('#exportWav');btn.disabled=true;$('#engineState').textContent='MIXING WAV…';try{const mix=await renderMix(items,44100);downloadWav(mix,'phase-mix.wav');$('#engineState').textContent='WAV EXPORTED · MIX + STEMS + TRIMS + FADES APPLIED'}catch(err){console.error(err);$('#engineState').textContent='EXPORT FAILED';alert('Export failed: '+(err.message||err))}finally{btn.disabled=false}}

ensureAuditionButton();addMixControls();
if($('#play'))$('#play').onclick=playMix;
if($('#auditionAlign'))$('#auditionAlign').onclick=()=>{if(state.playing){stopAudio();resetTransport();return}auditionMix()};
if($('#stop'))$('#stop').onclick=()=>{stopAudio();resetTransport()};
if($('#render'))$('#render').onclick=()=>{if(state.rendering){cancelActiveRender();return}makeAudioCurrent()};
if($('#exportWav'))$('#exportWav').onclick=exportMix;
window.addEventListener('resize',()=>{ensureAuditionButton();addMixControls()});
