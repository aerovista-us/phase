const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function normalizeRegion(a,b,viewDuration=Infinity,minDuration=.02){
  const view=Number.isFinite(Number(viewDuration))?Math.max(0,Number(viewDuration)):Infinity;
  let start=clamp(Number(a)||0,0,view),end=clamp(Number(b)||0,0,view);
  if(end<start)[start,end]=[end,start];
  if(end-start<minDuration)return null;
  return{start,end,duration:end-start};
}

export function snapRegionTime(time,bpm,mode='beat'){
  const t=Math.max(0,Number(time)||0);
  if(mode==='off')return t;
  const beat=60/Math.max(1,Number(bpm)||120);
  const bars=mode==='bar'?1:mode==='8bar'?8:mode==='16bar'?16:mode==='32bar'?32:0;
  const step=bars?beat*4*bars:beat;
  return Math.max(0,Math.round(t/step)*step);
}

export function regionFromDrag(anchor,current,{viewDuration=Infinity,bpm=120,snapMode='beat',free=false,minDuration=.02}={}){
  const a=free?Math.max(0,Number(anchor)||0):snapRegionTime(anchor,bpm,snapMode);
  const b=free?Math.max(0,Number(current)||0):snapRegionTime(current,bpm,snapMode);
  return normalizeRegion(a,b,viewDuration,minDuration);
}
