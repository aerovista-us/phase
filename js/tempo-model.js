const clampMeter=v=>[3,4,6].includes(Number(v))?Number(v):4;
const finite=n=>Number.isFinite(Number(n));

function midpoint(a,b){
  const out={};for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
    const av=a?.[key],bv=b?.[key];out[key]=finite(av)&&finite(bv)?(Number(av)+Number(bv))/2:(av??bv);
  }return out;
}
function resample(items,factor,{marker=false}={}){
  const src=Array.isArray(items)?items:[];if(!src.length)return[];
  if(factor===.5)return src.filter((_,i)=>i%2===0).map(x=>({...x}));
  if(factor===2){const out=[];for(let i=0;i<src.length-1;i++){out.push({...src[i]});const m=midpoint(src[i],src[i+1]);if(marker){m.locked=false;m.downbeat=false;m.confidence=Math.min(Number(src[i].confidence)||0,Number(src[i+1].confidence)||0)*.65}out.push(m)}out.push({...src.at(-1)});return out}
  return src.map(x=>({...x}));
}
export function tempoOctaveTarget(bpm,factor,min=40,max=240){const current=Number(bpm)||120,next=current*Number(factor);return finite(next)&&next>=min&&next<=max?next:null}
export function applyTempoOctave(track,factor,{minBpm=40,maxBpm=240}={}){
  if(!track||![.5,2].includes(Number(factor)))throw new Error('Tempo factor must be 0.5 or 2');
  const next=tempoOctaveTarget(track.sourceBpm||track.analysis?.bpm||120,Number(factor),minBpm,maxBpm);if(next==null)throw new Error(`Tempo correction would fall outside ${minBpm}–${maxBpm} BPM`);
  const oldMarkers=track.markers||[],firstDownbeat=oldMarkers.find(m=>m.downbeat),markers=resample(oldMarkers,Number(factor),{marker:true});markers.forEach((m,i)=>m.beat=i);
  const bpb=clampMeter(track.analysis?.beatsPerBar??track.beatsPerBar),anchorTime=firstDownbeat?.sourceTime??markers[0]?.sourceTime??0;let anchor=0,best=Infinity;markers.forEach((m,i)=>{const d=Math.abs((m.sourceTime||0)-anchorTime);if(d<best){best=d;anchor=i}});const phase=((anchor%bpb)+bpb)%bpb;markers.forEach((m,i)=>m.downbeat=((i-phase)%bpb+bpb)%bpb===0);
  track.markers=markers;track.sourceBpm=next;track.beatsPerBar=bpb;track.gridMode='tempo-corrected';
  if(track.analysis){track.analysis.beats=resample(track.analysis.beats,Number(factor));track.analysis.bpm=next;track.analysis.beatsPerBar=bpb;track.analysis.downbeatPhase=phase;track.analysis.tempoUserAdjusted=true;track.analysis.tempoOctaveAdjusted=Math.abs(next-Number(track.analysis.rawBpm||next))>.5}
  return{bpm:next,factor,markers:markers.length,phase,beatsPerBar:bpb};
}
