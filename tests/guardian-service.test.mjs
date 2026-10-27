import test from 'node:test';
import assert from 'node:assert/strict';
import {processCommand,canonical} from '../dist/supabase/functions/_shared/service.js';
import {emptyState,exampleRewards,DomainError} from '../dist/supabase/functions/_shared/domain.js';
const family='a0000000-0000-4000-8000-000000000001';
const sources={now:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),random:()=>0};
function store(role='admin') {
 let state={...emptyState(),rewards:exampleRewards()},revision=0;const receipts=new Map();
 return {commits:0,async load(f,user){if(f!==family)throw new DomainError('FORBIDDEN','외부 가족');return {state:structuredClone(state),revision,actor:{id:user,name:'보호자',role}};},
 async receipt(f,id){return receipts.get(id)??null;},async commit(c){
  const prior=receipts.get(c.requestId);if(prior){assert.equal(prior.actorId,c.actorId);assert.equal(canonical(prior.payload),canonical(c.action));return {state,revision,result:prior.result};}
  if(c.revision!==revision)return {conflict:true};state=c.state;revision++;this.commits++;receipts.set(c.requestId,{actorId:c.actorId,payload:c.action,result:c.result});return {state,revision,result:c.result};
 }};
}
const command=(action,requestId=crypto.randomUUID())=>({familyId:family,requestId,action});
test('server grant response-loss retry credits 13 only once',async()=>{const db=store();const cmd=command({type:'stars/grant',stars:13,reason:'초기 지급'});await processCommand(cmd,'dad',db,sources);const second=await processCommand(cmd,'dad',db,sources);assert.equal(second.state.balance,13);assert.equal(second.state.ledger.length,1);assert.equal(db.commits,1);});
test('server gift same request returns same coupon',async()=>{const db=store();const cmd=command({type:'reward/grant',rewardId:'r-trip',version:1,reason:'응원'});const a=await processCommand(cmd,'dad',db,sources);const b=await processCommand(cmd,'dad',db,sources);assert.equal(a.result.coupon.id,b.result.coupon.id);assert.equal(b.state.balance,0);assert.equal(b.state.inventory.length,1);assert.equal(db.commits,1);});
test('concurrent server grants preserve both ledger entries after CAS retry',async()=>{const db=store();await Promise.all([processCommand(command({type:'stars/grant',stars:13,reason:'초기'}),'dad',db,sources),processCommand(command({type:'stars/grant',stars:2,reason:'응원'}),'dad',db,sources)]);const s=await db.load(family,'dad');assert.equal(s.state.balance,15);assert.equal(s.state.ledger.length,2);});
test('server uses database role, not submitted guardian claim',async()=>{for(const role of ['giver','child']){const db=store(role);const cmd={...command({type:'stars/grant',stars:13,reason:'위조'}),role:'admin'};await assert.rejects(()=>processCommand(cmd,'child',db,sources),e=>e.code==='FORBIDDEN');assert.equal(db.commits,0);}});
