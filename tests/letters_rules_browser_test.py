"""Real app DOM and domain via local demo fixtures. No live family mutations or paid API."""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'preview.html').read_text();errors=[];checks=[]
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    for width in (390,1024):
        ctx=browser.new_context(viewport={'width':width,'height':1000},locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce')
        tab=ctx.new_page();tab.set_default_timeout(6000);tab.on('pageerror',lambda e:errors.append(str(e)))
        tab.evaluate('''()=>{const map=new Map([['praise-star.demo-actor','child']]);window.__store=map;const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}}''')
        tab.set_content(HTML,wait_until='load');expect(tab.locator('#main-content')).to_be_visible()
        def state():return tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")
        def visible_rules():return [r for r in state().get('praiseRules',[]) if not r.get('deleted',False)]
        def nav(name):
            menu='.mobile-nav' if width<=760 else '.sidebar nav'
            tab.locator(f'{menu} [data-nav="{name}"]').click()
        def role(name):
            tab.locator('.user-switch').click();tab.locator(f'[data-demo-role="{name}"]').click()
        def close():tab.locator('#modal .dialog-close').click()
        def say_rule(rule_id,day_action=None):
            tab.locator(f'[data-action="give-rule"][data-id="{rule_id}"]').click()
            if day_action:tab.locator(f'#rule-praise-form [data-action="{day_action}"]').click()
            tab.locator('#rule-praise-form button[type="submit"]').click()
        # Read all original letters using real UI. Reading never grants/spends stars.
        before=state();original_count=len(before['praises'])
        for _ in range(original_count):
            tab.locator('.mail-hero [data-action="open-letter"]').click();tab.locator('[data-action="read-letter"]').click()
        assert state()['balance']==before['balance'];assert state()['ledger']==before['ledger']
        expect(tab.locator('.mail-hero')).to_have_count(0);expect(tab.locator('.mail-empty')).to_contain_text('새 편지가 아직 없어요')
        tab.locator('#main-content [data-nav="letter-archive"]').click();expect(tab.locator('.letter-card')).to_have_count(original_count)
        tab.locator('[data-action="open-letter"]').first.click();expect(tab.locator('[data-action="read-letter"]')).to_have_count(0);close()
        tab.screenshot(path=str(OUT/f'letters-archive-{width}.png'),full_page=True)
        # Explicit past date is independent of issuance and creates a new unread letter.
        role('dad');nav('praise');tab.locator('#praise-reason').fill('어제 어려운 문제를 다시 생각한 노력이 멋졌어!')
        tab.locator('[data-action="praise-date-yesterday"]').click();yesterday=tab.locator('#praise-form [name="praiseDate"]').input_value()
        expect(tab.locator('#praise-preview-date')).to_contain_text(yesterday)
        tab.screenshot(path=str(OUT/f'praise-date-{width}.png'),full_page=True)
        tab.locator('#praise-form button[type="submit"]').click();assert state()['praises'][-1]['praiseDate']==yesterday
        assert state()['praises'][-1]['createdAt']==state()['ledger'][-1]['createdAt'];assert state()['balance']==before['balance']+1
        expect(tab.locator('#praise-reason')).to_have_value('')
        nav('family');tab.locator('[data-nav="rules"]').click()
        # New rule, order changes including reload, and deletion with retained receipts.
        tab.locator('[data-action="edit-rule"]:not([data-id])').click();tab.locator('#rule-form [name="title"]').fill('사용한 블록 정리하기')
        tab.locator('#rule-form [name="description"]').fill('놀고 나서 블록을 상자에 넣어요.')
        tab.locator('#rule-form button[type="submit"]').click();r=next(r for r in visible_rules() if r['title']=='사용한 블록 정리하기');rid=r['id']
        order=[r['id'] for r in visible_rules()];first=order[0];tab.locator(f'[data-rule-id="{first}"] [data-action="move-rule-down"]').click()
        changed=order[:];changed[0],changed[1]=changed[1],changed[0];assert [r['id'] for r in visible_rules()]==changed
        assert tab.locator('.rules-list .promise-card').first.get_attribute('data-rule-id')==changed[0]
        tab.locator(f'[data-rule-id="{rid}"] [data-action="move-rule-up"]').click();saved_order=[r['id'] for r in visible_rules()]
        tab.screenshot(path=str(OUT/f'rule-management-{width}.png'),full_page=True)
        nav('praise');say_rule(rid);balance=state()['balance'];say_rule(rid)
        expect(tab.locator('#modal .dialog-error')).to_contain_text('선택한 날짜');assert state()['balance']==balance;close()
        say_rule(rid,'praise-date-yesterday');assert state()['balance']==balance+r['stars']
        nav('family');tab.locator('[data-nav="rules"]').click();prior=state()
        tab.locator(f'[data-rule-id="{rid}"] [data-action="delete-rule"]').click();close();assert state()==prior
        tab.locator(f'[data-rule-id="{rid}"] [data-action="delete-rule"]').click();tab.locator('[data-action="confirm-action"]').click()
        expect(tab.locator(f'[data-rule-id="{rid}"]')).to_have_count(0)
        after=state();assert after['praises']==prior['praises'];assert after['ledger']==prior['ledger'];assert after['balance']==prior['balance']
        role('child');expect(tab.locator('.mail-hero')).to_contain_text('사용한 블록 정리하기')
        tab.screenshot(path=str(OUT/f'unread-letter-home-{width}.png'),full_page=True)
        tab.locator('.mail-hero [data-action="open-letter"]').click();expect(tab.locator('#modal')).to_contain_text('칭찬일자');expect(tab.locator('#modal')).to_contain_text('보낸 시각')
        tab.locator('[data-action="read-letter"]').click();tab.locator('#main-content [data-nav="letter-archive"]').click()
        expect(tab.locator('.letter-card')).to_have_count(original_count+1)
        tab.locator('#main-content [data-nav="letters"]').click();expect(tab.locator('.letter-card')).to_have_count(2)
        assert tab.locator('.letter-card').filter(has_text='어제 어려운 문제').count()==1
        nav('earn');assert tab.locator('[data-rule-id]').count()==len(saved_order)-1
        expect(tab.locator(f'[data-rule-id="{rid}"]')).to_have_count(0)
        assert tab.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        saved=state();tab.set_content(HTML,wait_until='load');expect(tab.locator('#main-content')).to_be_visible();assert state()==saved
        checks.append(f'{width}px: unread-only hero, archive/read transition, backdated issuance, day caps, rule reorder/delete/history, reload')
        print('PASS:',checks[-1],flush=True);ctx.close()
    assert not errors,errors;browser.close()
(OUT/'letters-rules-browser-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'liveFamilyMutations':False},ensure_ascii=False,indent=2))
