import{state,$,markCurrent,markPreviewRendering,markPreviewCurrent}from'./state.js';
import{ensureAudio,stopAudio}from'./audio.js';
import{projectPlaybackWindow}from'./transport-model.js';
import{cancelActiveRender}from'./render.js';
import{stemSourcesNeedRender,stemSourcesHaveCurrentAudio,renderTrackSources,clearInactiveRenderState,sourceRenderStats,usingStemSources}from'./stem-render.js';
import{dbToGain,eligibleTracks,playbackParts,exportItemsForTracks}from'./source-model.js';
import{estimateRenderPeakBytes,classifyResourceUse}from'./resource-preflight.js';
import{renderMix,downloadWav}from'./export.js';
import{firstDownbeatIndex}from'./arrangement.js';
import{applyGainEnvelope}from'./fade-model.js';
import{trackHasPlayableAudio}from'./stems.js';
export{dbToGain};

const PREVIEW_DELAY_MS=700,PREVIEW_QUALITY='fast';
let previewTimer=0,previewToken=0,previewPromise=null;
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
function abortError(){const e=new Error('Preview superseded');e.name='AbortError';return e}
function syncCheapPlacement(){for(const t of state.tracks)if(t.buffer)t.renderedOffset=t.timelineOffset||0}
function clearPreviewTimer(){if(previewTimer){clearTimeout(previewTimer);previewTimer=0}}
function supersedePreview(){clearPreviewTimer();previewToken++;if(state.previewRendering)cancelActiveRender();state.previewRendering=false}
function previewMemorySafe(){const estimate=estimateRenderPeakBytes(state),classification=classifyResourceUse(estimate,{deviceMemoryGB:Number(navigator.deviceMemory)||null});if(classification.level==='ok')return true;state.previewRendering=false;state.previewCurrent=false;const status=$('#renderState');if(status)status.textContent='EDIT LIVE · AUTO PREVIEW PAUSED · MEMORY CAUTION';$('#engineState').textContent='AUTO PREVIEW PAUSED · MEMORY CAUTION · USE RENDER FINAL WHEN READY';return false}

function playMix(){
  if(state.playing){stopAudio();resetTransport();return false}const tracks=eligible();if(!tracks.length)return false;const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks)for(const part of playbackParts(t)){const buffer=part.buffer,offset=part.offset,w=projectPlaybackWindow(offset,buffer.duration,0,Infinity,t.trimIn||0,t.trimOut==null?buffer.duration:t.trimOut);if(!w)continue;const src=ctx.createBufferSource(),gain=ctx.createGain(),baseGain=.82*dbToGain(t.gainDb)*part.gain/Math.sqrt(Math.max(1,tracks.length));src.buffer=buffer;applyGainEnvelope(gain.gain,baseGain,fadeItem(t,offset),w.projectStart,w.projectEnd,base+w.delay);src.connect(gain).connect(ctx.destination);src.start(base+w.delay,w.sourceOffset,w.duration);state.sources.push(src);if(w.projectEnd>lastEnd){lastEnd=w.projectEnd;last=src}}
  if(!state.sources.length)return false;state.playing=true;$('#play').textContent='❚❚ STOP';if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport()}};return true
}

function alignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
async function auditionMix(seconds=12){
  if(state.rendering)return false;if(state.dirty&&!state.previewCurrent)await makeAudioPreviewCurrent({immediate:true});if(state.dirty&&!state.previewCurrent){$('#engineState').textContent='AUDITION WAITING FOR AUDIO PREVIEW OR FINAL RENDER';return false}const a=state.tracks[0];if(!a.buffer||!a.markers.length)return false;const tracks=eligible();if(!tracks.length)return false;const ai=alignIndex(a),center=(a.renderedOffset??a.timelineOffset??0)+(a.markers[ai]?.targetTime||0),start=Math.max(0,center-4),end=start+seconds;stopAudio();const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks)for(const part of playbackParts(t)){const buffer=part.buffer,offset=part.offset,w=projectPlaybackWindow(offset,buffer.duration,start,end,t.trimIn||0,t.trimOut==null?buffer.duration:t.trimOut);if(!w)continue;const src=ctx.createBufferSource(),gain=ctx.createGain(),baseGain=.82*dbToGain(t.gainDb)*part.gain/Math.sqrt(Math.max(1,tracks.length));src.buffer=buffer;applyGainEnvelope(gain.gain,baseGain,fadeItem(t,offset),w.projectStart,w.projectEnd,base+w.delay);src.connect(gain).connect(ctx.destination);src.start(base+w.delay,w.sourceOffset,w.duration);state.sources.push(src);if(w.delay+w.duration>lastEnd){lastEnd=w.delay+w.duration;last=src}}
  if(!state.sources.length)return false;state.playing=true;$('#auditionAlign').textContent='■ STOP AUDITION';$('#engineState').textContent=`AUDITION · ${start.toFixed(2)}s → ${end.toFixed(2)}s${state.dirty?' · PREVIEW':''}`;if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport();$('#engineState').textContent='AUDITION COMPLETE'}};return true
}

function statsText(tracks){const stats=tracks.flatMap(sourceRenderStats).filter(s=>s&&Number.isFinite(s.totalGrains)&&s.totalGrains>0);if(!stats.length)return'PLACEMENT / DIRECT PCM';const processed=stats.reduce((n,s)=>n+(s.processedGrains||0),0),total=stats.reduce((n,s)=>n+(s.totalGrains||0),0),pct=total?Math.round(processed/total*100):0,quality=String(stats[0].quality||'balanced').toUpperCase(),reused=stats.every(s=>s.reused);return`${quality} · ${reused?'REUSED RENDER':'DSP '+pct+'% OF GRAIN WORK'}`}

export async function makeAudioPreviewCurrent({immediate=false}={}){
  clearPreviewTimer();if(!state.dirty||state.rendering)return false;syncCheapPlacement();const revision=state.dirtyRevision||0;
  if(state.previewCurrent)return true;
  if(state.previewRendering&&previewPromise)return previewPromise;
  const loaded=state.tracks.filter(t=>t.buffer);if(!loaded.length)return false;
  const needs=loaded.filter(t=>!stemSourcesHaveCurrentAudio(t));
  if(!needs.length){markPreviewCurrent();$('#engineState').textContent='AUDIO PREVIEW CURRENT · REUSED EXISTING AUDIO · FINAL RENDER AVAILABLE';return true}
  if(!previewMemorySafe())return false;
  const token=++previewToken;markPreviewRendering();$('#engineState').textContent=`AUDIO PREVIEW · ${PREVIEW_QUALITY.toUpperCase()}${immediate?' · PRIORITY':''}`;
  previewPromise=(async()=>{
    try{
      let done=0;
      for(const t of loaded){
        if(token!==previewToken||revision!==state.dirtyRevision)throw abortError();
        if(stemSourcesHaveCurrentAudio(t)){t.renderedOffset=t.timelineOffset||0;continue}
        if(!stemSourcesNeedRender(t,PREVIEW_QUALITY)){clearInactiveRenderState(t);t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();done++;continue}
        const out=await renderTrackSources(t,p=>{if(token===previewToken&&revision===state.dirtyRevision)$('#engineState').textContent=`AUDIO PREVIEW ${t.label}${usingStemSources(t)?' STEMS':''} · ${Math.round(p*100)}% · ${done+1}/${needs.length}`},{quality:PREVIEW_QUALITY});
        if(token!==previewToken||revision!==state.dirtyRevision)throw abortError();if(!usingStemSources(t))t.renderedBuffer=out;t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();done++;
      }
      if(token!==previewToken||revision!==state.dirtyRevision)throw abortError();markPreviewCurrent();window.dispatchEvent(new Event('resize'));$('#engineState').textContent=`AUDIO PREVIEW CURRENT · FAST · ${statsText(loaded)} · FINAL RENDER AVAILABLE`;return true;
    }catch(err){if(err?.name!=='AbortError'){console.error(err);$('#engineState').textContent='AUDIO PREVIEW FAILED · FINAL RENDER STILL AVAILABLE'}return false}
    finally{if(token===previewToken)state.previewRendering=false;previewPromise=null}
  })();
  return previewPromise;
}

function queueAudioPreview(){
  syncCheapPlacement();clearPreviewTimer();if(!state.dirty||state.rendering)return;if(state.previewRendering){previewToken++;cancelActiveRender();state.previewRendering=false}
  const revision=state.dirtyRevision;previewTimer=setTimeout(()=>{previewTimer=0;if(state.dirty&&revision===state.dirtyRevision&&!state.rendering)makeAudioPreviewCurrent()},PREVIEW_DELAY_MS);
}

export async function makeAudioCurrent(){
  if(state.rendering)return;if(!state.dirty){$('#engineState').textContent='AUDIO CURRENT';return}supersedePreview();if(previewPromise){try{await previewPromise}catch{}}const loaded=state.tracks.filter(t=>t.buffer);if(!loaded.length)return;
  stopAudio();state.rendering=true;state.previewRendering=false;const render=$('#render');render.disabled=false;render.textContent='■ CANCEL FINAL RENDER';$('#engineState').textContent='PREPARING FINAL AUDIO…';
  try{
    let done=0,work=loaded.filter(t=>stemSourcesNeedRender(t));
    for(const t of loaded){
      if(!stemSourcesNeedRender(t)){clearInactiveRenderState(t);t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();continue}
      const out=await renderTrackSources(t,p=>{$('#engineState').textContent=`FINAL RENDER ${t.label}${usingStemSources(t)?' STEMS':''} · ${Math.round(p*100)}% · ${done+1}/${Math.max(1,work.length)}`});if(!usingStemSources(t))t.renderedBuffer=out;t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();done++;
    }
    markCurrent();window.dispatchEvent(new Event('resize'));$('#engineState').textContent=`AUDIO CURRENT · ${statsText(loaded)}`;
  }catch(err){if(err?.name==='AbortError'){$('#engineState').textContent='FINAL RENDER CANCELLED · AUDIO PREVIEW REMAINS AVAILABLE';return}console.error(err);$('#engineState').textContent='FINAL RENDER FAILED';alert('Render failed: '+(err?.message||err))}
  finally{state.rendering=false;render.disabled=false;render.textContent=state.dirty?'⚡ RENDER FINAL':'⚡ RENDER CHANGES'}
}

async function exportMix(){if(state.rendering)return;if(state.dirty)await makeAudioCurrent();if(state.dirty||state.rendering)return;const tracks=state.tracks.filter(trackHasPlayableAudio),items=exportItemsForTracks(tracks);if(!items.length)return alert('Load audio first.');const btn=$('#exportWav');btn.disabled=true;$('#engineState').textContent='MIXING WAV…';try{const mix=await renderMix(items,44100);downloadWav(mix,'phase-mix.wav');$('#engineState').textContent='WAV EXPORTED · FINAL AUDIO + STEMS + TRIMS + FADES APPLIED'}catch(err){console.error(err);$('#engineState').textContent='EXPORT FAILED';alert('Export failed: '+(err.message||err))}finally{btn.disabled=false}}

ensureAuditionButton();addMixControls();
if($('#play'))$('#play').onclick=playMix;
if($('#auditionAlign'))$('#auditionAlign').onclick=()=>{if(state.playing){stopAudio();resetTransport();return}auditionMix()};
if($('#stop'))$('#stop').onclick=()=>{stopAudio();resetTransport()};
if($('#render'))$('#render').onclick=()=>{if(state.rendering){cancelActiveRender();return}makeAudioCurrent()};
if($('#exportWav'))$('#exportWav').onclick=exportMix;
window.addEventListener('phase:render-dirty',queueAudioPreview);
window.addEventListener('resize',()=>{ensureAuditionButton();addMixControls()});
