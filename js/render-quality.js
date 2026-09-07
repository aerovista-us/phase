export const RENDER_QUALITIES={
  fast:{label:'FAST',grainSize:1024,hop:512,searchMs:2},
  balanced:{label:'BALANCED',grainSize:2048,hop:512,searchMs:3},
  high:{label:'HIGH',grainSize:2048,hop:256,searchMs:4}
};

export function normalizeRenderQuality(value){return Object.hasOwn(RENDER_QUALITIES,value)?value:'balanced'}

export function renderSettings(value,sampleRate=44100){
  const quality=normalizeRenderQuality(value),q=RENDER_QUALITIES[quality],sr=Math.max(1,Number(sampleRate)||44100);
  return{quality,label:q.label,grainSize:q.grainSize,hop:q.hop,searchRadius:Math.max(16,Math.round(sr*q.searchMs/1000))};
}
