import type {LabSettings} from '../supabase/functions/_shared/learning-lab-content.ts';

export interface CoachMessage {role:'assistant'|'user';text:string;hint?:string;modelPhrase?:string;}
export interface CoachView {phase:'idle'|'checking'|'ready'|'recording'|'sending'|'speaking'|'error';available:boolean|null;message:string;messages:CoachMessage[];turns:number;}
export interface CoachPort {
  view():CoachView;
  check():Promise<void>;
  startRecording(topic:LabSettings['topic']):Promise<void>;
  finishRecording():Promise<void>;
  sendText(text:string,topic:LabSettings['topic']):Promise<void>;
  leave():void;
}
export interface CoachIdentity {familyId:string;actorId:string;role:string;mode:'demo'|'cloud';}
export interface CoachHost {identity:()=>CoachIdentity|null;request:(body:unknown,signal:AbortSignal)=>Promise<any>;render:()=>void;}
export class LearningCoach implements CoachPort {
  private state:CoachView=this.initial();
  private generation=0;private identityKey='';private sessionId='';private startedAt=0;
  private operation:AbortController|null=null;private stream:MediaStream|null=null;private recorder:MediaRecorder|null=null;
  private chunks:Blob[]=[];private bytes=0;private topic:LabSettings['topic']='play';
  private timer:ReturnType<typeof setTimeout>|undefined;private speechTimer:ReturnType<typeof setTimeout>|undefined;
  private utterance:SpeechSynthesisUtterance|null=null;
  constructor(private host:CoachHost){
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden){this.leave();this.host.render();}});
  }
  private initial():CoachView{return {phase:'idle',available:null,message:'연결을 확인한 뒤 보호자가 짧은 문장으로 테스트해 주세요.',messages:[],turns:0};}
  view():CoachView{return structuredClone(this.state);}
  private key():string{const i=this.host.identity();return i?`${i.mode}/${i.familyId}/${i.actorId}/${i.role}`:'';}
  private allowed():boolean{const i=this.host.identity();return !!i&&i.role==='admin'&&i.mode==='cloud';}
  private current(generation:number,key:string):boolean{
    if(generation!==this.generation)return false;
    if(key!==this.key()||!this.allowed()){this.leave();return false;}
    return true;
  }
  private update(patch:Partial<CoachView>){Object.assign(this.state,patch);this.host.render();}
  private busy(){return ['checking','recording','sending','speaking'].includes(this.state.phase);}
  private ready():boolean{
    if(!this.allowed()){
      this.leave();this.update({available:false,message:'가족 공유의 보호자 계정에서 실제 AI 연결을 테스트할 수 있어요.'});return false;
    }
    if(this.identityKey!==this.key()){this.leave();return false;}
    if(this.busy()||this.state.available!==true)return false;
    if(this.state.turns>=12||(this.startedAt&&Date.now()-this.startedAt>=15*60*1000)){
      this.update({phase:'error',message:'이번 대화 테스트가 끝났어요. ‘AI 연결·음성 멈추기’를 누른 뒤 새로 연결해 주세요.'});return false;
    }
    return true;
  }
  async check():Promise<void>{
    if(this.busy())return;
    if(!this.allowed()){this.leave();this.update({available:false,message:'가족 공유의 보호자 계정에서 실제 AI 연결을 테스트할 수 있어요. 체험 모드에서는 시나리오 연습을 확인해 주세요.'});return;}
    if(this.identityKey&&this.identityKey!==this.key())this.leave();
    this.identityKey=this.key();const generation=this.generation,key=this.identityKey;
    this.operation=new AbortController();this.update({phase:'checking',message:'보호자 AI 연결 상태를 확인하고 있어요.'});
    try{
      const result=await this.host.request({operation:'status',familyId:this.host.identity()!.familyId},this.operation.signal);
      if(!this.current(generation,key))return;
      this.update({available:result.available===true,phase:'ready',message:typeof result.message==='string'?result.message.slice(0,300):result.available?'보호자의 짧은 문장을 말하거나 입력해 주세요.':'AI 연결 설정을 준비 중이에요.'});
    }catch(error){if(this.current(generation,key))this.update({phase:'error',available:false,message:this.errorMessage(error)});}
    finally{if(generation===this.generation)this.operation=null;}
  }
  async startRecording(topic:LabSettings['topic']):Promise<void>{
    if(!this.ready())return;
    if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      this.update({phase:'error',message:'이 브라우저에서 녹음할 수 없어요. 아래 글 입력으로 대화를 테스트해 주세요.'});return;
    }
    const generation=this.generation,key=this.identityKey;this.topic=topic;
    if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
    this.update({phase:'checking',message:'마이크 사용을 허용하면 최대 15초 동안 녹음해요.'});
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!this.current(generation,key)){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;this.chunks=[];this.bytes=0;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(value=>MediaRecorder.isTypeSupported(value));
      if(!mime)throw new Error('지원하는 녹음 형식이 없어요. 글로 테스트해 주세요.');
      const recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});this.recorder=recorder;
      recorder.ondataavailable=event=>{
        if(!this.current(generation,key)||!event.data.size)return;
        this.bytes+=event.data.size;
        if(this.bytes>512000){this.stopMedia();this.update({phase:'error',message:'녹음이 너무 커서 전송하지 않았어요. 더 짧게 말해 주세요.'});return;}
        this.chunks.push(event.data);
      };
      recorder.onerror=()=>{if(this.current(generation,key)){this.stopMedia();this.update({phase:'error',message:'녹음을 마치지 못했어요. 글로 테스트하거나 다시 녹음해 주세요.'});}};
      recorder.onstop=()=>{void this.submitRecording(generation,key,mime.split(';')[0]!);};
      recorder.start(250);this.timer=setTimeout(()=>{void this.finishRecording();},15000);
      this.update({phase:'recording',message:'보호자 목소리를 듣고 있어요. 끝나면 ‘녹음 마치고 보내기’를 눌러 주세요.'});
    }catch(error){if(this.current(generation,key)){this.stopMedia();this.update({phase:'error',message:error instanceof DOMException&&error.name==='NotAllowedError'?'마이크 권한이 없어 녹음하지 않았어요. 아래 글 입력으로 테스트할 수 있어요.':this.errorMessage(error)});}}
  }
  async finishRecording():Promise<void>{
    if(this.state.phase!=='recording'||!this.recorder)return;
    clearTimeout(this.timer);this.timer=undefined;
    this.update({phase:'sending',message:'녹음을 마치고 있어요.'});
    if(this.recorder.state!=='inactive')this.recorder.stop();
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
  }
  private async submitRecording(generation:number,key:string,mime:string){
    if(!this.current(generation,key))return;
    const blob=new Blob(this.chunks,{type:mime});this.chunks=[];this.recorder=null;
    if(!blob.size){this.update({phase:'error',message:'녹음된 소리가 없어요. 다시 녹음하거나 글로 테스트해 주세요.'});return;}
    const bytes=new Uint8Array(await blob.arrayBuffer());if(!this.current(generation,key))return;
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    await this.send({audio:{mime,base64:btoa(binary)}},this.topic,generation,key);
  }
  async sendText(text:string,topic:LabSettings['topic']):Promise<void>{
    if(!this.ready())return;
    text=text.trim();if(!text||text.length>600){this.update({phase:'error',message:'600자 이내의 짧은 문장으로 말해 주세요.'});return;}
    await this.send({text},topic,this.generation,this.identityKey);
  }
  private async send(payload:{text?:string;audio?:{mime:string;base64:string}},topic:LabSettings['topic'],generation:number,key:string){
    if(!this.current(generation,key))return;
    if(!this.sessionId){this.sessionId=crypto.randomUUID();this.startedAt=Date.now();}
    this.operation=new AbortController();const signal=this.operation.signal;
    const history=this.state.messages.slice(-8).map(message=>({role:message.role,text:[message.modelPhrase,message.text].filter(Boolean).join(' ').slice(0,600)}));
    this.update({phase:'sending',turns:this.state.turns+1,message:'AI가 문장의 뜻을 이해하고 답을 준비하고 있어요.'});
    try{
      const result=await this.host.request({operation:'turn',familyId:this.host.identity()!.familyId,sessionId:this.sessionId,turnId:crypto.randomUUID(),adultTest:true,topic,...payload,history},signal);
      if(!this.current(generation,key))return;
      if(typeof result.transcript!=='string'||result.transcript.length>600||typeof result.reply!=='string'||result.reply.length>240||typeof result.speech!=='string'||result.speech.length>400)throw new Error('AI 답변 형식을 확인하지 못했어요.');
      this.state.messages=[...this.state.messages,{role:'user' as const,text:result.transcript},{role:'assistant' as const,text:result.reply,hint:typeof result.hint==='string'?result.hint.slice(0,160):'',modelPhrase:typeof result.modelPhrase==='string'?result.modelPhrase.slice(0,100):''}].slice(-24);
      this.speak(result.speech,generation,key);
    }catch(error){if(this.current(generation,key))this.update({phase:'error',message:`${this.errorMessage(error)} 자동으로 재전송하지 않았어요.`});}
    finally{if(generation===this.generation)this.operation=null;}
  }
  private speak(text:string,generation:number,key:string){
    const voice=typeof speechSynthesis==='undefined'?undefined:speechSynthesis.getVoices().find(v=>v.localService&&/^en(?:-|_)/i.test(v.lang));
    if(!voice||typeof SpeechSynthesisUtterance==='undefined'){
      this.update({phase:'ready',message:'AI 답변이 도착했어요. 이 기기에 사용할 수 있는 영어 음성이 없어 글로 보여드려요.'});return;
    }
    const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=0.85;
    this.utterance=utterance;speechSynthesis.cancel();
    const done=(message:string,cancel=false)=>{
      if(this.utterance!==utterance||!this.current(generation,key))return;
      this.utterance=null;clearTimeout(this.speechTimer);this.speechTimer=undefined;
      if(cancel)speechSynthesis.cancel();
      this.update({phase:'ready',message});
    };
    utterance.onend=()=>done('이제 보호자 차례예요. 짧게 대답해 주세요.');
    utterance.onerror=()=>done('음성을 재생하지 못했어요. AI 답변은 글로 확인해 주세요.');
    this.update({phase:'speaking',message:'AI가 만든 답변을 기기의 영어 음성으로 읽고 있어요.'});
    this.speechTimer=setTimeout(()=>done('이제 보호자 차례예요. 짧게 대답해 주세요.',true),20000);
    speechSynthesis.speak(utterance);
  }
  private errorMessage(error:unknown):string{return error instanceof Error?error.message.slice(0,240):'연결을 확인해 주세요.';}
  private stopMedia(){
    clearTimeout(this.timer);this.timer=undefined;
    if(this.recorder){this.recorder.ondataavailable=null;this.recorder.onstop=null;this.recorder.onerror=null;if(this.recorder.state!=='inactive')try{this.recorder.stop();}catch{/* Already closed. */}}
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.recorder=null;this.chunks=[];this.bytes=0;
  }
  leave():void{
    this.utterance=null;this.generation++;this.operation?.abort();this.operation=null;this.stopMedia();clearTimeout(this.speechTimer);this.speechTimer=undefined;
    if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
    this.identityKey='';this.sessionId='';this.startedAt=0;this.state=this.initial();
  }
}
