import {PHONICS_SOURCE,PHONICS_VERSION,PHONICS_UNITS,getPhonicsUnit,buildPhonicsSteps,type PhonicsStep,type PhonicsObservation} from '../supabase/functions/_shared/phonics-course.ts';
import {englishLearningFor,type EnglishLearning} from '../supabase/functions/_shared/english-learning.ts';
import type {CoachIdentity} from './learning-coach.ts';
import type {SpeechPort} from './cloud-speech.ts';
import {labEscape as e} from './learning-lab-visuals.ts';
export interface PhonicsHost {identity:()=>CoachIdentity|null;request:(body:unknown,signal:AbortSignal)=>Promise<any>;speech:SpeechPort;render:()=>void;}
const button=(label:string,action:string,extra='',disabled=false)=>`<button type="button" class="lab-button lab-secondary" data-lab-action="phonics-${action}" ${extra}${disabled?' disabled':''}>${e(label)}</button>`;
const label:Record<PhonicsStep['kind'],string>={listen:'듣고 뜻 알기',read:'직접 읽기',write:'따라 쓰고 철자 완성',recall:'뜻에서 낱말 떠올리기',sentence:'문장 듣고 읽기',review:'마지막 복습'};
/** Sequential guardian preview. Only observations/cursors persist; pen strokes remain transient. */
export class PhonicsController {
 private progress:EnglishLearning=englishLearningFor({});private active=false;private generation=0;private key='';private operation:AbortController|null=null;
 private loaded=false;private loading=false;private choosing=false;private input='';private attempts=0;private help=false;private revealed=false;private status='';private voiceStatus='';private speaking=false;private autoRead=true;
 private pending:{requestId:string;action:unknown}|null=null;private strokes:{x:number;y:number;start:boolean}[]=[];private pointer:number|null=null;
 constructor(private host:PhonicsHost){
  if(typeof document!=='undefined'){
   document.addEventListener('input',ev=>{const el=ev.target;if(el instanceof HTMLInputElement&&el.id==='phonics-answer')this.input=el.value.slice(0,40);});
   document.addEventListener('pointerdown',ev=>this.draw(ev,true));document.addEventListener('pointermove',ev=>this.draw(ev,false));
   document.addEventListener('pointerup',()=>this.pointer=null);document.addEventListener('pointercancel',()=>this.pointer=null);
   document.addEventListener('visibilitychange',()=>{if(document.hidden){this.host.speech.stop();this.speaking=false;this.pointer=null;}});
  }
 }
 private identity():string{const i=this.host.identity();return i?`${i.mode}/${i.familyId}/${i.actorId}/${i.role}`:'';}
 private valid(g:number):boolean{if(g!==this.generation||!this.active)return false;if(this.key!==this.identity()||this.host.identity()?.role!=='admin'){this.leave();return false;}return true;}
 private step():PhonicsStep|undefined{return buildPhonicsSteps(this.progress.selectedUnit)[this.cursor()];}
 private cursor():number{return this.progress.units[this.progress.selectedUnit]?.cursor??0;}
 private resetStep():void{this.host.speech.stop();this.input='';this.attempts=0;this.help=false;this.revealed=false;this.strokes=[];this.pointer=null;this.voiceStatus='';this.speaking=false;}
 async open():Promise<void>{this.leave();this.active=true;this.key=this.identity();await this.load();}
 private async load():Promise<void>{
  if(this.loading||this.host.identity()?.role!=='admin')return;const g=this.generation;this.loaded=false;this.loading=true;this.status='저장한 파닉스 진도를 불러오고 있어요.';this.host.render();this.operation=new AbortController();
  try{const r=await this.host.request({operation:'progress'},this.operation.signal);if(!this.valid(g))return;this.accept(r.progress);this.pending=null;this.loaded=true;this.resetStep();this.status='마친 단계부터 이어서 할 수 있어요.';}
  catch{if(this.valid(g))this.status='진도를 불러오지 못했어요. ‘진도 다시 불러오기’를 눌러 주세요.';}
  finally{if(this.valid(g)){this.loading=false;this.operation=null;this.host.render();if(this.loaded)this.autoSay();}}
 }
 private accept(progress:EnglishLearning):void{
  if(!progress||progress.version!==PHONICS_VERSION||!PHONICS_UNITS.some(u=>u.id===progress.selectedUnit)||!progress.units||typeof progress.units!=='object')throw Error('INVALID_PROGRESS');
  for(const [id,p] of Object.entries(progress.units)){if(!PHONICS_UNITS.some(u=>u.id===id)||!Number.isSafeInteger(p.cursor)||p.cursor<0||p.cursor>buildPhonicsSteps(id).length||!Number.isSafeInteger(p.attempt)||p.attempt<0)throw Error('INVALID_PROGRESS');}
  this.progress=structuredClone(progress);
 }
 private async command(action:unknown,retry=false):Promise<boolean>{
  if(!this.loaded||this.loading||!this.active||this.host.identity()?.role!=='admin')return false;
  if(!retry)this.pending={requestId:crypto.randomUUID(),action};const pending=this.pending;if(!pending)return false;
  const g=this.generation;this.loading=true;this.operation=new AbortController();this.host.render();
  try{const r=await this.host.request({operation:'command',...pending},this.operation.signal);if(!this.valid(g))return false;this.accept(r.progress);this.pending=null;this.status='진도를 저장했어요.';return true;}
  catch(error){if(this.valid(g))this.status=(error instanceof Error?error.message:'저장하지 못했어요.')+' 같은 기록 다시 저장 또는 진도 다시 불러오기를 이용해 주세요.';return false;}
  finally{if(this.valid(g)){this.loading=false;this.operation=null;this.host.render();}}
 }
 private async say():Promise<void>{
  if(!this.loaded||!this.step()||this.speaking||this.loading||this.pending)return;
  const g=this.generation;this.speaking=true;this.voiceStatus='AI가 이 낱말·문장을 읽어주고 있어요.';this.help=true;this.host.render();
  const result=await this.host.speech.play({unitId:this.progress.selectedUnit,index:this.cursor()});
  if(!this.valid(g))return;this.speaking=false;this.voiceStatus=result==='ended'?'다시 듣기로 같은 소리를 반복할 수 있어요.':result==='blocked'?'소리 재생이 막혔어요. ‘AI 다시 듣기’를 눌러 주세요.':result==='cancelled'?'소리를 멈췄어요.':'AI 소리를 받지 못했어요. 가족 공유 보호자 로그인과 서버 연결을 확인한 뒤 다시 눌러 주세요.';this.host.render();
 }
 private autoSay():void{if(this.autoRead&&this.host.identity()?.mode==='cloud'&&['listen','sentence'].includes(this.step()?.kind??''))void this.say();}
 async handle(action:string,el?:HTMLElement):Promise<void>{
  if(!this.active||this.host.identity()?.role!=='admin')return;
  if(action==='reload'){this.host.speech.stop();await this.load();return;}
  if(action==='retry'){const ok=await this.command(null,true);if(ok){this.resetStep();this.autoSay();}this.host.render();return;}
  if(!this.loaded||this.loading||this.pending)return;
  if(action==='choose'){this.host.speech.stop();this.choosing=!this.choosing;}
  else if(action==='select'&&el?.dataset.unitId){if(await this.command({type:'phonics/select',unitId:el.dataset.unitId})){this.choosing=false;this.resetStep();this.autoSay();}}
  else if(action==='listen')await this.say();
  else if(action==='stop-audio'){this.host.speech.stop();this.speaking=false;this.voiceStatus='소리를 멈췄어요.';}
  else if(action==='auto'){this.autoRead=!this.autoRead;}
  else if(action==='reveal'){this.help=true;this.revealed=true;}
  else if(action==='letter'&&el?.dataset.letter){this.input=(this.input+el.dataset.letter).slice(0,40);}
  else if(action==='erase')this.input=this.input.slice(0,-1);
  else if(action==='clear-ink'){this.strokes=[];this.pointer=null;}
  else if(action==='restart'){
   const unitId=this.progress.selectedUnit,attempt=this.progress.units[unitId]?.attempt??0;
   if(await this.command({type:'phonics/restart',unitId,attempt})){this.resetStep();this.autoSay();}
  }else if(action==='next'||action==='review')await this.complete(action==='review');
  this.host.render();
 }
 async submit(form:HTMLFormElement):Promise<void>{this.input=String(new FormData(form).get('answer')??'').slice(0,40);await this.complete(false);}
 private async complete(review:boolean):Promise<void>{
  const step=this.step();if(!this.loaded||!step||this.loading||this.pending)return;
  this.attempts=Math.min(30,this.attempts+1);const spelling=['write','recall','review'].includes(step.kind);
  if(spelling&&!review&&this.input.normalize('NFKC').trim().toLowerCase()!==step.target.toLowerCase()){this.status='철자를 다시 확인해요. 힌트로 글자를 보거나 다시 연습으로 남길 수 있어요.';this.host.render();return;}
  const record:PhonicsObservation={outcome:review?'review':this.help?'supported':'independent',attempts:this.attempts,help:this.help,...(spelling&&!review?{answer:this.input.trim()}: {})};
  const unitId=this.progress.selectedUnit,action={type:'phonics/complete',unitId,index:this.cursor(),attempt:this.progress.units[unitId]?.attempt??0,version:PHONICS_VERSION,record};
  this.host.speech.stop();this.speaking=false;
  if(await this.command(action)){this.resetStep();this.autoSay();}this.host.render();
 }
 render():string{
  const unit=getPhonicsUnit(this.progress.selectedUnit),steps=buildPhonicsSteps(unit.id),step=this.step(),done=!step;
  const head=`<header class="lab-heading"><div><span class="lab-eyebrow">PHONICS · LISTEN / READ / WRITE</span><h1>파닉스 · 단어·읽기·쓰기</h1><p>한 낱말씩 배우고, 멈춘 단계부터 이어서 해요.</p></div><span class="lab-badge">보호자 전용 · 별 0개</span></header><div class="lab-actions"><button type="button" class="lab-button lab-quiet" data-lab-action="phonics-back">← 학습 목록</button>${button('단원 선택','choose')}${button('진도 다시 불러오기','reload','',this.loading)}</div><p class="lab-note">참고: ${e(PHONICS_SOURCE.title)}. AI 생성 음성은 교재의 공식 녹음이 아니에요. 기기 영어 음성을 설치할 필요가 없어요.</p>`;
  const status=`<p class="phonics-status" role="status">${e(this.status)}${this.host.identity()?.mode==='demo'?' · 체험 모드에서는 현재 페이지에만 진도를 보관하며 AI 음성을 생성하지 않아요.':''}</p>${this.pending&&!this.loading?button('같은 기록 다시 저장','retry'):''}`;
  if(!this.loaded)return head+status;
  if(this.choosing)return head+status+`<section class="phonics-unit-grid" aria-label="파닉스 단원 순서">${PHONICS_UNITS.map(u=>{const p=this.progress.units[u.id];return `<article class="lab-card"><h2>${u.number?String(u.number).padStart(2,'0'):'보충'} ${e(u.title)}</h2><small>${u.source==='seoul15'?`교재 ${u.printedPage}–${u.printedPage!+1}쪽 · PDF ${u.pdfPage}–${u.pdfPage!+1}쪽`:'앱 추가 자료 · PDF에 없는 ai/ay 복습'}</small><p>${u.words.map(w=>e(w.text)).join(' · ')}</p>${button(p?.cursor?'이 단원 이어서':'이 단원부터 시작','select',`data-unit-id="${u.id}"`)}<small>완료 ${p?.cursor??0} / ${buildPhonicsSteps(u.id).length}단계</small></article>`;}).join('')}</section>`;
  const current=`<div class="lab-goal"><h2>${unit.number?`${String(unit.number).padStart(2,'0')} `:''}${e(unit.title)}</h2><p>${unit.source==='seoul15'?`교재 ${unit.printedPage}–${unit.printedPage!+1}쪽 · PDF ${unit.pdfPage}–${unit.pdfPage!+1}쪽`:'PDF 외 보충 단원'}</p><div class="phonics-patterns">${unit.patterns.map(p=>`<span>${e(p)}</span>`).join('')}</div><small>소리 묶음을 눈으로 연결하고, AI는 낱말 전체를 읽어줘요.</small></div>`;
  if(done){const idx=PHONICS_UNITS.findIndex(u=>u.id===unit.id),next=PHONICS_UNITS[idx+1];return head+current+status+`<section class="lab-panel"><h2>이 단원을 끝까지 연습했어요</h2><p>읽기는 직접 관찰, 쓰기는 입력한 철자를 확인한 기록이에요. 발음·손글씨 모양의 자동 평가가 아니에요.</p><div class="lab-actions">${next?button('다음 단원으로','select',`data-unit-id="${next.id}"`):''}${button('이 단원 처음부터 다시 연습','restart')}</div></section>`;}
  const hidden=['recall','review'].includes(step.kind)&&!this.revealed,writing=['write','recall','review'].includes(step.kind);
  const letters=[...new Set([...step.target.toLowerCase(),'e','a'])].sort();
  return head+current+`<div class="lab-progress-caption"><span>${this.cursor()+1} / ${steps.length}단계${step.wordIndex>=0?` · 낱말 ${step.wordIndex+1} / ${unit.words.length}`:''}</span><strong>${label[step.kind]}</strong></div><section class="lab-question phonics-question" data-phonics-kind="${step.kind}"><h2>${e(step.meaning)}</h2>${hidden?'<p class="lab-recall">영어 글자를 가렸어요. 뜻을 보고 낱말을 떠올려 보세요.</p>':`<p class="lab-target" lang="en">${e(step.target)}</p>`}<div class="lab-actions">${button('🔊 AI 다시 듣기','listen','',this.speaking||this.loading)}${button('소리 멈추기','stop-audio')}${button(this.autoRead?'자동 읽기 켜짐':'자동 읽기 꺼짐','auto')}${hidden?button('글자 힌트 보기','reveal'):''}</div><p class="phonics-voice-status" role="status">${e(this.voiceStatus)}</p>${step.kind==='write'?`<div class="phonics-writing"><p>연한 글자 위에 손가락·펜으로 따라 써 보세요.</p><canvas id="phonics-canvas" aria-label="${e(step.target)} 따라 쓰기 연습판" tabindex="0"></canvas>${button('연습판 지우기','clear-ink')}<small>손글씨는 모양 연습이며 자동 채점하지 않아요. 아래 철자를 완성해 다음으로 가요.</small></div>`:''}${writing?`<form data-lab-form="phonics"><label for="phonics-answer">${step.kind==='write'?'보고 쓴 낱말의 철자':'뜻을 보고 떠올린 영어 낱말'}</label><input id="phonics-answer" name="answer" lang="en" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="40" value="${e(this.input)}" ${this.loading||this.pending?'disabled':''}><div class="phonics-letters">${letters.map(l=>button(l,'letter',`data-letter="${e(l)}"`,this.loading||!!this.pending)).join('')}${button('⌫','erase','',this.loading||!!this.pending)}</div><button type="submit" class="lab-button lab-primary" ${this.loading||this.pending?'disabled':''}>철자 확인하고 다음 →</button></form>`:`<p class="lab-note">${step.kind==='listen'?'AI가 읽어준 소리와 뜻을 연결해 보세요.':step.kind==='sentence'?'교재 문장에는 아직 연습하지 않은 낱말도 있어요. AI와 함께 듣고 읽어 보세요.':'직접 읽어 본 뒤 표시해요. 읽기·발음의 자동 채점이 아니에요.'}</p>${button(step.kind==='listen'?'듣고 뜻을 확인했어요 →':'읽어 봤어요 →','next','',this.loading||!!this.pending)}`}<div class="lab-actions">${button('다시 연습으로 남기고 다음','review','',this.loading||!!this.pending)}</div>${status}</section>`;
 }
 afterRender():void{
  const canvas=document.querySelector<HTMLCanvasElement>('#phonics-canvas');if(!canvas||!this.active)return;
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const ratio=Math.min(2,globalThis.devicePixelRatio||1);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;const c=canvas.getContext('2d');if(!c)return;
  c.scale(ratio,ratio);c.clearRect(0,0,rect.width,rect.height);c.strokeStyle='#d9d5e4';c.lineWidth=1;
  for(const y of [.28,.52,.78]){c.beginPath();c.moveTo(10,rect.height*y);c.lineTo(rect.width-10,rect.height*y);c.stroke();}
  c.fillStyle='#ded9eb';c.font=`${Math.min(72,(rect.width-30)/Math.max(3,this.step()?.target.length??3))}px sans-serif`;c.textAlign='center';c.fillText(this.step()?.target??'',rect.width/2,rect.height*.75);
  c.strokeStyle='#58429b';c.lineWidth=4;c.lineCap='round';c.lineJoin='round';c.beginPath();for(const p of this.strokes){const x=p.x*rect.width,y=p.y*rect.height;if(p.start)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
 }
 private draw(event:PointerEvent,start:boolean):void{
  if(!this.active||this.loading||this.pending)return;const canvas=document.querySelector<HTMLCanvasElement>('#phonics-canvas');if(!canvas||!(event.target===canvas||!start&&this.pointer===event.pointerId))return;
  if(start){this.pointer=event.pointerId;canvas.setPointerCapture?.(event.pointerId);}else if(this.pointer!==event.pointerId)return;
  if(this.strokes.length>=5000)return;event.preventDefault();const r=canvas.getBoundingClientRect();this.strokes.push({x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height)),start});this.afterRender();
 }
 leave():void{this.generation++;this.active=false;this.operation?.abort();this.operation=null;this.host.speech.stop();this.loading=false;this.loaded=false;this.choosing=false;this.pending=null;this.resetStep();this.key='';}
}
