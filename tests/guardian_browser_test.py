"""Guardian controls on real rendered code with browser-local demo storage only."""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'preview.html').read_text()
checks=[]
def passed(name): checks.append(name);print('PASS:',name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    errors=[]
    def page_at(width=1440):
        page=browser.new_page(viewport={'width':width,'height':1000},locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce')
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.evaluate('''() => {const m=new Map();const s={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
        Object.defineProperty(window,'localStorage',{value:s});Object.defineProperty(window,'sessionStorage',{value:s});
        if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);};}''')
        page.set_content(HTML)
        expect(page.locator('[data-testid="wallet"]')).to_have_text('23')
        page.locator('.user-switch').click();page.locator('[data-demo-role="dad"]').click()
        return page
    def state(page):return page.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1'))")
    def nav(page,key):
        if page.viewport_size['width']<900:
            page.locator('[data-action="more-menu"]').click();page.locator(f'#modal [data-nav="{key}"]').click()
        else:page.locator(f'.sidebar [data-nav="{key}"]').click()
    page=page_at()
    nav(page,'family');page.locator('[data-action="rename-member"][data-id="mom"]').click()
    page.locator('#rename-member-form input').fill('엄마 수정');page.locator('#rename-member-form button[type="submit"]').click()
    expect(page.locator('#modal')).not_to_be_visible();expect(page.locator('.member-list')).to_contain_text('엄마 수정')
    assert next(x for x in state(page)['members'] if x['id']=='mom')['role']=='admin'
    passed('rename UI persists display name without changing role')

    page.locator('[data-action="rename-member"][data-id="mom"]').click()
    page.locator('#rename-member-form input').fill('<b>엄마</b>');page.locator('#rename-member-form button[type="submit"]').click()
    expect(page.locator('#modal')).not_to_be_visible();page.locator('.user-switch').click()
    expect(page.locator('[data-demo-role="mom"] strong')).to_have_text('<b>엄마</b>')
    assert page.locator('[data-demo-role="mom"] b').count()==0
    page.locator('[data-action="close-modal"]').click()
    passed('renamed member text is escaped in role picker')

    nav(page,'praise');page.locator('[data-action="grant-stars"]').click();page.locator('#grant-stars-form [name="stars"]').fill('13')
    page.locator('#grant-stars-form [name="reason"]').fill('초기 별 지급 <b>검증</b>')
    page.locator('#grant-stars-form button[type="submit"]').click();expect(page.locator('[data-testid="wallet"]')).to_have_text('23')
    expect(page.locator('#modal')).to_contain_text('초기 별 지급 <b>검증</b>');assert page.locator('#modal b').count()==0
    page.locator('[data-action="confirm-action"]').click();expect(page.locator('[data-testid="wallet"]')).to_have_text('36')
    assert state(page)['state']['ledger'][-1]['kind']=='grant'
    passed('star grant confirms first, escapes reason, records exactly +13')
    nav(page,'manage');page.locator('[data-action="grant-reward"][data-id="r-trip"]').click()
    page.locator('#grant-reward-form [name="reason"]').fill('용기 낸 것을 축하해요')
    page.locator('#grant-reward-form button[type="submit"]').click();page.locator('[data-action="confirm-action"]').click()
    expect(page.locator('.celebration h2')).to_have_text('특별한 체험 나들이');expect(page.locator('[data-testid="wallet"]')).to_have_text('36')
    s=state(page)['state'];assert s['inventory'][-1]['source']=='gift';assert next(r for r in s['rewards'] if r['id']=='r-trip')['stock']==0
    page.locator('[data-action="go-inventory"]').click();expect(page.locator('.coupon-card').first).to_contain_text('보호자 선물')
    expect(page.locator('.coupon-card').first).to_contain_text('용기 낸 것을 축하해요')
    passed('direct reward creates gift coupon, consumes stock and preserves balance')
    nav(page,'manage');expect(page.locator('[data-action="grant-reward"][data-id="r-trip"]')).to_be_disabled()
    page.screenshot(path=str(OUT/'guardian-rewards-desktop.png'),full_page=True)
    passed('sold-out direct reward cannot be submitted again')
    nav(page,'family');page.screenshot(path=str(OUT/'guardian-family-desktop.png'),full_page=True)
    page.locator('.user-switch').click();page.locator('[data-demo-role="grandma"]').click();nav(page,'praise')
    expect(page.locator('[data-action="grant-stars"]')).to_have_count(0);nav(page,'family');expect(page.locator('[data-action="rename-member"]')).to_have_count(0)
    passed('giver cannot see guardian-only grant or rename controls')
    for width in [360,390]:
        mobile=page_at(width)
        for screen in ['family','manage','praise']:
            nav(mobile,screen)
            overflow=mobile.evaluate('document.documentElement.scrollWidth>window.innerWidth+1')
            assert not overflow,f'mobile overflow: {width} {screen}'
        mobile.locator('[data-action="grant-stars"]').click();expect(mobile.locator('#grant-stars-form')).to_be_visible()
        mobile.screenshot(path=str(OUT/f'guardian-stars-mobile-{width}.png'),full_page=True)
        assert not mobile.evaluate('document.documentElement.scrollWidth>window.innerWidth+1')
        passed(f'mobile {width}px guardian screens and grant dialog fit')
    assert not errors,errors
    passed('no browser runtime errors')
    browser.close()
(OUT/'guardian-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
print(f'Guardian UI: {len(checks)} checks passed.')
