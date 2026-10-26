# Praise Star MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 실행 가능한 가족 칭찬·확정 교환·뽑기·쿠폰 승인 웹앱과 클라우드 연결 코드를 제공한다.

**Architecture:** 순수 TypeScript 규칙을 브라우저 체험판과 Supabase Edge Function이 공유한다. 클라우드 DB는 가족 상태 revision CAS와 idempotency 원장으로 원자적 변경을 수행한다. 설치 없는 standalone HTML은 같은 소스에서 생성한다.

**Tech Stack:** TypeScript 5.8.3, DOM/CSS, Node built-in test, Supabase Auth/Postgres/Edge Functions, static Vercel hosting.

**Spec:** docs/superpowers/specs/2026-10-26-praise-star-design.md

## Global Constraints
- 칭찬 1~3개 / 기본 뽑기 5개·일 3회 / 확률 합 100% / Asia/Seoul 일자.
- 현금 결제 없음, 꽝 없음, 별 만료 없음. 기밀 키를 브라우저에 넣지 않는다.
- 테스트/라이브 배포 여부를 구분한다.

## Review Focus
- 동시 요청과 응답 유실: 요청 식별자로 재시도하며 잔액을 두 번 차감하지 않는다.
- 재고 소진·설정 변경: 바뀐 확률로 몰래 뽑지 않고 재확인한다.
- 아이/외부인이 부모 권한을 위조하면 서버와 DB가 거절한다.
- 자정 경계·정수 아닌 별 수·음수 재고·합계 오류를 거절한다.
- 보상 이름 변경 후 이미 발급한 쿠폰은 그대로 유지한다.

### Task 1: Domain
Files: supabase/functions/_shared/domain.ts; tests/domain.test.mjs
Produces: applyAction(state, action, context) -> {state, result}; emptyState; demoState; poolFor; drawQuote; dayKey.
- [x] 실패 테스트: role/amount/stock/quote/daily cap/coupon state/invariant.
- [x] npm test로 미구현 실패 확인.
- [x] 순수 거래 규칙 구현, 입력 검증/복제 후 변경.
- [x] node --test tests/domain.test.mjs → PASS.

### Task 2: Persistence and cloud boundary
Files: src/backend.ts; src/auth.ts; supabase/migrations/202610260001_praise_star.sql; supabase/functions/family-action/index.ts; tests/storage.test.mjs; tests/cloud.test.mjs.
Consumes: domain interfaces. Produces: DemoBackend/CloudBackend interface load/perform; AuthClient.
- [x] 중복 ID/서로 다른 입력/저장 실패 테스트 실패 확인.
- [x] Web Locks 기반 demo 저장과 REST 인증/서버 API, DB RLS+RPC 작성.
- [x] node --test tests/*.test.mjs → PASS. 실제 DB 실행은 연결 필요로 명시.

### Task 3: UI
Files: src/main.ts; src/ui.ts; src/styles.css; public/*; scripts/build.mjs; tests/browser_test.py.
Consumes: backend.load/perform and domain quote/pool. Produces: responsive all-screen UI and standalone preview.
- [x] 브라우저에서 미구현 홈 확인 테스트 실패.
- [x] 홈/칭찬/상점/뽑기/보관함/보상관리/가족/내역 UI, 모달/confirmation/오류 재시도.
- [x] build+typecheck+browser tests → PASS. 모바일 overflow 검사.

### Task 4: Handoff
Files: README.md, docs/technical/*, docs/CURRENT_STATUS.md, start-demo.cmd, start-dev.cmd, vercel.json.
- [x] 빌드 및 전체 테스트, 보안 자가 점검.
- [x] source ZIP/standalone HTML/screenshots 만들기.
- [x] 실서비스未연결/미검증 항목과 다음 설정 단계 명시.

검증 한계: 코드·파일 전달 작업 완료 기준이며, 라이브 DB/클라우드 배포 작업 완료를 뜻하지 않습니다. 상세 결과는 docs/verification/TEST_REPORT.md.
