import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoRepository,DEMO_KEY} from '../dist/src/backend.js';
import {demoState} from '../dist/supabase/functions/_shared/domain.js';
const actor={id:'dad',name:'아빠',role:'admin'};
const action={type:'praise/give',stars:2,category:'노력',reason:'한 번 더 도전했어요'};
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
const factory=()=>demoState('2026-10-26T09:00:00Z');
test('같은 요청을 다시 보내도 한 번만 적립된다',async()=>{const storage=memory();const db=new DemoRepository(storage,actor,factory);await db.load();await db.perform(action,'same');await db.perform(action,'same');assert.equal((await db.load()).state.balance,25);});
test('같은 ID에 다른 명령을 보내면 거절한다',async()=>{const db=new DemoRepository(memory(),actor,factory);await db.perform(action,'same');await assert.rejects(()=>db.perform({...action,stars:3},'same'),/다른/);});
test('서로 다른 가족이 같은 ID를 사용할 수 없다',async()=>{const storage=memory();const db=new DemoRepository(storage,actor,factory);await db.perform(action,'same');const mom=new DemoRepository(storage,{id:'mom',name:'엄마',role:'admin'},factory);await assert.rejects(()=>mom.perform(action,'same'),/다른/);});
test('동일 브라우저 동시 요청을 순차 처리한다',async()=>{const db=new DemoRepository(memory(),actor,factory);await Promise.all(Array.from({length:10},(_,i)=>db.perform(action,`key${i}`)));assert.equal((await db.load()).state.balance,43);});
test('새 객체로 읽어도 체험 기록이 보존된다',async()=>{const storage=memory();const db=new DemoRepository(storage,actor,factory);await db.perform(action,'x');const reloaded=new DemoRepository(storage,actor,factory);assert.equal((await reloaded.load()).state.balance,25);});
test('손상된 저장 데이터는 자동으로 덮어쓰지 않는다',async()=>{const storage=memory();storage.setItem(DEMO_KEY,'not-json');const db=new DemoRepository(storage,actor,factory);await assert.rejects(()=>db.load(),/손상/);assert.equal(storage.getItem(DEMO_KEY),'not-json');});
test('저장 공간 오류는 성공으로 표시하지 않는다',async()=>{const storage=memory();const db=new DemoRepository(storage,actor,factory);await db.load();storage.setItem=()=>{throw new Error('quota exceeded')};await assert.rejects(()=>db.perform(action,'x'),/저장/);assert.equal((await db.load()).state.balance,23);});
