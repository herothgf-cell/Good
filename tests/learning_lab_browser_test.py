"""Guardian learning v2 integration, offline ephemeral fixtures only.
Run after npm run build: python tests/learning_lab_browser_test.py.
Does not call real AI or production services. Screenshots go to artifacts/.
"""
import base64
import json
import os
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []
CHECKS = []

def passed(message):
    CHECKS.append(message)
    print('PASS:', message, flush=True)

def action(page, name):
    return page.locator(f'[data-lab-action="{name}"]')

def nav(page, screen):
    menu = '.mobile-nav' if page.viewport_size['width'] <= 760 else '.sidebar nav'
    page.locator(f'{menu} [data-nav="{screen}"]').click()

def role(page, actor):
    page.locator('.user-switch').click()
    page.locator(f'[data-demo-role="{actor}"]').click()

def overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    for control in page.locator('.lab-page button, .lab-page input, .lab-page select, .lab-page textarea').all():
        if not control.is_visible():
            continue
        box = control.bounding_box()
        assert box and box['x'] >= -1 and box['x'] + box['width'] <= page.viewport_size['width'] + 1, box
        assert box['height'] >= 40, box

def poll(page, change='poll'):
    page.evaluate("""change=>{const key='praise-star.demo.v1',oldValue=localStorage.getItem(key),v=JSON.parse(oldValue);
      v.revision++;if(change==='settings')v.state.learningLab.settingsVersion++;
      const newValue=JSON.stringify(v);localStorage.setItem(key,newValue);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue}));}""", change)

def main():
    out=ROOT/'artifacts';out.mkdir(exist_ok=True)
    html=(ROOT/'preview.html').read_text()
    with sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        def page(width=390):
            tab=browser.new_page(viewport={'width':width,'height':1000 if width>760 else 844},locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce')
            tab.on('pageerror',lambda e:ERRORS.append(str(e)))
            tab.route('**/*',lambda route:route.abort())
            tab.evaluate("""()=>{const memory=new Map([['praise-star.demo-actor','dad']]);window.__store=memory;
              const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(k==='praise-star.demo.v1'&&window.__failWriteOnce){window.__failWriteOnce=false;throw Error('fixture write failure');}memory.set(k,String(v));},removeItem:k=>memory.delete(k)};
              Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
              if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};
              window.__speech={spoken:[],canceled:0};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-US',localService:true}],cancel:()=>window.__speech.canceled++,speak:u=>window.__speech.spoken.push(u.text)}});
              Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(text){this.text=text;}});
              window.__microphoneRequests=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{window.__microphoneRequests++;return Promise.reject(Error('fixture no mic'));}}});
            }""")
            tab.set_content(html,wait_until='load')
            # Local test-only font data keeps screenshots legible in minimal CI images.
            fonts=Path('/tmp/good-learning-fonts')
            if (fonts/'NotoSansCJKkr-Regular.otf').exists():
                regular=base64.b64encode((fonts/'NotoSansCJKkr-Regular.otf').read_bytes()).decode()
                bold=base64.b64encode((fonts/'NotoSansCJKkr-Bold.otf').read_bytes()).decode()
                tab.add_style_tag(content=f"@font-face{{font-family:LabBrowserKorean;src:url(data:font/otf;base64,{regular});font-weight:400}}@font-face{{font-family:LabBrowserKorean;src:url(data:font/otf;base64,{bold});font-weight:700}}body{{font-family:LabBrowserKorean,sans-serif!important}}")
                tab.evaluate('document.fonts.ready')
            expect(tab.locator('#main-content')).to_be_visible();nav(tab,'learning');return tab
        tab=page()
        expect(tab.locator('.lab-heading')).to_contain_text('보호자 전용 · 아이 미공개')
        expect(action(tab,'start')).to_have_count(9)
        expect(tab.locator('[data-lab-form="settings"]')).to_be_visible()
        before=tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state.balance")
        tab.locator('[name="phonics"]').select_option('silent-e');tab.locator('.lab-heading h1').click();poll(tab)
        expect(tab.locator('[name="phonics"]')).to_have_value('silent-e')
        overflow(tab);tab.screenshot(path=str(out/'learning-v2-home-390.png'),full_page=True)
        passed('phone guardian home contains nine activities, usable controls, and preserves unsaved settings across poll')
        action(tab,'reset-settings').last.click()
        tab.locator('[data-lab-action="start"][data-lesson-id="math-calculation"]').click()
        expect(tab.locator('[data-lab-form="answer"]')).to_be_visible()
        tab.locator('#lab-answer').fill('42');tab.locator('#lab-question-title').click();poll(tab);expect(tab.locator('#lab-answer')).to_have_value('42')
        action(tab,'digit').filter(has_text='지우기').click()
        tab.locator('[data-digit="1"]').click();tab.locator('[data-digit="2"]').click();expect(tab.locator('#lab-answer')).to_have_value('12')
        tab.locator('[data-digit="back"]').click();expect(tab.locator('#lab-answer')).to_have_value('1')
        maximum=int(tab.locator('.lab-progress').get_attribute('aria-valuemax'));assert 4<=maximum<=10
        for i in range(maximum):
            prompt=tab.locator('#lab-question-title').inner_text()
            a,op,b=re.search(r'(\d+)\s*([+−])\s*(\d+)',prompt).groups();answer=int(a)+int(b) if op=='+' else int(a)-int(b)
            tab.locator('#lab-answer').fill(str(answer));tab.locator('#lab-answer').press('Enter')
            expect(action(tab,'next')).to_be_visible()
            if i==maximum-1:tab.evaluate('window.__failWriteOnce=true')
            action(tab,'next').click()
        expect(tab.locator('.lab-summary')).to_be_visible();expect(tab.locator('.lab-save-status')).to_contain_text('아직 저장하지 못했어요')
        action(tab,'retry-save').click();expect(tab.locator('.lab-save-status')).to_contain_text('저장했어요')
        runs=tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state.learningLab.previews")
        assert len(runs)==1 and runs[0]['total']==maximum and runs[0]['stars']==0
        assert tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state.balance")==before
        passed('direct numeric keyboard submission traverses dynamic steps; failed save retries once with zero reward')
        action(tab,'back').click();tab.locator('[data-lab-action="start"][data-lesson-id="english-words"]').click()
        expect(tab.locator('.lab-target')).to_be_visible();action(tab,'listen').click()
        assert len(tab.evaluate('window.__speech.spoken'))==1
        action(tab,'observe').filter(has_text='스스로').click();action(tab,'next').click()
        expect(tab.locator('[data-practice-mode="recall"]')).to_be_visible();expect(tab.locator('.lab-target')).to_have_count(0)
        action(tab,'model').click();expect(tab.locator('.lab-target')).to_be_visible()
        canceled=tab.evaluate('window.__speech.canceled');action(tab,'pause').first.click();expect(tab.locator('.lab-paused')).to_be_visible()
        assert tab.evaluate('window.__speech.canceled')>canceled
        action(tab,'pause').first.click();tab.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(tab.locator('.lab-paused')).to_be_visible();tab.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false})")
        passed('recall hides target and audio lifecycle pauses on button and hidden document')
        action(tab,'back').click();tab.locator('[data-lab-action="start"][data-lesson-id="english-reading"]').click()
        action(tab,'observe').filter(has_text='스스로').click();action(tab,'next').click()
        expect(tab.locator('[data-practice-mode="read"] .lab-target')).to_be_visible()
        action(tab,'back').click();tab.locator('[data-lab-action="start"][data-lesson-id="math-clock"]').click();expect(tab.locator('svg.lab-clock')).to_have_count(1)
        poll(tab,'settings');expect(tab.locator('.lab-paused')).to_contain_text('설정이 바뀌었어요');expect(action(tab,'restart')).to_be_visible()
        action(tab,'restart').click();expect(tab.locator('[data-lab-form="answer"]')).to_be_visible()
        action(tab,'back').click();tab.locator('[data-lab-action="start"][data-lesson-id="english-conversation"]').click()
        action(tab,'legacy-coach-toggle').click()
        expect(tab.locator('.lab-coach')).to_contain_text('보호자 목소리로 AI 연결 테스트');expect(tab.locator('.lab-question')).to_contain_text('시나리오 미리보기')
        expect(action(tab,'coach-record')).to_be_disabled();tab.locator('#lab-coach-message').fill('Adult test message');action(tab,'coach-check').click();expect(tab.locator('#lab-coach-message')).to_have_value('Adult test message');expect(tab.locator('.lab-progress')).to_have_attribute('aria-valuenow','1');expect(tab.locator('.lab-coach-status')).to_contain_text(re.compile('체험|설정|연결'))
        assert tab.evaluate('window.__microphoneRequests')==0
        passed('reading exposes independent reading text; clocks render exactly; stale sessions restart; real AI status remains separate from scenario')
        role(tab,'child');expect(tab.locator('.lab-page')).to_have_count(0);expect(tab.locator('[data-nav="learning"]')).to_have_count(0)
        role(tab,'grandma');expect(tab.locator('.lab-page')).to_have_count(0)
        passed('child and giver have no lab UI or navigation')
        ipad=page(1024);overflow(ipad);ipad.screenshot(path=str(out/'learning-v2-home-1024.png'),full_page=True)
        ipad.locator('[name="moneyUnit"]').select_option('100');ipad.locator('[name="calendarLevel"]').select_option('2')
        ipad.locator('[name="patternLevel"]').select_option('2');ipad.locator('[data-lab-form="settings"] button[type="submit"]').click()
        expect(ipad.locator('#toast')).to_contain_text('설정')
        for lesson in ['math-transfer','math-calendar','math-groups','math-patterns']:
            ipad.locator(f'[data-lab-action="start"][data-lesson-id="{lesson}"]').click()
            if lesson=='math-transfer':
                assert ipad.locator('.lab-coin').count()>=4;expect(ipad.locator('.lab-bill')).to_have_count(0)
            if lesson=='math-calendar':
                expect(ipad.locator('.lab-calendar')).to_have_count(2);expect(ipad.locator('.lab-day-target')).to_have_count(0)
            overflow(ipad);ipad.screenshot(path=str(out/f'learning-v2-{lesson}-1024.png'),full_page=True);action(ipad,'back').click()
        passed('iPad catalog and structured money/calendar/group/pattern views fit viewport')
        assert not ERRORS,ERRORS
        (out/'learning-v2-browser-results.json').write_text(json.dumps({'checks':CHECKS,'errors':ERRORS},ensure_ascii=False,indent=2))
        browser.close()

if __name__=='__main__':main()
