import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLabLesson,DEFAULT_LAB_SETTINGS,evaluateLabAnswers,LAB_CONTENT_VERSION} from '../dist/supabase/functions/_shared/learning-lab-content.js';
import {emptyState,applyAction} from '../dist/supabase/functions/_shared/domain.js';
import {learningLabFor} from '../dist/supabase/functions/_shared/learning-lab.js';
import {LearningLabController} from '../dist/src/learning-lab.js';
const lesson=()=>buildLabLesson('english-phonics',DEFAULT_LAB_SETTINGS,0);
const answers=l=>l.steps.map(q=>q.kind==='practice'?{stepId:q.id,attempts:1,help:'none',practiced:true}:{stepId:q.id,attempts:1,help:'none',value:q.answer});
test('next records ungraded practice, never a correct or observed reading',()=>{
 const l=lesson(),r=evaluateLabAnswers(l,answers(l));const count=l.steps.filter(q=>q.kind==='practice').length;
 assert.equal(r.practiced,count);assert.equal(r.observed,0);assert.equal(r.correct,l.steps.length-count);
 assert.equal(r.independent+r.supported+r.review+r.practiced,r.total);
 for(const q of l.steps.filter(q=>q.kind==='practice')){const k=r.skills.find(s=>s.skillId===q.skillId);assert.equal(k.independent+k.supported+k.review,0);assert.ok(k.practiced>0);}
});
test('practice marker cannot bypass objective grading or combine with observer claims',()=>{
 for(const mutate of [
  a=>{const q=lesson().steps.find(q=>q.kind!=='practice');a.find(x=>x.stepId===q.id).practiced=true;},
  a=>{a[0].observation='independent';a[0].evidence='guardian';},
  a=>{a[0].value='fat';}, a=>{a[0].practiced=false;}, a=>{a[0].practiced='true';}
 ]){const a=answers(lesson());mutate(a);assert.throws(()=>evaluateLabAnswers(lesson(),a));}
});
test('legacy observations still validate without becoming practiced',()=>{
 const l=lesson(),a=answers(l).map(a=>a.practiced?{stepId:a.stepId,attempts:1,help:'none',observation:'supported',evidence:'guardian'}:a);
 const r=evaluateLabAnswers(l,a);assert.equal(r.practiced??0,0);assert.equal(r.observed,l.steps.filter(q=>q.kind==='practice').length);
});
test('practice completion persists once without rewards; old progress lacks practiced safely',()=>{
 const l=lesson(),state=emptyState(),ctx={actor:{id:'parent',name:'보호자',role:'admin'},now:'2026-11-03T03:00:00Z',newId:()=>crypto.randomUUID(),random:()=>0};
 state.learningLab=learningLabFor(state);state.learningLab.previewProgress[l.steps[0].skillId]={skillId:l.steps[0].skillId,independent:1,supported:0,review:0,observed:1,lastSeen:ctx.now,lastOutcome:'independent'};
 const action={type:'learning-lab/complete-preview',runId:crypto.randomUUID(),lessonId:l.id,contentVersion:LAB_CONTENT_VERSION,settingsVersion:0,settings:DEFAULT_LAB_SETTINGS,seed:0,answers:answers(l)};
 const first=applyAction(state,action,ctx).state;const second=applyAction(first,action,ctx).state;
 assert.equal(second.learningLab.previews.length,1);assert.equal(second.balance,state.balance);
 const p=second.learningLab.previewProgress[l.steps[0].skillId];assert.equal(p.independent,1);assert.equal(p.practiced,l.steps.filter(q=>q.kind==='practice'&&q.skillId===l.steps[0].skillId).length);assert.equal(p.lastOutcome,'practiced');
 assert.equal(first.learningLab.previews[0].practiced,second.learningLab.previews[0].practiced);
});
test('practice interface has no observer or manual grading, Next advances a real step',async()=>{
 let state=emptyState();const snapshot=()=>({state,me:{id:'p',name:'보호자',role:'admin'},members:[],familyId:'f',revision:1});
 const c=new LearningLabController({snapshot,render(){},toast(){},perform:async()=>true,coach:{view:()=>({phase:'idle',available:null,message:'',messages:[],turns:0}),leave(){}}});
 await c.handleClick({dataset:{labAction:'start',lessonId:'english-phonics'}});
 const html=c.render(snapshot());assert.doesNotMatch(html,/lab-evidence|누구의 관찰|보호자 관찰|스스로 말했어요|도움받았어요/);
 assert.match(html,/data-lab-action="practice-next"/);const id=html.match(/data-step-id="([^"]+)"/)[1];
 await c.handleClick({dataset:{labAction:'practice-next',stepId:id}});assert.match(c.render(snapshot()),/2 \/ /);
 await c.handleClick({dataset:{labAction:'practice-next',stepId:id}});assert.match(c.render(snapshot()),/2 \/ /,'a stale double click must not skip another step');
 c.leave();
});
