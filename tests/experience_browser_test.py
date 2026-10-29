"""Role-aware functional and responsive tests. Storage fixtures, not live family transactions."""
import json,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'preview.html').read_text();checks=[];measurements=[];errors=[]
def passed(name): checks.append(name);print('PASS:',name,flush=True)
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    def page(width=390,height=844,actor='child',seed=None):
        ctx=browser.new_context(viewport={'width':width,'height':height},locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce')
        tab=ctx.new_page();tab.set_default_timeout(7000);tab.on('pageerror',lambda e:errors.append(str(e)))
        tab.evaluate('''seed=>{const map=new Map(Object.entries(seed));window.__store=map;const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}}''',seed or {'praise-star.demo-actor':actor})
        tab.set_content(HTML,wait_until='load');expect(tab.locator('#main-content')).to_be_visible();return tab
    def state(tab):return tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")
    def nav(tab,screen):
        menu='.mobile-nav' if tab.viewport_size['width']<=760 else '.sidebar nav'
        tab.locator(f'{menu} [data-nav="{screen}"]').click()
    def role(tab,who):
        tab.locator('.user-switch').click();tab.locator(f'[data-demo-role="{who}"]').click();expect(tab.locator('#modal')).not_to_be_visible()
    def close(tab):tab.locator('#modal .dialog-close').click()
    def confirm(tab):tab.locator('#modal [data-action="confirm-action"]').click()
    tab=page()
    assert state(tab)['balance']==23
    expect(tab.locator('.mail-hero')).to_contain_text('칭찬 편지가 도착했어요')
    assert tab.locator('.mail-hero').bounding_box()['y']<220
    assert float(tab.locator('.mobile-nav [data-nav=home] > span').last.evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))<=14
    assert float(tab.locator('.mail-hero .letter-message').evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))>=20
    tab.screenshot(path=str(OUT/'v05-child-home-390.png'),full_page=True)
    passed('child home prioritizes new praise letters, 20px text and existing stars')
    tab.locator('.mail-hero [data-action="open-letter"]').click()
    expect(tab.locator('.letter-detail')).to_contain_text('칭찬 별')
    tab.screenshot(path=str(OUT/'v05-letter-390.png'))
    before=state(tab);tab.locator('[data-action="read-letter"]').click()
    assert len(state(tab)['readPraiseIds'])==1 and state(tab)['balance']==before['balance']
    assert state(tab)['ledger']==before['ledger'];passed('read letter persists without spending stars or rewriting ledger')
    nav(tab,'earn');expect(tab.locator('#main-content')).to_contain_text('장난감 정리하기');assert tab.locator('[data-action="give-rule"]').count()==0
    passed('child earning rules are visible without self-award controls')
    nav(tab,'shop');tab.locator('[data-action="buy"][data-id="r-play"]').click();assert state(tab)['balance']==23;confirm(tab)
    assert state(tab)['balance']==18;tab.locator('[data-action="go-inventory"]').click();passed('child purchase confirmation and coupon delivery retained')
    if not tab.locator('.coupon-group').first.get_attribute('open'):tab.locator('.coupon-group summary').first.click()
    tab.locator('[data-action="coupon/request"]').first.click();assert any(c['status']=='requested' for c in state(tab)['inventory'])
    role(tab,'dad');assert tab.locator('.mobile-nav [data-nav="shop"]').count()==0 and tab.locator('.mobile-nav [data-nav="gacha"]').count()==0
    expect(tab.locator('.admin-summary')).to_contain_text('승인 대기');passed('admin navigation removes actual purchase and draw and prioritizes pending requests')
    tab.screenshot(path=str(OUT/'v05-admin-home-390.png'),full_page=True)
    nav(tab,'inventory');tab.locator('[data-action="coupon/approve"]').first.click()
    tab.locator('[data-filter="approved"]').click();tab.locator('[data-action="complete-coupon"]').first.click();confirm(tab)
    assert any(c['status']=='used' for c in state(tab)['inventory']);passed('child request, parent approve, actual-use confirmation all retained')
    nav(tab,'praise');tab.locator('.star-choice').nth(1).click();tab.locator('#praise-reason').fill('한 번 더 도전한 마음이 정말 멋져!')
    tab.locator('#praise-form button[type=submit]').click();assert state(tab)['praises'][-1]['reason'].startswith('한 번 더')
    passed('manual praise delivers sender, stars and letter body')
    nav(tab,'family');tab.locator('[data-nav="rules"]').click();tab.locator('[data-action="edit-rule"]').first.click()
    tab.locator('#rule-form [name=title]').fill('오늘 책 한 권 읽기');tab.locator('#rule-form [name=description]').fill('좋아하는 책을 가족과 읽어요.')
    tab.locator('#rule-form [name=stars]').fill('2');tab.locator('#rule-form button[type=submit]').click()
    assert any(r['title']=='오늘 책 한 권 읽기' for r in state(tab)['praiseRules']);passed('admin can save earning rule without resetting old records')
    nav(tab,'praise');rule_button=tab.locator('[data-action="give-rule"]').filter(has_text='오늘 책 한 권 읽기');rule_button.click();before=state(tab)['balance'];confirm(tab)
    assert state(tab)['balance']==before+2;assert tab.locator('[data-action="give-rule"]').filter(has_text='오늘 책 한 권 읽기').is_disabled()
    passed('quick rule praise uses configured stars and disables exhausted daily allowance')
    nav(tab,'manage');tab.locator('[data-action="edit-reward"]:not([data-id])').click()
    form=tab.locator('#reward-form');form.locator('[name=title]').fill('키즈카페 30분 테스트');form.locator('[name=description]').fill('<img src=x onerror=alert(1)> 텍스트')
    form.locator('[name=cost]').fill('3');form.locator('[name=unlimited]').uncheck();form.locator('[name=stock]').fill('4')
    form.locator('[data-action="open-icon-picker"]').click();expect(tab.locator('#icon-modal')).to_be_visible()
    tab.locator('[data-icon-category="놀이·외출"]').click();tab.locator('#icon-modal [data-icon="🎠"]').click()
    expect(form.locator('[name=icon]')).to_have_value('🎠');expect(form.locator('[name=title]')).to_have_value('키즈카페 30분 테스트')
    passed('categorized icon popup preserves reward draft and updates hidden icon')
    form.locator('[data-action="open-icon-picker"]').click();tab.keyboard.press('Escape');expect(tab.locator('#icon-modal')).not_to_be_visible();expect(tab.locator('#modal')).to_be_visible()
    expect(form.locator('[data-action="open-icon-picker"]')).to_be_focused();passed('Escape dismisses only icon popup and restores focus to intact reward form')
    form.locator('[data-action="open-icon-picker"]').click()
    for _ in range(25):
        tab.keyboard.press('Tab');assert tab.evaluate("document.activeElement.closest('#icon-modal')!==null")
    tab.keyboard.press('Escape');passed('keyboard focus remains trapped in topmost icon modal')
    tab.evaluate("window.__oldConfirm=window.confirm;window.confirm=(msg)=>{window.__asked=msg;return false;}");tab.keyboard.press('Escape');expect(tab.locator('#modal')).to_be_visible();expect(form.locator('[name=title]')).to_have_value('키즈카페 30분 테스트')
    assert tab.evaluate('window.__asked').startswith('저장하지');tab.evaluate('window.confirm=window.__oldConfirm');passed('unsaved edit can be preserved when closing editor')
    tab.screenshot(path=str(OUT/'v05-reward-editor-390.png'))
    form.locator('button[type=submit]').click();reward=next(r for r in state(tab)['rewards'] if r['title']=='키즈카페 30분 테스트')
    card=tab.locator('.reward-admin-card').filter(has_text='키즈카페 30분 테스트');card.locator('[data-action="edit-reward"]').click();expect(tab.locator('#reward-form [name=description]')).to_contain_text('<img src=x')
    assert tab.locator('#reward-form img').count()==0;close(tab);passed('reward create/edit with finite stock and HTML-safe content retained')
    tab.locator('[name=rewardQuery]').fill('키즈카페');assert tab.locator('.reward-admin-card').count()==1;expect(tab.locator('[name=rewardQuery]')).to_be_focused()
    tab.locator('[name=rewardQuery]').fill('');tab.screenshot(path=str(OUT/'v05-admin-manage-390.png'),full_page=True);passed('reward search filters while maintaining input focus')
    card=tab.locator('.reward-admin-card').filter(has_text='키즈카페 30분 테스트');card.locator('[data-action="grant-reward"]').click();tab.locator('#grant-reward-form [name=quantity]').fill('3');tab.locator('#grant-reward-form [name=reason]').fill('특별한 도전 축하')
    tab.locator('#grant-reward-form button[type=submit]').click();before=state(tab)['balance'];confirm(tab)
    assert state(tab)['balance']==before;assert len([c for c in state(tab)['inventory'] if c['rewardId']==reward['id']])==3
    assert next(r for r in state(tab)['rewards'] if r['id']==reward['id'])['stock']==1;passed('bulk gift issues three individual coupons atomically without spending stars')
    nav(tab,'inventory');tab.locator('[data-filter=available]').click();group=tab.locator('.coupon-group').filter(has_text='키즈카페 30분 테스트');expect(group.locator('summary')).to_contain_text('3장');group.locator('summary').click()
    group.locator('[data-action="revoke-coupon"]').first.click();tab.locator('#correction-form [name=reason]').fill('한 장 중복 지급');tab.locator('#correction-form button[type=submit]').click();confirm(tab)
    assert len([c for c in state(tab)['inventory'] if c['status']=='revoked'])==1;passed('grouped coupons retain independent correction state and history')
    nav(tab,'manage');tab.locator('[data-nav=box]').click();before=state(tab);tab.locator('[data-action=simulate-draw]').click();expect(tab.locator('#modal')).to_contain_text('실제 지급 아님');close(tab);assert state(tab)==before
    passed('parent test draw is local-only and leaves entire family state unchanged')
    tab.locator('#box-form [name=title]').fill('새 선물 상자');tab.locator('#box-form button[type=submit]').click();assert state(tab)['box']['title']=='새 선물 상자'
    passed('separate draw settings still save with validated probabilities')
    nav(tab,'praise');tab.locator('[data-action=grant-stars]').click();tab.locator('#grant-stars-form [name=stars]').fill('4');tab.locator('#grant-stars-form [name=reason]').fill('지급 정정 시험');tab.locator('#grant-stars-form button[type=submit]').click();before=state(tab)['balance'];confirm(tab);assert state(tab)['balance']==before+4
    nav(tab,'family');tab.locator('[data-nav=history]').click();tab.locator('[data-action=reverse-grant]').first.click();tab.locator('#correction-form [name=reason]').fill('잘못 입력한 지급');tab.locator('#correction-form button[type=submit]').click();confirm(tab);assert state(tab)['balance']==before
    passed('direct star grant and audited correction retain balance invariant')
    nav(tab,'family');member=tab.locator('.member-row').filter(has_text='엄마');member.locator('[data-action=rename-member]').click();tab.locator('[name=displayName]').fill('엄마 수정');tab.locator('#rename-member-form button[type=submit]').click();expect(tab.locator('.member-list').last).to_contain_text('엄마 수정')
    passed('guardian display-name editing and child-device grouping preserved')
    role(tab,'child');expect(tab.locator('.mail-hero')).to_contain_text('오늘 책 한 권 읽기');nav(tab,'gacha');tab.locator('[data-action=draw]').click();before=state(tab)['balance'];confirm(tab);assert state(tab)['balance']==before-5;close(tab)
    passed('child actual draw remains separate from parent simulation')
    role(tab,'grandma');assert tab.locator('[data-action=grant-stars]').count()==0;nav(tab,'praise');assert tab.locator('[data-action=edit-rule]').count()==0
    passed('praise-family role cannot access manager controls')
    # Preserve data on fresh initialization without a live network.
    seed=tab.evaluate('Object.fromEntries(window.__store)');seed['praise-star.demo-actor']='child';again=page(seed=seed)
    assert state(again)==state(tab);passed('stored state and shared read IDs survive browser app reload')
    # Fresh responsive contexts. The test never touches actual family accounts.
    for width in [360,390,430,768,1440]:
        for actor,screens in [('dad',['home','praise','inventory','manage','family']),('child',['home','earn','shop','gacha','inventory'])]:
            t=page(width,900 if width>760 else 844,actor)
            for screen in screens:
                nav(t,screen)
                assert t.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,actor,screen)
                measurements.append({'width':width,'role':actor,'screen':screen,'horizontalOverflow':False})
            if actor=='dad':
                nav(t,'manage');t.locator('[data-action=edit-reward]').first.click()
                a=t.locator('.icon-select-trigger').bounding_box();b=t.locator('[name=cost]').bounding_box()
                assert abs(a['height']-b['height'])<1 and abs(a['y']-b['y'])<1,(width,a,b)
                t.locator('[data-action=open-icon-picker]').click()
                target=t.locator('.reward-icon-choice').first.bounding_box();assert target['width']>=44 and target['height']>=44
                assert t.locator('#icon-modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                if width==390:t.screenshot(path=str(OUT/'v05-icon-picker-390.png'))
            t.context.close()
        passed(f'{width}px adult/child 10 screens: no horizontal overflow, matching editor heights, 44px icon targets')
    # Root-font override smoke check; not full browser zoom or OS text-size certification.
    zoom=page(390,844,'child');zoom.add_style_tag(content='html{font-size:200%!important}')
    assert zoom.evaluate('document.documentElement.scrollWidth<=innerWidth+1');passed('large base text does not create horizontal page overflow')
    assert not errors,errors;passed('no uncaught JavaScript errors across functional and responsive flows')
    (OUT/'experience-browser-results.json').write_text(json.dumps({'checks':checks,'measurements':measurements,'errors':errors,'method':'Chromium local HTML with storage fixtures; not real iOS/Android or live Supabase authenticated mutations'},ensure_ascii=False,indent=2))
    browser.close()
print('Experience browser scenarios:',len(checks),'passed')
