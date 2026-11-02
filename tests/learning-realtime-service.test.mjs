import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const path=new URL('../supabase/functions/_server/realtime.js',import.meta.url);
const F='a0000000-0000-4000-8000-000000000001',U='b0000000-0000-4000-8000-000000000001',S='c0000000-0000-4000-8000-000000000001';
const SDP='v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
async function api(){assert.ok(existsSync(path),'Realtime server module must exist');return import(path.href);}
async function fixture(overrides={}){
 const {createRealtimeHandler}=await api();let created=0,closed=0,reserved=0,attached=0;
 let record={id:S,actorId:U,callId:'rtc_test',state:'active',expiresAt:Date.now()+300000};
 const deps={origin:'https://herothgf-cell.github.io',configured:true,model:'gpt-realtime-2.1-mini',now:()=>Date.now(),
 verify:async token=>token==='Bearer good'?U:null,
 store:{member:async()=>({role:'admin'}),reserve:async()=>{reserved++;return {fresh:true,nonce:'nonce',expiresAt:Date.now()+300000}},attach:async()=>{attached++;return true},get:async()=>record,markClosed:async()=>{record={...record,state:'closed'};},heartbeat:async()=>record,stale:async()=>[],},
 provider:{create:async()=>{created++;return {sdp:SDP,callId:'rtc_test'}},hangup:async()=>{closed++;}},...overrides};
 const handle=createRealtimeHandler(deps);
 const request=(body,opts={})=>handle(new Request('https://edge.example',{method:'POST',headers:{origin:deps.origin,authorization:'Bearer good','content-type':'application/json',...opts.headers},body:JSON.stringify(body),signal:opts.signal}));
 return {deps,request,counts:()=>({created,closed,reserved,attached}),get record(){return record}};
}
const start={operation:'start',familyId:F,sessionId:S,adultTest:true,topic:'play',voice:'marin',sdp:SDP};
test('realtime authenticates and authorizes before issuing any paid call',async()=>{
 const b=await fixture();assert.equal((await b.request(start,{headers:{authorization:'Bearer bad'}})).status,401);
 b.deps.store.member=async()=>({role:'child'});assert.equal((await b.request(start)).status,403);
 b.deps.store.member=async()=>null;assert.equal((await b.request(start)).status,403);assert.equal(b.counts().created,0);
});
test('realtime rejects invalid origin, arbitrary model, missing adult marker and video SDP',async()=>{
 const b=await fixture();assert.equal((await b.request(start,{headers:{origin:'https://evil.example'}})).status,403);
 for(const patch of [{model:'other'},{adultTest:false},{sdp:'junk'},{sdp:SDP+'m=video 9 UDP/TLS/RTP/SAVPF 96\r\n'},{voice:'unknown'},{sessionId:'bad'}])assert.equal((await b.request({...start,...patch})).status,400);
 assert.equal(b.counts().created,0);
});
test('status has no paid request and unavailable configuration fails closed',async()=>{
 const b=await fixture({configured:false});const r=await b.request({operation:'status',familyId:F});assert.equal(r.status,200);assert.equal((await r.json()).available,false);
 assert.equal((await b.request(start)).status,503);assert.equal(b.counts().reserved,0);
});
test('a new reservation binds one provider call and returns only SDP and public limits',async()=>{
 const b=await fixture();const r=await b.request(start);assert.equal(r.status,200);const data=await r.json();assert.equal(data.sdp,SDP);assert.equal(data.maxSeconds,300);assert.equal(data.callId,undefined);assert.equal(data.nonce,undefined);assert.equal(b.counts().created,1);
});
test('duplicate reservation is not retried against provider',async()=>{
 const b=await fixture();b.deps.store.reserve=async()=>({fresh:false});assert.equal((await b.request(start)).status,409);assert.equal(b.counts().created,0);
});
test('stop during creation hangs up the late call rather than returning a usable session',async()=>{
 const b=await fixture();b.deps.store.attach=async()=>false;assert.equal((await b.request(start)).status,409);assert.equal(b.counts().closed,1);
});
test('aborted start cleans up a call returned after cancellation',async()=>{
 const b=await fixture();const abort=new AbortController();b.deps.provider.create=async()=>{abort.abort();return {sdp:SDP,callId:'rtc_test'}};
 assert.equal((await b.request(start,{signal:abort.signal})).status,409);assert.equal(b.counts().closed,1);
});
test('stop looks up stored call owner and cannot accept arbitrary call IDs',async()=>{
 const b=await fixture();assert.equal((await b.request({operation:'stop',familyId:F,sessionId:S,callId:'rtc_other'})).status,400);
 const original=b.deps.store.get;b.deps.store.get=async()=>({...b.record,actorId:'other'});assert.equal((await b.request({operation:'stop',familyId:F,sessionId:S})).status,403);
 b.deps.store.get=original;assert.equal((await b.request({operation:'stop',familyId:F,sessionId:S})).status,200);assert.equal(b.counts().closed,1);
});
test('expired heartbeat closes session and does not extend its lifetime',async()=>{
 const b=await fixture();b.deps.store.get=async()=>({...b.record,expiresAt:Date.now()-1});const r=await b.request({operation:'heartbeat',familyId:F,sessionId:S});assert.equal(r.status,200);assert.equal((await r.json()).active,false);assert.equal(b.counts().closed,1);
});
test('provider rejection is sanitized and never returns secret or upstream body',async()=>{
 const b=await fixture();b.deps.provider.create=async()=>{throw Error('sk-secret private audio')};const r=await b.request(start);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/sk-secret|private audio/);assert.equal(b.record.state,'closed');
});
test('unified API builds audio-only config, no key/transcription/child identity sent in SDP response',async()=>{
 const {createRealtimeProvider}=await api();let request;
 const p=createRealtimeProvider({apiKey:'server-secret',model:'gpt-realtime-2.1-mini'},async(url,init)=>{request={url,init};return new Response(SDP,{status:201,headers:{Location:'/v1/realtime/calls/rtc_test'}});});
 assert.equal((await p.create({sdp:SDP,topic:'play',voice:'marin',safetyId:'hash'},new AbortController().signal)).callId,'rtc_test');
 assert.equal(request.url,'https://api.openai.com/v1/realtime/calls');assert.equal(request.init.headers.Authorization,'Bearer server-secret');
 const s=JSON.parse(request.init.body.get('session'));assert.deepEqual(s.output_modalities,['audio']);assert.equal(s.audio.output.voice,'marin');assert.equal(s.audio.input.turn_detection.create_response,false);assert.equal(s.audio.input.turn_detection.interrupt_response,false);assert.equal(s.audio.input.transcription,undefined);assert.equal(s.tracing,null);assert.ok(s.max_output_tokens<=600);
});
test('disabling guardian voice also ends the next heartbeat',async()=>{const b=await fixture({configured:false});const r=await b.request({operation:'heartbeat',familyId:F,sessionId:S});assert.equal((await r.json()).active,false);assert.equal(b.counts().closed,1);});
