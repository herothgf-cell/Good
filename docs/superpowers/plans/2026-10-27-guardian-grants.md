# Guardian Grants Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkboxes.

**Goal:** 이름 수정과 보호자 직접 지급을 배포하고 요청한 13개를 1회 적립.
**Architecture:** 기존 원자적 Edge 명령 파이프라인에 stars/grant 및 reward/grant를 추가. 이름 수정은 family_rename_member RPC에서 가족 잠금/권한/이전이름/요청 영수증을 확인. 기존 state.schema=1 호환 유지.
**Tech Stack:** TypeScript, static PWA, Supabase PostgreSQL/Edge, GitHub Pages.
**Spec:** docs/superpowers/specs/2026-10-27-guardian-grants-design.md

## Global Constraints
보호자 전용. 별 1~10000 정수. 선물 1장, 차감 0, 재고 소진. 이름 1~30자. 과거 기록 보존. 초기 13은 1회.

## Review Focus
재시도 중복지급; 마지막 재고 경쟁; 비보호자 직접 API; 다른 가족/동시 이름 수정; 구버전 저장 데이터와 서비스워커 캐시.

### Task 1: Domain and storage
- [x] tests/guardian.test.mjs에 실패 테스트 작성/확인.
- [x] supabase/functions/_shared/domain.ts에 stars/grant, reward/grant 및 원장·쿠폰 타입 추가.
- [x] src/backend.ts에서 member/rename 분기, demo members 저장 및 클라우드 RPC 사용.
- [x] 전체 테스트 실행.

### Task 2: Membership database API
- [x] 이름 수정 RPC 테스트는 미존재 상태에서 실패 확인.
- [x] 신규 migration 작성 및 disposable PostgreSQL 테스트에 연결.
- [x] 적용 후 롤백 트랜잭션에서 권한/동시 이름/재시도 검사.

### Task 3: UI
- [x] 버튼/권한/폼 흐름 브라우저 테스트 실패 확인.
- [x] src/ui.ts, src/main.ts에 보호자 전용 기능 및 확인창 추가.
- [x] 단위검사, 화면검사, TypeScript/빌드 실행.

### Task 4: Release and requested data
- [ ] GitHub 변경 커밋 후 동일 소스로 Edge 배포.
- [x] 이름 엄→엄마 및 초기 +13을 각각 요청 ID를 사용해 1회 기록/확인.
- [ ] Pages 배포 및 정적/서버 상태 확인. 검증된 것과 미확인 범위 문서화.
