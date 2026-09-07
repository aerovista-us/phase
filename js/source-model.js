import{activeAudioParts,trackHasPlayableAudio}from'./stems.js';
export const dbToGain=db=>Math.pow(10,(Number(db)||0)/20);
export function eligibleTracks(tracks){const list=tracks||[],solo=list.some(t=>t.solo);return list.filter(t=>trackHasPlayableAudio(t)&&!t.mute&&(!solo||t.solo))}
export function playbackParts(track){return activeAudioParts(track,{preferRendered:true}).map(part=>({...part,offset:Number.isFinite(track.renderedOffset)?track.renderedOffset:(track.timelineOffset||0)}))}
export function exportItemsForTrack(track){return playbackParts(track).map(part=>({buffer:part.buffer,offset:part.offset,group:`track:${track.id}`,gain:dbToGain(track.gainDb)*part.gain,sourceIn:track.trimIn||0,sourceOut:track.trimOut,fadeInStart:track.fadeInStart,fadeInEnd:track.fadeInEnd,fadeOutStart:track.fadeOutStart,fadeOutEnd:track.fadeOutEnd,stemId:part.id}))}
export function exportItemsForTracks(tracks){return(tracks||[]).flatMap(exportItemsForTrack)}
