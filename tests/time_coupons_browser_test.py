"""Minute-coupon regression checks using only the generated local demo.

Run after ``npm run build`` with ``python tests/time_coupons_browser_test.py``.
Uses the same Python Playwright dependency and CHROMIUM_PATH fallback as the
other browser suites; no server, credentials, or live family transactions.
"""

import copy
import json
import os
from pathlib import Path
import re
import shutil

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts"
DEMO_KEY = "praise-star.demo.v1"
TIMED_ID = "browser-legacy-tv-30"
REWARD_ID = "browser-tv-reward"
CHECKS = []
MEASUREMENTS = []
ERRORS = []


def passed(message):
    CHECKS.append(message)
    print("PASS:", message, flush=True)


def state(tab):
    return tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")


def saved(tab):
    return tab.evaluate("Object.fromEntries(window.__store)")


def coupon(tab, coupon_id=TIMED_ID):
    return next(c for c in state(tab)["inventory"] if c["id"] == coupon_id)


def nav(tab, screen):
    menu = ".mobile-nav" if tab.viewport_size["width"] <= 760 else ".sidebar nav"
    tab.locator(f'{menu} [data-nav="{screen}"]').click()


def role(tab, actor):
    tab.locator(".user-switch").click()
    tab.locator(f'[data-demo-role="{actor}"]').click()
    expect(tab.locator("#modal")).not_to_be_visible()


def confirm(tab):
    tab.locator('#modal [data-action="confirm-action"]').click()
    expect(tab.locator("#modal")).not_to_be_visible()


def close(tab):
    tab.locator("#modal .dialog-close").click()
    expect(tab.locator("#modal")).not_to_be_visible()


def inventory(tab, status="all"):
    nav(tab, "inventory")
    tab.locator(f'[data-filter="{status}"]').click()
    for group in tab.locator(".coupon-group").all():
        if group.get_attribute("open") is None:
            group.locator("summary").click()


def action(tab, name, coupon_id=TIMED_ID):
    return tab.locator(f'[data-action="{name}"][data-id="{coupon_id}"]')


def timed_request(tab, minutes, coupon_id=TIMED_ID):
    inventory(tab)
    before = coupon(tab, coupon_id)
    button = action(tab, "coupon/request", coupon_id)
    expect(button).to_have_attribute("data-usage-version", str(before.get("usageVersion", 0)))
    button.click()
    form = tab.locator("#coupon-minutes-form")
    expect(form).to_be_visible()
    expect(form).to_have_attribute("data-usage-version", str(before.get("usageVersion", 0)))
    field = form.locator('[name="minutes"]')
    expect(field).to_have_attribute("min", "1")
    expect(field).to_have_attribute("max", str(before.get("remainingMinutes", 30)))
    field.fill(str(minutes))
    assert coupon(tab, coupon_id) == before, "choosing minutes must not reserve or deduct them"
    form.locator('button[type="submit"]').click()
    expect(tab.locator("#modal")).not_to_be_visible()
    after = coupon(tab, coupon_id)
    assert after["status"] == "requested" and after["requestedMinutes"] == minutes
    assert after["remainingMinutes"] == before.get("remainingMinutes", 30)
    assert after["usageVersion"] == before.get("usageVersion", 0) + 1
    return after


def approve(tab, coupon_id=TIMED_ID):
    inventory(tab, "requested")
    before = coupon(tab, coupon_id)
    button = action(tab, "coupon/approve", coupon_id)
    expect(button).to_have_attribute("data-usage-version", str(before["usageVersion"]))
    button.click()
    after = coupon(tab, coupon_id)
    assert after["status"] == "approved"
    assert after["requestedMinutes"] == before["requestedMinutes"]
    assert after["remainingMinutes"] == before["remainingMinutes"]
    assert after["usageVersion"] == before["usageVersion"] + 1


def completion_dialog(tab, minutes, coupon_id=TIMED_ID):
    inventory(tab, "approved")
    before = coupon(tab, coupon_id)
    button = action(tab, "complete-coupon", coupon_id)
    expect(button).to_have_attribute("data-usage-version", str(before["usageVersion"]))
    button.click()
    expect(tab.locator("#modal")).to_contain_text(f"{minutes}분")
    assert coupon(tab, coupon_id) == before, "opening completion must not deduct time"


def no_overflow(tab, label):
    assert tab.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), label
    modal = tab.locator("#modal")
    if modal.is_visible():
        assert modal.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), label
        for field in modal.locator('input:not([type="hidden"]), textarea, button[type="submit"]').all():
            box = field.bounding_box()
            assert box and box["x"] >= -1 and box["x"] + box["width"] <= tab.viewport_size["width"] + 1, (label, box)
    MEASUREMENTS.append({"width": tab.viewport_size["width"], "screen": label, "horizontalOverflow": False})


def main():
    OUT.mkdir(exist_ok=True)
    html = (ROOT / "preview.html").read_text()
    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("google-chrome")
        browser = playwright.chromium.launch(
            **({"executable_path": executable} if executable else {}),
            headless=True, args=["--no-sandbox"],
        )

        def page(seed=None, actor="child", width=390):
            context = browser.new_context(
                viewport={"width": width, "height": 900 if width > 760 else 844},
                locale="ko-KR", timezone_id="Asia/Seoul", reduced_motion="reduce",
            )
            tab = context.new_page()
            tab.set_default_timeout(7000)
            tab.on("pageerror", lambda error: ERRORS.append(str(error)))
            # A complete StoragePort fixture runs the real DemoRepository. All
            # requests are blocked so this suite cannot reach a family service.
            tab.route("**/*", lambda route: route.abort())
            seeded = dict(seed or {})
            seeded["praise-star.demo-actor"] = actor
            tab.evaluate("""seed => {
              const memory = new Map(Object.entries(seed)); window.__store = memory;
              const storage = {getItem:k=>memory.get(k)??null,
                setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),
                clear:()=>memory.clear()};
              Object.defineProperty(window,'localStorage',{value:storage});
              Object.defineProperty(window,'sessionStorage',{value:storage});
              if(!crypto.randomUUID)crypto.randomUUID=()=>{
                const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
                const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
                return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
              };
            }""", seeded)
            tab.set_content(html, wait_until="load")
            expect(tab.locator("#main-content")).to_be_visible()
            return tab

        initial = page()
        legacy_seed = saved(initial)
        envelope = json.loads(legacy_seed[DEMO_KEY])
        reward = copy.deepcopy(envelope["state"]["rewards"][0])
        reward.update(id=REWARD_ID, title="TV 30분 이용권", description="가족과 TV를 함께 봐요.", stock=4, version=1)
        reward.pop("durationMinutes", None)
        legacy_coupon = copy.deepcopy(envelope["state"]["inventory"][0])
        legacy_coupon.update(id=TIMED_ID, rewardId=REWARD_ID, title="TV 30분 이용권", description=reward["description"], status="available")
        for key in ("durationMinutes", "remainingMinutes", "requestedMinutes", "usageVersion", "usageHistory"):
            legacy_coupon.pop(key, None)
        envelope["state"]["rewards"].append(reward)
        envelope["state"]["inventory"].append(legacy_coupon)
        legacy_seed[DEMO_KEY] = json.dumps(envelope, ensure_ascii=False)
        initial.context.close()

        tab = page(legacy_seed)
        before = state(tab)
        inventory(tab)
        expect(tab.locator(".coupon-card").filter(has_text="TV 30분 이용권")).to_contain_text("30분")
        assert state(tab) == before, "legacy viewing must not rewrite persisted data"

        # Catches whole-coupon requests or any deduction before completion.
        timed_request(tab, 10)
        before = coupon(tab)
        action(tab, "coupon/cancel").click()
        canceled = coupon(tab)
        assert canceled["status"] == "available" and canceled["remainingMinutes"] == 30
        assert canceled.get("requestedMinutes") in (None, 0)
        assert canceled.get("usageHistory", []) == []
        assert canceled["usageVersion"] == before["usageVersion"] + 1
        passed("legacy TV 30분 title supports a 10-minute request and cancellation without deduction")

        timed_request(tab, 10)
        role(tab, "dad")
        inventory(tab, "requested")
        before = coupon(tab)
        action(tab, "reject-coupon").click()
        tab.locator('#reject-form [name="note"]').fill("저녁 식사 뒤에 사용해요")
        tab.locator('#reject-form button[type="submit"]').click()
        expect(tab.locator("#modal")).not_to_be_visible()
        rejected = coupon(tab)
        assert rejected["status"] == "available" and rejected["remainingMinutes"] == 30
        assert rejected.get("requestedMinutes") in (None, 0)
        assert rejected.get("usageHistory", []) == []
        assert rejected["usageVersion"] == before["usageVersion"] + 1
        passed("guardian rejection releases the requested minutes without consuming time")

        role(tab, "child")
        timed_request(tab, 10)
        role(tab, "dad")
        approve(tab)
        money_before = state(tab)
        completion_dialog(tab, 10)
        confirm(tab)
        used_part = coupon(tab)
        assert used_part["durationMinutes"] == 30 and used_part["remainingMinutes"] == 20
        assert used_part["status"] == "available" and used_part.get("requestedMinutes") in (None, 0)
        assert len(used_part["usageHistory"]) == 1
        entry = used_part["usageHistory"][0]
        assert entry["minutes"] == 10 and entry["actorId"] == "dad" and entry["actorName"] == "아빠"
        assert entry["id"] and entry["usedAt"]
        assert state(tab)["balance"] == money_before["balance"] and state(tab)["ledger"] == money_before["ledger"]
        assert state(tab)["rewards"] == money_before["rewards"]
        inventory(tab)
        card = tab.locator(".coupon-card").filter(has_text="TV 30분 이용권")
        expect(card).to_contain_text("20분")
        expect(card).to_contain_text("10분")
        card.locator(".coupon-use-history summary").click()
        expect(card.locator(".coupon-use-history li")).to_be_visible()
        expect(card.locator(".coupon-use-history li")).to_contain_text("아빠")
        partial_seed = saved(tab)
        passed("10-minute approval/completion leaves 20 of 30 minutes available with attributed history and no star/stock change")

        # Catches stale snapshots rebinding a confirmation to newer usageVersion.
        role(tab, "child")
        timed_request(tab, 5)
        role(tab, "dad")
        approve(tab)
        completion_dialog(tab, 5)
        remote = tab.evaluate("""id => {
          const key='praise-star.demo.v1', oldValue=localStorage.getItem(key);
          const envelope=JSON.parse(oldValue), c=envelope.state.inventory.find(c=>c.id===id);
          c.remainingMinutes=15;c.requestedMinutes=null;c.status='available';c.usageVersion++;
          c.usageHistory.push({id:'remote-completed-five',minutes:5,usedAt:new Date().toISOString(),actorId:'mom',actorName:'엄마'});
          envelope.revision++;const newValue=JSON.stringify(envelope);localStorage.setItem(key,newValue);
          window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue}));
          return envelope;
        }""", TIMED_ID)
        # Let the real storage-event refresh settle through a browser frame;
        # the captured completion action must retain its older usage version.
        tab.evaluate("() => new Promise(resolve => requestAnimationFrame(() => resolve()))")
        if tab.locator('#modal [data-action="confirm-action"]').is_visible():
            tab.locator('#modal [data-action="confirm-action"]').click()
            expect(tab.locator("#modal .dialog-error")).to_contain_text(re.compile("바뀌|새로|다시|갱신|변경"))
            close(tab)
        assert state(tab) == remote["state"], "a stale completion must never deduct the same minutes again"
        assert len(coupon(tab)["usageHistory"]) == 2 and coupon(tab)["remainingMinutes"] == 15
        passed("remote use while completion is open cannot double-deduct or overwrite the newer coupon")

        # Consume the saved 20-minute balance, proving the positive/zero boundary.
        tab.context.close()
        tab = page(partial_seed)
        timed_request(tab, 20)
        role(tab, "dad")
        approve(tab)
        completion_dialog(tab, 20)
        confirm(tab)
        exhausted = coupon(tab)
        assert exhausted["status"] == "used" and exhausted["remainingMinutes"] == 0
        assert [item["minutes"] for item in exhausted["usageHistory"]] == [10, 20]
        role(tab, "child")
        inventory(tab)
        expect(action(tab, "coupon/request")).to_have_count(0)
        passed("using the final 20 minutes marks the coupon used at zero and retains both usage records")

        # A configured time reward works even when its title has no duration.
        role(tab, "dad")
        nav(tab, "manage")
        tab.locator('[data-action="edit-reward"]:not([data-id])').click()
        form = tab.locator("#reward-form")
        form.locator('[name="title"]').fill("화면 휴식 이용권")
        form.locator('[name="description"]').fill("분 단위 브라우저 검증")
        form.locator('[name="cost"]').fill("3")
        form.locator('[name="unlimited"]').uncheck()
        form.locator('[name="stock"]').fill("4")
        form.locator('[name="timeCoupon"]').check()
        form.locator('[name="durationMinutes"]').fill("30")
        form.locator('button[type="submit"]').click()
        explicit = next(r for r in state(tab)["rewards"] if r["title"] == "화면 휴식 이용권")
        assert explicit["durationMinutes"] == 30
        card = tab.locator(".reward-admin-card").filter(has_text="화면 휴식 이용권")
        card.locator('[data-action="grant-reward"]').click()
        grant = tab.locator("#grant-reward-form")
        expect(grant.locator('[name="minutes"]')).to_have_attribute("min", "1")
        expect(grant.locator('[name="minutes"]')).to_have_attribute("max", "30")
        grant.locator('[name="minutes"]').fill("10")
        grant.locator('[name="quantity"]').fill("2")
        grant.locator('[name="reason"]').fill("분 단위 두 장 선물")
        before_gift = state(tab)
        grant.locator('button[type="submit"]').click()
        expect(tab.locator("#modal")).to_contain_text("10분")
        expect(tab.locator("#modal")).to_contain_text("2장")
        assert state(tab) == before_gift
        confirm(tab)
        gifts = [c for c in state(tab)["inventory"] if c["rewardId"] == explicit["id"]]
        assert len(gifts) == 2 and len({c["id"] for c in gifts}) == 2
        for gift in gifts:
            assert gift["durationMinutes"] == 10 and gift["remainingMinutes"] == 10
            assert gift["status"] == "available" and gift.get("usageHistory", []) == []
        assert next(r for r in state(tab)["rewards"] if r["id"] == explicit["id"])["stock"] == 2
        after_gift = state(tab)
        assert after_gift["balance"] == before_gift["balance"]
        assert after_gift["ledger"][:len(before_gift["ledger"])] == before_gift["ledger"]
        gift_ledger = after_gift["ledger"][len(before_gift["ledger"]):]
        assert len(gift_ledger) == 2
        assert all(entry["kind"] == "gift" and entry["delta"] == 0 for entry in gift_ledger)
        passed("explicit time reward without a numbered title grants two independent 10-minute coupons and consumes two stock units")

        role(tab, "child")
        timed_request(tab, 4, gifts[0]["id"])
        assert coupon(tab, gifts[0]["id"])["durationMinutes"] == 10
        assert coupon(tab, gifts[1]["id"])["remainingMinutes"] == 10
        passed("partial gifts retain their actual 10-minute entitlement rather than the reward's normal 30 minutes")

        # Existing non-time coupons retain their one-click approval/use flow.
        ordinary = next(c for c in state(tab)["inventory"] if c["title"] == "놀이 선택권")
        inventory(tab)
        action(tab, "coupon/request", ordinary["id"]).click()
        expect(tab.locator("#coupon-minutes-form")).not_to_be_visible()
        assert coupon(tab, ordinary["id"])["status"] == "requested"
        role(tab, "dad")
        inventory(tab, "requested")
        action(tab, "coupon/approve", ordinary["id"]).click()
        inventory(tab, "approved")
        action(tab, "complete-coupon", ordinary["id"]).click()
        confirm(tab)
        assert coupon(tab, ordinary["id"])["status"] == "used"
        passed("ordinary coupon request, approval and completion continue without a minutes form")

        # Reload is a fresh app instance over persisted JSON, not in-memory UI state.
        reloaded = page(partial_seed)
        assert coupon(reloaded)["remainingMinutes"] == 20
        assert coupon(reloaded)["usageHistory"][0]["minutes"] == 10
        reloaded.context.close()
        passed("remaining minutes and usage history survive an app reload")

        for width in (360, 390, 768):
            responsive = page(partial_seed, width=width)
            inventory(responsive)
            history_card = responsive.locator(".coupon-card").filter(has_text="TV 30분 이용권")
            expect(history_card).to_contain_text("20분")
            history_card.locator(".coupon-use-history summary").click()
            expect(history_card.locator(".coupon-use-history li")).to_be_visible()
            expect(history_card.locator(".coupon-use-history li")).to_contain_text("10분")
            expect(history_card.locator(".coupon-use-history li")).to_contain_text("아빠")
            no_overflow(responsive, "child balance and completed history")
            if width == 390:
                responsive.screenshot(path=str(OUT / "time-coupons-history-390.png"), full_page=True)
            action(responsive, "coupon/request").click()
            no_overflow(responsive, "child minutes request form")
            if width == 390:
                responsive.screenshot(path=str(OUT / "time-coupons-request-390.png"))
            responsive.locator('#coupon-minutes-form [name="minutes"]').fill("7")
            responsive.locator('#coupon-minutes-form button[type="submit"]').click()
            role(responsive, "dad")
            inventory(responsive, "requested")
            expect(responsive.locator(".coupon-card").filter(has_text="TV 30분 이용권")).to_contain_text("7분")
            no_overflow(responsive, "guardian requested minutes and history")
            nav(responsive, "manage")
            responsive.locator(f'[data-action="grant-reward"][data-id="{REWARD_ID}"]').click()
            no_overflow(responsive, "guardian partial grant form")
            if width == 390:
                responsive.locator("#modal").evaluate("e => e.scrollTop = 0")
                responsive.screenshot(path=str(OUT / "time-coupons-grant-390.png"))
            close(responsive)
            responsive.locator(f'[data-action="edit-reward"][data-id="{REWARD_ID}"]').click()
            expect(responsive.locator('#reward-form [name="timeCoupon"]')).to_be_checked()
            expect(responsive.locator('#reward-form [name="durationMinutes"]')).to_have_value("30")
            no_overflow(responsive, "guardian time reward editor")
            if width == 390:
                responsive.screenshot(path=str(OUT / "time-coupons-editor-390.png"))
            close(responsive)
            responsive.context.close()
            passed(f"{width}px minute balances, history, request, grant and editor fit the viewport")

        tab.context.close()
        assert not ERRORS, ERRORS
        passed("no uncaught JavaScript errors across minute and ordinary coupon flows")
        browser.close()
    (OUT / "time-coupons-browser-results.json").write_text(json.dumps({
        "checks": CHECKS, "measurements": MEASUREMENTS, "errors": ERRORS,
        "method": "Chromium generated local HTML with persisted demo StoragePort fixtures; all network requests blocked; no live accounts",
    }, ensure_ascii=False, indent=2))
    print(f"Time coupon browser scenarios: {len(CHECKS)} passed")


if __name__ == "__main__":
    main()
