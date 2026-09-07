import{state,$}from'./state.js';
import{applyTempoOctave}from'./tempo-model.js';

function chosenId(){const select=$('#tempoTrack');if(Number.isInteger(state.selected?.track))return state.selected.track;return Number(select?.value)||0}
function syncTrack(){const select=$('#tempoTrack');if(select&&Number.isInteger(state.selected?.track)&&select.value!==String(state.selected.track))select.value=String(state.selected.track)}
function apply(factor){
  if(state.rendering)return;const id=chosenId(),t=state.tracks[id];if(!t?.buffer)return $('#engineState').textContent=`LOAD ${t?.label||'A TRACK'} FIRST`;
  const hadRendered=!!t.renderedBuffer,hadWarp=t.markers?.some(m=>Math.abs((m.targetTime||0)-(m.sourceTime||0))>.0005);
  try{const r=applyTempoOctave(t,factor);const bpm=$(`#bpm-${id}`);if(bpm)bpm.value=r.bpm.toFixed(2);if(id===0){state.bpm=r.bpm;const project=$('#projectBpm');if(project)project.value=r.bpm.toFixed(2)}if(hadRendered||hadWarp){state.dirty=true;$('#renderDot')?.classList.add('pending');if($('#renderState'))$('#renderState').textContent='VISUAL CHANGES PENDING'}window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('phase:meter-change'));$('#engineState').textContent=`${t.label} TEMPO ${factor===.5?'½':'×2'} · ${r.bpm.toFixed(2)} BPM · ${r.markers} BEATS · ${t.meter||'4/4'}${hadRendered||hadWarp?' · RENDER PENDING':''}`}
  catch(err){$('#engineState').textContent=`TEMPO CORRECTION BLOCKED · ${err.message}`}
}
function install(){
  if($('#tempoHalf'))return;const label=document.createElement('span');label.className='label section';label.textContent='TEMPO';const select=document.createElement('select');select.id='tempoTrack';select.className='snap-select';select.innerHTML='<option value="0">TRACK A</option><option value="1">TRACK B</option>';const half=document.createElement('button'),dbl=document.createElement('button');half.className=dbl.className='mode';half.id='tempoHalf';dbl.id='tempoDouble';half.textContent='½ BPM';dbl.textContent='×2 BPM';half.title='Correct a double-time tempo detection by keeping every other detected beat';dbl.title='Correct a half-time tempo detection by interpolating beats between detected ticks';half.onclick=()=>apply(.5);dbl.onclick=()=>apply(2);const meter=$('#meterMode');if(meter)meter.after(label,select,half,dbl);else $('.modebar')?.append(label,select,half,dbl)
}
install();setInterval(()=>{install();syncTrack()},250);window.addEventListener('resize',install);window.addEventListener('phase:project-applied',install);window.addEventListener('phase:history-applied',install);
