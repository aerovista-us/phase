// Phase 0.14.7 / S1a: pure, source-independent master export geometry.
// This is a contract and test baseline, NOT a full-length streaming WAV writer.
// Output samples are placed on ONE integer project frame grid for every chunk.
export const PCM16_STEREO_BYTES_PER_FRAME=4;
export const CLASSIC_RIFF_MAX_DATA_BYTES=0xffffffff-36;
const valid=(v)=>typeof v==='number'&&Number.isFinite(v);
const integer=(v)=>Number.isSafeInteger(v)&&v>0;

export function projectOutputFrameCount(clips,sampleRate){
 if(!Array.isArray(clips)||!clips.length)throw Error('Master requires at least one clip');
 if(!integer(sampleRate)||sampleRate<8000||sampleRate>384000)throw Error('Invalid output sample rate');
 let last=0;
 for(const clip of clips){
  if(!clip||![clip.masterStart,clip.sourceIn,clip.sourceOut].every(valid)||
   clip.masterStart<0||clip.sourceIn<0||clip.sourceOut<=clip.sourceIn)
   throw Error('Invalid clip geometry for full-master render');
  const end=clip.masterStart+clip.sourceOut-clip.sourceIn;
  if(!Number.isFinite(end)||end<0)throw Error('Master end cannot be represented');
  last=Math.max(last,end);
 }
 const frames=Math.ceil(last*sampleRate);
 if(!integer(frames))throw Error('Invalid master frame count');
 return frames;
}

// Rendering a region must NEVER compute this only from its currently audible
// clips: non-overlapping track groups would change volume between chunks.
export function globalMixNormalizationCount(items,{defaultGroup='master'}={}){
 if(!Array.isArray(items)||!items.length)throw Error('Global mix requires clips');
 const groups=new Set();
 items.forEach((x,i)=>{
  if(x?.group===null)groups.add('item:'+i);
  else groups.add('group:'+String(x?.group??defaultGroup));
 });
 return Math.max(1,groups.size);
}

export function createMasterRenderPlan(clips,{
 sampleRate=48000,chunkSeconds=4,channels=2,bytesPerSample=2,
 maxChunkSeconds=10,enforceClassicRiff=true
}={}){
 const frames=projectOutputFrameCount(clips,sampleRate);
 if(!integer(channels)||channels>8||!integer(bytesPerSample)||bytesPerSample>8)
  throw Error('Invalid output PCM format');
 if(!valid(chunkSeconds)||chunkSeconds<=0||!valid(maxChunkSeconds)||
  maxChunkSeconds<=0||chunkSeconds>maxChunkSeconds)
  throw Error('Invalid bounded render chunk duration');
 const chunkFrames=Math.max(1,Math.round(chunkSeconds*sampleRate));
 if(!integer(chunkFrames))throw Error('Invalid chunk frame count');
 const dataBytes=frames*channels*bytesPerSample;
 if(!Number.isSafeInteger(dataBytes))throw Error('Master WAV exceeds safe integer size');
 if(enforceClassicRiff&&dataBytes>CLASSIC_RIFF_MAX_DATA_BYTES)
  throw Error('Classic RIFF WAV 4 GiB limit exceeded; RF64 is not supported');
 const chunks=Math.ceil(frames/chunkFrames);
 const normalizationCount=globalMixNormalizationCount(clips);
 return Object.freeze({
  sampleRate,channels,bytesPerSample,
  totalFrames:frames,totalSeconds:frames/sampleRate,
  chunkFrames,chunkSeconds:chunkFrames/sampleRate,chunks,
  outputDataBytes:dataBytes,
  normalizationCount,masterGain:.92
 });
}

export function* masterFrameChunks(plan){
 if(!plan||!integer(plan.totalFrames)||!integer(plan.chunkFrames)||
  !integer(plan.sampleRate)||!integer(plan.chunks))
  throw Error('Invalid master render plan');
 let index=0;
 for(let startFrame=0;startFrame<plan.totalFrames;startFrame+=plan.chunkFrames){
  const endFrame=Math.min(plan.totalFrames,startFrame+plan.chunkFrames);
  yield Object.freeze({
   index:index++,startFrame,endFrame,
   frameCount:endFrame-startFrame,
   startSec:startFrame/plan.sampleRate,
   endSec:endFrame/plan.sampleRate,
   final:endFrame===plan.totalFrames
  });
 }
 if(index!==plan.chunks)throw Error('Render chunk count mismatch');
}

export function validateMasterChunkSequence(plan,chunks){
 let next=0,found=0;
 for(const chunk of chunks){
  if(chunk.index!==found||chunk.startFrame!==next||
   !integer(chunk.frameCount)||chunk.endFrame!==chunk.startFrame+chunk.frameCount||
   chunk.frameCount>plan.chunkFrames||chunk.endFrame>plan.totalFrames)
   throw Error('Missing, duplicate or overlapping master output frames');
  next=chunk.endFrame;found++;
 }
 if(next!==plan.totalFrames||found!==plan.chunks)
  throw Error('Master render is missing final frames');
 return true;
}
