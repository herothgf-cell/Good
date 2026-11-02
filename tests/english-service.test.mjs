import test from 'node:test';import assert from 'node:assert/strict';
import {applyEnglishCommand,englishLearningFor} from '../dist/supabase/functions/_shared/english-learning.js';
import {PHONICS_VERSION,buildPhonicsSteps,phonicsSpeech} from '../dist/supabase/functions/_shared/phonics-course.js';
import {createEnglishHandler,createEnglishStore} from '../supabase/functions/_server/english.js';
const family='10000000-0000-4000-8000-000000000001',user='10000000-0000-4000-8000-000000000002';
const now=Date.parse('2026-11-02T03:00:00Z');
const base=()=>({schema:1,balance:23,inventory:[{id:'keep'}],ledger:[{delta:23}]});
test('course selection preserves earlier mastery and non-learning data',()=>{const state=base(),r=applyEnglishCommand(state,{type:'phonics/select',unitId:'long-e'},now);assert.equal(r.state.balance,23);assert.deepEqual(r.state.inventory,state.inventory);assert.equal(englishLearningFor(r.state).selectedUnit,'long-e');assert.equal(englishLearningFor(r.state).units['short-a'],undefined);assert.deepEqual(state,base());});
test('sequential step completion advances cursor, rejects skipped and stale steps',()=>{
 let state=base();const action={type:'phonics/complete',unitId:'short-a',version:PHONICS_VERSION,index:0,attempt:0,record:{outcome:'supported',attempts:1,help:false}};
 const r=applyEnglishCommand(state,action,now);state=r.state;assert.equal(r.result.progress.units['short-a'].cursor,1);
 assert.throws(()=>applyEnglishCommand(state,action,now),/달라|진도/);
 assert.throws(()=>applyEnglishCommand(state,{...action,index:2},now),/달라|진도/);
 assert.equal(state.balance,23);
});
test('wrong spelling cannot advance and saved observations contain no submitted text',()=>{
 let s=base();for(let i=0;i<2;i++)s=applyEnglishCommand(s,{type:'phonics/complete',unitId:'short-a',version:PHONICS_VERSION,index:i,attempt:0,record:{outcome:'independent',attempts:1,help:false}},now).state;
 const action={type:'phonics/complete',unitId:'short-a',version:PHONICS_VERSION,index:2,attempt:0,record:{outcome:'independent',attempts:1,help:false,answer:'cat'}};
 assert.throws(()=>applyEnglishCommand(s,action,now));action.record.answer='fat';const r=applyEnglishCommand(s,action,now);
 assert.equal(r.result.progress.units['short-a'].cursor,3);assert.ok(!JSON.stringify(r.result.progress).includes('"answer"'));
});
function fixture(role='admin'){
 let data=base(),revision=0;const receipts=new Map();
 const adapter={member:async()=>({role}),load:async()=>({state:structuredClone(data),revision}),receipt:async(_,id)=>receipts.get(id)||null,commit:async c=>{if(c.revision!==revision)return {conflict:true};if(receipts.has(c.requestId))return {result:receipts.get(c.requestId).result};data=c.state;revision++;receipts.set(c.requestId,{actorId:c.actorId,payload:c.payload,result:c.result});return {result:c.result};}};
 const store=createEnglishStore(adapter,{read:englishLearningFor,apply:applyEnglishCommand},()=>now);let calls=0;
 const handler=createEnglishHandler({origin:'https://app.test',configured:true,resolveSpeech:phonicsSpeech,verify:async()=>user,store,speech:async()=>{calls++;return {mime:'audio/wav',base64:'UklGRg=='};}});
 const request=body=>handler(new Request('https://edge.test',{method:'POST',headers:{origin:'https://app.test',authorization:'Bearer ok'},body:JSON.stringify({familyId:family,...body})}));
 return {request,get calls(){return calls},get data(){return data}};
}
test('child cannot read guardian progress or synthesize audio',async()=>{const f=fixture('child');for(const operation of ['progress','speech'])assert.equal((await f.request({operation,text:'hi',requestId:crypto.randomUUID()})).status,403);assert.equal(f.calls,0);});
test('speech retries reserve only once and persist digest not private words',async()=>{const f=fixture();const body={operation:'speech',requestId:crypto.randomUUID(),text:'I like soccer.'};assert.equal((await f.request(body)).status,200);assert.equal((await f.request(body)).status,409);assert.equal(f.calls,1);assert.ok(!JSON.stringify(f.data).includes('soccer'));});
test('course speech resolves known server text and limits untrusted free text',async()=>{const f=fixture();assert.equal((await f.request({operation:'speech',requestId:crypto.randomUUID(),unitId:'short-a',index:0})).status,200);assert.equal((await f.request({operation:'speech',requestId:crypto.randomUUID(),text:'x'.repeat(801)})).status,400);assert.equal((await f.request({operation:'speech',requestId:crypto.randomUUID(),unitId:'not-a-unit',index:0})).status,400);});
test('invalid course writes return actionable input error instead of audio failure',async()=>{const f=fixture();const r=await f.request({operation:'command',requestId:crypto.randomUUID(),action:{type:'phonics/select',unitId:'missing'}});assert.equal(r.status,400);assert.equal((await r.json()).code,'INVALID_INPUT');});
test('progress endpoint rejects extra payload and no state change occurs',async()=>{const f=fixture();const r=await f.request({operation:'progress',unexpected:'ignore me'});assert.equal(r.status,400);assert.equal(f.data.learningEnglish,undefined);});
test('adapter writes metadata with expected revision to existing RPC',async()=>{const {createEnglishAdapter}=await import('../supabase/functions/_server/english.js');assert.equal(typeof createEnglishAdapter,'function');const calls=[];const a=createEnglishAdapter({url:'https://db.test',databaseHeaders:{apikey:'server-only'}},async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({result:{ok:true}}));});await a.commit({familyId:family,actorId:user,actorRole:'admin',requestId:crypto.randomUUID(),payload:{type:'test'},revision:5,state:{balance:23},result:{ok:true}});assert.ok(calls[0].url.endsWith('/rpc/family_commit'));assert.equal(JSON.parse(calls[0].options.body).p_expected_revision,5);});
