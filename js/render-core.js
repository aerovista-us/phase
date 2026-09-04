function targetToSource(markers, t) {
  if (!markers?.length) return t;
  if (t <= markers[0].targetTime) return markers[0].sourceTime + (t - markers[0].targetTime);
  for (let i = 1; i < markers.length; i++) {
    const a = markers[i - 1], b = markers[i];
    if (t <= b.targetTime) {
      const d = b.targetTime - a.targetTime || 1e-9;
      const f = (t - a.targetTime) / d;
      return a.sourceTime + f * (b.sourceTime - a.sourceTime);
    }
  }
  const z = markers[markers.length - 1];
  return z.sourceTime + (t - z.targetTime);
}

export function outputDuration(duration, markers) {
  if (!markers?.length) return duration;
  const last = markers[markers.length - 1];
  return Math.max(0.001, last.targetTime + Math.max(0, duration - last.sourceTime));
}

function linearSample(channel, pos) {
  const i = Math.floor(pos), f = pos - i;
  if (i < 0 || i >= channel.length - 1) return 0;
  return channel[i] + (channel[i + 1] - channel[i]) * f;
}

export function renderGranular({sampleRate,channels,markers,duration,pitch=0,grainSize=2048,hop=512,searchRadius,onProgress}) {
  if (!sampleRate || !channels?.length) throw new Error('Missing audio data');
  const outDuration = outputDuration(duration, markers);
  const outLength = Math.max(1, Math.ceil(outDuration * sampleRate));
  const outputs = channels.map(() => new Float32Array(outLength));
  const norm = new Float32Array(outLength);
  const half = Math.floor(grainSize / 2);
  const pitchFactor = Math.pow(2, pitch / 12);
  const denom = Math.max(1, grainSize - 1);
  const totalGrains = Math.ceil((outLength + half) / hop);
  const radius = searchRadius ?? Math.max(24, Math.min(192, Math.round(sampleRate * 0.003)));
  const searchStep = Math.max(2, Math.round(radius / 24));
  const compareLen = Math.min(Math.floor(grainSize / 3), Math.max(128, hop));
  const compareStep = 4;
  let grainIndex = 0;

  function chooseCenter(nominal, center) {
    if (grainIndex === 0 || center < hop) return nominal;
    const outStart = center - half;
    let hasReference = false;
    for (let q = 0; q < compareLen; q += compareStep) {
      const oi = outStart + q;
      if (oi >= 0 && oi < outLength && norm[oi] > 0.05) { hasReference = true; break; }
    }
    if (!hasReference) return nominal;
    let bestCenter = nominal, bestScore = -Infinity;
    const ref = outputs[0], src = channels[0];
    for (let shift = -radius; shift <= radius; shift += searchStep) {
      const candidate = nominal + shift;
      let dot = 0, aa = 0, bb = 0, n = 0;
      for (let q = 0; q < compareLen; q += compareStep) {
        const oi = outStart + q;
        if (oi < 0 || oi >= outLength || norm[oi] <= 0.05) continue;
        const k = -half + q, sp = candidate + k * pitchFactor;
        if (sp < 0 || sp >= src.length - 1) continue;
        const a = ref[oi] / norm[oi], b = linearSample(src, sp);
        dot += a * b; aa += a * a; bb += b * b; n++;
      }
      if (n < 8) continue;
      const score = dot / Math.sqrt((aa + 1e-9) * (bb + 1e-9));
      if (score > bestScore) { bestScore = score; bestCenter = candidate; }
    }
    return bestCenter;
  }

  for (let center = 0; center < outLength + half; center += hop) {
    const nominal = targetToSource(markers, center / sampleRate) * sampleRate;
    const srcCenter = chooseCenter(nominal, center);
    for (let k = -half; k < half; k++) {
      const oi = center + k;
      if (oi < 0 || oi >= outLength) continue;
      const wi = k + half;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * wi) / denom);
      const srcPos = srcCenter + k * pitchFactor;
      if (srcPos < 0 || srcPos >= channels[0].length - 1) continue;
      norm[oi] += w;
      for (let ch = 0; ch < channels.length; ch++) outputs[ch][oi] += linearSample(channels[ch], srcPos) * w;
    }
    grainIndex++;
    if (onProgress && (grainIndex % 32 === 0 || grainIndex === totalGrains)) onProgress(Math.min(1, grainIndex / totalGrains));
  }

  for (let i = 0; i < outLength; i++) {
    if (norm[i] <= 1e-6) continue;
    const inv = 1 / norm[i];
    for (let ch = 0; ch < outputs.length; ch++) outputs[ch][i] *= inv;
  }
  return {channels:outputs,sampleRate,duration:outDuration};
}
