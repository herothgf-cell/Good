import test from 'node:test';import assert from 'node:assert/strict';
import {CloudSpeech} from '../dist/src/cloud-speech.js';import {LearningCoach} from '../dist/src/learning-coach.js';
const identity={familyId:'f',actorId:'p',role:'admin',mode:'cloud'};
async function fixture(run){
 const old=globalThis.Audio;const clips=[];globalThis.Audio=class{onended=null;onerror=null;src='';pause(){}remove(){}removeAttribute(){}setAttribute(){}async play(){if(this.blocked)throw Error('blocked');queueMicrotask(()=>this.onended?.());}constructor(){clips.push(this);}};
 try{let count=0,current=identity;const speech=new CloudSpeech({identity:()=>current,render:()=>{},request:async()=>{count++;return {mime:'audio/wav',base64:btoa('RIFF'+String.fromCharCode(...new Uint8Array(40)))}}});await run({speech,clips,count:()=>count,setIdentity:v=>current=v});speech.leave();}finally{globalThis.Audio=old;}
}
test('cloud read-aloud works with no installed speechSynthesis and replays without another paid request',async()=>fixture(async({speech,count})=>{assert.equal(await speech.play({text:'rain'}),'ended');assert.equal(count(),1);assert.equal(await speech.play({text:'rain'}),'ended');assert.equal(count(),1);}));
test('child cannot make speech requests',async()=>fixture(async({speech,count,setIdentity})=>{setIdentity({...identity,role:'child'});assert.equal(await speech.play({text:'rain'}),'error');assert.equal(count(),0);}));
test('coach shows the text reply even when cloud audio fails, and uses cloud not local voice',async()=>{
 let spoken='';const speech={play:async a=>{spoken=a.text;return 'error';},stop(){},leave(){}};
 const coach=new LearningCoach({identity:()=>identity,render:()=>{},voice:speech,request:async body=>body.operation==='status'?{available:true}:{transcript:'hi',reply:'What do you like?',modelPhrase:'',hint:'',speech:'What do you like?'}});
 await coach.check();await coach.sendText('hi','play');assert.equal(spoken,'What do you like?');assert.equal(coach.view().messages.at(-1).text,spoken);assert.equal(coach.view().phase,'ready');assert.match(coach.view().message,/음성/);coach.leave();
});
