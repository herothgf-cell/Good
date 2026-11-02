# Praise management implementation plan
> Execution: inline, no independent subagent available.
**Goal:** 행동 편집/편지 보관/칭찬 날짜를 기존 앱에 통합한다.
**Architecture:** Shared domain validation and existing CAS receipts; existing UI routes plus a separate letter archive route.
**Tech Stack:** TypeScript 5.8.3, Node 22, Deno Edge, Playwright.
**Spec:** docs/superpowers/specs/2026-11-02-praise-management-design.md

## Global Constraints
Do not change balance history, coupons, learning state or child publication. Use Korea dates for event-date semantics; real timestamps for receipts. Preserve legacy records.

## Review Focus
Stale reorder/edit after deletion; day boundary and invalid dates; date limits cannot be bypassed; archived/read items cannot reappear as unread; failed or retried writes do not lose input or award duplicate stars.

## Task 1: shared rules and praise dates
- [x] RED: add tests in tests/praise-management-domain.test.mjs for soft delete, list reorder/version, backdate validation, limit isolation, old records, CAS conflict/retry.
- [x] GREEN: implement domain.ts helpers/actions and preserve all unrelated fields.
- [x] Verify `npm run typecheck && npm test`.
## Task 2: UI and controller
- [x] RED: tests/praise-management-ui.test.mjs and browser scenarios for archive, forms, sorting/deletion.
- [x] GREEN: experience.ts, ui.ts, main.ts, focused date UI helper and CSS. Use explicit read confirmation and deletion confirmation.
- [x] Verify complete browser suite, small and tablet layouts, screenshots.
## Task 3: delivery
- [x] Self-review (no independent reviewer), full suite rerun; check patch against v0.10.
- [ ] Commit changes on feature branch; verify CI then deploy family-action and Pages without touching actual family data.
- [ ] State verified vs unverified scope and leave backup patch/compatibility artifact.
