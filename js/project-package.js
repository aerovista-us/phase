import{snapshotProject,validateProject}from'./project-model.js';
import{STEM_TYPES}from'./stems.js';

export const PHASE_PACKAGE_FORMAT='EchoVerse Phase Project Package';
export const PHASE_PACKAGE_VERSION=1;

export function projectAssetInventory(project){
  validateProject(project);const assets=[];
  (project.tracks||[]).forEach((track,trackIndex)=>{
    if(track.fileName)assets.push({track:trackIndex,trackLabel:track.label||`TRACK ${trackIndex+1}`,role:'source',stem:null,fileName:track.fileName,identity:track.fileIdentity||{name:track.fileName}});
    for(const stem of STEM_TYPES){const meta=track.stems?.[stem];if(meta?.fileName)assets.push({track:trackIndex,trackLabel:track.label||`TRACK ${trackIndex+1}`,role:'stem',stem,fileName:meta.fileName,identity:meta.identity||{name:meta.fileName}})}
  });
  return assets;
}

export function createProjectPackage(state,{name='Phase Project'}={}){
  const project=snapshotProject(state),assets=projectAssetInventory(project);
  return{...project,package:{format:PHASE_PACKAGE_FORMAT,version:PHASE_PACKAGE_VERSION,name:String(name||'Phase Project'),createdAt:project.savedAt,assetCount:assets.length,assets,instructions:'Keep this .phase.json file with the listed source/stem files. In Phase, load the package then use RELINK FILES to reconnect the assets. Audio bytes are intentionally not embedded.'}};
}

export function packageSummary(data){
  validateProject(data);const assets=Array.isArray(data.package?.assets)?data.package.assets:projectAssetInventory(data),sources=assets.filter(a=>a.role==='source'),stems=assets.filter(a=>a.role==='stem');
  return{packaged:data.package?.format===PHASE_PACKAGE_FORMAT,packageVersion:Number(data.package?.version)||null,name:data.package?.name||null,assetCount:assets.length,sourceCount:sources.length,stemCount:stems.length,assets};
}
