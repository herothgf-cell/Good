# Unified English Implementation Plan
**Goal:** One voice-and-text coach, one source-grounded phonics read/write course.
**Architecture:** Existing coach + shared transient cloud speech player; deterministic course data and protected metadata-only progress endpoint.
**Spec:** ../specs/2026-11-02-unified-english-design.md
**Global constraints:** guardian only; preserve math/coupons; no public PDF; no stored voice/chat; no fake pronunciation/handwriting grades.
**Review focus:** late audio after navigation; repeated billing; stale cursor from another device; secret leakage; writing input persists through unrelated renders.

- [x] 1. Archive source; test and implement 22-unit source catalog + supplemental ai/ay and deterministic step validation.
- [x] 2. Test and implement authenticated progress/speech store, idempotent capped reservations, bounded server Realtime read-aloud.
- [x] 3. Test and implement shared cloud player and coach reply/replay in the original text window.
- [x] 4. Integrate sequential course, letter tiles and handwriting canvas, per-step resume; replace two confusing cards.
- [ ] 5. Run full type/unit/browser tests, self-review, branch commit/CI and deploy new endpoint + web; verify exact results.
