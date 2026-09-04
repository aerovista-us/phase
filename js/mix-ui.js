import{state,$,$$,markCurrent}from'./state.js';
import{ensureAudio,stopAudio,playbackWindow}from'./audio.js';
import{trackNeedsRender,renderTrack}from'./render.js';
import{renderMix,downloadWav}from'./export.js';
import{firstDownbeatIndex}from'./arrangement.js';

export const dbToGain=db=>Math.pow(10,(Number(db)||0)/20);
for(const t of state.tracks)t.gainDb=Number.isFinite(t.gainDb)?t.gainDb:0;

const style=document.createElement('style');style.textContent=`
.mix-row{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;margin-top:2px}
.mix-row input[type="range"]{width:100%;min-width:68px;accent-color:#66b5a8}
.mix-db{font:9px ui-monospace,monospace;color:#9eabb4;min-width:36px;text-align:right}
`;
document.head.appendChild(style);

function addMixControls(){for(const t of state.tracks){const head=$(`#name-${t.id}`)?.closest('.track-head');if(!head||$(`#gain-${t.id}`))continue;const row=document.createElement('div');row.className='mix-row';row.innerHTML=`<span class="tiny-label">LEVEL</span><input id="gain-${t.id}" type="range" min="-24" max="6" step="0.5" value="${t.gainDb}"><span class="mix-db" id="gainDb-${t.id}">${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB</span>`;head.appendChild(row);const input=$(`#gain-${t.id}`);input.oninput=()=>{t.gainDb=+input.value;$(`#gainDb-${t.id}`).textContent=`${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB`;$('#engineState').textContent=`${t.label} LEVEL · ${t.gainDb>=0?'+':''}${t.gainDb.toFixed(1)} dB`}}}

function eligible(){const solo=state.tracks.some(t=>t.solo);return state.tracks.filter(t=>(t.renderedBuffer||t.buffer)&&!t.mute&&(!solo||t.solo))}
function resetTransport(){const p=$('#play'),a=$('#auditionAlign');if(p)p.textContent='▶ PLAY';if(a)a.textContent='AUDITION ALIGN'}

function playMix(){if(state.playing){stopAudio();resetTransport();return false}const tracks=eligible();if(!tracks.length)return false;const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;for(const t of tracks){const buffer=t.renderedBuffer||t.buffer,w=playbackWindow(t.renderedOffset??0,buffer.duration);if(w.remaining<=0)continue;const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=.82*dbToGain(t.gainDb)/Math.sqrt(Math.max(1,tracks.length));src.connect(gain).connect(ctx.destination);src.start(base+w.start,w.sourceOffset,w.remaining);state.sources.push(src);if(w.end>lastEnd){lastEnd=w.end;last=src}}if(!state.sources.length)return false;state.playing=true;$('#play').textContent='❚❚ STOP';if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport()}};return true}

function alignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
function auditionMix(seconds=12){if(state.rendering)return false;if(state.dirty){$('#engineState').textContent='AUDITION NEEDS CURRENT AUDIO · RENDER CHANGES FIRST';return false}const a=state.tracks[0];if(!a.buffer||!a.markers.length)return false;const tracks=eligible();if(!tracks.length)return false;const ai=alignIndex(a),center=(a.renderedOffset??a.timelineOffset??0)+(a.markers[ai]?.targetTime||0),start=Math.max(0,center-4),end=start+seconds;stopAudio();const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;for(const t of tracks){const buffer=t.renderedBuffer||t.buffer,trackStart=t.renderedOffset??0,trackEnd=trackStart+buffer.duration,o0=Math.max(start,trackStart),o1=Math.min(end,trackEnd);if(o1<=o0)continue;const delay=o0-start,srcOffset=o0-trackStart,duration=o1-o0,src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=.82*dbToGain(t.gainDb)/Math.sqrt(Math.max(1,tracks.length));src.connect(gain).connect(ctx.destination);src.start(base+delay,srcOffset,duration);state.sources.push(src);if(delay+duration>lastEnd){lastEnd=delay+duration;last=src}}if(!state.sources.length)return false;state.playing=true;$('#auditionAlign').textContent='■ STOP AUDITION';$('#engineState').textContent=`AUDITION · ${start.toFixed(2)}s → ${end.toFixed(2)}s`;if(last)last.onended=()=>{if(state.playing){stopAudio();resetTransport();$('#engineState').textContent='AUDITION COMPLETE'}};return true}

export async function makeAudioCurrent(){if(!state.dirty)return;const loaded=state.tracks.filter(t=>t.buffer);if(!loaded.length)return;stopAudio();state.rendering=true;$('#render').disabled=true;$('#engineState').textContent='PREPARING MIX…';try{let done=0,work=loaded.filter(trackNeedsRender);for(const t of loaded){if(!trackNeedsRender(t)){t.renderedBuffer=null;t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();continue}t.renderedBuffer=await renderTrack(t,p=>{$('#engineState').textContent=`RENDERING ${t.label} · ${Math.round(p*100)}% · ${done+1}/${work.length}`});t.renderedOffset=t.timelineOffset||0;t.renderedAt=Date.now();done++}markCurrent();window.dispatchEvent(new Event('resize'));$('#engineState').textContent='AUDIO CURRENT · MIX READY'}finally{state.rendering=false;$('#render').disabled=false}}

async function exportMix(){if(state.rendering)return;if(state.dirty)await makeAudioCurrent();const items=state.tracks.filter(t=>t.renderedBuffer||t.buffer).map(t=>({buffer:t.renderedBuffer||t.buffer,offset:t.renderedOffset||0,gain:dbToGain(t.gainDb)}));if(!items.length)return alert('Load audio first.');const btn=$('#exportWav');btn.disabled=true;$('#engineState').textContent='MIXING WAV…';try{const mix=await renderMix(items,44100);downloadWav(mix,'phase-mix.wav');$('#engineState').textContent='WAV EXPORTED · MIX LEVELS APPLIED'}catch(err){console.error(err);$('#engineState').textContent='EXPORT FAILED';alert('Export failed: '+(err.message||err))}finally{btn.disabled=false}}

addMixControls();
if($('#play'))$('#play').onclick=playMix;
if($('#auditionAlign'))$('#auditionAlign').onclick=()=>{if(state.playing){stopAudio();resetTransport();return}auditionMix()};
if($('#stop'))$('#stop').onclick=()=>{stopAudio();resetTransport()};
if($('#exportWav'))$('#exportWav').onclick=exportMix;
window.addEventListener('resize',addMixControls);
