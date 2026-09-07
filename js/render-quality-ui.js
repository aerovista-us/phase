import{state,$}from'./state.js';
import{RENDER_QUALITIES,normalizeRenderQuality}from'./render-quality.js';

const STORE='echoverse.phase.renderQuality';
function load(){try{return normalizeRenderQuality(localStorage.getItem(STORE))}catch{return'balanced'}}
function apply(value){const q=normalizeRenderQuality(value);state.renderQuality=q;for(const t of state.tracks)t.renderQuality=q;try{localStorage.setItem(STORE,q)}catch{}return q}
function install(){
  if($('#renderQuality'))return;
  const label=document.createElement('label');label.className='field render-quality-field';label.textContent='QUALITY';
  const select=document.createElement('select');select.id='renderQuality';select.className='snap-select';for(const[key,q]of Object.entries(RENDER_QUALITIES)){const o=document.createElement('option');o.value=key;o.textContent=q.label;select.appendChild(o)}
  select.value=apply(load());select.title='FAST uses less overlap, BALANCED is the default, HIGH uses denser overlap/search for difficult material';select.onchange=()=>{const q=apply(select.value);$('#engineState').textContent=`RENDER QUALITY · ${RENDER_QUALITIES[q].label}`};label.appendChild(select);$('#render').before(label)
}
install();window.addEventListener('resize',install);
