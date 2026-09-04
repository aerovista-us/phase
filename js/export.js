export async function renderMix(buffers, sampleRate = 44100) {
  const playable = buffers.filter(Boolean);
  if (!playable.length) throw new Error('No audio to export');
  const duration = Math.max(...playable.map(b => b.duration));
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const off = new OfflineAudioContext(2, length, sampleRate);
  const master = off.createGain();
  master.gain.value = 0.92;
  master.connect(off.destination);
  const perTrack = 1 / Math.max(1, playable.length);
  for (const buffer of playable) {
    const source = off.createBufferSource();
    const gain = off.createGain();
    source.buffer = buffer;
    gain.gain.value = perTrack;
    source.connect(gain).connect(master);
    source.start(0);
  }
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
