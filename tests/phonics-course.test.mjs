import test from 'node:test';
import assert from 'node:assert/strict';
import {PHONICS_UNITS,PHONICS_SOURCE,buildPhonicsSteps,validatePhonicsCompletion,phonicsSpeech} from '../dist/supabase/functions/_shared/phonics-course.js';

test('22 PDF units preserve printed order and page mapping, ai/ay is explicitly supplemental',()=>{
 const source=PHONICS_UNITS.filter(u=>u.source==='seoul15');
 assert.equal(source.length,22);assert.equal(PHONICS_SOURCE.pages,84);
 assert.deepEqual(source.map(u=>u.number),Array.from({length:22},(_,i)=>i+1));
 for(const u of source){assert.equal(u.pdfPage,u.printedPage+2);assert.ok(u.words.length>=5);assert.ok(u.sentence.text);}
 assert.equal(PHONICS_UNITS.find(u=>u.id==='ai-ay').source,'supplement');
 assert.deepEqual(source[0].words.map(w=>w.text),['fat','jam','can','hat','ham','fan']);
 assert.deepEqual(source[6].words.map(w=>w.text),['bee','tree','queen','tea','peach','dream']);
});
test('deterministic words progress through listen, read, copy, recall then sentence and review',()=>{
 const steps=buildPhonicsSteps('short-a');
 assert.deepEqual(steps.slice(0,4).map(s=>s.kind),['listen','read','write','recall']);
 assert.ok(steps.slice(0,4).every(s=>s.target==='fat'));
 assert.equal(steps[4].target,'jam');assert.equal(steps.at(-2).kind,'sentence');assert.equal(steps.at(-1).kind,'review');
 assert.deepEqual(steps,buildPhonicsSteps('short-a'));
});
test('wrong spelling does not advance, handwriting/read observation is not a machine score',()=>{
 const s=buildPhonicsSteps('short-a');
 assert.throws(()=>validatePhonicsCompletion('short-a',2,{outcome:'independent',answer:'cat',attempts:1,help:false}));
 assert.equal(validatePhonicsCompletion('short-a',2,{outcome:'independent',answer:'FAT',attempts:1,help:false}).evidence,'spelling');
 assert.equal(validatePhonicsCompletion('short-a',1,{outcome:'independent',attempts:1,help:false}).evidence,'self-observation');
 assert.equal(validatePhonicsCompletion('short-a',0,{outcome:'independent',attempts:1,help:false}).outcome,'supported');
 assert.equal(validatePhonicsCompletion('short-a',3,{outcome:'independent',answer:'fat',attempts:2,help:false}).outcome,'supported');
 assert.throws(()=>validatePhonicsCompletion('short-a',-1,{}));
 assert.throws(()=>validatePhonicsCompletion('missing',0,{}));
});
test('only known course tokens are synthesized, no user-controlled pronunciation instruction',()=>{
 assert.equal(phonicsSpeech('short-a',0),'fat');
 assert.throws(()=>phonicsSpeech('short-a',500));
 assert.throws(()=>phonicsSpeech('constructor',0));
});
