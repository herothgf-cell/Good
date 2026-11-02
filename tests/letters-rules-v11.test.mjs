import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/supabase/functions/_shared/domain.js';
const admin={id:'dad',name:'아빠',role:'admin'},child={id:'kid',name:'아이',role:'child'},giver={id:'gran',name:'할머니',role:'giver'};
let n=0;const context=(actor=admin,now='2026-11-02T14:30:00Z')=>({actor,now,newId:()=>`v11-${++n}`,random:()=>0});
const apply=(s,a,who=admin,now)=>D.applyAction(s,a,context(who,now)).state;
const praise=(s,date,who=admin,now)=>apply(s,{type:'praise/give',stars:1,category:'노력',reason:'스스로 정리했어요',...(date===undefined?{}:{praiseDate:date})},who,now);
const version=s=>s.praiseRulesVersion??0;
const ids=s=>D.rulesFor(s).map(r=>r.id);
test('v11 삭제는 목록에서 제거하되 편지/원장/별을 보존하고 같은 ID를 재생성하지 못한다',()=>{
 let s=D.emptyState();const r=D.rulesFor(s)[0];s=apply(s,{type:'praise/rule',ruleId:r.id,version:r.version});
 const next=apply(s,{type:'rule/delete',ruleId:r.id,version:r.version,listVersion:version(s)});
 assert.equal(D.rulesFor(next).some(x=>x.id===r.id),false);assert.deepEqual(next.ledger,s.ledger);assert.deepEqual(next.praises,s.praises);assert.equal(next.balance,s.balance);
 assert.throws(()=>apply(next,{type:'rule/save',rule:r}),e=>e.code==='RULE_DELETED');
 assert.throws(()=>apply(next,{type:'praise/rule',ruleId:r.id,version:r.version}),e=>e.code==='NOT_FOUND');
});
test('v11 모든 행동을 삭제해도 기본 행동이 되살아나지 않는다',()=>{
 let s=D.emptyState();for(const r of D.rulesFor(s))s=apply(s,{type:'rule/delete',ruleId:r.id,version:r.version,listVersion:version(s)});assert.deepEqual(D.rulesFor(s),[]);
});
test('v11 순서 변경은 전체 순서를 저장하고 내용/기록을 바꾸지 않는다',()=>{
 const s=D.emptyState(),order=ids(s).reverse();const next=apply(s,{type:'rule/reorder',ruleIds:order,version:version(s)});
 assert.deepEqual(ids(next),order);assert.equal(version(next),1);assert.deepEqual(next.ledger,s.ledger);
});
for(const who of [child,giver])test(`v11 ${who.role}는 삭제/순서 변경 불가`,()=>{
 const s=D.emptyState(),r=D.rulesFor(s)[0];for(const a of [{type:'rule/delete',ruleId:r.id,version:r.version,listVersion:version(s)},{type:'rule/reorder',ruleIds:ids(s).reverse(),version:version(s)}])assert.throws(()=>apply(s,a,who),e=>e.code==='FORBIDDEN');
});
test('v11 오래된 순서 변경/삭제는 다른 보호자 편집을 덮어쓰지 않는다',()=>{
 const s=D.emptyState(),r=D.rulesFor(s)[0],next=apply(s,{type:'rule/save',rule:{...r,title:'새 이름'}});
 assert.throws(()=>apply(next,{type:'rule/reorder',ruleIds:ids(s).reverse(),version:version(s)}),e=>e.code==='QUOTE_CHANGED');
 assert.throws(()=>apply(next,{type:'rule/delete',ruleId:r.id,version:r.version,listVersion:version(s)}),e=>e.code==='QUOTE_CHANGED');
});
for(const bad of ['missing','duplicate','foreign'])test(`v11 잘못된 순서 ${bad} 거부`,()=>{
 const s=D.emptyState(),order=ids(s);if(bad==='missing')order.pop();if(bad==='duplicate')order[1]=order[0];if(bad==='foreign')order[1]='foreign';
 assert.throws(()=>apply(s,{type:'rule/reorder',ruleIds:order,version:version(s)}),e=>e.code==='INVALID_INPUT');
});
test('v11 과거 칭찬일과 실제 발송/별 지급 시각을 분리한다',()=>{
 const s=praise(D.emptyState(),'2026-11-01');assert.equal(s.praises[0].praiseDate,'2026-11-01');assert.equal(s.praises[0].createdAt,'2026-11-02T14:30:00Z');assert.equal(s.ledger[0].createdAt,s.praises[0].createdAt);assert.equal(D.unreadPraises(s).length,1);
});
test('v11 날짜 미입력/이전 기록은 한국 날짜를 사용한다',()=>{
 const s=praise(D.emptyState(),undefined,admin,'2026-11-01T15:01:00Z');assert.equal(s.praises[0].praiseDate,'2026-11-02');delete s.praises[0].praiseDate;assert.equal(D.praiseDateFor(s.praises[0]),'2026-11-02');
});
for(const date of ['2026-11-03','2026-02-29','2026-11-31','2026-1-01','bad',null,123,'0000-01-01'])test(`v11 잘못된 칭찬일 ${date} 거부`,()=>assert.throws(()=>praise(D.emptyState(),date),e=>e.code==='INVALID_INPUT'));
test('v11 유효한 윤년 날짜는 허용한다',()=>assert.equal(praise(D.emptyState(),'2024-02-29').praises[0].praiseDate,'2024-02-29'));
test('v11 행동 횟수는 실제 칭찬 날짜에 따라 제한한다',()=>{
 let s=D.emptyState();const r=D.rulesFor(s)[0],a={type:'praise/rule',ruleId:r.id,version:r.version};
 s=apply(s,{...a,praiseDate:'2026-11-02'});s=apply(s,{...a,praiseDate:'2026-11-01'});
 assert.equal(D.ruleGivesToday(s,r.id,'2026-11-02T14:00:00Z'),1);assert.equal(s.balance,2);
 assert.throws(()=>apply(s,{...a,praiseDate:'2026-11-01'},giver),e=>e.code==='DAILY_LIMIT');
});
test('v11 읽음과 새편지는 분리되고 정정된 편지는 아이 보관함에서 제외된다',()=>{
 let s=praise(praise(D.emptyState(),'2026-11-01'),'2026-11-02');s=apply(s,{type:'letters/read',ids:[s.praises[0].id]},child);
 assert.deepEqual(D.archivedPraises(s).map(p=>p.id),[s.praises[0].id]);assert.deepEqual(D.unreadPraises(s).map(p=>p.id),[s.praises[1].id]);
 s=apply(s,{type:'praise/reverse',id:s.praises[0].id,reason:'중복'});assert.equal(D.archivedPraises(s).length,0);
});
