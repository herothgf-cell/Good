# Guardian learning v2 UI report

## Scope and interfaces

Implemented Task 3 only in the isolated learning-v2 worktree. Owned files:

- `src/learning-lab.ts`: `LearningLabController` and exact `LearningLabHost` contract.
- `src/learning-lab.css`: scoped responsive guardian lab design.
- `src/learning-lab-visuals.ts`: escaped, structured clock/calendar/money/place-value/group/bar/sequence/word rendering.
- `tests/learning-lab-ui.test.mjs`: focused controller and visual behavior coverage.
- `tests/learning_lab_browser_test.py`: integrated offline phone/iPad verification.

Imports the shared content/state contracts and root-owned `CoachPort`. Root owns main routing, authenticated coach transport, build/style inclusion, pending request receipt behavior, and legacy navigation. No package installations, commits, or edits to other workers' implementation files.

## Implemented behavior

The guardian home presents nine substantive activities grouped into English and math, the visible label `보호자 전용 · 아이 미공개`, skill-specific settings, aggregate observations, recent summaries, and the root-handled `learning-legacy` link. Child/giver renders return no lab markup; their events cannot start/save a lab session.

Sessions use generated lesson steps and their actual length. Math has direct numeric input, keyboard Enter submission, large touch keypad, time/date separators, retry, hint, model, and explicit review without claiming correctness. Exact structured visuals show quantities, Gregorian calendars, clock hands, and equal groups. Unknown end/start clocks and calendar target markings are withheld until a model/result. Supported 100-won money settings use coins and 개; banknotes use 장.

Word recall hides the English target while retaining a safe Korean meaning cue. Independent reading and transfer reading display text before model listening. Full-word/text TTS uses only installed local English voices, with an explicit text/guardian fallback. Listening to a model phrase counts as model support, including scenario conversation. No speech recognition or pronunciation score is generated in the offline runner. Practice outcomes require guardian/self observations and display that distinction.

The conversation activity includes the real `CoachPort` connection panel, visibly adult guardian voice only, with connection checking before microphone availability, recording/stop/turn state, typed fallback, ephemeral conversation, and disclosure that an AI-generated response is read by installed device voice when available. The fixed scenario preview is separately and repeatedly labeled. AI transcript or voice activity never completes a scenario or awards stars.

The controller retains input drafts on ordinary polls and rerenders through scoped input/change listeners. It resets unfinished session, drafts, evidence selection, and coach text on actor/family/role changes. Settings versions invalidate a stale active preview with an explicit restart. Completion retries preserve the same runId, answers, seed, settings, and settingsVersion. A reconciled authoritative run resolves an ambiguous failed save. Pause, page hidden, leave, completion, role change, and stale session stop local speech and call `coach.leave()`.

## Verification evidence

Initial tests were written before the controller existed: all five initial cases failed with `Guardian lab controller must exist`. After implementation, seven controller/visual cases passed. A regression case for conversation model listening then failed with `none !== model`; recording that listening as model support made the eighth case pass after integration build.

On the first integrated build:

- `node --test --test-isolation=none tests/learning-lab-ui.test.mjs`: **8/8 passed**.
- `CHROMIUM_PATH=/tmp/good-learning-browser-cache/chromium_headless_shell-1161/chrome-linux/headless_shell /tmp/good-learning-venv/bin/python tests/learning_lab_browser_test.py`: **all six grouped scenarios passed; zero page errors**.
- Browser scenarios verified phone home, retained unsaved settings/input across storage polls after focus blur, direct Enter submission over the dynamic step count, simulated storage failure and successful same-record retry, zero balance/reward change, recall hiding/model reveal, pause and hidden-document speech cancellation, independent reading text, stale settings restart, actual AI unavailable state without any microphone request, child/giver invisibility, and iPad money/calendar/groups/pattern layout.
- `node_modules/typescript/bin/tsc --noEmit`: passed after the coin follow-up.
- Browser test Python syntax check passed.

The first browser test save attempt was rejected by domain validation because the about:blank UUID fallback fixture initially generated 32 hexadecimal characters without UUID separators. Corrected the fixture to proper version-4 UUIDs, then reran all browser scenarios successfully. This was a test fixture defect; the application's canonical pending retry adapter and stable run ID worked.

Review follow-up: added a ninth focused regression test showing that the old 100-won visual rendered zero coins rather than five (`0 !== 5`). The coin implementation and expanded keypad/coach-field/cross-month browser checks await the root consolidated build and final rerun; results will be recorded below.

## Visual review

Inspected phone home and iPad group/calendar screenshots. Korean glyphs are supplied by optional local inline test-only font fixtures, with no external request or product font dependency. Layout checks assert no horizontal document overflow, controls within viewport width, and touch control height at least 40 px. Phone cards/settings form stack; iPad cards/settings use columns; clocks/calendars and keypads wrap within available width.

Artifacts under `artifacts/`:

- `learning-v2-home-390.png`
- `learning-v2-home-1024.png`
- `learning-v2-math-transfer-1024.png`
- `learning-v2-math-calendar-1024.png`
- `learning-v2-math-groups-1024.png`
- `learning-v2-math-patterns-1024.png`
- `learning-v2-browser-results.json`

The minimal Chromium environment has no emoji font; devices with normal system emoji fonts render the activity emoji. Core quantity visuals are SVG/CSS and remain exact without emoji.

## Self-review and limits

All authored display strings from content/state/coach are escaped before HTML interpolation. No unfinished answers, speech audio, or conversation text are written to localStorage by this controller. Skill IDs are mapped to Korean labels in the product UI. New question headings receive focus and scroll into view after progression, so a long phone keypad does not strand the user below a replacement question.

The isolated browser fixture intentionally blocks all network access and tests honest demo-mode AI unavailability. Live provider quality, microphone consent/denial/timeouts, paid reservation enforcement, and stale transport callbacks belong to the root coach/domain verification. Root also owns the complete repository suite and legacy coupon/learning navigation regression runs. No claim of live AI connectivity is made from these offline tests.

## Root consolidated verification

After the coin follow-up, root rebuilt the application and all9 UI cases passed within the33-file /441-case full suite. The expanded six browser groups passed with exact coins, keypad/backspace, preserved coach draft, unmarked crossed-month calendar and alternating patterns. Final independent review approved the integrated UI.
