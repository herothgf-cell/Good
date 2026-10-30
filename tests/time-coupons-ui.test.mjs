import test from 'node:test';
import assert from 'node:assert/strict';
import {renderApp, rewardForm} from '../dist/src/ui.js';
import {grantRewardForm} from '../dist/src/guardian.js';
import {emptyState} from '../dist/supabase/functions/_shared/domain.js';

const admin={id:'dad',name:'아빠',role:'admin'};
const child={id:'child',name:'연준이',role:'child'};
const reward={id:'tv',title:'TV 30분 이용권',description:'보고 싶은 방송을 함께 정해요.',icon:'📺',cost:5,stock:2,active:true,shop:true,gacha:true,version:1};
const coupon=(extra={})=>({id:'coupon-1',rewardId:'tv',title:reward.title,description:reward.description,icon:reward.icon,source:'gift',status:'available',createdAt:'2026-10-30T06:00:00Z',...extra});
function inventory(coupons,me=child){
  const state=emptyState();state.rewards=[reward];state.inventory=coupons;
  return renderApp({snapshot:{state,me,members:[admin,child],familyId:'family',revision:1},screen:'inventory',mode:'demo',busy:false,pending:false,syncError:'',lastSync:'',inventoryFilter:'all'});
}
const button=(html,action)=>html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0]??'';

test('legacy time reward grant exposes per-coupon minutes and preserves quantity/stock units',()=>{
  const html=grantRewardForm(reward,'연준이');
  assert.match(html,/<input[^>]*name="minutes"[^>]*min="1"[^>]*max="30"[^>]*value="30"/);
  assert.match(html,/<input[^>]*name="quantity"[^>]*max="2"/);
  assert.match(html,/한 장당/);
  assert.match(html,/재고 1개/);
});

test('ordinary gift grant has no minute field including explicit ordinary override',()=>{
  for(const r of [{...reward,title:'메뉴 선택권'},{...reward,durationMinutes:null}]){
    const html=grantRewardForm(r,'연준이');
    assert.doesNotMatch(html,/name="minutes"/);
    assert.match(html,/name="quantity"/);
  }
});

test('reward editor exposes inferred or explicit duration and ordinary opt-out',()=>{
  const inferred=rewardForm(reward);
  assert.match(inferred,/<input[^>]*name="timeCoupon"[^>]*checked/);
  assert.match(inferred,/<input[^>]*name="durationMinutes"[^>]*value="30"/);
  const explicit=rewardForm({...reward,title:'함께 게임하기',durationMinutes:45});
  assert.match(explicit,/<input[^>]*name="durationMinutes"[^>]*value="45"/);
  const ordinary=rewardForm({...reward,durationMinutes:null});
  assert.doesNotMatch(ordinary,/<input[^>]*name="timeCoupon"[^>]*checked/);
});

test('time coupon shows actual received and remaining minutes and escaped usage history',()=>{
  const html=inventory([coupon({durationMinutes:30,remainingMinutes:20,usageVersion:3,usageHistory:[{id:'u1',minutes:10,usedAt:'2026-10-30T07:00:00Z',actorId:'dad',actorName:'<b>아빠</b>'}]})]);
  assert.match(html,/남은[^<]*|남은/);
  assert.match(html,/20분/);
  assert.match(html,/받은 30분/);
  assert.match(html,/10분 사용/);
  assert.match(html,/&lt;b&gt;아빠&lt;\/b&gt;/);
  assert.doesNotMatch(html,/<b>아빠<\/b>/);
  assert.match(button(html,'coupon/request'),/data-usage-version="3"/);
});

test('partial gift with a thirty-minute template title displays its ten-minute entitlement',()=>{
  const html=inventory([coupon({durationMinutes:10,remainingMinutes:10,usageVersion:0})]);
  assert.match(html,/받은 10분/);
  assert.match(html,/남은 10분/);
  assert.doesNotMatch(html,/받은 30분/);
});

test('approval and completion controls capture the visible time version and selected minutes',()=>{
  const requested=inventory([coupon({status:'requested',durationMinutes:30,remainingMinutes:20,requestedMinutes:5,usageVersion:4})],admin);
  assert.match(requested,/5분 사용 요청/);
  assert.match(button(requested,'coupon/approve'),/data-usage-version="4"/);
  assert.match(button(requested,'reject-coupon'),/data-usage-version="4"/);
  const approved=inventory([coupon({status:'approved',durationMinutes:30,remainingMinutes:20,requestedMinutes:5,usageVersion:5})],admin);
  assert.match(approved,/5분/);
  assert.match(button(approved,'complete-coupon'),/data-usage-version="5"/);
});

test('guardian cannot revoke a partially consumed gift but can revoke an untouched timed gift',()=>{
  assert.doesNotMatch(inventory([coupon({durationMinutes:30,remainingMinutes:20,usageVersion:3})],admin),/data-action="revoke-coupon"/);
  const untouched=inventory([coupon({durationMinutes:10,remainingMinutes:10,usageVersion:0})],admin);
  assert.match(button(untouched,'revoke-coupon'),/data-usage-version="0"/);
});

test('time inventory groups show the sum of remaining minutes across unequal coupons',()=>{
  const html=inventory([coupon({id:'a',durationMinutes:10,remainingMinutes:10}),coupon({id:'b',durationMinutes:30,remainingMinutes:20})]);
  const summary=html.match(/<summary>[\s\S]*?<\/summary>/)?.[0]??'';
  assert.match(summary,/2장/);
  assert.match(summary,/남은 30분/);
});

test('legacy terminal time coupons display no reusable balance or request control',()=>{
  for(const status of ['used','revoked']){
    const html=inventory([coupon({status})]);
    assert.match(html,/남은 0분/);
    assert.doesNotMatch(html,/data-action="coupon\/request"/);
  }
});
