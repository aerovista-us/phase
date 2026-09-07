const finite=v=>v!=null&&Number.isFinite(Number(v))?Number(v):null;
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));

export function regionOnTrack(offset,duration,regionStart,regionEnd,minDuration=.02){
  const start=Number(offset)||0,d=Math.max(0,Number(duration)||0,end=start+d,r0=Math.max(0,Number(regionStart)||0),r1=Math.max(r0,Number(regionEnd)||0),g0=Math.max(start,r0),g1=Math.min(end,r1);
  if(g1-g0<minDuration)return null;
  return{start:g0-start,end:g1-start,duration:g1-g0,projectStart:g0,projectEnd:g1};
}

export function normalizeFades(item={}){
  const fi0=finite(item.fadeInStart),fi1=finite(item.fadeInEnd),fo0=finite(item.fadeOutStart),fo1=finite(item.fadeOutEnd);
  return{
    fadeInStart:fi0!=null&&fi1!=null&&fi1>fi0?fi0:null,
    fadeInEnd:fi0!=null&&fi1!=null&&fi1>fi0?fi1:null,
    fadeOutStart:fo0!=null&&fo1!=null&&fo1>fo0?fo0:null,
    fadeOutEnd:fo0!=null&&fo1!=null&&fo1>fo0?fo1:null
  };
}

export function envelopeGainAtLocal(local,item={}){
  const t=Number(local)||0,f=normalizeFades(item);let g=1;
  if(f.fadeInStart!=null){if(t<=f.fadeInStart)g*=0;else if(t<f.fadeInEnd)g*=clamp((t-f.fadeInStart)/(f.fadeInEnd-f.fadeInStart))}
  if(f.fadeOutStart!=null){if(t>=f.fadeOutEnd)g*=0;else if(t>f.fadeOutStart)g*=clamp(1-(t-f.fadeOutStart)/(f.fadeOutEnd-f.fadeOutStart))}
  return clamp(g);
}

export function envelopePoints(item,projectStart,projectEnd){
  const p0=Number(projectStart)||0,p1=Math.max(p0,Number(projectEnd)||p0),offset=Number(item?.offset)||0,f=normalizeFades(item),times=[p0,p1];
  for(const local of[f.fadeInStart,f.fadeInEnd,f.fadeOutStart,f.fadeOutEnd])if(local!=null){const p=offset+local;if(p>p0&&p<p1)times.push(p)}
  return[...new Set(times.sort((a,b)=>a-b))].map(projectTime=>({projectTime,time:projectTime-p0,gain:envelopeGainAtLocal(projectTime-offset,f)}));
}

export function applyGainEnvelope(param,baseGain,item,projectStart,projectEnd,audioStartTime){
  const points=envelopePoints(item,projectStart,projectEnd),base=Math.max(0,Number(baseGain)||0),t0=Number(audioStartTime)||0;if(!points.length)return;
  param.cancelScheduledValues?.(t0);param.setValueAtTime(base*points[0].gain,t0);
  for(let i=1;i<points.length;i++)param.linearRampToValueAtTime(base*points[i].gain,t0+points[i].time);
}
