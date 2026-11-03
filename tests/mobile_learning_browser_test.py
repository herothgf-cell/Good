"""Real UI geometry and progression. Media/provider boundaries are simulated; no paid API calls."""
import json, os, re, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
SIZES = [(360,640),(390,844),(844,390),(768,1024),(1024,768)]

def main():
    out=ROOT/'artifacts'; out.mkdir(exist_ok=True)
    checks=[]; errors=[]
    bundle=re.search(r'<script>(.*)</script>',(ROOT/'preview.html').read_text(),re.S).group(1).replace("load('src/main.js');",'window.__testLoad=load;')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
        for width,height in SIZES:
            page=browser.new_page(viewport={'width':width,'height':height},locale='ko-KR')
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*',lambda route:route.abort())
            page.set_content('<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main><nav class="mobile-nav" aria-label="주 메뉴"><button data-nav="home"><span class="nav-icon">⌂</span>홈</button><button data-nav="learning"><span class="nav-icon">📚</span>학습</button></nav></body></html>')
            page.add_style_tag(content=(ROOT/'dist/styles.css').read_text())
            page.add_script_tag(content=bundle)
            page.evaluate('''()=>{
              if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};
              const {LearningLabController}=__testLoad('src/learning-lab.js');
              const {emptyState,applyAction}=__testLoad('supabase/functions/_shared/domain.js');
              let snapshot={state:emptyState(),me:{id:'p',name:'보호자',role:'admin'},familyId:'f',members:[],revision:0};
              const state={phase:'ready',available:true,message:'말하거나 글을 입력해 주세요.',messages:[],turns:0};let lab;
              const render=()=>{document.querySelector('#app').innerHTML=lab.render(snapshot);lab.afterRender();};
              const coach={view:()=>structuredClone(state),leave(){state.messages=[];state.phase='ready';},stopAudio(){},check:async()=>{},startRecording:async()=>{state.phase='recording';state.message='목소리를 듣고 있어요.';render();},finishRecording:async()=>{state.phase='ready';state.message='보냈어요.';render();},sendText:async text=>{state.messages.push({role:'user',text});render();}};
              lab=new LearningLabController({snapshot:()=>snapshot,render,toast(){},coach,perform:async action=>{snapshot.state=applyAction(snapshot.state,action,{actor:snapshot.me,now:'2026-11-03T01:00:00Z',newId:()=>crypto.randomUUID(),random:()=>0}).state;return true;}});
              document.addEventListener('click',e=>{const b=e.target.closest('[data-lab-action]');if(b)void lab.handleClick(b);});
              document.addEventListener('submit',e=>{if(e.target.matches('[data-lab-form]')){e.preventDefault();void lab.handleSubmit(e.target);}});
              window.fx={lab,snapshot,state,render,async open(){await lab.handleClick({dataset:{labAction:'start',lessonId:'english-conversation'}});},long(){state.messages=Array.from({length:24},(_,i)=>({id:String(i),role:i%2?'assistant':'user',text:i%2?'I like playing soccer with my family. What do you want to play today?':'I want to play soccer.',hasAudio:i%2===1}));render();},keyboard(h){const v=new EventTarget();Object.assign(v,{height:h,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:v});document.querySelector('#lab-coach-message').focus();v.dispatchEvent(new Event('resize'));},restoreKeyboard(){Object.defineProperty(window,'visualViewport',{configurable:true,value:undefined});document.querySelector('#lab-coach-message')?.blur();window.dispatchEvent(new Event('resize'));}};render();
            }''')
            page.evaluate('fx.open()');page.evaluate('fx.long()');page.wait_for_timeout(60)
            def visible_controls():
                return page.evaluate('''()=>{
                  const selectors=['[data-lab-action="coach-record"],[data-lab-action="coach-stop"]','.chat-composer button[type="submit"]'];
                  const nav=document.querySelector('.mobile-nav'),v=window.visualViewport;
                  const bottom=(v?.height??innerHeight)+(v?.offsetTop??0);
                  const navVisible=getComputedStyle(nav).display!=='none'&&getComputedStyle(nav).visibility!=='hidden';
                  const limit=navVisible?Math.min(bottom,nav.getBoundingClientRect().top):bottom;
                  return selectors.map(s=>{const el=document.querySelector(s),r=el.getBoundingClientRect();const center=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {selector:s,top:r.top,bottom:r.bottom,limit,height:r.height,hit:!!center&&el.contains(center),viewport:bottom};});
                }''')
            # Measure before any click; Playwright must not scroll the control into view for us.
            for rect in visible_controls():
                assert rect['top']>=0 and rect['bottom']<=rect['limit']+1 and rect['hit'],(width,height,rect)
            if width<=900:
                for rect in visible_controls():assert rect['top']>=0 and rect['bottom']<=rect['limit']+1 and rect['height']>=44 and rect['hit'],(width,height,rect)
                assert page.evaluate('document.querySelector(".lab-chat").scrollHeight>document.querySelector(".lab-chat").clientHeight')
                top=page.evaluate('scrollY');page.locator('.lab-chat').evaluate('e=>e.scrollTop=0');page.wait_for_timeout(25);page.evaluate('fx.render()')
                assert page.locator('.lab-chat').evaluate('e=>e.scrollTop')==0
                assert page.evaluate('scrollY')==top
                page.locator('[data-lab-action="coach-record"]').click()
                for rect in visible_controls():assert rect['bottom']<=rect['limit']+1 and rect['hit'],rect
                page.locator('[data-lab-action="coach-stop"]').click()
                page.evaluate('fx.keyboard(340)');page.wait_for_timeout(80)
                for rect in visible_controls():assert rect['bottom']<=rect['limit']+1 and rect['hit'],('keyboard',width,height,rect)
                assert page.locator('.mobile-nav').evaluate('e=>getComputedStyle(e).visibility')=='hidden'
                page.evaluate('fx.restoreKeyboard()');page.wait_for_timeout(80)
                page.locator('.lab-chat').evaluate('e=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(25)
                page.screenshot(path=str(out/f'mobile-chat-{width}x{height}.png'))
            assert page.locator('[data-nav="learning"] .nav-icon').evaluate('e=>getComputedStyle(e,"::before").maskImage')!='none'
            page.locator('[data-lab-action="back"]').click()
            assert page.evaluate('!document.documentElement.classList.contains("learning-conversation-open")')
            assert page.locator('.mobile-nav').evaluate('e=>getComputedStyle(e).visibility')!='hidden'
            page.locator('[data-lesson-id="english-phonics"]').click()
            assert page.locator('[name="lab-evidence"],.lab-observation,[data-lab-action="observe"]').count()==0
            page.locator('[data-lab-action="practice-next"]').click()
            page.locator('[data-lab-action="practice-next"]').click()
            expect(page.locator('#lab-answer')).to_be_visible()
            page.locator('#lab-answer').fill('zzz');page.locator('[data-lab-form="answer"]').evaluate('e=>e.requestSubmit()')
            assert page.locator('[data-lab-action="next"]').count()==0,'wrong spelling must not advance'
            page.locator('#lab-answer').fill('fat');page.locator('[data-lab-form="answer"]').evaluate('e=>e.requestSubmit()');page.locator('[data-lab-action="next"]').click()
            page.screenshot(path=str(out/f'mobile-phonics-{width}x{height}.png'),full_page=True)
            for _ in range(20):
                if page.locator('.lab-summary').count():break
                if page.locator('[data-lab-action="practice-next"]').count():page.locator('[data-lab-action="practice-next"]').click()
                else:
                    page.locator('[data-lab-action="model"]').click();page.locator('[data-lab-action="review"]').click();page.locator('[data-lab-action="next"]').click()
            expect(page.locator('.lab-summary')).to_contain_text('연습 완료')
            assert page.evaluate('fx.snapshot.state.balance')==0
            result=page.evaluate('fx.snapshot.state.learningLab.previews.at(-1)')
            assert result['practiced']>0 and result['observed']==0
            assert result['correct']<result['total']
            # Route removal and role changes restore the mobile viewport.
            page.locator('[data-lab-action="back"]').click();page.evaluate('fx.open()')
            page.evaluate('fx.snapshot.me.role="child";fx.render()')
            assert page.locator('.lab-conversation').count()==0
            assert page.evaluate('!document.documentElement.classList.contains("learning-conversation-open")')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            checks.append(f'{width}x{height}: controls/layout, monochrome nav, ungraded practice, spelling guard and route cleanup')
            print('PASS:',checks[-1],flush=True);page.close()
        assert not errors,errors;browser.close()
    (out/'mobile-learning-browser-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'realProviderUsed':False,'physicalKeyboardTested':False},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
