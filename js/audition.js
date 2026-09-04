import{state,$}from'./state.js';
import{ensureAudio,stopAudio}from'./audio.js';
import{firstDownbeatIndex}from'./arrangement.js';

function alignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
function eligibleTracks(){const solo=state.tracks.some(t=>t.solo);return state.tracks.filter(t=>(t.renderedBuffer||t.buffer)&&!t.mute&&(!solo||t.solo))}
function resetButtons(){const btn=$('#auditionAlign');if(btn)btn.textContent='AUDITION ALIGN';const play=$('#play');if(play)play.textContent='▶ PLAY'}

export function auditionAlignment(seconds=12){
  if(state.rendering)return false;
  if(state.dirty){$('#engineState').textContent='AUDITION NEEDS CURRENT AUDIO · RENDER CHANGES FIRST';return false}
  const a=state.tracks[0];if(!a.buffer||!a.markers.length)return false;
  const ai=alignIndex(a),center=(a.renderedOffset??a.timelineOffset??0)+(a.markers[ai]?.targetTime||0),windowStart=Math.max(0,center-4),windowEnd=windowStart+seconds,tracks=eligibleTracks();
  if(!tracks.length)return false;
  stopAudio();const ctx=ensureAudio();if(ctx.state==='suspended')ctx.resume();const base=ctx.currentTime+.04;state.sources=[];let last=null,lastEnd=-1;
  for(const t of tracks){
    const buffer=t.renderedBuffer||t.buffer,trackStart=t.renderedOffset??0,trackEnd=trackStart+buffer.duration,overlapStart=Math.max(windowStart,trackStart),overlapEnd=Math.min(windowEnd,trackEnd);
    if(overlapEnd<=overlapStart)continue;
    const delay=overlapStart-windowStart,sourceOffset=overlapStart-trackStart,duration=overlapEnd-overlapStart,src=ctx.createBufferSource(),gain=ctx.createGain();
    src.buffer=buffer;gain.gain.value=.82/Math.sqrt(Math.max(1,tracks.length));src.connect(gain).connect(ctx.destination);src.start(base+delay,sourceOffset,duration);state.sources.push(src);
    const end=delay+duration;if(end>lastEnd){lastEnd=end;last=src}
  }
  if(!state.sources.length)return false;
  state.playing=true;const btn=$('#auditionAlign');if(btn)btn.textContent='■ STOP AUDITION';$('#engineState').textContent=`AUDITION · ${windowStart.toFixed(2)}s → ${windowEnd.toFixed(2)}s · ALIGN ${Math.floor(ai/4)+1}.${ai%4+1}`;
  if(last)last.onended=()=>{if(state.playing){stopAudio();resetButtons();$('#engineState').textContent='AUDITION COMPLETE'}};
  return true;
}

const stop=$('#stop'),btn=document.createElement('button');btn.className='btn';btn.id='auditionAlign';btn.textContent='AUDITION ALIGN';btn.title='Play a short window around the chosen alignment point';
stop.after(btn);btn.onclick=()=>{if(state.playing){stopAudio();resetButtons();return}auditionAlignment()};
const priorStop=stop.onclick;stop.onclick=()=>{priorStop?.();resetButtons()};
