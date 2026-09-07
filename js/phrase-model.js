const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const bpbOf=track=>[3,4,6].includes(Number(track?.analysis?.beatsPerBar??track?.beatsPerBar))?Number(track?.analysis?.beatsPerBar??track?.beatsPerBar):4;
const phaseOf=track=>{const b=bpbOf(track),p=Number(track?.analysis?.downbeatPhase);if(Number.isInteger(p))return((p%b)+b)%b;const i=track?.markers?.findIndex(m=>m.downbeat);return i>=0?i%b:0};
const weight=b=>Math.max(0,(Number(b?.accent)||0)*.55+(Number(b?.lowAccent)||0)*.65+(Number(b?.highAccent)||0)*.12);

export function barFeatures(track){
  const beats=track?.analysis?.beats||[],bpb=bpbOf(track),phase=phaseOf(track),out=[];
  for(let start=phase;start<beats.length;start+=bpb){const slice=beats.slice(start,start+bpb);if(slice.length<Math.max(2,Math.ceil(bpb/2)))break;const vals=slice.map(weight),mean=vals.reduce((a,b)=>a+b,0)/vals.length,max=Math.max(...vals),low=slice.reduce((s,b)=>s+(Number(b.lowAccent)||0),0)/slice.length,high=slice.reduce((s,b)=>s+(Number(b.highAccent)||0),0)/slice.length;out.push({bar:out.length+1,beatIndex:start,time:Number(beats[start]?.time)||0,mean,max,low,high})}
  return out;
}
function avg(xs,key){return xs.length?xs.reduce((s,x)=>s+(Number(x[key])||0),0)/xs.length:0}
export function phraseBoundaryScore(features,index,{windowBars=2}={}){
  if(index<=0||index>=features.length)return 0;const left=features.slice(Math.max(0,index-windowBars),index),right=features.slice(index,Math.min(features.length,index+windowBars));if(!left.length||!right.length)return 0;
  const energy=Math.abs(avg(right,'mean')-avg(left,'mean'))/(Math.max(.00001,avg(right,'mean')+avg(left,'mean'))),low=Math.abs(avg(right,'low')-avg(left,'low'))/(Math.max(.00001,avg(right,'low')+avg(left,'low'))),high=Math.abs(avg(right,'high')-avg(left,'high'))/(Math.max(.00001,avg(right,'high')+avg(left,'high'))),attack=Math.max(0,(features[index]?.max||0)-avg(left,'max'))/(Math.max(.00001,(features[index]?.max||0)+avg(left,'max')));return clamp(energy*.45+low*.22+high*.13+attack*.2)}

export function suggestPhraseBoundaries(track,{minBars=4,maxSuggestions=10}={}){
  const features=barFeatures(track);if(features.length<3)return[];const raw=[];
  for(let i=1;i<features.length;i++){
    const novelty=phraseBoundaryScore(features,i),bar=i+1,structural=(i%32===0?.22:i%16===0?.18:i%8===0?.14:i%4===0?.07:0),score=clamp(novelty+structural);raw.push({bar,beatIndex:features[i].beatIndex,time:features[i].time,novelty,structural,score})
  }
  raw.sort((a,b)=>b.score-a.score);const chosen=[];
  for(const item of raw){if(item.score<.12)continue;if(chosen.some(x=>Math.abs(x.bar-item.bar)<minBars))continue;chosen.push(item);if(chosen.length>=maxSuggestions)break}
  return chosen.sort((a,b)=>a.bar-b.bar).map((x,i)=>({...x,rank:i+1,confidence:clamp(x.score/.55)}));
}

export function nearestPhraseSuggestion(suggestions,time,{direction=0}={}){
  const list=Array.isArray(suggestions)?suggestions:[];if(!list.length)return null;const t=Math.max(0,Number(time)||0);if(direction>0)return list.find(x=>x.time>t+.001)||list.at(-1);if(direction<0)return[...list].reverse().find(x=>x.time<t-.001)||list[0];return list.reduce((a,b)=>Math.abs(b.time-t)<Math.abs(a.time-t)?b:a)
}
