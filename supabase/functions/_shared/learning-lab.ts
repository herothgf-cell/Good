import {DomainError,dayKey,type State,type Context,type Result} from './domain.ts';
import {LAB_CONTENT_VERSION,LAB_CATALOG,DEFAULT_LAB_SETTINGS,validateLabSettings,buildLabLesson,evaluateLabAnswers,normalizeLabAnswer,normalizeSpelling,
  type LabLessonId,type LabSettings,type LabAnswer,type LabEvaluation,type LabSkillResult,type LabLesson} from './learning-lab-content.ts';

export interface LabRun extends LabEvaluation {
  id:string;lessonId:LabLessonId;contentVersion:string;settingsVersion:number;settings:LabSettings;seed:number;
  actorId:string;actorName:string;completedAt:string;day:string;mode:'preview';stars:0;
  /** Exact comparison key of bounded quiz metadata; never audio, chat or practice text. */
  completionKey?:string;
}
export interface LabProgress extends LabSkillResult {lastSeen:string;lastOutcome:'independent'|'supported'|'review'|'practiced';}
export interface LabVoiceUsage {day:string;turns:number;sessions:Record<string,{actorId:string;turns:number;startedAt:string}>;}
export interface LearningLabState {settings:LabSettings;settingsVersion:number;previews:LabRun[];previewProgress:Record<string,LabProgress>;voiceUsage?:LabVoiceUsage;speechUsage?:{day:string;requests:number};}
export type LearningLabAction =
  | {type:'learning-lab/save-settings';settings:LabSettings;version:number}
  | {type:'learning-lab/complete-preview';runId:string;lessonId:LabLessonId;contentVersion:string;settingsVersion:number;settings:LabSettings;seed:number;answers:LabAnswer[]}
  | {type:'learning-lab/reserve-reading';turnId:string}
  | {type:'learning-lab/reserve-coach-turn';sessionId:string;turnId:string};

/** No implicit state migration or publication; callers receive an isolated snapshot. */
export function learningLabFor(state:State):LearningLabState {
  return structuredClone(state.learningLab??{settings:DEFAULT_LAB_SETTINGS,settingsVersion:0,previews:[],previewProgress:{}});
}
function fail(code:string,message:string):never {throw new DomainError(code,message);}
function integer(value:unknown,min:number,max:number):asserts value is number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)fail('INVALID_INPUT','학습 요청의 숫자 범위를 확인해 주세요.');
}
function uuid(value:unknown):asserts value is string {
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    fail('INVALID_INPUT','학습 요청 번호를 확인해 주세요.');
}
function settingsFor(value:unknown):LabSettings {
  try{return validateLabSettings(value);}
  catch{fail('INVALID_INPUT','학습 설정의 항목과 범위를 확인해 주세요.');}
}
function settingsKey(settings:LabSettings):string {
  return JSON.stringify(Object.keys(DEFAULT_LAB_SETTINGS).sort().map(key=>[key,validateLabSettings(settings)[key as keyof LabSettings]]));
}
function savedResult(run:LabRun):Result {return {message:'보호자 학습 테스트를 저장했어요. 별은 지급하지 않아요.',learningRunId:run.id};}

/** Build only constrained response tuples. Validation happens before an idempotent return.
 * This is a canonical comparison string, not a hash. Practice values never enter storage.
 */
function completionKey(action:Extract<LearningLabAction,{type:'learning-lab/complete-preview'}>,settings:LabSettings,lesson:LabLesson,actorId:string):string {
  if(!Array.isArray(action.answers)||action.answers.length!==lesson.steps.length)fail('INVALID_INPUT','활동의 모든 답을 확인해 주세요.');
  const seen=new Set<string>();
  const tuples=action.answers.map(answer=>{
    if(!answer||typeof answer!=='object'||Array.isArray(answer)||Object.keys(answer).some(key=>!['stepId','value','attempts','help','observation','evidence','practiced'].includes(key)))
      fail('INVALID_INPUT','학습 답의 항목을 확인해 주세요.');
    if(typeof answer.stepId!=='string'||seen.has(answer.stepId))fail('INVALID_INPUT','학습 단계가 중복되었어요.');
    seen.add(answer.stepId);
    const step=lesson.steps.find(step=>step.id===answer.stepId);
    if(!step)fail('INVALID_INPUT','학습 단계를 확인해 주세요.');
    integer(answer.attempts,1,30);
    if(!['none','replay','hint','model'].includes(answer.help))fail('INVALID_INPUT','도움 기록을 확인해 주세요.');
    if(answer.observation!==undefined&&!['independent','supported','retry'].includes(answer.observation))fail('INVALID_INPUT','관찰 기록을 확인해 주세요.');
    if(answer.evidence!==undefined&&!['self','guardian'].includes(answer.evidence))fail('INVALID_INPUT','관찰 주체를 확인해 주세요.');
    if(Object.prototype.hasOwnProperty.call(answer,'practiced')&&answer.practiced!==true)fail('INVALID_INPUT','연습 완료 표시를 확인해 주세요.');
    let value:string|null=null;
    if(answer.practiced===true){
      if(step.kind!=='practice'||Object.prototype.hasOwnProperty.call(answer,'value')||answer.observation!==undefined||answer.evidence!==undefined)fail('INVALID_INPUT','연습 완료는 정답이나 관찰로 기록하지 않아요.');
    }else if(step.kind==='practice'){
      if(Object.prototype.hasOwnProperty.call(answer,'value')||!answer.observation||!answer.evidence)fail('INVALID_INPUT','말하기·읽기는 보호자 또는 자기 관찰로 기록해 주세요.');
    }else if(!Object.prototype.hasOwnProperty.call(answer,'value')){
      if(answer.observation!=='retry'||!answer.evidence||!['hint','model'].includes(answer.help))
        fail('INVALID_INPUT','답 없이 마치려면 도움 후 다시 연습으로 기록해 주세요.');
    }else{
      if(typeof answer.value!=='string'||answer.value.length>64)fail('INVALID_INPUT','학습 답의 길이를 확인해 주세요.');
      if(step.kind==='choice'){
        if(!step.options.some(option=>option.id===answer.value))fail('INVALID_INPUT','보기에서 답을 선택해 주세요.');
        value=answer.value;
      }else{
        // Only recognized bounded number/time/date syntax can enter a comparison key.
        // The normalizer accepts reviewed unit spellings, never general prose.
        try{value=step.kind==='spelling'?normalizeSpelling(answer.value):normalizeLabAnswer(answer.value,step.format);}catch{fail('INVALID_INPUT','학습 답의 형식을 확인해 주세요.');}
        if(!value)fail('INVALID_INPUT','숫자·시각·날짜 형식으로 입력해 주세요.');
      }
    }
    const tuple=[answer.stepId,value,answer.attempts,answer.help,answer.observation??null,answer.evidence??null];
    return answer.practiced===true?[...tuple,'practiced']:tuple;
  }).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const key=JSON.stringify([actorId,action.lessonId,action.contentVersion,action.settingsVersion,settingsKey(settings),action.seed,tuples]);
  if(key.length>6000)fail('INVALID_INPUT','학습 기록의 크기를 확인해 주세요.');
  return key;
}
function aggregate(learning:LearningLabState,evaluation:LabEvaluation,now:string):void {
  const progress=learning.previewProgress;
  for(const skill of evaluation.skills){
    // Skill IDs are server content IDs, never supplied by the client.
    if(!/^[a-z][a-z0-9.-]{0,79}$/.test(skill.skillId))fail('INVALID_INPUT','학습 기술 정보를 확인해 주세요.');
    const previous=Object.prototype.hasOwnProperty.call(progress,skill.skillId)?progress[skill.skillId]:undefined;
    if(!previous&&Object.keys(progress).length>=400)fail('LIMIT','학습 진도 항목 한도에 도달했어요.');
    const totals={skillId:skill.skillId,independent:skill.independent+(previous?.independent??0),supported:skill.supported+(previous?.supported??0),
      review:skill.review+(previous?.review??0),observed:skill.observed+(previous?.observed??0)};
    const practiced=(skill.practiced??0)+(previous?.practiced??0);
    if([practiced,totals.independent,totals.supported,totals.review,totals.observed].some(value=>!Number.isSafeInteger(value)||value<0))fail('LIMIT','학습 진도 집계 한도에 도달했어요.');
    progress[skill.skillId]={...totals,...(practiced?{practiced}:{}),lastSeen:now,lastOutcome:skill.review>0?'review':skill.supported>0?'supported':skill.independent>0?'independent':'practiced'};
  }
}

/** Mutates only the state clone supplied by applyAction; every action is guardian-only. */
export function applyLearningLabAction(state:State,action:LearningLabAction,ctx:Context):Result {
  if(ctx.actor?.role!=='admin')fail('FORBIDDEN','이 작업을 할 권한이 없어요. 보호자에게 요청해 주세요.');
  const fields=action.type==='learning-lab/save-settings'?['type','settings','version']:
    action.type==='learning-lab/complete-preview'?['type','runId','lessonId','contentVersion','settingsVersion','settings','seed','answers']:
    action.type==='learning-lab/reserve-reading'?['type','turnId']:['type','sessionId','turnId'];
  if(Object.keys(action).some(key=>!fields.includes(key)))fail('INVALID_INPUT','학습 요청의 항목을 확인해 주세요.');
  const learning=learningLabFor(state),day=dayKey(ctx.now);
  switch(action.type){
    case 'learning-lab/save-settings': {
      integer(action.version,0,Number.MAX_SAFE_INTEGER);
      const settings=settingsFor(action.settings);
      if(action.version!==learning.settingsVersion)fail('QUOTE_CHANGED','다른 기기에서 학습 설정을 바꿨어요. 최신 설정을 확인해 주세요.');
      if(learning.settingsVersion>=Number.MAX_SAFE_INTEGER)fail('LIMIT','학습 설정 버전 한도에 도달했어요.');
      learning.settings=settings;learning.settingsVersion++;
      state.learningLab=learning;
      return {message:'보호자 테스트 설정을 저장했어요.'};
    }
    case 'learning-lab/complete-preview': {
      uuid(action.runId);integer(action.settingsVersion,0,Number.MAX_SAFE_INTEGER);integer(action.seed,0,2147483647);
      const settings=settingsFor(action.settings);
      if(typeof action.lessonId!=='string'||!LAB_CATALOG.some(lesson=>lesson.id===action.lessonId))fail('INVALID_INPUT','학습 활동을 확인해 주세요.');
      if(typeof action.contentVersion!=='string'||action.contentVersion.length>80)fail('INVALID_INPUT','학습 내용 버전을 확인해 주세요.');
      let lesson:LabLesson;
      try{lesson=buildLabLesson(action.lessonId,settings,action.seed);}catch{fail('INVALID_INPUT','학습 활동 설정을 확인해 주세요.');}
      const key=completionKey(action,settings,lesson,ctx.actor.id);
      let evaluation:LabEvaluation;
      try{evaluation=evaluateLabAnswers(lesson,action.answers);}catch{fail('INVALID_INPUT','활동 답과 관찰 기록을 확인해 주세요.');}
      const existing=learning.previews.find(run=>run.id===action.runId);
      if(existing){
        if(existing.actorId!==ctx.actor.id||existing.completionKey!==key)fail('IDEMPOTENCY','같은 학습 기록 번호로 다른 결과를 보낼 수 없어요.');
        return savedResult(existing);
      }
      if(action.contentVersion!==LAB_CONTENT_VERSION)fail('LEARNING_CONTENT_CHANGED','학습 내용이 업데이트됐어요. 새로고침 후 다시 시작해 주세요.');
      if(action.settingsVersion!==learning.settingsVersion||settingsKey(settings)!==settingsKey(learning.settings))
        fail('QUOTE_CHANGED','학습 설정이 바뀌었어요. 최신 설정으로 다시 시작해 주세요.');
      const run:LabRun={...evaluation,id:action.runId,lessonId:action.lessonId,contentVersion:LAB_CONTENT_VERSION,settingsVersion:action.settingsVersion,
        settings,seed:action.seed,actorId:ctx.actor.id,actorName:ctx.actor.name,completedAt:ctx.now,day,mode:'preview',stars:0,completionKey:key};
      aggregate(learning,evaluation,ctx.now);
      learning.previews=[...learning.previews,run].slice(-40);
      state.learningLab=learning;
      return savedResult(run);
    }
    case 'learning-lab/reserve-reading': {
      uuid(action.turnId);const previous=learning.speechUsage;const requests=previous?.day===day?previous.requests:0;
      if(!Number.isSafeInteger(requests)||requests<0||requests>=120)fail('DAILY_LIMIT','오늘 AI 읽어주기 120회를 모두 사용했어요. 이미 들은 음성은 같은 화면에서 다시 들을 수 있어요.');
      learning.speechUsage={day,requests:requests+1};state.learningLab=learning;return {message:'AI 읽어주기 1회를 예약했어요.',coachReservationId:ctx.newId()};
    }
    case 'learning-lab/reserve-coach-turn': {
      uuid(action.sessionId);uuid(action.turnId);
      // Persistent command receipts keyed by turnId provide reservation idempotency.
      // Do not retry a paid request under a new ID after a timeout.
      const previous=learning.voiceUsage;
      const usage:LabVoiceUsage={day,turns:previous?.day===day?previous.turns:0,sessions:{}};
      // Carry active sessions across Korean midnight: daily budget resets, but owner,
      // original start and lifetime session count do not. Same-day expired IDs remain
      // tombstones until the next day; prior-day expired sessions may be discarded.
      for(const [id,record] of Object.entries(previous?.sessions??{})){
        const age=new Date(ctx.now).getTime()-new Date(record.startedAt).getTime();
        if(dayKey(record.startedAt)===day||(Number.isFinite(age)&&age>=0&&age<15*60*1000))usage.sessions[id]=record;
      }
      const session=Object.prototype.hasOwnProperty.call(usage.sessions,action.sessionId)?usage.sessions[action.sessionId]:undefined;
      if(session){
        if(session.actorId!==ctx.actor.id)fail('FORBIDDEN','다른 보호자의 AI 테스트 세션이에요. 새 세션을 시작해 주세요.');
        const age=new Date(ctx.now).getTime()-new Date(session.startedAt).getTime();
        if(!Number.isFinite(age)||age<0||age>=15*60*1000)fail('SESSION_EXPIRED','AI 테스트 세션 시간이 끝났어요. 새 세션을 시작해 주세요.');
        if(session.turns>=12)fail('SESSION_LIMIT','한 세션의 AI 테스트 12회를 모두 사용했어요.');
      }
      if(usage.turns>=40)fail('DAILY_LIMIT','오늘 가족의 AI 테스트 40회를 모두 사용했어요.');
      if(!session&&Object.keys(usage.sessions).length>=80)fail('DAILY_LIMIT','오늘 가족의 AI 테스트 세션 한도에 도달했어요.');
      usage.sessions[action.sessionId]=session?{...session,turns:session.turns+1}:{actorId:ctx.actor.id,turns:1,startedAt:ctx.now};
      usage.turns++;learning.voiceUsage=usage;state.learningLab=learning;
      return {message:'보호자 AI 연결 테스트 1회를 예약했어요.',coachReservationId:ctx.newId()};
    }
  }
}
