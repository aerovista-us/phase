import{state,$,markDirty}from'./state.js';
import{decodeFile,calcPeaks}from'./audio.js';
import{snapshotProject,applyProjectSnapshot,applyTrackSnapshot,editableFingerprint,validateProject}from'./project-model.js';
import{STEM_TYPES,ensureStemState,setStemBuffer,stemDurationCompatible}from'./stems.js';

const STORE='echoverse.phase.session.v5';
let pending=null,lastAuto='',restored=new Set();

function syncInputs(){
  const bpm=$('#projectBpm');if(bpm)bpm.value=Number(state.bpm||120).toFixed(2);
  const snap=$('#phraseSnap');if(snap)snap.value=state.snapMode||'beat';
  const loopBars=$('#loopBars');if(loopBars)loopBars.value=String(state.loopBars||8);
  for(const t of state.tracks){
    const tb=$(`#bpm-${t.id}`);if(tb)tb.value=Number(t.sourceBpm||120).toFixed(2);
    const p=$(`#pitch-${t.id}`);if(p)p.value=Number(t.pitch||0);
    const o=$(`#offset-${t.id}`);if(o)o.value=Number(t.timelineOffset||0).toFixed(2);
    const g=$(`#gain-${t.id}`);if(g)g.value=Number(t.gainDb||0);
    const gr=$(`#gainDb-${t.id}`);if(gr)gr.textContent=`${Number(t.gainDb||0)>=0?'+':''}${Number(t.gainDb||0).toFixed(1)} dB`;
  }
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new CustomEvent('phase:project-applied'));
}

function downloadable(data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='phase-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function saveProject(){const data=snapshotProject(state);downloadable(data);try{localStorage.setItem(STORE,JSON.stringify(data));lastAuto=editableFingerprint(state)}catch{}$('#engineState').textContent='PHASE PROJECT SAVED · SESSION REMEMBERED';refreshRestoreButton()}
function expectedTrackCount(data){return data?.tracks?.filter(t=>t.fileName).length||0}
function pendingComplete(){return !pending||restored.size>=expectedTrackCount(pending)}
function applyLoadedFrom(data){restored=new Set();applyProjectSnapshot(state,data,{loadedOnly:true});data.tracks.forEach((src,i)=>{const t=state.tracks[i];if(t?.buffer&&(!src.fileName||src.fileName===t.file?.name))restored.add(i)});syncInputs();markDirty();pending=data;tryPendingTracks()}
function tryPendingTracks(){if(!pending)return;let changed=false;pending.tracks.forEach((src,i)=>{if(restored.has(i)||!src?.fileName)return;const t=state.tracks[i];if(!t?.buffer)return;if(t.file?.name!==src.fileName){$('#engineState').textContent=`RESTORE WAITING · ${t.label} EXPECTS ${src.fileName}`;return}applyTrackSnapshot(t,src,{applyMarkers:true});restored.add(i);changed=true});if(changed){syncInputs();markDirty();$('#engineState').textContent=`SESSION RESTORED · ${restored.size}/${expectedTrackCount(pending)} TRACK MAPS`}if(pendingComplete()){pending=null;$('#engineState').textContent='SESSION MAP RESTORED · RENDER CHANGES TO MAKE AUDIO CURRENT'}}
async function loadProjectFile(file){const data=validateProject(JSON.parse(await file.text()));try{localStorage.setItem(STORE,JSON.stringify(data))}catch{}applyLoadedFrom(data);refreshRestoreButton()}
function restoreLocal(){try{const raw=localStorage.getItem(STORE);if(!raw)return;const data=validateProject(JSON.parse(raw));applyLoadedFrom(data)}catch(err){console.error(err);$('#engineState').textContent='SESSION RESTORE FAILED'}}
function currentSavedMap(){try{const raw=localStorage.getItem(STORE);if(raw)return validateProject(JSON.parse(raw))}catch{}return pending||snapshotProject(state)}
function expectedFileNames(data){const names=[];for(const src of data?.tracks||[]){if(src.fileName)names.push(src.fileName);for(const id of STEM_TYPES)if(src.stems?.[id]?.fileName)names.push(src.stems[id].fileName)}return names}

async function relinkFiles(files){
  const data=currentSavedMap(),selected=[...files],byName=new Map(selected.map(f=>[f.name.toLowerCase(),f])),decoded=new Map();let matched=0,warnings=0;
  const getBuffer=async file=>{if(decoded.has(file))return decoded.get(file);const buf=await decodeFile(file);decoded.set(file,buf);return buf};
  $('#engineState').textContent=`RELINKING · ${selected.length} FILE${selected.length===1?'':'S'}…`;
  for(let i=0;i<(data.tracks||[]).length;i++){
    const src=data.tracks[i],t=state.tracks[i];if(!t)continue;ensureStemState(t);
    if(src.fileName){const file=byName.get(src.fileName.toLowerCase());if(file){const buf=await getBuffer(file);t.file=file;t.fileName=file.name;t.name=file.name;t.buffer=buf;t.duration=buf.duration;t.peaks=calcPeaks(buf);t.renderedBuffer=null;t.renderedSignature=null;t.renderStats=null;t.renderedAt=null;matched++}}
    for(const id of STEM_TYPES){const wanted=src.stems?.[id]?.fileName;if(!wanted)continue;const file=byName.get(wanted.toLowerCase());if(!file)continue;const buf=await getBuffer(file),compatible=stemDurationCompatible(t,buf);setStemBuffer(t,id,buf,{fileName:file.name,durationWarning:!compatible});if(!compatible)warnings++;matched++}
  }
  applyProjectSnapshot(state,data,{loadedOnly:false});restored=new Set();data.tracks.forEach((src,i)=>{const t=state.tracks[i];if(src.fileName&&t?.file?.name===src.fileName)restored.add(i)});pending=restored.size>=expectedTrackCount(data)?null:data;syncInputs();markDirty();
  const expected=expectedFileNames(data).length;$('#engineState').textContent=`RELINKED · ${matched}/${expected} REMEMBERED FILE${expected===1?'':'S'}${warnings?` · ${warnings} STEM DURATION WARNING${warnings===1?'':'S'}`:''} · RENDER CHANGES TO MAKE AUDIO CURRENT`;
}

function refreshRestoreButton(){const b=$('#restoreSession');if(!b)return;let yes=false;try{yes=!!localStorage.getItem(STORE)}catch{}b.hidden=!yes;const r=$('#relinkSources');if(r)r.hidden=!yes}
function installControls(){
  if(!$('#restoreSession')){const b=document.createElement('button');b.className='btn';b.id='restoreSession';b.textContent='RESTORE SESSION';b.title='Restore the last Phase map; reload the same audio files to reconnect source audio';$('#loadMap').after(b);b.onclick=restoreLocal}
  if(!$('#relinkSources')){const b=document.createElement('button'),input=document.createElement('input');b.className='btn';b.id='relinkSources';b.textContent='RELINK FILES';b.title='Reconnect remembered Track A/B and stem filenames from one multi-file selection';input.id='relinkFiles';input.type='file';input.accept='audio/*';input.multiple=true;input.hidden=true;$('#restoreSession').after(b,input);b.onclick=()=>input.click();input.onchange=async e=>{try{if(e.target.files?.length)await relinkFiles(e.target.files)}catch(err){console.error(err);$('#engineState').textContent='RELINK FAILED';alert('Relink failed: '+(err.message||err))}e.target.value=''}}
  $('#saveMap').onclick=saveProject;$('#loadMap').onclick=()=>$('#mapFile').click();$('#mapFile').onchange=async e=>{try{if(e.target.files[0])await loadProjectFile(e.target.files[0])}catch(err){console.error(err);alert('Project load failed: '+err.message)}e.target.value=''};refreshRestoreButton();
}

setInterval(()=>{tryPendingTracks();if(pending)return;const hasSource=state.tracks.some(t=>t.file||t.fileName);if(!hasSource)return;const fp=editableFingerprint(state);if(fp===lastAuto)return;try{localStorage.setItem(STORE,JSON.stringify(snapshotProject(state)));lastAuto=fp;refreshRestoreButton()}catch{}},1500);
installControls();window.addEventListener('resize',installControls);
