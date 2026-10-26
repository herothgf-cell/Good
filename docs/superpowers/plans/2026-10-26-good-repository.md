# Good repository onboarding and deployment hardening

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Import the existing Praise Star MVP into `herothgf-cell/Good`, make verification repeatable in GitHub, and remove avoidable cloud setup failures.
**Architecture:** Preserve the static TypeScript PWA and Supabase data model. Add server-only configuration helpers, a fail-closed public deployment check, and CI / opt-in Pages deployment. Do not provision paid services or include private data.
**Tech Stack:** TypeScript, Node.js 22, PostgreSQL, Python Playwright, GitHub Actions, Supabase.
**Spec:** `../specs/2026-10-26-praise-star-design.md` plus the user's explicit instruction to use `herothgf-cell/Good` and continue implementation.

## Global constraints
- Keep existing demo and business rules working.
- Supabase/Vercel are not connected in this session; a successful build is not a live deployment.
- Only public URL/public key may enter the browser build. Server-only code stays outside dist.
- No paid plan creation, real family data, credentials, or database exports in GitHub.
- Preserve `verify_jwt = true` and Auth `/user` verification.

## Review focus
- New Supabase JSON key maps and legacy env vars: select default keys deterministically; secret key must never enter Authorization as a bearer JWT.
- Incomplete public config: fail before a live build, and never silently publish demo when cloud mode was requested.
- SQL access: child/outsider cannot write tables or call family_commit; invite reuse must fail.
- Concurrent commit: one revision wins, duplicate request produces one event.
- Paths below `/Good/`: module, manifest and service worker paths must remain relative.

## Tasks
- [x] 1. Baseline: extract existing artifact into isolated workspace, npm ci, typecheck, 67 existing tests.
- [x] 2. Write failing tests for server key loader and public deployment checks; implement; run full suite.
- [x] 3. Add disposable-PostgreSQL integration tests of migration/RLS/invites/idempotency; run on GitHub PostgreSQL 16 (no PostgreSQL locally).
- [x] 4. Add CI and optional Pages workflow; make browser tests portable, verify generated app.
- [x] 5. Update README/deployment/status/report, inspect for secrets, import exact reviewed source to Good.
- [x] 6. Read back commit/tree and CI results; report actual completion and external-account requirements.

## Rulings
- Existing ZIP is the baseline. Work is in a fresh isolated directory, not a user checkout.
- New runtime secrets helper lives outside `_shared` so browser TypeScript compilation cannot include it.
- GitHub Pages workflow is opt-in; Vercel remains supported. Repo setup alone does not enable family sync.

## Verification evidence
- Local: typecheck, 83 tests, 13 browser scenarios passed. Local npm registry DNS failed; preinstalled matching TypeScript was used.
- GitHub run 40338145636: npm ci, typecheck/unit, 15 PostgreSQL scenario groups, 13 browser scenarios, and source import commit all succeeded.
- Source read back on main: 253612fef5d457d7526f5ea36ace34ea4157ebbd.
- Supabase/Vercel account connection and real-device testing remain external prerequisites, not completed deployment.
