# Learning v2 work log

Plan: `docs/superpowers/plans/2026-11-01-learning-v2.md`
Base: `1f9f8922d0c9500644541b300ce247ab7404629a`
Workspace: `good-learning/.worktrees/learning-v2`, branch `feat/learning-v2-guardian`.

- 2026-11-01: User explicitly approved improvements, EBS deferred. No new design approval required.
- Main verified through connected GitHub API to match local base. Shell git network unavailable (proxy); connector remains available.
- Existing source survived workspace maintenance; dependencies require baseline check/recovery.
- Ruling: implement independent modules with exclusive file ownership in parallel, following session's proactive delegation requirement. Root integrates and performs independent review before release.
- Ruling: v2 remains guardian-only in UI and server; legacy child/publication semantics stay compatible. Child voice activation is not part of this release.
- Environment: restored TypeScript 5.8.3 and Python Playwright 1.58.0 in temporary test environment. Reused existing Chromium 134 headless shell; browser execution needs approved process permissions.
- Baseline: typecheck and build passed. Local Node24 Web Locks hangs the pre-existing concurrent demo-reward test; CI uses Node22. Local unit runs disable Node's global navigator to use the existing fallback queue; browser tests cover browser Web Locks directly.
- Ruling: use current `gpt-transcribe` for short guardian recordings and structured `gpt-4.1-mini` responses; speak responses with installed local English voices. Official Speech API docs announce retirement of all /audio/speech models on 2027-01-06, so introducing that dependency now would create an imminent migration. No local voice means explicit text fallback, never an invented speech/assessment success.
- Ruling: a server-generated reservation nonce in receipt result identifies the fresh winner even for concurrent duplicate `family_commit` calls; only that winner calls the paid provider. No SQL migration required.
- Coach handler/provider tests: red12/13 with stub, then green13/13 (auth, admin/family, config, strict bounds, quota ordering, no duplicate paid retry, sanitized failure, structured tutor/STT transport).

## Progress

- [x] Content (18 targeted tests; independent task review; coin wording corrected)
- [x] State and validation (19 targeted tests; independent task review)
- [x] Guardian UI (9 targeted tests; expanded browser6 groups; coin visuals corrected)
- [x] Coach service/client (25 Node checks and3 media browser groups)
- [x] Integration and verification (33 unit files; existing browser flows pass; child v2 hidden)
- [ ] Review and delivery

## Final review and release

- Full review: one P2 speech callback race. An old utterance could clear the next utterance's timeout and unlock controls. Assigned one scoped fix wave and regression tests before release. No privilege, payment, reward, or legacy-data issue found.
- P3 wording drift in design (server speech vs installed local voice) corrected to match implementation and approved ruling.
- Ruling: use existing authorization to deploy the guardian-only improvement through the repository/Pages workflow once gates pass. The earlier user explicitly requested testing in guardian mode followed by deployment; no new child publication or account configuration is authorized by this release. Keep the feature branch/worktree available for follow-up.
- Ruling: provider configuration and actual iPad microphone/voice quality are not claimed as verified. No API key was supplied locally; actual provider calls remain untested. Tests use only boundary substitutes and local fixtures.

- Final review fix wave:8 regression cases RED against original speech code →15 client cases GREEN. Active-utterance ownership now guards callbacks before timer/state changes. Independent scoped re-review: P2 ADDRESSED, P3 resolved, no unresolved findings. Spec PASS / quality APPROVE.
- Release candidate verification: frontend+Edge typecheck, full build, all33 Node test files /441 individual test cases passed. Local Node24 requires disabling its experimental global navigator to match CI's Node22 fallback environment. No product workaround was added.
- Browser evidence: existing experience38 groups, existing learning22 groups, time-coupon suite, expanded lab6 groups and coach3 media groups passed. Phone/tablet screenshots visually inspected, including100won coins and crossed-month calendar with hidden answer.
- Publication handoff: code, guide and review evidence are ready for repository CI. New v2 has no child publish operation; no production family/publication data has been edited. Hosted outcome is to be verified against the release commit and Pages workflow.
