// Pure drag geometry shared by Phase's two editing workflows.
export const DRAG_THRESHOLD_PX=5;
export function dragSeconds(start,deltaPixels,pixelsPerSecond,{min=-Infinity,max=Infinity}={}){
 if(!Number.isFinite(start)||!Number.isFinite(deltaPixels)||!Number.isFinite(pixelsPerSecond)||pixelsPerSecond<=0)
  throw Error('Invalid timeline drag geometry');
 return Math.min(max,Math.max(min,start+deltaPixels/pixelsPerSecond));
}
export function draggedBeyondThreshold(deltaPixels,threshold=DRAG_THRESHOLD_PX){
 return Number.isFinite(deltaPixels)&&Math.abs(deltaPixels)>threshold;
}
export function timelinePixelsPerSecond(rectWidth,viewDuration){
 if(!Number.isFinite(rectWidth)||rectWidth<=0||!Number.isFinite(viewDuration)||viewDuration<=0)
  throw Error('Timeline dimensions unavailable');
 return rectWidth/viewDuration;
}
