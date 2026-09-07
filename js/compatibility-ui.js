import{state,$}from'./state.js';
import{mashupCompatibility,suggestAlignmentPairs}from'./compatibility.js';

const style=document.createElement('style');style.textContent=`
.match-score{height:26px;display:inline-flex;align-items:center;padding:0 8px;border:1px solid #263542;border-radius:5px;background:#111820;color:#91a1ab;font:700 9px ui-monospace,monospace;white-space:nowrap}
.match-score.good{border-color:rgba(102,181,168,.55);color:#9fd2c9}.match-score.mid{border-color:rgba(198,166,107,.45);color:#d8c28f}
#suggestPair:disabled{opacity:.45;cursor:not-allowed}
`;
document.head.appendChild(style);

let last='';
function ready(){const[a,b]=state.tracks;return!!(a?.analysis&&b?.analysis&&a?.markers?.length&&b?.markers?.length)}
function details(){if(!ready())return null;const[a,b]=state.tracks,compat=mashupCompatibility(a,b),pairs=suggestAlignmentPairs(a,b,{maxPairs:5});return{compat,pairs}}
function pct(n){return`${Math.round(Math.max(0,Math.min(1,Number(n)||0))*100)}%`}
function install(){
  if($('#matchScore'))return;
  const label=document.createElement('span');label.className='label section';label.textContent='MATCH';
  const score=document.createElement('span');score.id='matchScore';score.className='match-score';score.textContent='MATCH —';
  const suggest=document.createElement('button');suggest.id='suggestPair';suggest.className='mode';suggest.textContent='SUGGEST PAIR';suggest.disabled=true;suggest.title='Propose phrase ALIGN points only; does not move or render either track';
  const anchor=$('#phraseNext')||$('#alignB');if(anchor)anchor.after(label,score,suggest);else $('.modebar')?.append(label,score,suggest);
  suggest.onclick=()=>{
    const d=details();if(!d?.pairs?.length)return;
    const[a,b]=state.tracks,p=d.pairs[0];a.alignMarker=p.a.beatIndex;b.alignMarker=p.b.beatIndex;state.selected={track:b.id,beat:p.b.beatIndex};
    const at=(a.timelineOffset||0)+(a.markers[p.a.beatIndex]?.targetTime??p.a.time??0);state.playheadTime=Math.max(0,at);
    window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('phase:match-suggested',{detail:{a:p.a,b:p.b,compatibility:d.compat}}));
    const shift=d.compat.keyShift?.shift||0,shiftText=shift?` · KEY SUGGEST ${shift>0?'+':''}${shift} ST`:' · KEYS COMPATIBLE';
    $('#engineState').textContent=`PAIR SUGGESTED · A BAR ${p.a.bar} ↔ B BAR ${p.b.bar} · ${pct(p.score)} STRUCTURE · ${pct(d.compat.score)} MATCH${shiftText} · PRESS ALIGN B → A TO APPLY`;
  };
}
function refresh(){
  install();const score=$('#matchScore'),suggest=$('#suggestPair');if(!score||!suggest)return;
  const d=details();suggest.disabled=!d?.pairs?.length;
  if(!d){score.textContent='MATCH —';score.className='match-score';score.title='Analyze both tracks to score compatibility';return}
  const s=d.compat.score,shift=d.compat.keyShift?.shift||0;score.textContent=`MATCH ${pct(s)}`;score.className='match-score'+(s>=.78?' good':s>=.58?' mid':'');
  score.title=`Key: ${d.compat.key.kind}; suggested B pitch ${shift>0?'+':''}${shift} st · Tempo: ${pct(d.compat.tempo.score)} · Meter: ${d.compat.meter.kind}`;
}
function signature(){return JSON.stringify(state.tracks.map(t=>[t.analysis?.bpm,t.analysis?.keyRoot,t.analysis?.keyMode,t.analysis?.beatsPerBar,t.sourceBpm,t.markers?.length,t.timelineOffset]))}
setInterval(()=>{const sig=signature();if(sig!==last){last=sig;refresh()}},300);
window.addEventListener('resize',refresh);window.addEventListener('phase:meter-change',refresh);window.addEventListener('phase:project-applied',()=>setTimeout(refresh,0));window.addEventListener('phase:history-applied',()=>setTimeout(refresh,0));
install();refresh();
