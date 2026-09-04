export function projectPlaybackWindow(trackStart,bufferDuration,from=0,to=Infinity){
  const start=Number(trackStart)||0,duration=Math.max(0,Number(bufferDuration)||0),p0=Math.max(0,Number(from)||0),p1=Number.isFinite(to)?Math.max(p0,to):Infinity;
  const trackEnd=start+duration,overlapStart=Math.max(p0,start),overlapEnd=Math.min(p1,trackEnd);
  if(overlapEnd<=overlapStart)return null;
  return{delay:overlapStart-p0,sourceOffset:overlapStart-start,duration:overlapEnd-overlapStart,projectStart:overlapStart,projectEnd:overlapEnd};
}

export function phraseLoopAt(time,bpm,bars=8){
  const beat=60/Math.max(1,Number(bpm)||120),span=beat*4*Math.max(1,Number(bars)||8),t=Math.max(0,Number(time)||0),start=Math.floor(t/span)*span;
  return{start,end:start+span,duration:span,bars:Math.max(1,Number(bars)||8)};
}

export function clampPlayhead(time,viewDuration){return Math.max(0,Math.min(Math.max(0,Number(viewDuration)||0),Number(time)||0))}
