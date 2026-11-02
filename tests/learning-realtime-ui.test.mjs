import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
const url=new URL('../dist/src/learning-realtime-ui.js',import.meta.url);
const view={phase:'idle',active:false,available:null,message:'Ready',caption:'<script>bad</script>',captions:false,responses:0,remainingSeconds:300,voice:'marin'};
async function api(){assert.ok(existsSync(url),'Voice-first panel must exist');return import(url.href);}
test('voice panel has start stop and no text input or TTS button',async()=>{const {renderRealtimePanel}=await api();const html=renderRealtimePanel(view);assert.match(html,/실시간 음성 대화/);assert.match(html,/data-lab-action="realtime-start"/);assert.match(html,/AI가 생성한 목소리/);assert.doesNotMatch(html,/<textarea|speechSynthesis|data-lab-action="listen"/);assert.doesNotMatch(html,/bad/);});
test('optional caption escapes provider text, blocked audio offers manual playback',async()=>{const {renderRealtimePanel}=await api();const html=renderRealtimePanel({...view,phase:'audio-blocked',active:true,captions:true});assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/data-lab-action="realtime-audio"/);assert.match(html,/data-lab-action="realtime-stop"/);});
test('lab wiring renders realtime first and closes it before legacy speech and navigation',async()=>{
 const {LearningLabController}=await import('../dist/src/learning-lab.js');const {emptyState}=await import('../dist/supabase/functions/_shared/domain.js');
 const snapshot={state:emptyState(),me:{id:'dad',name:'아빠',role:'admin'},familyId:'f',members:[],revision:0};let stops=0,starts=0,checks=0;
 const realtime={view:()=>({...view}),reconcile(){},leave(){stops++},stop(){stops++},start:async()=>{starts++},check:async()=>{},enableAudio:async()=>{},toggleCaptions(){},setVoice(){}};
 const coach={view:()=>({phase:'idle',available:null,message:'',messages:[],turns:0}),leave(){},check:async()=>{checks++},startRecording:async()=>{},finishRecording:async()=>{},sendText:async()=>{}};
 const c=new LearningLabController({snapshot:()=>snapshot,perform:async()=>true,render(){},toast(){},coach,realtime});const click=(action,extra={})=>c.handleClick({dataset:{labAction:action,...extra}});
 await click('start',{lessonId:'english-conversation'});let html=c.render(snapshot);assert.match(html,/realtime-start/);assert.ok(html.indexOf('realtime-start')<html.indexOf('lab-coach-message'));
 await click('realtime-start');assert.equal(starts,1);const n=stops;await click('coach-check');assert.ok(stops>n);assert.equal(checks,1);await click('back');assert.ok(stops>n+1);
});
