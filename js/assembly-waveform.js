export function pyramidFromBuckets(min,max,blockSize,sampleRate,length){
 if(!(min instanceof Float32Array)||!(max instanceof Float32Array)||!min.length||min.length!==max.length||blockSize<1||sampleRate<=0||length<=0)
   throw Error('Invalid waveform buckets');
 const levels=[{min,max,blockSize}];
 while(min.length>1){
  const n=Math.ceil(min.length/2),mi=new Float32Array(n),ma=new Float32Array(n);
  for(let i=0;i<n;i++){
   mi[i]=Math.min(min[2*i],min[2*i+1]??1);
   ma[i]=Math.max(max[2*i],max[2*i+1]??-1);
  }
  blockSize*=2;min=mi;max=ma;levels.push({min,max,blockSize});
 }
 return {sampleRate,length,levels};
}
// Immutable multi-resolution min/max waveform tiles. Source audio never resampled for editing/export.
export function buildWavePyramid(buffer,blockSize=128){
  if(!buffer?.length||!buffer?.numberOfChannels||blockSize<1)throw Error('Audio buffer required');
  const bins=Math.ceil(buffer.length/blockSize),ch=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  let min=new Float32Array(bins),max=new Float32Array(bins);
  for(let i=0;i<bins;i++){
    let lo=1,hi=-1;
    const start=i*blockSize,end=Math.min(buffer.length,start+blockSize);
    for(let j=start;j<end;j++)for(let c=0;c<ch.length;c++){
      const s=ch[c][j];if(s<lo)lo=s;if(s>hi)hi=s;
    }
    min[i]=lo;max[i]=hi;
  }
  return pyramidFromBuckets(min,max,blockSize,buffer.sampleRate,buffer.length);
}
export function levelForView(pyramid,secondsPerPixel){
 const wanted=secondsPerPixel*pyramid.sampleRate;
 let best=pyramid.levels[0];
 for(const level of pyramid.levels){if(level.blockSize<=wanted*1.5)best=level;else break;}
 return best;
}
export function drawRawSamples(canvas,buffer,startSec,endSec,stroke='#80d1f5'){
 if(!buffer)throw Error('Native PCM buffer required for sample detail');
 const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width||450),height=Math.max(1,rect.height||95);
 const dpr=Math.min(2,globalThis.devicePixelRatio||1);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 const rate=buffer.sampleRate,start=Math.max(0,Math.round(startSec*rate)),
   stop=Math.min(buffer.length,Math.round(endSec*rate));if(stop<=start)return;
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 const span=stop-start;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.beginPath();
 if(span<=width){
   for(let i=0;i<span;i++){
     let sample=0;for(const ch of channels)sample+=ch[start+i];sample/=channels.length;
     const x=i/Math.max(1,span-1)*(width-1),y=height/2-sample*height*.46;
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
 }else{
   for(let x=0;x<width;x++){
     const a=start+Math.floor(x*span/width),b=Math.min(stop,start+Math.ceil((x+1)*span/width));
     let low=1,high=-1;
     for(let i=a;i<b;i++)for(const ch of channels){low=Math.min(low,ch[i]);high=Math.max(high,ch[i]);}
     ctx.moveTo(x+.5,height/2-high*height*.46);ctx.lineTo(x+.5,height/2-low*height*.46);
   }
 }
 ctx.stroke();
}
export function drawWave(canvas,pyramid,startSec=0,endSec=null,{stroke='#66c6ed',fill=null}={}){
 const rect=canvas.getBoundingClientRect(),width=rect.width||canvas.clientWidth||500,height=rect.height||canvas.clientHeight||70;
 const dpr=Math.min(2,globalThis.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 if(fill){ctx.fillStyle=fill;ctx.fillRect(0,0,width,height);}
 if(!pyramid)return;
 const end=Math.min(pyramid.length/pyramid.sampleRate,endSec??pyramid.length/pyramid.sampleRate);
 const begin=Math.max(0,Math.min(startSec,end));if(end<=begin)return;
 const level=levelForView(pyramid,(end-begin)/width);
 const sr=pyramid.sampleRate,bs=level.blockSize,scale=height*.47;
 ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.beginPath();
 for(let x=0;x<width;x++){
   // Preserve both min/max across *all* intersecting bins, rather than sampling one average.
   const a=Math.floor((begin+x/width*(end-begin))*sr/bs);
   const b=Math.max(a,Math.ceil((begin+(x+1)/width*(end-begin))*sr/bs)-1);
   let lo=1,hi=-1;for(let k=a;k<=Math.min(b,level.min.length-1);k++){lo=Math.min(lo,level.min[k]);hi=Math.max(hi,level.max[k]);}
   if(lo>hi)continue;
   ctx.moveTo(x+.5,height/2-hi*scale);ctx.lineTo(x+.5,height/2-lo*scale);
 }
 ctx.stroke();
}
