import test from 'node:test';
import assert from 'node:assert/strict';
import {processCommand,canonical} from '../dist/supabase/functions/_shared/service.js';
import {applyAction,demoState,DomainError} from '../dist/supabase/functions/_shared/domain.js';
import {getLearningLesson,LEARNING_CONTENT_VERSION} from '../dist/supabase/functions/_shared/learning-content.js';
const familyId='a0000000-0000-4000-8000-000000000001',now='2026-10-31T04:00:00Z';
const roles={dad:'admin',mom:'admin',ipad:'child',laptop:'child',grandma:'giver'};
const sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>.1};
const answers=()=>getLearningLesson('math-ten').questions.map(q=>({questionId:q.id,optionId:q.answerId,attempts:1,help:'none'}));
const complete=(runId=crypto.randomUUID())=>({type:'learning/complete',lessonId:'math-ten',runId,contentVersion:LEARNING_CONTENT_VERSION,publicationVersion:1,answers:answers()});
const cmd=action=>({familyId,requestId:crypto.randomUUID(),action});
function initial(limit=2){
 let s=demoState(now);const context={actor:{id:'dad',name:'아빠',role:'admin'},now,newId:()=>crypto.randomUUID(),random:()=>.1};
 for(const action of [
  {type:'learning/save-draft',settings:{lessonIds:['math-ten'],dailyLimit:limit,starsPerSession:1},version:0},
  {...complete(),type:'learning/complete-preview'},
  {type:'learning/publish',draftVersion:1,publicationSequence:0,contentVersion:LEARNING_CONTENT_VERSION}
 ])s=applyAction(s,action,context).state;
 return s;
}
function store(limit=2){
 let state=initial(limit),revision=3;const receipts=new Map();
 return {
  commits:0,
  async load(id,userId){if(id!==familyId||!roles[userId])throw new DomainError('FORBIDDEN','권한 없음');return {state:structuredClone(state),revision,actor:{id:userId,name:userId,role:roles[userId]}};},
  async receipt(_family,id){return receipts.get(id)??null;},
  async commit(data){
   const old=receipts.get(data.requestId);
   if(old){if(old.actorId!==data.actorId||canonical(old.payload)!==canonical(data.action))throw new DomainError('IDEMPOTENCY','다른 요청');return {state:structuredClone(state),revision,result:old.result};}
   if(revision!==data.revision)return {conflict:true};
   state=structuredClone(data.state);revision++;this.commits++;
   receipts.set(data.requestId,{actorId:data.actorId,payload:data.action,result:data.result});
   return {state:structuredClone(state),revision,result:data.result};
  }
 };
}
test('same completion request response can be recovered without repeating a run or reward',async()=>{
 const db=store(),request=cmd(complete());
 const first=await processCommand(request,'ipad',db,sources),again=await processCommand(request,'ipad',db,sources);
 assert.equal(db.commits,1);assert.deepEqual(again,first);assert.equal(again.state.learning.runs.length,1);
 assert.equal(again.state.balance,23);assert.equal(again.state.praises.length,first.state.praises.length);
 await assert.rejects(()=>processCommand({...request,action:{...request.action,lessonId:'english-colors'}},'ipad',db,sources),e=>e.code==='IDEMPOTENCY');
});
test('concurrent different request IDs for the same run across child devices save one summary',async()=>{
 const db=store(),action=complete();
 const results=await Promise.all([processCommand(cmd(action),'ipad',db,sources),processCommand(cmd(action),'laptop',db,sources)]);
 assert.equal(results[0].result.learningRunId,results[1].result.learningRunId);
 const current=await db.load(familyId,'dad');assert.equal(current.state.learning.runs.length,1);assert.equal(current.state.balance,23);
});
test('two child devices racing for the last daily slot admit one completion',async()=>{
 const db=store(1);
 const results=await Promise.allSettled([processCommand(cmd(complete()),'ipad',db,sources),processCommand(cmd(complete()),'laptop',db,sources)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'DAILY_LIMIT');
 assert.equal((await db.load(familyId,'dad')).state.learning.runs.length,1);
});
test('two guardians approving the same run create one praise and one ledger addition',async()=>{
 const db=store(),action=complete();await processCommand(cmd(action),'ipad',db,sources);
 const before=(await db.load(familyId,'dad')).state;
 const praise={type:'learning/praise',runId:action.runId};
 const results=await Promise.all([processCommand(cmd(praise),'dad',db,sources),processCommand(cmd(praise),'mom',db,sources)]);
 assert.equal(results[0].result.praiseId,results[1].result.praiseId);
 const after=(await db.load(familyId,'dad')).state;
 assert.equal(after.balance,before.balance+1);assert.equal(after.praises.length,before.praises.length+1);
 assert.equal(after.ledger.length,before.ledger.length+1);assert.equal(after.ledger.reduce((sum,l)=>sum+l.delta,0),after.balance);
});
test('withdraw racing with completion is rechecked after compare-and-swap conflict',async()=>{
 const db=store(),commit=db.commit.bind(db);let raced=false;
 db.commit=async data=>{
  if(data.action.type==='learning/complete'&&!raced){raced=true;await processCommand(cmd({type:'learning/unpublish',publicationVersion:1}),'dad',db,sources);return {conflict:true};}
  return commit(data);
 };
 await assert.rejects(()=>processCommand(cmd(complete()),'ipad',db,sources),e=>e.code==='LEARNING_UNPUBLISHED');
 const after=(await db.load(familyId,'dad')).state;assert.equal(after.learning.publication,null);assert.equal(after.learning.runs.length,0);assert.equal(after.balance,23);
});
test('current membership overrides forged actor role in the request body',async()=>{
 for(const userId of ['ipad','grandma']){
  const db=store();const request={...cmd({type:'learning/unpublish',publicationVersion:1,role:'admin'}),actor:{id:'dad',role:'admin'},role:'admin'};
  await assert.rejects(()=>processCommand(request,userId,db,sources),e=>e.code==='FORBIDDEN');assert.equal(db.commits,0);
 }
});
test('completed response remains recoverable after withdrawal without re-exposing learning',async()=>{
 const db=store(),request=cmd(complete());await processCommand(request,'ipad',db,sources);
 await processCommand(cmd({type:'learning/unpublish',publicationVersion:1}),'dad',db,sources);
 const recovered=await processCommand(request,'ipad',db,sources);assert.equal(recovered.state.learning.publication,null);
 assert.equal(recovered.state.learning.runs.length,1);assert.equal(db.commits,2);
});

test('a withdrawal winning CAS prevents an already prepared publish from reopening the child menu',async()=>{
 const db=store(),commit=db.commit.bind(db);let raced=false;
 db.commit=async data=>{
  if(data.action.type==='learning/publish'&&!raced){raced=true;await processCommand(cmd({type:'learning/unpublish',publicationVersion:1}),'mom',db,sources);return {conflict:true};}
  return commit(data);
 };
 await assert.rejects(()=>processCommand(cmd({type:'learning/publish',draftVersion:1,publicationSequence:1,contentVersion:LEARNING_CONTENT_VERSION}),'dad',db,sources),e=>e.code==='QUOTE_CHANGED');
 assert.equal((await db.load(familyId,'dad')).state.learning.publication,null);assert.equal(db.commits,1);
});
