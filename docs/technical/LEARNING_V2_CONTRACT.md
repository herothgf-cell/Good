# Learning v2 implementation interfaces

All workers use these names. Files are isolated by task. Root owns integration, AI endpoint/client and release. No worker edits another worker's files or commits during parallel implementation.

## Content (`supabase/functions/_shared/learning-lab-content.ts`)

```ts
export const LAB_CONTENT_VERSION = '2026-11-01.1';
export type LabLessonId = 'english-conversation'|'english-words'|'english-reading'|'math-calculation'|'math-transfer'|'math-clock'|'math-calendar'|'math-groups'|'math-patterns';
export type LabHelp = 'none'|'replay'|'hint'|'model';
export interface LabSettings {
 topic:'play'|'shop'|'build'; phonics:'ai-ay'|'silent-e'|'cvc'; conversationSupport:'guided'|'light';
 addition:'no-regroup'|'regroup'|'mixed'; subtraction:'no-regroup'|'regroup'|'mixed';
 moneyUnit:100|1000|10000; clockLevel:1|2|3; calendarLevel:1|2; groupSize:2|3; patternLevel:1|2;
}
export const DEFAULT_LAB_SETTINGS: LabSettings;
export function validateLabSettings(value:unknown):LabSettings; // defensive exact bounded values, return clone
export type LabVisual =
 | {kind:'money';unit:number;counts:number[]}
 | {kind:'place-value';values:number[]}
 | {kind:'groups';size:number;groups:number}
 | {kind:'clock';hour:number;minute:number;endHour?:number;endMinute?:number}
 | {kind:'calendar';year:number;month:number;day:number;targetDay?:number;targetMonth?:number}
 | {kind:'bar';parts:(number|null)[];total:number|null;labels:string[]}
 | {kind:'sequence';items:(number|null)[]}
 | {kind:'word';icon:string;label:string};
interface LabBaseStep {id:string;skillId:string;title:string;prompt:string;hint:string;explanation:string;visual?:LabVisual;context:'familiar'|'changed'|'symbolic';}
export interface LabNumberStep extends LabBaseStep {kind:'number';answer:string;format:'integer'|'time'|'date';}
export interface LabChoiceStep extends LabBaseStep {kind:'choice';options:{id:string;label:string}[];answer:string;}
export interface LabPracticeStep extends LabBaseStep {kind:'practice';mode:'model'|'recall'|'read'|'transfer-read'|'conversation';target:string;speech:string;cue:string;helperWords:string[];}
export type LabStep=LabNumberStep|LabChoiceStep|LabPracticeStep;
export interface LabLesson {id:LabLessonId;subject:'english'|'math';title:string;description:string;goal:string;icon:string;steps:LabStep[];}
export const LAB_CATALOG:ReadonlyArray<Omit<LabLesson,'steps'>>;
export function buildLabLesson(id:LabLessonId,settings:LabSettings,seed:number):LabLesson;
export function normalizeLabAnswer(value:string,format:'integer'|'time'|'date'):string;
export interface LabAnswer {stepId:string;value?:string;attempts:number;help:LabHelp;observation?:'independent'|'supported'|'retry';evidence?:'self'|'guardian';}
export interface LabSkillResult {skillId:string;independent:number;supported:number;review:number;observed:number;}
export interface LabEvaluation {total:number;correct:number;independent:number;supported:number;review:number;observed:number;skills:LabSkillResult[];}
export function evaluateLabAnswers(lesson:LabLesson,answers:unknown):LabEvaluation;
```

Defaults: play, ai-ay, guided, mixed addition/subtraction, moneyUnit 1000, clockLevel 1, calendarLevel 1, groupSize 2, patternLevel 1. Seed safe integer 0..2147483647. Lessons use 4..10 steps, stable IDs, reviewed bounded word banks; normal math operands predominantly two digits. Clock values normalized HH:MM, dates YYYY-MM-DD; all integer answers nonnegative. For practice, observation and evidence required; help makes independent into supported. Numeric/choice final correct values count as correct; explicitly observed retry with a model/hint can complete as review, not correct. Reject missing/duplicate/foreign steps, unsupported evidence/values, invalid attempts (1..30), unknown keys on settings. No free-text transcript storage through answers; practice `value` must be absent.

Math-transfer connects same quantities across familiar money, grouping/other context and symbolic calculation, plus a fresh analogous problem. Avoid using the same answer repeatedly as proof of transfer. Clock levels: within-hour, across-hour, reverse/start or duration. Calendar level 1 stays in month; level 2 crosses month with exact Gregorian arithmetic. Multiplication starts equal groups, repeated addition, changed arrangement/context. Pattern levels have explicit unambiguous bounded rules.

English words hide target during recall (visual label must not leak it); model/help reveal tracked. Default ai/ay word banks can include rain/tail/mail/day/say/May, with explicitly declared helper words in sentences; do not feed individual letter names to TTS and call it phoneme instruction. CVC is optional, not default. Conversation scenario preview is labelled as such and not described as live AI.

## State (`supabase/functions/_shared/learning-lab.ts`) and domain integration

```ts
export interface LabRun extends LabEvaluation {id:string;lessonId:LabLessonId;contentVersion:string;settingsVersion:number;settings:LabSettings;seed:number;actorId:string;actorName:string;completedAt:string;day:string;mode:'preview';stars:0;completionKey?:string;}
export interface LabProgress extends LabSkillResult {lastSeen:string;lastOutcome:'independent'|'supported'|'review';}
export interface LabVoiceUsage {day:string;turns:number;sessions:Record<string,{actorId:string;turns:number;startedAt:string}>;}
export interface LearningLabState {settings:LabSettings;settingsVersion:number;previews:LabRun[];previewProgress:Record<string,LabProgress>;voiceUsage?:LabVoiceUsage;}
export type LearningLabAction =
 | {type:'learning-lab/save-settings';settings:LabSettings;version:number}
 | {type:'learning-lab/complete-preview';runId:string;lessonId:LabLessonId;contentVersion:string;settingsVersion:number;settings:LabSettings;seed:number;answers:LabAnswer[]}
 | {type:'learning-lab/reserve-coach-turn';sessionId:string;turnId:string};
export function learningLabFor(state:State):LearningLabState;
export function applyLearningLabAction(state:State,action:LearningLabAction,ctx:Context):Result;
```

Add optional `State.learningLab`, `Action` union and cases in domain. All new actions admin only. Reserve action limits: 40 turns/family/Korean day, 12 turns/session, session age max 15 min; actor owns session; retain active prior-day sessions across midnight with a bounded maximum of80 entries. Uses supplied server ctx.now, no client timestamp. A reservation is persisted before paid calls. New preview not eligible for learning/praise. Keep latest 40 preview summaries; progress known skill IDs <=200, aggregate only once. Versions prevent stale save/completion; exact duplicates return existing run without progress double count, changed reuses rejected; request receipt remains authoritative. No full audio/chat or medical/profile information stored. Existing v0.7 state untouched.

## Guardian UI (`src/learning-lab.ts`, `src/learning-lab.css`, optional `src/learning-lab-visuals.ts`)

```ts
export interface LearningLabHost {snapshot:()=>Snapshot|null;perform:(action:LearningLabAction)=>Promise<boolean>;render:()=>void;toast:(message:string)=>void;coach:CoachPort;}
export class LearningLabController {
 constructor(host:LearningLabHost);
 render(snapshot:Snapshot):string;
 handleClick(source:HTMLElement):Promise<void>;
 handleSubmit(form:HTMLFormElement):Promise<void>;
 leave():void;
 reconcile(snapshot:Snapshot):boolean;
}
```

Use `data-lab-action`, `data-lab-form`, `data-lesson-id`. Root handles routing and delegates. Parent home heading 학습 테스트, visible 보호자 전용 · 아이 미공개, substantive English/Math cards, settings and preview history/progress tabs or sections. Legacy link uses `data-action="learning-legacy"` (root handles). No v2 publish control in this release. Root integrates a back-to-v2 button on legacy view.

Direct numeric entry with large keypad; native keyboard submit too. Time/date appropriate entry, exact clock/calendar/group/money SVG/CSS. Hint, model, retry, next, pause; dynamic steps; supported/review observations can finish without claiming correctness. Recall target hidden until reveal and observation actions (스스로 말했어요 / 도움받았어요 / 다시 연습) explicitly labelled guardian/self observation, no fake automated assessment. Reading has model, independent attempt, new-word transfer and meaning; no reading success inferred merely from TTS completion. Track active settings snapshot; stale completion prompts restart without losing saved history. Save with stable runId and retry failed submission. Session lost on account/role/family change; polls of same actor/version preserve session and unsaved settings fields. Stop local TTS and coach on pause/leave/hidden. Only locally available speechSynthesis voices for offline preview, text/parent fallback if missing. Escape all display content. No audio or chat in localStorage.

## Root-owned coach port (`src/learning-coach.ts`)

```ts
export interface CoachMessage {role:'assistant'|'user';text:string;hint?:string;modelPhrase?:string;}
export interface CoachView {phase:'idle'|'checking'|'ready'|'recording'|'sending'|'speaking'|'error';available:boolean|null;message:string;messages:CoachMessage[];turns:number;}
export interface CoachPort {view():CoachView;check():Promise<void>;startRecording(topic:LabSettings['topic']):Promise<void>;finishRecording():Promise<void>;sendText(text:string,topic:LabSettings['topic']):Promise<void>;leave():void;}
```

UI renders a real AI connection-test panel on conversation activity. Label 보호자 목소리로 AI 연결 테스트, check availability before mic, typed message fallback, clear record/stop/turn status; missing config honestly displayed. Actual AI transcript is ephemeral and does not automatically complete the separate scenario preview or award stars. Root provides the port and actual authenticated server endpoint. Changes call host.render; UI should not recreate the port. No microphone before explicit guardian button.
