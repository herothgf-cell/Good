"""Real DOM/controller, with WebRTC/provider/media permission boundaries replaced.
No network, actual microphone, user credentials or paid API calls are used.
"""
import json,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
client=(ROOT/'dist/src/learning-realtime.js').read_text().replace('export class LearningRealtime','window.LearningRealtime = class LearningRealtime')
visuals=(ROOT/'dist/src/learning-lab-visuals.js').read_text().replace('export ', '')
ui=(ROOT/'dist/src/learning-realtime-ui.js').read_text()
ui='const e=labEscape;\n'+'\n'.join(line for line in ui.splitlines() if not line.startswith('import '))
ui=ui.replace('export function renderRealtimePanel','window.renderRealtimePanel = function renderRealtimePanel').replace('export function updateRealtimePanel','window.updateRealtimePanel = function updateRealtimePanel')
css=(ROOT/'dist/styles.css').read_text();checks=[];errors=[];requests=[]
def passed(name):checks.append(name);print('PASS:',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width in [390,1024]:
  context=browser.new_context(viewport={'width':width,'height':1000},locale='ko-KR',reduced_motion='reduce')
  context.route('**/*',lambda r:(requests.append(r.request.url),r.abort()))
  page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)));page.set_default_timeout(6000)
  page.set_content(f'<html lang="ko"><meta charset="utf-8"><style>{css}</style><body><main class="lab-page" style="padding:16px"><div id="voice-root"></div></main></body></html>')
  page.add_script_tag(content=client);page.add_script_tag(content=visuals);page.add_script_tag(content='(()=>{'+ui+'})();')
  page.evaluate('''()=>{
   window.__calls=[];window.__tracks=[];window.__blocked=false;window.__micRequests=0;
   if(!crypto.randomUUID)crypto.randomUUID=()=>`a0000000-0000-4000-8000-${String(Math.random()).slice(2,14).padEnd(12,'0')}`;
   const track={enabled:true,stopped:false,stop(){this.stopped=true}};window.__track=track;
   const stream=new MediaStream();stream.getTracks=()=>[track];stream.getAudioTracks=()=>[track];
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__micRequests++;track.stopped=false;return stream}}});
   HTMLMediaElement.prototype.play=function(){return window.__blocked?Promise.reject(Error('blocked')):Promise.resolve()};
   window.RTCPeerConnection=class{constructor(){window.__peer=this;this.connectionState='new';this.dc={readyState:'connecting',sent:[],send(x){this.sent.push(JSON.parse(x))},close(){this.readyState='closed'}}}addTrack(){}createDataChannel(){return this.dc}async createOffer(){return {type:'offer',sdp:'v=0\\r\\nm=audio 9 UDP/TLS/RTP/SAVPF 111\\r\\n'}}async setLocalDescription(x){this.localDescription=x}async setRemoteDescription(x){this.remoteDescription=x}close(){this.connectionState='closed'}};
   const host={identity:()=>({mode:'cloud',role:'admin',familyId:'family-fixture',actorId:'adult-fixture'}),render:()=>document.querySelector('#voice-root').innerHTML=renderRealtimePanel(window.__client.view()),request:async body=>{window.__calls.push(body);return body.operation==='status'?{available:true}:body.operation==='start'?{sdp:'v=0\\r\\nm=audio 9 UDP/TLS/RTP/SAVPF 111\\r\\n',expiresAt:Date.now()+300000,maxSeconds:300,maxResponses:40}:{active:true}}};
   window.__client=new LearningRealtime(host);host.render();
   window.__fullRender=host.render;host.render=()=>{if(!window.updateRealtimePanel(window.__client.view()))window.__fullRender()};
   window.__emit=e=>window.__peer.dc.onmessage?.({data:JSON.stringify(e)});
   document.addEventListener('click',async e=>{const el=e.target.closest('[data-lab-action]');if(!el)return;const action=el.dataset.labAction;
    if(action==='realtime-start'){await window.__client.start('play');const peer=window.__peer;if(peer?.connectionState==='closed')return;peer.ontrack({streams:[stream]});peer.dc.readyState='open';peer.dc.onopen();}
    else if(action==='realtime-stop')window.__client.stop();else if(action==='realtime-captions')window.__client.toggleCaptions();else if(action==='realtime-audio')await window.__client.enableAudio();else if(action==='realtime-check')await window.__client.check();else if(action==='realtime-marin')window.__client.setVoice('marin');else if(action==='realtime-cedar')window.__client.setVoice('cedar');
   });
  }''')
  expect(page.locator('[data-lab-action="realtime-start"]')).to_be_visible();assert page.locator('textarea').count()==0
  assert page.evaluate('window.__micRequests')==0
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
  page.screenshot(path=str(OUT/f'realtime-voice-idle-{width}.png'),full_page=True)
  page.locator('[data-lab-action="realtime-start"]').click();expect(page.locator('.voice-phase')).to_contain_text('생각')
  assert not page.evaluate('window.__track.enabled');assert page.locator('audio').count()==1
  page.evaluate("__emit({type:'output_audio_buffer.started'});__emit({type:'response.done',response:{status:'completed'}})")
  page.wait_for_timeout(100);assert not page.evaluate('window.__track.enabled')
  page.evaluate("__emit({type:'output_audio_buffer.stopped'})");expect(page.locator('.voice-phase')).to_contain_text('듣고')
  assert page.evaluate('window.__track.enabled');page.screenshot(path=str(OUT/f'realtime-voice-listening-{width}.png'),full_page=True)
  page.evaluate("__emit({type:'input_audio_buffer.committed',item_id:'yes'});__emit({type:'input_audio_buffer.committed',item_id:'yes'})")
  assert page.evaluate("window.__peer.dc.sent.filter(x=>x.type==='response.create').length")==2
  page.locator('[data-lab-action="realtime-captions"]').click();page.locator('[data-lab-action="realtime-stop"]').focus();page.evaluate("__emit({type:'response.output_audio_transcript.delta',delta:'<b>Soccer sounds fun!</b>'})")
  expect(page.locator('[data-lab-action="realtime-stop"]')).to_be_focused();expect(page.locator('.voice-caption')).to_contain_text('<b>Soccer');assert page.locator('.voice-caption b').count()==0
  page.locator('[data-lab-action="realtime-stop"]').click();expect(page.locator('.voice-phase')).to_contain_text('마쳤')
  assert page.evaluate('window.__track.stopped');assert page.locator('audio').count()==0
  page.evaluate('window.__blocked=true');page.locator('[data-lab-action="realtime-start"]').click();expect(page.locator('[data-lab-action="realtime-audio"]')).to_be_visible();assert not page.evaluate('window.__track.enabled')
  page.screenshot(path=str(OUT/f'realtime-voice-blocked-{width}.png'),full_page=True)
  page.evaluate('window.__blocked=false');page.locator('[data-lab-action="realtime-audio"]').click();page.evaluate("__emit({type:'output_audio_buffer.stopped'})");expect(page.locator('.voice-phase')).to_contain_text('듣고')
  page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
  assert page.evaluate('window.__track.stopped');assert page.locator('audio').count()==0
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
  passed(f'{width}px: voice-only start, actual playback gate, short reply dedup, escaped captions, stop, audio unblock and hidden-page cleanup')
  context.close()
 assert not errors,errors;assert not requests,requests
 passed('no external requests or uncaught browser errors; WebRTC and provider boundaries are explicitly mocked')
 browser.close()
