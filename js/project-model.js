import{stemProjectMetadata,applyStemProjectMetadata}from'./stems.js';
import{fileIdentity,normalizeIdentity}from'./source-identity.js';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const num=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const finiteOrNull=v=>v!=null&&Number.isFinite(Number(v))?Number(v):null;
const meterBeats=v=>[3,4,6].includes(Number(v))?Number(v):4;
const cloneMarkers=markers=>Array.isArray(markers)?markers.map((m,i)=>({beat:Number.isInteger(m.beat)?m.beat:i,sourceTime:num(m.sourceTime),targetTime:num(m.targetTime),downbeat:!!m.downbeat,locked:!!m.locked,confidence:num(m.confidence,1)})):[];

function analysisSummary(a){
  if(!a)return null;
  return{bpm:num(a.bpm,0),rawBpm:num(a.rawBpm,a.bpm||0),tempoOctaveAdjusted:!!a.tempoOctaveAdjusted,tempoAlternates:Array.isArray(a.tempoAlternates)?a.tempoAlternates.map(x=>({bpm:num(x.bpm),score:num(x.score)})):[],tempoConfidence:num(a.tempoConfidence,0),meter:a.meter||'4/4',beatsPerBar:meterBeats(a.beatsPerBar),meterConfidence:num(a.meterConfidence,0),downbeatPhase:Number.isInteger(a.downbeatPhase)?a.downbeatPhase:0,downbeatConfidence:num(a.downbeatConfidence,0),key:a.key||null,keyRoot:Number.isInteger(a.keyRoot)?a.keyRoot:null,keyMode:a.keyMode||null,keyConfidence:num(a.keyConfidence,0)};
}

export function snapshotProject(state){
  const rs=finiteOrNull(state.regionStart),re=finiteOrNull(state.regionEnd);
  return{
    app:'EchoVerse Phase',version:12,savedAt:new Date().toISOString(),
    bpm:num(state.bpm,120),meterPreference:state.meterPreference||'auto',meter:state.meter||'4/4',beatsPerBar:meterBeats(state.beatsPerBar),viewDuration:num(state.viewDuration,60),pxPerSecond:num(state.pxPerSecond,8),snapMode:state.snapMode||'beat',
    playheadTime:num(state.playheadTime,0),loopBars:num(state.loopBars,8),loopEnabled:!!state.loopEnabled,
    regionStart:rs==null?null:Math.max(0,rs),regionEnd:re==null?null:Math.max(0,re),
    tracks:(state.tracks||[]).map(t=>({
      label:t.label,name:t.name,fileName:t.file?.name||t.fileName||null,fileIdentity:fileIdentity(t.file)||normalizeIdentity(t.fileIdentity),sourceBpm:num(t.sourceBpm,120),pitch:num(t.pitch,0),timelineOffset:num(t.timelineOffset,0),meterPreference:t.meterPreference||state.meterPreference||'auto',meter:t.meter||t.analysis?.meter||'4/4',beatsPerBar:meterBeats(t.beatsPerBar??t.analysis?.beatsPerBar),
      trimIn:Math.max(0,num(t.trimIn,0)),trimOut:finiteOrNull(t.trimOut)==null?null:Math.max(0,finiteOrNull(t.trimOut)),
      fadeInStart:finiteOrNull(t.fadeInStart),fadeInEnd:finiteOrNull(t.fadeInEnd),fadeOutStart:finiteOrNull(t.fadeOutStart),fadeOutEnd:finiteOrNull(t.fadeOutEnd),
      gridMode:t.gridMode||'manual',alignMarker:Number.isInteger(t.alignMarker)?t.alignMarker:null,gainDb:num(t.gainDb,0),mute:!!t.mute,solo:!!t.solo,
      ...stemProjectMetadata(t),analysis:analysisSummary(t.analysis),markers:cloneMarkers(t.markers)
    }))
  };
}

export function validateProject(data){
  if(!data||data.app!=='EchoVerse Phase'||!Array.isArray(data.tracks))throw new Error('Not an EchoVerse Phase project map');
  return data;
}

export function applyTrackSnapshot(track,src,{applyMarkers=true}={}){
  if(!track||!src)return track;
  track.fileName=src.fileName||track.fileName||null;track.fileIdentity=fileIdentity(track.file)||normalizeIdentity(src.fileIdentity)||track.fileIdentity||null;
  track.name=src.name||track.name;
  track.sourceBpm=clamp(num(src.sourceBpm,track.sourceBpm||120),40,240);
  track.pitch=clamp(num(src.pitch,track.pitch||0),-24,24);
  track.timelineOffset=num(src.timelineOffset,track.timelineOffset||0);
  track.meterPreference=src.meterPreference||track.meterPreference||'auto';track.meter=src.meter||track.meter||'4/4';track.beatsPerBar=meterBeats(src.beatsPerBar??track.beatsPerBar);
  track.trimIn=Math.max(0,num(src.trimIn,track.trimIn||0));
  const out=finiteOrNull(src.trimOut);track.trimOut=out==null?null:Math.max(track.trimIn,out);
  for(const key of['fadeInStart','fadeInEnd','fadeOutStart','fadeOutEnd'])track[key]=finiteOrNull(src[key]);
  track.gridMode=src.gridMode||track.gridMode||'manual';
  track.alignMarker=Number.isInteger(src.alignMarker)?src.alignMarker:track.alignMarker;
  track.gainDb=clamp(num(src.gainDb,track.gainDb||0),-24,6);
  track.mute=!!src.mute;track.solo=!!src.solo;applyStemProjectMetadata(track,src);
  if(src.analysis)track.analysis={...(track.analysis||{}),...src.analysis};
  if(applyMarkers&&Array.isArray(src.markers)&&src.markers.length)track.markers=cloneMarkers(src.markers);
  return track;
}

export function applyProjectSnapshot(state,data,{loadedOnly=true}={}){
  validateProject(data);
  state.bpm=clamp(num(data.bpm,state.bpm||120),40,240);state.meterPreference=data.meterPreference||state.meterPreference||'auto';state.meter=data.meter||state.meter||'4/4';state.beatsPerBar=meterBeats(data.beatsPerBar??state.beatsPerBar);
  state.viewDuration=Math.max(10,num(data.viewDuration,state.viewDuration||60));
  state.pxPerSecond=clamp(num(data.pxPerSecond,state.pxPerSecond||8),5,28);
  if(typeof data.snapMode==='string')state.snapMode=data.snapMode;
  state.playheadTime=Math.max(0,num(data.playheadTime,state.playheadTime||0));
  state.loopBars=[4,8,16,32].includes(num(data.loopBars,state.loopBars||8))?num(data.loopBars,state.loopBars||8):8;
  state.loopEnabled=!!data.loopEnabled;
  const rs=finiteOrNull(data.regionStart),re=finiteOrNull(data.regionEnd);state.regionStart=rs==null?null:Math.max(0,rs);state.regionEnd=re==null?null:Math.max(0,re);
  data.tracks.forEach((src,i)=>{const t=state.tracks?.[i];if(!t)return;applyTrackSnapshot(t,src,{applyMarkers:!loadedOnly||!!t.buffer})});
  return state;
}

export function editableFingerprint(state){
  const s=snapshotProject(state);delete s.savedAt;
  s.tracks.forEach(t=>{delete t.name;delete t.fileName;delete t.fileIdentity;delete t.analysis;if(t.stems)for(const stem of Object.values(t.stems)){delete stem.fileName;delete stem.identity}});
  return JSON.stringify(s);
}

export function renderFingerprint(state){
  return JSON.stringify((state.tracks||[]).map(t=>({pitch:num(t.pitch,0),timelineOffset:num(t.timelineOffset,0),useStems:!!t.useStems,markers:cloneMarkers(t.markers).map(m=>({sourceTime:m.sourceTime,targetTime:m.targetTime}))})));
}
