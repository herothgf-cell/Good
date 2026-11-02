import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
const path=new URL('../dist/src/learning-audio.js',import.meta.url);
async function api(){assert.ok(existsSync(path),'AI audio player must exist independently of device speech synthesis');return import(path.href);}
function audio(){const b=Buffer.alloc(48);b.write('RIFF');b.writeUInt32LE(40,4);b.write('WAVE',8);return {mime:'audio/wav',base64:b.toString('base64'),transcript:'cat'};}
function fake(){return {src:'',play:async()=>{},pause(){this.paused=true;},removeAttribute(){this.src='';},load(){},currentTime:0,onended:null,onerror:null};}
test('AI audio is played and replayed without installed device voices or another network request',async()=>{
 const {LearningAudio}=await api();const element=fake();const player=new LearningAudio(()=>{},()=>element);
 await player.play(audio());assert.equal(player.view().phase,'playing');assert.match(element.src,/^blob:/);element.onended();assert.equal(player.view().phase,'idle');assert.equal(player.view().canReplay,true);await player.replay();assert.equal(player.view().phase,'playing');player.clear();assert.equal(player.view().canReplay,false);assert.equal(element.src,'');
});
test('browser audio blocking keeps an explicit replay action; obsolete audio callbacks cannot change new playback',async()=>{
 const {LearningAudio}=await api();const element=fake();element.play=async()=>{throw new DOMException('blocked','NotAllowedError');};const player=new LearningAudio(()=>{},()=>element);await player.play(audio());assert.equal(player.view().phase,'blocked');assert.equal(player.view().canReplay,true);
 element.play=async()=>{};await player.replay();const old=element.onended;await player.play(audio());old();assert.equal(player.view().phase,'playing');player.clear();old();assert.equal(player.view().phase,'idle');
});
test('phonics reader requests only curriculum ids, caches replay, and ignores late results after exit',async()=>{
 await api();const {LearningReader}=await import('../dist/src/learning-reader.js');const identity={familyId:'family',actorId:'parent',role:'admin',mode:'cloud'};let calls=0,resolve;
 const reader=new LearningReader({identity:()=>identity,render(){},request:async(body)=>{calls++;assert.equal(body.operation,'read');assert.equal(body.text,undefined);return {speech:'cat',audio:audio()};}},()=>fake());
 await reader.read('01','word-0');assert.equal(reader.view().phase,'playing');await reader.read('01','word-0');assert.equal(calls,1);reader.leave();
 const late=new LearningReader({identity:()=>identity,render(){},request:()=>new Promise(r=>resolve=r)},()=>fake());const p=late.read('01','word-0');late.leave();resolve({speech:'cat',audio:audio()});await p;assert.equal(late.view().phase,'idle');assert.equal(late.view().canReplay,false);
});
