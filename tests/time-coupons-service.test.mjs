import test from 'node:test';
import assert from 'node:assert/strict';
import * as domain from '../dist/supabase/functions/_shared/domain.js';
import {canonical,processCommand} from '../dist/supabase/functions/_shared/service.js';
import {DEMO_KEY,DemoRepository} from '../dist/src/backend.js';

const family='a0000000-0000-4000-8000-000000000001';
const now='2026-10-30T03:00:00.000Z';
const actors={
  dad:{id:'dad',name:'아빠',role:'admin'},
  mom:{id:'mom',name:'엄마',role:'admin'},
  child:{id:'child',name:'연준이',role:'child'},
  grandma:{id:'grandma',name:'할머니',role:'giver'},
};
const sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>0};
const command=(action,requestId=crypto.randomUUID())=>({familyId:family,requestId,action});
const hasCode=code=>error=>error instanceof domain.DomainError&&error.code===code;

function initialState(){
  const state=domain.emptyState();
  state.rewards=[{
    id:'r-tv',title:'TV 30분 이용권',description:'보고 싶은 프로그램을 골라요.',icon:'📺',
    durationMinutes:30,cost:5,stock:4,active:true,shop:true,gacha:true,version:1,
  }];
  return state;
}

// Only persistence is simulated. Every action and retry uses the real service/domain.
// Receipt lookup precedes CAS here, matching family_commit's transaction ordering.
function store(seed=initialState()){
  let state=structuredClone(seed),revision=0;
  const receipts=new Map();
  return {
    commits:0,conflicts:0,
    async load(familyId,userId){
      if(familyId!==family||!actors[userId])throw new domain.DomainError('FORBIDDEN','가족 권한이 없어요.');
      return {state:structuredClone(state),revision,actor:{...actors[userId]}};
    },
    async receipt(familyId,requestId){
      assert.equal(familyId,family);
      return structuredClone(receipts.get(requestId)??null);
    },
    async commit(data){
      assert.equal(data.familyId,family);
      assert.equal(data.actorRole,actors[data.actorId]?.role);
      const previous=receipts.get(data.requestId);
      if(previous){
        if(previous.actorId!==data.actorId||canonical(previous.payload)!==canonical(data.action)){
          throw new domain.DomainError('IDEMPOTENCY','같은 요청 번호로 다른 작업을 보낼 수 없어요.');
        }
        return {state:structuredClone(state),revision,result:structuredClone(previous.result)};
      }
      if(data.revision!==revision){this.conflicts++;return {conflict:true};}
      state=structuredClone(data.state);revision++;this.commits++;
      receipts.set(data.requestId,structuredClone({actorId:data.actorId,payload:data.action,result:data.result}));
      return {state:structuredClone(state),revision,result:structuredClone(data.result)};
    },
  };
}

function coupon(state,id=state.inventory[0]?.id){
  const value=state.inventory.find(item=>item.id===id);
  assert.ok(value,'발급된 쿠폰이 있어야 한다');
  return value;
}

function time(state,id){
  assert.equal(typeof domain.couponTime,'function','공유 도메인은 시간 쿠폰 조회를 제공해야 한다');
  const value=domain.couponTime(coupon(state,id));
  assert.ok(value,'시간 쿠폰으로 보존되어야 한다');
  return value;
}

const grantAction=(minutes=30,quantity=1)=>({type:'reward/grant',rewardId:'r-tv',version:1,reason:'약속을 잘 지켰어요.',minutes,quantity});
const send=(db,action,userId='dad')=>processCommand(command(action),userId,db,sources);

async function grant(db,minutes=30){
  const result=await send(db,grantAction(minutes));
  return coupon(result.state).id;
}

async function step(db,id,type,extra={}){
  const userId=['coupon/request','coupon/cancel'].includes(type)?'child':'dad';
  const current=await db.load(family,userId);
  return send(db,{type,id,usageVersion:coupon(current.state,id).usageVersion??0,...extra},userId);
}

async function approve(db,id,minutes){
  await step(db,id,'coupon/request',{minutes});
  return step(db,id,'coupon/approve');
}

test('서버는 부분 시간 선물의 응답 유실 재시도에 쿠폰과 재고를 한 번만 반영한다',async()=>{
  const db=store();
  const operation=command(grantAction(10,2));
  const first=await processCommand(operation,'dad',db,sources);
  const retried=await processCommand(operation,'dad',db,sources);
  assert.equal(retried.state.inventory.length,2);
  assert.equal(new Set(retried.state.inventory.map(item=>item.id)).size,2);
  for(const item of retried.state.inventory){
    assert.equal(item.durationMinutes,10);
    assert.equal(time(retried.state,item.id).remainingMinutes,10);
    assert.deepEqual(time(retried.state,item.id).usageHistory,[]);
  }
  assert.equal(retried.state.rewards[0].stock,2);
  assert.equal(retried.state.balance,0);
  assert.equal(retried.state.ledger.length,2);
  assert.equal(db.commits,1);
  assert.equal(retried.revision,1);
  assert.deepEqual(retried,first);
});

test('동시에 도착한 같은 시간 지급 요청은 같은 쿠폰 영수증을 받는다',async()=>{
  const db=store();
  const operation=command(grantAction(10));
  const results=await Promise.all([
    processCommand(operation,'dad',db,sources),
    processCommand(operation,'dad',db,sources),
  ]);
  assert.equal(results[0].result.coupon.id,results[1].result.coupon.id);
  const current=await db.load(family,'dad');
  assert.equal(current.state.inventory.length,1);
  assert.equal(coupon(current.state).durationMinutes,10);
  assert.equal(current.state.rewards[0].stock,3);
  assert.equal(db.commits,1);
});

test('같은 지급 요청 번호의 분 수를 바꾸면 기존 영수증과 충돌하고 상태는 그대로다',async()=>{
  const db=store();
  const operation=command(grantAction(10));
  await processCommand(operation,'dad',db,sources);
  const before=await db.load(family,'dad');
  await assert.rejects(
    ()=>processCommand({...operation,action:{...operation.action,minutes:20}},'dad',db,sources),
    hasCode('IDEMPOTENCY'),
  );
  assert.deepEqual(await db.load(family,'dad'),before);
  assert.equal(db.commits,1);
});

test('사용 요청 영수증은 분 수나 usageVersion을 바꾼 같은 요청 번호를 거절한다',async()=>{
  const db=store();const id=await grant(db);
  const operation=command({type:'coupon/request',id,minutes:10,usageVersion:0});
  await processCommand(operation,'child',db,sources);
  const before=await db.load(family,'child');
  for(const changed of [{minutes:5},{usageVersion:1}]){
    await assert.rejects(
      ()=>processCommand({...operation,action:{...operation.action,...changed}},'child',db,sources),
      hasCode('IDEMPOTENCY'),
    );
  }
  assert.equal(time(before.state,id).requestedMinutes,10);
  assert.equal(time(before.state,id).remainingMinutes,30);
  assert.deepEqual(await db.load(family,'child'),before);
  assert.equal(db.commits,2);
});

test('완료 영수증 재시도는 이후 요청이 승인된 상태에서도 시간을 다시 차감하지 않는다',async()=>{
  const db=store();const id=await grant(db);
  const approved=await approve(db,id,10);
  const operation=command({type:'coupon/use',id,usageVersion:coupon(approved.state,id).usageVersion});
  const completed=await processCommand(operation,'dad',db,sources);
  const immediateRetry=await processCommand(operation,'dad',db,sources);
  assert.deepEqual(immediateRetry,completed);
  assert.equal(time(completed.state,id).remainingMinutes,20);
  assert.equal(time(completed.state,id).usageHistory.length,1);
  await approve(db,id,5);
  const before=await db.load(family,'dad');const commits=db.commits;
  const delayedRetry=await processCommand(operation,'dad',db,sources);
  assert.equal(coupon(delayedRetry.state,id).status,'approved');
  assert.equal(time(delayedRetry.state,id).requestedMinutes,5);
  assert.equal(time(delayedRetry.state,id).remainingMinutes,20);
  assert.equal(time(delayedRetry.state,id).usageHistory.length,1);
  assert.deepEqual(delayedRetry.result,completed.result);
  assert.deepEqual(await db.load(family,'dad'),before);
  assert.equal(db.commits,commits);
});

test('완료 요청 번호에 새 usageVersion을 넣어 재사용하면 영수증 충돌로 거절한다',async()=>{
  const db=store();const id=await grant(db);
  const approved=await approve(db,id,10);
  const operation=command({type:'coupon/use',id,usageVersion:coupon(approved.state,id).usageVersion});
  await processCommand(operation,'dad',db,sources);
  const before=await db.load(family,'dad');
  await assert.rejects(
    ()=>processCommand({...operation,action:{...operation.action,usageVersion:operation.action.usageVersion+1}},'dad',db,sources),
    hasCode('IDEMPOTENCY'),
  );
  assert.deepEqual(await db.load(family,'dad'),before);
  assert.equal(time(before.state,id).remainingMinutes,20);
  assert.equal(time(before.state,id).usageHistory.length,1);
});

test('아이 기기의 동시 시간 요청은 CAS 뒤 한 건만 승인 대기로 남는다',async()=>{
  const db=store();const id=await grant(db);
  const before=await db.load(family,'child');
  const results=await Promise.allSettled([10,20].map(minutes=>send(db,{type:'coupon/request',id,minutes,usageVersion:0},'child')));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected').length,1);
  const current=await db.load(family,'child');
  assert.equal(coupon(current.state,id).status,'requested');
  assert.ok([10,20].includes(time(current.state,id).requestedMinutes));
  assert.equal(time(current.state,id).remainingMinutes,30);
  assert.equal(time(current.state,id).usageVersion,1);
  assert.deepEqual(time(current.state,id).usageHistory,[]);
  assert.deepEqual(current.state.ledger,before.state.ledger);
  assert.deepEqual(current.state.rewards,before.state.rewards);
  assert.equal(db.commits,2);
  assert.ok(db.conflicts>=1,'두 요청은 같은 상태를 읽고 실제 CAS 충돌을 거쳐야 한다');
});

test('두 보호자의 동시 완료는 승인된 시간을 한 번만 차감한다',async()=>{
  const db=store();const id=await grant(db);
  const approved=await approve(db,id,10);
  const action={type:'coupon/use',id,usageVersion:coupon(approved.state,id).usageVersion};
  const results=await Promise.allSettled(['dad','mom'].map(userId=>send(db,action,userId)));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected').length,1);
  const current=await db.load(family,'dad');const details=time(current.state,id);
  assert.equal(coupon(current.state,id).status,'available');
  assert.equal(details.remainingMinutes,20);
  assert.equal(details.usageVersion,3);
  assert.equal(details.usageHistory.length,1);
  assert.equal(details.usageHistory[0].minutes,10);
  assert.ok(['dad','mom'].includes(details.usageHistory[0].actorId));
  assert.deepEqual(current.state.ledger,approved.state.ledger);
  assert.deepEqual(current.state.rewards,approved.state.rewards);
  assert.equal(db.commits,4);
  assert.ok(db.conflicts>=1,'경합한 완료는 실제 CAS 충돌을 거쳐야 한다');
});

test('같은 완료 요청의 동시 재전송은 둘 다 성공해도 사용 기록을 한 번만 남긴다',async()=>{
  const db=store();const id=await grant(db);
  const approved=await approve(db,id,10);
  const operation=command({type:'coupon/use',id,usageVersion:coupon(approved.state,id).usageVersion});
  const results=await Promise.all([
    processCommand(operation,'dad',db,sources),
    processCommand(operation,'dad',db,sources),
  ]);
  assert.deepEqual(results[0],results[1]);
  const current=await db.load(family,'dad');
  assert.equal(time(current.state,id).remainingMinutes,20);
  assert.equal(time(current.state,id).usageHistory.length,1);
  assert.equal(db.commits,4);
});

for(const type of ['coupon/approve','coupon/cancel','coupon/reject']){
  test(`이전 회차의 ${type}은 같은 승인 대기 상태가 다시 와도 새 요청을 바꾸지 않는다`,async()=>{
    const db=store();const id=await grant(db);
    const firstRequest=await step(db,id,'coupon/request',{minutes:10});
    const stale={type,id,usageVersion:coupon(firstRequest.state,id).usageVersion,...(type==='coupon/reject'?{note:'다음에 사용해요.'}:{})};
    await step(db,id,'coupon/approve');
    await step(db,id,'coupon/use');
    await step(db,id,'coupon/request',{minutes:5});
    const userId=type==='coupon/cancel'?'child':'dad';
    const before=await db.load(family,userId);const commits=db.commits;
    assert.equal(coupon(before.state,id).status,'requested');
    await assert.rejects(()=>send(db,stale,userId),error=>error instanceof domain.DomainError);
    assert.deepEqual(await db.load(family,userId),before);
    assert.equal(time(before.state,id).requestedMinutes,5);
    assert.equal(time(before.state,id).remainingMinutes,20);
    assert.equal(db.commits,commits);
  });
}

test('이전 회차의 완료 명령은 다음 회차가 승인되어도 새 시간을 차감하지 않는다',async()=>{
  const db=store();const id=await grant(db);
  const firstApproval=await approve(db,id,10);
  const stale={type:'coupon/use',id,usageVersion:coupon(firstApproval.state,id).usageVersion};
  await step(db,id,'coupon/use');
  await approve(db,id,5);
  const before=await db.load(family,'dad');const commits=db.commits;
  assert.equal(coupon(before.state,id).status,'approved');
  await assert.rejects(()=>send(db,stale),error=>error instanceof domain.DomainError);
  assert.deepEqual(await db.load(family,'dad'),before);
  assert.equal(time(before.state,id).remainingMinutes,20);
  assert.equal(time(before.state,id).usageHistory.length,1);
  assert.equal(db.commits,commits);
});

test('CAS 재시도 중 사용 가능 상태로 돌아와도 처음 본 사용 버전으로 요청할 수 없다',async()=>{
  const db=store();const id=await grant(db);
  const delayed=command({type:'coupon/request',id,minutes:5,usageVersion:0});
  const commit=db.commit.bind(db);let raced=false;
  db.commit=async data=>{
    if(data.requestId===delayed.requestId&&!raced){
      raced=true;
      await approve(db,id,10);
      await step(db,id,'coupon/use');
    }
    return commit(data);
  };
  await assert.rejects(()=>processCommand(delayed,'child',db,sources),error=>error instanceof domain.DomainError);
  const current=await db.load(family,'child');const details=time(current.state,id);
  assert.equal(coupon(current.state,id).status,'available');
  assert.equal(details.remainingMinutes,20);
  assert.equal(details.requestedMinutes,null);
  assert.equal(details.usageVersion,3);
  assert.equal(details.usageHistory.length,1);
  assert.equal(db.commits,4);
  assert.ok(db.conflicts>=1,'완료된 사용 회차 이후 CAS 충돌을 실제로 재시도해야 한다');
});

function memory(){
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}

test('체험 저장소를 새로 열어도 남은 시간과 요청·완료 이력 및 완료 영수증이 유지된다',async()=>{
  const storage=memory();
  const dad=new DemoRepository(storage,actors.dad,initialState);
  const child=new DemoRepository(storage,actors.child,initialState);
  const issued=await dad.perform(grantAction(),'demo-gift');
  const id=coupon(issued.snapshot.state).id;
  await child.perform({type:'coupon/request',id,minutes:10,usageVersion:0},'demo-request-10');
  await dad.perform({type:'coupon/approve',id,usageVersion:1},'demo-approve-10');
  const completion={type:'coupon/use',id,usageVersion:2};
  const firstUse=await dad.perform(completion,'demo-use-10');
  const noReset=()=>{throw new Error('저장된 가족 상태를 새 상태로 대체하면 안 된다');};
  const reopenedDad=new DemoRepository(storage,actors.dad,noReset);
  const reopenedChild=new DemoRepository(storage,actors.child,noReset);
  const reloaded=await reopenedChild.load();const details=time(reloaded.state,id);
  assert.equal(details.remainingMinutes,20);
  assert.equal(details.usageVersion,3);
  assert.equal(details.usageHistory.length,1);
  assert.equal(details.usageHistory[0].minutes,10);
  assert.equal(details.usageHistory[0].actorId,'dad');
  assert.equal(details.usageHistory[0].actorName,'아빠');
  assert.ok(Number.isFinite(Date.parse(details.usageHistory[0].usedAt)));
  assert.deepEqual(coupon(reloaded.state,id),JSON.parse(JSON.stringify(coupon(firstUse.snapshot.state,id))));
  const retried=await reopenedDad.perform(completion,'demo-use-10');
  assert.deepEqual(retried.result,firstUse.result);
  assert.deepEqual(coupon(retried.snapshot.state,id),coupon(reloaded.state,id));
  await reopenedChild.perform({type:'coupon/request',id,minutes:5,usageVersion:3},'demo-request-5');
  const pending=await new DemoRepository(storage,actors.dad,noReset).load();
  assert.equal(coupon(pending.state,id).status,'requested');
  assert.equal(time(pending.state,id).requestedMinutes,5);
  assert.equal(time(pending.state,id).remainingMinutes,20);
  await reopenedDad.perform({type:'coupon/approve',id,usageVersion:4},'demo-approve-5');
  await reopenedDad.perform({type:'coupon/use',id,usageVersion:5},'demo-use-5');
  const final=await new DemoRepository(storage,actors.child,noReset).load();
  assert.equal(final.state.inventory.length,1);
  assert.equal(time(final.state,id).remainingMinutes,15);
  assert.equal(time(final.state,id).usageVersion,6);
  assert.deepEqual(time(final.state,id).usageHistory.map(entry=>entry.minutes),[10,5]);
  assert.equal(new Set(time(final.state,id).usageHistory.map(entry=>entry.id)).size,2);
  assert.equal(final.state.balance,0);
  assert.equal(final.state.rewards[0].stock,3);
  assert.equal(final.state.ledger.length,1);
  const persisted=JSON.parse(storage.getItem(DEMO_KEY));
  assert.deepEqual(persisted.state.inventory,final.state.inventory);
  assert.deepEqual(persisted.receipts['demo-use-10'].result,firstUse.result);
});
