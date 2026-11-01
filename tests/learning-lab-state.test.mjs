import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,demoState} from '../dist/supabase/functions/_shared/domain.js';
import {processCommand,canonical} from '../dist/supabase/functions/_shared/service.js';
const lab=await import('../dist/supabase/functions/_shared/learning-lab.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const content=await import('../dist/supabase/functions/_shared/learning-lab-content.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const now='2026-11-01T04:00:00.000Z';
const uuid=n=>`a0000000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const ctx=(role='admin',id='dad',time=now)=>({actor:{id,name:id,role},now:time,newId:()=>crypto.randomUUID(),random:()=>.1});
const reserve=(session=1,turn=1)=>({type:'learning-lab/reserve-coach-turn',sessionId:uuid(session),turnId:uuid(turn)});
const change=(state,action,context=ctx())=>applyAction(state,action,context).state;
const fails=(fn,code)=>assert.throws(fn,error=>error.code===code);
const settings=()=>({...content.DEFAULT_LAB_SETTINGS});
function completion(n=1,lessonId='math-calculation',state=demoState(now),seed=17){
 assert.equal(typeof content.buildLabLesson,'function','content builder must exist');
 const current=lab.learningLabFor(state);
 const lesson=content.buildLabLesson(lessonId,current.settings,seed);
 const answers=lesson.steps.map(step=>step.kind==='practice'
  ?{stepId:step.id,attempts:1,help:'none',observation:'independent',evidence:'guardian'}
  :{stepId:step.id,value:step.answer,attempts:1,help:'none'});
 return {type:'learning-lab/complete-preview',runId:uuid(n),lessonId,contentVersion:content.LAB_CONTENT_VERSION,settingsVersion:current.settingsVersion,settings:current.settings,seed,answers};
}

test('all lab writes reject child and giver even with forged admin fields',()=>{
 for(const role of ['child','giver'])for(const action of [reserve(),{type:'learning-lab/save-settings',settings:{},version:0},{type:'learning-lab/complete-preview'}]){
  const original=demoState(now),before=structuredClone(original);
  fails(()=>change(original,{...action,role:'admin',actor:{role:'admin'}},ctx(role)),'FORBIDDEN');
  assert.deepEqual(original,before);
 }
});
test('legacy state receives isolated lab defaults without implicit writes',()=>{
 const state=demoState(now),before=structuredClone(state);
 assert.equal(typeof lab.learningLabFor,'function');
 const first=lab.learningLabFor(state);first.settings.topic='build';first.previews.push({});
 assert.equal(lab.learningLabFor(state).settings.topic,'play');
 assert.equal(lab.learningLabFor(state).previews.length,0);
 assert.deepEqual(state,before);assert.equal(first.settingsVersion,0);
});
test('settings save is complete, exact and version checked without changing legacy/rewards',()=>{
 const initial=demoState(now),next=change(initial,{type:'learning-lab/save-settings',settings:settings(),version:0});
 assert.equal(next.learningLab.settingsVersion,1);assert.deepEqual(next.learningLab.settings,settings());
 const {learningLab,...rest}=next;assert.deepEqual(rest,initial);
 fails(()=>change(next,{type:'learning-lab/save-settings',settings:settings(),version:0}),'QUOTE_CHANGED');
 for(const invalid of [{topic:'play'},{...settings(),extra:'no'},{...settings(),moneyUnit:1000000},null])
  fails(()=>change(initial,{type:'learning-lab/save-settings',settings:invalid,version:0}),'INVALID_INPUT');
 for(const version of [-1,0.5,'0',Number.MAX_SAFE_INTEGER+1])fails(()=>change(initial,{type:'learning-lab/save-settings',settings:settings(),version}),'INVALID_INPUT');
});
test('preview saves only a reward-neutral summary and computed skill progress',()=>{
 const before=demoState(now),action=completion(),next=change(before,action),run=next.learningLab.previews[0];
 const {learningLab,...rest}=next;assert.deepEqual(rest,before);
 assert.equal(run.id,action.runId);assert.equal(run.mode,'preview');assert.equal(run.stars,0);assert.equal(run.day,'2026-11-01');
 assert.equal(run.actorId,'dad');assert.equal(run.completedAt,now);assert.equal(run.independent,run.total);
 assert.equal(run.correct,run.total);assert.ok(run.total>=4);assert.ok(run.skills.length>0);
 assert.equal(run.answers,undefined);assert.equal(JSON.stringify(run).includes('transcript'),false);
 for(const skill of run.skills){
  assert.deepEqual(next.learningLab.previewProgress[skill.skillId],{...skill,lastSeen:now,lastOutcome:'independent'});
 }
 fails(()=>change(next,{type:'learning/praise',runId:run.id}),'NOT_FOUND');
});
test('exact run retry including reordered answers is saved once and changed reuse rejects',()=>{
 let action=completion();action.answers[0].attempts=2;
 const first=change(demoState(now),action),retry=change(first,{...action,answers:[...action.answers].reverse()});
 assert.deepEqual(retry,first);
 for(const patch of [completion(1,'math-calculation',demoState(now),18),{answers:action.answers.map((answer,i)=>i===0?{...answer,attempts:3}:answer)},completion(1,'math-transfer')])
  fails(()=>change(first,{...action,...patch}),'IDEMPOTENCY');
 fails(()=>change(first,action,ctx('admin','mom')),'IDEMPOTENCY');
});
test('saved duplicate survives settings updates but new stale completions reject',()=>{
 const action=completion(),completed=change(demoState(now),action);
 const updated=change(completed,{type:'learning-lab/save-settings',settings:{...settings(),topic:'shop'},version:0});
 assert.deepEqual(change(updated,action),updated);
 fails(()=>change(updated,{...action,runId:uuid(2)}),'QUOTE_CHANGED');
 fails(()=>change(demoState(now),{...action,settings:{...settings(),topic:'shop'}}),'QUOTE_CHANGED');
 fails(()=>change(demoState(now),{...action,contentVersion:'old'}),'LEARNING_CONTENT_CHANGED');
});
test('malformed preview payloads reject with input errors and do not mutate original state',()=>{
 const initial=demoState(now),action=completion(),before=structuredClone(initial);
 for(const patch of [{runId:'x'},{seed:-1},{seed:2147483648},{seed:1.5},{settingsVersion:-1},{lessonId:'__proto__'},{answers:[]},
  {answers:action.answers.map((answer,i)=>i===0?{...answer,attempts:31}:answer)},
  {answers:action.answers.map((answer,i)=>i===0?{...answer,transcript:'private'}:answer)}])
  fails(()=>change(initial,{...action,...patch}),'INVALID_INPUT');
 assert.deepEqual(initial,before);
});
test('summary pruning keeps the latest 40 and aggregate progress counts each run only once',()=>{
 let state=demoState(now);const first=completion(1);
 for(let n=1;n<=45;n++)state=change(state,{...first,runId:uuid(n)});
 assert.equal(state.learningLab.previews.length,40);assert.equal(state.learningLab.previews[0].id,uuid(6));
 assert.equal(state.learningLab.previews.at(-1).id,uuid(45));
 for(const skill of state.learningLab.previews[0].skills)assert.equal(state.learningLab.previewProgress[skill.skillId].independent,skill.independent*45);
 const last=state.learningLab.previews.at(-1),retry={...first,runId:last.id};assert.deepEqual(change(state,retry),state);
 assert.ok(Object.keys(state.learningLab.previewProgress).length<=200);
});
test('review outcome is preserved independently of correctness or observation claims',()=>{
 const action=completion(1,'english-words');
 for(const answer of action.answers){if(answer.observation){answer.observation='retry';answer.help='model';}}
 const state=change(demoState(now),action),run=state.learningLab.previews[0];
 assert.ok(run.review>0);assert.ok(run.observed>0);assert.ok(run.correct<run.total);
 for(const skill of run.skills.filter(skill=>skill.review>0))assert.equal(state.learningLab.previewProgress[skill.skillId].lastOutcome,'review');
});
test('voice reservation enforces UUIDs, 12 turns/session, owner, 40 turns/family/day',()=>{
 let state=demoState(now);
 for(const patch of [{sessionId:'a'},{turnId:'a'},{sessionId:'__proto__'}])fails(()=>change(state,{...reserve(),...patch}),'INVALID_INPUT');
 for(let turn=1;turn<=12;turn++)state=change(state,reserve(1,turn));
 assert.equal(state.learningLab.voiceUsage.turns,12);assert.equal(state.learningLab.voiceUsage.sessions[uuid(1)].turns,12);
 fails(()=>change(state,reserve(1,13)),'SESSION_LIMIT');
 fails(()=>change(state,reserve(1,13),ctx('admin','mom')),'FORBIDDEN');
 for(let turn=13;turn<=40;turn++)state=change(state,reserve(100+turn,turn));
 assert.equal(state.learningLab.voiceUsage.turns,40);assert.ok(Object.keys(state.learningLab.voiceUsage.sessions).length<=40);
 fails(()=>change(state,reserve(200,41)),'DAILY_LIMIT');
 assert.equal(JSON.stringify(state.learningLab.voiceUsage).includes('turnId'),false);
});
test('voice session expires at 15 minutes and Korean midnight starts a fresh daily budget',()=>{
 let state=change(demoState(now),reserve(),ctx('admin','dad','2026-11-01T14:50:00.000Z'));
 state=change(state,reserve(1,2),ctx('admin','dad','2026-11-01T14:59:59.999Z'));
 assert.equal(state.learningLab.voiceUsage.day,'2026-11-01');
 state=change(state,reserve(2,3),ctx('admin','mom','2026-11-01T15:00:00.000Z'));
 assert.equal(state.learningLab.voiceUsage.day,'2026-11-02');assert.equal(state.learningLab.voiceUsage.turns,1);
 let age=change(demoState(now),reserve());
 age=change(age,reserve(1,2),ctx('admin','dad','2026-11-01T04:14:59.999Z'));
 fails(()=>change(age,reserve(1,3),ctx('admin','dad','2026-11-01T04:15:00.000Z')),'SESSION_EXPIRED');
 fails(()=>change(age,reserve(1,3),ctx('admin','dad','2026-11-01T03:59:59.000Z')),'SESSION_EXPIRED');
});
function store(){
 let state=demoState(now),revision=1;const receipts=new Map();
 return {commits:0,
  async load(){return {state:structuredClone(state),revision,actor:ctx().actor};},
  async receipt(_family,id){return receipts.get(id)??null;},
  async commit(data){
   const receipt=receipts.get(data.requestId);
   if(receipt){if(canonical(receipt.payload)!==canonical(data.action))throw Error('changed receipt');return {state:structuredClone(state),revision,result:receipt.result};}
   if(data.revision!==revision)return {conflict:true};
   state=structuredClone(data.state);revision++;this.commits++;
   receipts.set(data.requestId,{actorId:data.actorId,payload:data.action,result:data.result});
   return {state:structuredClone(state),revision,result:data.result};
  }
 };
}
test('service receipts make duplicate reservations consume one slot and reject changed payload',async()=>{
 const db=store(),action=reserve(),command={familyId:uuid(999),requestId:action.turnId,action};
 const sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>.1};
 const results=await Promise.all([processCommand(command,'dad',db,sources),processCommand(command,'dad',db,sources)]);
 assert.equal(db.commits,1);assert.equal(results[0].state.learningLab.voiceUsage.turns,1);
 assert.equal(results[1].state.learningLab.voiceUsage.turns,1);
 await assert.rejects(()=>processCommand({...command,action:reserve(2,1)},'dad',db,sources),error=>error.code==='IDEMPOTENCY');
});
test('CAS retry rechecks the family voice limit before accepting a competing turn',async()=>{
 const db=store(),sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>.1};
 for(let turn=1;turn<=39;turn++)await processCommand({familyId:uuid(999),requestId:uuid(turn),action:reserve(100+turn,turn)},'dad',db,sources);
 const results=await Promise.allSettled([40,41].map(turn=>processCommand({familyId:uuid(999),requestId:uuid(turn),action:reserve(100+turn,turn)},'dad',db,sources)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.code,'DAILY_LIMIT');
 assert.equal((await db.load()).state.learningLab.voiceUsage.turns,40);
});
test('fresh reservation carries a server nonce and duplicate receipts return only winner nonce',async()=>{
 const state=demoState(now);
 const first=applyAction(state,reserve(),{...ctx(),newId:()=>uuid(900)});
 const second=applyAction(first.state,reserve(1,2),{...ctx(),newId:()=>uuid(901)});
 assert.equal(first.result.coachReservationId,uuid(900));assert.equal(second.result.coachReservationId,uuid(901));
 const db=store(),action=reserve(),command={familyId:uuid(999),requestId:action.turnId,action};
 const results=await Promise.all([900,901].map(n=>processCommand(command,'dad',db,{now:()=>now,newId:()=>uuid(n),random:()=>.1})));
 assert.equal(results[0].result.coachReservationId,results[1].result.coachReservationId);
 assert.equal(results.filter((result,index)=>result.result.coachReservationId===uuid(900+index)).length,1);
});
test('unknown action metadata cannot enter persisted command receipts',()=>{
 for(const action of [reserve(),{type:'learning-lab/save-settings',settings:settings(),version:0},completion()]){
  fails(()=>change(demoState(now),{...action,transcript:'private conversation'}),'INVALID_INPUT');
 }
});
test('active session keeps owner, age and 12-turn limit across Korean midnight',()=>{
 const before='2026-11-01T14:59:00.000Z',after='2026-11-01T15:01:00.000Z';
 let state=demoState(now);
 for(let turn=1;turn<=11;turn++)state=change(state,reserve(1,turn),ctx('admin','dad',before));
 fails(()=>change(state,reserve(1,12),ctx('admin','mom',after)),'FORBIDDEN');
 state=change(state,reserve(1,12),ctx('admin','dad',after));
 assert.equal(state.learningLab.voiceUsage.day,'2026-11-02');
 assert.equal(state.learningLab.voiceUsage.turns,1);
 assert.equal(state.learningLab.voiceUsage.sessions[uuid(1)].turns,12);
 assert.equal(state.learningLab.voiceUsage.sessions[uuid(1)].startedAt,before);
 fails(()=>change(state,reserve(1,13),ctx('admin','dad',after)),'SESSION_LIMIT');
});
test('authoritative stable run receipts prevent recounting a pruned preview',async()=>{
 const db=store(),sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>.1};
 const action=completion(),first={familyId:uuid(999),requestId:action.runId,action};
 await processCommand(first,'dad',db,sources);
 for(let n=2;n<=42;n++)await processCommand({familyId:uuid(999),requestId:uuid(n),action:{...action,runId:uuid(n)}},'dad',db,sources);
 const before=(await db.load()).state;
 assert.equal(before.learningLab.previews.some(run=>run.id===action.runId),false);
 const recovered=await processCommand(first,'dad',db,sources);
 assert.deepEqual(recovered.state,before);assert.equal(db.commits,42);
 assert.equal(recovered.result.learningRunId,action.runId);
});
test('explicit model-assisted review can finish direct entry without inventing an answer',()=>{
 const action=completion();delete action.answers[0].value;
 Object.assign(action.answers[0],{help:'model',observation:'retry',evidence:'guardian'});
 const run=change(demoState(now),action).learningLab.previews[0];
 assert.equal(run.review,1);assert.equal(run.correct,run.total-1);assert.equal(run.observed,0);
 const unsupported=structuredClone(action);unsupported.answers[0].help='none';
 fails(()=>change(demoState(now),unsupported),'INVALID_INPUT');
});
test('bounded money-unit spelling normalizes to the same valid numeric completion',()=>{
 const action=completion(1,'math-transfer'),original=change(demoState(now),action);
 const decorated=structuredClone(action);decorated.answers[0].value+= '원';
 assert.deepEqual(change(original,decorated),original);
});
