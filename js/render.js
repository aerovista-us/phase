import { ensureAudio } from './audio.js';

export function trackNeedsRender(track, tolerance = 0.0005) {
  if (!track?.buffer) return false;
  if (Math.abs(track.pitch || 0) > 1e-6) return true;
  return track.markers?.some(m => Math.abs(m.targetTime - m.sourceTime) > tolerance) || false;
}

export function renderTrack(track, onProgress) {
  if (!track?.buffer) return Promise.reject(new Error('Track has no audio'));
  const channelCopies = Array.from({ length: track.buffer.numberOfChannels }, (_, ch) => track.buffer.getChannelData(ch).slice());
  const transfers = channelCopies.map(ch => ch.buffer);
  const worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = event => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress?.(msg.progress);
      if (msg.type === 'error') { worker.terminate(); reject(new Error(msg.message || 'Render failed')); return; }
      if (msg.type === 'done') {
        const ctx = ensureAudio();
        const buffer = ctx.createBuffer(msg.channels.length, msg.length, msg.sampleRate);
        msg.channels.forEach((ab, ch) => buffer.getChannelData(ch).set(new Float32Array(ab)));
        worker.terminate(); resolve(buffer);
      }
    };
    worker.onerror = error => { worker.terminate(); reject(error instanceof Error ? error : new Error(error.message || 'Render worker failed')); };
    worker.postMessage({sampleRate:track.buffer.sampleRate,channels:channelCopies,markers:track.markers.map(m=>({sourceTime:m.sourceTime,targetTime:m.targetTime})),duration:track.duration,pitch:track.pitch||0,grainSize:2048,hop:512}, transfers);
  });
}
