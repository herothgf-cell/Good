# Chat and Praise Letters Implementation Plan

**Goal:** Ship integrated bubble chat plus safe rule/letter/date management.
**Architecture:** Extend the existing pure domain commands and shared renderer. Preserve CAS/idempotency in family-action, reuse generated AI audio from the unshipped v0.10.
**Tech Stack:** TypeScript 5.8.3, DOM/CSS, Deno Edge Functions, Node tests, Playwright.
**Spec:** docs/superpowers/specs/2026-11-02-chat-letters.md

## Constraints / Review Focus
- Guardian-only learning; no family balance/child publication mutations during tests.
- Historical rule deletion cannot remove ledger/praises or resurrect deleted identifiers.
- Reorder must reject stale versions, duplicate/missing/foreign IDs.
- Date checks: Korean midnight, leap days, nonexistent dates, old legacy records, future dates.
- Chat: no duplicate user bubbles; failure preserves submitted text; no failed/pending turns in context; no typed draft loss on rendering.

## Tasks
- [x] 1. Write failing domain tests for rule deletion/reorder, backdated praise, legacy dates, archived letters; implement and run full suite.
- [x] 2. Write failing UI tests for child unread/archived views, rule controls and dates; implement renderer/events and verify.
- [x] 3. Write failing coach tests for optimistic conversation; implement aligned bubbles, auto-scroll respecting reading position, sound replay and unified composer; verify.
- [x] 4. Browser regressions at 390px and 1024px, capture screenshots; self-review and full regression suite.
- [ ] 5. Publish code to feature branch, server functions, CI/Pages only when verified. Record real deployment outcome without claiming actual device/API audio quality tested.
