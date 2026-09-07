import{audioBufferBytes,trackAudioMemoryBytes}from'./diagnostics.js';

const MB=1024*1024,GB=1024*MB;
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function resourceThresholds(deviceMemoryGB=null){
  const gb=num(deviceMemoryGB,0);
  if(!gb)return{cautionBytes:1*GB,severeBytes:1.75*GB};
  const caution=Math.max(512*MB,Math.min(1.5*GB,gb*GB*.22));
  const severe=Math.max(768*MB,Math.min(2.5*GB,gb*GB*.32));
  return{cautionBytes:Math.round(caution),severeBytes:Math.round(severe)};
}

export function projectResidentBytes(projectState){
  return(projectState?.tracks||[]).reduce((sum,t)=>sum+trackAudioMemoryBytes(t),0);
}

export function activeSourceBuffers(track){
  const stems=Object.values(track?.stems||{}).filter(s=>s?.buffer&&!s?.mute);
  const solo=stems.filter(s=>s.solo);
  if(track?.useStems&&stems.length)return(solo.length?solo:stems).map(s=>s.buffer);
  return track?.buffer?[track.buffer]:[];
}

export function estimatedOutputRatio(track){
  const markers=Array.isArray(track?.markers)?track.markers:[];
  if(markers.length<2)return 1;
  const first=markers[0],last=markers.at(-1),src=num(last.sourceTime)-num(first.sourceTime),dst=num(last.targetTime)-num(first.targetTime);
  if(src<=.001||dst<=.001)return 1;
  return Math.max(.25,Math.min(4,dst/src));
}

export function estimateRenderPeakBytes(projectState){
  const resident=projectResidentBytes(projectState);let extraPeak=0,sourceBytes=0;
  for(const track of projectState?.tracks||[]){
    const ratio=estimatedOutputRatio(track);
    for(const buffer of activeSourceBuffers(track)){
      const input=audioBufferBytes(buffer),output=Math.round(input*ratio),extra=input+2*output;
      sourceBytes+=input;extraPeak=Math.max(extraPeak,extra);
    }
  }
  return{residentBytes:resident,sourceBytes,workingBytes:extraPeak,projectedBytes:resident+extraPeak};
}

export function estimateSeparationPeakBytes(projectState,track){
  const resident=projectResidentBytes(projectState),base=audioBufferBytes(track?.buffer);
  // Four decoded stem buffers plus provider/result blob overhead are approximated as five source-sized copies.
  const working=base*5;
  return{residentBytes:resident,sourceBytes:base,workingBytes:working,projectedBytes:resident+working};
}

export function classifyResourceUse(estimate,{deviceMemoryGB=null}={}){
  const thresholds=resourceThresholds(deviceMemoryGB),projected=num(estimate?.projectedBytes);
  const level=projected>=thresholds.severeBytes?'severe':projected>=thresholds.cautionBytes?'caution':'ok';
  return{level,projectedBytes:projected,...thresholds};
}
