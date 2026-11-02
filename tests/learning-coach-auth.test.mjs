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
