// Pure, optional precision helpers for Master Assembly. No source audio modification.
import {clipDuration,clipEnd,quantize} from './assembly-model.js';

const EPS=1e-5;
function requireRate(buffer){if(!buffer||buffer.sampleRate<=0||buffer.length<2||buffer.numberOfChannels<1)throw Error('Decoded PCM required');}
export function findQuietZeroCrossing(buffer,targetSec,radiusMs=12){
 requireRate(buffer);
 if(!Number.isFinite(targetSec)||!Number.isFinite(radiusMs)||radiusMs<=0||radiusMs>50)throw Error('Invalid snap settings');
 const sr=buffer.sampleRate,target=Math.round(targetSec*sr);
 const radius=Math.max(1,Math.round(radiusMs/1000*sr));
 const lo=Math.max(1,target-radius),hi=Math.min(buffer.length-1,target+radius);
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 let best=null;
 for(let i=lo;i<=hi;i++){
   let power=0;
   for(const ch of channels){const a=ch[i-1],b=ch[i];power+=a*a+b*b;}
   // A sign change in any channel is sufficient; stereo channels are evaluated together for amplitude.
   const crossed=channels.some(ch=>ch[i-1]===0||ch[i]===0||(ch[i-1]<0)!==(ch[i]<0));
   if(!crossed)continue;
   const rms=Math.sqrt(power/(2*channels.length));
   const distance=Math.abs(i-target)/radius;
   // Penalize loud discontinuities without wandering far from intended musical position.
   const score=rms + 0.025*distance;
   if(!best||score<best.score)best={sampleIndex:i,timeSec:i/sr,shiftMs:(i-target)*1000/sr,rmsAtBoundary:rms,score};
 }
 return best?{sampleIndex:best.sampleIndex,timeSec:best.timeSec,
   shiftMs:Number(best.shiftMs.toFixed(3)),rmsAtBoundary:Number(best.rmsAtBoundary.toFixed(5))}:null;
}
function neighbors(clips,id){
 const sorted=[...clips].sort((a,b)=>a.masterStart-b.masterStart);
 const index=sorted.findIndex(c=>c.id===id);
 if(index<0)throw Error('Select a clip first');
 if(index===sorted.length-1)throw Error('No next clip to join');
 const a=sorted[index],b=sorted[index+1];
 const gap=b.masterStart-clipEnd(a);
 if(Math.abs(gap)>.005)throw Error('Join must be adjacent (within 5 ms). Move clips before crossfading.');
 return {a,b};
}
export function autoCrossfade(clips,id,seconds=.05){
 const {a,b}=neighbors(clips,id);
 const duration=Number(seconds);
 if(!Number.isFinite(duration)||duration<.005||duration>.25)throw Error('Crossfade must be between 5 and 250 ms');
 const limit=Math.min(clipDuration(a),clipDuration(b))*.45;
 if(duration>limit)throw Error('Crossfade is too long for these clips');
 if((a.fadeOutCurve||a.fadeCurve)==='equalPower'||(b.fadeInCurve||b.fadeCurve)==='equalPower')throw Error('Crossfade already set at this join; undo before applying again');
 // Shift the next and later clips left, preserving downstream relationships.
 const shifted=clips.map(c=>{
   if(c.id===a.id)return {...c,fadeOutSec:duration,fadeOutCurve:'equalPower'};
   if(c.masterStart>=b.masterStart-EPS){
     const t=quantize(c.masterStart-duration,c.sourceRate||48000);
     if(t<0)throw Error('Cannot move timeline before zero');
     return {...c,masterStart:t,...(c.id===b.id?{fadeInSec:duration,fadeInCurve:'equalPower'}:{})};
   }
   return c;
 });
 return shifted.sort((x,y)=>x.masterStart-y.masterStart);
}
export function snapOutgoingEnd(clips,id,timeSec){
 const {a,b}=neighbors(clips,id);
 if((a.fadeOutCurve||a.fadeCurve)==='equalPower'||(b.fadeInCurve||b.fadeCurve)==='equalPower')throw Error('Undo crossfade before adjusting endpoints');
 const end=quantize(timeSec,a.sourceRate||48000),shift=end-a.sourceOut;
 if(!Number.isFinite(end)||end<=a.sourceIn||Math.abs(shift)>.05)throw Error('Snap exceeds valid source range');
 // The following clips ripple by precisely the number of samples added/removed.
 const result=clips.map(c=>{
   if(c.id===a.id)return {...c,sourceOut:end};
   if(c.masterStart>=b.masterStart-EPS){
     const t=quantize(c.masterStart+shift,c.sourceRate||48000);
     if(t<0)throw Error('Snap moves following clip before timeline start');
     return {...c,masterStart:t};
   }
   return c;
 });
 return result.sort((x,y)=>x.masterStart-y.masterStart);
}
export function slipIncomingStart(clips,id,newIn,sourceDuration){
 const {b}=neighbors(clips,id),sr=b.sourceRate||48000;
 if((b.fadeInCurve||b.fadeCurve)==='equalPower')throw Error('Undo crossfade before slip editing');
 const offset=quantize(newIn,sr)-b.sourceIn;
 if(Math.abs(offset)>.05||b.sourceIn+offset<0||b.sourceOut+offset>sourceDuration)
   throw Error('Incoming source cannot slip within available audio');
 return clips.map(c=>c.id===b.id?
   {...c,sourceIn:quantize(c.sourceIn+offset,sr),sourceOut:quantize(c.sourceOut+offset,sr)}:c);
}
