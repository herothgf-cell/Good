# Mobile learning usability — 2026-11-03

## Scope

- Keep recording, stop/send and text-send controls visible while the conversation log scrolls.
- Remove guardian/self observer selection and manual reading/speaking ratings from current practice screens.
- Render the learning navigation icon as a monochrome outlined book.
- Preserve existing praise, coupons, historical records, guardian-only learning and zero preview rewards.

## Behavior

`LearningMobileLayout` measures the visual viewport and existing bottom navigation. On screens up to 900px the active conversation fills the available viewport; its log is the only scrolling region. The recording/send row is before a compact textarea. Reduced visual viewport handling temporarily hides the bottom navigation when a keyboard is detected. Exit, pause and role changes restore the normal page. Landscape tablets/desktops retain page positioning while fitting the conversation into the remaining height.

Practice steps now use one `연습했어요 · 다음 →` action. They store `practiced:true`, without claiming a correct answer, pronunciation success, independent reading or observer evidence. The server accepts this marker only for practice steps and rejects mixed values/ratings. Objective spelling, choice and numeric questions retain deterministic answer checks. Legacy observation records and their idempotency keys remain valid. No raw speech or handwriting is added to saved records.

## Verification

- Reproduced the pre-fix mobile geometry failure before implementation: a recording control at y=866–912 was outside the 577px usable region on a 360x640 screen.
- New domain tests cover neutral practice totals, rejecting objective-answer bypass, legacy observations, idempotency and stale double clicks.
- Browser tests measure geometry before clicks (so Playwright auto-scroll cannot hide the problem), at 360x640, 390x844, 844x390, 768x1024 and 1024x768. They cover long chat, recording/stop, simulated reduced visual viewport, transcript scroll, navigation icon, phonics continuation, wrong spelling and role/route cleanup.
- Targeted local typecheck, 38 domain/controller tests, five new viewport groups, two integrated English groups and six existing learning groups passed.
- The supplied local v0.11 archive is not identical to repository main. Its full suite has 559/564 passes: five pre-existing archive tests expect unshipped coach diagnostics (`old text-only server`, `typed message appears immediately`, `failed user messages excluded`, `unavailable connection`, `lab exposes unified chat`). Those unrelated production files/tests are not included in this change. Exact main-derived GitHub CI is the release gate.
- Self-review only; no independent reviewer. Real provider/audio and physical mobile keyboard behavior are not tested by these fixtures.

## Deployment

No SQL migration or secret changes. Deploy `family-action` with the verified shared module revision before updating the web app, so `practiced` records are accepted. Keep JWT and application membership authorization. Existing clients continue to submit legacy records. No child publication change.

## Next development, not included here

1. Save/resume the current learning step and schedule selective review without treating completion as mastery.
2. Add short AI-guided transitions within the existing listen/read/write sequence; reduce parent intervention rather than adding more menus.
3. Validate actual iPad/phone audio and keyboard behavior before any child rollout. Automatic pronunciation assessment is a separate feature requiring its own accuracy checks.
