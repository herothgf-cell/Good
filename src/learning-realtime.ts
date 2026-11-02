import type {CoachHost} from './learning-coach.ts';
import type {LabSettings} from '../supabase/functions/_shared/learning-lab-content.ts';
export type RealtimePhase='idle'|'checking'|'ready'|'connecting'|'listening'|'thinking'|'speaking'|'audio-blocked'|'ended'|'error';
export interface RealtimeView {phase:RealtimePhase;active:boolean;available:boolean|null;message:string;caption:string;captions:boolean;responses:number;remainingSeconds:number;voice:'marin'|'cedar';}
export interface RealtimePort {view():RealtimeView;check():Promise<void>;start(topic:LabSettings['topic']):Promise<void>;enableAudio():Promise<void>;toggleCaptions():void;setVoice(voice:'marin'|'cedar'):void;reconcile():void;stop():void;leave():void;}
/** Half-duplex WebRTC: native AI audio, no local TTS or persisted speech/transcripts. */
export class LearningRealtime implements RealtimePort {
 private state:RealtimeView=this.initial();
 private generation=0;private identityKey='';private familyId='';private sessionId='';
 private peer:RTCPeerConnection|null=null;private channel:RTCDataChannel|null=null;private stream:MediaStream|null=null;private audio:HTMLAudioElement|null=null;
 private operation:AbortController|null=null;private tickTimer:ReturnType<typeof setInterval>|undefined;private watchdog:ReturnType<typeof setTimeout>|undefined;private unmuteTimer:ReturnType<typeof setTimeout>|undefined;
 private remoteAudio=false;private connected=false;private greeted=false;private pending=false;private blocked=false;private playbackStopped=false;private heartbeatBusy=false;
 private deadline=0;private lastActivity=0;private lastHeartbeat=0;private committed=new Set<string>();
 constructor(private readonly host:CoachHost){
  if(typeof document!=='undefined'){
   document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state.active)this.end('화면을 벗어나 음성 연결을 종료했어요.','ended');});
   if(typeof window!=='undefined')window.addEventListener('pagehide',()=>this.leave());
  }
 }
 private initial():RealtimeView{return {phase:'idle',active:false,available:null,message:'시작하면 AI가 먼저 인사해요. 이후에는 버튼 없이 말로 이어가세요.',caption:'',captions:false,responses:0,remainingSeconds:300,voice:'marin'};}
 view():RealtimeView{return {...this.state};}
 private key():string{const i=this.host.identity();return i?`${i.mode}/${i.familyId}/${i.actorId}/${i.role}`:'';}
 private allowed():boolean{const i=this.host.identity();return i?.mode==='cloud'&&i.role==='admin';}
 private current(g:number,key:string):boolean{
  if(g!==this.generation)return false;
  if(key!==this.key()||!this.allowed()){this.end('보호자 계정이 바뀌어 음성을 종료했어요.','ended');return false;}
  return true;
 }
 private update(patch:Partial<RealtimeView>):void{Object.assign(this.state,patch);this.host.render();}
 private gate():boolean{
  if(this.allowed())return true;
  this.leave();this.update({phase:'error',available:false,message:'가족 공유의 성인 보호자 계정에서만 사용할 수 있어요. 체험 모드는 실제 음성에 연결하지 않아요.'});return false;
 }
 reconcile():void{if(this.identityKey&&this.identityKey!==this.key())this.leave();}
 setVoice(voice:'marin'|'cedar'):void{if(!this.state.active&&this.state.phase!=='checking'&&['marin','cedar'].includes(voice))this.update({voice});}
 toggleCaptions():void{this.update({captions:!this.state.captions});}
 async check():Promise<void>{
  if(this.state.active||this.state.phase==='checking'||!this.gate())return;
  const g=this.generation,key=this.key();this.identityKey=key;this.operation=new AbortController();
  this.update({phase:'checking',message:'보호자 음성 대화 설정을 확인하고 있어요.'});
  try{
   const result=await this.host.request({operation:'status',familyId:this.host.identity()!.familyId},this.operation.signal);
   if(!this.current(g,key))return;
   this.update({phase:'ready',available:result.available===true,message:result.available===true?'설정이 준비됐어요. 음성 대화를 시작해 실제 연결을 확인하세요.':'서버의 API 키와 보호자 활성화 설정을 확인해 주세요.'});
  }catch(error){if(this.current(g,key))this.update({phase:'error',available:false,message:this.error(error)});}
  finally{if(g===this.generation)this.operation=null;}
 }
 async start(topic:LabSettings['topic']):Promise<void>{
  if(this.state.active||this.state.phase==='checking'||!this.gate())return;
  if(typeof RTCPeerConnection==='undefined'||typeof Audio==='undefined'||!navigator.mediaDevices?.getUserMedia){this.update({phase:'error',message:'이 브라우저는 실시간 마이크 연결을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어 주세요.'});return;}
  const voice=this.state.voice,captions=this.state.captions;this.leave();this.state.voice=voice;this.state.captions=captions;
  const g=this.generation,key=this.key();this.identityKey=key;this.familyId=this.host.identity()!.familyId;this.operation=new AbortController();
  this.update({active:true,phase:'connecting',message:'마이크 사용을 허용해 주세요. AI 음성 연결을 준비해요.'});
  this.watchdog=setTimeout(()=>{if(this.current(g,key))this.end('연결 시간이 초과됐어요. 마이크 권한과 네트워크를 확인해 주세요.','error');},45000);
  try{
   const audio=new Audio();audio.autoplay=true;audio.setAttribute('playsinline','');audio.setAttribute('aria-hidden','true');audio.hidden=true;this.audio=audio;
   // Stable outside the app's re-rendered root. The remote track, not TTS, is the voice.
   document.body?.appendChild(audio);
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(!this.current(g,key)){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.mic(false);
   const peer=new RTCPeerConnection();this.peer=peer;stream.getTracks().forEach(track=>peer.addTrack(track,stream));
   peer.ontrack=event=>{
    if(!this.current(g,key))return;
    audio.srcObject=event.streams[0]||new MediaStream([event.track]);
    void audio.play().then(()=>{if(this.current(g,key)){this.remoteAudio=true;this.listenAfterPlayback();}}).catch(()=>{if(this.current(g,key)){this.blocked=true;this.mic(false);this.update({phase:'audio-blocked',message:'브라우저가 AI 소리를 막았어요. ‘소리 켜기’를 눌러 주세요.'});}});
   };
   peer.onconnectionstatechange=()=>{
    if(!this.current(g,key))return;
    if(['failed','disconnected','closed'].includes(peer.connectionState))this.end('음성 연결이 끊어졌어요. 자동으로 다시 연결하지 않았어요.','error');
   };
   const channel=peer.createDataChannel('oai-events');this.channel=channel;
   channel.onopen=()=>{if(this.current(g,key))this.greet();};
   channel.onmessage=event=>{if(this.current(g,key))this.event(event.data);};
   channel.onclose=()=>{if(this.current(g,key))this.end('음성 연결이 종료됐어요.','ended');};
   channel.onerror=()=>{if(this.current(g,key))this.end('음성 신호를 받지 못했어요.','error');};
   const offer=await peer.createOffer();if(!this.current(g,key))return;
   await peer.setLocalDescription(offer);if(!this.current(g,key))return;
   this.sessionId=crypto.randomUUID();
   const result=await this.host.request({operation:'start',familyId:this.familyId,sessionId:this.sessionId,adultTest:true,topic,voice,sdp:peer.localDescription?.sdp},this.operation!.signal);
   if(!this.current(g,key))return;
   if(typeof result.sdp!=='string'||result.sdp.length>16000||!result.sdp.startsWith('v=0')||!Number.isFinite(result.expiresAt))throw Error('AI 연결 응답을 확인하지 못했어요.');
   this.deadline=Math.min(Date.now()+300000,result.expiresAt);
   if(this.deadline<=Date.now())throw Error('연결 유효 시간이 끝났어요.');
   await peer.setRemoteDescription({type:'answer',sdp:result.sdp});if(!this.current(g,key))return;
   this.connected=true;this.lastActivity=Date.now();this.lastHeartbeat=Date.now();
   this.tickTimer=setInterval(()=>{if(this.current(g,key))this.tick(g,key);},1000);
   this.greet();
  }catch(error){if(this.current(g,key))this.end(error instanceof DOMException&&error.name==='NotAllowedError'?'마이크 권한을 허용해 주세요. 녹음이나 AI 연결을 계속하지 않았어요.':this.error(error),'error');}
 }
 private send(event:Record<string,unknown>):boolean{
  if(this.channel?.readyState!=='open')return false;
  try{this.channel.send(JSON.stringify(event));return true;}catch{this.end('AI에 음성 신호를 보내지 못했어요.','error');return false;}
 }
 private greet():void{
  if(this.greeted||!this.connected||this.channel?.readyState!=='open')return;
  this.greeted=true;
  if(!this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Greet me warmly as an AI English friend in one short sentence, then ask one easy question about our practice topic.'}]}}))return;
  this.reply();
 }
 private mic(enabled:boolean):void{this.stream?.getAudioTracks().forEach(t=>{t.enabled=enabled;});}
 private reply():void{
  if(this.pending||!this.state.active)return;
  if(this.state.responses>=40){this.end('이번 음성 대화의 응답 40회를 마쳤어요.','ended');return;}
  this.pending=true;this.playbackStopped=false;this.lastActivity=Date.now();this.mic(false);clearTimeout(this.unmuteTimer);
  this.update({phase:this.blocked?'audio-blocked':'thinking',caption:'',responses:this.state.responses+1,message:this.blocked?'AI 소리를 허용해 주세요.':'AI가 듣고 답하고 있어요. 잠시만 귀 기울여 주세요.'});
  if(!this.send({type:'response.create',response:{max_output_tokens:512}}))return;
  this.watch(30000);
 }
 private watch(ms:number):void{clearTimeout(this.watchdog);const g=this.generation,key=this.identityKey;this.watchdog=setTimeout(()=>{if(this.current(g,key))this.end('AI 음성 응답이 지연되어 연결을 종료했어요.','error');},ms);}
 private event(raw:unknown):void{
  if(typeof raw!=='string'||raw.length>64000)return;
  let e:any;try{e=JSON.parse(raw);}catch{return;}if(!e||typeof e.type!=='string')return;
  switch(e.type){
   case 'input_audio_buffer.speech_started':if(this.state.phase==='listening'){this.lastActivity=Date.now();this.update({message:'듣고 있어요. 천천히 말씀하세요.'});}break;
   case 'input_audio_buffer.committed':
    if(this.state.phase!=='listening'||typeof e.item_id!=='string'||this.committed.has(e.item_id))break;
    this.committed.add(e.item_id);this.reply();break;
   case 'output_audio_buffer.started':
    this.mic(false);this.pending=true;this.playbackStopped=false;this.watch(45000);
    this.update({phase:this.blocked?'audio-blocked':'speaking',message:this.blocked?'AI 소리를 허용해 주세요.':'AI가 목소리로 이야기하고 있어요.'});break;
   case 'response.output_audio_transcript.delta':
    if(typeof e.delta==='string')this.update({caption:(this.state.caption+e.delta).slice(0,600)});break;
   case 'output_audio_buffer.stopped':
    clearTimeout(this.watchdog);this.pending=false;this.playbackStopped=true;
    if(this.state.responses>=40){this.end('이번 음성 대화를 마쳤어요.','ended');break;}
    this.listenAfterPlayback();break;
   case 'response.done':
    // Generation completion is NOT playback completion. Only buffer.stopped unmutes.
    if(e.response?.status&&e.response.status!=='completed')this.end('AI가 응답을 마치지 못해 연결을 종료했어요.','error');break;
   case 'error':this.end('AI 음성 처리 중 오류가 발생했어요. 자동 재전송하지 않았어요.','error');break;
  }
 }
 private listenAfterPlayback():void{
  if(this.blocked||!this.playbackStopped||!this.state.active)return;
  if(!this.remoteAudio){this.watch(5000);this.update({phase:'connecting',message:'AI의 음성 트랙을 기다리고 있어요.'});return;}
  clearTimeout(this.watchdog);clearTimeout(this.unmuteTimer);const g=this.generation,key=this.identityKey;
  this.unmuteTimer=setTimeout(()=>{
   if(!this.current(g,key)||this.blocked||!this.playbackStopped||this.pending)return;
   if(!this.send({type:'input_audio_buffer.clear'}))return;
   this.lastActivity=Date.now();this.mic(true);this.update({phase:'listening',message:'이제 말씀하세요. 말이 끝나면 AI가 이어서 답해요.'});
  },700);
 }
 async enableAudio():Promise<void>{
  if(!this.audio||!this.state.active)return;const g=this.generation,key=this.identityKey;
  try{await this.audio.play();if(!this.current(g,key))return;this.blocked=false;this.remoteAudio=true;this.update({phase:this.pending?'speaking':'thinking',message:'AI 소리를 켰어요.'});this.listenAfterPlayback();}
  catch{if(this.current(g,key))this.update({phase:'audio-blocked',message:'소리를 재생하지 못했어요. 브라우저 음량·권한을 확인하거나 연결을 종료해 주세요.'});}
 }
 private tick(g:number,key:string):void{
  const remaining=Math.max(0,Math.ceil((this.deadline-Date.now())/1000));
  if(!remaining){this.end('5분 음성 테스트를 마쳤어요. 마이크와 연결을 종료했어요.','ended');return;}
  if(Date.now()-this.lastActivity>=90000){this.end('90초 동안 대화가 없어 연결을 종료했어요.','ended');return;}
  if(remaining!==this.state.remainingSeconds)this.update({remainingSeconds:remaining});
  if(this.heartbeatBusy||Date.now()-this.lastHeartbeat<20000)return;
  this.heartbeatBusy=true;this.lastHeartbeat=Date.now();
  void this.host.request({operation:'heartbeat',familyId:this.familyId,sessionId:this.sessionId},this.operation!.signal).then(result=>{
   if(this.current(g,key)&&result.active!==true)this.end('서버에서 연결 종료를 확인했어요.','ended');
  }).catch(()=>{if(this.current(g,key))this.end('서버 연결 상태를 확인하지 못해 음성을 종료했어요.','error');}).finally(()=>{if(g===this.generation)this.heartbeatBusy=false;});
 }
 private error(error:unknown):string{return error instanceof Error?error.message.slice(0,220):'음성 연결을 확인해 주세요.';}
 private end(message:string,phase:'ended'|'error'):void{this.leave();this.update({phase,message});}
 stop():void{this.end('마이크와 AI 음성 연결을 종료했어요.','ended');}
 leave():void{
  const family=this.familyId,id=this.sessionId,voice=this.state.voice,captions=this.state.captions;
  this.generation++;this.operation?.abort();this.operation=null;clearTimeout(this.watchdog);clearTimeout(this.unmuteTimer);clearInterval(this.tickTimer);
  this.watchdog=undefined;this.unmuteTimer=undefined;this.tickTimer=undefined;
  this.mic(false);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  if(this.channel){this.channel.onopen=null;this.channel.onmessage=null;this.channel.onclose=null;this.channel.onerror=null;try{this.channel.close();}catch{/* already closed */}}this.channel=null;
  if(this.peer){this.peer.ontrack=null;this.peer.onconnectionstatechange=null;try{this.peer.close();}catch{/* already closed */}}this.peer=null;
  if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio.remove();}this.audio=null;
  this.identityKey='';this.sessionId='';this.familyId='';this.remoteAudio=false;this.connected=false;this.greeted=false;this.pending=false;this.blocked=false;this.playbackStopped=false;this.heartbeatBusy=false;this.committed.clear();
  this.state={...this.initial(),voice,captions};
  // A new independent signal lets stop reach the broker after start has been aborted.
  const cleanupGeneration=this.generation;
  if(id&&family)void this.host.request({operation:'stop',familyId:family,sessionId:id},AbortSignal.timeout(12000)).catch(()=>{
   if(cleanupGeneration===this.generation&&!this.state.active&&['ended','error'].includes(this.state.phase))this.update({message:'이 기기의 마이크와 연결은 껐지만 서버 종료 확인은 실패했어요. 다음 접속 때 다시 정리해요.'});
  });
 }
}
