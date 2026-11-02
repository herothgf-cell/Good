import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningCoach} from '../dist/src/learning-coach.js';

const identity={familyId:'family',actorId:'parent',role:'admin',mode:'cloud'};
function boot(request=async body=>body.operation==='status'?{available:true,message:'ready'}:{transcript:body.text,reply:'Do you like soccer?',modelPhrase:'',hint:'',speech:'Do you like soccer?'}){
  let current={...identity};const calls=[];let renders=0;
  const coach=new LearningCoach({identity:()=>current,render:()=>renders++,request:async(body,signal)=>{calls.push({body,signal});return request(body,signal);}});
  return {coach,calls,setIdentity:value=>current=value,renders:()=>renders};
}
test('demo and child coach cannot send a server request or request microphone',async()=>{
  for(const i of [{...identity,mode:'demo'},{...identity,role:'child'}]){
    const b=boot();b.setIdentity(i);await b.coach.check();await b.coach.sendText('hello','play');
    assert.equal(b.calls.length,0);assert.equal(b.coach.view().available,false);
  }
});
test('real coach maintains ephemeral dialogue with separate user and AI messages',async()=>{
  const b=boot();await b.coach.check();await b.coach.sendText('I like soccer.','play');
  assert.equal(b.coach.view().turns,1);assert.equal(b.coach.view().messages.length,2);
  assert.equal(b.coach.view().messages[0].text,'I like soccer.');assert.equal(b.coach.view().messages[1].role,'assistant');
  assert.equal(b.calls[1].body.adultTest,true);assert.deepEqual(b.calls[1].body.history,[]);
  b.coach.leave();assert.equal(b.coach.view().messages.length,0);assert.equal(b.coach.view().turns,0);
});
test('leaving aborts response and late completion cannot restore conversation',async()=>{
  let resolve;const b=boot(body=>body.operation==='status'?Promise.resolve({available:true}):new Promise(r=>resolve=r));
  await b.coach.check();const pending=b.coach.sendText('Hi','play');await Promise.resolve();
  assert.equal(b.coach.view().phase,'sending');b.coach.leave();assert.equal(b.calls[1].signal.aborted,true);
  resolve({transcript:'Hi',reply:'Do you like soccer?',modelPhrase:'',hint:'',speech:'Do you like soccer?'});await pending;
  assert.equal(b.coach.view().phase,'idle');assert.equal(b.coach.view().messages.length,0);
});
test('identity change during a response prevents old family content rendering',async()=>{
  let resolve;const b=boot(body=>body.operation==='status'?Promise.resolve({available:true}):new Promise(r=>resolve=r));
  await b.coach.check();const pending=b.coach.sendText('Hi','play');await Promise.resolve();
  b.setIdentity({...identity,actorId:'other'});resolve({transcript:'Hi',reply:'Do you like soccer?',modelPhrase:'',hint:'',speech:'Do you like soccer?'});await pending;
  assert.equal(b.coach.view().messages.length,0);assert.equal(b.coach.view().phase,'idle');
});
test('double-send while pending does not reserve or send an extra paid turn',async()=>{
  let resolve;const b=boot(body=>body.operation==='status'?Promise.resolve({available:true}):new Promise(r=>resolve=r));
  await b.coach.check();const first=b.coach.sendText('Hi','play');await Promise.resolve();await b.coach.sendText('Again','play');
  assert.equal(b.calls.filter(c=>c.body.operation==='turn').length,1);
  resolve({transcript:'Hi',reply:'Do you like soccer?',modelPhrase:'',hint:'',speech:'Do you like soccer?'});await first;b.coach.leave();
});
test('unavailable connection and failed turn never fabricate responses or retry',async()=>{
  const unavailable=boot(async()=>({available:false,message:'not configured'}));await unavailable.coach.check();await unavailable.coach.sendText('hello','play');
  assert.equal(unavailable.calls.length,1);assert.equal(unavailable.coach.view().messages.length,0);
  const failed=boot(async body=>{if(body.operation==='status')return {available:true};throw Error('connection lost');});
  await failed.coach.check();await failed.coach.sendText('hello','play');assert.equal(failed.calls.length,2);
  assert.equal(failed.coach.view().phase,'error');assert.equal(failed.coach.view().messages.length,0);
  assert.equal(failed.coach.view().turns,1);failed.coach.leave();
});
test('microphone permission resolving after leave releases every track without recording',async()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let resolve;let stopped=0;let constructed=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});
  const oldRecorder=globalThis.MediaRecorder;globalThis.MediaRecorder=class {constructor(){constructed++;}static isTypeSupported(){return true;}};
  try{
    const b=boot();await b.coach.check();const pending=b.coach.startRecording('play');await Promise.resolve();b.coach.leave();
    resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
    assert.equal(stopped,1);assert.equal(constructed,0);assert.equal(b.coach.view().phase,'idle');
  }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;globalThis.MediaRecorder=oldRecorder;}
});

async function withSpeech(t,run){
  const descriptors=new Map(['speechSynthesis','SpeechSynthesisUtterance'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const utterances=[];const timers=new Map();const setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout;
  t.mock.method(globalThis,'setTimeout',(callback,delay,...args)=>{
    if(delay!==20000)return setTimer(callback,delay,...args);
    const id=Symbol('speech timeout');timers.set(id,{callback,delay});return id;
  });
  t.mock.method(globalThis,'clearTimeout',id=>{if(!timers.delete(id))clearTimer(id);});
  Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{configurable:true,value:class {constructor(text){this.text=text;}}});
  Object.defineProperty(globalThis,'speechSynthesis',{configurable:true,value:{
    getVoices:()=>[{localService:true,lang:'en-US'}],cancel:()=>{},speak:utterance=>utterances.push(utterance),
  }});
  const expire=()=>{
    assert.equal(timers.size,1,'the active speech must retain its timeout');
    const [id,timer]=timers.entries().next().value;
    assert.equal(timer.delay,20000);timers.delete(id);timer.callback();
  };
  try{await run({utterances,timers,expire});}
  finally{for(const [name,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

for(const finish of ['timeout','onend','onerror','leave'])for(const late of ['onend','onerror']){
  test(`speech ${late} after ${finish} cannot unlock the next utterance or clear its timeout`,async t=>{
    await withSpeech(t,async({utterances,timers,expire})=>{
      const b=boot();
      try{
        await b.coach.check();await b.coach.sendText('First turn.','play');
        assert.equal(b.coach.view().phase,'speaking');
        const old=utterances[0],lateCallback=old[late];
        if(finish==='timeout')expire();
        else if(finish==='leave'){b.coach.leave();await b.coach.check();}
        else old[finish]();
        assert.equal(b.coach.view().phase,'ready');
        assert.equal(timers.size,0,'completed speech must release its timeout');
        await b.coach.sendText('Next turn.','play');
        const speaking=b.coach.view();assert.equal(speaking.phase,'speaking');
        lateCallback();
        assert.deepEqual(b.coach.view(),speaking,'stale speech must leave the active dialogue and status intact');
        const calls=b.calls.length;await b.coach.sendText('Must wait.','play');
        assert.equal(b.calls.length,calls,'the next turn must remain blocked while audio is speaking');
        expire();assert.equal(b.coach.view().phase,'ready');
        assert.equal(timers.size,0);
      }finally{b.coach.leave();}
    });
  });
}
