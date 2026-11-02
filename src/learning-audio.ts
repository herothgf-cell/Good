/** Plays server-generated audio; never uses installed speech-synthesis voices. */
export interface GeneratedAudio {mime:'audio/wav';base64:string;transcript:string;}
export interface AudioView {phase:'idle'|'playing'|'blocked'|'error';message:string;canReplay:boolean;}
export class LearningAudio {
 private state:AudioView={phase:'idle',message:'',canReplay:false};
 private element:HTMLAudioElement|null=null;private url='';private generation=0;private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private readonly changed:()=>void,private readonly makeAudio:()=>HTMLAudioElement=()=>new Audio()){}
 view():AudioView{return {...this.state};}
 private update(patch:Partial<AudioView>):void{Object.assign(this.state,patch);this.changed();}
 private release():void{this.generation++;clearTimeout(this.timer);this.timer=undefined;if(this.element){this.element.onended=null;this.element.onerror=null;this.element.pause();this.element.removeAttribute('src');this.element.load();}if(this.url)URL.revokeObjectURL(this.url);this.url='';this.element=null;}
 clear():void{this.release();this.state={phase:'idle',message:'',canReplay:false};}
 async play(input:GeneratedAudio):Promise<void>{
  this.clear();
  try{
   if(!input||input.mime!=='audio/wav'||typeof input.base64!=='string'||input.base64.length>2800000||input.base64.length<16||input.base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw Error('invalid audio');
   const bytes=Uint8Array.from(atob(input.base64),c=>c.charCodeAt(0));
   if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')throw Error('invalid audio');
   this.url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));this.element=this.makeAudio();this.element.src=this.url;this.element.preload='auto';
   await this.replay();
  }catch{this.release();this.update({phase:'error',canReplay:false,message:'AI 음성을 준비하지 못했어요. 글은 그대로 확인할 수 있어요.'});}
 }
 async replay():Promise<void>{
  const element=this.element;if(!element||!this.url)return;
  const generation=++this.generation;clearTimeout(this.timer);element.onended=null;element.onerror=null;element.pause();element.currentTime=0;
  element.onended=()=>{if(generation!==this.generation)return;clearTimeout(this.timer);this.timer=undefined;this.update({phase:'idle',canReplay:true,message:'다시 듣기로 같은 음성을 들을 수 있어요.'});};
  element.onerror=()=>{if(generation!==this.generation)return;clearTimeout(this.timer);this.timer=undefined;this.update({phase:'error',canReplay:true,message:'소리 재생을 마치지 못했어요. 다시 듣기를 눌러 주세요.'});};
  try{await element.play();if(generation!==this.generation)return;
   this.update({phase:'playing',canReplay:true,message:'AI가 생성한 음성을 듣고 있어요.'});
   this.timer=setTimeout(()=>{if(generation!==this.generation)return;this.generation++;element.onended=null;element.onerror=null;element.pause();this.update({phase:'error',canReplay:true,message:'긴 음성 재생을 멈췄어요. 다시 듣기로 확인해 주세요.'});},45000);
  }catch{if(generation!==this.generation)return;this.update({phase:'blocked',canReplay:true,message:'브라우저가 소리를 막았어요. 소리 재생을 한 번 눌러 주세요.'});}
 }
}
