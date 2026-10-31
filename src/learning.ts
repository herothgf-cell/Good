import type {Snapshot} from './backend.ts';
import {learningFor,type LearningAction,type LearningRun,type LearningSettings} from '../supabase/functions/_shared/learning.ts';
import {LEARNING_CONTENT_VERSION,LEARNING_LESSONS,getLearningLesson,evaluateLearningAnswers,type LearningAnswer,type LearningHelp,type LearningLesson,type LearningQuestion,type LearningVisual} from '../supabase/functions/_shared/learning-content.ts';

export interface LearningHost {
  snapshot:()=>Snapshot|null;
  perform:(action:LearningAction)=>Promise<boolean>;
  render:()=>void;
  toast:(message:string)=>void;
}
interface Session {
  identity:string;lessonId:string;mode:'preview'|'child';publicationVersion:number|null;stars:number;
  runId:string;index:number;answers:LearningAnswer[];attempts:number;help:LearningHelp;
  correct:boolean;feedback:string;textVisible:boolean;modelVisible:boolean;plays:number;
  paused:boolean;finished:boolean;saving:boolean;saved:boolean;saveFailed:boolean;
}
type Confirmation={kind:'publish';version:number;publicationSequence:number}|{kind:'unpublish';version:number};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const identity=(s:Snapshot)=>`${s.familyId}:${s.me.id}:${s.me.role}`;
const button=(label:string,action:string,extra='',tone='secondary',disabled=false)=>`<button type="button" class="learning-button learning-${tone}" data-learning-action="${action}" ${extra}${disabled?' disabled':''}>${label}</button>`;
const koreanDay=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Seoul'}).format(new Date());
const date=(value:string)=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));
const helpLevel:Record<LearningHelp,number>={none:0,replay:1,hint:2,model:3};

/** A short-lived runner. Only completed summaries cross the host boundary. */
export class LearningController {
  private session:Session|null=null;
  private confirmation:Confirmation|null=null;
  private confirmationIdentity='';
  private actionBusy=false;
  private visibilityAttached=false;
  private readonly onVisibility=()=>{
    if(typeof document!=='undefined'&&document.hidden){
      this.stopSpeech();
      if(this.session&&!this.session.finished){this.session.paused=true;this.host.render();}
    }
  };
  constructor(private readonly host:LearningHost){}

  leave():void {
    this.stopSpeech();this.session=null;this.confirmation=null;this.confirmationIdentity='';
    if(this.visibilityAttached&&typeof document!=='undefined')document.removeEventListener('visibilitychange',this.onVisibility);
    this.visibilityAttached=false;
  }
  reconcile(snapshot:Snapshot):boolean {
    let changed=false;const s=this.session,learning=learningFor(snapshot.state);
    if(s&&(s.identity!==identity(snapshot)||(s.mode==='preview'?snapshot.me.role!=='admin':snapshot.me.role!=='child'||!learning.publication||learning.publication.version!==s.publicationVersion||learning.publication.contentVersion!==LEARNING_CONTENT_VERSION||!learning.publication.settings.lessonIds.includes(s.lessonId)))){
      this.leave();changed=true;
    }
    if(this.confirmation&&(snapshot.me.role!=='admin'||this.confirmationIdentity!==identity(snapshot)||(this.confirmation.kind==='publish'?learning.draftVersion!==this.confirmation.version||learning.publicationSequence!==this.confirmation.publicationSequence:learning.publication?.version!==this.confirmation.version))){this.confirmation=null;changed=true;}
    const active=this.session;
    if(active?.finished&&!active.saved){
      const run=(active.mode==='preview'?learning.previews:learning.runs).find(run=>run.id===active.runId&&run.mode===active.mode&&run.lessonId===active.lessonId&&run.actorId===snapshot.me.id&&run.contentVersion===LEARNING_CONTENT_VERSION&&run.publicationVersion===active.publicationVersion);
      if(run){const expected=evaluateLearningAnswers(active.lessonId,active.answers);if(run.total===expected.total&&run.independent===expected.independent&&run.supported===expected.supported&&run.firstTry===expected.firstTry){active.saved=true;active.saveFailed=false;changed=true;}}
    }
    return changed;
  }
  render(snapshot:Snapshot):string {
    this.reconcile(snapshot);
    if(snapshot.me.role==='giver')return '<section class="learning-empty"><span>🌱</span><h1>학습은 보호자와 함께 준비해요</h1><p>보호자가 공개한 활동은 아이 화면에서 볼 수 있어요.</p></section>';
    if(this.session)return this.renderSession(this.session);
    return snapshot.me.role==='admin'?this.renderAdmin(snapshot):this.renderChild(snapshot);
  }
  async handleClick(source:HTMLElement):Promise<void>{
    const snapshot=this.host.snapshot();if(!snapshot)return;
    this.reconcile(snapshot);
    const action=source.dataset.learningAction;
    if(this.actionBusy||this.session?.saving)return;
    if(action==='start')this.start(snapshot,source.dataset.lessonId??'');
    else if(action==='back'){this.leave();}
    else if(action==='pause'&&this.session){this.stopSpeech();this.session.paused=!this.session.paused;}
    else if(action==='answer')this.answer(source.dataset.optionId??'');
    else if(action==='hint'&&this.activeQuestion()&&!this.session?.correct){const s=this.session!;this.useHelp('hint');s.feedback=this.activeQuestion()!.hint;}
    else if(action==='model'&&this.activeQuestion()&&!this.session?.correct){const s=this.session!;this.useHelp('model');s.modelVisible=true;s.feedback='답을 함께 살펴보고, 직접 골라 보세요.';}
    else if(action==='text-help'&&this.activeQuestion()?.speech&&!this.session?.correct){this.useHelp('hint');this.session!.textVisible=true;}
    else if(action==='listen'&&this.activeQuestion()?.speech&&!this.session?.correct)this.speak(this.activeQuestion()!.speech!);
    else if(action==='practice'&&this.activeQuestion()?.practicePhrase)this.speak(this.activeQuestion()!.practicePhrase!,false);
    else if(action==='next'&&this.session?.correct&&!this.session.paused&&!this.session.finished){
      const s=this.session,q=this.activeQuestion()!;this.stopSpeech();
      s.answers.push({questionId:q.id,optionId:q.answerId,attempts:s.attempts,help:s.help});
      if(s.index===4){s.finished=true;await this.save(s);}
      else{s.index++;s.attempts=0;s.help='none';s.correct=false;s.feedback='';s.textVisible=false;s.modelVisible=false;s.plays=0;}
    }
    else if(action==='retry-save'&&this.session?.finished&&!this.session.saved)await this.save(this.session);
    else if(snapshot.me.role==='admin'){
      const learning=learningFor(snapshot.state);
      if(action==='publish'){
        if(!this.reviewed(snapshot)){this.host.toast('공개할 활동을 먼저 끝까지 미리 해 주세요.');}
        else{this.confirmation={kind:'publish',version:learning.draftVersion,publicationSequence:learning.publicationSequence};this.confirmationIdentity=identity(snapshot);}
      }else if(action==='unpublish'&&learning.publication){this.confirmation={kind:'unpublish',version:learning.publication.version};this.confirmationIdentity=identity(snapshot);}
      else if(action==='cancel-confirm')this.confirmation=null;
      else if(action==='confirm-publish'&&this.confirmation?.kind==='publish'&&this.reviewed(snapshot)){
        const {version,publicationSequence}=this.confirmation;
        if(await this.perform({type:'learning/publish',draftVersion:version,publicationSequence,contentVersion:LEARNING_CONTENT_VERSION})){this.confirmation=null;this.host.toast('아이에게 학습을 공개했어요.');}
      }else if(action==='confirm-unpublish'&&this.confirmation?.kind==='unpublish'){
        if(await this.perform({type:'learning/unpublish',publicationVersion:this.confirmation.version})){this.confirmation=null;this.host.toast('학습 공개를 중지했어요.');}
      }else if(action==='praise'){
        const run=learning.runs.find(r=>r.id===source.dataset.runId&&r.mode==='child'&&r.stars>0&&!r.praiseId);
        if(run)await this.perform({type:'learning/praise',runId:run.id});
      }
    }
    this.host.render();
  }
  async handleSubmit(form:HTMLFormElement):Promise<void>{
    const snapshot=this.host.snapshot();if(!snapshot||snapshot.me.role!=='admin'||form.dataset.learningForm!=='settings'||this.actionBusy||this.session)return;
    this.reconcile(snapshot);
    const fields=new FormData(form);
    const lessonIds=fields.getAll('lessonIds').map(String);
    const dailyLimit=Number(fields.get('dailyLimit')),starsPerSession=Number(fields.get('starsPerSession'));
    if(!lessonIds.length||lessonIds.length>6||new Set(lessonIds).size!==lessonIds.length||lessonIds.some(id=>!getLearningLesson(id))||!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>4||!Number.isInteger(starsPerSession)||starsPerSession<0||starsPerSession>3){this.host.toast('활동 1개 이상, 하루 1~4회, 별 0~3개를 선택해 주세요.');this.host.render();return;}
    const settings:LearningSettings={lessonIds,dailyLimit,starsPerSession};
    const version=Number(form.dataset.learningVersion);
    if(!Number.isInteger(version)||version<0){this.host.toast('설정 화면을 다시 열어 주세요.');this.host.render();return;}
    if(await this.perform({type:'learning/save-draft',settings,version})){this.confirmation=null;this.host.toast('학습 초안을 저장했어요. 공개는 아래에서 따로 확인해 주세요.');}
    this.host.render();
  }
  private async perform(action:LearningAction):Promise<boolean>{
    this.actionBusy=true;
    try{return await this.host.perform(action);}finally{this.actionBusy=false;}
  }
  private start(snapshot:Snapshot,lessonId:string):void {
    const lesson=getLearningLesson(lessonId),learning=learningFor(snapshot.state),publication=learning.publication;
    if(!lesson||!['admin','child'].includes(snapshot.me.role))return;
    if(snapshot.me.role==='child'){
      if(!publication||publication.contentVersion!==LEARNING_CONTENT_VERSION||!publication.settings.lessonIds.includes(lessonId))return;
      if(learning.runs.filter(r=>r.mode==='child'&&r.day===koreanDay()).length>=publication.settings.dailyLimit){this.host.toast('오늘의 활동을 모두 마쳤어요. 다음에 또 만나요!');return;}
    }
    this.leave();
    this.session={identity:identity(snapshot),lessonId,mode:snapshot.me.role==='admin'?'preview':'child',publicationVersion:snapshot.me.role==='child'?publication!.version:null,stars:snapshot.me.role==='child'?publication!.settings.starsPerSession:0,runId:crypto.randomUUID(),index:0,answers:[],attempts:0,help:'none',correct:false,feedback:'',textVisible:false,modelVisible:false,plays:0,paused:false,finished:false,saving:false,saved:false,saveFailed:false};
    if(typeof document!=='undefined'){document.addEventListener('visibilitychange',this.onVisibility);this.visibilityAttached=true;}
  }
  private activeQuestion():LearningQuestion|undefined {
    const s=this.session;if(!s||s.finished||s.paused)return undefined;
    return getLearningLesson(s.lessonId)?.questions[s.index];
  }
  private useHelp(help:LearningHelp):void {if(this.session&&!this.session.correct&&helpLevel[help]>helpLevel[this.session.help])this.session.help=help;}
  private answer(optionId:string):void {
    const q=this.activeQuestion(),s=this.session;if(!q||!s||s.correct||!q.options.some(o=>o.id===optionId))return;
    s.attempts=Math.min(20,s.attempts+1);
    if(optionId===q.answerId){s.correct=true;s.feedback=`잘 찾았어요! ${q.explanation}`;this.stopSpeech();}
    else{s.feedback='괜찮아요. 그림과 힌트를 살펴보고 다시 골라 보세요.';}
  }
  private speak(text:string,countReplay=true):void {
    const s=this.session;if(!s||s.paused||s.finished)return;
    this.stopSpeech();
    if(typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined'){this.host.toast('이 기기에서는 소리 대신 글자 도움을 보거나 보호자가 읽어 주세요.');return;}
    const englishVoice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith('en-'));
    if(!englishVoice){this.host.toast('기기에 저장된 영어 음성이 없어요. 글자 도움을 보거나 보호자가 읽어 주세요.');return;}
    if(countReplay){if(s.plays>0)this.useHelp('replay');s.plays++;}
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.82;utterance.voice=englishVoice;
    // No completion callbacks: a cancelled utterance cannot change another screen.
    speechSynthesis.speak(utterance);
  }
  private stopSpeech():void {if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}
  private async save(s:Session):Promise<void>{
    if(s.saving||s.saved||!s.finished)return;
    const snapshot=this.host.snapshot();if(!snapshot||this.reconcile(snapshot)||this.session!==s)return;
    s.saving=true;s.saveFailed=false;this.host.render();
    const base={lessonId:s.lessonId,runId:s.runId,contentVersion:LEARNING_CONTENT_VERSION,answers:s.answers.map(a=>({...a}))};
    try{
      const ok=await this.perform(s.mode==='preview'?{type:'learning/complete-preview',...base}:{type:'learning/complete',...base,publicationVersion:s.publicationVersion!});
      if(this.session===s){s.saved=ok||s.saved;s.saveFailed=!s.saved;}
    }finally{if(this.session===s)s.saving=false;}
  }
  private reviewed(snapshot:Snapshot):boolean {
    const learning=learningFor(snapshot.state);
    return learning.draft.lessonIds.length>0&&learning.draft.lessonIds.every(id=>learning.previews.some(run=>run.lessonId===id&&run.contentVersion===LEARNING_CONTENT_VERSION));
  }
  private renderAdmin(snapshot:Snapshot):string {
    const learning=learningFor(snapshot.state),publication=learning.publication,reviewed=this.reviewed(snapshot);
    const tested=(id:string)=>learning.previews.some(r=>r.lessonId===id&&r.contentVersion===LEARNING_CONTENT_VERSION);
    return `<div class="learning-page"><header class="learning-heading"><div><span class="learning-eyebrow">SMALL STEPS, BRIGHT MOMENTS</span><h1>학습 테스트</h1><p>짧게 도전하고, 함께 해보고, 아이에게 공개해요.</p></div><span class="learning-status ${publication?'learning-live':''}">${publication?(publication.contentVersion===LEARNING_CONTENT_VERSION?'아이에게 공개 중':'콘텐츠 업데이트 · 재공개 필요'):'미공개 · 보호자 전용'}</span></header><section class="learning-banner"><span class="learning-banner-icon" aria-hidden="true">🌱</span><div><h2>부담 없이, 다섯 번의 작은 도전</h2><p>먼저 활동을 끝까지 미리 해 보세요. 테스트는 별·아이의 하루 횟수에 영향을 주지 않아요.</p></div><span class="learning-content-tag">검수 콘텐츠 v${escape(LEARNING_CONTENT_VERSION)}</span></section><section class="learning-section"><div class="learning-section-heading"><h2>1. 활동 미리 해보기</h2><span>영어 3개 · 수학 3개</span></div><div class="learning-catalog">${LEARNING_LESSONS.map(lesson=>this.lessonCard(lesson,true,tested(lesson.id))).join('')}</div></section><div class="learning-admin-grid"><section class="learning-panel"><div class="learning-section-heading"><h2>2. 공개할 설정 저장</h2><span>초안 ${learning.draftVersion}</span></div><p class="learning-muted">저장한 초안은 다음 공개 확인 때 적용해요.</p><form data-learning-form="settings" data-learning-version="${learning.draftVersion}"><fieldset class="learning-fieldset"><legend>아이가 볼 활동 (1개 이상)</legend><div class="learning-checks">${LEARNING_LESSONS.map(l=>`<label class="learning-check"><input type="checkbox" name="lessonIds" value="${escape(l.id)}" ${learning.draft.lessonIds.includes(l.id)?'checked':''}><span>${escape(l.icon)} ${escape(l.title)}</span><small>${tested(l.id)?'미리보기 완료':'테스트 필요'}</small></label>`).join('')}</div></fieldset><div class="learning-settings-fields"><label>하루 활동 한도<select name="dailyLimit">${[1,2,3,4].map(n=>`<option value="${n}" ${learning.draft.dailyLimit===n?'selected':''}>${n}회</option>`).join('')}</select></label><label>보호자 확인 후 받을 별<select name="starsPerSession">${[0,1,2,3].map(n=>`<option value="${n}" ${learning.draft.starsPerSession===n?'selected':''}>${n}개</option>`).join('')}</select></label></div><p class="learning-note">가족 기기 모두에서 하루 횟수를 함께 세어요. 학습을 마쳐도 별은 자동 지급되지 않아요.</p><button type="submit" class="learning-button learning-primary">초안 저장하기</button></form></section><section class="learning-panel learning-release"><h2>3. 아이에게 공개</h2>${publication?`<span class="learning-status learning-live">공개 버전 ${publication.version}</span><p>${publication.settings.lessonIds.map(id=>escape(getLearningLesson(id)?.title??id)).join(' · ')}</p><p class="learning-note">하루 ${publication.settings.dailyLimit}회 · 확인 후 별 ${publication.settings.starsPerSession}개</p>`:'<div class="learning-release-symbol" aria-hidden="true">🔒</div><p>아직 아이 화면에는 보이지 않아요.</p>'}<p class="learning-muted">저장한 초안의 모든 활동을 테스트하면 공개할 수 있어요. 공개 설정은 별도로 보관돼요.</p>${button(publication?'저장한 초안으로 다시 공개':'아이에게 공개하기','publish','','primary',!reviewed)}${!reviewed?'<p class="learning-note">선택한 활동의 미리보기를 모두 완료해 주세요.</p>':''}${publication?button('공개 중지하기','unpublish','','quiet'):''}${this.renderConfirmation(learning.draft)}</section></div><section class="learning-panel learning-results"><div class="learning-section-heading"><h2>아이의 완료 기록</h2><span>최근 ${learning.runs.length}개</span></div>${learning.runs.length?[...learning.runs].reverse().map(run=>this.runRow(run,true)).join(''):'<p class="learning-empty-note">아이가 활동을 마치면 이곳에서 노력을 확인하고 칭찬해요.</p>'}</section><section class="learning-panel learning-results"><div class="learning-section-heading"><h2>보호자 테스트 기록</h2><span>테스트 별 0개</span></div>${learning.previews.length?[...learning.previews].reverse().slice(0,6).map(run=>this.runRow(run,false)).join(''):'<p class="learning-empty-note">처음 해볼 활동을 위에서 골라 주세요.</p>'}</section></div>`;
  }
  private renderConfirmation(draft:LearningSettings):string {
    if(!this.confirmation)return '';
    const publish=this.confirmation.kind==='publish';
    return `<div class="learning-confirm" role="group" aria-label="${publish?'아이 공개':'공개 중지'} 확인"><h3>${publish?'이 설정으로 아이에게 공개할까요?':'학습 공개를 중지할까요?'}</h3><p>${publish?`${draft.lessonIds.map(id=>escape(getLearningLesson(id)?.title??id)).join(' · ')}<br>하루 ${draft.dailyLimit}회 · 보호자 확인 후 별 ${draft.starsPerSession}개`:'아이의 진행 중인 활동도 종료돼요. 완료한 기록은 보관해요.'}</p><div class="learning-actions">${button('돌아가기','cancel-confirm')}${button(publish?'확인하고 공개':'확인하고 중지',publish?'confirm-publish':'confirm-unpublish','','primary')}</div></div>`;
  }
  private lessonCard(lesson:LearningLesson,preview:boolean,tested=false,disabled=false):string {
    return `<article class="learning-lesson learning-subject-${lesson.subject}"><div class="learning-card-top"><span class="learning-lesson-icon" aria-hidden="true">${escape(lesson.icon)}</span><span class="learning-subject">${lesson.subject==='english'?'ENGLISH · 듣고 고르기':'MATH · 보고 생각하기'}</span></div><h3>${escape(lesson.title)}</h3><p>${escape(lesson.description)}</p><div class="learning-lesson-meta"><span>5개의 작은 도전</span>${preview?`<span class="${tested?'learning-reviewed':'learning-muted'}">${tested?'✓ 테스트 완료':'미리보기 전'}</span>`:''}</div>${button(preview?'미리 해보기 →':'도전하기 →','start',`data-lesson-id="${escape(lesson.id)}"`,'primary',disabled)}</article>`;
  }
  private renderChild(snapshot:Snapshot):string {
    const learning=learningFor(snapshot.state),publication=learning.publication;
    if(!publication||publication.contentVersion!==LEARNING_CONTENT_VERSION)return '<section class="learning-empty"><span>🌱</span><h1>새로운 활동을 준비하고 있어요</h1><p>보호자가 준비를 마치면 함께 도전해요.</p></section>';
    const completed=learning.runs.filter(r=>r.mode==='child'&&r.day===koreanDay()).length,remaining=Math.max(0,publication.settings.dailyLimit-completed);
    return `<div class="learning-page"><header class="learning-heading"><div><span class="learning-eyebrow">A LITTLE LEARNING ADVENTURE</span><h1>오늘의 작은 도전</h1><p>천천히 해도 좋아요. 잘 안되면 함께 다시 해봐요.</p></div><span class="learning-status">오늘 ${remaining}번 더 할 수 있어요</span></header><section class="learning-banner learning-child-banner"><span class="learning-banner-icon" aria-hidden="true">🌟</span><div><h2>${remaining?'어떤 도전을 해볼까요?':'오늘도 멋지게 도전했어요!'}</h2><p>${remaining?'다섯 번만 골라 보면 끝! 도움이 필요하면 힌트를 눌러요.':'새로운 도전은 내일 다시 만나요.'}</p></div></section><div class="learning-catalog">${publication.settings.lessonIds.map(id=>getLearningLesson(id)).filter((l):l is LearningLesson=>!!l).map(l=>this.lessonCard(l,false,false,!remaining)).join('')}</div><p class="learning-note">${publication.settings.starsPerSession?'활동을 마치면 보호자가 노력을 확인하고 칭찬해 줘요.':'차근차근 도전하는 마음을 응원해요.'}</p></div>`;
  }
  private runRow(run:LearningRun,praise:boolean):string {
    return `<article class="learning-run-row"><span class="learning-run-icon" aria-hidden="true">${escape(getLearningLesson(run.lessonId)?.icon??'🌱')}</span><div class="learning-run-info"><h3>${escape(getLearningLesson(run.lessonId)?.title??run.lessonId)}</h3><p>${escape(run.actorName)} · ${escape(date(run.completedAt))}</p><small>혼자 ${run.independent}개 · 도움받아 ${run.supported}개 · 별 ${run.stars}개</small></div>${praise&&run.mode==='child'&&run.stars>0&&!run.praiseId?button(`확인하고 별 ${run.stars}개 칭찬`,'praise',`data-run-id="${escape(run.id)}"`,'primary'):praise?`<span class="learning-status">${run.praiseId?'칭찬 완료':'학습 완료'}</span>`:'<span class="learning-reviewed">미리보기 완료</span>'}</article>`;
  }
  private renderSession(s:Session):string {
    const lesson=getLearningLesson(s.lessonId)!;
    if(s.finished)return this.renderSummary(s,lesson);
    const q=lesson.questions[s.index]!;
    return `<div class="learning-page learning-runner"><div class="learning-runner-top">${button('← 활동 목록','back','','quiet')}<span class="learning-status">${s.mode==='preview'?'보호자 미리보기 · 별 0개':'나의 작은 도전'}</span>${button(s.paused?'계속하기':'잠깐 쉬기','pause','','quiet')}</div><div class="learning-progress-heading"><span>${escape(lesson.icon)} ${escape(lesson.title)}</span><strong>${s.index+1} / 5</strong></div><div class="learning-progress" role="progressbar" aria-label="활동 진행" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${s.index+1}"><span style="width:${(s.index+1)*20}%"></span></div>${s.paused?`<section class="learning-question learning-paused"><span aria-hidden="true">☁️</span><h1>잠깐 쉬어 가요</h1><p>준비가 되면 천천히 이어 해요.</p>${button('다시 도전하기','pause','','primary')}</section>`:`<section class="learning-question" aria-labelledby="learning-question-title"><span class="learning-eyebrow">${s.index+1}번째 작은 도전</span><h1 id="learning-question-title">${escape(q.prompt)}</h1>${q.speech?`<div class="learning-listen">${button('🔊 영어로 듣기','listen','','listen',s.correct)}<p>소리를 듣고 알맞은 그림을 골라요.</p>${button('소리가 안 들려요 · 글자 도움','text-help','','quiet',s.correct)}${s.textVisible?`<p class="learning-speech-text" lang="en">${escape(q.speech)}</p><p class="learning-note">글자 도움을 사용한 활동으로 기록해요. 보호자가 읽어 줘도 좋아요.</p>`:''}</div>`:''}${q.visual?renderVisual(q.visual):''}<div class="learning-choices" aria-label="답 고르기">${q.options.map(o=>`<button type="button" class="learning-choice ${s.correct&&o.id===q.answerId?'learning-correct':''}" data-learning-action="answer" data-option-id="${escape(o.id)}" ${s.correct?'disabled':''}>${o.icon?`<span class="learning-option-icon" aria-hidden="true">${escape(o.icon)}</span>`:''}${o.color?`<span class="learning-color" style="background-color:${safeColor(o.color)}" aria-hidden="true"></span>`:''}<strong>${escape(o.label)}</strong>${s.correct&&o.id===q.answerId?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}</div><div class="learning-feedback" aria-live="polite">${s.feedback?`<p>${escape(s.feedback)}</p>`:'<p class="learning-muted">서두르지 않아도 괜찮아요.</p>'}${s.modelVisible?`<p class="learning-model">함께 보는 답: <strong>${escape(q.options.find(o=>o.id===q.answerId)!.label)}</strong><br>${escape(q.explanation)}</p>`:''}</div>${s.correct?`<div class="learning-next">${q.practicePhrase?`<div class="learning-practice"><strong>원하면 따라 말해요</strong><p lang="en">${escape(q.practicePhrase)}</p>${button('🔊 문장 듣기','practice','','quiet')}<small>말하기는 선택이에요. 듣거나 말한 소리는 녹음·채점하지 않아요.</small></div>`:''}${button(s.index===4?'다섯 번의 도전 마치기 ✨':'다음 도전 →','next','','primary')}</div>`:`<div class="learning-help">${button('💡 힌트 보기','hint','','quiet')}${button('같이 답 살펴보기','model','','quiet')}</div>`}</section>`}</div>`;
  }
  private renderSummary(s:Session,lesson:LearningLesson):string {
    const evaluation=evaluateLearningAnswers(s.lessonId,s.answers);
    return `<div class="learning-page learning-summary"><section class="learning-summary-card"><span class="learning-summary-icon" aria-hidden="true">🌟</span><span class="learning-eyebrow">FIVE LITTLE STEPS, WELL DONE</span><h1>끝까지 도전했어요!</h1><p>${escape(lesson.title)} · 다섯 번의 작은 노력을 응원해요.</p><div class="learning-summary-counts"><div><strong>${evaluation.independent}</strong><span>혼자 해냈어요</span></div><div><strong>${evaluation.supported}</strong><span>도움받아 해냈어요</span></div></div>${s.mode==='preview'?'<p class="learning-reward-note">보호자 테스트 · 별 0개<br><small>아이의 활동 횟수에는 포함되지 않아요.</small></p>':''}<div class="learning-save-status" role="status">${s.saving?'<p>완료 기록을 저장하고 있어요…</p>':s.saved?`<p>완료 기록을 저장했어요.</p><strong>${s.mode==='preview'?'미리보기 완료':s.stars>0?'보호자 확인 대기':'학습 완료'}</strong>${s.mode==='child'&&s.stars>0?`<p>보호자가 확인한 뒤 별 ${s.stars}개로 칭찬해 줘요.</p>`:''}`:'<p>완료 기록을 아직 저장하지 못했어요.<br>위의 요청 안내를 확인하고 같은 기록을 다시 저장해 주세요.</p>'}</div><div class="learning-summary-actions">${!s.saved&&!s.saving?button('같은 완료 기록 다시 저장','retry-save','','primary'):''}${button(s.mode==='preview'?'테스트 목록으로':'활동 목록으로','back','','secondary',s.saving)}</div></section></div>`;
  }
}
function safeColor(color:string):string {
  return /^(?:#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d\s,.%]+\))$/i.test(color)?escape(color):'currentColor';
}
/** Structured, countable visuals; never inferred from prose or generated imagery. */
function renderVisual(visual:LearningVisual):string {
  if(visual.kind==='ten-frame')return `<div class="learning-visual" role="img" aria-label="열 칸 중 ${visual.filled}칸이 채워져 있어요"><div class="learning-ten-frame">${Array.from({length:10},(_,i)=>`<span class="learning-ten-cell">${i<visual.filled?'<i></i>':''}</span>`).join('')}</div></div>`;
  if(visual.kind==='base-ten')return `<div class="learning-visual learning-base-ten" role="img" aria-label="백 ${visual.hundreds}개, 십 ${visual.tens}개, 일 ${visual.ones}개">${[[visual.hundreds,'hundreds','백'],[visual.tens,'tens','십'],[visual.ones,'ones','일']].map(([count,kind,label])=>`<div class="learning-place-group"><span class="learning-place-label">${label}</span><div class="learning-blocks">${Array.from({length:Number(count)},()=>`<span class="learning-block learning-${kind}">${kind==='ones'?'':Array.from({length:kind==='hundreds'?100:10},()=>'<i></i>').join('')}</span>`).join('')}</div><small>${count}개</small></div>`).join('')}</div>`;
  const objects=(count:number,removed=0)=>Array.from({length:count},(_,i)=>`<span class="learning-object ${i>=count-removed?'learning-removed':''}" aria-hidden="true">${escape(visual.icon)}</span>`).join('');
  return `<div class="learning-visual learning-objects" role="img" aria-label="${visual.left}개 ${visual.operation==='add'?'더하기':'중'} ${visual.right}개${visual.operation==='subtract'?'를 빼요':''}"><div class="learning-object-group">${objects(visual.left,visual.operation==='subtract'?visual.right:0)}</div>${visual.operation==='add'?`<span class="learning-math-sign" aria-hidden="true">＋</span><div class="learning-object-group">${objects(visual.right)}</div>`:''}<p class="learning-equation">${visual.left} ${visual.operation==='add'?'+':'−'} ${visual.right} = ?</p></div>`;
}
