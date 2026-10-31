import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,demoState,dayKey} from '../dist/supabase/functions/_shared/domain.js';
import {LEARNING_CONTENT_VERSION,getLearningLesson} from '../dist/supabase/functions/_shared/learning-content.js';

const now='2026-10-31T04:00:00.000Z';
const ctx=(role='admin',time=now,id=role)=>({actor:{id,name:role,role},now:time,newId:()=>crypto.randomUUID(),random:()=>0.1});
const settings={lessonIds:['english-colors','math-ten'],dailyLimit:2,starsPerSession:1};
const answers=(lessonId='english-colors')=>getLearningLesson(lessonId).questions.map(q=>({questionId:q.id,optionId:q.answerId,attempts:1,help:'none'}));
const preview=(lessonId='english-colors',runId=crypto.randomUUID())=>({type:'learning/complete-preview',lessonId,runId,contentVersion:LEARNING_CONTENT_VERSION,answers:answers(lessonId)});
const complete=(version=1,lessonId='english-colors',runId=crypto.randomUUID())=>({...preview(lessonId,runId),type:'learning/complete',publicationVersion:version});
const publish=(version=0,publicationSequence=0)=>({type:'learning/publish',draftVersion:version,publicationSequence,contentVersion:LEARNING_CONTENT_VERSION});
const apply=(s,a,role='admin',time=now,id=role)=>applyAction(s,a,ctx(role,time,id));
const rejects=(s,a,code,role='admin')=>assert.throws(()=>apply(s,a,role),e=>e.code===code);
function tested(s=demoState(now),ids=settings.lessonIds){for(const id of ids)s=apply(s,preview(id)).state;return s;}
function published(config=settings){let s=demoState(now);s=apply(s,{type:'learning/save-draft',settings:config,version:0}).state;s=tested(s,config.lessonIds);return apply(s,publish(1)).state;}

test('legacy family stays unpublished and child cannot submit a guessed learning route',()=>{
 const s=demoState(now),before=structuredClone(s);
 rejects(s,complete(),'LEARNING_UNPUBLISHED','child');
 assert.deepEqual(s,before);assert.equal(s.learning,undefined);
});

test('guardian preview keeps real stars, coupons, praise, draws and child runs unchanged',()=>{
 const s=demoState(now),before=structuredClone(s),action=preview();
 const next=apply(s,action);
 for(const key of ['balance','lifetimeEarned','ledger','inventory','praises','draws'])assert.deepEqual(next.state[key],before[key]);
 assert.equal(next.state.learning.publication,null);assert.deepEqual(next.state.learning.runs,[]);
 assert.equal(next.state.learning.previews[0].stars,0);assert.equal(next.result.learningRunId,action.runId);
 assert.deepEqual(s,before);
});

test('all selected lessons need current-content preview before publishing',()=>{
 const s=demoState(now);rejects(s,publish(),'LEARNING_UNTESTED');
 const one=tested(s,['english-colors']);rejects(one,publish(),'LEARNING_UNTESTED');
 const ready=tested(one,['math-ten']);const out=apply(ready,publish()).state;
 assert.equal(out.learning.publication.version,1);assert.deepEqual(out.learning.publication.settings,settings);
 const obsolete=structuredClone(ready);obsolete.learning.previews[0].contentVersion='old';
 rejects(obsolete,publish(),'LEARNING_UNTESTED');
});

for(const role of ['child','giver'])test(`${role} cannot preview, save, publish, withdraw or praise`,()=>{
 const s=published();
 for(const action of [preview(),{type:'learning/save-draft',settings,version:1},publish(1),{type:'learning/unpublish',publicationVersion:1},{type:'learning/praise',runId:crypto.randomUUID()}])rejects(s,action,'FORBIDDEN',role);
});
for(const role of ['admin','giver'])test(`${role} cannot forge child completion`,()=>rejects(published(),complete(),'FORBIDDEN',role));

test('saving a draft neither exposes it nor mutates a published snapshot',()=>{
 const s=published(),newSettings={lessonIds:['math-stories'],dailyLimit:1,starsPerSession:0};
 const changed=apply(s,{type:'learning/save-draft',settings:newSettings,version:1}).state;
 assert.equal(changed.learning.draftVersion,2);assert.deepEqual(changed.learning.publication,s.learning.publication);
 newSettings.lessonIds.push('english-animals');assert.deepEqual(changed.learning.draft.lessonIds,['math-stories']);
 rejects(changed,publish(1),'QUOTE_CHANGED');
 rejects(changed,{type:'learning/save-draft',settings,version:1},'QUOTE_CHANGED');
 rejects(changed,publish(2,1),'LEARNING_UNTESTED');
 const ready=tested(changed,['math-stories']),republished=apply(ready,publish(2,1)).state;
 assert.equal(republished.learning.publication.version,2);assert.deepEqual(republished.learning.publication.settings.lessonIds,['math-stories']);
 rejects(republished,{type:'learning/unpublish',publicationVersion:1},'QUOTE_CHANGED');
});

test('draft validates known unique lessons, integer limits and small reward bounds',()=>{
 for(const invalid of [null,{}, {...settings,lessonIds:[]},{...settings,lessonIds:['unknown']},{...settings,lessonIds:['math-ten','math-ten']},{...settings,dailyLimit:0},{...settings,dailyLimit:5},{...settings,dailyLimit:'2'},{...settings,starsPerSession:-1},{...settings,starsPerSession:4},{...settings,starsPerSession:1.5}])rejects(demoState(now),{type:'learning/save-draft',settings:invalid,version:0},'INVALID_INPUT');
});

test('completion independently validates all final answers and current lesson/content',()=>{
 const s=published(),a=complete();
 for(const invalid of [{...a,answers:[]},{...a,answers:a.answers.slice(1)},{...a,answers:[{...a.answers[0],optionId:'wrong'},...a.answers.slice(1)]},{...a,runId:'not-a-uuid'}])rejects(s,invalid,'INVALID_INPUT','child');
 rejects(s,{...a,contentVersion:'old'},'LEARNING_CONTENT_CHANGED','child');
 rejects(s,complete(1,'english-animals'),'LEARNING_UNAVAILABLE','child');
 rejects(s,{...a,publicationVersion:0},'QUOTE_CHANGED','child');
});

test('supported work completes without star penalty but waits for explicit guardian praise',()=>{
 const s=published(),a=complete();a.answers[0]={...a.answers[0],attempts:3,help:'model'};a.answers[1].help='replay';
 const out=apply(s,a,'child'),run=out.state.learning.runs[0];
 assert.deepEqual([run.total,run.independent,run.supported,run.firstTry],[5,3,2,4]);
 assert.equal(run.stars,1);assert.equal(out.state.balance,s.balance);assert.deepEqual(out.state.praises,s.praises);
 const rewarded=apply(out.state,{type:'learning/praise',runId:a.runId});
 assert.equal(rewarded.state.balance,s.balance+1);assert.equal(rewarded.state.lifetimeEarned,s.lifetimeEarned+1);
 const p=rewarded.state.praises.at(-1);assert.equal(p.learningRunId,a.runId);assert.equal(p.actorId,'admin');
 assert.equal(rewarded.state.ledger.at(-1).refId,p.id);assert.equal(rewarded.state.ledger.at(-1).delta,1);
 assert.equal(rewarded.state.learning.runs[0].praiseId,p.id);
});

test('same run under a new request or child device does not duplicate completion or quota',()=>{
 const initial=published(),a=complete();
 const s=apply(initial,a,'child').state,retried=apply(s,a,'child',now,'other-child-device');
 assert.deepEqual(retried.state,s);assert.equal(retried.result.learningRunId,a.runId);
 const changed={...a,answers:a.answers.map((x,i)=>i?x:{...x,help:'hint'})};
 rejects(s,changed,'IDEMPOTENCY','child');
 rejects(s,{...preview('math-ten',a.runId)},'IDEMPOTENCY');
});

test('a completed preview cannot be reused as a child run or rewarded',()=>{
 let s=published();const a=preview();s=apply(s,a).state;
 rejects(s,complete(1,'english-colors',a.runId),'IDEMPOTENCY','child');
 rejects(s,{type:'learning/praise',runId:a.runId},'NOT_FOUND');
});

test('guardian praise is once-only including reversal and summary pruning',()=>{
 const a=complete();let s=apply(published(),a,'child').state;
 const praise={type:'learning/praise',runId:a.runId};s=apply(s,praise).state;
 assert.deepEqual(apply(s,praise).state,s);
 const p=s.praises.at(-1);s=apply(s,{type:'praise/reverse',id:p.id,reason:'테스트 정정'}).state;
 assert.deepEqual(apply(s,praise).state,s);
 s.learning.runs=[];assert.deepEqual(apply(s,praise).state,s);
 rejects(s,a,'LEARNING_ALREADY_COMPLETED','child');
});

test('published zero-star activities complete without creating a praise ledger',()=>{
 const a=complete(),s=published({...settings,starsPerSession:0}),done=apply(s,a,'child').state;
 assert.equal(done.learning.runs[0].stars,0);rejects(done,{type:'learning/praise',runId:a.runId},'LEARNING_NO_REWARD');
 assert.deepEqual(done.ledger,s.ledger);
});

test('family-wide daily quota uses Korea date and counts across child devices',()=>{
 let s=published();s=apply(s,complete(),'child','2026-10-31T14:59:00.000Z','ipad').state;
 s=apply(s,complete(1,'math-ten'),'child','2026-10-31T14:59:30.000Z','laptop').state;
 rejects(s,complete(),'DAILY_LIMIT','child');
 s=apply(s,complete(),'child','2026-10-31T15:00:00.000Z').state;
 assert.equal(s.learning.runs.at(-1).day,'2026-11-01');assert.equal(dayKey('2026-10-31T15:00:00.000Z'),'2026-11-01');
});

test('withdraw rejects new child completions and never reuses a publication version',()=>{
 let s=published();const old=complete();s=apply(s,{type:'learning/unpublish',publicationVersion:1}).state;
 assert.equal(s.learning.publication,null);rejects(s,old,'LEARNING_UNPUBLISHED','child');
 s=apply(s,publish(1,2)).state;assert.equal(s.learning.publication.version,3);
 rejects(s,old,'QUOTE_CHANGED','child');
});

test('completed run retry after withdraw is harmless and preserves its saved result',()=>{
 const a=complete();let s=apply(published(),a,'child').state;
 s=apply(s,{type:'learning/unpublish',publicationVersion:1}).state;
 assert.deepEqual(apply(s,a,'child').state,s);
});

test('an old publish confirmation cannot undo another guardian withdrawal or publication cycle',()=>{
 let s=published();const stale=publish(1,1);
 s=apply(s,{type:'learning/unpublish',publicationVersion:1}).state;
 rejects(s,stale,'QUOTE_CHANGED');assert.equal(s.learning.publication,null);
 const whileHidden=publish(1,2);
 s=apply(s,whileHidden).state;assert.equal(s.learning.publication.version,3);
 s=apply(s,{type:'learning/unpublish',publicationVersion:3}).state;
 rejects(s,whileHidden,'QUOTE_CHANGED');assert.equal(s.learning.publicationSequence,4);
});

test('summary retention stays bounded without consuming rewards',()=>{
 let s=demoState(now);for(let i=0;i<35;i++)s=apply(s,preview()).state;
 assert.equal(s.learning.previews.length,30);
 s=published({...settings,dailyLimit:4});for(let i=0;i<65;i++){
  const time=new Date(Date.UTC(2026,10,1+Math.floor(i/4),4)).toISOString();
  s=apply(s,complete(),'child',time).state;
 }
 assert.equal(s.learning.runs.length,60);assert.equal(s.balance,demoState(now).balance);
});
