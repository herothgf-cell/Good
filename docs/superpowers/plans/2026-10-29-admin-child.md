# Admin/Child experience implementation plan

**Goal:** 역할별 관리 동선과 눈에 잘 보이는 칭찬 편지, 큰 글씨를 안전하게 배포한다.
**Architecture:** Existing family JSON/CAS + optional rule/read fields; pure domain validation; separate UI experience module; unchanged login/member/ledger paths.
**Tech Stack:** TypeScript 5.8.3, native DOM/dialog, Supabase Edge/Postgres, GitHub Pages.
**Spec:** docs/superpowers/specs/2026-10-29-admin-child-design.md

## Global constraints
기존 별/쿠폰/계정 데이터 변경 없음. 구매/뽑기는 아이만. 관리자는 미리보기 및 시뮬레이션만. 모든 정정은 사유/역사 보존. 유료 리소스 생성 안 함.

## Review focus
- 역할 검사: 프런트뿐 아니라 실제 도메인 서버 거절.
- 규칙 동시 수정/중복 지급/한국 날짜 제한 및 요청 재시도.
- 편지 읽음 병합/정정된 편지/다중 아이 기기.
- 긴 한글, 360px, 큰 글씨, 키보드 및 중첩 팝업.
- 재고, 일괄 지급, 취소/회수 후 원장 불변식.

## Tasks
- [x] 1. Recover latest baseline in isolated local checkout; failing domain tests for role/rules/read/correction.
- [x] 2. Domain extensions and compatible state; full local unit suite.
- [x] 3. Role-specific navigation, admin dashboard, child mail hero and readable shared UI; UI tests.
- [x] 4. Forms/actions, read state, rule giving, filters/groups, safe modal lifecycle; browser tests.
- [ ] 5. Verify full remote build/unit/browser/DB checks; review diff; publish branch then main, deploy Edge and Pages; verify actual deployment without writing family data.
