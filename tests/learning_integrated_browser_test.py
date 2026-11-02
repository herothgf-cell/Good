"""Actual controllers + DOM; AI transport and audio-device boundary explicitly simulated."""
import json, os, shutil, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]

def main():
    out=ROOT/'artifacts';out.mkdir(exist_ok=True)
    errors=[];checks=[]
    with sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        for width in (390,1024):
            page=browser.new_page(viewport={'width':width,'height':950},locale='ko-KR')
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*',lambda route:route.abort())
            page.set_content('<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main></body></html>')
            page.add_style_tag(content=(ROOT/'dist/styles.css').read_text())
            bundle=re.search(r'<script>(.*)</script>',(ROOT/'preview.html').read_text(),re.S).group(1).replace("load('src/main.js');",'window.__testLoad=load;')
            page.add_script_tag(content=bundle)
            page.evaluate("""async()=>{
              const {LearningCoach}=__testLoad('src/learning-coach.js');const {LearningReader}=__testLoad('src/learning-reader.js');const {LearningLabController}=__testLoad('src/learning-lab.js');
              const {emptyState,applyAction}=__testLoad('supabase/functions/_shared/domain.js');
              const {resolvePhonicsAudio}=__testLoad('supabase/functions/_shared/phonics-curriculum.js');
              if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};
              window.fx={calls:[],plays:0,actions:[],blocked:true};let who={familyId:'family',actorId:'parent',role:'admin',mode:'cloud'};
              const wav=new Uint8Array(100000);wav.set([82,73,70,70]);wav.set([87,65,86,69],8);let binary='';for(let i=0;i<wav.length;i+=8192)binary+=String.fromCharCode(...wav.subarray(i,i+8192));
              const sound=text=>({mime:'audio/wav',base64:btoa(binary),transcript:text});
              window.Audio=class{async play(){fx.audio=this;fx.plays++;if(fx.blocked){fx.blocked=false;throw new DOMException('blocked','NotAllowedError');}}pause(){}removeAttribute(){}load(){}};
              Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak(){throw Error('device voice forbidden');},cancel(){}}});
              const snapshot={state:emptyState(),me:{id:'parent',name:'보호자',role:'admin'},familyId:'family',members:[],revision:0};
              const request=async body=>{fx.calls.push(body);if(body.operation==='status')return {available:true};if(body.operation==='read'){const text=resolvePhonicsAudio(body.unitId,body.itemId);return {speech:text,audio:sound(text)};}const text=body.text==='I play with my family.'?'That sounds fun. Do you play at the park?':body.text==='Yes, at the park.'?'Great! What do you like about soccer?':'Soccer sounds fun. Who will play with you?';return {transcript:body.text,reply:text,modelPhrase:'',hint:'누구와 함께 할까요?',speech:text,audio:sound(text)};};
              let lab;const render=()=>{if(!lab)return;document.querySelector('#app').innerHTML=lab.render(snapshot);lab.afterRender();};
              const host={identity:()=>who,request,render};const coach=new LearningCoach(host),reader=new LearningReader(host);
              lab=new LearningLabController({snapshot:()=>snapshot,render,toast(){},coach,reader,perform:async action=>{fx.actions.push(action);snapshot.state=applyAction(snapshot.state,action,{actor:snapshot.me,now:'2026-11-02T09:00:00Z',newId:()=>crypto.randomUUID(),random:()=>0}).state;return true;}});
              document.addEventListener('click',event=>{const button=event.target.closest('[data-lab-action]');if(button)void lab.handleClick(button);});
              document.addEventListener('submit',event=>{if(event.target.matches('[data-lab-form]')){event.preventDefault();void lab.handleSubmit(event.target);}});
              fx.finishAudio=()=>fx.audio?.onended?.();fx.leave=()=>{lab.leave();render();};fx.snapshot=()=>snapshot;fx.reader=reader;fx.coach=coach;render();
            }""")
            def action(name):return page.locator(f'[data-lab-action="{name}"]')
            page.locator('[data-lesson-id="english-conversation"]').click();action('coach-check').click()
            page.locator('#lab-coach-message').fill('I want to play soccer.');page.locator('[data-lab-form="coach"] button[type="submit"]').click()
            expect(page.locator('.lab-chat-assistant')).to_contain_text('Soccer sounds fun.')
            expect(action('coach-replay')).to_contain_text('소리 재생')
            calls=page.evaluate('fx.calls.length');action('coach-replay').click();assert page.evaluate('fx.calls.length')==calls
            expect(page.locator('.lab-coach-status')).to_contain_text('AI가 말하고 있어요')
            assert page.locator('[data-lab-action="realtime-start"]').count()==0
            page.evaluate('fx.finishAudio()')
            page.locator('#lab-coach-message').fill('I play with my family.');page.locator('[data-lab-form="coach"] button[type="submit"]').click()
            expect(page.locator('.lab-chat-assistant').last).to_contain_text('Do you play at the park?')
            page.evaluate('fx.finishAudio()');page.locator('#lab-coach-message').fill('Yes, at the park.');page.locator('[data-lab-form="coach"] button[type="submit"]').click()
            expect(page.locator('.lab-chat-assistant')).to_have_count(3);expect(page.locator('.lab-chat-user')).to_have_count(3)
            assert page.locator('.lab-chat-user').last.evaluate('e=>getComputedStyle(e).alignSelf')=='flex-end'
            assert page.locator('.lab-chat-assistant').last.evaluate('e=>getComputedStyle(e).alignSelf')=='flex-start'
            assert page.locator('#lab-coach-message').input_value()==''
            page.screenshot(path=str(out/f'integrated-chat-{width}.png'),full_page=True)
            page.evaluate('fx.finishAudio()');action('back').click();page.locator('[data-lesson-id="english-phonics"]').click()
            expect(page.locator('.lab-target')).to_have_text('fat');expect(page.locator('.lab-listen')).to_contain_text('AI가 생성한')
            page.evaluate('fx.finishAudio()');calls=page.evaluate('fx.calls.length');action('reader-replay').click();assert page.evaluate('fx.calls.length')==calls
            page.evaluate('fx.finishAudio()');action('observe').filter(has_text='도움받았어요').click();action('next').click()
            assert page.evaluate('fx.calls.length')==calls,'independent read must not auto-play model'
            action('observe').filter(has_text='스스로').click();action('next').click()
            for letter in 'fat':page.locator(f'[data-letter="{letter}"]').click()
            expect(page.locator('#lab-answer')).to_have_value('fat');page.screenshot(path=str(out/f'integrated-phonics-writing-{width}.png'),full_page=True)
            page.locator('#lab-answer').press('Enter');action('next').click();expect(page.locator('.lab-target')).to_have_text('jam')
            # Finish the remaining stages with honest observations/review markers.
            for _ in range(12):
                if page.locator('.lab-summary').count():break
                page.evaluate('fx.finishAudio()')
                if page.locator('[data-practice-mode]').count():action('observe').filter(has_text='도움받았어요').click()
                else:action('model').click();action('review').click()
                action('next').click()
            expect(page.locator('.lab-save-status')).to_contain_text('저장했어요')
            assert page.evaluate('fx.snapshot().state.balance')==0
            assert all('ink' not in json.dumps(a) and 'base64' not in json.dumps(a) for a in page.evaluate('fx.actions'))
            action('phonics-continue').click();expect(page.locator('.lab-target')).to_have_text('can')
            page.evaluate('fx.leave()');assert page.evaluate('fx.reader.view().canReplay') is False
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            checks.append(f'{width}px: same-chat AI audio/replay, ordered course/read/write/next words, private zero-reward completion and cleanup')
            print('PASS:',checks[-1],flush=True);page.close()
        assert not errors,errors;browser.close()
    (out/'integrated-browser-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'realProviderUsed':False},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
