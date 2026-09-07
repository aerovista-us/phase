import{state,$}from'./state.js';
import{renderMixRegion,downloadWav}from'./export.js';
import{makeAudioCurrent}from'./mix-ui.js';
import{eligibleTracks,exportItemsForTracks}from'./source-model.js';

async function exportLoop(){
  if(state.rendering)return;
  if(!state.loopEnabled||!(state.loopEnd>state.loopStart)){const b=$('#loopToggle');b?.classList.add('active');$('#engineState').textContent='TURN LOOP ON TO EXPORT A PHRASE';return}
  if(state.dirty)await makeAudioCurrent();if(state.dirty||state.rendering)return;
  const tracks=eligibleTracks(state.tracks),items=exportItemsForTracks(tracks);if(!items.length)return alert('No audible tracks to export.');
  const btn=$('#exportLoop');btn.disabled=true;$('#engineState').textContent=`EXPORTING ${state.loopBars} BAR LOOP…`;
  try{const mix=await renderMixRegion(items,state.loopStart,state.loopEnd,44100);downloadWav(mix,`phase-loop-${state.loopBars}bars.wav`);$('#engineState').textContent=`LOOP WAV EXPORTED · MIX + STEMS + TRIMS + FADES APPLIED`}
  catch(err){console.error(err);$('#engineState').textContent='LOOP EXPORT FAILED';alert('Loop export failed: '+(err.message||err))}
  finally{btn.disabled=false}
}

function install(){if($('#exportLoop'))return;const btn=document.createElement('button');btn.className='mode';btn.id='exportLoop';btn.textContent='EXPORT LOOP';btn.title='Render the current audition loop to WAV using current mute, solo, level, stem, trim, and fade settings';const size=$('#loopBars');if(size)size.after(btn);else $('.modebar').append(btn);btn.onclick=exportLoop}
install();window.addEventListener('resize',install);
