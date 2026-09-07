import{state,$}from'./state.js';
import{stopAudio}from'./audio.js';
import{makeDemoFile}from'./demo-audio.js';

let loading=false;
const wait=(fn,timeout=12000)=>new Promise((resolve,reject)=>{const start=performance.now(),tick=()=>{if(fn())return resolve();if(performance.now()-start>timeout)return reject(new Error('Timed out waiting for Phase demo audio to decode'));setTimeout(tick,40)};tick()});
const change=el=>el?.dispatchEvent(new Event('change',{bubbles:true}));

async function injectTrack(id,file){
  const input=$(`#file-${id}`);if(!input)throw new Error(`Track ${id+1} file input is not ready`);
  const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;change(input);
  await wait(()=>state.tracks[id]?.buffer&&state.tracks[id]?.file?.name===file.name);
}

async function loadDemo(){
  if(loading)return;
  if(state.tracks.some(t=>t.buffer)&&!confirm('Replace the current Track A/B sources with the generated Phase demo session? Save your current project first if needed.'))return;
  loading=true;const button=$('#demoProject');if(button){button.disabled=true;button.textContent='BUILDING DEMO…'};stopAudio();
  try{
    $('#engineState').textContent='GENERATING ORIGINAL PHASE DEMO AUDIO…';await new Promise(r=>requestAnimationFrame(r));const a=makeDemoFile({variant:0,bpm:100,bars:8});await new Promise(r=>setTimeout(r,0));const b=makeDemoFile({variant:1,bpm:104,bars:8});
    $('#engineState').textContent='LOADING PHASE DEMO · TRACK A…';await injectTrack(0,a);$('#engineState').textContent='LOADING PHASE DEMO · TRACK B…';await injectTrack(1,b);
    state.bpm=100;const project=$('#projectBpm');if(project){project.value='100.00';change(project)}
    const bpmA=$('#bpm-0'),bpmB=$('#bpm-1');if(bpmA){bpmA.value='100.00';change(bpmA)}if(bpmB){bpmB.value='104.00';change(bpmB)}
    const offsetB=$('#offset-1');if(offsetB){offsetB.value='2.40';change(offsetB)}
    window.dispatchEvent(new Event('resize'));$('#engineState').textContent='DEMO READY · A 100 BPM · B 104 BPM · B STARTS +1 BAR · TRY ALIGN B → A';
  }catch(err){console.error(err);$('#engineState').textContent='DEMO LOAD FAILED';alert('Could not load the Phase demo: '+(err?.message||err))}
  finally{loading=false;if(button){button.disabled=false;button.textContent='DEMO'}}
}

function install(){if($('#demoProject'))return;const b=document.createElement('button');b.id='demoProject';b.className='btn';b.textContent='DEMO';b.title='Load two original procedurally generated tracks into Phase';const anchor=$('#install');anchor?.after(b);b.onclick=loadDemo}
install();window.addEventListener('resize',install);
