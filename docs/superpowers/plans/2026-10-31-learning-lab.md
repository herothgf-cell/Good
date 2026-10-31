# Guardian Learning Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add English/math activities to the existing app behind an admin test-and-publish workflow, default hidden from children.

**Architecture:** Shared typed lesson content and deterministic evaluation; optional bounded learning summaries in the existing family state; server-authorized draft/publication/completion/praise actions; separate learning screen/controller integrated into existing role navigation. Existing Supabase command/receipt/atomic commit boundary remains authoritative.

**Tech Stack:** TypeScript 5.8.3, static PWA, existing Supabase Edge commands, node:test, Playwright browser scenarios.

**Spec:** docs/superpowers/specs/2026-10-31-learning-lab-design.md

## Global Constraints
- Preserve all existing stars, coupons, time coupon behavior, and gacha visibility.
- Missing learning state means child access is disabled.
- Only admin may test/manage/publish; giver keeps existing permissions; child may use only the current publication.
- Preview completion never grants stars or creates child learning evidence.
- No microphone, child audio upload, external AI runtime, or new paid services.
- Five reviewed questions per lesson; six initial lessons; hints and repeat attempts do not penalize stars.
- Default draft: english-colors and math-ten; dailyLimit 2; starsPerSession 1. These settings do not publish the feature.
- Publishing requires successful admin previews of every selected lesson for the current content version and a separate explicit UI confirmation.
- Learning runs have caller-generated UUIDs; server validates complete answers. Both request idempotency and run-level duplicate protection apply.
- Parent preview summaries capped at 30; child completion summaries capped at 60. Persistent praise references prevent repeat rewards even after summary pruning.
- Keep actual production families unpublished during deployment.

## Review Focus
- Child forgery of navigation, preview action, publish action, or praise action must fail.
- Another guardian unpublishing or replacing a release invalidates stale child completion and closes the child runner on refresh.
- Double completion under different request IDs and double praise under different request IDs never duplicate records or stars.
- Draft edits do not modify an active publication; stale draft or release operations cannot overwrite current choices.
- Navigation, role changes, app hiding, muted/unavailable speech, and 360px/iPad widths must remain usable without misleading completion.

---

### Task 1: Reviewed content and deterministic evaluation
**Files:** Create `supabase/functions/_shared/learning-content.ts`, `tests/learning-content.test.mjs`.
**Interfaces:** The contract in `docs/technical/LEARNING_CONTRACT.md` is the shared public API.
- [x] Write independent fixtures testing all lesson/answer IDs, exact arithmetic/visual counts, full completion requirements, support counting and malformed answers.
- [x] Run targeted tests and observe RED before implementation.
- [x] Implement the six five-question lesson packs and pure evaluator.
- [x] Run focused tests; report the commands and results.

### Task 2: Learning state, permissions and publication
**Files:** Create `supabase/functions/_shared/learning.ts`, `tests/learning-domain.test.mjs`, `tests/learning-service.test.mjs`; modify `domain.ts` narrowly.
**Interfaces:** Learning settings/state/actions are specified in LEARNING_CONTRACT.md. Existing `applyAction` and `processCommand` remain entrypoints.
- [x] Add failing behavioral tests for default hidden, permissions, no preview reward, preview-before-publish, draft isolation, withdraw, stale revisions, daily limits and idempotent praise.
- [x] Implement validated action handling, bounded summaries and existing praise/ledger integration.
- [x] Run focused tests and the unit suite, preserving legacy state and transactions.

### Task 3: Guardian lab and learner activity UI
**Files:** Create `src/learning.ts`, `src/learning.css`, `tests/learning-ui.test.mjs`; integrate navigation/controller in `main.ts`, `ui.ts`, `experience.ts`; include assets in build/service worker.
**Interfaces:** Controller integration and data selectors are specified in LEARNING_CONTRACT.md.
- [x] Add failing UI behavior tests for role-safe views and publication state.
- [x] Build lesson selection, guardian setup/publish confirmation, question runner, replay/text/hint/model assistance, completion and parent results.
- [x] Integrate main lifecycle, snapshot refresh and role/navigation cleanup. Never reset an active question because of a routine refresh.
- [x] Run focused UI tests and actual browser flows at mobile/iPad/desktop widths.

### Task 4: Verification, documentation and guardian-only release
**Files:** Add `tests/learning_browser_test.py`, `docs/technical/LEARNING_LAB.md`, release report; update package/version/current status and deployment entrypoint as needed.
- [x] Run typecheck, complete unit suite, existing and new browser tests, and existing database gate in CI (local type/unit/browser gates completed).
- [x] Obtain independent code review, resolve material findings, and inspect rendered screenshots.
- [x] Save source/tests/docs to GitHub with a lease against the inspected main SHA; deploy the compatible Edge function and Pages build.
- [x] Verify deployment commit/status, unauthenticated API behavior, and read-only production unpublished state. Do not modify real learning/reward data for testing.

## Release evidence

- Source PR #2 merged; runtime commit `f5681a9af09d9cc11435a5180561d3d5f5d363e4`.
- 362 unit tests; 73 browser groups; CI PostgreSQL gate passed.
- Independent review fixes rechecked; Edge version8 and Pages run41210844912 verified.
- Production learning remained unpublished. See docs/verification/LEARNING_LAB_RELEASE.md.
