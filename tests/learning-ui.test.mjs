import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningController} from '../dist/src/learning.js';
import {LEARNING_LESSONS,LEARNING_CONTENT_VERSION} from '../dist/supabase/functions/_shared/learning-content.js';
import {learningFor} from '../dist/supabase/functions/_shared/learning.js';
import {emptyState} from '../dist/supabase/functions/_shared/domain.js';

const admin={id:'dad',name:'아빠',role:'admin'},child={id:'child',name:'아이',role:'child'};
function fixture(role='admin',published=false){
 const state=emptyState();state.learning=learningFor(state);
 if(published)state.learning.publication={version:1,contentVersion:LEARNING_CONTENT_VERSION,publishedAt:'2026-10-31T00:00:00Z',publishedBy:'dad',settings:{lessonIds:[LEARNING_LESSONS[0].id],dailyLimit:2,starsPerSession:1}};
 let snapshot={state,me:role==='admin'?admin:role==='child'?child:{id:'giver',name:'가족',role:'giver'},members:[admin,child],familyId:'family',revision:1};
 const actions=[],toasts=[];let result=true,renders=0;
 const controller=new LearningController({snapshot:()=>snapshot,perform:async action=>{actions.push(action);return result;},render:()=>renders++,toast:message=>toasts.push(message)});
 const click=(action,extra={})=>controller.handleClick({dataset:{learningAction:action,...extra}});
 return {controller,click,actions,toasts,get snapshot(){return snapshot;},set snapshot(v){snapshot=v;},set result(v){result=v;},get renders(){return renders;}};
}
async function finish(f,help=false){
 const lesson=LEARNING_LESSONS[0];await f.click('start',{lessonId:lesson.id});
 for(let index=0;index<lesson.questions.length;index++){
  if(help&&index===0)await f.click('text-help');
  await f.click('answer',{optionId:lesson.questions[index].answerId});
  await f.click('next');
 }
}
test('admin gets six previews and unpublished draft controls; children and givers get no management controls',()=>{
 const adminUI=fixture();const html=adminUI.controller.render(adminUI.snapshot);
 assert.equal((html.match(/data-learning-action="start"/g)??[]).length,6);
 assert.match(html,/학습 테스트/);assert.match(html,/미공개/);assert.match(html,/data-learning-form="settings"/);
 for(const role of ['child','giver']){const f=fixture(role);const html=f.controller.render(f.snapshot);assert.doesNotMatch(html,/data-learning-form|data-learning-action="publish|data-learning-action="start"/);}
});
test('published child catalog contains only publication lessons and never draft settings',()=>{
 const f=fixture('child',true);f.snapshot.state.learning.draft.lessonIds=LEARNING_LESSONS.map(l=>l.id);
 const html=f.controller.render(f.snapshot);assert.equal((html.match(/data-learning-action="start"/g)??[]).length,1);assert.doesNotMatch(html,/data-learning-form|학습 테스트|아이에게 공개/);
});
test('active lesson survives ordinary polls but cancels for a newer release or changed actor',async()=>{
 const f=fixture('child',true);await f.click('start',{lessonId:LEARNING_LESSONS[0].id});
 assert.match(f.controller.render(f.snapshot),/1 \/ 5/);assert.equal(f.controller.reconcile({...f.snapshot,revision:2}),false);
 f.snapshot.state.learning.publication.version=2;assert.equal(f.controller.reconcile(f.snapshot),true);assert.doesNotMatch(f.controller.render(f.snapshot),/data-learning-action="answer"/);
 await f.click('start',{lessonId:LEARNING_LESSONS[0].id});f.snapshot={...f.snapshot,me:admin};assert.equal(f.controller.reconcile(f.snapshot),true);
});
test('preview completion records text help and zero reward without offering praise',async()=>{
 const f=fixture();await finish(f,true);assert.equal(f.actions.length,1);assert.equal(f.actions[0].type,'learning/complete-preview');assert.equal(f.actions[0].answers.length,5);assert.equal(f.actions[0].answers[0].help,'hint');
 const html=f.controller.render(f.snapshot);assert.match(html,/별 0개/);assert.match(html,/저장했어요/);assert.doesNotMatch(html,/data-learning-action="praise"/);
});
test('false completion keeps a retry with the same run ID and never claims successful save',async()=>{
 const f=fixture('child',true);f.result=false;await finish(f);assert.equal(f.actions.length,1);
 const html=f.controller.render(f.snapshot);assert.match(html,/data-learning-action="retry-save"/);assert.doesNotMatch(html,/저장했어요|보호자 확인 대기/);
 f.result=true;await f.click('retry-save');assert.equal(f.actions.length,2);assert.equal(f.actions[0].runId,f.actions[1].runId);assert.match(f.controller.render(f.snapshot),/보호자 확인 대기/);
});
test('wrong answers permit retry and model help is represented in the completion payload',async()=>{
 const f=fixture();const lesson=LEARNING_LESSONS[0];await f.click('start',{lessonId:lesson.id});
 await f.click('answer',{optionId:lesson.questions[0].options.find(o=>o.id!==lesson.questions[0].answerId).id});assert.match(f.controller.render(f.snapshot),/다시/);
 await f.click('model');await f.click('answer',{optionId:lesson.questions[0].answerId});await f.click('next');
 for(const q of lesson.questions.slice(1)){await f.click('answer',{optionId:q.answerId});await f.click('next');}
 assert.equal(f.actions[0].answers[0].attempts,2);assert.equal(f.actions[0].answers[0].help,'model');
});
test('publication requires explicit confirmation and selected current-content previews',async()=>{
 const f=fixture();await f.click('publish');assert.equal(f.actions.length,0);assert.doesNotMatch(f.controller.render(f.snapshot),/data-learning-action="confirm-publish"/);
 f.snapshot.state.learning.previews=f.snapshot.state.learning.draft.lessonIds.map((lessonId,i)=>({id:`p${i}`,lessonId,contentVersion:LEARNING_CONTENT_VERSION,mode:'preview',total:5,independent:5,supported:0,firstTry:5,actorId:'dad',actorName:'아빠',completedAt:'2026-10-31T00:00:00Z',day:'2026-10-31',publicationVersion:null,stars:0}));
 await f.click('publish');assert.equal(f.actions.length,0);assert.match(f.controller.render(f.snapshot),/data-learning-action="confirm-publish"/);await f.click('confirm-publish');assert.equal(f.actions[0].type,'learning/publish');assert.equal(f.actions[0].publicationSequence,0);
});
test('authoritative pending retry resolves failed completion without creating another run',async()=>{
 const f=fixture();f.result=false;await finish(f);const action=f.actions[0];
 f.snapshot.state.learning.previews.push({id:action.runId,lessonId:action.lessonId,contentVersion:LEARNING_CONTENT_VERSION,mode:'preview',actorId:'dad',actorName:'아빠',completedAt:'2026-10-31T00:00:00Z',day:'2026-10-31',publicationVersion:null,stars:0,total:5,independent:5,supported:0,firstTry:5});
 assert.equal(f.controller.reconcile(f.snapshot),true);assert.match(f.controller.render(f.snapshot),/저장했어요/);await f.click('retry-save');assert.equal(f.actions.length,1);
});
test('a late next click after finishing cannot append another answer or save again',async()=>{
 const f=fixture();await finish(f);await f.click('next');assert.equal(f.actions.length,1);assert.match(f.controller.render(f.snapshot),/끝까지 도전했어요/);
});
test('countable math visuals preserve ten-frame fills and exact base-ten unit cells',async()=>{
 const f=fixture();await f.click('start',{lessonId:'math-ten'});assert.equal((f.controller.render(f.snapshot).match(/<i><\/i>/g)??[]).length,6);
 await f.click('back');const lesson=LEARNING_LESSONS.find(l=>l.id==='math-place');await f.click('start',{lessonId:lesson.id});
 for(const q of lesson.questions.slice(0,3)){await f.click('answer',{optionId:q.answerId});await f.click('next');}
 const html=f.controller.render(f.snapshot);assert.equal((html.match(/<i><\/i>/g)??[]).length,100);assert.match(html,/백 1개, 십 0개, 일 5개/);
});
test('speech is user triggered, replay is supported, and leaving cancels audio',async()=>{
 const oldSynthesis=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance;const spoken=[];let cancelled=0;
 globalThis.speechSynthesis={cancel(){cancelled++;},getVoices(){return [{lang:'en-US',localService:true}];},speak(value){spoken.push(value);}};
 globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
 try{
  const f=fixture();const lesson=LEARNING_LESSONS[0];await f.click('start',{lessonId:lesson.id});assert.equal(spoken.length,0);await f.click('listen');await f.click('listen');assert.equal(spoken.length,2);assert.equal(spoken[0].lang,'en-US');
  await f.click('answer',{optionId:lesson.questions[0].answerId});await f.click('next');
  for(const q of lesson.questions.slice(1)){await f.click('answer',{optionId:q.answerId});await f.click('next');}
  assert.equal(f.actions[0].answers[0].help,'replay');const before=cancelled;f.controller.leave();assert.ok(cancelled>before);
 }finally{if(oldSynthesis===undefined)delete globalThis.speechSynthesis;else globalThis.speechSynthesis=oldSynthesis;if(oldUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=oldUtterance;}
});
test('published zero-star completions say learning complete and never offer child praise',async()=>{
 const f=fixture('child',true);f.snapshot.state.learning.publication.settings.starsPerSession=0;await finish(f);const html=f.controller.render(f.snapshot);assert.match(html,/학습 완료/);assert.doesNotMatch(html,/보호자 확인 대기|data-learning-action="praise"/);
});
test('remote-only device voices use the explicit text fallback without starting speech',async()=>{
 const oldSynthesis=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance;let spoken=0;
 globalThis.speechSynthesis={cancel(){},getVoices(){return [{lang:'en-US',localService:false}];},speak(){spoken++;}};
 globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
 try{const f=fixture();await f.click('start',{lessonId:LEARNING_LESSONS[0].id});await f.click('listen');assert.equal(spoken,0);assert.match(f.toasts.at(-1),/글자 도움/);await f.click('text-help');assert.match(f.controller.render(f.snapshot),/Find red\./);}
 finally{if(oldSynthesis===undefined)delete globalThis.speechSynthesis;else globalThis.speechSynthesis=oldSynthesis;if(oldUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=oldUtterance;}
});
test('an older pending approval remains actionable after fifteen newer completions',()=>{
 const f=fixture();f.snapshot.state.learning.runs=Array.from({length:16},(_,i)=>({id:`child-run-${i}`,lessonId:LEARNING_LESSONS[0].id,contentVersion:LEARNING_CONTENT_VERSION,mode:'child',actorId:'child',actorName:'아이',completedAt:'2026-10-31T00:00:00Z',day:'2026-10-31',publicationVersion:1,stars:1,total:5,independent:5,supported:0,firstTry:5,...(i?{praiseId:`praise-${i}`}:{})}));
 const html=f.controller.render(f.snapshot);assert.equal((html.match(/class="learning-run-row"/g)??[]).length,16);assert.match(html,/data-learning-action="praise"[^>]*data-run-id="child-run-0"/);
});
test('publish confirmation captures the publication sequence and expires after withdrawal or replacement',async()=>{
 const f=fixture('admin',true);const learning=f.snapshot.state.learning;learning.publicationSequence=1;
 learning.previews=learning.draft.lessonIds.map((lessonId,i)=>({id:`p${i}`,lessonId,contentVersion:LEARNING_CONTENT_VERSION,mode:'preview',total:5,independent:5,supported:0,firstTry:5,actorId:'dad',actorName:'아빠',completedAt:'2026-10-31T00:00:00Z',day:'2026-10-31',publicationVersion:null,stars:0}));
 await f.click('publish');assert.match(f.controller.render(f.snapshot),/data-learning-action="confirm-publish"/);
 const publication=learning.publication;learning.publication=null;learning.publicationSequence=2;
 assert.equal(f.controller.reconcile(f.snapshot),true);assert.doesNotMatch(f.controller.render(f.snapshot),/data-learning-action="confirm-publish"/);await f.click('confirm-publish');assert.equal(f.actions.length,0);
 await f.click('publish');learning.publication={...publication,version:3};learning.publicationSequence=3;
 await f.click('confirm-publish');assert.equal(f.actions.length,0);assert.doesNotMatch(f.controller.render(f.snapshot),/data-learning-action="confirm-publish"/);
 await f.click('publish');await f.click('confirm-publish');assert.equal(f.actions[0].publicationSequence,3);assert.equal(f.actions[0].draftVersion,learning.draftVersion);
});
