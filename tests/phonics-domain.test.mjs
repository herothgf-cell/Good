import test from 'node:test';import assert from 'node:assert/strict';
import {applyAction,emptyState} from '../dist/supabase/functions/_shared/domain.js';
import {learningLabFor} from '../dist/supabase/functions/_shared/learning-lab.js';
import {PHONICS_UNITS} from '../dist/supabase/functions/_shared/phonics-curriculum.js';
import {DEFAULT_LAB_SETTINGS,LAB_CONTENT_VERSION,buildLabLesson} from '../dist/supabase/functions/_shared/learning-lab-content.js';
const ctx={actor:{id:'guardian',name:'보호자',role:'admin'},now:'2026-11-02T09:00:00Z',newId:()=>crypto.randomUUID(),random:()=>0};
test('reading generation quota is guardian-only, bounded per Korean day, and never grants stars',()=>{
 let state=emptyState();const action=()=>({type:'learning-lab/reserve-reading',turnId:crypto.randomUUID()});
 assert.throws(()=>applyAction(state,action(),{...ctx,actor:{...ctx.actor,role:'child'}}),e=>e.code==='FORBIDDEN');
 for(let i=0;i<120;i++)state=applyAction(state,action(),ctx).state;
 assert.equal(state.learningLab.speechUsage.requests,120);assert.equal(state.balance,0);assert.equal(state.ledger.length,0);
 assert.throws(()=>applyAction(state,action(),ctx),e=>e.code==='DAILY_LIMIT');
 const next=applyAction(state,action(),{...ctx,now:'2026-11-02T15:00:00Z'}).state;assert.equal(next.learningLab.speechUsage.requests,1);
});
test('all source units fit beside legacy skill history without hitting progress capacity',()=>{
 let state=emptyState();state.learningLab=learningLabFor(state);
 for(let i=0;i<60;i++)state.learningLab.previewProgress[`legacy.skill.${i}`]={skillId:`legacy.skill.${i}`,independent:1,supported:0,review:0,observed:0,lastSeen:ctx.now,lastOutcome:'independent'};
 for(const unit of PHONICS_UNITS){
  state=applyAction(state,{type:'learning-lab/save-settings',settings:{...DEFAULT_LAB_SETTINGS,phonicsUnit:unit.id},version:state.learningLab.settingsVersion},ctx).state;
  const settings=state.learningLab.settings,lesson=buildLabLesson('english-phonics',settings,0);
  const answers=lesson.steps.map(s=>s.kind==='practice'?{stepId:s.id,attempts:1,help:'none',observation:'supported',evidence:'guardian'}:{stepId:s.id,attempts:1,help:'none',value:s.answer});
  state=applyAction(state,{type:'learning-lab/complete-preview',runId:crypto.randomUUID(),lessonId:'english-phonics',seed:0,settings,settingsVersion:state.learningLab.settingsVersion,contentVersion:LAB_CONTENT_VERSION,answers},ctx).state;
 }
 assert.ok(Object.keys(state.learningLab.previewProgress).length>200);assert.equal(state.balance,0);
});
