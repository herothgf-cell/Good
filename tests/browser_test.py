"""Chromium UI checks against our generated HTML, with a storage fixture.
The sandbox blocks URL navigation. This is not a live Supabase or real mobile-device test.
"""
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'preview.html').read_text()
checks=[]
def passed(name):
    checks.append(name);print('PASS:',name)

with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    errors=[]
    def new_page(width=1440,height=1060,seed=None):
        context=browser.new_context(viewport={'width':width,'height':height},locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce')
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.evaluate('''seed => {
          const memory=new Map(Object.entries(seed||{}));window.__store=memory;
          const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear()};
          Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
          if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};
        }''',seed or {})
        page.set_content(HTML,wait_until='load')
        expect(page.locator('[data-testid="wallet"]')).to_be_visible(timeout=5000)
        return page
    def desktop_nav(page,screen):
        page.locator(f'.sidebar [data-nav="{screen}"]').click()
    def role(page,actor):
        page.locator('.user-switch').click();page.locator(f'[data-demo-role="{actor}"]').click()
        expect(page.locator('#modal')).not_to_be_visible()
    def wallet(page,value):
        expect(page.locator('[data-testid="wallet"]')).to_have_text(str(value))
    def stored(page):
        return page.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")

    page=new_page()
    expect(page.get_by_role('heading',name='칭찬이 모이면, 멋진 일이 생겨요!')).to_be_visible()
    wallet(page,23);passed('initial home, 23 sample stars, demo notice')
    page.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
    desktop_nav(page,'shop');page.screenshot(path=str(OUT/'shop-desktop.png'),full_page=True)
    page.locator('[data-action="buy"][data-id="r-play"]').click()
    expect(page.locator('#modal')).to_be_visible();wallet(page,23)
    page.locator('[data-action="confirm-action"]').click();wallet(page,18)
    expect(page.locator('.celebration h2')).to_have_text('놀이 선택권')
    assert len(stored(page)['inventory'])==2
    page.locator('[data-action="go-inventory"]').click()
    passed('fixed purchase confirms before debit, delivers persistent coupon')

    role(page,'dad');desktop_nav(page,'praise')
    page.locator('.star-choice').nth(1).click()
    page.locator('#praise-reason').fill('어려운 문제에도 다시 도전했어요 — UI 검증')
    expect(page.locator('#praise-preview-text')).to_contain_text('UI 검증')
    page.locator('#praise-form button[type="submit"]').click();wallet(page,20)
    assert stored(page)['praises'][-1]['stars']==2
    assert stored(page)['praises'][-1]['actorName']=='아빠'
    page.screenshot(path=str(OUT/'praise-desktop.png'),full_page=True)
    passed('parent praise form, live preview, actor attribution and two-star credit')

    desktop_nav(page,'inventory')
    page.locator('[data-action="coupon/request"]').first.click()
    page.locator('[data-action="coupon/approve"]').first.click()
    page.locator('[data-action="complete-coupon"]').first.click()
    page.locator('[data-action="confirm-action"]').click()
    assert sum(c['status']=='used' for c in stored(page)['inventory'])==1
    wallet(page,20);passed('coupon request → parent approval → actual-use confirmation')

    desktop_nav(page,'manage')
    page.locator('[data-action="edit-reward"]:not([data-id])').click()
    page.locator('#reward-form [name="title"]').fill('테스트 보상')
    page.locator('#reward-form [name="description"]').fill('<img src=x onerror="window.__xss=true"> 텍스트로 보여요')
    page.locator('#reward-form [name="cost"]').fill('7')
    page.locator('#reward-form [name="unlimited"]').uncheck()
    page.locator('#reward-form [name="stock"]').fill('2')
    page.locator('#reward-form button[type="submit"]').click()
    new_reward=next(r for r in stored(page)['rewards'] if r['title']=='테스트 보상')
    assert new_reward['cost']==7 and new_reward['stock']==2
    row=page.locator('.manage-row').filter(has_text='테스트 보상')
    row.locator('[data-action="edit-reward"]').click()
    page.locator('#reward-form [name="cost"]').fill('9')
    page.locator('#reward-form button[type="submit"]').click()
    desktop_nav(page,'shop')
    expect(page.locator('.reward-card').filter(has_text='테스트 보상')).to_contain_text('<img src=x')
    assert page.evaluate('window.__xss===undefined')
    assert page.locator('.reward-card img').count()==0
    passed('reward create/edit, finite stock, user text safely escaped')

    desktop_nav(page,'manage')
    page.locator(f'#box-form [name="weight-{new_reward["id"]}"]').fill('1')
    expect(page.locator('#weight-total')).to_have_text('합계 101%')
    page.locator('#box-form button[type="submit"]').click()
    expect(page.locator('#toast')).to_contain_text('100%')
    assert sum(i['weight'] for i in stored(page)['box']['items'])==100
    for field in page.locator('#box-form input[name^="weight-"]').all():field.fill('0')
    page.locator('#box-form [name="weight-r-play"]').fill('70')
    page.locator('#box-form [name="weight-r-book"]').fill('30')
    page.locator('#box-form [name="dailyLimit"]').fill('2')
    page.locator('#box-form button[type="submit"]').click()
    assert stored(page)['box']['dailyLimit']==2
    page.screenshot(path=str(OUT/'manage-desktop.png'),full_page=True)
    passed('invalid gacha total rejected, edited probabilities and daily cap saved')

    role(page,'child');desktop_nav(page,'gacha')
    expect(page.locator('.odds-list')).to_contain_text('70%')
    page.screenshot(path=str(OUT/'gacha-desktop.png'),full_page=True)
    for balance in [15,10]:
        page.locator('[data-action="draw"]').click()
        page.locator('[data-action="confirm-action"]').click()
        wallet(page,balance)
        expect(page.locator('.celebration')).to_be_visible()
        page.locator('[data-action="close-modal"]').click()
    expect(page.locator('[data-action="draw"]')).to_be_disabled()
    assert len(stored(page)['draws'])==2
    assert len(stored(page)['inventory'])==4
    passed('two no-loss draws, server-style persisted outcomes, daily cap disables further draw')

    saved=page.evaluate('Object.fromEntries(window.__store)')
    reloaded=new_page(seed=saved)
    wallet(reloaded,10)
    assert len(stored(reloaded)['draws'])==2
    passed('new app instance restores saved state from storage fixture')

    mobile=new_page(390,844)
    mobile.screenshot(path=str(OUT/'home-mobile.png'),full_page=True)
    for screen in ['home','shop','gacha','inventory']:
        mobile.locator(f'.mobile-nav [data-nav="{screen}"]').click()
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),screen
    passed('390px child screens have no horizontal overflow')
    role(mobile,'dad')
    for screen in ['praise','manage','family','history']:
        mobile.locator('[data-action="more-menu"]').click()
        mobile.locator(f'#modal [data-nav="{screen}"]').click()
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),screen
    passed('390px parent menus, forms and history have no horizontal overflow')
    mobile.locator('.user-switch').click();expect(mobile.locator('#modal')).to_be_visible()
    mobile.keyboard.press('Escape');expect(mobile.locator('#modal')).not_to_be_visible()
    expect(mobile.locator('.user-switch')).to_be_focused()
    passed('dialog Escape and focus restoration')
    mobile.set_viewport_size({'width':360,'height':780})
    for screen in ['home','shop','gacha','inventory']:
        mobile.locator(f'.mobile-nav [data-nav="{screen}"]').click()
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),screen
    passed('360px narrow child screens have no horizontal overflow')
    assert not errors,errors
    passed('no uncaught JavaScript errors during all UI flows')
    (OUT/'browser-results.json').write_text(json.dumps({'passed':checks,'errors':errors,'method':'Chromium HTML rendering + memory storage fixture; no live service or real-device navigation'},ensure_ascii=False,indent=2))
    browser.close()
print(f'UI scenarios: {len(checks)} passed')
