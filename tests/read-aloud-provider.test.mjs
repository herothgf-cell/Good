import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {createReadAloud,wavFromPCM} from '../supabase/functions/_server/read-aloud.js';
class Socket extends EventEmitter{sent=[];closed=false;send(t){this.sent.push(JSON.parse(t));}close(){this.closed=true;}terminate(){this.closed=true;} }
function setup(){const socket=new Socket();let args;const synth=createReadAloud({apiKey:'private-test-key',model:'gpt-realtime-2.1-mini',socketFactory:(...a)=>{args=a;return socket;}});return {socket,synth,get args(){return args}};}
const emit=(s,e)=>s.emit('message',JSON.stringify(e));
test('server read-aloud requests one exact utterance and returns WAV, closes transport',async()=>{
 const f=setup(),task=f.synth('rain',new AbortController().signal);f.socket.emit('open');
 assert.equal(f.args[1].headers.Authorization,'Bearer private-test-key');assert.equal(f.socket.sent[0].session.output_modalities[0],'audio');
 emit(f.socket,{type:'session.updated'});assert.equal(f.socket.sent.at(-1).type,'response.create');
 emit(f.socket,{type:'response.output_audio.delta',delta:btoa('\x00\x00\x01\x00')});
 emit(f.socket,{type:'response.output_audio_transcript.done',transcript:'Rain.'});
 emit(f.socket,{type:'response.done',response:{status:'completed'}});
 const result=await task;assert.equal(result.mime,'audio/wav');assert.equal(atob(result.base64).slice(0,4),'RIFF');assert.ok(f.socket.closed);
});
test('different spoken transcript is rejected, not mislabeled as the requested word',async()=>{const f=setup(),p=f.synth('rain',new AbortController().signal);f.socket.emit('open');emit(f.socket,{type:'session.updated'});emit(f.socket,{type:'response.output_audio.delta',delta:btoa('\0\0')});emit(f.socket,{type:'response.output_audio_transcript.done',transcript:'train'});emit(f.socket,{type:'response.done',response:{status:'completed'}});await assert.rejects(p,/AUDIO_TEXT_MISMATCH/);assert.ok(f.socket.closed);});
test('cancelling closes server socket and never returns late audio',async()=>{const f=setup(),c=new AbortController(),p=f.synth('rain',c.signal);c.abort();await assert.rejects(p);assert.ok(f.socket.closed);});
test('provider errors are sanitized without raw speech or credentials',async()=>{const f=setup(),p=f.synth('rain',new AbortController().signal);emit(f.socket,{type:'error',error:{message:'private-test-key'}});await assert.rejects(p,/VOICE_UNAVAILABLE/);});
test('PCM header is mono 24kHz 16-bit and refuses odd-length bytes',()=>{const wav=wavFromPCM(new Uint8Array(4));assert.equal(new DataView(wav.buffer).getUint32(24,true),24000);assert.throws(()=>wavFromPCM(new Uint8Array(3)));});
