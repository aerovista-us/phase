import { renderGranular } from './render-core.js';

self.onmessage = event => {
  const job = event.data;
  try {
    const result = renderGranular({
      sampleRate: job.sampleRate,
      channels: job.channels,
      markers: job.markers,
      duration: job.duration,
      pitch: job.pitch,
      grainSize: job.grainSize || 2048,
      hop: job.hop || 512,
      onProgress: progress => self.postMessage({ type: 'progress', progress })
    });
    const buffers = result.channels.map(channel => channel.buffer);
    self.postMessage({type:'done',sampleRate:result.sampleRate,duration:result.duration,length:result.channels[0].length,channels:buffers}, buffers);
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};
