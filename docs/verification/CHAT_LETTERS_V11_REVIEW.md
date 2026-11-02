# v0.11 verification and author review

Base: production main f4a50cc49df285e093c65ca8fdd201a0cca3c218 (v0.9).
The unshipped v0.10 package was restored and its 504 tests passed before the changes below.

## Evidence
- TypeScript browser/Edge checks: PASS.
- Node full suite: 535 tests, 535 pass, 0 fail.
- New domain test RED: 22 failures before implementation; GREEN after implementation.
- New UI test RED: 6 failures before implementation; GREEN after implementation.
- Chat lifecycle regression: missing optimistic/failure message behaviors failed before implementation and now pass; existing history check was retained.
- Browser scripts executed: experience 38 groups, time coupons 13, legacy learning 22, learning lab 6, coach lifecycle 3, retained realtime lifecycle 3, integrated chat/phonics 2 viewport groups, letters/rules 2 viewport groups. Total 89 groups (not 89 assertions).
- An obsolete learning-lab text assertion failed after intentional header-copy changes. It was corrected to the actual new header; the entire script passed afterward. No functional assertion was removed.
- Integrated and letter/rule flows used actual DOM/controller events at 390 and 1024 px; responsive alignment and no overflow checked.
- AI provider, browser media, and remote family boundaries are mocked. No actual paid AI audio, real iPad microphone, production family mutation or child exposure was tested.
- git diff --check: PASS.

## Separate author self-review (no independent reviewer available)
Checked server permission gates, exact reorder membership and optimistic collection versions, deleted rule tombstones, legacy rule defaults, retained praise/ledger references, Korea-midnight date validation, backdated caps, separate issuance timestamps, unread/archive disjointness, no replay rewards, pending/failed chat history filtering, escaped bubbles, draft/scroll preservation, audio cleanup/cache, and guardian-only learning routes. No blocking issue remains in the reviewed scope.

## Decisions and limits
- Deletion is a persistent tombstone, not physical history deletion; deleted rules are not reusable. Restore UI is not included.
- Explicit read button moves a letter; opening alone does not. Users can reread the archive without affecting balances.
- Home still prioritizes featured behaviors; stored order is used within that existing policy.
- Chat remains push-to-record/send (not always-listening). Audio failure retains text and does not silently fall back to device voice.
- PDF original stays outside the public source tree. Phonics source terminology/order is retained; app-added activities are labelled in the reference documentation.
- Existing realtime independent server reaper and actual under-age voice-release review remain out of scope; learning stays adult guardian-only.

Remote CI and Pages/function deployment outcomes are recorded on the corresponding pull request after execution; this document does not claim a successful deployment before that happens.
