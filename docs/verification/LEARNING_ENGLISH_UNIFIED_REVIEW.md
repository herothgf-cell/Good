# Unified English v0.10 verification and self-review

Baseline: remote main `f4a50cc49df285e093c65ca8fdd201a0cca3c218` (v0.9 tree). Work was implemented in an isolated local branch. No independent reviewer/subagent was available; this is the author's separate self-review, not an independent approval.

## Tests observed

- Baseline: type checks + 485/485 Node tests.
- New catalog first failed for missing module; implemented 22 source units, explicit supplement, source-page and spelling-validation tests.
- New server store/handler and provider boundary tests: missing implementations failed before the implementations. Invalid progress error handling/strict payload/adapter tests failed 3/9, then passed 9/9 after fixes.
- Provider unit fixture corrected an invalid test literal before its five behavioral tests passed. Real provider calls were not made.
- Failed progress loading could incorrectly allow default advancement; two controller tests failed, then passed after readiness guard + automatic first-step AI reading.
- Browser visual review found the main target word inherited 16px; minimum-size assertion failed, then passed after 34–56px target styling. Sentence size is separately smaller.
- Final local Node suite: **508/508**, no failures; TypeScript frontend + Edge type checks pass.
- Full browser script: all seven files pass with exit code 0, covering existing coupon/time-coupon/legacy learning and retained realtime component regression tests plus integrated English.
- An initial full browser run was killed by the command execution's 120-second time limit; its resulting EPIPE was not a product failure. The complete rerun passed.

## Reviewed outcomes

- One visible conversation, voice and text share original coach history, no second voice-only panel in the new production route.
- Audio failure preserves reply text; replay caches current clips and never falls back to requiring device English voice.
- One unified phonics route; PDF order/page mapping is explicit; ai/ay marked supplemental. Input/pen strokes survive harmless rerenders; pen strokes remain local transient data.
- Step-by-step persistence uses guardian auth, fresh family membership, compare-and-swap revision, request ID receipts, and expected cursor/attempt. Coupon state and balances are copied unchanged.
- Speech is bounded by 6KB requests / 800 text characters / 2.4MB PCM / 45 seconds and metadata-only reservations. Keys remain in Edge secrets. Duplicate paid requests are not automatically repeated.
- Browser navigation/hidden-document and role transitions release audio; no raw audio, entered spelling or actual conversation is written into the family event payload. Transient spelling validation yields only outcome metadata.
- Original PDF archived privately in Drive, no original pages/audio or private Drive permission changes added to public source.

## Rulings / limits

- Chosen server Realtime read-aloud instead of the announced deprecated Speech API; a generated transcript check cannot certify phoneme quality.
- The original 22-unit word lists and one sentence each are adapted to a per-word screen, not a full facsimile or all original challenge exercises. There is no automatic pronunciation or handwriting-shape grade.
- The source may contain sentence words beyond the currently taught pattern; the interface explicitly treats sentence reading as assisted practice.
- Restart replaces the latest attempt for that unit; it is not a lifetime attempt history. Demo progress is page-memory only.
- Provider and media boundaries are mocked. **Real API account audio, latency, model availability, and physical iPad microphone/autoplay remain unverified.** A prepared text response does not prove successful audio generation.
- Previous realtime WebRTC code/tests remain for historical compatibility but are not the new entry UI. Child publication and EBS are not added.
- Minor deferred: deeper per-word longitudinal review scheduling and teacher-validated isolated phoneme audio assets; neither is reported as complete.
