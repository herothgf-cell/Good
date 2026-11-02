# Learning v2 independent whole-branch release review

Reviewed 2026-11-01 in `feat/learning-v2-guardian`, against base `1f9f8922d0c9500644541b300ce247ab7404629a`, the supplied full working diff, current implementation, design, interface contract, and author/review reports. This review covers the integrated guardian UI, curriculum, state, coach client/server, authentication, existing SQL receipt boundary, build and cache. It does not change product code.

## Original verdicts (superseded by final sign-off below)

- **Spec compliance: conditional pass, pending the speech callback fix below.** The implemented scope matches the authorized guardian-only testing release. The approved installed-local-English-TTS/text-fallback ruling supersedes the design's original server-synthesis sentence. No child voice/publication, EBS, coupon, or reward expansion is present. The outstanding callback issue conflicts with acceptance item 6's stale-callback requirement.
- **Code quality: request one focused medium-severity correction before final sign-off.** No critical/high security, payment duplication, persistence, content correctness, or legacy compatibility blocker was found. The one confirmed lifecycle race is localized and should receive a targeted regression test rather than another unrelated full-suite run.

## Prioritized findings

### P2 — An old speech callback can unlock the next speaking turn

**Location:** `src/learning-coach.ts`, `speak()` (reviewed lines 126–130).

`onend` and `onerror` are guarded by the overall coach generation/identity, which changes on `leave()`, but not by the particular utterance. The 20-second timer cancels an utterance and immediately marks the coach ready. A later cancellation callback from that utterance can arrive after another turn has begun speaking. It then clears the *new* speech timer and sets the new turn to ready. The microphone/send controls can therefore become available while the second reply is still speaking. The old callback may also replace the new status with a misleading playback-error message.

**Reproduction, independently executed against the built controller:**

1. Install a fake local English voice, capture utterances and timeout callbacks, and check an available coach.
2. Send the first text turn. Invoke its 20-second speech timeout. State becomes `ready`.
3. Send the second text turn. State becomes `speaking`.
4. Invoke the first utterance's delayed `onerror`. State incorrectly becomes `ready`.

Observed output: `After timeout: ready`, `Second speech: speaking`, `After stale cancelled utterance error: ready`.

**Correction:** identify the active utterance with a token or object reference. Every completion/error/timeout callback must verify that it still owns the active speech operation *before* clearing a timer or updating phase. Invalidate/detach that ownership before cancellation, including timeout and leave. A regression should exercise a captured late callback after the next utterance starts, and confirm both the new speaking phase and its timeout remain intact. This is a lifecycle/interaction issue, not an authentication or paid-quota bypass.

### P3 — Design wording promised server speech synthesis (resolved during review)

**Location:** `docs/superpowers/specs/2026-11-01-learning-v2-design.md`, implementation choices paragraph (reviewed line 26).

The design says “server speech synthesis,” while the worklog ruling, current contract, implementation, and user-facing UI use installed local English speech synthesis with text fallback. Update this sentence so future readers do not infer an unimplemented or unverified provider-speech path. The implementation's honest fallback behavior is appropriate under the root's explicit ruling; this is documentation drift, not a request to add a different speech provider.

**Disposition:** root corrected the design sentence during this review. Independently reread the revised paragraph and the new `docs/technical/LEARNING_V2.md`; both now explicitly describe installed local voice/text fallback. P3 is resolved.

## Scope and compliance assessment

### Guardian access and legacy compatibility

`main.ts` defaults authenticated/demo admins entering learning to `LearningLabController`; the secondary explicit `learning-legacy` action opens the existing controller, and that view has an explicit return action. Children continue through the original publication-aware learning controller. New UI render/event handlers reject child and giver, and `applyLearningLabAction` rejects non-admin context roles before mutation. No new publication control exists in v2.

The coach is guarded at several independent boundaries: the browser requires cloud/admin identity; the handler verifies the bearer through the Auth user endpoint; family membership comes from database rows; and the reservation store again requires admin membership. Family and user IDs used in database filters have already been constrained to UUIDs/authenticated IDs. A forged body role or a public/publishable key does not establish administrator authority.

The existing SQL `family_commit` locks the family row, checks actor membership/role, checks the request receipt, then enforces revision and commits state and receipt together. Direct public/anon/authenticated execution remains revoked; only the service role can commit. The new code does not replace these SQL controls or require a migration. Legacy domain branches, publication/history, praise, rewards, coupons, and child quotas remain separate.

### Exact content, answers, and visuals

The new catalog has nine activities, with six-step calculation/word/reading lessons and four-step transfer/time/calendar/group/pattern/conversation lessons. Defaults retain ai/ay and two-digit calculation. Addition/subtraction regrouping are configured separately. Content uses bounded deterministic seeds and reviewed metadata; calendar arithmetic uses UTC Gregorian dates, including leap February and year rollover.

Direct math entries are normalized/validated as bounded number, time, or date syntax. Exact structured visual quantities agree with the underlying content: rods/units, clock hand angles, calendar offsets/month lengths, equal groups, and money counts. The earlier 100-won issue is corrected in both content and rendering: coins use `동전`/`개`; banknotes use `지폐`/`장`.

The integrated renderer withholds unknown end/start clocks and calendar target markings until model/result; the content's full visual metadata does not itself leak the answer into the initial UI. Word recall withholds the English target, while independent/transfer reading deliberately displays the text to be decoded. Listening/revealing a model marks support, including in the scenario activity. Practice observations require self/guardian evidence and do not become automated pronunciation/reading correctness claims. Scenario and real AI panels remain explicitly separate.

The reviewed cross-month screenshot shows a correct February 29 to March transition, an unmarked target month, readable Korean text, and a contained keypad. Browser artifacts report phone/iPad-width control and overflow checks. The test environment's missing emoji font affects decorative glyphs; exact quantity representations use SVG/CSS.

### Completion receipts, retries, and stale data

Each preview creates one stable `runId`. Main integration sets the command `requestId` to that same `runId`; the pending-action adapter only retries an identical action with matching mode/family/actor. Consequently, authoritative command receipts prevent aggregation replay even after a run falls out of the retained latest 40 summaries. Retained run duplicates also compare constrained completion metadata, and changed ID reuse is rejected.

The state layer recomputes evaluation from server content and rejects unknown fields, duplicate/foreign/missing steps, malformed values, unsupported evidence and invalid versions. Practice values are prohibited; the stored completion key contains bounded quiz metadata, not conversation text. Aggregate skill progress remains bounded independently of summary pruning. The new actions mutate only optional lab state, and previews record zero stars.

The controller preserves unsaved settings and answer input during same-identity/version polls. Actor/family/role changes discard transient state. Changed settings versions stop active speech/coach work and require a restart. A saved authoritative run reconciles an ambiguous save response. There is no silent child-publication or production migration side effect.

### Voice/transient lifecycle and paid-request protection

Availability checking does not open the microphone. Recording begins only from the guardian's explicit recording control after the configured status permits it. Media is limited to a 15-second turn and 512,000 bytes; supported MIME selection includes MP4. Tracks are released when recording finishes, before response speech. Oversize/error paths discard media; leave/pause/hidden/identity reset invalidate pending callbacks, abort transport and clear dialogue. A late microphone-permission resolution after leave stops the returned tracks without constructing a recorder.

Client requests use the authenticated transient API path, an abort/timeout signal, `cache: no-store`, and no automatic retry or durable pending voice payload. Raw audio and full conversation remain transient. The provider adapter sends bounded history, uses structured response output and `store:false`, validates response shape/length/question bounds, and sanitizes upstream failures. Local voice selection excludes remote voices and explicitly falls back to text.

Reservations persist before any paid provider call. They enforce 40 turns per family/Korean day, 12 lifetime turns per session, a 15-minute age, and session actor ownership. Active sessions retain count/owner/start across Korean midnight. The endpoint uses `turnId` as the persistent receipt ID and compares its server-generated nonce to the committed receipt's nonce. This correctly distinguishes the winner even when concurrent duplicate `family_commit` calls both return success with the original receipt; the losing invocation does not call the provider. Failed provider calls consume a reservation and are never automatically retried.

The confirmed speech callback race above is the remaining exception to otherwise sound stale-operation handling.

### Build, public bundle, and cache

The frontend TypeScript include list contains `src` and `_shared` only; `_server`, the edge entrypoint, and secret-loading/provider code are not included in public dist/standalone bundles. The build includes new styles and shared/client modules. A targeted search of built `dist` and `preview.html` found no `OPENAI`, `_server`, edge entrypoint, or `api.openai` content. No actual credential values were read or printed for this review.

The service-worker cache advances to v0.8.0 and contains the new shell modules. It only handles same-origin GET allowlisted app-shell assets; it bypasses remote APIs and `config.js`. Old praise-star shell caches are removed on activation. Coach responses additionally carry `Cache-Control: no-store`.

## Evidence and verification limits

- Read the working diff and current relevant implementation, contract, design, worklog, author reports, prior content/state review, focused tests, unchanged shared command service, and existing commit SQL.
- Independently executed the targeted late speech-callback reproduction above. No product files or tests were changed by this reviewer.
- Inspected the current browser result artifacts: six lab groups and three coach/media groups, zero page errors, no real provider used. Inspected the cross-month calendar screenshot directly.
- Root reports the fresh integrated typecheck/build and all 33 test files green after the coin correction, plus the legacy browser groups. This review did not repeat those full suites; it reviewed their relevant assertions and targeted the uncovered lifecycle case.
- Real provider credentials/configuration and live voice/text response quality are unconfigured/unverified. The unavailable status is honest and does not reserve paid turns. This release review does not certify an operational real-provider connection.
- Browser media/provider fixtures do not establish physical iPad Safari permission, audio route, microphone quality, installed voice availability, or provider transcription performance. These remain explicit real-device/adult-provider checks, not evidence of child voice readiness.
- This review does not assert that a deployment, authenticated production transaction, or database mutation was performed. Guardian-only deployment remains within the authorized scope after the focused finding is resolved; enabling child voice or publishing v2 would require a later explicit release decision.

## Follow-up disposition

At report completion, P2 is reported to root with the reproduction and proposed minimal ownership guard; P3 is resolved and verified above. Final approval should record the focused fix and regression evidence here rather than silently dropping the original finding.

## Final sign-off — scoped utterance fix re-review

**P2: ADDRESSED. P3: previously resolved. No unresolved review findings.**

Reviewed `/tmp/good-learning-v2-speech-fix.diff`, the current `src/learning-coach.ts` and focused client tests, and `docs/verification/COACH_UTTERANCE_FIX.md`. This follow-up is restricted to the reported speech lifecycle defect and the fix's immediate effects; it does not reopen the whole-branch review.

The fix keeps an active utterance reference. Every end/error/timeout callback compares its captured utterance with that reference before checking identity, touching the timer, or changing visible state. Completion/error null the reference and clear/reset the timer. Timeout nulls ownership before calling `speechSynthesis.cancel()`, so even a synchronous cancellation event cannot re-enter as the owner. `leave()` likewise invalidates ownership before cleanup/cancellation. Starting a new utterance replaces the reference before cancelling earlier browser speech. This closes both the same-generation race and the old-generation callback's ability to clear a new timer.

The eight added regressions cover delayed end/error callbacks after timeout, normal completion, playback error, and leave/reconnect. They assert the full new view is unchanged, another send remains blocked while speaking, and the new timer still fires. The worker report documents those eight cases failing against the original source and all 15 client tests passing after the change; it also reports typecheck and all 33 test files passing. Root retains the consolidated build/full-suite release verification.

Independently reran the original narrow reproduction against the fixed built controller, strengthening the speech fake so `cancel()` immediately invokes the previous utterance's error callback. After first timeout, the next turn remained `speaking` after the captured old error callback, retained exactly one timer, and returned to `ready` when its own timeout fired. The command passed. No broad suite was repeated during this scoped review.

No new breakage was found in the fix diff. It does not alter authentication, provider/transport, paid limits, persistence, curriculum, rewards, or the public coach interface.

**Final spec-compliance verdict: PASS for the authorized guardian-only testing scope.**

**Final code-quality verdict: APPROVE.** The review no longer blocks the authorized guardian-only release, subject to root's normal consolidated release checks. The original findings and verification history are retained above. Real provider connectivity and physical iPad behavior remain unverified as already documented; this sign-off makes no paid-provider, production-deployment, or child-voice-readiness claim.
