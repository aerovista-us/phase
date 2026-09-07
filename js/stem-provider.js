import{STEM_TYPES}from'./stems.js';
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
export const STEM_PRESETS={fourStem:{id:'4stem',stems:[...STEM_TYPES]}};
export function normalizeProviderEndpoint(value){const s=String(value||'').trim();if(!s)return'';return s.replace(/\/+$/,'')}
export function resolveProviderUrl(endpoint,value){return new URL(String(value||''),normalizeProviderEndpoint(endpoint)+'/').href}
export function validateStemResult(stems){if(!stems||typeof stems!=='object')throw new Error('Stem provider returned no stems');const present=STEM_TYPES.filter(id=>stems[id]);if(!present.length)throw new Error('Stem provider returned no recognized stem slots');return present}
function abortError(){const e=new Error('Stem separation cancelled');e.name='AbortError';return e}
function sleep(ms,signal){if(signal?.aborted)return Promise.reject(abortError());return new Promise((resolve,reject)=>{const t=setTimeout(resolve,Math.max(0,ms));signal?.addEventListener('abort',()=>{clearTimeout(t);reject(abortError())},{once:true})})}
async function jsonOrThrow(response,label){if(!response?.ok)throw new Error(`${label} failed · HTTP ${response?.status||0}`);try{return await response.json()}catch{throw new Error(`${label} returned invalid JSON`)}}

export function createHttpStemProvider({endpoint,fetchImpl=globalThis.fetch,pollMs=1200}={}){
  const base=normalizeProviderEndpoint(endpoint);if(!base)throw new Error('Stem provider endpoint is required');if(typeof fetchImpl!=='function')throw new Error('fetch is unavailable');
  return{
    id:'http',endpoint:base,
    async separate({file,preset='4stem',trackLabel='',signal,onProgress}={}){
      if(!file)throw new Error('Source audio file is required');if(signal?.aborted)throw abortError();
      const form=new FormData();form.append('audio',file,file.name||'phase-source-audio');form.append('preset',preset);if(trackLabel)form.append('trackLabel',trackLabel);
      onProgress?.({stage:'upload',progress:0});const created=await jsonOrThrow(await fetchImpl(`${base}/v1/stem-jobs`,{method:'POST',body:form,signal}),'Stem job creation');
      if(!created.id&&!created.statusUrl)throw new Error('Stem provider did not return a job id/status URL');const jobId=created.id||null,statusUrl=resolveProviderUrl(base,created.statusUrl||`/v1/stem-jobs/${encodeURIComponent(jobId)}`);onProgress?.({stage:'queued',progress:clamp(created.progress),jobId});
      let result=created.status==='complete'?created:null;
      while(!result){if(signal?.aborted)throw abortError();const status=await jsonOrThrow(await fetchImpl(statusUrl,{signal}),'Stem job status'),state=String(status.status||'').toLowerCase();onProgress?.({stage:state||'running',progress:clamp(status.progress),jobId});if(state==='error'||state==='failed')throw new Error(status.message||'Stem separation failed');if(state==='complete'||state==='completed'||state==='done'){result=status;break}await sleep(pollMs,signal)}
      const present=validateStemResult(result.stems),stems={};let done=0;
      for(const id of present){const entry=result.stems[id],url=resolveProviderUrl(base,typeof entry==='string'?entry:entry.url);const response=await fetchImpl(url,{signal});if(!response?.ok)throw new Error(`${id} stem download failed · HTTP ${response?.status||0}`);const blob=await response.blob(),fileName=(typeof entry==='object'&&entry.fileName)||`${id}.wav`;stems[id]={blob,fileName,type:blob.type||'audio/wav'};done++;onProgress?.({stage:'download',progress:done/present.length,jobId,stem:id})}
      onProgress?.({stage:'complete',progress:1,jobId});return{provider:'http',jobId,preset,stems}
    }
  }
}
