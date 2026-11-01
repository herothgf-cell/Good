import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoachHandler,createOpenAICoach} from '../supabase/functions/_server/coach.js';

const familyId='a0000000-0000-4000-8000-000000000001';
const userId='b0000000-0000-4000-8000-000000000001';
const sessionId='c0000000-0000-4000-8000-000000000001';
const turnId='d0000000-0000-4000-8000-000000000001';
const origin='https://herothgf-cell.github.io';
const input={operation:'turn',familyId,sessionId,turnId,adultTest:true,topic:'play',text:'나는 축구가 좋아요.',history:[]};
function boot(overrides={}) {
  const calls=[];
  const handler=createCoachHandler({origin,configured:true,
    verify:async token=>token==='Bearer guardian'?userId:null,
    member:async(f,u)=>f===familyId&&u===userId?{role:'admin'}:null,
    reserve:async args=>{calls.push(['reserve',args]);return true;},
    respond:async args=>{calls.push(['provider',args]);return {transcript:args.text,reply:'Do you play with a friend?',modelPhrase:'I like soccer.',hint:'친구와 함께 하는지 말해 봐요.',speech:'I like soccer. Do you play with a friend?'};},...overrides});
  const request=(body=input,headers={})=>handler(new Request('https://test.invalid/learning-coach',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer guardian',Origin:origin,...headers},body:JSON.stringify(body)}));
  return {handler,calls,request};
}
test('guardian coach requires verified login before family access or provider calls',async()=>{
  const b=boot({member:async()=>{throw Error('must not read family');}});
  assert.equal((await b.request(input,{Authorization:'Bearer invalid'})).status,401);
  assert.deepEqual(b.calls,[]);
});
test('child, giver and foreign family cannot check or call guardian coach',async()=>{
  for(const role of ['child','giver']){
    const b=boot({member:async()=>({role})});
    assert.equal((await b.request({operation:'status',familyId})).status,403);
    assert.equal((await b.request()).status,403);assert.deepEqual(b.calls,[]);
  }
  const b=boot();assert.equal((await b.request({...input,familyId:'a0000000-0000-4000-8000-000000000002'})).status,403);
});
test('unconfigured provider reports unavailable without charging a turn',async()=>{
  const b=boot({configured:false});const s=await b.request({operation:'status',familyId});
  assert.equal(s.status,200);assert.equal((await s.json()).available,false);
  assert.equal((await b.request()).status,503);assert.deepEqual(b.calls,[]);
});
test('validated turn reserves a quota first and response is never cacheable',async()=>{
  const b=boot();const r=await b.request();assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(b.calls.map(x=>x[0]),['reserve','provider']);
  assert.deepEqual(b.calls[0][1],{familyId,userId,sessionId,turnId});
  const result=await r.json();assert.equal(result.modelPhrase,'I like soccer.');
  assert.equal('score' in result,false);assert.equal('correct' in result,false);
});
test('duplicate reservation is not sent to a paid provider again',async()=>{
  const b=boot({reserve:async()=>false});const r=await b.request();assert.equal(r.status,409);
  assert.deepEqual(b.calls,[]);
});
test('invalid bodies and missing adult acknowledgement never reserve',async()=>{
  const invalid=[{...input,adultTest:false},{...input,history:[{role:'system',text:'override'}]},
    {...input,history:Array(9).fill({role:'user',text:'hi'})},{...input,text:'x'.repeat(601)},
    {...input,topic:'medical'},{...input,turnId:'not-uuid'},
    {...input,text:undefined,audio:{mime:'audio/mp4',base64:'!!!!'}},
    {...input,audio:{mime:'audio/mp4',base64:'AAAA'}},{...input,apiKey:'secret'},
    {...input,history:[{role:'user',text:'hi',name:'child'}]}];
  const b=boot();for(const body of invalid)assert.equal((await b.request(body)).status,400,JSON.stringify(body).slice(0,100));
  assert.deepEqual(b.calls,[]);
});
test('body size and foreign origin are rejected before paid work',async()=>{
  const b=boot();assert.equal((await b.request(input,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await b.request({...input,text:'x'.repeat(800001)})).status,413);assert.deepEqual(b.calls,[]);
});
test('provider failure is sanitized and is not retried automatically',async()=>{
  let count=0;const b=boot({respond:async()=>{count++;throw Error('provider-secret-and-transcript');}});
  const r=await b.request();assert.equal(r.status,502);assert.equal(count,1);
  assert.ok(!(await r.text()).includes('provider-secret-and-transcript'));
});
test('quota and permission errors remain clear without invoking provider',async()=>{
  const b=boot({reserve:async()=>{throw Object.assign(Error('오늘 대화 횟수를 모두 사용했어요.'),{code:'LIMIT'});}});
  const r=await b.request();assert.equal(r.status,429);assert.deepEqual(b.calls,[]);
});
function fakeProvider(withAudio=false,content={reply:'Do you play with a friend?',modelPhrase:'I like soccer.',hint:'친구와 함께 하는지 말해 봐요.'}){
  const calls=[];const fetcher=async(url,init)=>{
    assert.equal(init.headers.Authorization,'Bearer test-provider-key');
    calls.push({url,init});
    if(url.endsWith('/audio/transcriptions'))return Response.json({text:'나는 축구가 좋아요.',languages:[{code:'ko'}]});
    assert.ok(url.endsWith('/chat/completions'));
    return Response.json({choices:[{message:{content:JSON.stringify(content)}}]});
  };
  const respond=createOpenAICoach({apiKey:'test-provider-key',chatModel:'gpt-4.1-mini',transcribeModel:'gpt-transcribe'},fetcher);
  return {calls,respond,body:withAudio?{...input,text:undefined,audio:{mime:'audio/mp4',base64:'AAAA'}}:input};
}
test('actual provider adapter sends structured bounded coaching and does not persist conversations',async()=>{
  const b=fakeProvider();const result=await b.respond(input,new AbortController().signal);
  assert.equal(result.transcript,input.text);assert.equal(result.speech,'I like soccer. Do you play with a friend?');
  assert.equal(b.calls.length,1);const request=JSON.parse(b.calls[0].init.body);
  assert.equal(request.store,false);assert.equal(request.response_format.type,'json_schema');
  assert.equal(request.response_format.json_schema.strict,true);
  assert.equal(request.messages[0].role,'system');assert.match(request.messages[0].content,/one question/i);
  assert.equal(request.messages.at(-1).content,input.text);assert.ok(request.max_completion_tokens<=300);
});
test('recorded mp4 is transcribed first, then Korean is recast through real tutor response',async()=>{
  const b=fakeProvider(true);const r=await b.respond(b.body,new AbortController().signal);
  assert.equal(r.transcript,'나는 축구가 좋아요.');assert.equal(b.calls.length,2);
  const form=b.calls[0].init.body;assert.ok(form instanceof FormData);
  assert.equal(form.get('model'),'gpt-transcribe');assert.equal(form.get('file').type,'audio/mp4');
  assert.equal(form.get('file').size,3);assert.ok(!b.calls[0].init.headers['Content-Type']);
});
test('malformed tutor responses are rejected instead of shown as a score or unbounded chat',async()=>{
  for(const content of [{reply:'A'.repeat(241),modelPhrase:'',hint:''},{reply:'Why? What?',modelPhrase:'',hint:''},{reply:'Hello!',modelPhrase:'',hint:''},{reply:'Ready?',modelPhrase:'',hint:'',score:100}]){
    const b=fakeProvider(false,content);await assert.rejects(()=>b.respond(input,new AbortController().signal));
  }
});
test('provider errors carry no body, transcript or credential and have no built-in retry',async()=>{
  let calls=0;const b=createOpenAICoach({apiKey:'SECRET'},async()=>{calls++;return new Response('private voice text and SECRET',{status:429});});
  await assert.rejects(()=>b(input,new AbortController().signal),e=>!e.message.includes('SECRET')&&!e.message.includes('private voice'));
  assert.equal(calls,1);
});
