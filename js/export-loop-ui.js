import{state,$}from'./state.js';
import{renderMixRegion,downloadWav}from'./export.js';
import{makeAudioCurrent,dbToGain}from'./mix-ui.js';

function eligible(){const solo=state.tracks.some(t=>t.solo);return state.tracks.filter(t=>(t.renderedBuffer||t.buffer)&&!t.mute&&(!solo||t.solo))}

async function exportLoop(){
  if(state.rendering)return;
  if(!state.loopEnabled||!(state.loopEnd>state.loopStart)){const b=$('#loopToggle');b?.classList.add('active');$('#engineState').textContent='TURN LOOP ON TO EXPORT A PHRASE';return}
  if(state.dirty)await makeAudioCurrent();if(state.dirty||state.rendering)return;
  const tracks=eligible(),items=tracks.map(t=>({buffer:t.renderedBuffer||t.buffer,offset:t.renderedOffset||0,gain:dbToGain(t.gainDb),sourceIn:t.trimIn||0,sourceOut:t.trimOut}));if(!items.length)return alert('No audible tracks to export.');
  const btn=$('#exportLoop');btn.disabled=true;$('#engineState').textContent=`EXPORTING ${state.loopBars} BAR LOOP…`;
  try{const mix=await renderMixRegion(items,state.loopStart,state.loopEnd,44100);downloadWav(mix,`phase-loop-${state.loopBars}bars.wav`);$('#engineState').textContent=`LOOP WAV EXPORTED · ${state.loopBars} BARS · TRIMS APPLIED`}
  catch(err){console.error(err);$('#engineState').textContent='LOOP EXPORT FAILED';alert('Loop export failed: '+(err.message||err))}
  finally{btn.disabled=false}
}

function install(){if($('#exportLoop'))return;const btn=document.createElement('button');btn.className='mode';btn.id='exportLoop';btn.textContent='EXPORT LOOP';btn.title='Render the current audition loop to WAV using current mute, solo, level, and trim settings';const size=$('#loopBars');if(size)size.after(btn);else $('.modebar').append(btn);btn.onclick=exportLoop}
install();window.addEventListener('resize',install);
