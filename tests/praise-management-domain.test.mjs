import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/supabase/functions/_shared/domain.js';
import {processCommand} from '../dist/supabase/functions/_shared/service.js';
const admin={id:'parent',name:'아빠',role:'admin'},child={id:'kid',name:'연준',role:'child'},giver={id:'giver',name:'할머니',role:'giver'};
const now='2026-11-02T12:00:00Z';
const ctx=(actor=admin,time=now)=>({actor,now:time,newId:()=>crypto.randomUUID(),random:()=>0});
const act=(s,a,actor=admin,time=now)=>D.applyAction(s,a,ctx(actor,time)).state;
const start=()=>{const s=D.emptyState();s.rewards=D.exampleRewards();return s;};
const send=(s,praiseDate)=>act(s,{type:'praise/give',stars:2,category:'노력',reason:'끝까지 해냈어요',...(praiseDate===undefined?{}:{praiseDate})});
const version=s=>s.praiseRulesVersion??0;

test('delete hides a rule while keeping prior praises, ledger, rewards and learning unchanged',()=>{
 let s=start();const r=D.rulesFor(s)[0];s=act(s,{type:'praise/rule',ruleId:r.id,version:r.version});
 const before=structuredClone(s);s=act(s,{type:'rule/delete',id:r.id,version:r.version});
 assert.ok(!D.rulesFor(s).some(x=>x.id===r.id));assert.equal(s.praiseRules.find(x=>x.id===r.id).deletedAt,now);
 for(const k of ['balance','lifetimeEarned','praises','ledger','inventory','rewards','learning','learningLab'])assert.deepEqual(s[k],before[k]);
 assert.equal(s.praiseRulesVersion,1);
 assert.throws(()=>act(s,{type:'rule/save',rule:r}),e=>e.code==='NOT_FOUND');
 assert.throws(()=>act(s,{type:'praise/rule',ruleId:r.id,version:r.version}),e=>e.code==='NOT_FOUND');
 assert.deepEqual(before.praiseRules,undefined);
});
for(const role of [child,giver])test(`${role.role} cannot delete or reorder rules`,()=>{
 const s=start(),r=D.rulesFor(s)[0];
 assert.throws(()=>act(s,{type:'rule/delete',id:r.id,version:r.version},role),e=>e.code==='FORBIDDEN');
 assert.throws(()=>act(s,{type:'rule/reorder',ruleIds:D.rulesFor(s).map(r=>r.id).reverse(),version:0},role),e=>e.code==='FORBIDDEN');
});
test('delete requires current rule version and a known live rule',()=>{
 const s=start(),r=D.rulesFor(s)[0];
 for(const v of [undefined,-1,2,'1'])assert.throws(()=>act(s,{type:'rule/delete',id:r.id,version:v}));
 assert.throws(()=>act(s,{type:'rule/delete',id:'missing',version:1}),e=>e.code==='NOT_FOUND');
});
test('reorder persists exact new order including hidden rules without altering rules or awards',()=>{
 let s=start(),r=D.rulesFor(s)[0];s=act(s,{type:'rule/save',rule:{...r,active:false}});
 const before=structuredClone(s),ids=D.rulesFor(s).map(r=>r.id).reverse();
 s=act(s,{type:'rule/reorder',ruleIds:ids,version:version(s)});
 assert.deepEqual(D.rulesFor(s).map(r=>r.id),ids);
 for(const r of D.rulesFor(s))assert.deepEqual(r,D.rulesFor(before).find(x=>x.id===r.id));
 assert.equal(s.praiseRulesVersion,2);assert.deepEqual(s.ledger,before.ledger);
});
test('stale order, duplicate IDs, missing IDs and deleted IDs cannot overwrite list',()=>{
 let s=start();const ids=D.rulesFor(s).map(r=>r.id);
 for(const ruleIds of [[],ids.slice(1),[...ids,ids[0]],ids.map((x,i)=>i===0?'missing':x)])assert.throws(()=>act(s,{type:'rule/reorder',ruleIds,version:0}));
 s=act(s,{type:'rule/reorder',ruleIds:[...ids].reverse(),version:0});
 assert.throws(()=>act(s,{type:'rule/reorder',ruleIds:ids,version:0}),e=>e.code==='QUOTE_CHANGED');
 s=act(s,{type:'rule/delete',id:ids[0],version:1});
 assert.throws(()=>act(s,{type:'rule/reorder',ruleIds:ids,version:version(s)}));
 const live=D.rulesFor(s).map(r=>r.id);s=act(s,{type:'rule/reorder',ruleIds:live.reverse(),version:version(s)});
 assert.ok(s.praiseRules.find(r=>r.id===ids[0]).deletedAt);
 const r=D.rulesFor(s)[0];s=act(s,{type:'rule/save',rule:{...r,title:'수정 후'}});
 assert.ok(s.praiseRules.find(r=>r.id===ids[0]).deletedAt,'saving another rule must preserve tombstone');
});
test('deleted rules free a live-rule slot but cannot be re-added using old ID',()=>{
 let s=start();for(let i=0;D.rulesFor(s).length<30;i++)s=act(s,{type:'rule/save',rule:{id:'new-'+i,title:'새 행동',description:'',icon:'⭐',stars:1,dailyLimit:1,active:true,featured:false}});
 const r=D.rulesFor(s)[0];s=act(s,{type:'rule/delete',id:r.id,version:r.version});
 s=act(s,{type:'rule/save',rule:{...r,id:'replacement',version:undefined}});assert.equal(D.rulesFor(s).length,30);
 assert.throws(()=>act(s,{type:'rule/save',rule:{...r,version:undefined}}),e=>e.code==='NOT_FOUND');
});
test('backdated praise preserves event date and actual sending/ledger time',()=>{
 const s=send(start(),'2026-11-01');assert.equal(s.praises[0].praiseDate,'2026-11-01');assert.equal(s.praises[0].createdAt,now);assert.equal(s.ledger[0].createdAt,now);assert.equal(s.balance,2);
 assert.equal(D.praiseDay(s.praises[0]),'2026-11-01');
});
test('omitted date and legacy letters fall back to Korea date, including UTC midnight offset',()=>{
 const s=act(start(),{type:'praise/give',stars:1,category:'노력',reason:'멋져요'},admin,'2026-11-01T15:00:00Z');
 assert.equal(s.praises[0].praiseDate,'2026-11-02');delete s.praises[0].praiseDate;assert.equal(D.praiseDay(s.praises[0]),'2026-11-02');
});
for(const d of ['2026-11-03','2026-02-29','2026-04-31','2026-00-01','2026-13-01','2026-11-00','2026-11-32','2026-1-1','2026-11-01T00:00:00Z','',null,4,'0000-01-01','2026-11-01<script>'])test(`invalid/future praise date rejected: ${JSON.stringify(d)}`,()=>{
 assert.throws(()=>send(start(),d),e=>e.code==='INVALID_INPUT');const r=D.rulesFor(start())[0];assert.throws(()=>act(start(),{type:'praise/rule',ruleId:r.id,version:r.version,praiseDate:d}),e=>e.code==='INVALID_INPUT');
});
test('valid leap day and ordinary past date accepted',()=>{assert.equal(send(start(),'2024-02-29').praises[0].praiseDate,'2024-02-29');assert.equal(send(start(),'2026-10-31').balance,2);});
test('rule daily quota is shared per event date, not the send date',()=>{
 let s=start(),r=D.rulesFor(s)[0],a={type:'praise/rule',ruleId:r.id,version:r.version};
 s=act(s,{...a,praiseDate:'2026-11-01'});assert.equal(D.ruleGivesToday(s,r.id,now),0);
 s=act(s,{...a,praiseDate:'2026-11-02'},giver);assert.equal(D.ruleGivesToday(s,r.id,now),1);
 assert.equal(D.ruleGivesOn(s,r.id,'2026-11-01'),1);
 assert.throws(()=>act(s,{...a,praiseDate:'2026-11-01'},giver),e=>e.code==='DAILY_LIMIT');
 assert.throws(()=>act(s,a),e=>e.code==='DAILY_LIMIT');
 s=act(s,{type:'praise/reverse',id:s.praises[0].id,reason:'중복 입력'});assert.equal(D.ruleGivesOn(s,r.id,'2026-11-01'),0);
});
test('read archive keeps exactly read letters and never mutates state',()=>{
 let s=send(send(start(),'2026-11-01'),'2026-10-31');const before=structuredClone(s);
 assert.equal(D.readPraises(s).length,0);assert.deepEqual(s,before);
 s=act(s,{type:'letters/read',ids:[s.praises[0].id]},child);
 assert.deepEqual(D.readPraises(s).map(p=>p.id),[s.praises[0].id]);assert.deepEqual(D.unreadPraises(s).map(p=>p.id),[s.praises[1].id]);
 assert.deepEqual(s.ledger,before.ledger);
});
test('service serializes delete/reorder conflict and idempotent backdated sends',async()=>{
 let state=start(),revision=0;const receipts=new Map();
 const store={async load(){return {state:structuredClone(state),revision,actor:admin};},async receipt(f,id){return receipts.get(id)??null;},async commit(c){if(c.revision!==revision)return {conflict:true};state=c.state;revision++;receipts.set(c.requestId,{actorId:c.actorId,payload:c.action,result:c.result});return {state,revision,result:c.result};}};
 const familyId=crypto.randomUUID(),sources={now:()=>now,newId:()=>crypto.randomUUID(),random:()=>0};
 const command={familyId,requestId:crypto.randomUUID(),action:{type:'praise/give',stars:2,category:'노력',reason:'어제 했어요',praiseDate:'2026-11-01'}};
 await Promise.all([processCommand(command,admin.id,store,sources),processCommand(command,admin.id,store,sources)]);assert.equal(state.balance,2);assert.equal(state.praises.length,1);
 const r=D.rulesFor(state)[0],ids=D.rulesFor(state).map(r=>r.id).reverse();
 const result=await Promise.allSettled([
  processCommand({familyId,requestId:crypto.randomUUID(),action:{type:'rule/delete',id:r.id,version:r.version}},admin.id,store,sources),
  processCommand({familyId,requestId:crypto.randomUUID(),action:{type:'rule/reorder',ruleIds:ids,version:0}},admin.id,store,sources)]);
 assert.ok(result.some(x=>x.status==='fulfilled'));assert.ok(!D.rulesFor(state).some(x=>x.id===r.id));assert.equal(state.balance,2);
});
