import{$,$$}from'./state.js';

const style=document.createElement('style');style.textContent=`
.phase-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.marker:focus-visible .cap{outline:2px solid #d6bc82;outline-offset:2px}.marker:focus-visible::before{background:#d6bc82!important;width:3px!important}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.001ms!important;animation-duration:.001ms!important;animation-iteration-count:1!important}}
@media(prefers-contrast:more){:root{--muted:#a8b4bc;--line:#48606f}.btn,.mode,.mini,input,select{border-color:#536b79!important}.marker::before{opacity:1!important}.track-sub,.sub{color:#a8b4bc!important}}
`;
document.head.appendChild(style);

function liveRegion(){let live=$('#phaseLive');if(live)return live;live=document.createElement('div');live.id='phaseLive';live.className='phase-sr-only';live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.appendChild(live);return live}
function labelButton(el){if(!el||el.getAttribute('aria-label'))return;const text=(el.textContent||el.title||'').replace(/\s+/g,' ').trim();if(text)el.setAttribute('aria-label',text)}
function pressed(el){if(!el)return;const toggle=el.matches('.mode,.stem-mute,.stem-solo,[id^="mute-"],[id^="solo-"],#loopToggle,#phraseToggle,#stemUse');if(toggle)el.setAttribute('aria-pressed',el.classList.contains('active')?'true':'false')}
function decorateStatic(){
  $('.topbar')?.setAttribute('role','toolbar');$('.topbar')?.setAttribute('aria-label','Project and transport controls');$('.modebar')?.setAttribute('role','toolbar');$('.modebar')?.setAttribute('aria-label','Phase editing tools');
  const ruler=$('.ruler');if(ruler){ruler.setAttribute('role','group');ruler.setAttribute('aria-label','Project timeline ruler. Click or drag to seek.')}
  for(const btn of $$('button')){labelButton(btn);pressed(btn)}
  for(const input of $$('input[type="number"],input[type="range"],input[type="url"],select'))if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',input.title||input.closest('label')?.textContent?.trim()||input.id||'Phase control');
  for(const canvas of $$('canvas.wave')){const id=canvas.id?.split('-').at(-1),name=$(`#name-${id}`)?.textContent||`Track ${id}`;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${name} waveform`)}
  for(const d of $$('.stem-drawer,.diag-drawer,.help-drawer')){d.setAttribute('role','dialog');d.setAttribute('aria-modal','false');d.setAttribute('aria-label',d.matches('.stem-drawer')?'Stem sources':d.matches('.diag-drawer')?'Phase diagnostics':'Phase help')}
}
function decorateMarkers(){
  for(const el of $$('.marker')){
    const down=el.classList.contains('downbeat'),locked=el.classList.contains('locked'),selected=el.classList.contains('selected'),track=Number(el.dataset.track),beat=Number(el.dataset.beat)+1,title=el.title||'';
    el.tabIndex=down||selected?0:-1;el.setAttribute('role','button');el.setAttribute('aria-label',`${title||`Track ${track+1}, beat ${beat}`}${locked?' · locked anchor':''}${selected?' · selected':''}`);el.setAttribute('aria-pressed',locked?'true':'false');
    if(!el.dataset.a11yKey){el.dataset.a11yKey='1';el.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();el.click()}})}
  }
}
function decorate(){decorateStatic();decorateMarkers()}

const live=liveRegion(),status=$('#engineState');if(status){let last=status.textContent||'';new MutationObserver(()=>{const text=status.textContent||'';if(text&&text!==last){last=text;live.textContent=text}}).observe(status,{childList:true,characterData:true,subtree:true})}
let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
for(const t of [$('#tracks'),$('.modebar'),$('.topbar')].filter(Boolean))new MutationObserver(queue).observe(t,{childList:true,subtree:true});
document.addEventListener('click',queue,true);document.addEventListener('change',queue,true);window.addEventListener('resize',queue);window.addEventListener('phase:project-applied',queue);window.addEventListener('phase:history-applied',queue);
decorate();
