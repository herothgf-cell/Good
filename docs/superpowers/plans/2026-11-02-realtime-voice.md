# Realtime Voice Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add guardian-only speech-to-speech conversation without repeated recording clicks.
**Architecture:** Separate authenticated Realtime Edge handler with atomic family metadata reservations; a WebRTC client and voice-first panel integrated with the existing lab lifecycle. Keep old coach as a comparison tool.
**Tech Stack:** Existing TypeScript 5.8.3 static PWA, Node 22 tests, Supabase Edge and existing family_commit RPC, native WebRTC.
**Spec:** docs/superpowers/specs/2026-11-02-realtime-voice-design.md

## Global Constraints
Existing balance/coupons/child publication unchanged. No API keys or recorded audio in frontend or storage. No new paid account/services. Same secrets and guardian-only enable flag. Never automatically retry creating a call. No claims of independent server hard cutoff or real microphone/provider verification.

## Review Focus
- Browser hidden/identity changed during microphone permission or SDP request must not resurrect a session.
- response.done precedes audible playback finish; never re-enable microphone on that event alone.
- Stop can race call creation: late successful calls must be hung up and never bound to a closed reservation.
- Concurrency, retries and Korean midnight cannot bypass one active call or daily admission limits.
- Audio blocked and malformed/provider failures must be visible, release resources and never silently become text-only success.

### Task 1: Authenticated server call lifecycle
Files: _server/realtime.js/.d.ts, _server/realtime-store.js/.d.ts, functions/learning-realtime/index.ts, deploy/good-learning-realtime.ts; tests/learning-realtime-service.test.mjs.
- [x] Test-first: auth/validation, proper audio configuration, reservation freshness, provider failures, stop and heartbeat, late creation cleanup.
- [x] Implement bounded requests, unified SDP exchange, safe error codes and stored owner-authorized call IDs.
- [x] Verify focused tests and complete unit suite.

### Task 2: WebRTC client and voice panel
Files: src/learning-realtime.ts, src/learning-realtime-ui.ts, src/learning-realtime.css; tests/learning-realtime-client.test.mjs.
- [x] Test-first: idle/demo/child, start/greeting, speech events, double commit, playback versus response completion, stop/late permission, autoplay, timeout, heartbeat and expiry.
- [x] Implement one start, automatic turns and cleanup; voice-first status and optional caption, no text input in new panel.
- [x] Verify focused tests and complete unit suite.

### Task 3: Integration and release
Files: src/main.ts, src/learning-lab.ts, scripts/build.mjs, public/sw.js, package version, docs/technical/LEARNING_REALTIME.md, browser test.
- [x] Integrate optional RealtimePort in lab host; old speech and realtime are mutually exclusive; preserve legacy UI/test behavior.
- [x] Run type/unit/browser suites, inspect desktop/mobile screenshots and perform separate self-review (485 unit tests; browser files individually green).
- [ ] Commit feature branch, verify GitHub CI, deploy new Edge only, merge/Pages after checks, document true verified boundaries.
