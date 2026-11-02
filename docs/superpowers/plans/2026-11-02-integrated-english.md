# Integrated English Implementation Plan

> Implement inline with test-first verification.

**Goal:** Restore one text-and-voice coach and add a sequential source-grounded phonics course.
**Architecture:** Shared static curriculum, existing authoritative family actions, bounded request-based AI narration, one frontend player with lifecycle cleanup.
**Tech Stack:** TypeScript 5.8.3, native browser audio/canvas, Supabase Edge Functions, OpenAI Chat Completions audio.
**Spec:** docs/superpowers/specs/2026-11-02-integrated-english.md

## Global constraints
Guardian-only, no reward or child-publication changes, no EBS, preserve old records, no new runtime dependency, no secret in public files, no raw speech persistence.

## Review focus
- Legacy settings/runs must remain readable after new phonics-unit selection is added.
- Blocked browser audio must be replayable; text survives provider errors.
- Audio generated for a previous step/identity must never play after navigation.
- Displayed lesson target must match the verified narration transcript; no invented source chapter.
- Repeated/parallel reads must not bypass paid quotas or leak source/data into receipts.

## Tasks
- [x] 1: Source manifest and 22-unit curriculum, deterministic two-word sequence, spelling validation and compatible settings. RED→GREEN content/state tests.
- [x] 2: Bounded AI narrator; integrate coach response audio and curriculum-only read operation with separate quotas. RED→GREEN provider/auth tests.
- [x] 3: Shared browser audio lifecycle, restored chat with text+voice and replay, one phonics card, spelling/trace board and sequential next actions. RED→GREEN client/UI tests.
- [ ] 4: Browser regressions, source fidelity review, docs, private reference bundle, repository/Edge/Pages deployment and readback. Report untested physical-device/API quality separately.

Task 4: source bundle, docs and local browser review complete. Remote deployment blocked by currently exposed read-only connector actions. No deployment claimed.
