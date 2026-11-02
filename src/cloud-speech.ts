import type {CoachIdentity} from './learning-coach.ts';
export type SpeechRequest={text:string}|{unitId:string;index:number};
export type SpeechResult='ended'|'blocked'|'error'|'cancelled';
export interface SpeechPort {play(request:SpeechRequest):Promise<SpeechResult>;stop():void;leave():void;}
export interface SpeechHost {identity:()=>CoachIdentity|null;request:(body:unknown,signal:AbortSignal)=>Promise<any>;render:()=>void;}
/** Transient AI audio shared by the existing chat and phonics. No browser voice dependency. */
export class CloudSpeech implements SpeechPort {
 private generation=0;private operation:AbortController|null=null;private audio:HTMLAudioElement|null=null;private finish:((r:SpeechResult)=>void)|null=null;
 private cache=new Map<string,string>();private cacheIdentity='';
 constructor(private host:SpeechHost){if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)this.leave();});}
 private identityKey():string{const i=this.host.identity();return i?`${i.mode}/${i.familyId}/${i.actorId}/${i.role}`:'';}
 async play(payload:SpeechRequest):Promise<SpeechResult>{
  this.stop();const i=this.host.identity(),key=this.identityKey();
  if(!i||i.role!=='admin'||i.mode!=='cloud'||typeof Audio==='undefined')return 'error';
  if(key!==this.cacheIdentity){this.clearCache();this.cacheIdentity=key;}
  const generation=this.generation,cacheKey=JSON.stringify(payload);this.operation=new AbortController();
  try{
   let url=this.cache.get(cacheKey);
   if(!url){
    const result=await this.host.request({operation:'speech',familyId:i.familyId,requestId:crypto.randomUUID(),...payload},this.operation.signal);
    if(generation!==this.generation||key!==this.identityKey())return 'cancelled';
    if(result?.mime!=='audio/wav'||typeof result.base64!=='string'||result.base64.length>3200100)throw Error('INVALID_AUDIO');
    const bin=atob(result.base64);if(bin.length<44||bin.slice(0,4)!=='RIFF')throw Error('INVALID_AUDIO');
    url=URL.createObjectURL(new Blob([Uint8Array.from(bin,c=>c.charCodeAt(0))],{type:'audio/wav'}));
    this.cache.set(cacheKey,url);while(this.cache.size>16){const first=this.cache.keys().next().value!;URL.revokeObjectURL(this.cache.get(first)!);this.cache.delete(first);}
   }
   if(generation!==this.generation||key!==this.identityKey())return 'cancelled';
   const audio=new Audio();audio.setAttribute('playsinline','');audio.src=url;this.audio=audio;
   return await new Promise<SpeechResult>(resolve=>{
    const timer=setTimeout(()=>done('error'),55000);
    const done=(result:SpeechResult)=>{if(this.finish!==done)return;this.finish=null;clearTimeout(timer);audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');if(this.audio===audio)this.audio=null;resolve(result);};
    this.finish=done;audio.onended=()=>done(generation===this.generation&&key===this.identityKey()?'ended':'cancelled');audio.onerror=()=>done('error');
    void audio.play().catch(()=>done('blocked'));
   });
  }catch{return generation===this.generation?'error':'cancelled';}
  finally{if(generation===this.generation)this.operation=null;}
 }
 stop():void{this.generation++;this.operation?.abort();this.operation=null;this.finish?.('cancelled');this.audio?.pause();this.audio=null;}
 private clearCache():void{for(const url of this.cache.values())URL.revokeObjectURL(url);this.cache.clear();}
 leave():void{this.stop();this.clearCache();this.cacheIdentity='';}
}
