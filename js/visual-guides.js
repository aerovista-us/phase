import{state,$}from'./state.js';
import{firstDownbeatIndex}from'./arrangement.js';

const style=document.createElement('style');style.textContent=`
.ruler-lines{left:150px!important;right:0!important;top:0!important;bottom:0!important}
.phase-guide-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.phrase-guide{position:absolute;top:0;bottom:0;width:1px;background:rgba(109,147,184,.10)}
.phrase-guide.p16{background:rgba(109,147,184,.16)}
.phrase-guide.p32{width:2px;background:rgba(102,181,168,.22)}
.phrase-guide span{position:absolute;top:2px;left:4px;font:8px ui-monospace,monospace;color:rgba(125,139,150,.58);white-space:nowrap}
.align-guide{position:absolute;top:0;bottom:0;width:2px;background:rgba(198,166,107,.78);box-shadow:0 0 0 1px rgba(198,166,107,.08)}
.align-guide.b{background:rgba(102,181,168,.72)}
.align-guide span{position:absolute;top:13px;left:4px;padding:1px 3px;border-radius:3px;background:#0d1319;font:700 8px ui-monospace,monospace;color:#d8c28f;white-space:nowrap}
.align-guide.b span{color:#9fd2c9}
@media(max-width:900px){.ruler-lines{left:128px!important}}
`;
document.head.appendChild(style);

function alignIndex(track){return Number.isInteger(track.alignMarker)&&track.markers?.[track.alignMarker]?track.alignMarker:firstDownbeatIndex(track)}
function signature(){return JSON.stringify({b:state.bpm,v:state.viewDuration,s:state.snapMode,t:state.tracks.map(t=>[t.timelineOffset,t.alignMarker,t.markers?.[alignIndex(t)]?.targetTime])})}
let last='';

function renderGuides(){
  const host=$('.ruler-lines');if(!host)return;
  const old=host.querySelector('.phase-guide-layer');if(old)old.remove();
  const layer=document.createElement('div');layer.className='phase-guide-layer';
  const bpm=Math.max(1,state.bpm||120),view=Math.max(1,state.viewDuration||60),bar=60/bpm*4,totalBars=Math.ceil(view/bar);
  for(let bars=8;bars<=totalBars;bars+=8){
    const time=bars*bar;if(time>view)break;const g=document.createElement('div');g.className='phrase-guide'+(bars%32===0?' p32':bars%16===0?' p16':'');g.style.left=`${time/view*100}%`;
    if(bars%16===0){const s=document.createElement('span');s.textContent=`${bars} BARS`;g.appendChild(s)}layer.appendChild(g);
  }
  state.tracks.forEach((t,i)=>{
    if(!t.buffer||!t.markers?.length)return;const idx=alignIndex(t),m=t.markers[idx];if(!m)return;const time=(t.timelineOffset||0)+m.targetTime;if(time<0||time>view)return;
    const g=document.createElement('div');g.className='align-guide'+(i?' b':'');g.style.left=`${time/view*100}%`;const s=document.createElement('span');s.textContent=`${t.label} ALIGN ${Math.floor(idx/4)+1}.${idx%4+1}`;g.appendChild(s);layer.appendChild(g);
  });
  host.appendChild(layer);
}

setInterval(()=>{const host=$('.ruler-lines');if(!host)return;const sig=signature();if(sig!==last||!host.querySelector('.phase-guide-layer')){last=sig;renderGuides()}},180);
window.addEventListener('resize',()=>setTimeout(renderGuides,0));
window.addEventListener('phase:project-applied',()=>setTimeout(renderGuides,0));
window.addEventListener('phase:history-applied',()=>setTimeout(renderGuides,0));
