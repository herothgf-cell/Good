import test from 'node:test';
import assert from 'node:assert/strict';
import {processCommand} from '../dist/supabase/functions/_shared/service.js';
import {demoState} from '../dist/supabase/functions/_shared/domain.js';
const user='u1',family='a0000000-0000-4000-8000-000000000001',id='b0000000-0000-4000-8000-000000000001';
const actor={id:user,name:'아빠',role:'admin'};
const command={familyId:family,requestId:id,action:{type:'praise/give',stars:2,category:'도전',reason:'끝까지 해 봤어요'}};
function store(){let state=demoState('2026-10-26T09:00:00Z'),revision=0;let receipts=new Map();return {
 conflicts:0,commits:0,active:true,
 async load(f,u){if(!this.active||f!==family||u!==user)throw new Error('권한');return {state:structuredClone(state),revision,actor};},
 async receipt(f,requestId){return receipts.get(requestId)??null;},
 async commit(data){if(this.conflicts){this.conflicts--;return {conflict:true};}const prev=receipts.get(data.requestId);if(prev)return {state,revision,result:prev.result};if(data.revision!==revision)return {conflict:true};state=data.state;revision++;this.commits++;receipts.set(data.requestId,{actorId:user,payload:data.action,result:data.result});return {state,revision,result:data.result};}
};}
const options={now:()=>new Date('2026-10-26T09:00:00Z').toISOString(),newId:()=>crypto.randomUUID(),random:()=>0.1};
test('클라우드 명령은 검증된 가족 멤버의 역할로 처리한다',async()=>{const db=store();const out=await processCommand(command,user,db,options);assert.equal(out.state.balance,25);assert.equal(db.commits,1);});
test('클라우드 응답 유실 후 재시도도 중복 적립하지 않는다',async()=>{const db=store();await processCommand(command,user,db,options);const out=await processCommand(command,user,db,options);assert.equal(out.state.balance,25);assert.equal(db.commits,1);});
test('버전 충돌은 최신 데이터를 읽어 재시도한다',async()=>{const db=store();db.conflicts=2;const out=await processCommand(command,user,db,options);assert.equal(out.state.balance,25);assert.equal(db.commits,1);});
test('계속 충돌하면 성공을 꾸며내지 않는다',async()=>{const db=store();db.conflicts=10;await assert.rejects(()=>processCommand(command,user,db,options),/다시/);assert.equal(db.commits,0);});
test('클라이언트의 위조 admin 필드는 사용하지 않는다',async()=>{const db=store();const load=db.load.bind(db);db.load=async(...args)=>({...await load(...args),actor:{id:user,name:'연준',role:'child'}});await assert.rejects(()=>processCommand({...command,role:'admin',actor:{role:'admin'}},user,db,options),/권한/);});
test('다른 가족 ID로 보낸 요청을 거절한다',async()=>{const db=store();await assert.rejects(()=>processCommand({...command,familyId:'c0000000-0000-4000-8000-000000000001'},user,db,options),/권한/);});
test('재시도에 다른 명령을 끼워 넣을 수 없다',async()=>{const db=store();await processCommand(command,user,db,options);await assert.rejects(()=>processCommand({...command,action:{...command.action,stars:3}},user,db,options),/다른/);});
test('잘못된 request ID는 처리하지 않는다',async()=>{const db=store();await assert.rejects(()=>processCommand({...command,requestId:'not-uuid'},user,db,options),/요청/);});
