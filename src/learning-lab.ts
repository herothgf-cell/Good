import {PHONICS_UNITS,getPhonicsUnit} from '../supabase/functions/_shared/phonics-curriculum.ts';
import type {ReaderPort} from './learning-reader.ts';
import {bindWritingPad,type InkStrokes} from './learning-writing.ts';
import type {Snapshot} from './backend.ts';
import type {CoachPort} from './learning-coach.ts';
import type {RealtimePort} from './learning-realtime.ts';
import {learningLabFor,type LearningLabAction} from '../supabase/functions/_shared/learning-lab.ts';
import {LAB_CATALOG,LAB_CONTENT_VERSION,buildLabLesson,validateLabSettings,normalizeLabAnswer,normalizeSpelling,evaluateLabAnswers,type LabLesson,type LabLessonId,type LabSettings,type LabStep,type LabAnswer,type LabHelp} from '../supabase/functions/_shared/learning-lab-content.ts';
import {labEscape as e,renderLabVisual} from './learning-lab-visuals.ts';
export interface LearningLabHost {snapshot:()=>Snapshot|null;perform:(action:LearningLabAction)=>Promise<boolean>;render:()=>void;toast:(message:string)=>void;coach:CoachPort;realtime?:RealtimePort;reader?:ReaderPort;}
interface Session {ink:InkStrokes;identity:string;lesson:LabLesson;settings:LabSettings;version:number;seed:number;runId:string;index:number;answers:LabAnswer[];attempts:number;help:LabHelp;input:string;feedback:string;revealed:boolean;hint:boolean;plays:number;pending:LabAnswer|null;paused:boolean;finished:boolean;saving:boolean;saved:boolean;stale:boolean;}
const identity=(s:Snapshot)=>JSON.stringify([s.familyId,s.me.id,s.me.role]);
const ranks:Record<LabHelp,number>={none:0,replay:1,hint:2,model:3};
const btn=(label:string,action:string,extra='',tone='secondary',disabled=false)=>`<button type="button" class="lab-button lab-${tone}" data-lab-action="${e(action)}" ${extra}${disabled?' disabled':''}>${e(label)}</button>`;
const resultName=(v:string)=>v==='independent'?'스스로':v==='supported'?'도움받아':'다시 연습';
/** Guardian-only transient runner. It never persists transcripts, audio, or unfinished answers. */
export class LearningLabController {
 private session:Session|null=null;
 private actor='';
 private draft:LabSettings|null=null;
 private draftVersion=0;
 private draftDirty=false;
 private draftStale=false;
 private settingsBusy=false;
 private coachText='';
 private chatScroll=0;private chatPinned=true;
 private readonly onChatScroll=(event:Event)=>{const el=event.target;if(el instanceof HTMLElement&&el.matches('.lab-chat')){this.chatScroll=el.scrollTop;this.chatPinned=el.scrollHeight-el.clientHeight-el.scrollTop<60;}};
 private legacyCoachOpen=false;
 private evidence:'guardian'|'self'='guardian';
 private attached=false;
 private readonly onInput=(event:Event)=>{
  const el=event.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement))return;
  if(!el.closest('.lab-page'))return;
  const form=el.closest('form');
  if(form?.dataset.labForm==='answer'&&this.session)this.session.input=el.value.slice(0,this.step()?.kind==='spelling'?24:16);
  if(form?.dataset.labForm==='coach')this.coachText=el.value.slice(0,500);
  if(form?.dataset.labForm==='settings'&&this.draft){const values=new FormData(form);this.draft=this.readSettings(values);this.draftDirty=true;}
  if(el.name==='lab-evidence'&&(el.value==='self'||el.value==='guardian'))this.evidence=el.value;
 };
 private readonly onVisibility=()=>{if(typeof document!=='undefined'&&document.hidden){this.stopAll();if(this.session&&!this.session.finished)this.session.paused=true;this.host.render();}};
 constructor(private readonly host:LearningLabHost){}
 private attach():void{if(this.attached||typeof document==='undefined')return;document.addEventListener('scroll',this.onChatScroll,true);document.addEventListener('input',this.onInput);document.addEventListener('change',this.onInput);document.addEventListener('visibilitychange',this.onVisibility);this.attached=true;}
 private stopSpeech():void{this.host.reader?.stop();this.host.coach.stopAudio?.();}
 private stopAll():void{this.stopSpeech();this.host.reader?.leave();this.host.coach.leave();this.host.realtime?.leave();}
 leave():void{this.stopAll();this.session=null;this.legacyCoachOpen=false;this.actor='';this.draft=null;this.draftDirty=false;this.draftStale=false;this.coachText='';this.chatScroll=0;this.chatPinned=true;this.evidence='guardian';if(this.attached&&typeof document!=='undefined'){document.removeEventListener('scroll',this.onChatScroll,true);document.removeEventListener('input',this.onInput);document.removeEventListener('change',this.onInput);document.removeEventListener('visibilitychange',this.onVisibility);}this.attached=false;}
 reconcile(snapshot:Snapshot):boolean{
  this.host.realtime?.reconcile();const key=identity(snapshot);let changed=false;
  if(this.actor&&this.actor!==key){this.leave();changed=true;}
  if(snapshot.me.role!=='admin'){if(this.session||this.draft){this.leave();changed=true;}return changed;}
  this.actor=key;const lab=learningLabFor(snapshot.state);
  if(!this.draft){this.draft=validateLabSettings(lab.settings);this.draftVersion=lab.settingsVersion;}
  else if(lab.settingsVersion!==this.draftVersion){if(this.draftDirty){this.draftStale=true;}else{this.draft=validateLabSettings(lab.settings);this.draftVersion=lab.settingsVersion;}changed=true;}
  const s=this.session;
  if(s){
   const run=lab.previews.find(r=>r.id===s.runId&&r.actorId===snapshot.me.id&&r.lessonId===s.lesson.id&&r.contentVersion===LAB_CONTENT_VERSION&&r.settingsVersion===s.version&&r.seed===s.seed);
   if(run&&!s.saved){s.saved=true;changed=true;}
   if(s.version!==lab.settingsVersion&&!s.saved&&!s.stale){s.stale=true;this.stopAll();changed=true;}
  }
  return changed;
 }
 render(snapshot:Snapshot):string{
  this.reconcile(snapshot);if(snapshot.me.role!=='admin')return '';this.attach();
  return `<div class="lab-page">${this.session?this.renderSession(this.session):this.renderHome(snapshot)}</div>`;
 }
 private start(snapshot:Snapshot,id:string):void{
  if(snapshot.me.role!=='admin'||!LAB_CATALOG.some(l=>l.id===id))return;
  this.stopAll();const lab=learningLabFor(snapshot.state),settings=validateLabSettings(lab.settings);
  const unit=getPhonicsUnit(settings.phonicsUnit??'01')!;const last=[...lab.previews].reverse().find(r=>r.lessonId==='english-phonics'&&r.contentVersion===LAB_CONTENT_VERSION&&r.settings.phonicsUnit===settings.phonicsUnit);
  const seed=id==='english-phonics'?(last&&last.seed+2<unit.words.length?last.seed+2:0):crypto.getRandomValues(new Uint32Array(1))[0]!%2147483648;this.coachText='';this.chatScroll=0;this.chatPinned=true;this.legacyCoachOpen=false;this.evidence='guardian';
  this.session={ink:[],identity:identity(snapshot),lesson:buildLabLesson(id as LabLessonId,settings,seed),settings,version:lab.settingsVersion,seed,runId:crypto.randomUUID(),index:0,answers:[],attempts:0,help:'none',input:'',feedback:'',revealed:false,hint:false,plays:0,pending:null,paused:false,finished:false,saving:false,saved:false,stale:false};this.attach();
 }
 private step():LabStep|undefined{const s=this.session;return s&&!s.paused&&!s.finished&&!s.stale?s.lesson.steps[s.index]:undefined;}
 private help(value:LabHelp):void{const s=this.session;if(s&&ranks[value]>ranks[s.help])s.help=value;}
 private observe(observation:string):void{
  const s=this.session,q=this.step();if(!s||!q||s.pending||!['independent','supported','retry'].includes(observation))return;
  if(q.kind!=='practice'&&observation!=='retry')return;
  if(q.kind!=='practice'&&s.help!=='hint'&&s.help!=='model')return;
  const outcome=observation==='independent'&&(s.help!=='none'||(q.kind==='practice'&&q.mode==='model'))?'supported':observation as 'independent'|'supported'|'retry';
  s.attempts=Math.max(1,s.attempts);s.pending={stepId:q.id,attempts:s.attempts,help:s.help,observation:outcome,evidence:this.evidence};s.feedback=`${this.evidence==='guardian'?'보호자':'본인'} 관찰: ${resultName(outcome)}로 기록해요. 자동 발음·읽기 평가가 아니에요.`;this.stopSpeech();
 }
 private answer(value:string):void{
  const s=this.session,q=this.step();if(!s||!q||q.kind==='practice'||s.pending)return;
  s.attempts=Math.min(30,s.attempts+1);s.input=value;
  const normalized=q.kind==='number'?normalizeLabAnswer(value,q.format):q.kind==='spelling'?normalizeSpelling(value):value;
  if(normalized===q.answer){s.pending={stepId:q.id,value:normalized,attempts:s.attempts,help:s.help};s.feedback=`맞았어요. ${q.explanation}`;this.stopSpeech();}
  else s.feedback='아직 맞지 않았어요. 천천히 다시 입력하거나 힌트·함께 보기를 선택해요.';
 }
 private async speak():Promise<void>{
  const s=this.session,q=this.step();if(!s||!q||s.pending||!q.readingKey)return;
  this.host.realtime?.leave();this.host.coach.stopAudio?.();
  if(q.kind!=='practice'||q.mode!=='model')this.help('model');else if(s.plays>0)this.help('replay');s.plays++;
  await this.host.reader?.read(s.settings.phonicsUnit??'01',q.readingKey);
 }
 afterRender():void{
  if(typeof document==='undefined')return;const s=this.session,q=this.step();const canvas=document.querySelector<HTMLCanvasElement>('[data-writing-pad]');
  const chat=document.querySelector<HTMLElement>('.lab-chat');if(chat)chat.scrollTop=this.chatPinned?chat.scrollHeight:this.chatScroll;
  if(s&&q?.kind==='spelling'&&canvas)bindWritingPad(canvas,q.mode==='copy'||s.revealed?q.target:'',s.ink);
 }
 async handleClick(source:HTMLElement):Promise<void>{
  const snapshot=this.host.snapshot();if(!snapshot)return;this.reconcile(snapshot);if(snapshot.me.role!=='admin')return;
  const action=source.dataset.labAction,s=this.session;
  if(s?.saving||this.settingsBusy)return;
  if(action==='start'){this.start(snapshot,source.dataset.lessonId??'');if(this.session?.lesson.id==='english-phonics')await this.speak();}
  else if(action==='back'){this.leave();this.reconcile(snapshot);}
  else if(action==='restart'&&s){this.start(snapshot,s.lesson.id);if(s.lesson.id==='english-phonics')await this.speak();}
  else if(action==='phonics-continue'&&s?.finished&&s.saved){this.start(snapshot,'english-phonics');await this.speak();}
  else if(action==='phonics-next-unit'&&s?.finished&&s.saved){const lab=learningLabFor(snapshot.state),at=PHONICS_UNITS.findIndex(u=>u.id===(s.settings.phonicsUnit??'01')),next=PHONICS_UNITS[at+1];if(next&&next.origin==='source'&&await this.host.perform({type:'learning-lab/save-settings',settings:{...validateLabSettings(lab.settings),phonicsUnit:next.id},version:lab.settingsVersion})){const fresh=this.host.snapshot();if(fresh&&this.session===s&&identity(fresh)===s.identity&&fresh.me.role==='admin'){this.start(fresh,'english-phonics');await this.speak();}}}
  else if(action==='reset-settings'){const lab=learningLabFor(snapshot.state);this.draft=validateLabSettings(lab.settings);this.draftVersion=lab.settingsVersion;this.draftDirty=false;this.draftStale=false;}
  else if(action==='pause'&&s&&!s.finished){this.stopAll();s.paused=!s.paused;}
  else if(action==='retry-save'&&s?.finished&&!s.saved)await this.save(s);
  else if(this.step()&&s){
   const q=this.step()!;
   if(action==='hint'&&!s.pending){this.help('hint');s.hint=true;}
   else if(action==='model'&&!s.pending){this.help('model');s.revealed=true;}
   else if(action==='listen')await this.speak();
   else if(action==='reader-replay')await this.host.reader?.replay();
   else if(action==='reader-stop')this.host.reader?.stop();
   else if(action==='ink-clear'){s.ink=[];}
   else if(action==='letter'&&q.kind==='spelling'&&!s.pending){const letter=source.dataset.letter??'';if(/^[a-z]$/.test(letter))s.input=(s.input+letter).slice(0,24);else if(letter==='back')s.input=s.input.slice(0,-1);else if(letter==='clear')s.input='';}
   else if(action==='observe')this.observe(source.dataset.observation??'');
   else if(action==='review')this.observe('retry');
   else if(action==='choice'&&q.kind==='choice'&&q.options.some(o=>o.id===source.dataset.optionId))this.answer(source.dataset.optionId!);
   else if(action==='digit'&&q.kind==='number'&&!s.pending){const digit=source.dataset.digit??'';if(/^[0-9:-]$/.test(digit))s.input=(s.input+digit).slice(0,16);else if(digit==='back')s.input=s.input.slice(0,-1);else if(digit==='clear')s.input='';}
   else if(action==='next'&&s.pending){
    this.stopSpeech();s.answers.push({...s.pending});
    if(s.index+1===s.lesson.steps.length){this.stopAll();s.finished=true;await this.save(s);}
    else{s.ink=[];s.index++;s.attempts=0;s.help='none';s.input='';s.feedback='';s.revealed=false;s.hint=false;s.plays=0;s.pending=null;const next=this.step();if(next?.kind==='practice'&&next.mode==='model'&&s.lesson.id==='english-phonics')await this.speak();}
   }
   else if(s.lesson.id==='english-conversation'){
    try{
     if(action==='realtime-start'){this.stopSpeech();this.host.coach.leave();this.legacyCoachOpen=false;await this.host.realtime?.start(s.settings.topic);}
     else if(action==='realtime-check')await this.host.realtime?.check();
     else if(action==='realtime-stop')this.host.realtime?.stop();
     else if(action==='realtime-audio')await this.host.realtime?.enableAudio();
     else if(action==='realtime-captions')this.host.realtime?.toggleCaptions();
     else if(action==='realtime-marin'||action==='realtime-cedar')this.host.realtime?.setVoice(action==='realtime-marin'?'marin':'cedar');
     else if(action==='legacy-coach-toggle'){this.host.realtime?.leave();this.legacyCoachOpen=!this.legacyCoachOpen;}
     else if(action==='coach-check'){this.host.realtime?.leave();await this.host.coach.check();}
     else if(action==='coach-record'){this.host.realtime?.leave();this.stopSpeech();if(this.host.coach.view().available===true)await this.host.coach.startRecording(s.settings.topic);}
     else if(action==='coach-stop')await this.host.coach.finishRecording();
     else if(action==='coach-replay')await this.host.coach.replay?.(source.dataset.messageId??'');
     else if(action==='coach-audio-stop')this.host.coach.stopAudio?.();
     else if(action==='coach-leave'){this.host.coach.leave();this.chatScroll=0;this.chatPinned=true;}
    }catch{this.host.toast('AI 연결을 마치지 못했어요. 연결 상태를 확인해 주세요.');}
   }
  }
  this.host.render();
  if(['start','next','restart'].includes(action??'')&&typeof document!=='undefined'){
   const heading=document.querySelector<HTMLElement>('.voice-panel h1, .lab-question h1, .lab-summary h1');
   if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest'});}
  }
 }
 async handleSubmit(form:HTMLFormElement):Promise<void>{
  const snapshot=this.host.snapshot();if(!snapshot)return;this.reconcile(snapshot);if(snapshot.me.role!=='admin')return;
  const data=new FormData(form),kind=form.dataset.labForm;
  if(kind==='answer'&&['number','spelling'].includes(this.step()?.kind??'')){this.answer(String(data.get('answer')??''));}
  else if(kind==='settings'&&!this.settingsBusy){
   if(this.draftStale){this.host.toast('다른 기기에서 설정이 바뀌었어요. 최신 설정 불러오기를 눌러 주세요.');return;}
   this.draft=this.readSettings(data);this.draftDirty=true;const settings={...this.draft},version=this.draftVersion;this.settingsBusy=true;this.host.render();
   try{if(await this.host.perform({type:'learning-lab/save-settings',settings,version})){const current=this.host.snapshot();if(current&&identity(current)===identity(snapshot)){const lab=learningLabFor(current.state);this.draft=validateLabSettings(lab.settings);this.draftVersion=lab.settingsVersion;this.draftDirty=false;this.draftStale=false;this.host.toast('다음 테스트에 사용할 설정을 저장했어요.');}}}catch{this.host.toast('설정을 저장하지 못했어요. 입력한 설정을 유지했어요.');}finally{this.settingsBusy=false;}
  }else if(kind==='coach'&&this.step()&&this.session?.lesson.id==='english-conversation'){
   const s=this.session,text=String(data.get('message')??'').trim().slice(0,500);if(!text)return;
   this.coachText='';this.chatPinned=true;this.stopSpeech();try{this.host.realtime?.leave();await this.host.coach.sendText(text,s.settings.topic);if(this.session===s)this.coachText='';}catch{this.host.toast('메시지를 보내지 못했어요. 연결 상태를 확인해 주세요.');}
  }
  this.host.render();
 }
 private readSettings(data:FormData):LabSettings{
  return validateLabSettings({...this.draft,...Object.fromEntries([...data.entries()].map(([key,value])=>[key,['moneyUnit','clockLevel','calendarLevel','groupSize','patternLevel'].includes(key)?Number(value):value]))});
 }
 private async save(s:Session):Promise<void>{
  if(s.saving||s.saved||!s.finished||s.stale)return;const snapshot=this.host.snapshot();if(!snapshot)return;this.reconcile(snapshot);if(this.session!==s||s.stale)return;
  s.saving=true;this.host.render();try{const ok=await this.host.perform({type:'learning-lab/complete-preview',runId:s.runId,lessonId:s.lesson.id,contentVersion:LAB_CONTENT_VERSION,settingsVersion:s.version,settings:{...s.settings},seed:s.seed,answers:s.answers.map(a=>({...a}))});if(this.session===s)s.saved=ok||s.saved;}catch{if(this.session===s)this.host.toast('기록을 저장하지 못했어요. 같은 기록 다시 저장을 눌러 주세요.');}finally{if(this.session===s)s.saving=false;}
 }
 private renderHome(snapshot:Snapshot):string{
  const lab=learningLabFor(snapshot.state);
  return `<header class="lab-heading"><div><span class="lab-eyebrow">LEARNING STUDIO · V2</span><h1>학습 테스트</h1><p>알고 있는 것에서, 새로운 상황으로 한 걸음.</p></div><span class="lab-badge">보호자 전용 · 아이 미공개</span></header><section class="lab-hero"><span aria-hidden="true">🌱</span><div><h2>정답보다, 어떻게 생각했는지</h2><p>영어는 한 대화 화면과 순서대로 배우는 파닉스로, 수학은 직접 답하며 표현을 연결해요. 활동마다 목표와 단계가 달라요.</p><small>보호자 테스트 기록 · 별 0개 · 아이의 완료 기록과 별도로 보관</small></div></section>${(['english','math'] as const).map(subject=>`<section class="lab-section"><div class="lab-section-heading"><h2>${subject==='english'?'영어 · 듣고, 떠올리고, 말하기':'수학 · 계산을 생활 속 생각으로'}</h2><span>${subject==='english'?'2가지 활동':'6가지 활동'}</span></div><div class="lab-catalog">${LAB_CATALOG.filter(l=>l.subject===subject&&!['english-words','english-reading'].includes(l.id)).map(l=>`<article class="lab-card lab-card-${subject}"><div class="lab-card-icon" aria-hidden="true">${e(l.icon)}</div><h3>${e(l.title)}</h3><p>${e(l.description)}</p><div class="lab-card-goal">목표 · ${e(l.goal)}</div>${btn('테스트 시작 →','start',`data-lesson-id="${e(l.id)}"`,'primary')}<small>${lab.previews.some(r=>r.lessonId===l.id&&r.contentVersion===LAB_CONTENT_VERSION)?'✓ 보호자 테스트 기록 있음':'새로운 활동 미리 해보기'}</small></article>`).join('')}</div></section>`).join('')}${this.renderSettings()}<section class="lab-panel"><div class="lab-section-heading"><h2>영역별 테스트 관찰</h2><span>자동 진단이 아닌 활동 기록</span></div>${Object.keys(lab.previewProgress).length?`<div class="lab-progress-grid">${Object.values(lab.previewProgress).map(p=>`<article><strong>${e(this.skillLabel(p.skillId))}</strong><p>스스로 ${p.independent} · 도움 ${p.supported} · 다시 연습 ${p.review}</p><small>관찰 ${p.observed}회 · 최근 ${e(resultName(p.lastOutcome))}</small></article>`).join('')}</div>`:'<p class="lab-muted">활동을 마치면 영역별로 스스로 한 시도와 도움받은 시도를 모아 보여 드려요.</p>'}</section><section class="lab-panel"><div class="lab-section-heading"><h2>최근 보호자 테스트</h2><span>최근 ${lab.previews.length}개 · 별 0개</span></div>${lab.previews.length?`<div class="lab-history">${[...lab.previews].reverse().map(r=>`<article><div><h3>${e(LAB_CATALOG.find(l=>l.id===r.lessonId)?.title??r.lessonId)}</h3><p>${e(r.actorName)} · ${e(this.date(r.completedAt))}</p></div><div><strong>스스로 ${r.independent} · 도움 ${r.supported} · 다시 ${r.review}</strong><small>관찰 ${r.observed} · 설정 v${r.settingsVersion} · ${r.total}단계</small></div></article>`).join('')}</div>`:'<p class="lab-muted">위에서 활동을 선택해 끝까지 해 보세요. 실패한 저장은 같은 기록으로 다시 시도할 수 있어요.</p>'}</section><footer class="lab-footer"><p>기존에 공개한 학습과 보상 기록은 이전 메뉴에서 관리해요.</p><button class="lab-button lab-quiet" data-action="learning-legacy">이전 학습 관리·기록 열기 →</button></footer>`;
 }
 private skillLabel(id:string):string{
  const parts=id.split('.'),last=parts.at(-1)??'';
  const labels:Record<string,string>={model:'뜻·소리 시범',recall:'낱말 떠올리기',reuse:'새 상황에서 쓰기',decode:'스스로 읽기',transfer:'새 낱말·상황에 적용',connected:'짧은 글 읽기',meaning:'뜻 확인',money:'돈으로 나타내기',groups:'묶음으로 나타내기',symbolic:'식으로 나타내기',fresh:'새 문제에 적용',equal:'같은 수 묶기',addition:'덧셈으로 연결',multiply:'곱셈으로 연결','within-hour':'한 시간 안의 관계','across-hour':'시간을 넘는 관계',start:'시작 시각',duration:'걸린 시간','within-month':'같은 달 날짜','across-month':'달을 넘는 날짜',constant:'일정한 간격',alternating:'번갈아 규칙'};
  if(id.startsWith('english.phonics.'))return `파닉스 ${getPhonicsUnit(parts[2]??'')?.title??parts[2]} · ${{listen:'듣기',read:'읽기',copy:'따라 쓰기',spell:'철자 떠올리기',recall:'낱말 떠올리기',sentence:'문장 읽기',meaning:'뜻 확인'}[last]??last}`;
  if(id.startsWith('english.conversation.'))return `영어 대화 · ${{play:'함께 놀기',shop:'가게 놀이',build:'만들기'}[last]??'시나리오'}`;
  if(id.startsWith('english.'))return `${parts[1]==='reading'?'영어 읽기':'영어 낱말'} · ${parts[2]==='ai-ay'?'ai / ay':parts[2]==='silent-e'?'silent e':'CVC'} · ${labels[last]??'연습'}`;
  if(id.startsWith('math.addition.'))return `두 자리 덧셈 · ${last==='regroup'?'받아올림':'받아올림 없이'}`;
  if(id.startsWith('math.subtraction.'))return `두 자리 뺄셈 · ${last==='regroup'?'받아내림':'받아내림 없이'}`;
  const area:Record<string,string>={transfer:'표현 연결',clock:'시간',calendar:'날짜',groups:`${parts[2]}개씩 묶기`,patterns:'수 규칙'};
  return `${area[parts[1]??'']??'학습'} · ${labels[last]??'연습'}`;
 }
 private date(value:string):string{const d=new Date(value);return Number.isNaN(d.getTime())?'날짜 확인 필요':new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(d);}
 private select(name:keyof LabSettings,label:string,options:[string|number,string][]):string{return `<label>${e(label)}<select name="${name}">${options.map(([value,text])=>`<option value="${e(value)}" ${this.draft?.[name]===value?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;}
 private renderSettings():string{
  const calculation:[string,string][]=[['no-regroup','받아올림·내림 없이'],['regroup','받아올림·내림 포함'],['mixed','두 유형 섞어서']];
  return `<section class="lab-panel"><div class="lab-section-heading"><h2>영역별 다음 활동 설정</h2><span>저장한 설정 v${this.draftVersion}</span></div><p class="lab-muted">잘하는 영역은 유지하고, 필요한 기술만 조절해요. 설정 저장 후 시작하는 활동에 적용돼요.</p>${this.draftStale?`<div class="lab-alert" role="status">다른 기기에서 설정이 바뀌었어요. 입력은 보관했어요. 최신 설정을 불러온 뒤 다시 조절해 주세요.${btn('최신 설정 불러오기','reset-settings')}</div>`:''}<form data-lab-form="settings"><fieldset><legend>영어</legend><div class="lab-settings-grid">${this.select('topic','대화 장면',[['play','함께 놀기'],['shop','가게 놀이'],['build','만들기']])}${this.select('conversationSupport','대화 도움',[['guided','문장·단어 도움 넉넉히'],['light','필요할 때만 도움']])}${this.select('phonicsUnit','파닉스 시작 단원',PHONICS_UNITS.map(u=>[u.id,`${u.number?String(u.number).padStart(2,'0')+' · ':''}${u.title}`]))}</div></fieldset><p class="lab-note">아는 단원은 건너뛰어 선택할 수 있어요. ai / ay는 교재 단원이 아닌 앱 보충 자료예요.</p><fieldset><legend>수학</legend><div class="lab-settings-grid">${this.select('addition','두 자리 덧셈',calculation)}${this.select('subtraction','두 자리 뺄셈',calculation)}${this.select('moneyUnit','돈 표현 단위',[[100,'100원 동전'],[1000,'1,000원 지폐'],[10000,'10,000원 지폐']])}${this.select('clockLevel','시간 관계',[[1,'같은 시간 안에서'],[2,'한 시간을 넘어서'],[3,'시작 시각·걸린 시간']])}${this.select('calendarLevel','날짜 관계',[[1,'같은 달 안에서'],[2,'달을 넘어서']])}${this.select('groupSize','같은 수 묶기',[[2,'2개씩 묶기'],[3,'3개씩 묶기']])}${this.select('patternLevel','수 규칙',[[1,'일정한 간격'],[2,'두 규칙 번갈아']])}</div></fieldset><div class="lab-actions"><button class="lab-button lab-primary" type="submit" ${this.settingsBusy||this.draftStale?'disabled':''}>${this.settingsBusy?'저장하고 있어요…':'다음 활동 설정 저장'}</button>${btn('저장된 설정 불러오기','reset-settings','','quiet')}</div><p class="lab-note">아이 공개 기능은 이번 버전에 포함되지 않아요.</p></form></section>`;
 }
 private renderSession(s:Session,legacy=false):string{
  const lesson=s.lesson,total=lesson.steps.length;
  if(s.finished)return this.renderSummary(s);
  if(lesson.id==='english-conversation'&&!s.paused&&!s.stale)return `<div class="lab-runner"><div class="lab-runner-top">${btn('← 활동 목록','back','','quiet')}<span class="lab-badge">보호자 테스트 · 아이 미공개</span>${btn('잠깐 쉬기','pause','','quiet')}</div>${this.renderCoach()}</div>`;
  const q=lesson.steps[s.index]!;
  return `<div class="lab-runner"><div class="lab-runner-top">${btn('← 활동 목록','back','','quiet')}<span class="lab-badge">보호자 테스트 · 별 0개</span>${btn(s.paused?'계속하기':'잠깐 쉬기','pause','','quiet')}</div><div class="lab-goal"><span>${e(lesson.icon)} ${e(lesson.title)}</span><p>${e(lesson.goal)}</p>${lesson.id==='english-phonics'?this.sourceLabel(s):''}</div><div class="lab-progress-caption"><span>${s.index+1} / ${total}단계</span><span>${e(q.title)}</span></div><div class="lab-progress" role="progressbar" aria-label="활동 진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.index+1}"><span style="width:${(s.index+1)/total*100}%"></span></div>${s.stale?`<section class="lab-question lab-paused"><h1>설정이 바뀌었어요</h1><p>활동을 시작한 뒤 다른 기기에서 설정을 저장했어요. 새 설정으로 다시 시작해 주세요. 저장한 테스트 기록은 그대로 보관돼요.</p>${btn('새 설정으로 다시 시작','restart','','primary')}</section>`:s.paused?`<section class="lab-question lab-paused"><span aria-hidden="true">☁️</span><h1>잠깐 쉬어 가요</h1><p>소리와 AI 연결을 멈췄어요. 준비되면 이어서 해요.</p>${btn('계속하기','pause','','primary')}</section>`:`${lesson.id==='english-conversation'?this.renderCoach():''}<section class="lab-question" ${q.kind==='practice'?`data-practice-mode="${q.mode}"`:''} aria-labelledby="lab-question-title"><span class="lab-eyebrow">${q.kind==='practice'&&q.mode==='conversation'?'시나리오 미리보기 · 고정 검수 콘텐츠':q.context==='changed'?'새로운 상황에 써 보기':q.context==='symbolic'?'기호와 생각 연결하기':'함께 생각하는 한 단계'}</span><h1 id="lab-question-title">${e(q.prompt)}</h1>${q.kind==='practice'?this.renderPractice(q,s):q.visual?this.renderStepVisual(q,s):''}${q.kind==='spelling'?this.renderSpelling(q,s):q.kind==='number'?this.renderNumber(q,s):q.kind==='choice'?`<div class="lab-choices">${q.options.map(o=>btn(o.label,'choice',`data-option-id="${e(o.id)}"`,'choice',!!s.pending)).join('')}</div>`:''}${s.hint?`<p class="lab-hint">💡 ${e(q.hint)}</p>`:''}${s.revealed&&q.kind!=='practice'?`<div class="lab-model">함께 보는 답 <strong>${e(q.answer)}</strong><p>${e(q.explanation)}</p></div>`:''}<div class="lab-feedback" role="status">${e(s.feedback||'서두르지 않아도 괜찮아요. 필요하면 도움을 선택해요.')}</div>${s.pending?btn(s.index+1===total?'활동 마치고 기록하기':'다음 단계 →','next','','primary'):`<div class="lab-actions">${btn('💡 힌트','hint','','quiet')}${btn(q.kind==='practice'?'글자·모델 함께 보기':'풀이 함께 보기','model','','quiet')}${q.kind!=='practice'&&(s.hint||s.revealed)?btn('다시 연습으로 기록하고 넘어가기','review','','quiet'):''}</div>`}</section>`}</div>`;
 }
 private renderStepVisual(q:LabStep,s:Session):string{
  const v=q.visual;if(!v)return '';
  if(v.kind==='clock'&&!s.revealed&&!s.pending){
   if(q.skillId.endsWith('.start')&&v.endHour!==undefined&&v.endMinute!==undefined)return renderLabVisual({kind:'clock',hour:v.endHour,minute:v.endMinute});
   if(!q.skillId.endsWith('.duration'))return renderLabVisual({kind:'clock',hour:v.hour,minute:v.minute});
  }
  return renderLabVisual(v,false,s.revealed||!!s.pending);
 }
 private renderNumber(q:Extract<LabStep,{kind:'number'}>,s:Session):string{
  const format=q.format==='time'?'시각은 09:30처럼 입력해요.':q.format==='date'?'날짜는 2026-03-02처럼 입력해요.':'숫자를 직접 입력해요.';
  return `<form data-lab-form="answer" class="lab-answer-form"><label for="lab-answer">내가 생각한 답</label><div class="lab-answer-line"><input id="lab-answer" name="answer" inputmode="numeric" autocomplete="off" maxlength="16" value="${e(s.input)}" aria-describedby="lab-answer-format" ${s.pending?'disabled':''}><button type="submit" class="lab-button lab-primary" ${s.pending?'disabled':''}>답 확인</button></div><small id="lab-answer-format">${format} 키보드 Enter로도 확인할 수 있어요.</small><div class="lab-keypad" aria-label="숫자 입력판">${['1','2','3','4','5','6','7','8','9','clear','0','back',...(q.format==='time'?[':']:q.format==='date'?['-']:[])].map(n=>btn(n==='clear'?'지우기':n==='back'?'⌫':n,'digit',`data-digit="${n}"`,'key',!!s.pending)).join('')}</div></form>`;
 }
 private renderPractice(q:Extract<LabStep,{kind:'practice'}>,s:Session):string{
  const hidden=q.mode==='recall'&&!s.revealed,hideLabel=hidden&&q.visual?.kind==='word'&&q.visual.label.toLowerCase().includes(q.target.toLowerCase()),show=q.mode==='model'||q.mode==='read'||q.mode==='transfer-read'||s.revealed;
  return `${q.visual?renderLabVisual(q.visual,hideLabel):''}<p class="lab-cue">${e(q.cue)}</p>${hidden?'<div class="lab-recall">답을 떠올려 말해 보세요. 아직 글자를 보여 주지 않아요.</div>':''}${show?`<div class="lab-model"><p class="lab-target" lang="en">${e(q.target)}</p>${s.revealed?`<p>${e(q.explanation)}</p>`:''}</div>`:''}${q.readingKey?this.renderReader(s):''}${q.helperWords.length?`<p class="lab-note">미리 알려 주는 도움 단어: <span lang="en">${q.helperWords.map(e).join(' · ')}</span></p>`:''}<div class="lab-observation"><label>누구의 관찰인가요?<select name="lab-evidence" ${s.pending?'disabled':''}><option value="guardian" ${this.evidence==='guardian'?'selected':''}>보호자 관찰</option><option value="self" ${this.evidence==='self'?'selected':''}>본인 관찰</option></select></label><p>말하거나 읽어 본 뒤 직접 표시해요. 자동 발음·읽기 채점은 하지 않아요.</p><div class="lab-observe-buttons">${btn(q.mode==='read'||q.mode==='transfer-read'?'스스로 읽었어요':'스스로 말했어요','observe','data-observation="independent"','secondary',!!s.pending)}${btn('도움받았어요','observe','data-observation="supported"','secondary',!!s.pending)}${btn('다시 연습','observe','data-observation="retry"','quiet',!!s.pending)}</div></div>`;
 }
 private sourceLabel(s:Session):string{
  const unit=getPhonicsUnit(s.settings.phonicsUnit??'01')!;
  return `<p class="phonics-source">${unit.number?`${unit.number}단원 · `:''}${e(unit.title)} · 단어 ${s.seed+1}–${Math.min(s.seed+2,unit.words.length)} / ${unit.words.length}<br>${unit.origin==='source'?`참고: 15분 파닉스 · 교재 ${unit.printedPages.join('–')}쪽 / PDF ${unit.pdfPages.join('–')}쪽`:'앱에서 추가한 보충 자료 · PDF의 독립 단원이 아니에요.'}</p><div class="phonics-flow" aria-label="학습 순서">듣기 → 읽기 → 쓰기 → 떠올리기 → 문장 → 복습</div>`;
 }
 private renderReader(s:Session):string{
  const reader=this.host.reader?.view();return `<div class="lab-listen">${btn('🔊 AI 소리 듣기','listen','','secondary',!!s.pending||reader?.phase==='loading')}${reader?.canReplay?btn(reader.phase==='blocked'?'▶ 소리 재생':'↻ 같은 음성 다시 듣기','reader-replay','','secondary',!!s.pending):''}${reader?.phase==='playing'?btn('소리 멈추기','reader-stop','','quiet'):''}<small>AI가 생성한 음성이에요. 기기에 영어 음성을 설치할 필요가 없어요.<br>소리를 들은 것과 스스로 읽은 것은 따로 기록해요.</small><p role="status">${e(reader?.message??'')}</p></div>`;
 }
 private renderSpelling(q:Extract<LabStep,{kind:'spelling'}>,s:Session):string{
  const copy=q.mode==='copy';return `<section class="phonics-writing"><span class="lab-badge">${copy?'보고 따라 쓰기 · 도움 학습':'안 보고 철자 떠올리기'}</span>${copy||s.revealed?`<p class="lab-target" lang="en">${e(q.target)}</p>`:''}<form data-lab-form="answer" class="lab-answer-form"><label for="lab-answer">영어 철자 쓰기</label><div class="lab-answer-line"><input id="lab-answer" name="answer" lang="en" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="24" value="${e(s.input)}" ${s.pending?'disabled':''}><button class="lab-button lab-primary" type="submit" ${s.pending?'disabled':''}>철자 확인</button></div></form><div class="phonics-letters" aria-label="영어 글자 입력판">${[...new Set(q.letters)].map(letter=>btn(letter,'letter',`data-letter="${e(letter)}"`,'key',!!s.pending)).join('')}${btn('⌫','letter','data-letter="back"','quiet',!!s.pending)}${btn('모두 지우기','letter','data-letter="clear"','quiet',!!s.pending)}</div>${this.renderReader(s)}<div class="phonics-ink"><h3>손가락으로 써 보기</h3><canvas data-writing-pad width="640" height="180" aria-label="손글씨 연습판"></canvas>${btn('연습판 지우기','ink-clear','','quiet')}<small>이 연습판은 저장·전송하지 않아요. 손글씨 자동 채점은 하지 않고, 위에서 입력한 철자만 확인해요.</small></div></section>`;
 }
 private renderCoach():string{
  const c=this.host.coach.view(),busy=['checking','recording','sending','speaking'].includes(c.phase),recording=c.phase==='recording';
  const phase={idle:'연결 전',checking:'연결 확인 중',ready:'대화할 준비가 됐어요',recording:'듣고 있어요',sending:'답변을 준비하고 있어요',speaking:'AI가 말하고 있어요','audio-blocked':'소리 재생을 눌러 주세요',error:'연결을 확인해 주세요'}[c.phase];
  const messages=c.messages.map(m=>`<article class="lab-chat-${m.role==='assistant'?'assistant':'user'}" data-message-role="${m.role}" data-message-status="${m.status??'complete'}"><strong class="chat-author">${m.role==='assistant'?'AI 선생님':'나'}</strong>${m.modelPhrase?`<p class="chat-model" lang="en">${e(m.modelPhrase)}</p>`:''}<p class="chat-text" ${m.role==='assistant'?'lang="en"':''}>${e(m.text)}</p>${m.hint?`<small class="chat-hint">${e(m.hint)}</small>`:''}${m.status==='sending'?'<small class="chat-delivery">보내는 중…</small>':m.status==='failed'?'<small class="chat-delivery">전송 실패 · 자동으로 다시 보내지 않았어요</small>':''}${m.role==='assistant'&&m.hasAudio&&m.id?btn(c.phase==='audio-blocked'?'▶ 소리 재생':'🔊 이 답변 다시 듣기','coach-replay',`data-message-id="${e(m.id)}"`,'secondary',['checking','recording','sending'].includes(c.phase)):''}</article>`).join('');
  return `<section class="lab-coach conversation-screen" aria-labelledby="lab-coach-title"><header class="chat-header"><div><h1 id="lab-coach-title">AI 영어 회화</h1><p>같은 대화에서 글도 보고, 목소리도 들어요.</p></div><span class="lab-badge">보호자 테스트</span></header><div class="chat-toolbar">${btn('AI 연결 상태 확인','coach-check','','secondary',busy)}${btn('음성만 멈추기','coach-audio-stop','','quiet')}${btn('새 대화','coach-leave','','quiet')}</div><div class="lab-coach-status" role="status"><strong>${e(phase)}</strong><small>${e(c.message)}</small></div><div class="lab-chat" role="log" aria-live="polite" aria-relevant="additions text" aria-label="글과 음성이 함께 있는 AI 대화">${messages||'<div class="chat-welcome"><span aria-hidden="true">💬</span><p>하고 싶은 말을 글이나 목소리로 전해 보세요.</p><small>AI는 왼쪽, 내 말은 오른쪽에 쌓여요.</small></div>'}${c.phase==='sending'?'<div class="chat-thinking" role="status">AI 선생님이 답하고 있어요 <span aria-hidden="true">···</span></div>':''}</div><form data-lab-form="coach" class="lab-coach-form chat-composer"><label for="lab-coach-message">글로 말하기</label><textarea id="lab-coach-message" name="message" maxlength="500" rows="2" placeholder="I want to play soccer." ${busy?'disabled':''}>${e(this.coachText)}</textarea><div class="chat-compose-actions">${btn(recording?'녹음 마치고 보내기':'🎙 마이크로 말하기',recording?'coach-stop':'coach-record','','secondary',recording?false:c.available!==true||busy)}<button type="submit" class="lab-button lab-primary" ${busy||c.available!==true?'disabled':''}>보내기 ↑</button></div></form><small class="chat-privacy">AI가 생성한 목소리예요. 대화와 음성은 이 화면의 메모리에만 남고, 다시 듣기는 같은 음성을 재생해요.</small></section>`;
 }
 private renderSummary(s:Session):string{
  const result=evaluateLabAnswers(s.lesson,s.answers);
  const unit=s.lesson.id==='english-phonics'?getPhonicsUnit(s.settings.phonicsUnit??'01'):undefined;
  const continuation=unit&&s.saved?(s.seed+2<unit.words.length?btn('다음 두 단어 배우기 →','phonics-continue','','primary'):unit.origin==='source'&&unit.number<22?btn('다음 단원으로 →','phonics-next-unit','','primary'):btn('이 단원 다시 연습','phonics-continue','','primary')):'';
  return `<section class="lab-summary lab-panel"><span class="lab-summary-icon" aria-hidden="true">🌱</span><span class="lab-eyebrow">LEARNING IS A PROCESS</span><h1>한 걸음씩 끝까지 해 봤어요</h1><p>${e(s.lesson.title)} · ${result.total}단계</p><div class="lab-summary-counts"><div><strong>${result.independent}</strong><span>스스로</span></div><div><strong>${result.supported}</strong><span>도움받아</span></div><div><strong>${result.review}</strong><span>다시 연습</span></div></div><p class="lab-note">직접 답한 결과와 보호자·본인 관찰 ${result.observed}개를 포함해요.<br>발음·읽기의 자동 진단이 아니에요. 보호자 테스트 · 별 0개</p><div class="lab-save-status" role="status">${s.saved?'<p>테스트 기록을 저장했어요.</p>':s.stale?'<p>설정이 바뀌었어요. 최신 설정으로 다시 테스트해 주세요.</p>':s.saving?'<p>기록을 저장하고 있어요…</p>':'<p>테스트 기록을 아직 저장하지 못했어요. 입력한 결과는 이 화면에 보관했어요.</p>'}</div><div class="lab-actions">${!s.saved&&!s.saving&&!s.stale?btn('같은 기록 다시 저장','retry-save','','primary'):''}${s.stale?btn('새 설정으로 다시 시작','restart','','primary'):''}${continuation}${btn('테스트 목록으로','back','','secondary',s.saving)}</div></section>`;
 }
}
