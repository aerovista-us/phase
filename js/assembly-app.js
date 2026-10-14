import{newClip,clipDuration,clipEnd,projectDuration,insertClip,splitClip,removeClip,moveClip,updateFade,saveAssembly,restoreAssembly,quantize}from'./assembly-model.js';
import{buildWavePyramid,drawWave,drawRawSamples}from'./assembly-waveform.js';
import{indexAudioPeaks,StreamingUnavailable}from'./assembly-peak-indexer.js';
import{prepareAssemblyItems,decodeSourceWindow}from'./assembly-window-decode.js';
import{dragSeconds,draggedBeyondThreshold}from'./drag-motion.js';
import{sectionRange,sectionFilename}from'./assembly-section.js';
import{renderMix,renderMixRegion,downloadWav}from'./export.js';
import{applyGainEnvelope}from'./fade-model.js';
import{findQuietZeroCrossing,autoCrossfade,snapOutgoingEnd,slipIncomingStart}from'./splice-precision.js';

const $=id=>document.getElementById(id);
const fmt=s=>{const n=Math.max(0,s||0);return Math.floor(n/60)+':'+(n%60).toFixed(2).padStart(5,'0')};
let sources=[],clips=[],selectedId=null,clipboard=null,undoStack=[],zoom=8,autoFit=true,ctx=null,live=[],sourcePlayer=new Audio(),currentSource=null,stopAt=Infinity,busy=false,previewUrl=null,playToken=0;
let placement=null;
const sourceDragType='application/x-phase-source';
const sourceById=id=>sources.find(s=>s.id===id);
const selected=()=>clips.find(c=>c.id===selectedId);
const status=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error)};
const genId=()=>crypto.randomUUID?.()||Math.random().toString(36).slice(2);
const snapshot=()=>{undoStack.push(clips.map(c=>({...c})));if(undoStack.length>60)undoStack.shift()};
const aud=()=>ctx||(ctx=new(window.AudioContext||window.webkitAudioContext)());
function cancelPlacement(){placement=null;$('master-lane').classList.remove('placing');
 $('placement-guide')?.remove();$('cancel-placement').hidden=true;}
function placementTime(clientX){const lane=$('master-lane'),rect=lane.getBoundingClientRect();
 return quantize(Math.max(0,Math.min(rect.width/zoom,(clientX-rect.left)/zoom)));}
function showPlacement(at){
 if(!placement)return;
 let guide=$('placement-guide');if(!guide){guide=document.createElement('div');guide.id='placement-guide';guide.setAttribute('aria-hidden','true');$('master-lane').append(guide)}
 guide.style.left=at*zoom+'px';guide.textContent='INSERT '+fmt(at);$('master-lane').classList.add('placing');
}
function placeSource(s,at){
 if(!s?.ready)return;
 const c=newClip(s,s.inSec,s.outSec,at);snapshot();clips=insertClip(clips,c,at,true);selectedId=c.id;
 cancelPlacement();updateUI();status('Inserted '+s.name+' at '+fmt(at)+'; later audio rippled. Undo available.');
}
function stop(){
 playToken++;
 sourcePlayer.pause();
 if(previewUrl){sourcePlayer.removeAttribute('src');sourcePlayer.load();URL.revokeObjectURL(previewUrl);previewUrl=null;}
 live.forEach(s=>{try{s.stop()}catch{}});live=[];
 for(const s of sources)s.buffer=null;
 $('play-master').textContent='▶ PLAY MASTER';
}
sourcePlayer.ontimeupdate=()=>{if(sourcePlayer.currentTime>=stopAt){sourcePlayer.pause();sourcePlayer.currentTime=Math.max(0,stopAt)}};
function updateRange(s){const card=document.querySelector('[data-source="'+s.id+'"]');if(!card)return;
 card.querySelector('.source-range').style.left=(s.inSec/s.duration*100)+'%';
 card.querySelector('.source-range').style.width=((s.outSec-s.inSec)/s.duration*100)+'%';
 card.querySelector('.range-in').value=s.inSec.toFixed(6);card.querySelector('.range-out').value=s.outSec.toFixed(6);}
async function indexSource(s,file){
 status('Indexing '+file.name+' · streaming waveform peaks in bounded chunks…');
 let result;
 try{
  result=await indexAudioPeaks(file,{onProgress:p=>{
   if(p>=.99||Math.round(p*10)!==Math.round((p-.008)*10))
    status('Indexing '+file.name+' · '+Math.round(p*100)+'% streamed');
  }});
 }catch(err){
  // Unsupported containers/codecs can use the preexisting path, but never call it lightweight.
  // Cap fallback memory before reading the entire compressed file into an AudioBuffer.
  if(!(err instanceof StreamingUnavailable) && !/MP3|decoder|decode/i.test(err.message))throw err;
  const estimated=file.size*12;
  if(estimated>400*1024*1024)
   throw new Error('No memory-safe streaming decoder available for this file. Use PCM WAV or a supported MP3.');
  status('Streaming decoder unavailable · full-decode compatibility mode for '+file.name);
  const buffer=await aud().decodeAudioData(await file.arrayBuffer());
  const pyramid=buildWavePyramid(buffer);
  result={pyramid,duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,mode:'full-decode-fallback',
   peakBytes:pyramid.levels[0].min.byteLength+pyramid.levels[0].max.byteLength};
 }
 // Original File is preserved; only min/max waveform summaries remain after indexing.
 s.file=file;s.name=file.name;s.duration=result.duration;s.sampleRate=result.sampleRate;s.channels=result.channels||2;
 s.pyramid=result.pyramid;s.inSec=0;s.outSec=Math.min(s.duration,15);s.ready=true;
 s.indexMode=result.mode;s.peakBytes=result.peakBytes;
 updateUI();
 const label=result.mode==='full-decode-fallback'?'compatibility full-decode':'streaming';
 status('Indexed '+file.name+' ('+fmt(s.duration)+') using '+label+' · '+Math.round(result.peakBytes/1024)+' KiB min/max peaks retained.');
}
async function addFiles(fileList){
 for(const file of fileList){if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|flac|ogg)$/i.test(file.name)){status('Unsupported audio type: '+file.name,true);continue;}
 let s=sources.find(x=>!x.file&&x.name===file.name&&(!x.size||x.size===file.size));
 if(!s){s={id:genId(),name:file.name,size:file.size,inSec:0,outSec:0,ready:false};sources.push(s)}
 try{await indexSource(s,file)}catch(err){status('Unable to decode '+file.name+': '+err.message,true);sources=sources.filter(x=>x!==s||x.ready);}
 }updateUI();
}
function renderSourceCards(){
 const root=$('sources');root.replaceChildren();
 if(!sources.length){root.innerHTML='<p class="empty">No sources yet. Add local audio files to begin.</p>';return;}
 for(const s of sources){
 const card=document.createElement('div');card.className='source-card'+(s.id===currentSource?' active':'');card.dataset.source=s.id;
 card.innerHTML='<div><div class="source-name"></div><div class="source-status"></div></div><div class="source-wave" title="Click to set IN; Shift-click to set OUT"><canvas></canvas><div class="source-range"></div></div><div class="source-actions"><label>IN <input class="range-in" type="number" min="0" step="any"></label><label>OUT <input class="range-out" type="number" min="0" step="any"></label><button class="audition">▶ SOLO</button><button class="add">↑ APPEND</button><button class="insert">INSERT @ PLAYHEAD</button><button class="place-source" draggable="true" title="Drag the selected source region to the master, or click then tap a position">DRAG / PLACE IN MASTER</button></div>';
 card.querySelector('.source-name').textContent=s.name;
 card.querySelector('.source-status').textContent=s.ready?fmt(s.duration)+' · '+s.sampleRate+' Hz · '+(s.indexMode==='full-decode-fallback'?'compatibility decode':s.indexMode||'indexed'):'RELINK AUDIO REQUIRED';
 root.append(card);
 if(!s.ready){card.querySelectorAll('button,input').forEach(x=>x.disabled=true);continue}
 const canvas=card.querySelector('canvas');
 drawWave(canvas,s.pyramid,0,s.duration,{stroke:'#73c2dd'});
 updateRange(s);
 const change=()=>{const a=Number(card.querySelector('.range-in').value),b=Number(card.querySelector('.range-out').value);
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>s.duration||a>=b){status('OUT must be after IN and inside the file.',true);updateRange(s);return}
   s.inSec=quantize(a,s.sampleRate);s.outSec=quantize(b,s.sampleRate);updateRange(s)};
 card.querySelectorAll('input').forEach(el=>el.addEventListener('change',change));
 canvas.addEventListener('click',e=>{
   const r=canvas.getBoundingClientRect(),time=quantize(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*s.duration,s.sampleRate);
   if(e.shiftKey)s.outSec=Math.max(s.inSec+1/s.sampleRate,time);else s.inSec=Math.min(time,s.outSec-1/s.sampleRate);
   updateRange(s);
 });
 card.querySelector('.audition').onclick=async()=>{stop();
   previewUrl=URL.createObjectURL(s.file);sourcePlayer.src=previewUrl;sourcePlayer.currentTime=s.inSec;stopAt=s.outSec;currentSource=s.id;updateUI();try{await sourcePlayer.play();status('Solo audition · '+s.name)}catch(err){status('Preview unavailable: '+err.message,true)}};
 card.querySelector('.add').onclick=()=>{snapshot();const c=newClip(s,s.inSec,s.outSec,projectDuration(clips));clips=insertClip(clips,c,c.masterStart);selectedId=c.id;updateUI();status('Added '+s.name+' to master. Drag, trim, or split the clip.')};
 card.querySelector('.insert').onclick=()=>{snapshot();const at=Number($('playhead').value)||0;const c=newClip(s,s.inSec,s.outSec,at);clips=insertClip(clips,c,at,true);selectedId=c.id;updateUI();status('Inserted at playhead, splitting occupied clips and shifting later audio.')};
 const handle=card.querySelector('.place-source');
 handle.onclick=()=>{cancelPlacement();placement=s.id;$('cancel-placement').hidden=false;showPlacement(Number($('playhead').value)||0);
   $('master-scroll').scrollIntoView({block:'center',behavior:'instant'});status('Tap or click the master at the insertion point. Escape or Cancel leaves the edit map unchanged.');};
 handle.ondragstart=e=>{cancelPlacement();placement=s.id;e.dataTransfer.setData(sourceDragType,s.id);e.dataTransfer.effectAllowed='copy';$('cancel-placement').hidden=false;status('Drop on the master to insert this source selection; Escape cancels.');};
 handle.ondragend=()=>cancelPlacement();
 }
}
function drawMaster(){
 const lane=$('master-lane'),ruler=$('master-ruler');lane.replaceChildren();ruler.replaceChildren();
 const total=clips.length?Math.max(8,projectDuration(clips)+2):60;const width=Math.max(lane.parentElement.clientWidth,Math.ceil(total*zoom));
 const endTimes=[];const rows=new Map();
 for(const c of [...clips].sort((a,b)=>a.masterStart-b.masterStart)){
   let layer=endTimes.findIndex(end=>end<=c.masterStart+.000001);
   if(layer<0){layer=endTimes.length;endTimes.push(0)}
   endTimes[layer]=clipEnd(c);rows.set(c.id,layer);
 }
 lane.style.height=(154+Math.max(0,endTimes.length-1)*128)+'px';
 lane.style.width=width+'px';ruler.style.width=width+'px';
 const step=zoom>=100?1:zoom>=50?2:zoom>=18?5:zoom>=8?10:20;
 for(let t=0;t<=width/zoom;t+=step){const tick=document.createElement('div');tick.className='tick';tick.style.left=t*zoom+'px';tick.textContent=fmt(t);ruler.append(tick)}
 ruler.onclick=e=>{$('playhead').value=quantize((e.clientX-ruler.getBoundingClientRect().left)/zoom).toFixed(6);drawInspector()};
 for(const c of clips){const s=sourceById(c.sourceId),el=document.createElement('div');el.className='master-clip'+(c.id===selectedId?' selected':'');
   el.style.left=c.masterStart*zoom+'px';el.style.top=(16+(rows.get(c.id)||0)*128)+'px';el.style.width=Math.max(3,clipDuration(c)*zoom)+'px';el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Select '+(s?.name||'clip')+' at '+fmt(c.masterStart));
   const wave=document.createElement('canvas'),label=document.createElement('span');label.textContent=(s?.name||'Missing audio')+' · '+fmt(c.sourceIn);
   el.append(wave,label);lane.append(el);
   if(s?.pyramid)drawWave(wave,s.pyramid,c.sourceIn,c.sourceOut,{stroke:'#8addf6'});
   let dragging=false,suppressClick=false;
   el.onclick=()=>{if(placement)return;if(suppressClick){suppressClick=false;return}selectedId=c.id;updateUI()};
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectedId=c.id;updateUI()}};
   el.onpointerdown=e=>{
     if(placement||e.button!==0||e.target.closest('button,input'))return;
     suppressClick=false;
     const pointerId=e.pointerId,startX=e.clientX,base=c.masterStart,oldLeft=el.style.left;
     let moved=false,pending=base,active=true;
     const cleanup=()=>{
       if(!active)return;active=false;dragging=false;
       el.classList.remove('dragging');
       el.removeEventListener('pointermove',preview);
       el.removeEventListener('pointerup',finish);
       el.removeEventListener('pointercancel',cancel);
       el.removeEventListener('lostpointercapture',cancel);
       window.removeEventListener('keydown',escape);
       window.removeEventListener('blur',cancel);
       try{if(el.hasPointerCapture(pointerId))el.releasePointerCapture(pointerId)}catch{}
     };
     const cancel=()=>{suppressClick=moved;el.style.left=oldLeft;cleanup();status('Clip move canceled.');};
     const escape=key=>{if(key.key==='Escape'){key.preventDefault();cancel()}};
     const preview=ev=>{
       if(ev.pointerId!==pointerId)return;
       const dx=ev.clientX-startX;
       if(!moved&&!draggedBeyondThreshold(dx))return;
       moved=true;dragging=true;pending=dragSeconds(base,dx,zoom,{min:0});
       el.style.left=pending*zoom+'px';
       el.classList.add('dragging');
       status('Moving clip · '+fmt(pending)+' · release to set, Esc to cancel');
     };
     const finish=ev=>{
       if(ev.pointerId!==pointerId)return;
       if(moved){
         const dx=ev.clientX-startX;
         pending=dragSeconds(base,dx,zoom,{min:0});
         const changed=Math.abs(pending-base)>1/48000;
         suppressClick=true;
         if(changed){snapshot();clips=moveClip(clips,c.id,pending)}
         selectedId=c.id;
         cleanup();updateUI();status(changed?'Clip moved to '+fmt(pending)+'. Undo available.':'Clip position unchanged.');
       }else{cleanup()}
     };
     el.setPointerCapture(pointerId);
     el.addEventListener('pointermove',preview);
     el.addEventListener('pointerup',finish);
     el.addEventListener('pointercancel',cancel);
     el.addEventListener('lostpointercapture',cancel);
     window.addEventListener('keydown',escape);
     window.addEventListener('blur',cancel);
   };
 }
}
function editPanel(){
 const c=selected();$('clip-editor').hidden=!c;
 if(!c)return;
 const s=sourceById(c.sourceId);$('clip-name').textContent=(s?.name||'Missing source')+' · '+fmt(clipDuration(c));
 $('clip-start').value=c.masterStart.toFixed(6);$('fade-in').value=Math.round(c.fadeInSec*1000);$('fade-out').value=Math.round(c.fadeOutSec*1000);
}
function drawInspector(){
 const c=selected(),l=$('join-left'),r=$('join-right');
 const clear=canvas=>{const rect=canvas.getBoundingClientRect();canvas.width=rect.width*devicePixelRatio;canvas.height=rect.height*devicePixelRatio;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)};
 if(!c){clear(l);clear(r);$('join-message').textContent='Select a master clip to inspect its exit and the next clip entrance.';return}
 const ordered=[...clips].sort((a,b)=>a.masterStart-b.masterStart),i=ordered.findIndex(x=>x.id===c.id),next=ordered[i+1];
 const a=sourceById(c.sourceId),b=next&&sourceById(next.sourceId);
 if(a?.pyramid)drawWave(l,a.pyramid,Math.max(c.sourceIn,c.sourceOut-.22),c.sourceOut,{stroke:'#75bde9'});else clear(l);
 if(b?.pyramid)drawWave(r,b.pyramid,next.sourceIn,Math.min(next.sourceOut,next.sourceIn+.22),{stroke:'#c79bf0'});else clear(r);
 $('join-message').textContent=next?('Join '+fmt(clipEnd(c))+' → '+fmt(next.masterStart)+' · gap/overlap '+(next.masterStart-clipEnd(c)).toFixed(3)+' s; min/max peaks near boundaries.'): 'No next clip. Add one to compare incoming audio.';
}
function fitZoom(){const width=Math.max(320,$('master-scroll').clientWidth||950);zoom=Math.round(Math.max(3,Math.min(240,(width-58)/Math.max(4,projectDuration(clips)+2))));$('zoom').value=zoom;$('zoom-value').textContent=zoom+' px/s'}
function updateUI(){cancelPlacement();if(autoFit&&clips.length)fitZoom();renderSourceCards();drawMaster();editPanel();drawInspector()}
async function bufferFor(s){if(!s?.file)throw Error('Relink missing audio source: '+(s?.name||'unknown'));
  if(!s.buffer)s.buffer=await aud().decodeAudioData(await s.file.arrayBuffer());
  return s.buffer;
}
async function playMaster(time=null,windowEnd=null){
 stop();
 if(!clips.length){status('Add clips to master first.',true);return}
 if(busy){status('Another audio operation is still running.',true);return}
 const token=playToken,t=Math.max(0,time??(Number($('playhead').value)||0));
 const context=aud();await context.resume();
 try{
  busy=true;status('Loading only the original source regions needed for playback…');
  const prepared=await prepareAssemblyItems(clips,sourceById,{
   context,loadFullBuffer:bufferFor,from:t,to:windowEnd??Infinity});
  if(token!==playToken)return; // Stop or source audition superseded this asynchronous decode.
  const base=context.currentTime+.06;
  let last=null,latest=-1;
  for(const item of prepared.items){
   const start=Math.max(t,item.offset+item.sourceIn),end=Math.min(item.offset+item.sourceOut,windowEnd??Infinity);
   if(end<=start)continue;
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=item.buffer;source.connect(gain).connect(context.destination);
   applyGainEnvelope(gain.gain,.88*item.gain,item,start,end,base+start-t);
   source.start(base+start-t,Math.max(0,start-item.offset),end-start);
   live.push(source);
   if(end>latest){latest=end;last=source}
  }
  if(!live.length){status('Move playhead into an occupied region.',true);return}
  if(last)last.onended=()=>{if(token!==playToken)return;live=[];
   for(const s of sources)s.buffer=null;$('play-master').textContent='▶ PLAY MASTER'};
  $('play-master').textContent='■ STOP MASTER';
  const bounded=prepared.items.filter(i=>i.mode==='windowed-original-pcm-wav'||i.mode==='sequential-webcodecs-mp3-window').length;
  status('Playing master · '+bounded+' original PCM windows · from '+fmt(t));
 }catch(err){if(token===playToken)status('Playback: '+err.message,true)}
 finally{busy=false}
}
async function exportMaster(){
 if(busy)return;if(!clips.length){status('No master clips to export.',true);return}
 const seconds=projectDuration(clips);
 const rate=Math.max(44100,...clips.map(c=>sourceById(c.sourceId)?.sampleRate||44100));
 const outBytes=seconds*rate*2*6;
 if(outBytes>440*1024*1024){status('Master render may exceed safe memory budget. Shorten assembly or render in sections.',true);return}
 try{busy=true;status('Loading original clip windows and rendering full-quality master…');
   const prepared=await prepareAssemblyItems(clips,sourceById,{context:aud(),loadFullBuffer:bufferFor});
   const buf=await renderMix(prepared.items,rate);
   downloadWav(buf,'phase-master-assembly.wav');
   const bounded=prepared.items.filter(i=>i.mode==='windowed-original-pcm-wav'||i.mode==='sequential-webcodecs-mp3-window').length;
   status('Master WAV exported · '+fmt(buf.duration)+' at '+rate+' Hz, PCM 16-bit · '+bounded+' windowed source clips.')}
 catch(err){status('Export failed: '+err.message,true)}finally{busy=false;for(const s of sources)s.buffer=null}
}
$('mark-in').onclick=()=>{
 $('section-in').value=String(Math.max(0,Number($('playhead').value)||0));
 status('Section IN set at '+fmt(Number($('section-in').value)));
};
$('mark-out').onclick=()=>{
 $('section-out').value=String(Math.max(0,Number($('playhead').value)||0));
 status('Section OUT set at '+fmt(Number($('section-out').value)));
};
$('export-section').onclick=async()=>{
 if(busy)return;
 if(!clips.length){status('Add at least one master clip before exporting a section.',true);return}
 const rate=Math.max(44100,...clips.map(c=>sourceById(c.sourceId)?.sampleRate||44100));
 let range;
 try{
  range=sectionRange(Number($('section-in').value),Number($('section-out').value),projectDuration(clips),rate);
 }catch(error){status(error.message,true);return}
 try{
  busy=true;status('Rendering section '+fmt(range.start)+' → '+fmt(range.end)+' from original PCM source windows…');
  const prepared=await prepareAssemblyItems(clips,sourceById,{
   context:aud(),loadFullBuffer:bufferFor,from:range.start,to:range.end
  });
  const buffer=await renderMixRegion(prepared.items,range.start,range.end,rate,{frameCount:range.frames,allowSilence:true});
  downloadWav(buffer,sectionFilename(range.start,range.end));
  status('Section WAV exported · '+fmt(range.start)+' → '+fmt(range.end)+' · '+rate+' Hz, PCM 16-bit');
 }catch(err){status('Section export failed: '+err.message,true)}
 finally{busy=false;for(const source of sources)source.buffer=null}
};
$('source-files').onchange=e=>addFiles([...e.target.files]);
$('play-master').onclick=()=>{if(live.length){stop();status('Playback stopped.')}else playMaster()};
$('stop-master').onclick=()=>{stop();status('Stopped.')};
$('export-master').onclick=exportMaster;
$('zoom').oninput=e=>{autoFit=false;zoom=Number(e.target.value);$('zoom-value').textContent=zoom+' px/s';drawMaster()};
$('fit-master').onclick=()=>{autoFit=true;fitZoom();drawMaster();status('Fit master waveform to arrangement.')};
window.addEventListener('resize',()=>{if(autoFit&&clips.length)fitZoom();drawMaster();drawInspector()});
$('clip-start').onchange=e=>{const c=selected();if(!c)return;snapshot();clips=moveClip(clips,c.id,Number(e.target.value));updateUI()};
function setFade(){const c=selected();if(!c)return;snapshot();clips=updateFade(clips,c.id,Number($('fade-in').value)/1000,Number($('fade-out').value)/1000);updateUI()}
$('fade-in').onchange=setFade;$('fade-out').onchange=setFade;
$('copy-clip').onclick=()=>{const c=selected();if(c){clipboard={...c};status('Copied selection. Place playhead, then Paste / Insert.')}};
$('paste-clip').onclick=()=>{if(!clipboard){status('Copy a master clip first.',true);return}snapshot();const c={...clipboard,id:genId()};clips=insertClip(clips,c,Number($('playhead').value)||0,true);selectedId=c.id;updateUI();status('Inserted copied clip; later clips shifted forward.')};
$('split-clip').onclick=()=>{const c=selected();if(!c)return;try{snapshot();clips=splitClip(clips,c.id,Number($('playhead').value));updateUI();status('Split selected clip at playhead.')}catch(err){undoStack.pop();status(err.message,true)}};
$('remove-clip').onclick=()=>{if(!selected())return;snapshot();clips=removeClip(clips,selectedId);selectedId=clips[0]?.id||null;updateUI()};
$('undo').onclick=()=>{if(undoStack.length){clips=undoStack.pop();selectedId=clips.some(c=>c.id===selectedId)?selectedId:null;updateUI();status('Undid previous clip edit.')}};
$('preview-join').onclick=$('join-play').onclick=()=>{const c=selected();if(c)playMaster(Math.max(0,clipEnd(c)-1),clipEnd(c)+2)};
function nextAtJoin(){
 const a=selected();if(!a)throw Error('Select the outgoing master clip');
 const ordered=[...clips].sort((x,y)=>x.masterStart-y.masterStart);
 const b=ordered[ordered.findIndex(x=>x.id===a.id)+1];
 if(!b)throw Error('Select a clip with a following clip');
 return {a,b};
}
$('crossfade-join').onclick=()=>{
 try{const {a}=nextAtJoin();const ms=Number($('crossfade-ms').value);
   const proposed=autoCrossfade(clips,a.id,ms/1000);snapshot();clips=proposed;updateUI();
   status('Equal-power overlap created at '+(ms||0)+' ms; later audio rippled. Undo restores the previous splice.');
 }catch(err){status(err.message,true)}
};
async function snapAtJoin(kind){
 if(busy)return;
 let sourceToRelease=null;
 try{
   busy=true;
   const {a,b}=nextAtJoin(),target=kind==='out'?a:b;
   const before=JSON.stringify(clips),selection=selectedId;
   const s=sourceById(target.sourceId);sourceToRelease=s;
   if(!s?.file)throw Error('Relink the selected source before snapping');
   const targetTime=kind==='out'?a.sourceOut:b.sourceIn;
   // Extra native samples retain the exact +/-12 ms search at file boundaries.
   const detail=await decodeSourceWindow(s,{startSec:Math.max(0,targetTime-.012-2/s.sampleRate),
     endSec:Math.min(s.duration,targetTime+.012+2/s.sampleRate),context:aud(),loadFullBuffer:bufferFor});
   const snap=findQuietZeroCrossing(detail.buffer,targetTime-detail.startSec,12);
   if(before!==JSON.stringify(clips)||selection!==selectedId||sourceById(target.sourceId)!==s)throw Error('Edit map changed while loading; retry at the current join.');
   if(!snap){status('No nearby zero crossing detected; join was not changed.',true);return}
   const sourceTime=quantize(detail.startSec+snap.timeSec,s.sampleRate);
   const proposed=kind==='out'?snapOutgoingEnd(clips,a.id,sourceTime):
     slipIncomingStart(clips,a.id,sourceTime,s.duration);
   snapshot();clips=proposed;
   s.buffer=null;
   updateUI();
   status('Applied '+kind.toUpperCase()+' snap: '+snap.shiftMs.toFixed(3)+' ms, nearby PCM RMS '+snap.rmsAtBoundary+'. Undo available.');
 }catch(err){status('Snap unavailable: '+err.message,true)}
 finally{busy=false;if(sourceToRelease)sourceToRelease.buffer=null}
}
$('snap-out').onclick=()=>snapAtJoin('out');
$('snap-in').onclick=()=>snapAtJoin('in');
$('sample-view').onclick=async()=>{
 if(busy)return;
 const c=selected();if(!c)return status('Select a clip first.',true);
 const list=[...clips].sort((a,b)=>a.masterStart-b.masterStart),next=list[list.findIndex(x=>x.id===c.id)+1];
 const before=JSON.stringify(clips),selection=selectedId,span=Number($('sample-span').value);
 try{
   busy=true;status('Loading original sample-detail windows…');
   const refs=[{clip:c,canvas:$('join-left'),start:Math.max(c.sourceIn,c.sourceOut-span),end:c.sourceOut,color:'#75bde9'},
    ...(next?[{clip:next,canvas:$('join-right'),start:next.sourceIn,end:Math.min(next.sourceOut,next.sourceIn+span),color:'#c79bf0'}]:[])];
   const modes=new Set();
   for(const ref of refs){
     const s=sourceById(ref.clip.sourceId);
     const detail=await decodeSourceWindow(s,{startSec:ref.start,endSec:ref.end,context:aud(),loadFullBuffer:bufferFor});
     if(before!==JSON.stringify(clips)||selection!==selectedId||span!==Number($('sample-span').value)||sourceById(ref.clip.sourceId)!==s)
      throw Error('Selection changed while loading; request detail again.');
     drawRawSamples(ref.canvas,detail.buffer,ref.start-detail.startSec,ref.end-detail.startSec,ref.color);
     modes.add(detail.mode);s.buffer=null;
   }
   $('join-message').textContent='Native samples loaded, '+Math.round(span*1000)+' ms window. Clip timing is stored against original samples. Use IN/OUT and START values for precision edits.';
   status('Sample detail · '+(modes.has('compatibility-full-source')?'native full-decode compatibility':'bounded original PCM windows')+' · source files unchanged.');
 }catch(err){status('Sample view: '+err.message,true)}
 finally{busy=false;for(const source of sources)source.buffer=null}
};
$('save-project').onclick=()=>{const obj=saveAssembly(sources,clips);const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='phase-assembly.phase.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Project map saved. Store original audio files beside the map.')};
$('load-project').onclick=()=>$('project-file').click();
$('project-file').onchange=async e=>{try{const p=restoreAssembly(JSON.parse(await e.target.files[0].text()));stop();
  sources=p.sources.map(x=>({...x,ready:false,file:null,pyramid:null,inSec:0,outSec:x.duration||0}));clips=p.clips;selectedId=clips[0]?.id||null;undoStack=[];updateUI();
  status('Map opened. Use Add Source(s) to relink files by exact name and size before playback/export.');}
 catch(err){status('Map import failed: '+err.message,true)}};
document.body.addEventListener('dragover',e=>e.preventDefault());
document.body.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer?.files?.length)addFiles([...e.dataTransfer.files])});
$('cancel-placement').onclick=()=>{cancelPlacement();status('Source placement canceled. No clips changed.');};
$('master-lane').addEventListener('dragover',e=>{if(!placement||!e.dataTransfer?.types.includes(sourceDragType))return;e.preventDefault();e.dataTransfer.dropEffect='copy';showPlacement(placementTime(e.clientX));});
$('master-lane').addEventListener('drop',e=>{if(!placement||e.dataTransfer?.getData(sourceDragType)!==placement)return;e.preventDefault();e.stopPropagation();placeSource(sourceById(placement),placementTime(e.clientX));});
$('master-lane').addEventListener('pointermove',e=>{if(placement)showPlacement(placementTime(e.clientX));});
$('master-lane').addEventListener('click',e=>{if(placement){e.preventDefault();e.stopPropagation();placeSource(sourceById(placement),placementTime(e.clientX));}},true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&placement){e.preventDefault();cancelPlacement();status('Source placement canceled. No clips changed.');return}
 if(/INPUT|TEXTAREA/.test(e.target?.tagName||''))return;
 if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();$('undo').click()}
 if(e.key===' '){e.preventDefault();$('play-master').click()}
});
updateUI();
