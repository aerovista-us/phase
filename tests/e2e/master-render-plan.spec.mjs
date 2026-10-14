import{test,expect}from'@playwright/test';

test('frame-indexed regional audio matches a one-pass master with stable global gain',async({page})=>{
 test.setTimeout(85000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/assembly.html',{waitUntil:'networkidle'});
 const evidence=await page.evaluate(async()=>{
  const {renderMix,renderPlannedMasterChunk}=await import('./js/export.js');
  const {createMasterRenderPlan,masterFrameChunks,validateMasterChunkSequence}=await import('./js/master-render-plan.js');
  const rate=48000,context=new AudioContext({sampleRate:rate});
  const tone=(inputRate,seconds,hz)=>{
   const frames=Math.round(inputRate*seconds),b=context.createBuffer(2,frames,inputRate);
   for(let channel=0;channel<2;channel++){
    const data=b.getChannelData(channel);
    for(let i=0;i<frames;i++){
     const t=i/inputRate;
     data[i]=.21*Math.sin(2*Math.PI*(hz+channel*45)*t)+
      .07*Math.sin(2*Math.PI*(hz*1.8+channel*30)*t);
    }
   }
   return b;
  };
  const items=[
   {group:'A',buffer:tone(48000,2,117),offset:0,gain:.83,sourceIn:0,sourceOut:2,
    fadeInStart:0,fadeInEnd:.06,fadeOutStart:1.8,fadeOutEnd:2,
    fadeInCurve:'equalPower',fadeOutCurve:'equalPower'},
   {group:'B',buffer:tone(44100,2,183),offset:.75,gain:.7,sourceIn:0,sourceOut:2,
    fadeInStart:0,fadeInEnd:.04,fadeOutStart:1.81,fadeOutEnd:2,
    fadeInCurve:'equalPower',fadeOutCurve:'equalPower'},
   {group:'A',buffer:tone(48000,1.5,220),offset:3.3,gain:.75,sourceIn:0,sourceOut:1.5,
    fadeInStart:0,fadeInEnd:.05,fadeOutStart:1.42,fadeOutEnd:1.5,
    fadeInCurve:'linear',fadeOutCurve:'equalPower'}
  ];
  const reference=await renderMix(items,rate);
  const results=[];
  for(const chunkSeconds of [.71,1.37]){
   const clips=items.map(x=>({group:x.group,masterStart:x.offset,
    sourceIn:x.sourceIn,sourceOut:x.sourceOut}));
   const plan=createMasterRenderPlan(clips,{sampleRate:rate,chunkSeconds});
   const chunks=[...masterFrameChunks(plan)];
   validateMasterChunkSequence(plan,chunks);
   const channels=[new Float32Array(plan.totalFrames),new Float32Array(plan.totalFrames)];
   let max=0,maxBoundary=0,energyError=0,energyRef=0,firstDifferenceFrame=-1;
   for(const chunk of chunks){
    const active=items.filter(x=>x.offset+x.sourceOut>chunk.startSec&&
     x.offset+x.sourceIn<chunk.endSec);
    const piece=await renderPlannedMasterChunk(active,plan,chunk);
    if(piece.length!==chunk.frameCount)throw Error('Rendered fragment frame count changed');
    for(let ch=0;ch<2;ch++)channels[ch].set(piece.getChannelData(ch),chunk.startFrame);
   }
   if(plan.totalFrames!==reference.length)throw Error('One-pass and plan length mismatch');
   for(let ch=0;ch<2;ch++){
    const a=reference.getChannelData(ch),b=channels[ch];
    for(let i=0;i<a.length;i++){
     const delta=Math.abs(a[i]-b[i]);
     max=Math.max(max,delta);
     energyError+=delta*delta;energyRef+=a[i]*a[i];
     if(firstDifferenceFrame<0&&delta>.0003)firstDifferenceFrame=i;
     if(chunks.some(c=>Math.abs(i-c.endFrame)<=3))maxBoundary=Math.max(maxBoundary,delta);
    }
   }
   const silence=channels.every(a=>a.subarray(Math.round(2.9*rate),
    Math.round(3.2*rate)).every(sample=>sample===0));
   results.push({chunkSeconds,chunkCount:chunks.length,planFrames:plan.totalFrames,
    normalizationCount:plan.normalizationCount,
    maxError:max,maxBoundary,
    rmsError:Math.sqrt(energyError/(2*plan.totalFrames)),
    relativeRmse:Math.sqrt(energyError/Math.max(1e-16,energyRef)),
    firstDifferenceFrame,silentGap:silence});
  }
  await context.close();
  return results;
 });
 console.log('MASTER_FRAME_CHUNK_COMPARISON',JSON.stringify(evidence));
 expect(evidence).toHaveLength(2);
 for(const row of evidence){
  expect(row.planFrames).toBe(230400);
  expect(row.normalizationCount).toBe(2);
  expect(row.silentGap).toBe(true);
  expect(row.maxBoundary).toBeLessThan(.00001);
  expect(row.maxError).toBeLessThan(.00001);
  expect(row.rmsError).toBeLessThan(.000001);
  expect(row.relativeRmse).toBeLessThan(.00001);
 }
 expect(errors).toEqual([]);
});
