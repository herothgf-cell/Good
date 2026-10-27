import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, emptyState, exampleRewards} from '../dist/supabase/functions/_shared/domain.js';
import {DemoRepository, CloudRepository, DEMO_MEMBERS} from '../dist/src/backend.js';
import {processCommand} from '../dist/supabase/functions/_shared/service.js';
import {renderApp} from '../dist/src/ui.js';
const dad={id:'dad',name:'아빠',role:'admin'};
const now='2026-10-27T03:00:00.000Z';
const ctx=(role='admin')=>({actor:{...dad,role},now,newId:()=>crypto.randomUUID(),random:()=>0});
const initial=()=>({...emptyState(),rewards:exampleRewards()});
const grant={type:'stars/grant',stars:13,reason:'초기 별 지급'};
const gift={type:'reward/grant',rewardId:'r-trip',version:1,reason:'특별한 응원 선물'};
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const error=code=>e=>e.code===code;
test('보호자 초기 별 13개는 적립 원장과 누적별에 기록하고 칭찬 횟수는 늘리지 않는다',()=>{
  const original=initial();const {state}=applyAction(original,grant,ctx());
  assert.equal(state.balance,13);assert.equal(state.lifetimeEarned,13);assert.equal(state.praises.length,0);
  assert.equal(state.ledger[0].kind,'grant');assert.equal(state.ledger[0].delta,13);assert.equal(state.ledger[0].actorName,'아빠');assert.match(state.ledger[0].reason,/초기 별/);
  assert.equal(original.balance,0);assert.equal(original.ledger.length,0);
});
for(const stars of [0,-1,1.5,'13',null,NaN,Infinity,10001])test(`직접 별 지급 invalid ${String(stars)}`,()=>assert.throws(()=>applyAction(initial(),{...grant,stars},ctx()),error('INVALID_INPUT')));
for(const stars of [1,10000])test(`직접 별 지급 경계 ${stars}`,()=>assert.equal(applyAction(initial(),{...grant,stars},ctx()).state.balance,stars));
for(const reason of ['', '  ', 'x'.repeat(181), null])test(`직접 별 사유 검증 ${String(reason).length}`,()=>assert.throws(()=>applyAction(initial(),{...grant,reason},ctx()),error('INVALID_INPUT')));
for(const role of ['giver','child'])for(const action of [grant,gift])test(`${role}는 ${action.type} 불가`,()=>assert.throws(()=>applyAction(initial(),action,ctx(role)),error('FORBIDDEN')));
test('보상 직접 지급은 잔액 0에서도 가능하며 재고와 0원장을 남긴다',()=>{
  const original=initial();const {state,result}=applyAction(original,gift,ctx());
  assert.equal(state.balance,0);assert.equal(state.lifetimeEarned,0);assert.equal(state.draws.length,0);
  assert.equal(state.inventory.length,1);assert.equal(result.coupon.source,'gift');assert.equal(result.coupon.status,'available');
  assert.equal(result.coupon.grantedByName,'아빠');assert.equal(result.coupon.grantReason,gift.reason);
  assert.equal(state.rewards.find(r=>r.id==='r-trip').stock,0);assert.equal(state.ledger[0].kind,'gift');assert.equal(state.ledger[0].delta,0);
  assert.equal(original.rewards.find(r=>r.id==='r-trip').stock,1);
});
test('직접 선물도 사용 요청·승인·완료 흐름을 따른다',()=>{
  let s=applyAction(initial(),gift,ctx()).state;const id=s.inventory[0].id;
  s=applyAction(s,{type:'coupon/request',id},ctx('child')).state;
  s=applyAction(s,{type:'coupon/approve',id},ctx()).state;
  s=applyAction(s,{type:'coupon/use',id},ctx()).state;
  assert.equal(s.inventory[0].status,'used');assert.equal(s.balance,0);
});
for(const [change,expected] of [[{stock:0},'SOLD_OUT'],[{active:false},'NOT_FOUND'],[{version:2},'QUOTE_CHANGED']])test(`선물 지급 거절 ${expected}`,()=>{
 const s=initial();Object.assign(s.rewards.find(r=>r.id==='r-trip'),change);assert.throws(()=>applyAction(s,gift,ctx()),error(expected));
});
test('별 잔액 상한을 초과한 지급은 기존 기록을 변경하지 않는다',()=>{
 const s=initial();s.balance=10000000;s.lifetimeEarned=10000000;s.ledger=[{delta:10000000}];assert.throws(()=>applyAction(s,grant,ctx()),error('LIMIT'));assert.equal(s.balance,10000000);
});
test('별과 선물의 동일 요청 재전송은 한번만 지급한다',async()=>{
 const repo=new DemoRepository(memory(),dad,initial);await repo.perform(grant,'stars-once');await repo.perform(grant,'stars-once');
 await repo.perform(gift,'gift-once');await repo.perform(gift,'gift-once');const s=(await repo.load()).state;
 assert.equal(s.balance,13);assert.equal(s.inventory.length,1);assert.equal(s.ledger.length,2);
});
test('마지막 재고 동시 선물은 1장만 발급된다',async()=>{
 const repo=new DemoRepository(memory(),dad,initial);const results=await Promise.allSettled([repo.perform(gift,'a'),repo.perform(gift,'b')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.load()).state.inventory.length,1);
});
const rename={type:'member/rename',userId:'mom',expectedName:'엄마',displayName:'어머니'};
test('구성원 이름 수정은 새로고침 후에도 유지되고 권한을 바꾸지 않는다',async()=>{
 const storage=memory();const repo=new DemoRepository(storage,dad,initial);await repo.perform(rename,'rename1');
 const s=await new DemoRepository(storage,DEMO_MEMBERS.find(m=>m.id==='mom'),initial).load();assert.equal(s.me.name,'어머니');assert.equal(s.me.role,'admin');assert.equal(s.state.balance,0);assert.equal(DEMO_MEMBERS.find(m=>m.id==='mom').name,'엄마');
});
test('이름 수정 이후 지급자 표시는 현재 이름을 사용한다',async()=>{
 const storage=memory();const repo=new DemoRepository(storage,dad,initial);await repo.perform({...rename,userId:'dad',expectedName:'아빠',displayName:'아버지'},'name');await repo.perform(grant,'give');assert.equal((await repo.load()).state.ledger[0].actorName,'아버지');
});
for(const role of ['giver','child'])test(`${role}는 다른 구성원 이름 수정 불가`,async()=>{
 const repo=new DemoRepository(memory(),DEMO_MEMBERS.find(m=>m.role===role),initial);await assert.rejects(()=>repo.perform(rename,'x'),error('FORBIDDEN'));
});
for(const displayName of ['',' '.repeat(2),'가'.repeat(31)])test(`이름 길이 검증 ${displayName.length}`,async()=>{
 const repo=new DemoRepository(memory(),dad,initial);await assert.rejects(()=>repo.perform({...rename,displayName},'x'),error('INVALID_INPUT'));
});
test('다른 구성원 ID 또는 오래된 이름으로 변경 불가',async()=>{
 const repo=new DemoRepository(memory(),dad,initial);await assert.rejects(()=>repo.perform({...rename,userId:'outsider'},'x'),error('NOT_FOUND'));
 await repo.perform(rename,'one');await assert.rejects(()=>repo.perform({...rename,displayName:'엄'},'two'),error('QUOTE_CHANGED'));
 await repo.perform(rename,'one');assert.equal((await repo.load()).members.find(m=>m.id==='mom').name,'어머니');
});
test('클라우드 이름 수정은 전용 RPC와 요청 번호를 사용하고 멤버를 재조회한다',async()=>{
 const calls=[];let name='엄';const auth={validSession:async()=>({user:{id:'dad'}}),api:async(path,body)=>{
  calls.push({path,body});if(path==='/rest/v1/rpc/family_rename_member'){name=body.p_display_name;return {message:'가족 이름을 수정했어요.'};}
  if(path.startsWith('/rest/v1/families?'))return [{state:initial(),revision:1}];
  if(path.includes('user_id=eq.'))return [{family_id:'family',user_id:'dad',display_name:'아빠',role:'admin'}];
  return [{user_id:'dad',display_name:'아빠',role:'admin'},{user_id:'mom',display_name:name,role:'admin'}];
 }};
 const repo=new CloudRepository(auth);const out=await repo.perform({...rename,expectedName:'엄',displayName:'엄마'},'request-id');
 assert.equal(out.snapshot.members[1].name,'엄마');assert.deepEqual(calls.find(x=>x.path.includes('rpc/')).body,{p_user_id:'mom',p_display_name:'엄마',p_expected_name:'엄',p_request_id:'request-id'});
});
test('보호자 화면에는 이름 수정·별 지급·선물 지급 버튼이 보인다',()=>{
 const snapshot={state:initial(),me:dad,members:DEMO_MEMBERS,familyId:'demo',revision:0};
 const view={snapshot,mode:'demo',busy:false,pending:false,syncError:'',lastSync:'',inventoryFilter:'all'};
 assert.match(renderApp({...view,screen:'family'}),/data-action="rename-member"/);
 assert.match(renderApp({...view,screen:'praise'}),/data-action="grant-stars"/);
 assert.match(renderApp({...view,screen:'manage'}),/data-action="grant-reward"/);
 for(const role of ['giver','child']){
  const restricted={...view,snapshot:{...snapshot,me:{...dad,role}}};
  for(const screen of ['family','praise','manage'])assert.doesNotMatch(renderApp({...restricted,screen}),/data-action="(?:rename-member|grant-stars|grant-reward)"/);
 }
});
