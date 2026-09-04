function makeOnset(env) {
  const out = new Float32Array(env.length);
  let smooth = 0;
  for (let i = 0; i < env.length; i++) {
    smooth = smooth * 0.92 + env[i] * 0.08;
    const prev = i ? env[i - 1] : 0;
    out[i] = Math.max(0, env[i] - smooth * 0.72) + Math.max(0, env[i] - prev) * 0.45;
  }
  return out;
}

function envelope(buffer, targetRate = 200) {
  const channels = Array.from({ length: buffer.numberOfChannels || 1 }, (_, ch) => buffer.getChannelData(ch));
  const sr = buffer.sampleRate;
  const step = Math.max(32, Math.floor(sr / targetRate));
  const n = Math.ceil(channels[0].length / step);
  const env = new Float32Array(n), lowEnv = new Float32Array(n), highEnv = new Float32Array(n);
  const cutoff = 180;
  const alpha = (2 * Math.PI * cutoff) / (sr + 2 * Math.PI * cutoff);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    let e = 0, le = 0, he = 0;
    const start = i * step, end = Math.min(channels[0].length, start + step);
    for (let j = start; j < end; j++) {
      let v = 0;
      for (let ch = 0; ch < channels.length; ch++) v += channels[ch][j] || 0;
      v /= channels.length;
      lp += alpha * (v - lp);
      const hp = v - lp;
      e += v * v; le += lp * lp; he += hp * hp;
    }
    const d = Math.max(1, end - start);
    env[i] = Math.sqrt(e / d); lowEnv[i] = Math.sqrt(le / d); highEnv[i] = Math.sqrt(he / d);
  }
  const broad = makeOnset(env), low = makeOnset(lowEnv), high = makeOnset(highEnv);
  const onset = new Float32Array(n);
  for (let i = 0; i < n; i++) onset[i] = broad[i] + low[i] * 0.42 + high[i] * 0.12;
  return { env, lowEnv, highEnv, onset, lowOnset: low, highOnset: high, rate: sr / step };
}

function tempo(onset, rate) {
  const lo = 65, hi = 190, maxN = Math.min(onset.length, Math.floor(rate * 180));
  const scores = [];
  let best = { bpm: 120, score: -1 };
  for (let bpm = lo; bpm <= hi; bpm += 0.25) {
    const lag = Math.round(rate * 60 / bpm);
    let s = 0, n = 0;
    for (let i = lag; i < maxN; i += 2) { s += onset[i] * onset[i - lag]; n++; }
    s /= Math.max(1, n);
    const item = { bpm, score: s };
    scores.push(item);
    if (s > best.score) best = item;
  }
  const nearest = bpm => scores.reduce((a, b) => Math.abs(b.bpm - bpm) < Math.abs(a.bpm - bpm) ? b : a);
  if (best.bpm > 150) {
    const half = nearest(best.bpm / 2);
    if (half.score >= best.score * 0.72) best = half;
  } else if (best.bpm < 75) {
    const twice = nearest(best.bpm * 2);
    if (twice.score >= best.score * 0.86) best = twice;
  }
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const second = sorted.find(x => Math.abs(x.bpm - best.bpm) > 3)?.score || 0;
  return { bpm: best.bpm, confidence: Math.max(0, Math.min(1, (best.score - second) / (best.score + 1e-9) * 2.5)) };
}

const NOTE_NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const MAJOR_PROFILE=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
function goertzel(frame,sr,freq){const w=2*Math.PI*freq/sr,coeff=2*Math.cos(w);let s0=0,s1=0,s2=0;for(let i=0;i<frame.length;i++){const win=.5-.5*Math.cos(2*Math.PI*i/Math.max(1,frame.length-1));s0=frame[i]*win+coeff*s1-s2;s2=s1;s1=s0}return Math.max(0,s1*s1+s2*s2-coeff*s1*s2)}
function profileScore(chroma,profile,root){let dot=0,aa=0,bb=0;for(let pc=0;pc<12;pc++){const a=chroma[pc],b=profile[(pc-root+12)%12];dot+=a*b;aa+=a*a;bb+=b*b}return dot/Math.sqrt((aa+1e-9)*(bb+1e-9))}
export function detectKey(buffer){
  const sr=buffer.sampleRate,channels=Array.from({length:buffer.numberOfChannels||1},(_,c)=>buffer.getChannelData(c)),frameSize=2048;
  const total=channels[0].length,maxFrames=72,stride=Math.max(frameSize,Math.floor(total/Math.max(1,maxFrames))),chroma=new Float64Array(12),frame=new Float32Array(frameSize);
  let frames=0;
  for(let start=0;start+frameSize<total&&frames<maxFrames;start+=stride){let rms=0;for(let i=0;i<frameSize;i++){let v=0;for(let c=0;c<channels.length;c++)v+=channels[c][start+i]||0;v/=channels.length;frame[i]=v;rms+=v*v}rms=Math.sqrt(rms/frameSize);if(rms<.004)continue;for(let midi=36;midi<=83;midi++){const freq=440*Math.pow(2,(midi-69)/12),power=goertzel(frame,sr,freq);chroma[midi%12]+=Math.log1p(power)*Math.min(1,rms*8)}frames++}
  const sum=chroma.reduce((a,b)=>a+b,0)||1;for(let i=0;i<12;i++)chroma[i]/=sum;
  const candidates=[];for(let root=0;root<12;root++){candidates.push({root,mode:'major',score:profileScore(chroma,MAJOR_PROFILE,root)});candidates.push({root,mode:'minor',score:profileScore(chroma,MINOR_PROFILE,root)})}candidates.sort((a,b)=>b.score-a.score);const best=candidates[0],second=candidates[1]||{score:0};return{root:best.root,mode:best.mode,name:`${NOTE_NAMES[best.root]} ${best.mode}`,confidence:Math.max(0,Math.min(1,(best.score-second.score)*5)),chroma:Array.from(chroma)}
}

export function detectBeatGrid(track) {
  const f = envelope(track.buffer), tp = tempo(f.onset, f.rate), key = detectKey(track.buffer);
  const period = 60 / tp.bpm, periodFrames = period * f.rate;
  const phaseSteps = Math.max(1, Math.round(periodFrames));
  const limit = Math.min(f.onset.length, Math.floor(f.rate * 180));
  let bestOffset = 0, best = -1;
  for (let off = 0; off < phaseSteps; off++) {
    let s = 0, n = 0;
    for (let x = off; x < limit; x += periodFrames) {
      const i = Math.round(x);
      if (i < f.onset.length) { s += f.onset[i]; n++; }
    }
    s /= Math.max(1, n);
    if (s > best) { best = s; bestOffset = off; }
  }
  const beats = [];
  for (let t = bestOffset / f.rate; t < track.duration + 0.02; t += period) {
    const center = Math.round(t * f.rate), radius = Math.max(1, Math.round(f.rate * 0.055));
    let bi = center, bv = -1;
    for (let j = Math.max(0, center - radius); j <= Math.min(f.onset.length - 1, center + radius); j++) if (f.onset[j] > bv) { bv = f.onset[j]; bi = j; }
    beats.push({time:bi/f.rate,accent:(f.onset[bi]||0)*.75+(f.env[bi]||0)*.25,lowAccent:(f.lowOnset[bi]||0)*.8+(f.lowEnv[bi]||0)*.2,highAccent:(f.highOnset[bi]||0)*.8+(f.highEnv[bi]||0)*.2});
  }
  let downPhase = 0, downBest = -Infinity, downSecond = -Infinity;
  for (let p = 0; p < 4; p++) {
    let s = 0, n = 0;
    for (let i = p; i < beats.length; i += 4) { const b=beats[i]; s += b.accent*.45+b.lowAccent*1.35-b.highAccent*.08; n++; }
    s /= Math.max(1, n);
    if (s > downBest) { downSecond = downBest; downBest = s; downPhase = p; }
    else if (s > downSecond) downSecond = s;
  }
  return {bpm:tp.bpm,tempoConfidence:tp.confidence,key:key.name,keyRoot:key.root,keyMode:key.mode,keyConfidence:key.confidence,downbeatPhase:downPhase,downbeatConfidence:Math.max(0,Math.min(1,(downBest-downSecond)/(Math.abs(downBest)+1e-9)*3)),beats};
}
