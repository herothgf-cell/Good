"""Real browser controller lifecycle; fake media/provider boundaries, no network/accounts."""
import json
import os
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def main():
    source=(ROOT/'dist/src/learning-coach.js').read_text().replace('export class LearningCoach', 'window.LearningCoach = class LearningCoach')
    with sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('google-chrome') or shutil.which('chromium')
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        page=browser.new_page()
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/*',lambda route:route.abort())
        page.set_content('<html lang="ko"><body>Guardian coach lifecycle test</body></html>')
        page.evaluate("""()=>{
          window.fixture={requests:[],activeTracks:0,permission:0,spoken:[],oversize:false};
          // set_content uses an opaque origin; production is HTTPS with native randomUUID.
          if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};
          const f=window.fixture;
          Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
            f.permission++;let active=true;f.activeTracks++;
            return {getTracks:()=>[{stop:()=>{if(active){active=false;f.activeTracks--;}}}]};
          }}});
          window.MediaRecorder=class {
            static isTypeSupported(type){return type==='audio/mp4';}
            constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';f.recorder=this;}
            start(){this.state='recording';}
            stop(){this.state='inactive';setTimeout(()=>{
              this.ondataavailable?.({data:new Blob([f.oversize?new Uint8Array(512001):new Uint8Array([1,2,3])],{type:'audio/mp4'})});
              this.onstop?.();
            },0);}
          };
          Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
            cancel:()=>{},getVoices:()=>[{localService:true,lang:'en-US',name:'Local test voice'}],
            speak:utterance=>{f.spoken.push({text:utterance.text,activeTracks:f.activeTracks});f.utterance=utterance;}
          }});
          window.SpeechSynthesisUtterance=function(text){this.text=text;};
          Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:()=>{throw Error('voice storage forbidden');},getItem:()=>{throw Error('voice storage forbidden');}}});
        }""")
        page.add_script_tag(content=source)
        page.evaluate("""()=>{
          window.coach=new LearningCoach({identity:()=>({familyId:'family',actorId:'parent',role:'admin',mode:'cloud'}),render:()=>{},request:async(body,signal)=>{
            fixture.requests.push(body);
            if(body.operation==='status')return {available:true,message:'ready'};
            return {transcript:'I like soccer.',reply:'Do you play with a friend?',modelPhrase:'',hint:'친구와 함께 하나요?',speech:'Do you play with a friend?'};
          }});
        }""")
        page.evaluate('()=>coach.check()')
        assert page.evaluate('fixture.permission')==0
        page.evaluate("()=>coach.startRecording('play')")
        assert page.evaluate('coach.view().phase')=='recording'
        assert page.evaluate('fixture.activeTracks')==1
        page.evaluate('()=>coach.finishRecording()')
        page.wait_for_function("coach.view().phase==='speaking'")
        result=page.evaluate('({request:fixture.requests[1],spoken:fixture.spoken[0],view:coach.view()})')
        assert result['request']['audio']=={'mime':'audio/mp4','base64':'AQID'}
        assert result['spoken']['activeTracks']==0
        assert result['view']['messages'][0]['text']=='I like soccer.'
        assert len(result['view']['messages'])==2
        print('PASS: mp4 final data is sent once, tracks stop before speech, real reply remains ephemeral',flush=True)
        page.evaluate('fixture.utterance.onend()')
        page.evaluate("()=>coach.startRecording('play')")
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('fixture.activeTracks')==0
        assert page.evaluate('coach.view().messages.length')==0
        assert page.evaluate('coach.view().phase')=='idle'
        assert page.evaluate('fixture.requests.length')==2
        print('PASS: hiding the page releases microphone, clears dialogue and cancels unsent audio',flush=True)
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false})")
        page.evaluate('()=>coach.check()')
        page.evaluate('fixture.oversize=true')
        page.evaluate("()=>coach.startRecording('play')")
        page.evaluate('()=>coach.finishRecording()')
        page.wait_for_function("coach.view().phase==='error'")
        assert page.evaluate('fixture.activeTracks')==0
        assert page.evaluate("fixture.requests.filter(r=>r.operation==='turn').length")==1
        assert not errors,errors
        print('PASS: oversized recording stays on the device and cannot become a paid turn',flush=True)
        browser.close()
    (ROOT/'artifacts').mkdir(exist_ok=True)
    (ROOT/'artifacts/learning-coach-browser-results.json').write_text(json.dumps({'checks':3,'pageErrors':errors,'realProviderUsed':False},indent=2))

if __name__=='__main__':main()
