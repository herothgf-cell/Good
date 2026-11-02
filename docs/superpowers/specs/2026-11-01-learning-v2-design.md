# Guardian learning lab v2

## Authorization and intent

The user reviewed the earlier v0.7 learning feature, rejected its easy multiple-choice model, calibrated the child's skills, and explicitly asked to proceed on 2026-11-01. EBS is deferred. This design records the agreed direction and the implementation choices needed to execute it; it does not reopen approval of the work already requested.

Keep the existing praise/coupon product. Build a substantially different learning experience, available only in the guardian learning-test menu. Child exposure remains a later, explicit release. Preserve legacy learning publication/history and all existing rewards.

## Learning scope

- English conversation: short turns, Korean/one-word answers welcome, model useful phrases only when needed, meaningful follow-up. Provide an actual server-backed voice/text conversation test plus an honestly labelled offline scenario preview. Never present fixed scripts as live AI.
- Vocabulary: scene/meaning, listening, retrieval without the answer, later reuse. Reading: independent decoding separate from listen-and-repeat, new words with the same pattern, short connected text and meaning checks. Default phonics ai/ay; CVC and silent-e selectable. Helpers for untaught words are explicit. No invented pronunciation score.
- Math: direct input for two-digit addition/subtraction, carrying/borrowing separately configured. Transfer between money, grouping pictures, other contexts, and equations; time/calendar relations; equal groups for initial multiplication; bounded number patterns. Already reads clocks/calendar, can do two-digit regrouping with variable accuracy, handles large values in bills but struggles transferring. Do not globally lower to counting-to-ten or promote all arithmetic to large numbers.
- A session has a learning goal and a variable number of steps. Wrong answers, reading help, representations and modelling are distinguishable. Self/guardian observation is labelled, never mistaken for an automated skill measurement. No speed penalties or perfect-score reward requirement.

## Approach

1. Strengthen fixed quizzes: insufficient for conversation and transfer.
2. Open another app: fragments settings and progress.
3. **Chosen direction: integrate distinct activity types in the current app**, with reviewed deterministic learning content and a real, separately configured conversation service.

## Implementation choices

Add new shared lab-content and lab-state modules; keep v0.7 modules as legacy compatibility. Guardian learning defaults to the new lab, with an explicit secondary link to the legacy controls/history. New lab mutations are admin-only and cannot alter the star balance, coupons, child quotas or publication. Test settings and recent summaries use an optional state field; bounded aggregate preview progress survives summary pruning. No production data migration or bulk rewrite.

The real conversation path is guardian/adult testing only. It uses explicit per-turn microphone recording, server speech recognition, a bounded tutoring response and installed local English speech synthesis with explicit text fallback. The official Speech API retirement announced for 2027-01-06 makes that older server speech endpoint inappropriate as a new dependency; this implementation adjustment is recorded in the work log. No browser speech-recognition service, stored audio, permanent API key in the browser, or child endpoint access. If the provider is not configured, show the actual setup state and allow scenario/content review. Add persistent per-family daily/session request limits before any paid provider calls. No automatic retries of a paid turn.

The existing review established that an under-age child's personal-data processing needs provider-specific conditions (OpenAI ZDR approval included). This release does not authorize or expose child voice processing. Do not falsely claim that a parent account alone satisfies that prerequisite.

## Acceptance

1. New math answers are directly entered; generated questions remain deterministic and correct over many seeds.
2. Money transfer, crossing an hour/month, and equal groups have exact visuals and matching solutions.
3. English word recall hides targets until help; phonics separates model listening, independent reading, new-word transfer, and meaning.
4. New activities are absent and rejected for child/giver roles, including forged requests.
5. Preview saving is idempotent, version checked, and reward-neutral. Older learning data and commands remain valid.
6. AI status, microphone denial, missing credentials, malformed provider output, timeout, leave/role change, and stale callbacks have truthful UI and cleanup.
7. Normal iPad-sized and phone-sized views have usable touch inputs and no overflow; existing coupon flows continue to pass.
8. EBS integrations and child publication are not included in this revision.
