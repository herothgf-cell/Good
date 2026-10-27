import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,emptyState,exampleRewards} from '../dist/supabase/functions/_shared/domain.js';
import {renderApp} from '../dist/src/ui.js';
import {grantRewardForm} from '../dist/src/guardian.js';
const admin={id:'dad',name:'아빠',role:'admin'},child={id:'child',name:'연준이',role:'child'};
const ctx=a=>({actor:a,now:'2026-10-27T03:00:00.000Z',newId:()=>crypto.randomUUID(),random:()=>0.2});
function state(){const s=emptyState();s.rewards=exampleRewards();s.rewards[0].stock=5;return s;}
test('보호자 3장 지급은 3장의 별도 쿠폰과 재고 감소를 남긴다',()=>{const s=state();const x=applyAction(s,{type:'reward/grant',rewardId:'r-play',version:1,reason:'축하',quantity:3},ctx(admin)).state;assert.equal(x.inventory.length,3);assert.equal(new Set(x.inventory.map(x=>x.id)).size,3);assert.equal(x.rewards[0].stock,2);assert.equal(x.balance,0);});
test('재고 부족은 전체 지급을 거부한다',()=>{const s=state();assert.throws(()=>applyAction(s,{type:'reward/grant',rewardId:'r-play',version:1,reason:'축하',quantity:6},ctx(admin)));assert.equal(s.inventory.length,0);assert.equal(s.rewards[0].stock,5);});
test('아이는 보상을 일괄 지급할 수 없다',()=>assert.throws(()=>applyAction(state(),{type:'reward/grant',rewardId:'r-play',version:1,reason:'축하',quantity:2},ctx(child))));
test('비정상 수량은 거부한다',()=>{for(const quantity of [0,-1,1.5,21,'2'])assert.throws(()=>applyAction(state(),{type:'reward/grant',rewardId:'r-play',version:1,reason:'축하',quantity},ctx(admin)));});
test('기존 수량 없는 요청은 1장으로 호환된다',()=>assert.equal(applyAction(state(),{type:'reward/grant',rewardId:'r-play',version:1,reason:'축하'},ctx(admin)).state.inventory.length,1));
test('지급 폼은 수량과 재고를 표시한다',()=>{const html=grantRewardForm(state().rewards[0],'연준이');assert.match(html,/name="quantity"/);assert.match(html,/max="5"/);});
test('보호자와 아이의 보관함 이름을 구분한다',()=>{const s=state();const view=(me)=>({snapshot:{state:s,me,members:[admin,child],familyId:'f',revision:0},mode:'cloud',screen:'inventory',busy:false,pending:false,syncError:'',lastSync:'',inventoryFilter:'all'});assert.match(renderApp(view(admin)),/연준이 보관함/);assert.match(renderApp(view(child)),/내 보관함/);});
