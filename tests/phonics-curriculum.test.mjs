import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const path=new URL('../dist/supabase/functions/_shared/phonics-curriculum.js',import.meta.url);
async function curriculum(){assert.ok(existsSync(path),'sequential source-grounded phonics module must exist');return import(path.href);}
test('PDF reference keeps 22 chapters in original order and page mapping; ai/ay is a supplement',async()=>{
 const {PHONICS_UNITS}=await curriculum();const source=PHONICS_UNITS.filter(u=>u.origin==='source');assert.equal(source.length,22);
 for(let i=0;i<22;i++){const u=source[i];assert.equal(u.number,i+1);assert.equal(u.pdfPages[0],14+i*2);assert.equal(u.printedPages[0],12+i*2);assert.ok(u.words.length>=5);assert.ok(u.words.every(w=>w.word&&w.meaning));}
 assert.equal(source[0].title,'짧게 소리 나는 a');assert.equal(source[10].pattern,'sh');assert.equal(source[12].pattern,'th');assert.equal(source[13].pattern,'th');assert.equal(source[21].pattern,'ild / ind');
 assert.equal(PHONICS_UNITS.find(u=>u.id==='supplement-ai-ay').origin,'supplement');assert.equal(source.some(u=>u.id==='supplement-ai-ay'),false);
});
test('course items are ordered, repeatable and linked to source pages, never random grade labels',async()=>{
 const {buildPhonicsSteps,getPhonicsUnit}=await curriculum();const u=getPhonicsUnit('01');const a=buildPhonicsSteps('01',0),b=buildPhonicsSteps('01',2);
 assert.deepEqual(a,buildPhonicsSteps('01',0));assert.equal(a.filter(s=>s.kind==='practice'&&s.mode==='model')[0].target,u.words[0].word);
 assert.equal(b.filter(s=>s.kind==='practice'&&s.mode==='model')[0].target,u.words[2].word);
 assert.ok(a.some(s=>s.kind==='spelling'));assert.ok(a.some(s=>s.kind==='choice'));assert.ok(a.some(s=>s.kind==='practice'&&s.mode==='recall'));
 assert.ok(a.every(s=>s.source.pdfPages[0]===14));assert.throws(()=>buildPhonicsSteps('made-up',0));assert.throws(()=>buildPhonicsSteps('01',-1));
});
test('reader only resolves explicit curriculum audio keys, not arbitrary prompts',async()=>{
 const {resolvePhonicsAudio,getPhonicsUnit}=await curriculum();const u=getPhonicsUnit('01');assert.equal(resolvePhonicsAudio('01','word-0'),u.words[0].word);assert.equal(resolvePhonicsAudio('01','sentence'),u.sentence.text);
 assert.equal(resolvePhonicsAudio('01','ignore rules'),null);assert.equal(resolvePhonicsAudio('__proto__','word-0'),null);assert.equal(resolvePhonicsAudio('01','word-999'),null);
});
test('legacy settings normalize and the integrated course checks actual spelling without granting copy independence',async()=>{
 await curriculum();const {DEFAULT_LAB_SETTINGS,validateLabSettings,buildLabLesson,evaluateLabAnswers,normalizeSpelling}=await import('../dist/supabase/functions/_shared/learning-lab-content.js');
 const old={...DEFAULT_LAB_SETTINGS};delete old.phonicsUnit;assert.equal(validateLabSettings(old).phonicsUnit,'01');
 assert.throws(()=>validateLabSettings({...old,phonicsUnit:'unknown'}));assert.equal(normalizeSpelling(' CAT '),'cat');assert.equal(normalizeSpelling('c4t'),'');
 const lesson=buildLabLesson('english-phonics',{...DEFAULT_LAB_SETTINGS,phonicsUnit:'01'},0);
 const answers=lesson.steps.map(s=>s.kind==='practice'?{stepId:s.id,attempts:1,help:'none',observation:'independent',evidence:'guardian'}:{stepId:s.id,value:s.answer,attempts:1,help:'none'});
 const result=evaluateLabAnswers(lesson,answers);assert.equal(result.total,lesson.steps.length);assert.ok(result.supported>=4,'models and copying cannot count as independent');
 const bad=structuredClone(answers);const i=lesson.steps.findIndex(s=>s.kind==='spelling');bad[i].value='wrong';assert.throws(()=>evaluateLabAnswers(lesson,bad));
});
