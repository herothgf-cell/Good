import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/supabase/functions/_shared/domain.js';
import {DemoRepository} from '../dist/src/backend.js';
const admin={id:'dad',name:'아빠',role:'admin'},child={id:'kid',name:'연준이',role:'child'},giver={id:'gran',name:'할머니',role:'giver'};
let n=0;
const ctx=(actor=admin,now='2026-10-29T02:00:00Z')=>({actor,now,newId:()=>`new-${++n}`,random:()=>0.2});
const rule={id:'cleanup',title:'장난감 정리하기',description:'장난감을 제자리에 넣어요.',icon:'🧸',stars:2,dailyLimit:1,active:true,featured:true};
function state(){const s=D.emptyState();s.rewards=D.exampleRewards();s.box.items=[{rewardId:'r-play',weight:100}];return D.applyAction(s,{type:'stars/grant',stars:13,reason:'초기 지급'},ctx()).state;}
const act=(s,a,who=admin,now)=>D.applyAction(s,a,ctx(who,now)).state;
const setup=()=>act(state(),{type:'rule/save',rule});
const ruleGive={type:'praise/rule',ruleId:'cleanup',version:1};
for(const type of ['spend/shop','spend/draw','goal/set'])test(`보호자는 실제 소비/목표 명령 ${type}를 실행하지 못한다`,()=>{const s=state();assert.throws(()=>act(s,type==='spend/draw'?{type,quote:D.drawQuote(s)}:{type,rewardId:'r-play',version:1}),e=>e.code==='FORBIDDEN');});
test('아이는 정상 교환 가능하며 보호자는 아이 대신 사용 요청하지 않는다',()=>{const s=act(state(),{type:'spend/shop',rewardId:'r-play',version:1},child);assert.equal(s.balance,8);assert.throws(()=>act(s,{type:'coupon/request',id:s.inventory[0].id}),e=>e.code==='FORBIDDEN');});
test('보호자만 칭찬 규칙을 저장한다',()=>{assert.equal(D.rulesFor(setup()).find(r=>r.id==='cleanup').stars,2);for(const who of [child,giver])assert.throws(()=>act(state(),{type:'rule/save',rule},who),e=>e.code==='FORBIDDEN');});
test('과거 상태에도 기본 칭찬 규칙을 제공한다',()=>{assert.ok(D.rulesFor(state()).length>=3);assert.equal(state().schema,1);});
test('규칙 지급은 서버의 별과 설명만 쓰고 일일 제한을 가족 전체에 적용한다',()=>{const s=act(setup(),{...ruleGive,stars:999,reason:'조작'},giver);assert.equal(s.balance,15);assert.equal(s.praises.at(-1).ruleId,'cleanup');assert.equal(s.praises.at(-1).reason,rule.title);assert.throws(()=>act(s,ruleGive),e=>e.code==='DAILY_LIMIT');});
test('규칙은 한국 자정에 다시 지급 가능하다',()=>{const s=act(setup(),ruleGive,admin,'2026-10-29T14:59:59Z');assert.equal(act(s,ruleGive,giver,'2026-10-29T15:00:00Z').balance,17);});
test('규칙의 오래된 버전과 숨김 상태는 지급되지 않는다',()=>{let s=act(setup(),{type:'rule/save',rule:{...rule,stars:1,version:1}});assert.throws(()=>act(s,ruleGive),e=>e.code==='QUOTE_CHANGED');s=act(s,{type:'rule/save',rule:{...rule,active:false,version:2}});assert.throws(()=>act(s,{...ruleGive,version:3}),e=>e.code==='NOT_FOUND');});
for(const patch of [{stars:0},{stars:4},{stars:1.5},{dailyLimit:0},{dailyLimit:11},{title:' '},{active:'true'},{featured:1},{icon:'x'.repeat(13)}])test(`규칙 입력 검증 ${JSON.stringify(patch)}`,()=>assert.throws(()=>act(state(),{type:'rule/save',rule:{...rule,...patch}})));
test('규칙 수정은 버전을 요구하며 기존 규칙을 잃지 않는다',()=>{const s=setup();assert.throws(()=>act(s,{type:'rule/save',rule}),e=>e.code==='QUOTE_CHANGED');assert.ok(D.rulesFor(s).length>1);});
test('아이만 편지를 읽음 처리하고 별/쿠폰은 바뀌지 않는다',()=>{const s=act(state(),{type:'praise/give',stars:2,category:'노력',reason:'포기하지 않았구나!'});const id=s.praises[0].id;const next=act(s,{type:'letters/read',ids:[id,id]},child);assert.deepEqual(next.readPraiseIds,[id]);assert.equal(next.balance,s.balance);assert.deepEqual(next.ledger,s.ledger);assert.throws(()=>act(s,{type:'letters/read',ids:[id]},admin),e=>e.code==='FORBIDDEN');});
test('서로 다른 기기가 편지를 읽어도 읽음 ID를 합치며 알 수 없는 ID는 거부한다',()=>{let s=state();for(let i=0;i<2;i++)s=act(s,{type:'praise/give',stars:1,category:'노력',reason:'멋져요'+i});s=act(s,{type:'letters/read',ids:[s.praises[0].id]},child);s=act(s,{type:'letters/read',ids:[s.praises[1].id]},child);assert.equal(s.readPraiseIds.length,2);assert.equal(D.unreadPraises(s).length,0);assert.throws(()=>act(s,{type:'letters/read',ids:['unknown']},child));});
test('정정된 칭찬은 새 편지 개수에 포함되지 않는다',()=>{let s=act(state(),{type:'praise/give',stars:1,category:'노력',reason:'멋져요'});s=act(s,{type:'praise/reverse',id:s.praises[0].id,reason:'중복 입력'});assert.equal(D.unreadPraises(s).length,0);});
test('직접 지급 별은 사유를 남겨 한 번만 정정한다',()=>{const s=state(),id=s.ledger[0].id;const next=act(s,{type:'stars/reverse',id,reason:'입력 오류'});assert.equal(next.balance,0);assert.equal(next.ledger.length,2);assert.equal(next.ledger[0].delta,13);assert.equal(next.lifetimeEarned,0);assert.throws(()=>act(next,{type:'stars/reverse',id,reason:'재시도'}));});
test('이미 소비한 별을 강제로 회수하거나 아이가 정정할 수 없다',()=>{const s=state(),id=s.ledger[0].id;assert.throws(()=>act(s,{type:'stars/reverse',id,reason:'오류'},child));const used=act(s,{type:'spend/shop',rewardId:'r-play',version:1},child);assert.throws(()=>act(used,{type:'stars/reverse',id,reason:'오류'}));});
test('미사용 직접 선물만 회수하며 재고를 한 번 복원하고 기록을 보존한다',()=>{let s=state();s.rewards[0].stock=4;s=act(s,{type:'reward/grant',rewardId:'r-play',version:1,quantity:2,reason:'선물'});const id=s.inventory[0].id;s=act(s,{type:'coupon/revoke',id,reason:'중복 지급'});assert.equal(s.inventory[0].status,'revoked');assert.equal(s.inventory.length,2);assert.equal(s.rewards[0].stock,3);assert.equal(s.balance,13);assert.throws(()=>act(s,{type:'coupon/revoke',id,reason:'또 취소'}));});
test('구매 쿠폰과 사용 요청한 쿠폰은 직접 지급 회수 대상이 아니다',()=>{let s=act(state(),{type:'spend/shop',rewardId:'r-play',version:1},child);assert.throws(()=>act(s,{type:'coupon/revoke',id:s.inventory[0].id,reason:'회수'}));s=act(state(),{type:'reward/grant',rewardId:'r-play',version:1,reason:'선물'});s=act(s,{type:'coupon/request',id:s.inventory[0].id},child);assert.throws(()=>act(s,{type:'coupon/revoke',id:s.inventory[0].id,reason:'회수'}));});
test('규칙·읽음·회수 이후에도 원장 합계와 잔액이 일치한다',()=>{let s=act(setup(),ruleGive);s=act(s,{type:'letters/read',ids:[s.praises[0].id]},child);assert.equal(s.ledger.reduce((n,l)=>n+l.delta,0),s.balance);});
test('동일 요청번호 재전송은 규칙 칭찬을 한 번만 지급한다',async()=>{const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};const repo=new DemoRepository(storage,admin,setup);const a=await repo.perform(ruleGive,'same');const b=await repo.perform(ruleGive,'same');assert.equal(a.snapshot.state.balance,b.snapshot.state.balance);assert.equal(b.snapshot.state.praises.length,1);});
test('같은 프로필의 두 기기 읽음 요청은 서버 CAS 재시도 후 합쳐진다',async()=>{
 const {processCommand}=await import('../dist/supabase/functions/_shared/service.js');
 let s=act(act(state(),{type:'praise/give',stars:1,category:'노력',reason:'첫째'}),{type:'praise/give',stars:1,category:'노력',reason:'둘째'}),revision=0;const receipts=new Map();
 const store={async load(f,u){return {state:structuredClone(s),revision,actor:{id:u,name:'아이 기기',role:'child'}};},async receipt(f,id){return receipts.get(id)??null;},async commit(c){if(c.revision!==revision)return {conflict:true};s=c.state;revision++;receipts.set(c.requestId,{actorId:c.actorId,payload:c.action,result:c.result});return {state:s,revision,result:c.result};}};
 const familyId='a0000000-0000-4000-8000-000000000001';const ids=s.praises.map(p=>p.id);
 await Promise.all(ids.map((id,i)=>processCommand({familyId,requestId:crypto.randomUUID(),action:{type:'letters/read',ids:[id]}},'device-'+i,store,{now:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),random:()=>0})));
 assert.equal(s.readPraiseIds.length,2);assert.equal(D.unreadPraises(s).length,0);
});
test('무제한 재고에서 발급한 선물은 유한 재고로 변경되어도 회수 시 재고를 만들지 않는다',()=>{
 let s=act(state(),{type:'reward/grant',rewardId:'r-play',version:1,reason:'선물'});const id=s.inventory[0].id;
 s=act(s,{type:'reward/save',reward:{...s.rewards[0],stock:5}});
 s=act(s,{type:'coupon/revoke',id,reason:'입력 오류'});assert.equal(s.rewards[0].stock,5);
});
test('재고 차감 여부를 모르는 과거 쿠폰은 회수 시 수량을 임의 복원하지 않는다',()=>{
 let s=state();s.rewards[0].stock=4;s=act(s,{type:'reward/grant',rewardId:'r-play',version:1,reason:'선물'});
 const id=s.inventory[0].id;delete s.inventory[0].stockConsumed;
 s=act(s,{type:'coupon/revoke',id,reason:'이전 지급 오류'});assert.equal(s.rewards[0].stock,3);assert.equal(s.inventory[0].status,'revoked');
});
