import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
const path=new URL('../supabase/functions/_server/narration.js',import.meta.url);
async function api(){assert.ok(existsSync(path),'bounded AI narration provider must exist');return import(path.href);}
function wav(){const b=Buffer.alloc(48);b.write('RIFF');b.writeUInt32LE(40,4);b.write('WAVE',8);return b.toString('base64');}
test('AI narration produces bounded real audio and checks the matching transcript',async()=>{
 const {createNarrator}=await api();let calls=0;const speak=createNarrator({apiKey:'test-key'},async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');const b=JSON.parse(init.body);assert.equal(b.model,'gpt-audio-1.5');assert.deepEqual(b.modalities,['text','audio']);assert.equal(b.store,false);assert.equal(b.audio.format,'wav');return Response.json({choices:[{message:{audio:{data:wav(),transcript:'Cat.'}}}]});});
 const a=await speak('cat',new AbortController().signal);assert.equal(a.mime,'audio/wav');assert.equal(a.transcript,'Cat.');assert.equal(calls,1);
});
test('wrong narration text, oversized responses, malformed WAV and API errors fail closed without retries',async()=>{
 const {createNarrator}=await api();for(const item of [{data:wav(),transcript:'dog'},{data:'!!!!',transcript:'cat'},{data:Buffer.from('not-a-wav').toString('base64'),transcript:'cat'}]){
 let calls=0;const speak=createNarrator({apiKey:'secret'},async()=>{calls++;return Response.json({choices:[{message:{audio:item}}]});});await assert.rejects(()=>speak('cat',new AbortController().signal));assert.equal(calls,1);}
 let calls=0;await assert.rejects(()=>createNarrator({apiKey:'secret'},async()=>{calls++;return new Response('private secret',{status:403});})('cat',new AbortController().signal),e=>!e.message.includes('secret'));assert.equal(calls,1);
 await assert.rejects(()=>createNarrator({apiKey:'secret'},async()=>new Response('x'.repeat(3100000)))('cat',new AbortController().signal));
});
test('coach preserves text when voice fails and includes AI audio when generation succeeds',async()=>{
 await api();const {createOpenAICoach}=await import('../supabase/functions/_server/coach.js');const fetcher=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Do you like soccer?',modelPhrase:'',hint:''})}}]});
 const body={text:'Hi',topic:'play',history:[]},signal=new AbortController().signal;
 const r=await createOpenAICoach({apiKey:'test'},fetcher,async text=>({mime:'audio/wav',base64:wav(),transcript:text}))(body,signal);assert.ok(r.audio);assert.equal(r.audio.transcript,r.speech);
 const f=await createOpenAICoach({apiKey:'test'},fetcher,async()=>{throw Error('secret');})(body,signal);assert.equal(f.reply,'Do you like soccer?');assert.equal(f.audio,undefined);assert.equal(f.audioError,'AUDIO_UNAVAILABLE');assert.ok(!JSON.stringify(f).includes('secret'));
});
test('curriculum read requires guardian, approved item and fresh paid reservation',async()=>{
 await api();const {createCoachHandler}=await import('../supabase/functions/_server/coach.js');const ids=Array.from({length:3},(_,i)=>`00000000-0000-4000-8000-00000000000${i}`);let reserves=0,reads=0,role='admin';
 const handler=createCoachHandler({origin:'https://test.invalid',configured:true,verify:async()=>ids[0],member:async()=>({role}),readingText:(u,i)=>u==='01'&&i==='word-0'?'fat':null,reserve:async()=>{reserves++;return true;},respond:async()=>({}),narrate:async text=>{reads++;return {mime:'audio/wav',base64:wav(),transcript:text};}});
 const body={operation:'read',familyId:ids[0],sessionId:ids[1],turnId:ids[2],adultTest:true,unitId:'01',itemId:'word-0'};
 const req=b=>handler(new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify(b)}));
 assert.equal((await req(body)).status,200);assert.equal(reads,1);assert.equal(reserves,1);
 assert.equal((await req({...body,itemId:'arbitrary text'})).status,400);assert.equal(reserves,1);
 role='child';assert.equal((await req(body)).status,403);assert.equal(reads,1);
});
