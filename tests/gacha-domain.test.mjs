import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/supabase/functions/_shared/domain.js';

const adult={id:'dad',name:'아빠',role:'admin'};
const child={id:'child',name:'연준이',role:'child'};
const giver={id:'grandma',name:'할머니',role:'giver'};
const now='2026-10-29T03:00:00.000Z';
let sequence=0;
const context=(actor=adult,extra={})=>({actor,now,newId:()=>`gacha-${++sequence}`,random:()=>0.1,...extra});
const act=(state,action,actor=adult,extra={})=>D.applyAction(state,action,context(actor,extra));
const error=code=>cause=>cause.code===code;
function familyState(){
  let state=D.emptyState('우리 가족','연준이');
  state.rewards=D.exampleRewards();
  state.rewards[0].stock=3;
  state.box={title:'우리 가족 선물',cost:5,dailyLimit:3,version:7,items:[{rewardId:'r-play',weight:75},{rewardId:'r-book',weight:25}]};
  state=act(state,{type:'stars/grant',stars:30,reason:'시작하는 별'}).state;
  state=act(state,{type:'praise/give',stars:2,category:'도전',reason:'다시 도전했어요'},giver).state;
  state=act(state,{type:'spend/shop',rewardId:'r-play',version:1},child).state;
  state.goalRewardId='r-book';
  state.readPraiseIds=[state.praises[0].id];
  state.praiseRules=D.defaultPraiseRules();
  return state;
}

test('새 가족과 체험 가족은 뽑기를 기본으로 숨긴다',()=>{
  for(const state of [D.emptyState(),D.demoState(now)]){
    assert.equal(state.gachaEnabled,false);
    assert.equal(D.isGachaEnabled(state),false);
  }
});

for(const [label,setting] of [['legacy',undefined],['false',false],['null',null],['string','true'],['number',1]]){
  test(`뽑기 공개 설정 ${label}에서는 차감·발급·추첨 없이 거절한다`,()=>{
    const state=familyState();
    if(setting===undefined)delete state.gachaEnabled;else state.gachaEnabled=setting;
    const before=structuredClone(state);
    let randomCalls=0,idCalls=0;
    assert.throws(()=>act(state,{type:'spend/draw',quote:D.drawQuote(state)},child,{
      random:()=>{randomCalls++;return 0.1;},newId:()=>{idCalls++;return 'unexpected-id';},
    }),error('GACHA_DISABLED'));
    assert.equal(D.isGachaEnabled(state),false);
    assert.equal(randomCalls,0);
    assert.equal(idCalls,0);
    assert.deepEqual(state,before);
  });
}

test('숨긴 뽑기는 빈 보상 목록이나 오래된 요청보다 공개 설정을 먼저 확인한다',()=>{
  const state=familyState();state.gachaEnabled=false;state.box.items=[];
  assert.throws(()=>act(state,{type:'spend/draw',quote:'old-quote'},child),error('GACHA_DISABLED'));
});

for(const actor of [child,giver])for(const enabled of [true,false]){
  test(`${actor.role}는 뽑기 공개 설정을 ${enabled}로 바꿀 수 없다`,()=>{
    const state=familyState();state.gachaEnabled=!enabled;
    const before=structuredClone(state);
    assert.throws(()=>act(state,{type:'gacha/set-enabled',enabled,role:'admin'},actor),error('FORBIDDEN'));
    assert.deepEqual(state,before);
  });
}

for(const enabled of [undefined,null,0,1,'true','false',{},[]]){
  test(`보호자의 뽑기 공개 설정은 boolean만 허용한다: ${JSON.stringify(enabled)}`,()=>{
    const state=familyState();const before=structuredClone(state);
    assert.throws(()=>act(state,{type:'gacha/set-enabled',enabled}),error('INVALID_INPUT'));
    assert.deepEqual(state,before);
  });
}

test('보호자가 뽑기를 열면 기존 가족 기록과 상자 설정을 유지하고 아이가 뽑을 수 있다',()=>{
  const state=familyState();delete state.gachaEnabled;
  const before=structuredClone(state);
  const opened=act(state,{type:'gacha/set-enabled',enabled:true});
  assert.equal(D.isGachaEnabled(opened.state),true);
  assert.deepEqual(opened.state,{...before,gachaEnabled:true,box:{...before.box,version:8}});
  assert.deepEqual(state,before);
  assert.match(opened.result.message,/[가-힣]/);
  const drawn=act(opened.state,{type:'spend/draw',quote:D.drawQuote(opened.state)},child);
  assert.equal(drawn.state.balance,22);
  assert.equal(drawn.state.inventory.length,2);
  assert.equal(drawn.state.draws.length,1);
  assert.equal(drawn.result.coupon.source,'draw');
});

test('뽑기를 닫아도 별·칭찬·기존 쿠폰·뽑기 이력과 상자 설정을 보존한다',()=>{
  let state=familyState();state.gachaEnabled=true;
  state=act(state,{type:'spend/draw',quote:D.drawQuote(state)},child).state;
  const before=structuredClone(state);
  const closed=act(state,{type:'gacha/set-enabled',enabled:false});
  assert.deepEqual(closed.state,{...before,gachaEnabled:false,box:{...before.box,version:8}});
  assert.deepEqual(state,before);
  assert.match(closed.result.message,/[가-힣]/);
  assert.throws(()=>act(closed.state,{type:'spend/draw',quote:D.drawQuote(closed.state)},child),error('GACHA_DISABLED'));
  const requested=act(closed.state,{type:'coupon/request',id:closed.state.inventory.at(-1).id},child);
  assert.equal(requested.state.inventory.at(-1).status,'requested');
  assert.equal(requested.state.balance,22);
});

for(const [before,enabled,version] of [[undefined,false,7],[false,false,7],[true,true,7],[undefined,true,8],[false,true,8],[true,false,8]]){
  test(`실제 공개 상태 ${before} → ${enabled}의 상자 버전은 ${version}이다`,()=>{
    const state=familyState();
    if(before===undefined)delete state.gachaEnabled;else state.gachaEnabled=before;
    const next=act(state,{type:'gacha/set-enabled',enabled}).state;
    assert.equal(next.gachaEnabled,enabled);
    assert.equal(next.box.version,version);
    assert.deepEqual(next.box.items,state.box.items);
  });
}

test('뽑기를 닫았다 다시 열면 이전 공개 때 받은 추첨 요청은 무효가 된다',()=>{
  let state=familyState();state.gachaEnabled=true;
  const previousQuote=D.drawQuote(state);
  state=act(state,{type:'gacha/set-enabled',enabled:false}).state;
  state=act(state,{type:'gacha/set-enabled',enabled:true}).state;
  assert.equal(state.box.version,9);
  const before=structuredClone(state);let randomCalls=0;
  assert.throws(()=>act(state,{type:'spend/draw',quote:previousQuote},child,{random:()=>{randomCalls++;return 0.1;}}),error('QUOTE_CHANGED'));
  assert.equal(randomCalls,0);
  assert.deepEqual(state,before);
  assert.equal(act(state,{type:'spend/draw',quote:D.drawQuote(state)},child).state.balance,22);
});

for(const enabled of [undefined,false,true]){
  test(`상자 설정 저장은 뽑기 공개 상태 ${enabled}를 변경하지 않는다`,()=>{
    const state=familyState();
    if(enabled===undefined)delete state.gachaEnabled;else state.gachaEnabled=enabled;
    const saved=act(state,{type:'box/save',box:{title:'새 상자',cost:7,dailyLimit:2,items:[{rewardId:'r-book',weight:100}]},gachaEnabled:true}).state;
    assert.equal(saved.gachaEnabled,enabled);
    assert.equal(saved.box.cost,7);
    if(enabled!==true)assert.throws(()=>act(saved,{type:'spend/draw',quote:D.drawQuote(saved)},child),error('GACHA_DISABLED'));
    else assert.equal(act(saved,{type:'spend/draw',quote:D.drawQuote(saved)},child).state.balance,20);
  });
}
