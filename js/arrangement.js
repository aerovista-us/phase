export const SNAP_MODES={beat:.25,bar:1,'8bar':8,'16bar':16,'32bar':32};

export function firstDownbeatIndex(track){const i=track?.markers?.findIndex(m=>m.downbeat);return i>=0?i:0}

export function snapStepSeconds(bpm,mode='beat'){
  const beat=60/Math.max(1,+bpm||120);
  if(mode==='beat')return beat;
  return beat*4*(SNAP_MODES[mode]||1);
}

export function snapTrackOffset(offset,anchorLocalTime,bpm,mode='beat'){
  if(mode==='off')return offset;
  const step=snapStepSeconds(bpm,mode),globalAnchor=offset+(anchorLocalTime||0);
  return Math.round(globalAnchor/step)*step-(anchorLocalTime||0);
}

export function alignByMarkers(master,follower,masterIndex,followerIndex){
  if(!master?.markers?.length||!follower?.markers?.length)throw new Error('Both tracks need beat markers');
  const a=Math.max(0,Math.min(master.markers.length-1,Number.isInteger(masterIndex)?masterIndex:firstDownbeatIndex(master)));
  const b=Math.max(0,Math.min(follower.markers.length-1,Number.isInteger(followerIndex)?followerIndex:firstDownbeatIndex(follower)));
  const fallback=60/(master.sourceBpm||120);
  const targetAt=index=>{
    if(index<0){const step=master.markers.length>1?master.markers[1].targetTime-master.markers[0].targetTime:fallback;return master.markers[0].targetTime+index*step}
    if(index>=master.markers.length){const last=master.markers.length-1,step=last>0?master.markers[last].targetTime-master.markers[last-1].targetTime:fallback;return master.markers[last].targetTime+(index-last)*step}
    return master.markers[index].targetTime;
  };
  follower.markers.forEach((m,i)=>{m.targetTime=targetAt(a+(i-b));m.locked=false});
  if(follower.markers[b])follower.markers[b].locked=true;
  return{masterIndex:a,followerIndex:b,targetTime:targetAt(a)};
}
