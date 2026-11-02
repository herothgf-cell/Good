"""Actual app/controller tests with demo storage; no production family writes or paid APIs."""
import json,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def passed(label):checks.append(label);print('PASS:',label,flush=True)
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    def make(width=390):
        ctx=browser.new_context(viewport={'width':width,'height':950},locale='ko-KR',timezone_id='Asia/Seoul')
        page=ctx.new_page();page.set_default_timeout(4000);page.on('pageerror',lambda e:errors.append(str(e)))
        page.evaluate('''()=>{const map=new Map([['praise-star.demo-actor','dad']]);const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}}''')
        page.set_content((ROOT/'preview.html').read_text());expect(page.locator('#main-content')).to_be_visible();return page
    def state(page):return page.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")
    def nav(page,screen):page.locator(('.mobile-nav' if page.viewport_size['width']<=760 else '.sidebar nav')+f' [data-nav="{screen}"]').click()
    def role(page,who):page.locator('.user-switch').click();page.locator(f'[data-demo-role="{who}"]').click()
    def submit_rule(page):page.locator('#rule-praise-form button[type=submit]').click()
    def no_overflow(page):assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    for width in [390,1024]:
        page=make(width);nav(page,'praise');page.locator('[data-action="give-rule"][data-id="rule-tidy"]').click()
        expect(page.locator('#rule-praise-form')).to_be_visible()
        page.locator('#rule-praise-form [data-day=yesterday]').click();yesterday=page.locator('#rule-praise-form [name=praiseDate]').input_value();before=state(page)
        submit_rule(page);after=state(page)
        assert after['praises'][-1]['praiseDate']==yesterday;assert after['balance']==before['balance']+1
        assert after['ledger'][-1]['createdAt']==after['praises'][-1]['createdAt']
        page.locator('[data-action="give-rule"][data-id="rule-tidy"]').click();submit_rule(page)
        assert state(page)['balance']==after['balance']+1
        page.locator('[data-action="give-rule"][data-id="rule-tidy"]').click();expect(page.locator('#rule-praise-form button[type=submit]')).to_be_disabled()
        page.locator('#rule-praise-form [data-day=yesterday]').click();expect(page.locator('#rule-praise-form button[type=submit]')).to_be_disabled();page.locator('#modal .dialog-close').click()
        passed(f'{width}px quick praise: yesterday/today separate quotas; duplicate blocked; real send timestamp')
        page.locator('#praise-reason').fill('어제 축구를 끝까지 연습한 모습이 멋졌어!')
        page.locator('#praise-form [data-day=yesterday]').click();expect(page.locator('#praise-preview-date')).not_to_be_empty()
        # The manual refresh must not discard the parent's unfinished letter/date.
        page.locator('.mode-banner [data-action=connect-cloud]').evaluate("e=>e.dataset.action='refresh'");page.locator('.mode-banner [data-action=refresh]').click()
        expect(page.locator('#praise-reason')).to_have_value('어제 축구를 끝까지 연습한 모습이 멋졌어!');expect(page.locator('#praise-form [name=praiseDate]')).to_have_value(yesterday)
        page.screenshot(path=str(OUT/f'praise-date-{width}.png'),full_page=True)
        page.locator('#praise-form button[type=submit]').click();assert state(page)['praises'][-1]['praiseDate']==yesterday
        expect(page.locator('#praise-reason')).to_have_value('');passed(f'{width}px manual praise: draft/date survives refresh, clears only on successful send')
        nav(page,'family');page.locator('[data-nav=rules]').click();ids=page.locator('.rules-list [data-rule-id]').evaluate_all('(els)=>els.map(e=>e.dataset.ruleId)')
        ledger=state(page)['ledger'];page.locator(f'[data-action=move-rule-down][data-id="{ids[0]}"]').click()
        assert page.locator('.rules-list [data-rule-id]').nth(1).get_attribute('data-rule-id')==ids[0]
        expect(page.locator('.rules-list [data-action=move-rule-up]').first).to_be_disabled()
        page.locator(f'[data-action=delete-rule][data-id="{ids[0]}"]').click();expect(page.locator('#modal')).to_contain_text('이전 칭찬');page.locator('[data-action=confirm-action]').click()
        assert page.locator(f'.rules-list [data-rule-id="{ids[0]}"]').count()==0
        assert next(r for r in state(page)['praiseRules'] if r['id']==ids[0])['deletedAt'];assert state(page)['ledger']==ledger
        page.screenshot(path=str(OUT/f'rule-management-{width}.png'),full_page=True);no_overflow(page);passed(f'{width}px reorder/delete: accessible buttons, list persisted, previous awards retained')
        role(page,'child');expect(page.locator('.mail-hero')).to_contain_text('어제 축구');page.screenshot(path=str(OUT/f'child-unread-{width}.png'),full_page=True)
        # Mark all except the latest read through shared demo storage to test the final unread transition.
        page.evaluate('''()=>{const k='praise-star.demo.v1',oldValue=localStorage.getItem(k),v=JSON.parse(oldValue);v.state.readPraiseIds=v.state.praises.slice(0,-1).map(p=>p.id);v.revision++;const newValue=JSON.stringify(v);localStorage.setItem(k,newValue);window.dispatchEvent(new StorageEvent('storage',{key:k,oldValue,newValue}));}''')
        page.locator('.mail-hero [data-action=open-letter]').click();expect(page.locator('#modal')).to_contain_text('칭찬한 날');assert len(state(page)['readPraiseIds'])==len(state(page)['praises'])-1
        page.locator('[data-action=read-letter]').click();expect(page.locator('.mail-hero')).to_have_count(0);expect(page.locator('.mail-empty')).to_contain_text('모두 읽었어요')
        page.locator('[data-nav=letter-archive]').first.click();expect(page.locator('.archive-card')).to_have_count(len(state(page)['praises']));expect(page.locator('.letter-archive-list')).to_contain_text('어제 축구')
        page.locator('.archive-card').first.click();expect(page.locator('[data-action=read-letter]')).to_have_count(0);page.locator('#modal .dialog-close').click()
        page.screenshot(path=str(OUT/f'child-archive-{width}.png'),full_page=True);no_overflow(page);passed(f'{width}px unread-only home and explicit read → compact archive, no double award')
        role(page,'dad');nav(page,'learning');expect(page.locator('.lab-catalog [data-lesson-id=english-phonics]')).to_have_count(1)
        expect(page.locator('[data-lesson-id=english-words],[data-lesson-id=english-reading]')).to_have_count(0)
        page.locator('[data-lesson-id=english-conversation]').click();expect(page.locator('.lab-chat')).to_be_visible();expect(page.locator('[data-lab-form=coach]')).to_be_visible();expect(page.locator('[data-lab-action=realtime-start]')).to_have_count(0)
        page.screenshot(path=str(OUT/f'integrated-chat-app-{width}.png'),full_page=True);no_overflow(page);passed(f'{width}px actual app routing: single text/audio chat, merged phonics; no separate voice screen')
        page.context.close()
    browser.close()
assert not errors,errors
(OUT/'praise-management-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'productionWrites':False},ensure_ascii=False,indent=2))
