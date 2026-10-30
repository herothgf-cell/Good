# Time Coupons Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for domain implementation and independent review. Root owns UI integration and deployment.

**Goal:** Allow partial minute grants and repeated partial use of time coupons without losing balances or duplicating usage.

**Architecture:** Add optional duration/balance/history metadata to schema-1 state. Pure shared domain helpers normalize legacy coupons; existing CAS and receipt handling persist exact outcomes. The UI captures the version visible when an action is opened.

**Tech Stack:** TypeScript, static PWA, Supabase Edge Functions and JSONB state, Node tests, Python Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-time-coupons-design.md`

## Global Constraints

- Positive whole minutes, 1–1,440; gift minutes per coupon cannot exceed reward duration; quantity remains 1–20.
- No new runtime dependencies, auth changes, migrations, live test users, or mutations to existing family records.
- Preserve ordinary coupons, stars, finite stock unit semantics, gacha default-hidden behavior, and receipt-first retries.
- Use immutable coupon titles for legacy inference; explicit null prevents inference.
- Every timed transition uses a captured `usageVersion`, including revoke; mutations increment it.

## Review Focus

- Legacy used/revoked coupons cannot regain usable time.
- Stale actions cannot affect a later request cycle after a partial use returns to available.
- A silent snapshot refresh cannot replace the version captured by a rendered button/dialog.
- Partially consumed gifts cannot be revoked as unused stock.
- Invalid amounts, retries and concurrent completions cannot duplicate grants or usage.

## Task 1: Shared time accounting

**Files:** `supabase/functions/_shared/domain.ts`; `tests/time-coupons-domain.test.mjs`.

**Interfaces:** Add `Reward.durationMinutes?:number|null`; `Coupon.durationMinutes?:number|null` (actual issued total), `remainingMinutes?:number`, `requestedMinutes?:number`, `usageVersion?:number`, `usageHistory?:CouponUsage[]`. Each usage stores `id`, `minutes`, `usedAt`, `actorId`, `actorName`.

Export `durationFromTitle(title:string):number|null`, `rewardDuration(reward:Reward):number|null`, `couponTime(coupon:Coupon):{totalMinutes:number;remainingMinutes:number;requestedMinutes:number|null;usageVersion:number;usageHistory:CouponUsage[]}|null`.

Extend `reward/grant` with optional `minutes`; extend coupon lifecycle actions with optional `minutes` and `usageVersion`, and coupon revoke with optional `usageVersion`. Timed requests require explicit minutes. All timed transitions require usageVersion (legacy effective zero). Non-request transitions use frozen server requested minutes, not client replacements.

- [x] Write/run failing domain tests: legacy duration/statuses, partial/bulk grants, 10+5+15 exact use, cancellation/rejection, invalid amounts and unauthorized roles, stale/missing version, unchanged ordinary coupons, immutable issuance, revoked/partial gift guards.
- [x] Implement helpers, whitelisted reward validation, issuance snapshot, versioned time lifecycle and safe revoke.
- [x] Run focused domain tests, full existing tests and typecheck; report evidence for review.

## Task 2: Guardian and child UI

**Files:** `src/time-coupons.ts` (new pure view helpers), `src/guardian.ts`, `src/ui.ts`, `src/experience.ts`, `src/main.ts`, `src/experience.css`; `tests/time-coupons-ui.test.mjs`.

- [x] Write/run failing render tests for time controls, exact balance, requested amount, history, safe revoke visibility, and captured usage version.
- [x] Add minutes controls and presets to grant/request flows; editor supports explicit time configuration and title suggestions.
- [x] Render totals/history and frozen version data attributes on coupon controls; confirmation payloads use the opened form/button version.
- [x] Preserve current ordinary-coupon interactions; verify mobile layout and real action payloads through browser scenarios.

## Task 3: Persistence and browser regression

**Files:** `tests/time-coupons-service.test.mjs`, `tests/time_coupons_browser_test.py`, `.github/workflows/ci.yml`, `package.json`.

- [x] Verify grant/use retry, changed-payload receipt conflict, concurrent completion/request, stale ABA actions, and demo reload against real domain/service classes.
- [x] Browser: legacy30 → request10 → approve10 → complete10 → remaining20 → cancel/reject without deduction → use remaining20; partial gift10×2; ordinary flow; remote stale dialog; 360/390/768 widths.
- [x] Add browser command to CI and run combined existing/new checks.

## Task 4: Review and publish

- [x] Independent code review of the final diff; resolve material findings.
- [x] Update version to 0.6.0, service-worker cache, user docs and status.
- [ ] Publish source commit against current remote main, pin Edge entrypoint to source commit, deploy function with existing JWT/CORS configuration.
- [ ] Verify final exact-SHA CI, cloud smoke and Pages deployment; report app link and usage steps in Korean.
