import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthClient} from '../dist/src/auth.js';

function setup(){
  const session={access_token:'private-user-token',refresh_token:'private-refresh',expires_at:Date.now()/1000+3600,user:{id:'parent'}};
  const writes=[];const auth=new AuthClient({supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'sb_publishable_test'},
    {getItem:()=>JSON.stringify(session),setItem:(...args)=>writes.push(args),removeItem:(...args)=>writes.push(args)});
  return {auth,writes};
}
test('ephemeral coach sends user auth and abort signal without persisting speech or retrying a failure',async()=>{
  const original=globalThis.fetch;const {auth,writes}=setup();const controller=new AbortController();let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(url,'https://example.supabase.co/functions/v1/learning-coach');
    assert.equal(init.headers.Authorization,'Bearer private-user-token');assert.equal(init.headers.apikey,'sb_publishable_test');
    assert.equal(init.cache,'no-store');assert.ok(init.signal);assert.equal(JSON.parse(init.body).text,'temporary guardian sentence');
    return Response.json({code:'COACH_UNAVAILABLE',error:'잠시 후 새 문장으로 테스트해 주세요.'},{status:502});
  };
  try{await assert.rejects(()=>auth.apiTransient('/functions/v1/learning-coach',{text:'temporary guardian sentence'},controller.signal),e=>e.status===502);assert.equal(calls,1);assert.deepEqual(writes,[]);}
  finally{globalThis.fetch=original;}
});
test('a coach request cancelled before auth finishes never reaches the network',async()=>{
  const original=globalThis.fetch;const {auth}=setup();const controller=new AbortController();controller.abort();
  globalThis.fetch=async()=>{assert.fail('cancelled voice must not leave the device');};
  try{await assert.rejects(()=>auth.apiTransient('/functions/v1/learning-coach',{text:'cancelled'},controller.signal),{name:'AbortError'});}
  finally{globalThis.fetch=original;}
});
test('AI audio response larger than text limit is accepted only on the audio coach route',async()=>{
 const original=globalThis.fetch;const {auth,writes}=setup();let calls=0;const data={audio:{base64:'A'.repeat(30000)}};
 globalThis.fetch=async()=>{calls++;return Response.json(data);};
 try{assert.deepEqual(await auth.apiTransient('/functions/v1/learning-coach',{},new AbortController().signal),data);await assert.rejects(()=>auth.apiTransient('/functions/v1/learning-realtime',{},new AbortController().signal));assert.equal(calls,2);assert.deepEqual(writes,[]);}finally{globalThis.fetch=original;}
});
test('oversized streamed audio is cancelled without retries or durable storage',async()=>{
 const original=globalThis.fetch;const {auth,writes}=setup();let calls=0,cancelled=false;
 globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(500000));},cancel(){cancelled=true;}}));};
 try{await assert.rejects(()=>auth.apiTransient('/functions/v1/learning-coach',{},new AbortController().signal),e=>e.status===502);assert.equal(calls,1);assert.equal(cancelled,true);assert.deepEqual(writes,[]);}finally{globalThis.fetch=original;}
});
