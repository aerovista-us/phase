import{state,$,$$,markDirty}from'./state.js';
import{firstDownbeatIndex,snapTrackOffset,alignByMarkers}from'./arrangement.js';

const style=document.createElement('style');
style.textContent=`
.marker.alignpoint::before{width:3px!important;background:#c6a66b!important;box-shadow:0 0 0 1px rgba(198,166,107,.18)}
.marker.alignpoint .cap{background:#c6a66b!important;border-color:#e1ca98!important;transform:rotate(45deg)}
.track-tools{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.track-tools .mini.active{border-color:#66b5a8;background:#20302e;color:#dff5ef}
.track-tools .mini.solo.active{border-color:#c6a66b;background:#302919;color:#f1deb5}
.snap-select{height:27px;border:1px solid #263542;border-radius:5px;background:#111820;color:#d9e2e7;padding:0 7px;font:10px ui-monospace,monospace}
.align-readout{font:9px ui-monospace,monospace;color:#c6a66b;white-space:nowrap}
`;
document.head.appendChild(style);

state.snapMode=state.snapMode||'beat';
for(const t of state.tracks){t.alignMarker=Number.isInteger(t.alignMarker)?t.alignMarker:null;t.mute=!!t.mute;t.solo=!!t.solo}

function markerLabel(track,idx){const m=track.markers[idx];if(!m)return'—';return`${Math.floor(idx/4)+1}.${idx%4+1}`}
function chosenAlignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}

function refreshAlignDecor(){
  for(const t of state.tracks){
    const idx=chosenAlignIndex(t);t.alignMarker=idx;
    $$(`.marker[data-track="${t.id}"]`).forEach(el=>el.classList.toggle('alignpoint',+el.dataset.beat===idx));
    setText($(`#alignSet-${t.id}`),`ALIGN @ ${markerLabel(t,idx)}`);
    setText($(`#alignRead-${t.id}`),`A ${markerLabel(t,idx)}`);
    const m=$(`#mute-${t.id}`);if(m)m.classList.toggle('active',t.mute);
    const s=$(`#solo-${t.id}`);if(s)s.classList.toggle('active',t.solo);
  }
}

function setAlignPoint(track){
  const selected=state.selected?.track===track.id?state.selected.beat:null;
  track.alignMarker=Number.isInteger(selected)?selected:firstDownbeatIndex(track);
  refreshAlignDecor();
  $('#engineState').textContent=`${track.label} ALIGN POINT · ${markerLabel(track,track.alignMarker)}`;
}

function addTrackTools(){
  for(const t of state.tracks){
    const head=$(`#name-${t.id}`)?.closest('.track-head');if(!head||$(`#alignSet-${t.id}`))continue;
    const row=document.createElement('div');row.className='track-tools';
    row.innerHTML=`<button class="mini" id="alignSet-${t.id}" title="Use the selected beat/downbeat as this track's alignment point">ALIGN</button><button class="mini" id="mute-${t.id}">MUTE</button><button class="mini solo" id="solo-${t.id}">SOLO</button><span class="align-readout" id="alignRead-${t.id}"></span>`;
    head.appendChild(row);
    $(`#alignSet-${t.id}`).onclick=e=>{e.stopPropagation();setAlignPoint(t)};
    $(`#mute-${t.id}`).onclick=e=>{e.stopPropagation();t.mute=!t.mute;refreshAlignDecor();$('#engineState').textContent=`${t.label} ${t.mute?'MUTED':'UNMUTED'}`};
    $(`#solo-${t.id}`).onclick=e=>{e.stopPropagation();t.solo=!t.solo;refreshAlignDecor();$('#engineState').textContent=`${t.label} SOLO ${t.solo?'ON':'OFF'}`};
  }
  refreshAlignDecor();
}

function addSnapControl(){
  if($('#phraseSnap'))return;
  const label=document.createElement('span');label.className='label section';label.textContent='SNAP';
  const select=document.createElement('select');select.id='phraseSnap';select.className='snap-select';
  select.innerHTML='<option value="beat">BEAT</option><option value="bar">BAR</option><option value="8bar">8 BARS</option><option value="16bar">16 BARS</option><option value="32bar">32 BARS</option><option value="off">OFF</option>';
  select.value=state.snapMode;select.onchange=()=>{state.snapMode=select.value;$('#engineState').textContent=`MOVE SNAP · ${select.options[select.selectedIndex].text}`};
  const reset=$('#resetWarp');reset.after(label,select);
}

function alignSelected(){
  if(state.rendering)return;
  const a=state.tracks[0],b=state.tracks[1];
  if(!a.buffer||!b.buffer||!a.markers.length||!b.markers.length)return alert('Load and analyze both tracks first.');
  const ai=chosenAlignIndex(a),bi=chosenAlignIndex(b);alignByMarkers(a,b,ai,bi);
  b.timelineOffset=a.timelineOffset||0;
  const off=$(`#offset-${b.id}`);off.value=b.timelineOffset.toFixed(2);off.onchange?.({target:off});
  state.bpm=a.sourceBpm;$('#projectBpm').value=state.bpm.toFixed(2);markDirty();refreshAlignDecor();
  $('#engineState').textContent=`ALIGNED · A ${markerLabel(a,ai)} ↔ B ${markerLabel(b,bi)} · ${state.bpm.toFixed(2)} BPM`;
}

function overrideMove(){
  for(const track of state.tracks){
    const lane=$(`#lane-${track.id}`);if(!lane)continue;
    lane.onmousedown=e=>{
      if(state.mode!=='move'||state.rendering||e.target.closest('.marker'))return;
      e.preventDefault();
      const rect=lane.getBoundingClientRect(),startX=e.clientX,startOffset=track.timelineOffset||0,view=state.viewDuration,anchorIdx=chosenAlignIndex(track),anchorTime=track.markers[anchorIdx]?.targetTime||0,input=$(`#offset-${track.id}`);
      lane.classList.add('move-active');let raf=0,pending=startOffset;
      const apply=()=>{raf=0;track.timelineOffset=pending;input.value=pending.toFixed(2);input.onchange?.({target:input})};
      const move=ev=>{let next=startOffset+(ev.clientX-startX)/rect.width*view;if(!ev.shiftKey)next=snapTrackOffset(next,anchorTime,state.bpm,state.snapMode);pending=next;if(!raf)raf=requestAnimationFrame(apply);$('#engineState').textContent=`MOVING ${track.label} · ${next.toFixed(2)}s · ${ev.shiftKey?'FREE':state.snapMode.toUpperCase()+' SNAP'}`};
      const up=()=>{if(raf){cancelAnimationFrame(raf);apply()}lane.classList.remove('move-active');window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);$('#engineState').textContent=`${track.label} POSITION PENDING · RENDER TO COMMIT`};
      window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
    };
  }
}

addSnapControl();addTrackTools();overrideMove();
if($('#alignB')){$('#alignB').onclick=alignSelected;$('#alignB').title='Align the chosen B marker to the chosen A marker and follow A’s edited grid'}

let refreshQueued=false;
const queueRefresh=()=>{if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;refreshAlignDecor()})};
const observer=new MutationObserver(queueRefresh);
for(const t of state.tracks){const host=$(`#markers-${t.id}`);if(host)observer.observe(host,{childList:true})}
window.addEventListener('resize',()=>setTimeout(()=>{addTrackTools();overrideMove();refreshAlignDecor()},0));
window.addEventListener('phase:project-applied',queueRefresh);
window.addEventListener('phase:history-applied',queueRefresh);
refreshAlignDecor();
