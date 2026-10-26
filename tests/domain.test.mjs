import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,poolFor,drawQuote,dayKey} from '../dist/supabase/functions/_shared/domain.js';

const adult={id:'dad',name:'아빠',role:'admin'};
const child={id:'kid',name:'연준이',role:'child'};
const giver={id:'gran',name:'할머니',role:'giver'};
let seq=0;
const context=(actor=adult, extra={})=>({actor,now:'2026-10-26T09:00:00.000Z',newId:()=>`id-${++seq}`,random:()=>0.1,...extra});
function state(){return {schema:1,familyName:'우리 가족',childName:'연준이',balance:30,lifetimeEarned:30,goalRewardId:'r2',
 rewards:[{id:'r1',title:'놀이 선택권',description:'함께 놀아요',icon:'🎲',cost:5,stock:2,active:true,shop:true,gacha:true,version:1},{id:'r2',title:'영화 선택권',description:'가족과 영화',icon:'🎬',cost:20,stock:null,active:true,shop:true,gacha:true,version:1}],
 box:{title:'반짝 선물 상자',cost:5,dailyLimit:3,version:1,items:[{rewardId:'r1',weight:75},{rewardId:'r2',weight:25}]},praises:[],inventory:[],draws:[],ledger:[{id:'opening',kind:'praise',delta:30,balance:30,reason:'테스트 시작 잔액',actorId:'dad',actorName:'아빠',createdAt:'2026-10-25T09:00:00.000Z',refId:'opening'}]};}
const act=(s,a,actor=adult,extra={})=>applyAction(s,a,context(actor,extra));
const give={type:'praise/give',stars:2,category:'도전',reason:'어려운 문제에도 다시 도전했어요'};
const buy={type:'spend/shop',rewardId:'r1',version:1};
function coupon(s=state()){return act(s,buy,child).state;}

test('칭찬 지급이 별 잔액과 원장을 함께 증가시킨다',()=>{const s=state();const r=act(s,give,giver);assert.equal(r.state.balance,32);assert.equal(r.state.ledger.at(-1).delta,2);assert.equal(r.state.praises.at(-1).actorName,'할머니');assert.equal(s.balance,30);});
test('아이의 칭찬 지급은 금지한다',()=>assert.throws(()=>act(state(),give,child),/권한/));
for(const stars of [0,4,-1,1.2,NaN,Infinity,'2']) test(`칭찬 개수 ${String(stars)} 입력 검증`,()=>assert.throws(()=>act(state(),{...give,stars}),/1~3/));
test('빈 칭찬 사유를 거절한다',()=>assert.throws(()=>act(state(),{...give,reason:'   '}),/칭찬 내용/));
test('보상 교환 시 잔액·재고·쿠폰을 함께 변경한다',()=>{const r=act(state(),buy,child);assert.equal(r.state.balance,25);assert.equal(r.state.rewards[0].stock,1);assert.equal(r.state.inventory[0].title,'놀이 선택권');assert.equal(r.state.inventory[0].status,'available');});
test('칭찬 지급자는 별을 소비할 수 없다',()=>assert.throws(()=>act(state(),buy,giver),/권한/));
test('잔액 부족은 원본 상태를 변경하지 않는다',()=>{const s=state();s.balance=0;s.ledger=[];assert.throws(()=>act(s,buy,child),/별이 부족/);assert.equal(s.rewards[0].stock,2);assert.equal(s.inventory.length,0);});
test('재고 0이면 교환을 거절한다',()=>{const s=state();s.rewards[0].stock=0;assert.throws(()=>act(s,buy,child),/재고/);});
test('가격 설정이 변경되면 재확인을 요구한다',()=>{const s=state();s.rewards[0].version=2;assert.throws(()=>act(s,buy,child),/바뀌/);});
test('재고가 없는 보상은 제외하고 실제 확률을 재계산한다',()=>{const s=state();s.rewards[0].stock=0;const p=poolFor(s);assert.equal(p.length,1);assert.equal(p[0].probability,100);assert.equal(p[0].reward.id,'r2');});
test('뽑기는 최종 누적 확률 경계까지 정확하게 선택한다',()=>{const s=state();const a={type:'spend/draw',quote:drawQuote(s)};assert.equal(act(s,a,child,{random:()=>0.749999}).result.coupon.rewardId,'r1');assert.equal(act(s,a,child,{random:()=>0.75}).result.coupon.rewardId,'r2');assert.equal(act(s,a,child,{random:()=>0.999999999}).result.coupon.rewardId,'r2');});
test('뽑기는 확정된 쿠폰을 보관함에 기록한다',()=>{const s=state();const r=act(s,{type:'spend/draw',quote:drawQuote(s)},child);assert.equal(r.state.balance,25);assert.equal(r.state.inventory.length,1);assert.equal(r.state.draws.length,1);assert.equal(r.state.draws[0].odds[0].probability,75);});
test('표시 이후 뽑기 풀이 바뀌면 차감하지 않는다',()=>{const s=state();const quote=drawQuote(s);s.rewards[0].stock=0;assert.throws(()=>act(s,{type:'spend/draw',quote},child),/바뀌/);assert.equal(s.balance,30);});
test('빈 뽑기 풀은 꽝 대신 실행을 막는다',()=>{const s=state();s.rewards.forEach(r=>r.stock=0);assert.throws(()=>act(s,{type:'spend/draw',quote:drawQuote(s)},child),/보상이 없/);});
test('한국 날짜 기준 하루 제한을 적용한다',()=>{let s=state();s.rewards[0].stock=null;for(let i=0;i<3;i++)s=act(s,{type:'spend/draw',quote:drawQuote(s)},child).state;assert.throws(()=>act(s,{type:'spend/draw',quote:drawQuote(s)},child),/오늘/);assert.equal(act(s,{type:'spend/draw',quote:drawQuote(s)},child,{now:'2026-10-26T15:00:00.000Z'}).state.draws.length,4);});
test('한국 자정은 UTC 15시에 바뀐다',()=>{assert.equal(dayKey('2026-10-26T14:59:59.999Z'),'2026-10-26');assert.equal(dayKey('2026-10-26T15:00:00Z'),'2026-10-27');});
test('확률 합계는 100이어야 한다',()=>assert.throws(()=>act(state(),{type:'box/save',box:{title:'상자',cost:5,dailyLimit:3,items:[{rewardId:'r1',weight:80}]}}),/100/));
test('같은 보상을 확률표에 두 번 넣을 수 없다',()=>assert.throws(()=>act(state(),{type:'box/save',box:{title:'상자',cost:5,dailyLimit:3,items:[{rewardId:'r1',weight:50},{rewardId:'r1',weight:50}]}}),/중복/));
test('아이의 보상 편집을 금지한다',()=>assert.throws(()=>act(state(),{type:'reward/save',reward:state().rewards[0]},child),/권한/));
test('음수 가격과 재고를 거절한다',()=>{const s=state();assert.throws(()=>act(s,{type:'reward/save',reward:{...s.rewards[0],cost:-1}}),/가격/);assert.throws(()=>act(s,{type:'reward/save',reward:{...s.rewards[0],stock:-1}}),/재고/);});
test('쿠폰 발급 뒤 보상명을 바꿔도 쿠폰 스냅샷은 유지된다',()=>{let s=coupon();s=act(s,{type:'reward/save',reward:{...s.rewards[0],title:'바뀐 이름'}}).state;assert.equal(s.inventory[0].title,'놀이 선택권');assert.equal(s.rewards[0].version,3);});
test('사용 요청 → 승인 → 사용 완료 순서를 지킨다',()=>{let s=coupon();const id=s.inventory[0].id;s=act(s,{type:'coupon/request',id},child).state;assert.equal(s.inventory[0].status,'requested');s=act(s,{type:'coupon/approve',id}).state;assert.equal(s.inventory[0].status,'approved');s=act(s,{type:'coupon/use',id}).state;assert.equal(s.inventory[0].status,'used');assert.throws(()=>act(s,{type:'coupon/use',id}),/상태/);});
test('아이가 자기 보상 사용을 승인할 수 없다',()=>{let s=coupon();const id=s.inventory[0].id;s=act(s,{type:'coupon/request',id},child).state;assert.throws(()=>act(s,{type:'coupon/approve',id},child),/권한/);});
test('거절된 쿠폰은 별 재차감 없이 보관함으로 돌아온다',()=>{let s=coupon();const id=s.inventory[0].id;s=act(s,{type:'coupon/request',id},child).state;s=act(s,{type:'coupon/reject',id,note:'이번 주말에 사용해요'}).state;assert.equal(s.inventory[0].status,'available');assert.equal(s.balance,25);assert.equal(s.inventory[0].note,'이번 주말에 사용해요');});
test('오류 정정은 반대 원장을 추가하고 원본 칭찬을 보존한다',()=>{let s=act(state(),give).state;const id=s.praises[0].id;s=act(s,{type:'praise/reverse',id,reason:'같은 칭찬을 중복 입력'}).state;assert.equal(s.balance,30);assert.equal(s.praises[0].reversed,true);assert.equal(s.ledger.at(-1).kind,'reversal');assert.throws(()=>act(s,{type:'praise/reverse',id,reason:'중복 정정'}),/이미/);});
test('사용한 별을 정정해서 음수 잔액으로 만들 수 없다',()=>{let s=state();s.balance=0;s.ledger=[];s=act(s,{...give,stars:1}).state;s.rewards[0].cost=1;s=act(s,buy,child).state;assert.throws(()=>act(s,{type:'praise/reverse',id:s.praises[0].id,reason:'입력 오류'}),/이미 사용/);});
test('연속 혼합 거래 후 잔액은 원장 합계와 같다',()=>{let s=state();for(let i=0;i<40;i++){s=act(s,give,giver).state;if(i%10===0)s=act(s,{type:'spend/shop',rewardId:'r2',version:1},child).state;}assert.equal(s.balance,s.ledger.reduce((n,l)=>n+l.delta,0));assert.ok(s.balance>=0);});
test('알 수 없는 명령을 거절한다',()=>assert.throws(()=>act(state(),{type:'balance/cheat',amount:999}),/명령/));
test('재고 소진 이후 오래된 편집 화면이 재고를 복원하지 못한다',()=>{const old=state().rewards[0];const s=act(state(),buy,child).state;assert.throws(()=>act(s,{type:'reward/save',reward:{...old,title:'오래된 편집'}}),/바뀌/);});
