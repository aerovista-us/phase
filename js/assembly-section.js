// Authoritative PCM sample aligned Master Assembly selection export validation.
export function sectionRange(start,end,projectDuration,sampleRate,{maxOutputBytes=128*1024*1024}={}){
 const values=[start,end,projectDuration,sampleRate];
 if(values.some(x=>!Number.isFinite(Number(x))))throw Error('Enter valid IN and OUT seconds');
 const sr=Number(sampleRate),duration=Number(projectDuration);
 if(sr<8000||sr>384000||duration<=0)throw Error('Invalid project sample rate or duration');
 const first=Math.round(Number(start)*sr),last=Math.round(Number(end)*sr);
 if(first<0||last<=first||last>Math.ceil(duration*sr+0.5))
  throw Error('Selection must start at or after 0, end after IN, and stay within the master');
 const frames=last-first,outputBytes=frames*2*6;
 if(outputBytes>maxOutputBytes)throw Error('Section export is too large. Export a shorter selection.');
 return{first,last,start:first/sr,end:last/sr,frames,outputBytes};
}
export function sectionFilename(start,end){
 const seconds=t=>Number(t).toFixed(3).replace('.','-');
 return 'phase-master-'+seconds(start)+'_to_'+seconds(end)+'.wav';
}
