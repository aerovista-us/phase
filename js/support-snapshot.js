import{snapshotProject}from'./project-model.js';
import{projectDiagnostics}from'./diagnostics.js';

export const SUPPORT_FORMAT='EchoVerse Phase Support Snapshot';
export const SUPPORT_VERSION=1;

function stripNames(project){
  const copy=structuredClone(project);for(const track of copy.tracks||[]){track.name=track.label;track.fileName=track.fileName?'[source audio]':null;if(track.fileIdentity)track.fileIdentity={...track.fileIdentity,name:track.fileIdentity.name?'[source audio]':null};for(const stem of Object.values(track.stems||{})){stem.fileName=stem.fileName?'[stem audio]':null;if(stem.identity)stem.identity={...stem.identity,name:stem.identity.name?'[stem audio]':null}}}return copy;
}

export function createSupportSnapshot(state,{environment={},runtimeEvents=[],includeFileNames=true,note=''}={}){
  const projectRaw=snapshotProject(state),project=includeFileNames?projectRaw:stripNames(projectRaw),diagnostics=projectDiagnostics(state,environment);
  return{format:SUPPORT_FORMAT,version:SUPPORT_VERSION,createdAt:new Date().toISOString(),note:String(note||''),privacy:{audioBytesIncluded:false,fileNamesIncluded:!!includeFileNames,absolutePathsIncluded:false},diagnostics,runtimeEvents:Array.isArray(runtimeEvents)?runtimeEvents.slice(-24):[],project};
}

export function supportSummary(snapshot){
  if(!snapshot||snapshot.format!==SUPPORT_FORMAT)return null;
  return{version:snapshot.version||null,warnings:snapshot.diagnostics?.warnings?.length||0,runtimeEvents:snapshot.runtimeEvents?.length||0,tracks:snapshot.project?.tracks?.length||0,audioBytesIncluded:!!snapshot.privacy?.audioBytesIncluded,fileNamesIncluded:!!snapshot.privacy?.fileNamesIncluded};
}
