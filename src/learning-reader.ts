import {LearningAudio,type GeneratedAudio,type AudioView} from './learning-audio.ts';
import type {CoachHost} from './learning-coach.ts';
export interface ReaderView {phase:AudioView['phase']|'loading';message:string;canReplay:boolean;}
export interface ReaderPort {view():ReaderView;read(unitId:string,itemId:string):Promise<void>;replay():Promise<void>;stop():void;leave():void;}
/** Only approved course IDs leave the browser. Cache is per identity, in memory, and cleared on exit. */
export class LearningReader implements ReaderPort {
 private state:ReaderView={phase:'idle',message:'',canReplay:false};private generation=0;private key='';private operation:AbortController|null=null;
 private cache=new Map<string,GeneratedAudio>();private player:LearningAudio;
 constructor(private host:CoachHost,makeAudio?:()=>HTMLAudioElement){this.player=new LearningAudio(()=>{this.state=this.player.view();this.host.render();},makeAudio);}
 view():ReaderView{return {...this.state};}
 private currentKey():string{const i=this.host.identity();return i?`${i.familyId}/${i.actorId}/${i.role}/${i.mode}`:'';}
 stop():void{this.generation++;this.operation?.abort();this.operation=null;this.player.clear();this.state={phase:'idle',message:'',canReplay:false};}
 leave():void{this.stop();this.cache.clear();this.key='';}
 async replay():Promise<void>{if(this.key!==this.currentKey()){this.leave();this.host.render();return;}await this.player.replay();}
 async read(unitId:string,itemId:string):Promise<void>{
  const identity=this.host.identity();if(!identity||identity.mode!=='cloud'||identity.role!=='admin'){this.leave();this.state={phase:'error',canReplay:false,message:'가족 공유 보호자 계정에서 AI 읽어주기를 사용할 수 있어요. 체험판은 외부 AI에 연결하지 않아요.'};this.host.render();return;}
  if(this.key!==this.currentKey())this.leave();this.key=this.currentKey();this.stop();const generation=this.generation,key=this.key,cacheKey=`${unitId}/${itemId}`;
  const cached=this.cache.get(cacheKey);if(cached){await this.player.play(cached);return;}
  this.operation=new AbortController();this.state={phase:'loading',canReplay:false,message:'AI 읽어주기 음성을 준비하고 있어요.'};this.host.render();
  try{
   const result=await this.host.request({operation:'read',familyId:identity.familyId,sessionId:crypto.randomUUID(),turnId:crypto.randomUUID(),adultTest:true,unitId,itemId},this.operation.signal);
   if(generation!==this.generation)return;if(key!==this.currentKey()){this.leave();return;}
   if(!result.audio||typeof result.speech!=='string')throw Error('음성을 받지 못했어요.');
   if(this.cache.size>=8)this.cache.delete(this.cache.keys().next().value!);this.cache.set(cacheKey,result.audio);
   await this.player.play(result.audio);
  }catch(error){if(generation===this.generation&&key===this.currentKey()){this.state={phase:'error',canReplay:false,message:error instanceof Error?error.message.slice(0,240):'AI 음성을 받지 못했어요. 다시 듣기를 직접 눌러 시도해 주세요.'};this.host.render();}}
  finally{if(generation===this.generation)this.operation=null;}
 }
}
