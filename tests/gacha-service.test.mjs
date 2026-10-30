import test from 'node:test';
import assert from 'node:assert/strict';
import {processCommand} from '../dist/supabase/functions/_shared/service.js';
import {demoState,drawQuote,DomainError} from '../dist/supabase/functions/_shared/domain.js';

const family='a0000000-0000-4000-8000-000000000001';
const now='2026-10-29T03:00:00.000Z';
const roles={dad:'admin',child:'child',grandma:'giver'};
const sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>0.1};
const command=(action)=>({familyId:family,requestId:crypto.randomUUID(),action});
function store(){
  let state=demoState(now),revision=0;
  delete state.gachaEnabled;
  const receipts=new Map();
  return {
    commits:0,
    async load(familyId,userId){
      if(familyId!==family||!roles[userId])throw new DomainError('FORBIDDEN','가족 권한이 없어요.');
      return {state:structuredClone(state),revision,actor:{id:userId,name:userId,role:roles[userId]}};
    },
    async receipt(_familyId,requestId){return receipts.get(requestId)??null;},
    async commit(data){
      if(data.revision!==revision)return {conflict:true};
      state=structuredClone(data.state);revision++;this.commits++;
      receipts.set(data.requestId,{actorId:data.actorId,payload:data.action,result:data.result});
      return {state:structuredClone(state),revision,result:data.result};
    },
  };
}

test('서버는 보호자의 뽑기 공개 설정을 저장하고 같은 요청의 재전송은 한 번만 반영한다',async()=>{
  const db=store();const before=(await db.load(family,'dad')).state;
  const open=command({type:'gacha/set-enabled',enabled:true});
  const first=await processCommand(open,'dad',db,sources);
  const retried=await processCommand(open,'dad',db,sources);
  assert.equal(first.state.gachaEnabled,true);
  assert.equal(retried.state.box.version,2);
  assert.equal(db.commits,1);
  assert.deepEqual((await db.load(family,'child')).state,{...before,gachaEnabled:true,box:{...before.box,version:2}});
});

for(const userId of ['child','grandma'])test(`서버는 ${userId}의 위조 보호자 역할로 뽑기를 열지 않는다`,async()=>{
  const db=store();const before=await db.load(family,'dad');
  const forged={...command({type:'gacha/set-enabled',enabled:true,role:'admin'}),role:'admin',actor:{id:'dad',role:'admin'}};
  await assert.rejects(()=>processCommand(forged,userId,db,sources),cause=>cause.code==='FORBIDDEN');
  assert.equal(db.commits,0);
  assert.deepEqual(await db.load(family,'dad'),before);
});

test('서버는 보호자가 닫은 뒤 최신 상태를 읽고 이전 아이의 추첨 요청을 차감 없이 거절한다',async()=>{
  const db=store();
  const opened=await processCommand(command({type:'gacha/set-enabled',enabled:true}),'dad',db,sources);
  const draw=command({type:'spend/draw',quote:drawQuote(opened.state)});
  const closed=await processCommand(command({type:'gacha/set-enabled',enabled:false}),'dad',db,sources);
  let randomCalls=0;
  await assert.rejects(()=>processCommand(draw,'child',db,{...sources,random:()=>{randomCalls++;return 0.1;}}),cause=>cause.code==='GACHA_DISABLED');
  assert.equal(randomCalls,0);
  assert.equal(db.commits,2);
  assert.deepEqual((await db.load(family,'child')).state,closed.state);
});

test('서버 재시도 중 보호자가 뽑기를 닫으면 충돌한 추첨은 저장하지 않는다',async()=>{
  const db=store();
  const opened=await processCommand(command({type:'gacha/set-enabled',enabled:true}),'dad',db,sources);
  const originalCommit=db.commit.bind(db);
  let raced=false;
  db.commit=async data=>{
    if(data.action.type==='spend/draw'&&!raced){
      raced=true;
      await processCommand(command({type:'gacha/set-enabled',enabled:false}),'dad',db,sources);
      return {conflict:true};
    }
    return originalCommit(data);
  };
  await assert.rejects(()=>processCommand(command({type:'spend/draw',quote:drawQuote(opened.state)}),'child',db,sources),cause=>cause.code==='GACHA_DISABLED');
  const current=await db.load(family,'child');
  assert.equal(current.state.gachaEnabled,false);
  assert.equal(current.state.balance,23);
  assert.equal(current.state.inventory.length,1);
  assert.equal(current.state.draws.length,0);
  assert.equal(db.commits,2);
});
