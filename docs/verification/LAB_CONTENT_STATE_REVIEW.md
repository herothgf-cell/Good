# Independent learning v2 content and state review

Reviewed 2026-11-01 against `docs/technical/LEARNING_V2_CONTRACT.md`, `docs/superpowers/specs/2026-11-01-learning-v2-design.md`, the supplied content/state diff, and both author implementation reports. Scope is the content module, lab state module, their domain integration, and focused tests. Integration, UI rendering, provider handling, and the actively changing coach implementation are outside this review.

## Verdicts

- **Spec compliance: pass with one low-severity educational wording correction.** The scoped code implements the calibrated curriculum, deterministic answer generation, exact input validation, observation/correctness distinction, guardian-only mutations, version checks, bounded state, and reward neutrality. The approved completion-key, reservation-nonce, and midnight session-retention extensions are consistent with the implementation.
- **Code quality: approve with a minor content correction.** No blocking correctness, security, or legacy-regression issue was found in this scope. The pure content/evaluation functions and isolated lab state mutations are straightforward to audit. Existing service receipt behavior is intentionally relied on for permanent replay protection; the documented stable request IDs remain a required integration condition.

## Finding

### Low: the supported 100-won setting describes coins as banknotes

**Location:** `supabase/functions/_shared/learning-lab-content.ts:101`.

`LabSettings.moneyUnit` explicitly supports 100, but the transfer activity always uses the counter `장` and the hint calls the objects `지폐`. For the 100-won option, the real currency object is a coin, so the content contradicts the familiar-money representation being taught. Arithmetic and total counts remain correct; this does not affect the default 1,000-won lesson or state security.

**Minimal reproduction:**

```js
const step = buildLabLesson(
  'math-transfer',
  {...DEFAULT_LAB_SETTINGS, moneyUnit: 100},
  17,
).steps[0];
console.log(step.prompt, step.hint, step.explanation);
```

Observed output:

```text
100원짜리 6장과 9장을 합치면 모두 몇 원인가요?
먼저 지폐가 모두 몇 장인지 생각하고 한 장의 금액을 곱해 보세요.
6 + 9 = 15장이므로 15 × 100 = 1500원이에요.
```

**Minimal fix:** choose `동전`/`개` for unit 100 and `지폐`/`장` for units 1,000 and 10,000 in the prompt, hint, and explanation. The money renderer should use a coin representation for unit 100; renderer review belongs to the UI reviewer. Add a small focused assertion covering the 100-won noun/counter if that content is changed.

## Compliance assessment

### Curriculum and deterministic correctness

- Defaults are ai/ay and ordinary two-digit arithmetic, with CVC explicitly optional. Separate addition/subtraction settings select carrying/borrowing independently. Every calculation operand is two digits, sums stay below 100, and differences are nonnegative.
- Transfer connects bill/coin count and currency value to grouped item count and a symbolic sum, followed by a fresh analogous sum with a strictly different answer. It does not treat repeatedly entering the same total as the only transfer evidence.
- Level 1 clocks stay within the hour. Levels 2 and 3 cross an hour, and level 3 includes reverse/start and elapsed-duration questions. Time metadata uses exact integer-minute arithmetic; its bounded ranges cannot wrap into an invalid hour.
- Calendar level 1 remains in the starting month; level 2 necessarily crosses its end. UTC Gregorian arithmetic handles February, leap years, short months, and December/year rollover. Target month/day metadata agrees with the generated date answer.
- Equal groups preserve configured group size 2 or 3 through pictures, repeated addition, multiplication, and a changed context with a fresh group count. Pattern prompts declare the constant or alternating increments, avoiding underdetermined rule guessing.
- Seed validation is bounded to safe integers 0 through 2,147,483,647. Each lesson has 4–6 stable steps. Generated number/choice answers and visual metadata come from the same quantities.

### Reading, vocabulary, and claims

- Vocabulary recall provides Korean meaning and visual cues without an English target in its initially visible content metadata; non-model speech is empty. Revealing `target`/`explanation` correctly is a UI responsibility.
- Reading separates whole-word modelling, an observed attempt, two distinct new-pattern words, connected text, and a meaning choice. Connected-text helpers include out-of-bank words. No individual letter-name TTS is represented as phoneme instruction.
- Practice requires both an explicit self/guardian observation and its evidence source. Every practice response increments `observed`; none increments `correct`. Model steps, repeated attempts, and any help cannot become independent outcomes. The data records observations rather than asserting automated reading mastery.
- Scenario content is explicitly described as fixed/offline preview content; it does not claim to be a live conversation service.

### Validation and privacy boundaries

- Settings require every exact bounded field, reject unknown keys, reject coercible enum substitutes, and clone accepted settings.
- Evaluation requires exactly one response for every server-generated step and rejects missing, duplicate, and foreign IDs, invalid attempts/help/evidence, unsupported fields, and malformed numeric/time/date values.
- Practice `value` is prohibited. Numeric and choice values are constrained before entering the canonical completion key. The key contains fixed quiz metadata and observations, not a transcript. Unknown action fields are rejected before a new service receipt is committed.
- Direct-entry review can complete without an invented answer only after hint/model with an explicit retry observation and evidence. Wrong unreviewed final answers are rejected. Correct numeric/choice final answers remain separately counted as correct.

### State, permissions, and replay

- The server context role gates all three new domain actions before mutation. Client actor/role fields cannot authorize a request. Only optional `learningLab` is created; no legacy state migration or business branch was changed.
- Preview summaries have `mode: 'preview'` and `stars: 0`. The module does not modify balance, ledger, coupons, praise, child quotas, publication, or legacy learning runs.
- Saved settings require an exact current version and reject overflow. New completion requires the current content version, settings version, and settings snapshot.
- Retained exact run retries return the existing result without aggregation. Actor identity, settings, seed, attempts, help, evidence, and normalized values participate in comparison; changed reuse rejects. The comparison sorts step tuples, so direct-domain answer order does not affect it.
- Only the latest 40 summaries persist; known server-defined skill progress remains bounded at 200 entries and guards safe-integer overflow.
- Persistent service receipts remain authoritative after summary pruning. This depends on integration using `requestId = runId` for completion and `requestId = turnId` for reservation, as explicitly approved. A transport retry must preserve its original serialized payload because existing service receipt comparison precedes domain normalization.
- Reservations use server time, enforce 40 turns per Korean day, 12 lifetime turns per session, a strict age below 15 minutes, and session actor ownership. Active prior-day sessions retain their original owner/start/count across Korean midnight while the family day counter resets. Same-day expired IDs are retained; expired prior-day records can be pruned. The 80-session bound covers at most adjacent daily budgets.
- A successful fresh reservation receives the server nonce from `ctx.newId()`. The paid endpoint must compare that nonce against its invocation nonce before spending; checking only that reservation succeeded would be insufficient. Root reports that this comparison is implemented, but endpoint verification is outside this review.

## Review evidence and limits

- Read the complete scoped source, the supplied diff, the design and contract, both author reports, focused content/state tests, and the unchanged command service receipt flow.
- Independently executed a targeted 100-won reproduction; output above confirmed the finding.
- Independently evaluated an ai/ay reading lesson with all practice steps explicitly guardian-observed: five observed practice steps produced zero practice correctness claims, with only the meaning choice counted correct. The model step remained supported.
- Did not rerun the identical 17 content / 19 state / 179 legacy checks already reported green. Their assertions were reviewed, including deterministic arithmetic/date checks, strict payloads, role gates, stale versions, pruning, replay races, nonce winners, and midnight ownership.
- This is a static/source review plus targeted reproductions. It does not certify rendered money/clock/calendar/group visuals, client concealment, role-specific UI exposure, final endpoint payment gating, microphone lifecycle, or the final integrated suite. Those remain with the respective integration and UI reviews.

No product code was edited by this reviewer.
