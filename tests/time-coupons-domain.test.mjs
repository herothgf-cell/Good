import test from 'node:test';
import assert from 'node:assert/strict';
import * as domain from '../dist/supabase/functions/_shared/domain.js';
const {applyAction,emptyState,drawQuote}=domain;
const admin={id:'dad',name:'아빠',role:'admin'},child={id:'kid',name:'연준이',role:'child'},giver={id:'grandma',name:'할머니',role:'giver'};
let sequence=0;
const now='2026-10-30T06:00:00.000Z';
const context=(actor=admin)=>({actor,now,newId:()=>`time-${++sequence}`,random:()=>0});
const act=(s,action,actor=admin)=>applyAction(s,action,context(actor)).state;
function state(overrides={}){const s=emptyState();s.rewards=[{id:'tv',title:'TV 30분 이용권',description:'즐겁게 보아요',icon:'📺',cost:5,stock:5,active:true,shop:true,gacha:true,version:1,...overrides}];return s;}
const grant=(s=state(),extra={})=>act(s,{type:'reward/grant',rewardId:'tv',version:s.rewards[0].version,reason:'노력을 축하해요',...extra});
function legacy(status='available',extra={}){const s=state();s.inventory=[{id:'legacy',rewardId:'tv',title:'TV 30분 이용권',description:'이전 보상',icon:'📺',source:'gift',stockConsumed:true,status,createdAt:now,...extra}];return s;}
function lifecycle(s,type,extra={}){const c=s.inventory[0];return act(s,{type:`coupon/${type}`,id:c.id,usageVersion:c.usageVersion??0,...extra},['request','cancel'].includes(type)?child:admin);}
const code=(expected)=>error=>error.code===expected;

test('duration inference accepts one clear Korean duration and rejects ambiguous or non-whole titles',()=>{
  assert.equal(typeof domain.durationFromTitle,'function','duration inference helper must be exported');
  for(const [title,want] of [['TV 30분 이용권',30],['게임 1시간 이용권',60],['가족 시간 1시간 30분',90],['TV 1시간30분 이용권',90],['24시간 이용권',1440],['1440분 이용권',1440],['평범한 보상',null],['0분 이용권',null],['25시간',null],['1441분',null],['1.5시간',null],['30.5분',null],['-30분',null],['−30분',null],['- 30분',null],['30~60분',null],['30분 또는 60분',null],['30분 30분',null],['1시간 또는 30분',null],['1시간 60분',null],['1e3분',null],['0x30분',null],['1시간 반',null],['1시간 30초',null]])assert.equal(domain.durationFromTitle(title),want,title);
});
test('reward explicit configuration overrides title and null disables inference',()=>{
  assert.equal(typeof domain.rewardDuration,'function');
  assert.equal(domain.rewardDuration(state().rewards[0]),30);
  assert.equal(domain.rewardDuration(state({durationMinutes:45}).rewards[0]),45);
  assert.equal(domain.rewardDuration(state({durationMinutes:null}).rewards[0]),null);
});
test('legacy coupon time uses coupon title and never restores used or revoked time',()=>{
  assert.equal(typeof domain.couponTime,'function');
  for(const status of ['available','requested','approved','used','revoked']){const c=legacy(status).inventory[0];assert.deepEqual(domain.couponTime(c),{totalMinutes:30,remainingMinutes:['used','revoked'].includes(status)?0:30,requestedMinutes:['requested','approved'].includes(status)?30:null,usageVersion:0,usageHistory:[]});}
  assert.equal(domain.couponTime(legacy('available',{durationMinutes:null}).inventory[0]),null);
  assert.equal(domain.couponTime(legacy('available',{title:'보통 선물'}).inventory[0]),null);
});
test('partial bulk grant issues immutable actual totals and consumes one stock unit per coupon',()=>{
  const original=state(),s=grant(original,{minutes:10,quantity:2});
  assert.equal(s.inventory.length,2);assert.equal(new Set(s.inventory.map(c=>c.id)).size,2);
  for(const c of s.inventory){assert.equal(c.durationMinutes,10);assert.equal(c.remainingMinutes,10);assert.equal(c.usageVersion,0);assert.deepEqual(c.usageHistory,[]);}
  assert.equal(s.rewards[0].stock,3);assert.equal(s.balance,0);assert.equal(s.ledger.length,2);for(const entry of s.ledger)assert.match(entry.reason,/지급 10분/);assert.equal(original.inventory.length,0);
  const output=applyAction(original,{type:'reward/grant',rewardId:'tv',version:1,reason:'축하',minutes:10,quantity:2},context());assert.match(output.result.message,/10분씩/);assert.match(output.result.message,/총 20분/);
});
test('shop and draw issue full timed entitlement while ordinary issuance snapshots explicit null',()=>{
  let s=act(state(),{type:'stars/grant',stars:20,reason:'시작'});s.gachaEnabled=true;s.box.items=[{rewardId:'tv',weight:100}];
  const bought=act(s,{type:'spend/shop',rewardId:'tv',version:1},child);assert.equal(bought.inventory[0].durationMinutes,30);assert.equal(bought.inventory[0].remainingMinutes,30);
  const drawn=act(s,{type:'spend/draw',quote:drawQuote(s)},child);assert.equal(drawn.inventory[0].durationMinutes,30);
  const ordinary=grant(state({durationMinutes:null}));assert.equal(ordinary.inventory[0].durationMinutes,null);
});
test('10 + 5 + 15 completed minutes exhaust exactly one 30-minute coupon with auditable history',()=>{
  let s=grant();const issued=s.inventory[0].id;
  for(const [index,minutes] of [10,5,15].entries()){
    s=lifecycle(s,'request',{minutes});assert.equal(s.inventory[0].remainingMinutes,[30,20,15][index]);
    s=lifecycle(s,'approve');assert.equal(s.inventory[0].remainingMinutes,[30,20,15][index]);
    s=lifecycle(s,'use');assert.equal(s.inventory[0].remainingMinutes,[20,15,0][index]);assert.equal(s.inventory[0].status,index===2?'used':'available');assert.equal(s.inventory[0].requestedMinutes,undefined);assert.equal(s.inventory[0].usageVersion,(index+1)*3);
  }
  const c=s.inventory[0];assert.equal(c.id,issued);assert.equal(c.durationMinutes,30);assert.deepEqual(c.usageHistory.map(h=>h.minutes),[10,5,15]);assert.equal(new Set(c.usageHistory.map(h=>h.id)).size,3);assert.equal(c.usedAt,now);for(const h of c.usageHistory){assert.equal(h.actorId,'dad');assert.equal(h.actorName,'아빠');assert.equal(h.usedAt,now);}assert.equal(s.balance,0);assert.equal(s.rewards[0].stock,4);
});
test('cancellation and rejection clear pending time without spending and increment each version',()=>{
  let s=lifecycle(grant(),'request',{minutes:10});s=lifecycle(s,'cancel');assert.equal(s.inventory[0].remainingMinutes,30);assert.equal(s.inventory[0].usageVersion,2);assert.equal(s.inventory[0].requestedMinutes,undefined);
  s=lifecycle(s,'request',{minutes:5});s=lifecycle(s,'reject',{note:'조금 뒤에 사용해요'});assert.equal(s.inventory[0].remainingMinutes,30);assert.equal(s.inventory[0].requestedMinutes,undefined);assert.equal(s.inventory[0].usageVersion,4);assert.equal(s.inventory[0].note,'조금 뒤에 사용해요');assert.deepEqual(s.inventory[0].usageHistory,[]);
});
test('timed request requires valid explicit minutes no larger than remaining',()=>{
  const s=grant();for(const minutes of [undefined,null,0,-1,1.5,31,1441,NaN,Infinity,'10'])assert.throws(()=>lifecycle(s,'request',{minutes}),code('INVALID_INPUT'),String(minutes));
  let partial=lifecycle(lifecycle(lifecycle(s,'request',{minutes:25}),'approve'),'use');assert.throws(()=>lifecycle(partial,'request',{minutes:6}),code('INVALID_INPUT'));assert.equal(partial.inventory[0].remainingMinutes,5);
});
test('grant amount validation rejects excess, malformed, and ordinary minute overrides atomically',()=>{
  for(const minutes of [null,0,-1,1.5,31,1441,NaN,Infinity,'10']){const s=state();assert.throws(()=>grant(s,{minutes}),code('INVALID_INPUT'));assert.equal(s.inventory.length,0);assert.equal(s.rewards[0].stock,5);}
  assert.throws(()=>grant(state({durationMinutes:null}),{minutes:10}),code('INVALID_INPUT'));
  assert.throws(()=>grant(state(),{quantity:6,minutes:10}),code('SOLD_OUT'));
});
test('all timed transitions require captured version and reject a stale later request cycle',()=>{
  const s=grant();assert.throws(()=>act(s,{type:'coupon/request',id:s.inventory[0].id,minutes:10},child),e=>e.code==='QUOTE_CHANGED'&&/새로|최신/.test(e.message));
  let requested=lifecycle(s,'request',{minutes:10});
  for(const type of ['cancel','approve','reject'])for(const usageVersion of [undefined,0,-1,1.5,'1'])assert.throws(()=>act(requested,{type:`coupon/${type}`,id:requested.inventory[0].id,usageVersion},type==='cancel'?child:admin),code('QUOTE_CHANGED'));
  let approved=lifecycle(requested,'approve');for(const usageVersion of [undefined,1])assert.throws(()=>act(approved,{type:'coupon/use',id:approved.inventory[0].id,usageVersion}),code('QUOTE_CHANGED'));
  let cycle=lifecycle(approved,'use');cycle=lifecycle(cycle,'request',{minutes:5});assert.throws(()=>act(cycle,{type:'coupon/approve',id:cycle.inventory[0].id,usageVersion:1}),code('QUOTE_CHANGED'));assert.equal(cycle.inventory[0].requestedMinutes,5);
});
test('non-request actions reject minute replacement and use freezes the requested amount',()=>{
  const requested=lifecycle(grant(),'request',{minutes:10});for(const type of ['cancel','approve','reject'])assert.throws(()=>lifecycle(requested,type,{minutes:5}),code('INVALID_INPUT'));
  const approved=lifecycle(requested,'approve');assert.throws(()=>lifecycle(approved,'use',{minutes:20}),code('INVALID_INPUT'));const used=lifecycle(approved,'use');assert.equal(used.inventory[0].remainingMinutes,20);assert.equal(used.inventory[0].usageHistory[0].minutes,10);
});
test('timed coupon roles retain child request/cancel and guardian approve/reject/use/revoke restrictions',()=>{
  const s=grant();for(const actor of [admin,giver])assert.throws(()=>act(s,{type:'coupon/request',id:s.inventory[0].id,minutes:10,usageVersion:0},actor),code('FORBIDDEN'));
  assert.throws(()=>act(state(),{type:'reward/grant',rewardId:'tv',version:1,minutes:10,reason:'선물'},child),code('FORBIDDEN'));
  const requested=lifecycle(s,'request',{minutes:10});for(const type of ['approve','reject'])for(const actor of [child,giver])assert.throws(()=>act(requested,{type:`coupon/${type}`,id:requested.inventory[0].id,usageVersion:1},actor),code('FORBIDDEN'));
  const approved=lifecycle(requested,'approve');assert.throws(()=>act(approved,{type:'coupon/use',id:approved.inventory[0].id,usageVersion:2},child),code('FORBIDDEN'));
});
test('reward duration validation whitelists valid values and preserves omitted existing configuration',()=>{
  for(const durationMinutes of [0,-1,1.5,1441,'30',undefined,NaN,Infinity]){const s=state();assert.throws(()=>act(s,{type:'reward/save',reward:{...s.rewards[0],durationMinutes}}),code('INVALID_INPUT'));}
  for(const durationMinutes of [1,1440,null]){let s=state();s=act(s,{type:'reward/save',reward:{...s.rewards[0],durationMinutes,unknown:'discard'}});assert.equal(s.rewards[0].durationMinutes,durationMinutes);assert.equal(s.rewards[0].unknown,undefined);const oldClient={...s.rewards[0],title:'새 제목'};delete oldClient.durationMinutes;s=act(s,{type:'reward/save',reward:oldClient});assert.equal(s.rewards[0].durationMinutes,durationMinutes);}
});
test('reward edits cannot change issued duration, partial balance, history, or legacy title inference',()=>{
  let s=lifecycle(lifecycle(lifecycle(grant(),'request',{minutes:10}),'approve'),'use');const coupon=structuredClone(s.inventory[0]);s=act(s,{type:'reward/save',reward:{...s.rewards[0],durationMinutes:90,title:'TV 90분 이용권'}});assert.deepEqual(s.inventory[0],coupon);assert.equal(domain.couponTime(s.inventory[0]).remainingMinutes,20);
  const old=legacy();old.rewards[0].title='TV 90분 이용권';old.rewards[0].durationMinutes=90;assert.equal(domain.couponTime(old.inventory[0]).totalMinutes,30);
});
test('timed revoke requires version and completely untouched entitlement before restoring one stock unit',()=>{
  const s=grant(state(),{minutes:10});const action={type:'coupon/revoke',id:s.inventory[0].id,reason:'잘못 지급했어요'};
  assert.throws(()=>act(s,action),code('QUOTE_CHANGED'));assert.throws(()=>act(s,{...action,usageVersion:1}),code('QUOTE_CHANGED'));
  const revoked=act(s,{...action,usageVersion:0});assert.equal(revoked.rewards[0].stock,5);assert.equal(revoked.inventory[0].status,'revoked');assert.equal(revoked.inventory[0].remainingMinutes,0);assert.equal(revoked.inventory[0].usageVersion,1);assert.equal(domain.couponTime(revoked.inventory[0]).remainingMinutes,0);
  const partial=lifecycle(lifecycle(lifecycle(grant(),'request',{minutes:10}),'approve'),'use');assert.throws(()=>act(partial,{type:'coupon/revoke',id:partial.inventory[0].id,reason:'회수',usageVersion:3}),code('INVALID_STATE'));assert.equal(partial.rewards[0].stock,4);
  const forged=grant();forged.inventory[0].usageHistory=[{id:'used',minutes:1,usedAt:now,actorId:'dad',actorName:'아빠'}];assert.throws(()=>act(forged,{type:'coupon/revoke',id:forged.inventory[0].id,reason:'회수',usageVersion:0}),code('INVALID_STATE'));
});
test('ordinary coupons retain request approve use and revoke without timed versions',()=>{
  let s=grant(state({durationMinutes:null}));for(const [type,actor] of [['request',child],['approve',admin],['use',admin]])s=act(s,{type:`coupon/${type}`,id:s.inventory[0].id},actor);assert.equal(s.inventory[0].status,'used');assert.equal(s.inventory[0].usageHistory,undefined);
  const ordinary=grant(state({title:'놀이 선택권'}));const revoked=act(ordinary,{type:'coupon/revoke',id:ordinary.inventory[0].id,reason:'회수'});assert.equal(revoked.inventory[0].status,'revoked');assert.equal(revoked.rewards[0].stock,5);
});
test('legacy pending timed coupon can finish existing full request using captured zero version',()=>{
  let s=legacy('requested');s=lifecycle(s,'approve');assert.equal(s.inventory[0].requestedMinutes,30);assert.equal(s.inventory[0].usageVersion,1);s=lifecycle(s,'use');assert.equal(s.inventory[0].remainingMinutes,0);assert.equal(s.inventory[0].status,'used');assert.equal(s.inventory[0].usageHistory[0].minutes,30);
});
