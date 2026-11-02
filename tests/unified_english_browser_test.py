"""Real controllers/DOM; only authenticated transport and audio device are test doubles."""
import json, mimetypes, os, shutil, re, subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'artifacts'; checks=[]; errors=[]
def passed(message): checks.append(message);print('PASS:',message,flush=True)
HTML='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><body><main id="root" style="padding:16px;max-width:1080px;margin:auto"></main><script type="module" src="/fixture.js"></script></body></html>'''
FIXTURE='''
import {LearningCoach} from '/src/learning-coach.js';
import {LearningLabController} from '/src/learning-lab.js';
import {CloudSpeech} from '/src/cloud-speech.js';
import {PhonicsController} from '/src/phonics.js';
import {englishLearningFor,applyEnglishCommand} from '/supabase/functions/_shared/english-learning.js';
import {demoState} from '/supabase/functions/_shared/domain.js';
window.fixture={role:'admin',spoken:[],requests:[],audioBlocked:false,audioError:false,writeFailure:false,localVoice:0,mic:0};
const f=window.fixture;let store={},lab,phonics;
Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return []},speak(){f.localVoice++}}});
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{f.mic++;throw Error('no microphone needed')}}});
HTMLMediaElement.prototype.play=function(){if(f.audioBlocked)return Promise.reject(Error('blocked'));f.spoken.push(this.src);setTimeout(()=>this.onended?.(new Event('ended')),10);return Promise.resolve()};
const identity=()=>({mode:'cloud',role:f.role,actorId:'guardian',familyId:'family'});
const request=async body=>{f.requests.push(body);if(body.operation==='speech'){if(f.audioError)throw Error('provider offline');return {mime:'audio/wav',base64:btoa('RIFF'+'\\0'.repeat(40))};}if(body.operation==='progress')return {progress:englishLearningFor(store)};if(body.operation==='command'){if(f.writeFailure){f.writeFailure=false;throw Error('network failed');}const r=applyEnglishCommand(store,body.action,Date.now());store=r.state;return r.result;}};
const snapshot={familyId:'family',revision:0,me:{id:'guardian',name:'parent',role:'admin'},state:demoState()};
const render=()=>{snapshot.me.role=f.role;if(lab){document.querySelector('#root').innerHTML=lab.render(snapshot);phonics.afterRender();}};
const speech=new CloudSpeech({identity,request,render});
phonics=new PhonicsController({identity,request,speech,render});
const coach=new LearningCoach({identity,render,voice:speech,request:async body=>body.operation==='status'?{available:true,message:'ready'}:{transcript:body.text||'I like soccer.',reply:'Soccer sounds fun! Who plays with you?',modelPhrase:'I like soccer.',hint:'누구와 함께 하나요?',speech:'I like soccer. Soccer sounds fun! Who plays with you?'}});
lab=new LearningLabController({snapshot:()=>snapshot,perform:async()=>true,render,toast(){},coach,speech,phonics});
window.app={render,lab,phonics,coach,speech,progress:()=>englishLearningFor(store)};render();
document.addEventListener('click',e=>{const el=e.target.closest('[data-lab-action]');if(el)void lab.handleClick(el)});
document.addEventListener('submit',e=>{if(e.target.matches('[data-lab-form]')){e.preventDefault();void lab.handleSubmit(e.target)}});
'''
# This harness blocks all navigations. Execute a CommonJS bundle in set_content,
# matching the app's offline preview build without weakening the browser policy.
subprocess.run(['node','node_modules/typescript/bin/tsc','-p','tsconfig.json','--module','CommonJS','--moduleResolution','Node','--outDir','artifacts/fixture-cjs'],cwd=ROOT,check=True)
modules=[]
for source in (OUT/'fixture-cjs').rglob('*.js'):
 key=source.relative_to(OUT/'fixture-cjs').as_posix()
 modules.append(json.dumps(key)+':function(module,exports,require){'+source.read_text()+'\n}')
BUNDLE='(()=>{const modules={'+','.join(modules)+'};const cache={};window.__load=function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;modules[id](module,module.exports,req=>{const parts=(id.slice(0,id.lastIndexOf("/")+1)+req).split("/");const result=[];for(const part of parts){if(part==="..")result.pop();else if(part!=="."&&part)result.push(part)}return load(result.join("/"))});return module.exports;};})();'
FIXTURE=re.sub(r"import \{([^}]+)\} from '/([^']+)';",r"const {\1}=__load('\2');",FIXTURE)
FIXTURE="if(!crypto.randomUUID)crypto.randomUUID=()=>`a0000000-0000-4000-8000-${String(Math.random()).slice(2,14).padEnd(12,'0')}`;\n"+FIXTURE
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 for width in [390,1024]:
  page=browser.new_page(viewport={'width':width,'height':920},locale='ko-KR');page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.abort())
  page.set_content('<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>'+(ROOT/'dist/styles.css').read_text()+'</style><body><main id="root" style="padding:16px;max-width:1080px;margin:auto"></main></body></html>')
  page.add_script_tag(content=BUNDLE);page.add_script_tag(content=FIXTURE);page.wait_for_function('!!window.app')
  page.locator('[data-lesson-id="english-conversation"]').click()
  expect(page.locator('.lab-coach')).to_have_count(1);expect(page.locator('.voice-panel')).to_have_count(0)
  page.locator('[data-lab-action="coach-check"]').click();page.locator('#lab-coach-message').fill('I like soccer.');page.locator('[data-lab-form="coach"] button[type="submit"]').click()
  expect(page.locator('.lab-coach')).to_contain_text('Soccer sounds fun!')
  page.wait_for_function('fixture.spoken.length===1');assert page.evaluate('fixture.localVoice')==0
  assert page.evaluate("fixture.requests.filter(x=>x.operation==='speech').at(-1).text")=='I like soccer. Soccer sounds fun! Who plays with you?'
  page.locator('[data-lab-action="coach-replay"]').click();page.wait_for_function('fixture.spoken.length===2')
  assert page.evaluate("fixture.requests.filter(x=>x.operation==='speech').length")==1
  page.screenshot(path=str(OUT/f'unified-chat-{width}.png'),full_page=True)
  passed(f'{width}px same chat shows text and plays AI audio with no installed voice; replay uses cached clip')
  page.locator('[data-lab-action="back"]').click();page.locator('[data-lab-action="phonics-open"]').click()
  page.wait_for_function('fixture.spoken.length===3');assert page.locator('.phonics-question .lab-target').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=30;expect(page.locator('[data-phonics-kind="listen"]')).to_be_visible()
  page.locator('[data-lab-action="phonics-next"]').click();page.locator('[data-lab-action="phonics-next"]').click()
  expect(page.locator('#phonics-canvas')).to_be_visible();canvas=page.locator('#phonics-canvas');canvas.scroll_into_view_if_needed();b=canvas.bounding_box()
  page.mouse.move(b['x']+40,b['y']+40);page.mouse.down();page.mouse.move(b['x']+100,b['y']+100,steps=5);page.mouse.up()
  page.screenshot(path=str(OUT/f'unified-phonics-writing-{width}.png'),full_page=True)
  drawn=canvas.evaluate('(c)=>c.toDataURL()');page.evaluate('app.render()');assert page.locator('#phonics-canvas').evaluate('(c)=>c.toDataURL()')==drawn
  page.locator('#phonics-answer').fill('fa');page.evaluate('app.render()');expect(page.locator('#phonics-answer')).to_have_value('fa')
  page.locator('[data-letter="t"]').click();expect(page.locator('#phonics-answer')).to_have_value('fat')
  page.evaluate('fixture.writeFailure=true');page.locator('#phonics-answer').press('Enter');expect(page.locator('[data-lab-action="phonics-retry"]')).to_be_visible()
  first=page.evaluate("fixture.requests.filter(x=>x.operation==='command').at(-1).requestId")
  page.locator('[data-lab-action="phonics-retry"]').click();expect(page.locator('[data-phonics-kind="recall"]')).to_be_visible()
  assert first==page.evaluate("fixture.requests.filter(x=>x.operation==='command').at(-1).requestId")
  expect(page.locator('.phonics-question .lab-target')).to_have_count(0)
  page.locator('[data-lab-action="phonics-back"]').click();page.locator('[data-lab-action="phonics-open"]').click();expect(page.locator('[data-phonics-kind="recall"]')).to_be_visible()
  page.locator('[data-lab-action="phonics-reveal"]').click();page.locator('#phonics-answer').fill('fat');page.locator('#phonics-answer').press('Enter');expect(page.locator('.phonics-question .lab-target')).to_have_text('jam')
  assert page.evaluate('fixture.mic')==0
  page.screenshot(path=str(OUT/f'unified-phonics-{width}.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  passed(f'{width}px source course AI-read, pen strokes/input survive render, retry keeps request ID, hidden recall and saved cursor resume')
  page.evaluate("fixture.role='child';app.render()");expect(page.locator('.lab-page')).to_have_count(0)
  page.close()
 assert not errors,errors
 passed('guardian-only runtime and zero browser errors; network and speaker hardware are mocked')
 browser.close()
(OUT/'unified-english-browser-results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
