# Learning lab content/evaluation implementation report

Scope: Task 1 of `docs/superpowers/plans/2026-11-01-learning-v2.md`, exact `docs/technical/LEARNING_V2_CONTRACT.md` interface. Product files changed only by this worker:

- `supabase/functions/_shared/learning-lab-content.ts`
- `tests/learning-lab-content.test.mjs`

## Implementation

All nine reviewed activities use deterministic seeded generation, stable lesson/position step IDs, bounded skill IDs, and 4–6 steps. Seeds must be safe integers from 0 through 2147483647. Defaults remain play / ai-ay / guided / mixed addition and subtraction / money 1000 / level 1 clock, calendar and patterns / groups of 2. Settings require every exact field and bounded enum value, reject unknown keys, and return a new object.

- Calculation uses two-digit operands with independently configured addition and subtraction carry/borrow constraints. Nonnegative integer solutions, predominantly ordinary two-digit values; money magnitude does not raise all arithmetic magnitudes.
- Transfer explicitly links the same quantities through money (currency value), equal groups (item count), and a symbolic addition (item count), then asks a fresh analogous problem with a different answer. The same repeated answer is never the sole transfer check.
- Clock level 1 remains within an hour, level 2 crosses an hour, and level 3 includes end, reverse/start and elapsed-minute questions. Clock metadata and prompts have matching exact solutions.
- Calendar level 1 remains within a month; level 2 crosses the month. Gregorian arithmetic includes reviewed leap/ordinary February, short-month and December/year-boundary cases.
- Equal groups of 2 or 3 connect pictures, repeated addition, multiplication, and a changed situation with a fresh group count.
- Number patterns state the precise bounded constant or alternating-addition rule in the prompt; no ambiguous rule inference.
- English words use reviewed ai/ay, optional silent-e and optional CVC banks. Model and recall are distinct. Recall has empty speech, Korean-only visual labels and no English target in initially visible prompt/title/cue/helpers.
- Reading separates whole-word model listening, an independent attempt, new words sharing the pattern, connected text, and a meaning choice. All out-of-bank sentence words are explicitly declared as helpers. No letter-name TTS is described as phoneme instruction.
- Conversation is labelled an offline scenario preview and varies by play/shop/build and guided/light support. Korean and one-word replies are welcome. Live AI remains the separate root-owned implementation.

Normalization handles NFKC/fullwidth input, correctly grouped integer commas and optional currency suffix, HH:MM or Korean hour/minute input, and exact Gregorian dates using hyphens/slashes/dots or Korean labels. Malformed, negative, non-integer, overflow, impossible-time and impossible-date inputs are rejected as an empty normalized result.

Evaluation validates one answer for every exact step. Missing, duplicate, foreign steps, unsupported keys/enum values, attempts outside 1–30 and practice text values are rejected. Practice requires independent/supported/retry observation and self/guardian evidence. Practice observations increment `observed`, never automated `correct`. A model step is inherently supported. Any help or repeated attempt prevents an independent outcome. Numeric/choice final correct answers count as correct; explicitly observed retry with hint/model can complete as review without a correct value. Wrong final answers cannot silently complete as successful.

## Tests and actual evidence

1. RED before implementation: `node tests/learning-lab-content.test.mjs` ran 14 behavioural tests, all failed on missing exports/module functionality. Initial plain `node --test` reported only a generic isolated-file failure; direct execution provided the expected assertion diagnostics.
2. The first implementation passed 13/14. The remaining deterministic-variation test caught adjacent-seed correlation in the first random draw. Replacing the initial linear generator with a mixed 32-bit generator made all nine activities vary across adjacent seeds.
3. A new coercible-enum regression failed (`Missing expected exception`) for array/object enum values. Runtime checks were changed to require actual string enums; it then passed.
4. Final focused run: `LEARNING_LAB_CONTENT_MODULE=file:///tmp/lab-content-build/learning-lab-content.js node tests/learning-lab-content.test.mjs` — **17 passed, 0 failed**. Assertions independently calculate arithmetic, elapsed minutes, Gregorian dates, group counts and pattern differences across hundreds of seeds/configurations. Additional tests validate prompt/visual agreement, independent addition/subtraction settings, observation outcomes and invalid answer structures.
5. `npm run typecheck` — **passed**, including browser/shared configuration and Edge configuration with strict/noUncheckedIndexedAccess flags.
6. `NODE_OPTIONS=--no-experimental-global-navigator npm test` — **passed: 30 test files, 0 failed**, including a successful full build, existing legacy tests, and current content/state/UI/coach tests. The compatibility option avoids the pre-existing Node24 DemoRepository Web Locks deadlock; CI uses Node22. The earlier unmodified `npm test` build passed but execution hung in the known existing navigator-lock path; this is not a content failure.

## Self-review and integration notes

- No contract export was added or renamed. Root requested strict complete settings; implemented. Errors use plain Error for root/state handling.
- Stable skill IDs contain dots, e.g. `math.addition.regroup`, `english.reading.ai-ay.transfer`. State worker updated validation accordingly.
- Clock visuals carry both known and target values for exact rendering. During a question UI renders only the known clock (start for end questions, end for reverse questions, both for duration). Calendar target metadata must not highlight the answer before reveal. UI worker was notified and current implementation implements concealment.
- Read/transfer-read display `target`; recall hides it. Non-model practice has no default speech. Explicit model/help reveals the target and must be tracked by UI; UI owner was notified.
- English accuracy is not inferred from speech playback or an observation. Chat/audio/transcript storage and provider behavior are outside this module.
- Self-review found and fixed the seed correlation and coercible-enum issues above. No unresolved content blocker found. This report is an author self-review; root owns whole-branch independent review, browser verification and release.

No commits, child publication, reward changes, EBS integration or external mutations performed by this worker.

## Review follow-up: currency wording

The reviewer identified an educational wording issue: 100원 amounts were described with the banknote counter. Updated the money-transfer prompt, hint and explanation to use **동전 / 개** for 100원 and **지폐 / 장** for 1,000원 and 10,000원, including the matching Korean particles. Quantities, solutions and interface are unchanged.

Added the targeted test `money wording uses coins for 100 won and banknotes for larger denominations`. RED: 17 passed / 1 failed on the existing `100원짜리 6장과 9장` prompt. GREEN after the fix: **18 passed / 0 failed** using the isolated `/tmp/lab-content-build` compilation. The isolated strict TypeScript compilation with noUncheckedIndexedAccess also passed. No shared dist build was performed while root's browser suite was running; root will consolidate final build/regression verification.
