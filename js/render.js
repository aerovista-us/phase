import { ensureAudio } from './audio.js';
import { normalizeRenderQuality, renderSettings } from './render-quality.js';

let activeJob=null;

function storedQuality(){try{return normalizeRenderQuality(localStorage.getItem('echoverse.phase.renderQuality'))}catch{return'balanced'}}
function abortError(){const e=new Error('Render cancelled');e.name='AbortError';return e}

export function trackNeedsRender(track, tolerance = 0.0005) {
  if (!track?.buffer) return false;
  if (Math.abs(track.pitch || 0) > 1e-6) return true;
  return track.markers?.some(m => Math.abs(m.targetTime - m.sourceTime) > tolerance) || false;
}

export function isRenderActive(){return !!activeJob}
export function cancelActiveRender(){
  const job=activeJob;if(!job)return false;
  activeJob=null;job.worker.terminate();job.reject(abortError());return true;
}

export function renderTrack(track, onProgress, options={}) {
  if (!track?.buffer) return Promise.reject(new Error('Track has no audio'));
  if(activeJob)return Promise.reject(new Error('Another render is already active'));
  const quality=normalizeRenderQuality(options.quality||track.renderQuality||storedQuality()),settings=renderSettings(quality,track.buffer.sampleRate);
  track.renderQuality=quality;
  const channelCopies = Array.from({ length: track.buffer.numberOfChannels }, (_, ch) => track.buffer.getChannelData(ch).slice());
  const transfers = channelCopies.map(ch => ch.buffer);
  const worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    activeJob={worker,reject};
    const clear=()=>{if(activeJob?.worker===worker)activeJob=null;worker.terminate()};
    worker.onmessage = event => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress?.(msg.progress);
      if (msg.type === 'error') { clear(); reject(new Error(msg.message || 'Render failed')); return; }
      if (msg.type === 'done') {
        const ctx = ensureAudio();
        const buffer = ctx.createBuffer(msg.channels.length, msg.length, msg.sampleRate);
        msg.channels.forEach((ab, ch) => buffer.getChannelData(ch).set(new Float32Array(ab)));
        track.renderStats={quality,...(msg.stats||{})};
        clear(); resolve(buffer);
      }
    };
    worker.onerror = error => { clear(); reject(error instanceof Error ? error : new Error(error.message || 'Render worker failed')); };
    worker.postMessage({sampleRate:track.buffer.sampleRate,channels:channelCopies,markers:track.markers.map(m=>({sourceTime:m.sourceTime,targetTime:m.targetTime})),duration:track.duration,pitch:track.pitch||0,grainSize:settings.grainSize,hop:settings.hop,searchRadius:settings.searchRadius,quality}, transfers);
  });
}
