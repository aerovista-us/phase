const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const num=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const cloneMarkers=markers=>Array.isArray(markers)?markers.map((m,i)=>({beat:Number.isInteger(m.beat)?m.beat:i,sourceTime:num(m.sourceTime),targetTime:num(m.targetTime),downbeat:!!m.downbeat,locked:!!m.locked,confidence:num(m.confidence,1)})):[];

function analysisSummary(a){
  if(!a)return null;
  return{bpm:num(a.bpm,0),tempoConfidence:num(a.tempoConfidence,0),downbeatPhase:Number.isInteger(a.downbeatPhase)?a.downbeatPhase:0,downbeatConfidence:num(a.downbeatConfidence,0),key:a.key||null,keyRoot:Number.isInteger(a.keyRoot)?a.keyRoot:null,keyMode:a.keyMode||null,keyConfidence:num(a.keyConfidence,0)};
}

export function snapshotProject(state){
  return{
    app:'EchoVerse Phase',version:5,savedAt:new Date().toISOString(),
    bpm:num(state.bpm,120),viewDuration:num(state.viewDuration,60),pxPerSecond:num(state.pxPerSecond,8),snapMode:state.snapMode||'beat',
    tracks:(state.tracks||[]).map(t=>({
      label:t.label,name:t.name,fileName:t.file?.name||t.fileName||null,sourceBpm:num(t.sourceBpm,120),pitch:num(t.pitch,0),timelineOffset:num(t.timelineOffset,0),
      gridMode:t.gridMode||'manual',alignMarker:Number.isInteger(t.alignMarker)?t.alignMarker:null,gainDb:num(t.gainDb,0),mute:!!t.mute,solo:!!t.solo,
      analysis:analysisSummary(t.analysis),markers:cloneMarkers(t.markers)
    }))
  };
}

export function validateProject(data){
  if(!data||data.app!=='EchoVerse Phase'||!Array.isArray(data.tracks))throw new Error('Not an EchoVerse Phase project map');
  return data;
}

export function applyTrackSnapshot(track,src,{applyMarkers=true}={}){
  if(!track||!src)return track;
  track.fileName=src.fileName||track.fileName||null;
  track.name=src.name||track.name;
  track.sourceBpm=clamp(num(src.sourceBpm,track.sourceBpm||120),40,240);
  track.pitch=clamp(num(src.pitch,track.pitch||0),-24,24);
  track.timelineOffset=num(src.timelineOffset,track.timelineOffset||0);
  track.gridMode=src.gridMode||track.gridMode||'manual';
  track.alignMarker=Number.isInteger(src.alignMarker)?src.alignMarker:track.alignMarker;
  track.gainDb=clamp(num(src.gainDb,track.gainDb||0),-24,6);
  track.mute=!!src.mute;track.solo=!!src.solo;
  if(src.analysis)track.analysis={...(track.analysis||{}),...src.analysis};
  if(applyMarkers&&Array.isArray(src.markers)&&src.markers.length)track.markers=cloneMarkers(src.markers);
  return track;
}

export function applyProjectSnapshot(state,data,{loadedOnly=true}={}){
  validateProject(data);
  state.bpm=clamp(num(data.bpm,state.bpm||120),40,240);
  state.viewDuration=Math.max(10,num(data.viewDuration,state.viewDuration||60));
  state.pxPerSecond=clamp(num(data.pxPerSecond,state.pxPerSecond||8),5,28);
  if(typeof data.snapMode==='string')state.snapMode=data.snapMode;
  data.tracks.forEach((src,i)=>{
    const t=state.tracks?.[i];if(!t)return;
    applyTrackSnapshot(t,src,{applyMarkers:!loadedOnly||!!t.buffer});
  });
  return state;
}

export function editableFingerprint(state){
  const s=snapshotProject(state);delete s.savedAt;
  s.tracks.forEach(t=>{delete t.name;delete t.fileName;delete t.analysis;});
  return JSON.stringify(s);
}
