function normalizeItem(item){return item?.buffer?{gain:1,sourceIn:0,sourceOut:null,...item}:{buffer:item,offset:0,gain:1,sourceIn:0,sourceOut:null}}
export function mixRegionWindow(offset,bufferDuration,start,end,sourceIn=0,sourceOut=bufferDuration){const duration=Math.max(0,Number(bufferDuration)||0),clipIn=Math.max(0,Math.min(duration,Number(sourceIn)||0)),rawOut=sourceOut==null?duration:Number(sourceOut),clipOut=Math.max(clipIn,Math.min(duration,Number.isFinite(rawOut)?rawOut:duration)),trackStart=(Number(offset)||0)+clipIn,trackEnd=(Number(offset)||0)+clipOut,r0=Math.max(0,Number(start)||0),r1=Number.isFinite(Number(end))?Math.max(r0,Number(end)):Infinity,o0=Math.max(r0,trackStart),o1=Math.min(r1,trackEnd);if(o1<=o0)return null;return{delay:o0-r0,sourceOffset:clipIn+(o0-trackStart),duration:o1-o0}}

export async function renderMix(items, sampleRate = 44100) {
  const playable = items.map(normalizeItem).filter(x=>x.buffer),active=playable.map(item=>({item,w:mixRegionWindow(item.offset||0,item.buffer.duration,0,Infinity,item.sourceIn||0,item.sourceOut)})).filter(x=>x.w);
  if (!active.length) throw new Error('No audio to export');
  const duration=Math.max(...active.map(x=>x.w.delay+x.w.duration)),length=Math.max(1,Math.ceil(duration*sampleRate)),off=new OfflineAudioContext(2,length,sampleRate),master=off.createGain();master.gain.value=.92;master.connect(off.destination);
  const perTrack=1/Math.max(1,active.length);
  for(const {item,w} of active){const source=off.createBufferSource(),gain=off.createGain();source.buffer=item.buffer;gain.gain.value=perTrack*Math.max(0,Number.isFinite(item.gain)?item.gain:1);source.connect(gain).connect(master);source.start(w.delay,w.sourceOffset,w.duration)}
  return off.startRendering();
}

export async function renderMixRegion(items,start,end,sampleRate=44100){
  const playable=items.map(normalizeItem).filter(x=>x.buffer),r0=Math.max(0,Number(start)||0),r1=Math.max(r0,Number(end)||0),duration=r1-r0;
  if(!playable.length)throw new Error('No audio to export');if(duration<=0)throw new Error('Region is empty');
  const length=Math.max(1,Math.ceil(duration*sampleRate)),off=new OfflineAudioContext(2,length,sampleRate),master=off.createGain();master.gain.value=.92;master.connect(off.destination);
  const active=playable.map(item=>({item,w:mixRegionWindow(item.offset||0,item.buffer.duration,r0,r1,item.sourceIn||0,item.sourceOut)})).filter(x=>x.w),perTrack=1/Math.max(1,active.length);
  for(const {item,w} of active){const source=off.createBufferSource(),gain=off.createGain();source.buffer=item.buffer;gain.gain.value=perTrack*Math.max(0,Number.isFinite(item.gain)?item.gain:1);source.connect(gain).connect(master);source.start(w.delay,w.sourceOffset,w.duration)}
  return off.startRendering();
}

export function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels, sampleRate = buffer.sampleRate, frames = buffer.length;
  const bytesPerSample = 2, blockAlign = channels * bytesPerSample, dataSize = frames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize), view = new DataView(ab);
  const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, dataSize, true);
  const data = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < channels; ch++) {
    const s = Math.max(-1, Math.min(1, data[ch][i] || 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); offset += 2;
  }
  return ab;
}

export function downloadWav(buffer, filename = 'phase-mix.wav') {
  const blob = new Blob([audioBufferToWav(buffer)], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
