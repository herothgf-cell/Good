import {DomainError,dayKey,type State,type Context,type Result} from './domain.ts';
import {LEARNING_CONTENT_VERSION,LEARNING_LESSONS,getLearningLesson,evaluateLearningAnswers,
  type LearningAnswer,type LearningEvaluation,type LearningLesson} from './learning-content.ts';

export interface LearningSettings {lessonIds:string[];dailyLimit:number;starsPerSession:number}
export interface LearningRun extends LearningEvaluation {
  id:string;lessonId:string;contentVersion:string;mode:'preview'|'child';
  actorId:string;actorName:string;completedAt:string;day:string;
  publicationVersion:number|null;stars:number;praiseId?:string;
}
export interface LearningPublication {version:number;settings:LearningSettings;contentVersion:string;publishedAt:string;publishedBy:string}
export interface LearningState {draft:LearningSettings;draftVersion:number;publication:LearningPublication|null;publicationSequence:number;previews:LearningRun[];runs:LearningRun[]}
export type LearningAction =
  | {type:'learning/save-draft';settings:LearningSettings;version:number}
  | {type:'learning/complete-preview';lessonId:string;runId:string;contentVersion:string;answers:LearningAnswer[]}
  | {type:'learning/publish';draftVersion:number;publicationSequence:number;contentVersion:string}
  | {type:'learning/unpublish';publicationVersion:number}
  | {type:'learning/complete';lessonId:string;runId:string;publicationVersion:number;contentVersion:string;answers:LearningAnswer[]}
  | {type:'learning/praise';runId:string};

/** Legacy families have a draft, never an implicit publication. */
export function learningFor(state:State):LearningState {
  return state.learning??{draft:{lessonIds:['english-colors','math-ten'],dailyLimit:2,starsPerSession:1},
    draftVersion:0,publication:null,publicationSequence:0,previews:[],runs:[]};
}
export function isLearningPublished(state:State):boolean {
  const publication=learningFor(state).publication;
  return !!publication&&publication.contentVersion===LEARNING_CONTENT_VERSION&&publication.settings.lessonIds.length>0;
}
function fail(code:string,message:string):never{throw new DomainError(code,message);}
function integer(value:unknown,min:number,max:number,message:string):asserts value is number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)fail('INVALID_INPUT',message);
}
function runId(value:unknown):asserts value is string {
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    fail('INVALID_INPUT','학습 기록 번호를 확인해 주세요.');
}
function settingsFor(value:unknown):LearningSettings {
  if(!value||typeof value!=='object')fail('INVALID_INPUT','학습 설정을 확인해 주세요.');
  const settings=value as LearningSettings;
  if(!Array.isArray(settings.lessonIds)||settings.lessonIds.length<1||settings.lessonIds.length>LEARNING_LESSONS.length||
    new Set(settings.lessonIds).size!==settings.lessonIds.length||settings.lessonIds.some(id=>typeof id!=='string'||!getLearningLesson(id)))
    fail('INVALID_INPUT','공개할 활동을 1개 이상 골라 주세요.');
  integer(settings.dailyLimit,1,4,'하루 활동은 1~4회로 정해 주세요.');
  integer(settings.starsPerSession,0,3,'학습 칭찬 별은 0~3개로 정해 주세요.');
  return {lessonIds:[...settings.lessonIds],dailyLimit:settings.dailyLimit,starsPerSession:settings.starsPerSession};
}
function currentContent(version:unknown):void {
  if(version!==LEARNING_CONTENT_VERSION)fail('LEARNING_CONTENT_CHANGED','학습 내용이 업데이트됐어요. 새로고침한 뒤 다시 시작해 주세요.');
}
function savedResult(run:LearningRun):Result {
  return {message:run.mode==='preview'?'보호자 테스트를 저장했어요. 실제 별은 지급하지 않았어요.':
    run.stars>0?'학습을 마쳤어요. 보호자가 확인하면 칭찬 별을 보내요.':'오늘의 학습을 마쳤어요.',learningRunId:run.id};
}

/** Mutates only the clone supplied by applyAction; reward writes use its existing ledger path. */
export function applyLearningAction(state:State,action:LearningAction,ctx:Context,
  praise:(run:LearningRun,lesson:LearningLesson)=>string):Result {
  const expectedRole=action.type==='learning/complete'?'child':'admin';
  if(ctx.actor.role!==expectedRole)fail('FORBIDDEN','이 작업을 할 권한이 없어요. 보호자에게 요청해 주세요.');
  const learning=structuredClone(learningFor(state));
  state.learning=learning;
  switch(action.type){
    case 'learning/save-draft': {
      integer(action.version,0,Number.MAX_SAFE_INTEGER,'학습 설정 버전을 확인해 주세요.');
      if(action.version!==learning.draftVersion)fail('QUOTE_CHANGED','다른 기기에서 학습 설정을 바꿨어요. 새로고침 후 확인해 주세요.');
      if(learning.draftVersion>=Number.MAX_SAFE_INTEGER)fail('LIMIT','학습 설정 버전 한도에 도달했어요.');
      learning.draft=settingsFor(action.settings);learning.draftVersion++;
      return {message:'학습 초안을 저장했어요. 아이에게 공개한 내용은 그대로예요.'};
    }
    case 'learning/publish': {
      currentContent(action.contentVersion);
      if(action.publicationSequence!==learning.publicationSequence)fail('QUOTE_CHANGED','다른 보호자가 공개 상태를 바꿨어요. 최신 상태를 확인해 주세요.');
      if(action.draftVersion!==learning.draftVersion)fail('QUOTE_CHANGED','저장된 학습 설정이 바뀌었어요. 최신 초안을 확인해 주세요.');
      const settings=settingsFor(learning.draft);
      if(settings.lessonIds.some(id=>!learning.previews.some(run=>run.lessonId===id&&run.contentVersion===LEARNING_CONTENT_VERSION)))
        fail('LEARNING_UNTESTED','선택한 활동을 보호자 모드에서 끝까지 테스트한 뒤 공개해 주세요.');
      if(learning.publicationSequence>=Number.MAX_SAFE_INTEGER)fail('LIMIT','학습 공개 버전 한도에 도달했어요.');
      learning.publicationSequence++;
      learning.publication={version:learning.publicationSequence,settings,contentVersion:LEARNING_CONTENT_VERSION,publishedAt:ctx.now,publishedBy:ctx.actor.id};
      return {message:'테스트한 학습을 아이 화면에 공개했어요.'};
    }
    case 'learning/unpublish': {
      if(!learning.publication||action.publicationVersion!==learning.publication.version)
        fail('QUOTE_CHANGED','공개 상태가 바뀌었어요. 최신 상태를 확인해 주세요.');
      if(learning.publicationSequence>=Number.MAX_SAFE_INTEGER)fail('LIMIT','학습 공개 버전 한도에 도달했어요.');
      learning.publicationSequence++;
      learning.publication=null;
      return {message:'아이 화면에서 학습을 내렸어요. 보호자 테스트는 계속할 수 있어요.'};
    }
    case 'learning/complete-preview':
    case 'learning/complete': {
      runId(action.runId);currentContent(action.contentVersion);
      const mode=action.type==='learning/complete'?'child':'preview';
      const lesson=getLearningLesson(action.lessonId);
      if(!lesson)fail('INVALID_INPUT','학습 활동을 확인해 주세요.');
      let evaluation:LearningEvaluation;
      try{evaluation=evaluateLearningAnswers(action.lessonId,action.answers);}
      catch(error){fail('INVALID_INPUT',error instanceof Error?error.message:'학습 답을 확인해 주세요.');}
      const publicationVersion=action.type==='learning/complete'?action.publicationVersion:null;
      if(publicationVersion!==null)integer(publicationVersion,0,Number.MAX_SAFE_INTEGER,'공개 버전을 확인해 주세요.');
      const existing=[...learning.previews,...learning.runs].find(run=>run.id===action.runId);
      if(existing){
        if(existing.mode!==mode||existing.lessonId!==lesson.id||existing.contentVersion!==action.contentVersion||existing.publicationVersion!==publicationVersion||
          existing.total!==evaluation.total||existing.independent!==evaluation.independent||existing.supported!==evaluation.supported||existing.firstTry!==evaluation.firstTry)
          fail('IDEMPOTENCY','같은 학습 기록 번호로 다른 결과를 보낼 수 없어요.');
        return savedResult(existing);
      }
      if(state.praises.some(p=>p.learningRunId===action.runId))fail('LEARNING_ALREADY_COMPLETED','이미 완료하고 칭찬한 학습 기록이에요.');
      let stars=0;
      if(action.type==='learning/complete'){
        const publication=learning.publication;
        if(!publication)fail('LEARNING_UNPUBLISHED','보호자가 아직 학습을 공개하지 않았어요.');
        currentContent(publication.contentVersion);
        if(publication.version!==action.publicationVersion)fail('QUOTE_CHANGED','보호자가 학습 내용을 바꿨어요. 최신 활동을 다시 열어 주세요.');
        if(!publication.settings.lessonIds.includes(lesson.id))fail('LEARNING_UNAVAILABLE','현재 공개된 학습 활동을 선택해 주세요.');
        if(learning.runs.filter(run=>run.day===dayKey(ctx.now)).length>=publication.settings.dailyLimit)
          fail('DAILY_LIMIT','오늘 정한 활동을 모두 마쳤어요. 내일 다시 만나요.');
        stars=publication.settings.starsPerSession;
      }
      const run:LearningRun={id:action.runId,lessonId:lesson.id,contentVersion:LEARNING_CONTENT_VERSION,mode,
        actorId:ctx.actor.id,actorName:ctx.actor.name,completedAt:ctx.now,day:dayKey(ctx.now),publicationVersion,stars,...evaluation};
      if(mode==='preview')learning.previews=[...learning.previews,run].slice(-30);
      else learning.runs=[...learning.runs,run].slice(-60);
      return savedResult(run);
    }
    case 'learning/praise': {
      runId(action.runId);
      // Praise remains in the existing permanent ledger even after a run summary is pruned or reversed.
      const previous=state.praises.find(p=>p.learningRunId===action.runId);
      if(previous)return {message:'이미 확인한 학습이에요. 칭찬 별을 다시 지급하지 않았어요.',praiseId:previous.id,learningRunId:action.runId};
      const run=learning.runs.find(run=>run.id===action.runId);
      if(!run)fail('NOT_FOUND','칭찬할 아이 학습 기록을 찾지 못했어요.');
      if(run.stars===0)fail('LEARNING_NO_REWARD','이 활동은 별 없이 완료하는 활동이에요.');
      const lesson=getLearningLesson(run.lessonId);
      if(!lesson)fail('NOT_FOUND','학습 활동을 찾지 못했어요.');
      run.praiseId=praise(run,lesson);
      return {message:`학습을 확인하고 칭찬 별 ${run.stars}개를 보냈어요!`,praiseId:run.praiseId,learningRunId:run.id};
    }
  }
}
