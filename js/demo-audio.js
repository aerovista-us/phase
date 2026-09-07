const TAU=Math.PI*2;
const clamp=v=>Math.max(-1,Math.min(1,v));

function xorshift(seed){let x=seed|0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)/4294967295)*2-1}}
function noteHz(midi){return 440*Math.pow(2,(midi-69)/12)}

export function renderDemoTrack({bpm=100,bars=16,sampleRate=22050,variant=0}={}){
  const beatsPerBar=4,duration=bars*beatsPerBar*60/bpm,length=Math.ceil(duration*sampleRate),left=new Float32Array(length),right=new Float32Array(length),rand=xorshift(0x50484153+(variant|0)*7919),roots=variant?[45,45,48,43]:[45,48,41,43];
  for(let i=0;i<length;i++){
    const t=i/sampleRate,beatPos=t*bpm/60,beat=Math.floor(beatPos),frac=beatPos-beat,bar=Math.floor(beat/beatsPerBar),beatInBar=beat%beatsPerBar,section=bar>=8?1:0;
    const kickEnv=Math.exp(-frac*18),kickFreq=48+30*Math.exp(-frac*20),kick=Math.sin(TAU*kickFreq*t)*kickEnv*(beatInBar===0?.54:.28);
    const off=((beatPos+.5)%1),hatEnv=Math.exp(-off*42),hat=rand()*hatEnv*(variant?.075:.06);
    const snareFrac=((beatPos-1)%2+2)%2,snareEnv=Math.exp(-snareFrac*24),snare=(beatInBar===1||beatInBar===3?rand()*snareEnv*.13:0);
    const root=roots[Math.floor(bar/2)%roots.length]+(section&&variant?5:0),bassHz=noteHz(root),bassEnv=.35+.65*(1-Math.exp(-frac*7)),bass=Math.sin(TAU*bassHz*t)*.13*bassEnv;
    const chordRoot=noteHz(root+12),third=noteHz(root+15),fifth=noteHz(root+19),pad=(Math.sin(TAU*chordRoot*t)+.62*Math.sin(TAU*third*t)+.48*Math.sin(TAU*fifth*t))*(section?.045:.032);
    const motifGate=Math.exp(-(((beatPos*(variant?2:1))%4))*1.7),motifHz=noteHz(root+(variant?19:24)),motif=Math.sin(TAU*motifHz*t)*motifGate*(section?.045:.025);
    const edge=Math.min(1,t/.03,(duration-t)/.05),mono=(kick+hat+snare+bass+pad+motif)*Math.max(0,edge),width=Math.sin(TAU*(variant?0.19:0.13)*t)*.035;
    left[i]=clamp(mono+pad*width);right[i]=clamp(mono-pad*width+(variant?motif*.06:-motif*.04));
  }
  return{sampleRate,duration,length,channels:[left,right],bpm,bars,variant};
}

export function encodeWav(rendered){
  const channels=rendered.channels||[],sampleRate=rendered.sampleRate||22050,length=channels[0]?.length||0,numChannels=Math.max(1,channels.length),bytesPerSample=2,blockAlign=numChannels*bytesPerSample,dataBytes=length*blockAlign,buffer=new ArrayBuffer(44+dataBytes),view=new DataView(buffer);
  const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
  str(0,'RIFF');view.setUint32(4,36+dataBytes,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,numChannels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*blockAlign,true);view.setUint16(32,blockAlign,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,dataBytes,true);
  let o=44;for(let i=0;i<length;i++)for(let c=0;c<numChannels;c++){const s=clamp(channels[c]?.[i]??channels[0]?.[i]??0);view.setInt16(o,s<0?s*32768:s*32767,true);o+=2}
  return buffer;
}

export function makeDemoFile({variant=0,bpm=variant?104:100,bars=16,sampleRate=22050}={}){
  const rendered=renderDemoTrack({variant,bpm,bars,sampleRate}),wav=encodeWav(rendered),name=variant?'phase-demo-b.wav':'phase-demo-a.wav';
  return new File([wav],name,{type:'audio/wav',lastModified:1700000000000+variant});
}
