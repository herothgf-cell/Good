# Learning feature implementation contract

## Content module (`supabase/functions/_shared/learning-content.ts`)
Export `LEARNING_CONTENT_VERSION = '2026-10-31.1'`, `LearningSubject = 'english' | 'math'`.

```ts
export type LearningHelp = 'none' | 'replay' | 'hint' | 'model';
export interface LearningOption { id:string; label:string; icon?:string; color?:string }
export type LearningVisual =
  | {kind:'ten-frame'; filled:number}
  | {kind:'base-ten'; hundreds:number; tens:number; ones:number}
  | {kind:'objects'; icon:string; left:number; right:number; operation:'add'|'subtract'};
export interface LearningQuestion {
  id:string; prompt:string; speech?:string; options:LearningOption[]; answerId:string;
  hint:string; explanation:string; practicePhrase?:string; visual?:LearningVisual;
}
export interface LearningLesson {
  id:string; subject:LearningSubject; title:string; description:string; icon:string;
  goal:string; questions:LearningQuestion[];
}
export interface LearningAnswer {questionId:string; optionId:string; attempts:number; help:LearningHelp}
export interface LearningEvaluation {total:number; independent:number; supported:number; firstTry:number}
export const LEARNING_LESSONS: readonly LearningLesson[];
export function getLearningLesson(id:string):LearningLesson|undefined;
export function evaluateLearningAnswers(lessonId:string,answers:unknown):LearningEvaluation;
```

Six IDs: `english-colors`, `english-animals`, `english-requests`, `math-ten`, `math-place`, `math-stories`. Exactly five reviewed questions each, 2–3 distinct options. English target is in `speech`; Korean `prompt` explains the action without revealing the target. English option labels are Korean with icons/color. Optional practice is never scored. Math uses exact numbers and matching structured visuals. Evaluator requires all five question IDs exactly once with final correct options, attempts integer 1..20, valid help; invalid input throws Error. `independent` requires attempts=1 and help='none', `supported=total-independent`, `firstTry` counts attempts=1 regardless of help. The evaluator does not evaluate speech or emit awards.

## State/rules module (`supabase/functions/_shared/learning.ts`)
```ts
export interface LearningSettings {lessonIds:string[]; dailyLimit:number; starsPerSession:number}
export interface LearningRun extends LearningEvaluation {
 id:string; lessonId:string; contentVersion:string; mode:'preview'|'child';
 actorId:string; actorName:string; completedAt:string; day:string;
 publicationVersion:number|null; stars:number; praiseId?:string;
}
export interface LearningPublication {version:number; settings:LearningSettings; contentVersion:string; publishedAt:string; publishedBy:string}
export interface LearningState {draft:LearningSettings; draftVersion:number; publication:LearningPublication|null; publicationSequence:number; previews:LearningRun[]; runs:LearningRun[]}
export type LearningAction =
 | {type:'learning/save-draft';settings:LearningSettings;version:number}
 | {type:'learning/complete-preview';lessonId:string;runId:string;contentVersion:string;answers:LearningAnswer[]}
 | {type:'learning/publish';draftVersion:number;publicationSequence:number;contentVersion:string}
 | {type:'learning/unpublish';publicationVersion:number}
 | {type:'learning/complete';lessonId:string;runId:string;publicationVersion:number;contentVersion:string;answers:LearningAnswer[]}
 | {type:'learning/praise';runId:string};
export function learningFor(state:State):LearningState;
export function isLearningPublished(state:State):boolean;
```

`State.learning?:LearningState`; `Action` includes LearningAction; `Praise.learningRunId?:string`; `Result.learningRunId?:string` optional. The root integrator owns these changes. Default draft selects first English+math lesson, dailyLimit=2 (allowed1..4), starsPerSession=1 (allowed0..3), version0, no publication. All actions are admin-only except learning/complete (child-only). Summary `stars` captures published settings; previews always 0. Repeated run IDs return existing summary only if the same mode/lesson/evaluation; conflicting reuse is rejected. A different device cannot count a duplicate completion twice. `publicationSequence` advances on both publication and withdrawal; publishing must match the captured sequence as well as the draft version. Publication confirmation invalidates when either changes, preventing an older confirmation from undoing another guardian's withdrawal.

## Browser module (`src/learning.ts`)
The UI worker owns the complete standalone learning screen/controller and its scoped styles, NOT existing main/ui/experience files. Import the content and state interfaces above.

```ts
export interface LearningHost {
  snapshot:()=>Snapshot|null;
  perform:(action:LearningAction)=>Promise<boolean>;
  render:()=>void;
  toast:(message:string)=>void;
}
export class LearningController {
  constructor(host:LearningHost);
  render(snapshot:Snapshot):string;
  handleClick(source:HTMLElement):Promise<void>;
  handleSubmit(form:HTMLFormElement):Promise<void>;
  leave():void;
  reconcile(snapshot:Snapshot):boolean;
}
```

Learning buttons use `data-learning-action` (root delegates before ordinary data-action). Forms use `data-learning-form`. Lesson start buttons additionally use `data-lesson-id`; answer buttons use `data-option-id`. Root passes the controller's HTML as `View.learningHtml?:string` for the new `Screen='learning'`; root handles role navigation. Root calls leave on navigation out, role/account/mode changes and initialize; calls reconcile on snapshot refresh. reconcile resets unauthorized or stale-release sessions and returns true if rendering needs to be refreshed. It must preserve ordinary active sessions during same-release polls. All own click/submit events trigger host.render after state transitions. host.perform resolves false on errors (existing pending request banner remains authoritative); do not claim completion or publication on false.

Admin view: heading `학습 테스트`, clear 미공개/공개 status; catalog six lesson cards and preview buttons; form selecting 1..6 lesson IDs, dailyLimit, starsPerSession; saved draft version used on save. Separate explicit confirmation step before publish and withdraw. Publish button unavailable until selected lesson previews exist for current content version. Parent preview completion shows actual zero reward, summary and optional result save retry; child completion says 보호자 확인 대기 or 학습 완료 (stars=0), never claims automatic grant. Admin results list child runs and explicit `learning/praise` buttons only for unrewarded runs with stars>0. Never offer praise for previews.

Runner: five steps, Korean action directions, large 2–3 choices, feedback, hint and model-answer path, retry choices, no speed scoring. On a final correct answer, record help/attempts and enable next; after fifth, save one completed run with stable UUID. Do not record abandoned sessions. Child draft data is never used. English speech triggers from user click using SpeechSynthesis when available; offer text help and optional practice. Stop speech on leaving, hidden document, role change, pause or newer speech. Prevent late speech callbacks after navigation from mutating the next screen. Do not access microphones or external APIs. Text hint must be recorded as help rather than independent listening. Math visual renderer uses scoped CSS/SVG with exact counts. Do not add global styles or change current app CSS.
