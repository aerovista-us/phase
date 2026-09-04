import{state,$,markDirty}from'./state.js';
import{snapshotProject,applyProjectSnapshot,editableFingerprint}from'./project-model.js';

const MAX=60,undo=[],redo=[];
let before=null,beforeFp='';

function syncInputs(){
  const bpm=$('#projectBpm');if(bpm)bpm.value=Number(state.bpm||120).toFixed(2);
  const snap=$('#phraseSnap');if(snap)snap.value=state.snapMode||'beat';
  for(const t of state.tracks){
    const tb=$(`#bpm-${t.id}`);if(tb)tb.value=Number(t.sourceBpm||120).toFixed(2);
    const p=$(`#pitch-${t.id}`);if(p)p.value=Number(t.pitch||0);
    const o=$(`#offset-${t.id}`);if(o)o.value=Number(t.timelineOffset||0).toFixed(2);
    const g=$(`#gain-${t.id}`);if(g)g.value=Number(t.gainDb||0);
    const gd=$(`#gainDb-${t.id}`);if(gd)gd.textContent=`${Number(t.gainDb||0)>=0?'+':''}${Number(t.gainDb||0).toFixed(1)} dB`;
  }
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new CustomEvent('phase:history-applied'));
}

function updateButtons(){
  const u=$('#undoPhase'),r=$('#redoPhase');if(u)u.disabled=!undo.length;if(r)r.disabled=!redo.length;
}

function begin(){if(before)return;before=snapshotProject(state);beforeFp=editableFingerprint(state)}
function commit(){
  if(!before)return;
  const now=editableFingerprint(state);
  if(now!==beforeFp){undo.push(before);if(undo.length>MAX)undo.shift();redo.length=0}
  before=null;beforeFp='';updateButtons();
}

function apply(snap,label){
  applyProjectSnapshot(state,snap,{loadedOnly:true});syncInputs();markDirty();$('#engineState').textContent=`${label} · VISUAL CHANGES PENDING`;
}

function doUndo(){
  commit();if(!undo.length)return;
  const current=snapshotProject(state),snap=undo.pop();redo.push(current);apply(snap,'UNDO');updateButtons();
}
function doRedo(){
  commit();if(!redo.length)return;
  const current=snapshotProject(state),snap=redo.pop();undo.push(current);apply(snap,'REDO');updateButtons();
}

function trackedTarget(el){
  if(!el||!el.closest)return false;
  if(el.closest('#undoPhase,#redoPhase,#saveMap,#loadMap,#restoreSession,#play,#stop,#auditionAlign,#render,#exportWav,#install,#analyze'))return false;
  if(el.closest('.marker,.lane'))return true;
  if(el.matches('input[id^="bpm-"],input[id^="pitch-"],input[id^="offset-"],input[id^="gain-"],#projectBpm,#phraseSnap'))return true;
  if(el.closest('[id^="alignSet-"],#alignB,#matchKey,#resetWarp'))return true;
  return false;
}

function installButtons(){
  if($('#undoPhase'))return;
  const u=document.createElement('button'),r=document.createElement('button');u.className=r.className='btn';u.id='undoPhase';r.id='redoPhase';u.textContent='↶ UNDO';r.textContent='↷ REDO';u.title='Undo visual/project metadata edit';r.title='Redo visual/project metadata edit';
  $('#saveMap').before(u,r);u.onclick=doUndo;r.onclick=doRedo;updateButtons();
}

document.addEventListener('pointerdown',e=>{if(trackedTarget(e.target))begin()},true);
document.addEventListener('focusin',e=>{if(trackedTarget(e.target))begin()},true);
document.addEventListener('change',e=>{if(trackedTarget(e.target))setTimeout(commit,0)},true);
document.addEventListener('click',e=>{if(trackedTarget(e.target))setTimeout(commit,0)},true);
window.addEventListener('mouseup',()=>setTimeout(commit,0),true);
window.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
  if(e.code==='KeyZ'){e.preventDefault();e.shiftKey?doRedo():doUndo()}
  else if(e.code==='KeyY'){e.preventDefault();doRedo()}
});

installButtons();window.addEventListener('resize',installButtons);
