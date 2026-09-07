const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const round=(v,d=3)=>Number(num(v).toFixed(d));

export function audioBufferBytes(buffer){
  if(!buffer)return 0;
  const channels=Math.max(1,num(buffer.numberOfChannels,2)),length=num(buffer.length,-1);
  if(length>=0)return Math.max(0,Math.round(length))*channels*4;
  return Math.max(0,Math.ceil(num(buffer.duration,0)*Math.max(1,num(buffer.sampleRate,44100))*channels*4));
}
export function trackAudioMemoryBytes(track){
  const seen=new Set(),buffers=[];const add=b=>{if(b&&!seen.has(b)){seen.add(b);buffers.push(b)}};
  add(track?.buffer);add(track?.renderedBuffer);
  for(const stem of Object.values(track?.stems||{})){add(stem?.buffer);add(stem?.renderedBuffer)}
  return buffers.reduce((sum,b)=>sum+audioBufferBytes(b),0);
}

export function markerGridIssues(track,tolerance=.0005){
  const markers=Array.isArray(track?.markers)?track.markers:[],issues=[];
  if(track?.buffer&&!markers.length)issues.push('NO_GRID');
  for(let i=1;i<markers.length;i++){
    const a=markers[i-1],b=markers[i];
    if(num(b.sourceTime)<num(a.sourceTime)-tolerance){issues.push(`SOURCE_TIME_REVERSED@${i+1}`);break}
    if(num(b.targetTime)<=num(a.targetTime)+tolerance){issues.push(`TARGET_TIME_NOT_INCREASING@${i+1}`);break}
  }
  if(markers.some(m=>num(m.sourceTime)<-tolerance))issues.push('NEGATIVE_SOURCE_TIME');
  return issues;
}

export function trackDiagnostics(track){
  const buffer=track?.buffer||null,analysis=track?.analysis||null,stems=track?.stems&&typeof track.stems==='object'?Object.values(track.stems):[],loadedStems=stems.filter(s=>s?.buffer),warnings=[],memoryBytes=trackAudioMemoryBytes(track);
  const gridIssues=markerGridIssues(track);warnings.push(...gridIssues);
  if(buffer&&track?.duration&&Math.abs(num(track.duration)-num(buffer.duration))>.05)warnings.push('SOURCE_DURATION_MISMATCH');
  if(loadedStems.some(s=>s.durationWarning))warnings.push('STEM_DURATION_WARNING');
  if(track?.useStems&&!loadedStems.length)warnings.push('STEM_MODE_WITHOUT_STEMS');
  if(track?.renderedBuffer&&Number.isFinite(track?.renderedOffset)&&Math.abs(num(track.renderedOffset)-num(track.timelineOffset))>.0005)warnings.push('RENDERED_POSITION_STALE');
  return{
    id:track?.id??null,label:track?.label||'TRACK',loaded:!!buffer,fileName:track?.file?.name||track?.fileName||null,
    duration:buffer?round(buffer.duration):round(track?.duration),sampleRate:buffer?num(buffer.sampleRate):null,channels:buffer?num(buffer.numberOfChannels):null,memoryBytes,
    gridMode:track?.gridMode||null,markers:Array.isArray(track?.markers)?track.markers.length:0,gridIssues,
    analysis:analysis?{bpm:round(track?.sourceBpm||analysis.bpm,2),meter:track?.meter||analysis.meter||null,key:analysis.key||null,tempoConfidence:round(analysis.tempoConfidence||0,2),meterConfidence:round(analysis.meterConfidence||0,2),downbeatConfidence:round(analysis.downbeatConfidence||0,2),keyConfidence:round(analysis.keyConfidence||0,2)}:null,
    mix:{gainDb:round(track?.gainDb||0,1),mute:!!track?.mute,solo:!!track?.solo,trimIn:round(track?.trimIn||0),trimOut:track?.trimOut==null?null:round(track.trimOut),timelineOffset:round(track?.timelineOffset||0)},
    stems:{enabled:!!track?.useStems,loaded:loadedStems.map(s=>s.id),muted:loadedStems.filter(s=>s.mute).map(s=>s.id),solo:loadedStems.filter(s=>s.solo&&!s.mute).map(s=>s.id),warnings:loadedStems.filter(s=>s.durationWarning).map(s=>s.id)},
    render:{hasRendered:!!track?.renderedBuffer,renderedAt:track?.renderedAt||null,renderedOffset:Number.isFinite(track?.renderedOffset)?round(track.renderedOffset):null,quality:track?.renderStats?.quality||track?.renderQuality||null,reused:!!track?.renderStats?.reused},
    warnings:[...new Set(warnings)]
  };
}

export function projectDiagnostics(state,environment={}){
  const tracks=(state?.tracks||[]).map(trackDiagnostics),warnings=[],audioMemoryBytes=tracks.reduce((sum,t)=>sum+(t.memoryBytes||0),0),memoryWarnBytes=Math.max(128*1024*1024,num(environment.audioMemoryWarnBytes,512*1024*1024));
  for(const t of tracks)for(const w of t.warnings)warnings.push(`${t.label}:${w}`);
  if(state?.dirty)warnings.push('VISUAL_CHANGES_PENDING');
  if(state?.rendering)warnings.push('RENDER_IN_PROGRESS');
  if(audioMemoryBytes>memoryWarnBytes)warnings.push('AUDIO_MEMORY_HIGH');
  if(environment.serviceWorker===false)warnings.push('SERVICE_WORKER_UNAVAILABLE');
  if(environment.worker===false)warnings.push('WEB_WORKER_UNAVAILABLE');
  if(environment.webAudio===false)warnings.push('WEB_AUDIO_UNAVAILABLE');
  if(environment.offlineAudio===false)warnings.push('OFFLINE_AUDIO_UNAVAILABLE');
  return{
    generatedAt:new Date().toISOString(),app:'EchoVerse Phase',version:String(environment.version||''),
    environment:{...environment},project:{bpm:round(state?.bpm||120,2),meter:state?.meter||'4/4',dirty:!!state?.dirty,rendering:!!state?.rendering,playing:!!state?.playing,viewDuration:round(state?.viewDuration||0),zoomPxPerSecond:round(state?.pxPerSecond||0),audioMemoryBytes,memoryWarnBytes},
    tracks,warnings:[...new Set(warnings)],healthy:warnings.length===0
  };
}

export function diagnosticSeverity(report){
  const warnings=report?.warnings||[];
  if(warnings.some(w=>/UNAVAILABLE|REVERSED|NOT_INCREASING|WITHOUT_STEMS/.test(w)))return'error';
  if(warnings.length)return'warning';
  return'ok';
}
