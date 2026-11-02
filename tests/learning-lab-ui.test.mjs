import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

async function fixture(role='admin'){
 assert.ok(existsSync(new URL('../dist/src/learning-lab.js',import.meta.url)),'Guardian lab controller must exist');
 const {LearningLabController}=await import('../dist/src/learning-lab.js');
 const {emptyState}=await import('../dist/supabase/functions/_shared/domain.js');
 const {learningLabFor}=await import('../dist/supabase/functions/_shared/learning-lab.js');
 const state=emptyState();state.learningLab=learningLabFor(state);
 let snapshot={state,me:{id:'dad',name:'아빠',role},members:[],familyId:'family',revision:1};
 const actions=[],toasts=[];let result=true,leaves=0;
 const coach={view:()=>({phase:'idle',available:null,message:'연결 확인 필요',messages:[],turns:0}),check:async()=>{},startRecording:async()=>{},finishRecording:async()=>{},sendText:async()=>{},leave:()=>leaves++};
 const controller=new LearningLabController({snapshot:()=>snapshot,perform:async a=>{actions.push(structuredClone(a));return result;},render:()=>{},toast:t=>toasts.push(t),coach});
 return {controller,actions,toasts,click:(a,extra={})=>controller.handleClick({dataset:{labAction:a,...extra}}),get snapshot(){return snapshot},set snapshot(v){snapshot=v},set result(v){result=v},get leaves(){return leaves}};
}

test('lab home offers nine substantive guardian activities and no child/giver UI',async()=>{
 const f=await fixture();const html=f.controller.render(f.snapshot);
 assert.equal((html.match(/data-lab-action="start"/g)||[]).length,9);assert.match(html,/보호자 전용 · 아이 미공개/);assert.match(html,/data-lab-form="settings"/);assert.match(html,/learning-legacy/);
 for(const role of ['child','giver']){const child=await fixture(role);assert.equal(child.controller.render(child.snapshot),'');await child.click('start',{lessonId:'math-calculation'});assert.equal(child.actions.length,0);}
});
test('numeric runner uses direct entry and dynamic steps, then retries same completion id',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'math-calculation'});
 assert.match(f.controller.render(f.snapshot),/data-lab-form="answer"/);assert.match(f.controller.render(f.snapshot),/data-lab-action="digit"/);
 // Completing after an explicit model is a supported review, never a fabricated correct answer.
 f.result=false;let count=0;
 while(!f.controller.render(f.snapshot).includes('lab-summary')){await f.click('model');await f.click('review');await f.click('next');assert.ok(++count<=10);}
 assert.ok(count>=4);assert.equal(f.actions.length,1);assert.equal(f.actions[0].answers.length,count);assert.match(f.controller.render(f.snapshot),/아직 저장하지 못했어요/);
 f.result=true;await f.click('retry-save');assert.equal(f.actions[1].runId,f.actions[0].runId);assert.match(f.controller.render(f.snapshot),/저장했어요/);
});
test('recall hides target, help is recorded, ordinary polls preserve session, role change clears it',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'english-words'});
 let found=false;
 for(let i=0;i<10;i++){
  const html=f.controller.render(f.snapshot);
  if(html.includes('data-practice-mode="recall"')){found=true;assert.match(html,/답을 떠올려/);assert.doesNotMatch(html,/class="lab-target"/);await f.click('model');assert.match(f.controller.render(f.snapshot),/class="lab-target"/);break;}
  await f.click('observe',{observation:'independent'});await f.click('next');
 }
 assert.ok(found);assert.equal(f.controller.reconcile({...f.snapshot,revision:2}),false);assert.match(f.controller.render(f.snapshot),/data-practice-mode="recall"/);
 f.snapshot={...f.snapshot,me:{id:'child',name:'아이',role:'child'}};assert.equal(f.controller.reconcile(f.snapshot),true);assert.equal(f.controller.render(f.snapshot),'');assert.ok(f.leaves>0);
});
test('changed settings version blocks stale completion and offers restart while preserving history',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'math-calculation'});f.snapshot.state.learningLab.settingsVersion++;
 f.controller.reconcile(f.snapshot);const html=f.controller.render(f.snapshot);assert.match(html,/설정이 바뀌었어요/);assert.match(html,/data-lab-action="restart"/);assert.doesNotMatch(html,/data-lab-form="answer"/);
});
test('legacy fixed-scenario fixture retains adult coach and prevents unapproved device voice',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'english-conversation'});const html=f.controller.render(f.snapshot);assert.match(html,/영어 회화 · 음성 \+ 글/);assert.match(html,/시나리오 미리보기/);assert.match(html,/data-lab-action="coach-check"/);
 const synth=globalThis.speechSynthesis,utterance=globalThis.SpeechSynthesisUtterance;let spoken=0;
 globalThis.speechSynthesis={cancel(){},getVoices(){return [{lang:'en-US',localService:false}]},speak(){spoken++}};globalThis.SpeechSynthesisUtterance=class{};
 try{await f.click('listen');assert.equal(spoken,0);assert.match(f.toasts.at(-1),/기기에 저장된 영어 음성/);await f.click('pause');assert.ok(f.leaves>0);}finally{globalThis.speechSynthesis=synth;globalThis.SpeechSynthesisUtterance=utterance;}
});
test('question visuals never disclose unknown end time or calendar target before help',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'math-clock'});let html=f.controller.render(f.snapshot);
 assert.equal((html.match(/class="lab-clock"/g)||[]).length,1);await f.click('model');html=f.controller.render(f.snapshot);assert.equal((html.match(/class="lab-clock"/g)||[]).length,2);
 await f.click('back');await f.click('start',{lessonId:'math-calendar'});html=f.controller.render(f.snapshot);assert.doesNotMatch(html,/class="[^"]*lab-day-target/);await f.click('model');assert.match(f.controller.render(f.snapshot),/class="[^"]*lab-day-target/);
});
test('independent reading presents text without first playing or revealing a model',async()=>{
 const f=await fixture();await f.click('start',{lessonId:'english-reading'});await f.click('observe',{observation:'supported'});await f.click('next');const html=f.controller.render(f.snapshot);assert.match(html,/data-practice-mode="read"/);assert.match(html,/class="lab-target"/);assert.doesNotMatch(html,/함께 보는 답/);
});
test('listening to a scenario model phrase records support rather than independent conversation',async()=>{
 const f=await fixture();const synth=globalThis.speechSynthesis,utterance=globalThis.SpeechSynthesisUtterance;
 globalThis.speechSynthesis={cancel(){},getVoices:()=>[{lang:'en-US',localService:true}],speak(){}};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 try{await f.click('start',{lessonId:'english-conversation'});await f.click('listen');for(let i=0;i<10&&!f.controller.render(f.snapshot).includes('lab-summary');i++){await f.click('observe',{observation:'independent'});await f.click('next');}assert.equal(f.actions[0].answers[0].help,'model');assert.equal(f.actions[0].answers[0].observation,'supported');}finally{globalThis.speechSynthesis=synth;globalThis.SpeechSynthesisUtterance=utterance;}
});
test('100 won transfer shows exact coins and counts pieces rather than banknotes',async()=>{
 const {renderLabVisual}=await import('../dist/src/learning-lab-visuals.js');const html=renderLabVisual({kind:'money',unit:100,counts:[2,3]});assert.equal((html.match(/class="lab-coin"/g)||[]).length,5);assert.match(html,/100원 2개, 100원 3개/);assert.doesNotMatch(html,/lab-bill|장/);
});
