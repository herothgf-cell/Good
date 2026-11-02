# Learning lab state: implementation and verification

Implemented in the isolated `learning-v2` checkout. Ownership: `supabase/functions/_shared/learning-lab.ts`, the small domain integration in `supabase/functions/_shared/domain.ts`, and `tests/learning-lab-state.test.mjs`. No commits, migrations, production writes, child publication, paid provider calls, or changes to other workers' implementation files.

## Behavior

- Adds optional, lazily created `State.learningLab`. Reading defaults returns an isolated clone and never migrates or publishes legacy data.
- All three new mutations require the server context actor to be an admin, including malformed requests with forged role fields.
- Settings require the complete exact content-defined settings schema and optimistic version match. Seeds are safe integers in `0..2147483647`.
- Completion reconstructs the deterministic server lesson, validates bounded response metadata, and evaluates it through the content module. It saves reward-neutral preview summaries (`mode: preview`, `stars: 0`) and known server-defined skill aggregates only. Existing stars, ledger, coupons, praises, rewards, quotas, and v0.7 learning state remain untouched.
- Preserves the latest 40 summaries while retaining bounded aggregate progress (at most 200 known skill IDs). Aggregate counter overflow is rejected.
- Exact retained-run retries do not aggregate twice. Different results/settings/seed/actor under a retained run ID reject. Exact duplicates may recover after settings changes. New stale completions reject.
- Explicit guardian/self review after hint/model may finish numeric/choice activities without supplying an invented answer. Practice stores only bounded observation/evidence metadata and never a spoken or written transcript.
- Unknown top-level action and answer fields reject before a command can persist its payload as an idempotency receipt.

## Integration agreements and contract extensions

1. `LabRun.completionKey?: string` is an internal, bounded canonical comparison string (not a hash). It contains only validated fixed quiz metadata, normalized numeric/choice values, settings/version/seed, and actor identity. It contains no practice answer, audio, chat, or medical/profile information. The maximum length is 6,000 characters. This distinguishes changed attempts/help/evidence even when aggregate scores match.
2. `Result.coachReservationId?: string` is a server-generated reservation nonce obtained from `ctx.newId()`. The paid endpoint must compare the returned nonce to its per-invocation nonce. A duplicate request race can return the winning database receipt without reporting a CAS conflict; only the invocation whose nonce matches may call the provider. This avoids duplicate billing without a schema change.
3. Reservations are idempotent through persistent command receipts, with `requestId = turnId`. Domain reservation alone consumes one slot on each accepted action; it does not maintain a second permanent turn-ID registry.
4. Preview completion must use stable `requestId = runId`. Persistent receipts are authoritative after a run has been pruned from the 40-summary window. Without that stable ID, a bounded state cannot recognize every historical UUID forever. A service integration test explicitly retries the first completion after 42 runs and verifies no additional aggregation or commit.
5. Family voice usage is 40 turns per Korean day, each session is limited to 12 lifetime turns and strictly less than 15 minutes, and session actor ownership is enforced. Active sessions preserve owner/start/turn count across Korean midnight while the family daily counter resets. Expired prior-day sessions are pruned; same-day expired session IDs reject reuse. Session metadata is bounded at 80 entries (at most a prior-day plus current-day budget), with no audio, transcripts, or conversation payloads saved in state.

## Test-first evidence

The first target suite was written and run against the prior domain before implementation: 13 expected failures for missing actions/defaults/content integration. Once real content existed, added nonce, strict-action metadata, and across-midnight ownership tests were observed red before their fixes. Self-review added two further failing regressions: missing numeric answer during explicit model-assisted review, and accepted money-unit syntax normalization; both were then fixed.

The final 19 target tests exercise the real domain, real content module, and real command service with an in-memory store implementing receipts and CAS. They cover role gates, nonmutation on rejection, complete settings validation, stale settings/content, reward neutrality and legacy-praise rejection, exact/conflicting run retries, summary pruning, review outcomes, UUIDs, family/session quotas, session age and ownership, Korean midnight, competing last-slot requests, duplicate receipt races, winner nonce, unknown metadata rejection, and a pruned-run receipt recovery.

## Verification commands and results

- `NODE_OPTIONS=--no-experimental-global-navigator npm run build`: passed, including generated browser and shared modules.
- `npm run typecheck`: passed (`tsc --noEmit` and edge-function TypeScript).
- `node --no-experimental-global-navigator --test --test-isolation=none tests/learning-lab-state.test.mjs`: **19/19 passed**, no failures.
- Selected existing domain/guardian/learning/service/gacha/time-coupon/bulk-reward regression tests under the same Node compatibility flag: **179/179 passed**, no failures.
- `NODE_OPTIONS=--no-experimental-global-navigator npm test`: earlier complete run **30/30 test files passed**. A fresh final run after another worker added coach-client tests reported **30 passed / 1 failed out of 31 files**. The sole failing file was the root-owned `tests/learning-coach-client.test.mjs` while its implementation was in progress; direct execution showed its seven newly introduced expectations failing against the current coach stub. This worker did not alter those files. Root must rerun the full suite after completing the coach client.
- `git diff --check`: passed.

The environment uses Node 24 and exposes native `navigator.locks`; the existing DemoRepository concurrent WebLocks tests hang in this sandbox. Disabling Node's experimental global navigator exercises the existing queue fallback, matching the project's pinned Node 22 test environment. No source workaround was added. Browser WebLocks behavior remains an integration/browser verification item for the root.

## Self-review

Checked the complete diff against Task 2 and the contract. Domain changes are limited to the new optional state field, action union/import/dispatch, and optional result nonce; no legacy business branches were modified. Fixed an accidental type-only nonce addition outside `Result` during review. Checked state and receipt surfaces for arbitrary free text: strict action/settings/answer keys plus normalized numeric/choice data prevent a transcript field from entering a saved lab action. Verified practice observations cannot claim automatic correctness. Reviewed midnight reset semantics with the root and added a concrete 23:59-to-00:01 Korean time regression. Confirmed actor identity and clocks come solely from server context. Root owns endpoint payment gating, stable client request IDs, child screen exclusion, browser tests, and final full-suite/release verification.
