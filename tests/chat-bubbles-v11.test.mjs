import test from 'node:test';import assert from 'node:assert/strict';
import {LearningCoach} from '../dist/src/learning-coach.js';
const identity={familyId:'family',actorId:'parent',role:'admin',mode:'cloud'};
const answer=text=>({transcript:text,reply:'Who will play with you?',speech:'Who will play with you?'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function boot(request){const calls=[];return {calls,coach:new LearningCoach({identity:()=>identity,render(){},request:async(b,s)=>{calls.push(b);return b.operation==='status'?{available:true}:request(b,s);}})};}
test('v11 보낸 글은 AI 응답 대기 중에도 사용자 말풍선에 즉시 나타난다',async()=>{
 const d=deferred(),b=boot(()=>d.promise);await b.coach.check();const pending=b.coach.sendText('I like soccer.','play');
 assert.equal(b.coach.view().messages.length,1);assert.equal(b.coach.view().messages[0].text,'I like soccer.');assert.equal(b.coach.view().messages[0].status,'sending');
 d.resolve(answer('I like soccer.'));await pending;assert.equal(b.coach.view().messages.length,2);assert.equal(b.coach.view().messages[0].status,'complete');assert.equal(b.coach.view().messages[1].role,'assistant');b.coach.leave();
});
test('v11 전송 실패는 사용자 글을 남기되 AI의 답변을 만들어내지 않는다',async()=>{
 const b=boot(()=>Promise.reject(Error('network')));await b.coach.check();await b.coach.sendText('I want a ball.','shop');
 assert.equal(b.coach.view().messages.length,1);assert.equal(b.coach.view().messages[0].status,'failed');assert.equal(b.coach.view().messages[0].role,'user');assert.equal(b.calls.length,2);b.coach.leave();
});
test('v11 실패한 메시지/현재 보낸 메시지는 다음 요청의 history에 중복 포함되지 않는다',async()=>{
 let count=0;const b=boot(body=>++count===1?Promise.reject(Error('network')):Promise.resolve(answer(body.text)));
 await b.coach.check();await b.coach.sendText('lost','play');await b.coach.sendText('hello','play');assert.deepEqual(b.calls[2].history,[]);
 await b.coach.sendText('next','play');assert.deepEqual(b.calls[3].history,[{role:'user',text:'hello'},{role:'assistant',text:'Who will play with you?'}]);b.coach.leave();
});
