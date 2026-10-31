"""Learning release, runner, and reward checks on the generated offline app.

Run after ``npm run build`` with ``python tests/learning_browser_test.py``.
Python Playwright and a Chromium installation (or CHROMIUM_PATH) are required.
Every page uses independent in-memory demo storage and blocks all requests.
No family account, production publication, microphone, or live data is used.
"""

import copy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import shutil

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts"
DEMO_KEY = "praise-star.demo.v1"
CHECKS = []
MEASUREMENTS = []
ERRORS = []
REQUESTS = []

# Explicit answers let these scenarios exercise real choices without reading
# controller internals or allowing the test to discover the correct button.
ANSWERS = {
    "english-colors": ["red", "blue", "yellow", "green", "pink"],
    "english-animals": ["cat", "dog", "bird", "fish", "rabbit"],
    "english-requests": ["ball", "book", "water", "apple", "pencil"],
    "math-ten": ["4", "1", "7", "5", "2"],
    "math-place": ["14", "27", "30", "105", "120"],
    "math-stories": ["5", "4", "8", "0", "7"],
}


def passed(message):
    CHECKS.append(message)
    print("PASS:", message, flush=True)


def state(tab):
    return tab.evaluate("JSON.parse(localStorage.getItem('praise-star.demo.v1')).state")


def learning(tab):
    return state(tab).get("learning") or {}


def saved(tab):
    return tab.evaluate("Object.fromEntries(window.__store)")


def non_learning_records(tab):
    return {key: value for key, value in state(tab).items() if key != "learning"}


def nav(tab, screen):
    menu = ".mobile-nav" if tab.viewport_size["width"] <= 760 else ".sidebar nav"
    tab.locator(f'{menu} [data-nav="{screen}"]').click()


def role(tab, actor):
    tab.locator(".user-switch").click()
    tab.locator(f'[data-demo-role="{actor}"]').click()
    expect(tab.locator("#modal")).not_to_be_visible()


def action(tab, name):
    return tab.locator(f'[data-learning-action="{name}"]')


def child_navigation(tab, visible):
    for menu in (".mobile-nav", ".sidebar nav"):
        expect(tab.locator(f'{menu} [data-nav="learning"]')).to_have_count(1 if visible else 0)


def no_overflow(tab, label):
    assert tab.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), label
    for element in tab.locator(
        '.learning-page button, .learning-page select, .learning-page input, .mobile-nav button'
    ).all():
        if not element.is_visible():
            continue
        box = element.bounding_box()
        assert box and box["x"] >= -1 and box["x"] + box["width"] <= tab.viewport_size["width"] + 1, (label, box)
    MEASUREMENTS.append({"width": tab.viewport_size["width"], "screen": label, "horizontalOverflow": False})


def start(tab, lesson_id):
    tab.locator(f'[data-learning-action="start"][data-lesson-id="{lesson_id}"]').click()
    expect(tab.locator('.learning-progress')).to_have_attribute("aria-valuenow", "1")


def visual_matches(tab, lesson_id, index):
    if lesson_id == "math-ten":
        expect(tab.locator(".learning-ten-cell")).to_have_count(10)
        expect(tab.locator(".learning-ten-cell i")).to_have_count([6, 9, 3, 5, 8][index])
    elif lesson_id == "math-place":
        values = [(0, 1, 4), (0, 2, 7), (0, 3, 0), (1, 0, 5), (1, 2, 0)][index]
        for place, count in zip(("hundreds", "tens", "ones"), values):
            expect(tab.locator(f".learning-block.learning-{place}")).to_have_count(count)
    elif lesson_id == "math-stories":
        objects, removed = [(5, 0), (7, 3), (8, 0), (6, 6), (7, 0)][index]
        expect(tab.locator(".learning-object")).to_have_count(objects)
        expect(tab.locator(".learning-object.learning-removed")).to_have_count(removed)


def finish(tab, lesson_id, help_pattern=False, text_help=False, fail_save=False):
    """Complete the already-open runner using five visible choice/next pairs."""
    for index, answer_id in enumerate(ANSWERS[lesson_id]):
        expect(tab.locator(".learning-progress")).to_have_attribute("aria-valuenow", str(index + 1))
        expect(tab.locator("#learning-question-title")).to_contain_text(re.compile("[가-힣]"))
        assert 2 <= action(tab, "answer").count() <= 3
        expect(action(tab, "next")).to_have_count(0)
        for choice in action(tab, "answer").all():
            box = choice.bounding_box()
            assert box and box["height"] >= 60 and box["width"] >= 48, box
        visual_matches(tab, lesson_id, index)
        if lesson_id.startswith("english-"):
            if text_help:
                action(tab, "listen").click()
                expect(tab.locator("#toast")).to_contain_text("소리 대신 글자")
                action(tab, "text-help").click()
                expect(tab.locator(".learning-speech-text")).to_be_visible()
            else:
                action(tab, "listen").click()
        if help_pattern and index == 0:
            action(tab, "listen").click()  # A replay is support, even before a hint.
            tab.locator('[data-option-id="blue"]').click()
            expect(tab.locator(".learning-feedback")).to_contain_text("다시 골라")
            expect(action(tab, "next")).to_have_count(0)
            action(tab, "hint").click()
            action(tab, "model").click()
            expect(tab.locator(".learning-model")).to_contain_text("빨강")
        elif help_pattern and index == 1:
            action(tab, "text-help").click()
            expect(tab.locator(".learning-speech-text")).to_have_text("Find blue.")
        elif help_pattern and index == 2:
            action(tab, "hint").click()
        tab.locator(f'[data-learning-action="answer"][data-option-id="{answer_id}"]').click()
        expect(tab.locator(".learning-feedback")).to_contain_text("잘 찾았어요")
        assert all(button.is_disabled() for button in action(tab, "answer").all())
        if help_pattern and index == 0:
            expect(tab.locator(".learning-practice")).to_contain_text("녹음·채점하지 않아요")
            count = tab.evaluate("window.__speech.spoken.length")
            action(tab, "practice").click()
            assert tab.evaluate("window.__speech.spoken.length") == count + 1
        if fail_save and index == 4:
            tab.evaluate("window.__failWriteOnce = true")
        action(tab, "next").click()
    expect(tab.locator(".learning-summary")).to_be_visible()
    if fail_save:
        expect(tab.locator(".learning-save-status")).to_contain_text("아직 저장하지 못했어요")
    else:
        expect(tab.locator(".learning-save-status")).to_contain_text("완료 기록을 저장했어요")


def save_settings(tab, lessons, daily_limit=2, stars=2):
    form = tab.locator('[data-learning-form="settings"]')
    for lesson_id in ANSWERS:
        form.locator(f'[name="lessonIds"][value="{lesson_id}"]').set_checked(lesson_id in lessons)
    form.locator('[name="dailyLimit"]').select_option(str(daily_limit))
    form.locator('[name="starsPerSession"]').select_option(str(stars))
    version = int(form.get_attribute("data-learning-version"))
    form.locator('button[type="submit"]').click()
    expect(tab.locator('[data-learning-form="settings"]')).to_have_attribute("data-learning-version", str(version + 1))
    assert learning(tab)["draft"] == {"lessonIds": lessons, "dailyLimit": daily_limit, "starsPerSession": stars}


def remote_learning(tab, change):
    """Simulate another local demo tab receiving a guardian setting change."""
    tab.evaluate("""change => {
      const key='praise-star.demo.v1', oldValue=localStorage.getItem(key);
      const envelope=JSON.parse(oldValue);
      if(change==='draft'){
        envelope.state.learning.draft.lessonIds=['english-animals'];
        envelope.state.learning.draftVersion++;
      }else if(change==='withdraw'){
        envelope.state.learning.publication=null;
        envelope.state.learning.publicationSequence++;
      }
      envelope.revision++;
      const newValue=JSON.stringify(envelope);localStorage.setItem(key,newValue);
      window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue}));
    }""", change)


def main():
    OUT.mkdir(exist_ok=True)
    html = (ROOT / "preview.html").read_text()
    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("google-chrome")
        browser = playwright.chromium.launch(
            **({"executable_path": executable} if executable else {}),
            headless=True, args=["--no-sandbox"],
        )
        pages = []

        def page(seed=None, actor="child", width=390, audio=True):
            context = browser.new_context(
                viewport={"width": width, "height": 1000 if width > 760 else 844},
                locale="ko-KR", timezone_id="Asia/Seoul", reduced_motion="reduce",
            )
            tab = context.new_page()
            tab.set_default_timeout(7000)
            tab.on("pageerror", lambda error: ERRORS.append(str(error)))
            tab.on("request", lambda request: REQUESTS.append(request.url))
            tab.route("**/*", lambda route: route.abort())
            seeded = dict(seed or {})
            seeded["praise-star.demo-actor"] = actor
            tab.evaluate("""({seed,audio}) => {
              const memory=new Map(Object.entries(seed));window.__store=memory;
              const storage={getItem:k=>memory.get(k)??null,
                setItem:(k,v)=>{
                  if(k==='praise-star.demo.v1'&&window.__failWriteOnce){
                    window.__failWriteOnce=false;window.__failedWrite=JSON.parse(v);
                    throw Error('fixture persistence failure');
                  }
                  memory.set(k,String(v));
                },removeItem:k=>memory.delete(k),clear:()=>memory.clear()};
              Object.defineProperty(window,'localStorage',{value:storage});
              Object.defineProperty(window,'sessionStorage',{value:storage});
              if(!crypto.randomUUID)crypto.randomUUID=()=>{
                const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
                const s=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
                return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
              };
              window.__speech={spoken:[],canceled:0};window.__microphoneRequests=0;
              Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
                getUserMedia:()=>{window.__microphoneRequests++;return Promise.reject(Error('No microphone in fixture'));}
              }});
              Object.defineProperty(window,'speechSynthesis',{configurable:true,value:audio?{
                getVoices:()=>audio==='empty'?[]:[{lang:'en-US',name:'Fixture English voice',localService:audio!=='remote'}],
                cancel:()=>window.__speech.canceled++,
                speak:utterance=>window.__speech.spoken.push({text:utterance.text,lang:utterance.lang})
              }:undefined});
              Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,
                value:audio?function(text){this.text=text;}:undefined});
            }""", {"seed": seeded, "audio": audio})
            tab.set_content(html, wait_until="load")
            expect(tab.locator("#main-content")).to_be_visible()
            pages.append(tab)
            return tab

        tab = page()
        original = non_learning_records(tab)
        child_navigation(tab, False)
        expect(tab.locator('[data-nav="learning"]')).to_have_count(0)
        assert not learning(tab).get("publication")
        passed("default child home and both menus expose no unpublished learning")

        role(tab, "grandma")
        expect(tab.locator('[data-nav="learning"]')).to_have_count(0)
        role(tab, "dad")
        nav(tab, "learning")
        expect(tab.get_by_role("heading", name="학습 테스트", exact=True)).to_be_visible()
        expect(tab.locator(".learning-heading")).to_contain_text("미공개")
        expect(action(tab, "start")).to_have_count(6)
        expect(action(tab, "publish")).to_be_disabled()
        assert non_learning_records(tab) == original
        passed("guardian sees six private previews; giver cannot enter and publish waits for review")

        start(tab, "english-animals")
        assert tab.evaluate("window.__speech.spoken.length") == 0, "speech must start from a user click"
        action(tab, "listen").click()
        canceled = tab.evaluate("window.__speech.canceled")
        action(tab, "pause").first.click()
        expect(tab.locator(".learning-paused")).to_be_visible()
        expect(action(tab, "answer")).to_have_count(0)
        assert tab.evaluate("window.__speech.canceled") > canceled
        action(tab, "pause").first.click()
        expect(tab.locator(".learning-progress")).to_have_attribute("aria-valuenow", "1")
        action(tab, "listen").click()
        canceled = tab.evaluate("window.__speech.canceled")
        tab.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(tab.locator(".learning-paused")).to_be_visible()
        assert tab.evaluate("window.__speech.canceled") > canceled
        tab.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
        action(tab, "pause").first.click()
        action(tab, "listen").click()
        canceled = tab.evaluate("window.__speech.canceled")
        nav(tab, "home")
        assert tab.evaluate("window.__speech.canceled") > canceled
        assert not learning(tab).get("previews") and non_learning_records(tab) == original
        nav(tab, "learning")
        start(tab, "english-animals")
        action(tab, "listen").click()
        canceled = tab.evaluate("window.__speech.canceled")
        role(tab, "child")
        expect(tab.locator(".learning-runner")).to_have_count(0)
        child_navigation(tab, False)
        assert tab.evaluate("window.__speech.canceled") > canceled
        assert not learning(tab).get("previews") and non_learning_records(tab) == original
        role(tab, "dad")
        nav(tab, "learning")
        passed("audio starts only on click; pause, hidden document, navigation and role changes stop it without recording an abandoned preview")

        start(tab, "english-colors")
        finish(tab, "english-colors", help_pattern=True)
        expect(tab.locator(".learning-reward-note")).to_contain_text("별 0개")
        run = learning(tab)["previews"][-1]
        assert {key: run[key] for key in ("total", "independent", "supported", "firstTry", "stars")} == {
            "total": 5, "independent": 2, "supported": 3, "firstTry": 4, "stars": 0,
        }
        assert run["mode"] == "preview" and not learning(tab)["runs"]
        assert non_learning_records(tab) == original
        tab.screenshot(path=str(OUT / "learning-preview-summary-390.png"), full_page=True)
        action(tab, "back").click()
        expect(action(tab, "praise")).to_have_count(0)
        passed("wrong answers, text/model/hint help and optional practice finish five steps with honest zero-reward preview counts")

        for lesson_id in list(ANSWERS)[1:]:
            start(tab, lesson_id)
            finish(tab, lesson_id)
            assert non_learning_records(tab) == original
            action(tab, "back").click()
        assert len(learning(tab)["previews"]) == 6 and not learning(tab)["runs"]
        passed("all six reviewed lessons complete; ten frames, place blocks and removed objects match every math question")

        save_settings(tab, ["english-colors", "math-ten"], daily_limit=2, stars=2)
        assert learning(tab)["publication"] is None
        action(tab, "publish").click()
        expect(tab.locator(".learning-confirm")).to_contain_text("보호자 확인 후 별 2개")
        assert learning(tab)["publication"] is None
        action(tab, "cancel-confirm").click()
        assert learning(tab)["publication"] is None
        action(tab, "publish").click()
        action(tab, "confirm-publish").click()
        expect(tab.locator(".learning-heading")).to_contain_text("아이에게 공개 중")
        publication = copy.deepcopy(learning(tab)["publication"])
        assert publication["settings"] == {"lessonIds": ["english-colors", "math-ten"], "dailyLimit": 2, "starsPerSession": 2}
        assert non_learning_records(tab) == original
        published_seed = saved(tab)
        passed("saving the draft and opening or canceling confirmation do not publish; explicit confirmation publishes exactly the saved selection")

        stale = page(published_seed, actor="dad")
        nav(stale, "learning")
        action(stale, "publish").click()
        expect(action(stale, "confirm-publish")).to_be_visible()
        remote_learning(stale, "withdraw")
        expect(action(stale, "confirm-publish")).to_have_count(0)
        expect(stale.locator(".learning-heading")).to_contain_text("미공개")
        assert learning(stale)["publication"] is None
        assert non_learning_records(stale) == original
        passed("another guardian's withdrawal invalidates an already-open publication confirmation")

        save_settings(tab, ["math-place"], daily_limit=1, stars=0)
        assert learning(tab)["publication"] == publication
        role(tab, "grandma")
        expect(tab.locator('[data-nav="learning"]')).to_have_count(0)
        role(tab, "child")
        child_navigation(tab, True)
        nav(tab, "learning")
        assert set(action(tab, "start").evaluate_all("els=>els.map(e=>e.dataset.lessonId)")) == {"english-colors", "math-ten"}
        expect(tab.locator('[data-learning-form], [data-learning-action="publish"], [data-learning-action="praise"]')).to_have_count(0)
        passed("child sees only the published selection and reward rules despite later private draft edits")

        for lesson_id in ("english-colors", "math-ten"):
            start(tab, lesson_id)
            finish(tab, lesson_id)
            expect(tab.locator(".learning-save-status")).to_contain_text("보호자 확인 대기")
            assert non_learning_records(tab) == original
            action(tab, "back").click()
        assert len(learning(tab)["runs"]) == 2
        assert all(run["stars"] == 2 and not run.get("praiseId") for run in learning(tab)["runs"])
        assert all(button.is_disabled() for button in action(tab, "start").all())
        expect(tab.locator(".learning-heading")).to_contain_text("오늘 0번")
        passed("child completions consume the shared daily allowance but grant no stars, coupons or praise until guardian review")

        role(tab, "dad")
        nav(tab, "learning")
        child_run = learning(tab)["runs"][0]
        before = state(tab)
        praise = tab.locator(f'[data-learning-action="praise"][data-run-id="{child_run["id"]}"]')
        praise.dblclick()
        tab.wait_for_function("expected => JSON.parse(localStorage.getItem('praise-star.demo.v1')).state.balance === expected", arg=before["balance"] + 2)
        rewarded = state(tab)
        assert len(rewarded["praises"]) == len(before["praises"]) + 1
        assert len(rewarded["ledger"]) == len(before["ledger"]) + 1
        assert rewarded["praises"][-1]["learningRunId"] == child_run["id"]
        assert next(run for run in rewarded["learning"]["runs"] if run["id"] == child_run["id"])["praiseId"]
        assert rewarded["inventory"] == before["inventory"] and rewarded["rewards"] == before["rewards"]
        expect(tab.locator(f'[data-learning-action="praise"][data-run-id="{child_run["id"]}"]')).to_have_count(0)
        nav(tab, "home")
        nav(tab, "learning")
        assert state(tab) == rewarded
        passed("guardian review credits the published two stars once, links the praise and removes the award control after a double click")

        action(tab, "unpublish").click()
        assert learning(tab)["publication"] == publication
        action(tab, "cancel-confirm").click()
        action(tab, "unpublish").click()
        action(tab, "confirm-unpublish").click()
        assert learning(tab)["publication"] is None
        assert learning(tab)["runs"] == rewarded["learning"]["runs"]
        assert non_learning_records(tab) == {key: value for key, value in rewarded.items() if key != "learning"}
        role(tab, "child")
        child_navigation(tab, False)
        expect(tab.locator('[data-nav="learning"]')).to_have_count(0)
        restored = page(saved(tab))
        child_navigation(restored, False)
        assert state(restored) == state(tab)
        passed("withdrawal needs confirmation, hides child entry points and persists without deleting completed learning or rewards")

        fallback = page(actor="dad", audio=False)
        fallback_before = non_learning_records(fallback)
        nav(fallback, "learning")
        start(fallback, "english-colors")
        finish(fallback, "english-colors", text_help=True)
        fallback_run = learning(fallback)["previews"][0]
        assert fallback_run["independent"] == 0 and fallback_run["supported"] == 5
        assert non_learning_records(fallback) == fallback_before
        assert fallback.evaluate("window.__speech.spoken.length") == 0
        passed("unavailable speech offers a usable text path and records all five assisted answers without claiming independent listening")

        for voice_mode in ("empty", "remote"):
            voices = page(actor="dad", audio=voice_mode)
            nav(voices, "learning")
            start(voices, "english-colors")
            action(voices, "listen").click()
            expect(voices.locator("#toast")).to_contain_text("기기에 저장된 영어 음성이 없어요")
            assert voices.evaluate("window.__speech.spoken.length") == 0
            voices.evaluate("speechSynthesis.getVoices=()=>[{lang:'en-US',name:'Available local voice',localService:true}]")
            action(voices, "listen").click()
            assert voices.evaluate("window.__speech.spoken") == [{"text": "Find red.", "lang": "en-US"}]
            action(voices, "text-help").click()
            expect(voices.locator(".learning-speech-text")).to_have_text("Find red.")
            assert not learning(voices).get("previews")
        passed("empty or remote-only voice lists use fallback; a later local English voice becomes usable on the next tap")

        retry = page(actor="dad")
        retry_before = non_learning_records(retry)
        nav(retry, "learning")
        start(retry, "math-ten")
        finish(retry, "math-ten", fail_save=True)
        assert not learning(retry).get("previews")
        failed_id = retry.evaluate("window.__failedWrite.state.learning.previews[0].id")
        expect(action(retry, "retry-save")).to_be_visible()
        action(retry, "retry-save").click()
        expect(retry.locator(".learning-save-status")).to_contain_text("미리보기 완료")
        assert [run["id"] for run in learning(retry)["previews"]] == [failed_id]
        assert non_learning_records(retry) == retry_before
        passed("failed persistence never claims success; retry stores exactly the same completed run once")

        zero = page(published_seed, actor="dad")
        zero_before = non_learning_records(zero)
        nav(zero, "learning")
        save_settings(zero, ["math-place"], daily_limit=1, stars=0)
        action(zero, "publish").click()
        action(zero, "confirm-publish").click()
        role(zero, "child")
        nav(zero, "learning")
        expect(action(zero, "start")).to_have_count(1)
        start(zero, "math-place")
        finish(zero, "math-place")
        expect(zero.locator(".learning-save-status")).to_contain_text("학습 완료")
        expect(zero.locator(".learning-save-status")).not_to_contain_text("보호자 확인 대기")
        assert learning(zero)["runs"][0]["stars"] == 0
        role(zero, "dad")
        nav(zero, "learning")
        expect(action(zero, "praise")).to_have_count(0)
        assert non_learning_records(zero) == zero_before
        passed("a zero-star publication completes without a misleading reward promise or guardian award button")

        backlog_seed = copy.deepcopy(published_seed)
        backlog_envelope = json.loads(backlog_seed[DEMO_KEY])
        backlog_learning = backlog_envelope["state"]["learning"]
        backlog_learning["publicationSequence"] = 3
        backlog_learning["publication"]["version"] = 3
        backlog_learning["runs"] = []
        for index in range(60):
            old_run = copy.deepcopy(rewarded["learning"]["runs"][1])
            completed = datetime.now(timezone.utc) - timedelta(days=60 - index)
            old_run.update(
                id=f"00000000-0000-4000-8000-{index:012d}",
                completedAt=completed.isoformat().replace("+00:00", "Z"),
                day=completed.astimezone(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"),
                stars=2 if index == 0 else 0,
                publicationVersion=1 if index == 0 else 2,
            )
            old_run.pop("praiseId", None)
            backlog_learning["runs"].append(old_run)
        backlog_seed[DEMO_KEY] = json.dumps(backlog_envelope, ensure_ascii=False)
        backlog = page(backlog_seed, actor="dad")
        nav(backlog, "learning")
        expect(backlog.locator(".learning-results").first.locator(".learning-run-row")).to_have_count(60)
        oldest_id = backlog_learning["runs"][0]["id"]
        oldest = backlog.locator(f'[data-learning-action="praise"][data-run-id="{oldest_id}"]')
        expect(oldest).to_have_count(1)
        oldest.click()
        backlog.wait_for_function("expected => JSON.parse(localStorage.getItem('praise-star.demo.v1')).state.balance === expected", arg=original["balance"] + 2)
        expect(backlog.locator(f'[data-learning-action="praise"][data-run-id="{oldest_id}"]')).to_have_count(0)
        assert state(backlog)["inventory"] == original["inventory"]
        passed("the oldest pending result remains visible and awardable across the full sixty-result history")

        remote = page(published_seed)
        nav(remote, "learning")
        start(remote, "english-colors")
        action(remote, "listen").click()
        remote.locator('[data-option-id="red"]').click()
        action(remote, "next").click()
        remote_learning(remote, "draft")
        expect(remote.locator(".learning-progress")).to_have_attribute("aria-valuenow", "2")
        action(remote, "listen").click()
        canceled = remote.evaluate("window.__speech.canceled")
        remote_learning(remote, "withdraw")
        child_navigation(remote, False)
        expect(remote.locator(".learning-runner")).to_have_count(0)
        assert remote.evaluate("window.__speech.canceled") > canceled
        assert not learning(remote)["runs"] and non_learning_records(remote) == original
        passed("same-release refresh preserves progress; remote withdrawal stops audio and removes the active child session without recording it")

        for width in (360, 390, 768, 1024):
            responsive = page(published_seed, actor="dad", width=width)
            nav(responsive, "learning")
            no_overflow(responsive, "guardian six-lesson catalog and settings")
            if width in (390, 1024):
                responsive.screenshot(path=str(OUT / f"learning-admin-{width}.png"), full_page=True)
            action(responsive, "publish").click()
            no_overflow(responsive, "explicit publication confirmation")
            action(responsive, "cancel-confirm").click()
            start(responsive, "math-place")
            for index, answer_id in enumerate(ANSWERS["math-place"][:4]):
                visual_matches(responsive, "math-place", index)
                no_overflow(responsive, f"place value question {index + 1}")
                if index == 3:
                    if width in (390, 1024):
                        responsive.screenshot(path=str(OUT / f"learning-place-{width}.png"), full_page=True)
                    break
                responsive.locator(f'[data-option-id="{answer_id}"]').click()
                action(responsive, "next").click()
            action(responsive, "back").click()
            start(responsive, "english-requests")
            action(responsive, "listen").click()
            action(responsive, "text-help").click()
            no_overflow(responsive, "English prompt, text help and large choices")
            action(responsive, "back").click()
            role(responsive, "child")
            nav(responsive, "learning")
            no_overflow(responsive, "published child catalog and navigation")
            start(responsive, "math-ten")
            no_overflow(responsive, "child runner and ten-frame choices")
            action(responsive, "pause").first.click()
            no_overflow(responsive, "paused child session")
            action(responsive, "pause").first.click()
            expect(responsive.locator(".learning-progress")).to_have_attribute("aria-valuenow", "1")
            if width in (390, 1024):
                responsive.screenshot(path=str(OUT / f"learning-child-{width}.png"), full_page=True)
            passed(f"{width}px phone/tablet layout fits catalog, settings, confirmation, math visuals, text fallback and pause controls")

        assert all(tab.evaluate("window.__microphoneRequests") == 0 for tab in pages)
        assert not REQUESTS, REQUESTS
        assert not ERRORS, ERRORS
        passed("all scenarios avoid microphone and network access and produce no uncaught JavaScript errors")
        browser.close()

    (OUT / "learning-browser-results.json").write_text(json.dumps({
        "checks": CHECKS, "measurements": MEASUREMENTS, "errors": ERRORS,
        "networkRequests": REQUESTS,
        "method": "Chromium generated standalone app; independent in-memory DemoRepository fixtures; all network blocked; deterministic speech capability stubs; no live accounts or actual speech output",
    }, ensure_ascii=False, indent=2))
    print(f"Learning browser scenarios: {len(CHECKS)} passed")


if __name__ == "__main__":
    main()
