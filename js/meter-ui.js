import{state,$,$$}from'./state.js';
import{detectMeter}from'./analysis.js';
import{meterBeats}from'./arrangement.js';

const NAMES={3:'3/4',4:'4/4',6:'6/8'};
const forcedBeats=value=>({'3/4':3,'4/4':4,'6/8':6}[value]||null);
const pct=v=>Math.round(Math.max(0,Math.min(1,Number(v)||0))*100);
const dur=t=>{const n=Math.max(0,Number(t)||0),m=Math.floor(n/60),s=n-m*60;return`${m}:${s.toFixed(1).padStart(4,'0')}`};
state.meterPreference=state.meterPreference||'auto';state.beatsPerBar=meterBeats(state.beatsPerBar||4);state.meter=state.meter||NAMES[state.beatsPerBar];
for(const t of state.tracks){t.meterPreference=t.meterPreference||state.meterPreference||'auto';t.beatsPerBar=meterBeats(t.beatsPerBar||t.analysis?.beatsPerBar||4);t.meter=t.meter||t.analysis?.meter||NAMES[t.beatsPerBar]}

const style=document.createElement('style');style.textContent=`
.meter-confidence{font:8px ui-monospace,monospace;color:#82929d;white-space:nowrap}
.meter-low{color:#c6a66b}
`;
document.head.appendChild(style);

function phaseFor(track,bpb){const current=track.markers?.findIndex(m=>m.downbeat);if(Number.isInteger(track.analysis?.downbeatPhase))return((track.analysis.downbeatPhase%bpb)+bpb)%bpb;return current>=0?current%bpb:0}
function applyTrackMeter(track,result){
  const bpb=meterBeats(result?.meter??result?.beatsPerBar??track.analysis?.beatsPerBar??track.beatsPerBar),name=result?.name||track.analysis?.meter||NAMES[bpb],phase=((Number.isInteger(result?.phase)?result.phase:phaseFor(track,bpb))%bpb+bpb)%bpb;
  track.beatsPerBar=bpb;track.meter=name;
  if(track.analysis){track.analysis.meter=name;track.analysis.beatsPerBar=bpb;track.analysis.downbeatPhase=phase;if(Number.isFinite(result?.confidence))track.analysis.meterConfidence=result.confidence;if(Number.isFinite(result?.phaseConfidence))track.analysis.downbeatConfidence=result.phaseConfidence}
  track.markers?.forEach((m,i)=>m.downbeat=((i-phase)%bpb+bpb)%bpb===0);
}
function recalcTrack(track,preference=state.meterPreference){
  track.meterPreference=preference||'auto';
  const forced=forcedBeats(track.meterPreference);
  if(track.analysis?.beats?.length){applyTrackMeter(track,detectMeter(track.analysis.beats,track.meterPreference));return}
  if(forced){applyTrackMeter(track,{meter:forced,name:NAMES[forced],phase:phaseFor(track,forced),confidence:track.analysis?.meterConfidence||0});return}
  if(track.analysis)applyTrackMeter(track,{meter:track.analysis.beatsPerBar||track.beatsPerBar,name:track.analysis.meter||track.meter,phase:track.analysis.downbeatPhase,confidence:track.analysis.meterConfidence});
}
function adoptProjectMeter(){
  const forced=forcedBeats(state.meterPreference),authority=state.tracks[0]?.analysis?state.tracks[0]:state.tracks.find(t=>t.analysis);
  const bpb=forced||meterBeats(authority?.analysis?.beatsPerBar??authority?.beatsPerBar??state.beatsPerBar),name=forced?NAMES[forced]:(authority?.analysis?.meter||authority?.meter||NAMES[bpb]);
  state.beatsPerBar=bpb;state.meter=name;
}
function analysisSummary(){return state.tracks.filter(t=>t.analysis).map(t=>{const a=t.analysis,mc=pct(a.meterConfidence),oct=a.tempoOctaveAdjusted?` · octave ${Number(a.rawBpm||a.bpm).toFixed(1)}→${Number(a.bpm).toFixed(1)}`:'';return`${t.label}: ${Number(t.sourceBpm||a.bpm).toFixed(2)} BPM · ${t.meter} ${mc}% meter${oct} · ${a.key||'key ?'}`}).join(' · ')}
function decorateSummary(track){
  const sub=$(`#sub-${track.id}`),a=track.analysis;if(!sub||!a)return;
  const meter=track.meter||a.meter||'4/4',line1=`${dur(track.duration)} · ${Number(track.sourceBpm||a.bpm||120).toFixed(2)} BPM · ${a.key||'KEY ?'}`,line2=`${meter} · T${pct(a.tempoConfidence)} M${pct(a.meterConfidence)} D${pct(a.downbeatConfidence)} K${pct(a.keyConfidence)} · ${track.markers?.length||0} beats`,text=`${line1}\n${line2}`;
  if(sub.textContent!==text)sub.textContent=text;sub.title=`Tempo ${pct(a.tempoConfidence)}% · Meter ${meter} ${pct(a.meterConfidence)}% · Downbeat ${pct(a.downbeatConfidence)}% · Key ${a.key||'?'} ${pct(a.keyConfidence)}%${a.tempoOctaveAdjusted?` · Tempo octave adjusted from ${Number(a.rawBpm||0).toFixed(2)} BPM`:''}`;
}
function normalizeAnalyzedTracks(){for(const t of state.tracks)if(t.analysis)recalcTrack(t,t.meterPreference||state.meterPreference);adoptProjectMeter();decorateAll();const summary=analysisSummary();if(summary)$('#engineState').textContent=`ANALYSIS READY · ${summary}`;window.dispatchEvent(new CustomEvent('phase:meter-change'))}

function installControl(){
  if($('#meterMode')){$('#meterMode').value=state.meterPreference||'auto';return}
  const label=document.createElement('span');label.className='label section';label.textContent='METER';
  const select=document.createElement('select');select.id='meterMode';select.className='snap-select';select.innerHTML='<option value="auto">AUTO</option><option value="4/4">4/4</option><option value="3/4">3/4</option><option value="6/8">6/8</option>';select.value=state.meterPreference||'auto';select.title='Automatic meter detection or force the project bar grid to 4/4, 3/4, or 6/8';
  const gridLabel=[...$('.modebar').querySelectorAll('.label')].find(x=>x.textContent==='GRID');if(gridLabel)gridLabel.before(label,select);else $('.modebar').append(label,select);
  select.onchange=()=>{state.meterPreference=select.value;for(const t of state.tracks)recalcTrack(t,select.value);adoptProjectMeter();decorateAll();window.dispatchEvent(new CustomEvent('phase:meter-change'));window.dispatchEvent(new Event('resize'));$('#engineState').textContent=`PROJECT METER · ${select.options[select.selectedIndex].text}${select.value==='auto'?` → ${state.meter}`:''}`};
}

function decorateMarkers(track){
  const bpb=meterBeats(track.analysis?.beatsPerBar??track.beatsPerBar),meter=track.analysis?.meter||track.meter||NAMES[bpb];
  $$(`.marker[data-track="${track.id}"]`).forEach(el=>{const idx=+el.dataset.beat,m=track.markers[idx];if(!m)return;const bar=Math.floor(idx/bpb)+1,pos=idx%bpb+1,n=el.querySelector('.n');if(n&&m.downbeat)n.textContent=String(bar);el.title=m.downbeat?`Bar ${bar} · ${meter}${(track.analysis?.downbeatConfidence??1)<.25?' · LOW DOWNBEAT CONFIDENCE':''}`:`Beat ${bar}.${pos} · ${meter}`});
}
function repaintRuler(){
  const host=$('.ruler-lines');if(!host)return;const bpb=meterBeats(state.beatsPerBar),beat=60/Math.max(1,state.bpm||120),bar=beat*bpb,view=Math.max(1,state.viewDuration||60),bars=Math.ceil(view/bar),expected=bars+1,ticks=[...host.children].filter(x=>x.classList?.contains('bar-tick'));
  const stale=ticks.length!==expected||ticks.some(x=>x.dataset.meterAware!==String(bpb));if(!stale)return;ticks.forEach(x=>x.remove());const frag=document.createDocumentFragment(),barPx=bar*(state.pxPerSecond||8),labelEvery=barPx>=38?1:barPx>=20?2:4;
  for(let i=0;i<=bars;i++){const el=document.createElement('div');el.className='bar-tick'+(i%4===0?' major':'');el.dataset.meterAware=String(bpb);el.style.left=`${i*bar/view*100}%`;if(i%labelEvery===0)el.textContent=String(i+1);frag.appendChild(el)}host.prepend(frag);
}
function decorateAll(){installControl();repaintRuler();state.tracks.forEach(t=>{decorateMarkers(t);decorateSummary(t)})}

let queued=false;const queueDecorate=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateAll()})};
const observer=new MutationObserver(queueDecorate);
function bindObservers(){const ruler=$('.ruler-lines');if(ruler&&!ruler.dataset.meterObserved){ruler.dataset.meterObserved='1';observer.observe(ruler,{childList:true})}for(const t of state.tracks){const host=$(`#markers-${t.id}`);if(host&&!host.dataset.meterObserved){host.dataset.meterObserved='1';observer.observe(host,{childList:true})}}}

const analyze=$('#analyze');if(analyze)analyze.addEventListener('click',()=>{for(const t of state.tracks)t.meterPreference=state.meterPreference||'auto'},true);
let lastAnalysis='';setInterval(()=>{bindObservers();const sig=state.tracks.map(t=>t.analysis?`${t.analysis.bpm}|${t.analysis.meter}|${t.analysis.beatsPerBar}|${t.analysis.downbeatPhase}|${t.markers?.length}`:'').join(';');if(sig!==lastAnalysis){lastAnalysis=sig;if(sig)normalizeAnalyzedTracks();else queueDecorate()}else state.tracks.forEach(decorateSummary)},300);
window.addEventListener('resize',()=>{bindObservers();queueDecorate()});
window.addEventListener('phase:project-applied',()=>{state.tracks.forEach(t=>{t.meterPreference=t.meterPreference||state.meterPreference});setTimeout(()=>{adoptProjectMeter();decorateAll();window.dispatchEvent(new CustomEvent('phase:meter-change'))},0)});
window.addEventListener('phase:history-applied',()=>setTimeout(()=>{adoptProjectMeter();decorateAll()},0));
bindObservers();decorateAll();
