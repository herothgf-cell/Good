# 현재 개발 상태 — v0.2 / Supabase 연결

2026-10-27. 저장소 **herothgf-cell/Good**, Supabase **good-praise**.

| 구분 | 상태 |
|---|---|
| 칭찬/확정 교환/뽑기/보상·쿠폰 관리 | 구현, 자동 검사 89개 통과 |
| Supabase 초기 DB | 실제 프로젝트에 적용, 네 테이블 RLS 및 commit 권한 확인 |
| family-action 서버 | 실제 Edge Function v2 ACTIVE, JWT 및 서버 내 사용자 검증 유지 |
| 서버 허용 출처 | https://herothgf-cell.github.io |
| 실제 외부 연결 검사 | Auth 응답, 비로그인 데이터 차단, 누락/잘못된 토큰 401, Pages CORS 통과 |
| GitHub Pages 연결 설정 | cloud 기본값에 good-praise 공개 URL/키 반영 |
| 웹사이트 공개 배포 | Pages 활성화 및 cloud workflow 실행 필요 |
| 보호자 로그인 계정 | 아직 생성하지 않음, 대시보드에서 사용자 생성 필요 |
| 아이 익명 인증 설정 | 현재 꺼짐 확인, 대시보드에서 활성화 필요 |
| 실제 가족 공유 검증 | 사용자 로그인과 두 기기 거래 검증 전 |

상세 연결 기록과 사용자 설정은 [GOOD_PRAISE_CONNECTION.md](technical/GOOD_PRAISE_CONNECTION.md)를 보세요.

## 검증

이번 연결 작업에서는 로컬 TypeScript 검사와 89개 자동 검사를 통과했습니다. 실제 서버 시작 오류를 재현·수정하는 6개 회귀 검사를 추가했습니다. v1 배포의 환경변수 변경 오류는 v2에서 수정했고 실제 외부 연결 검사 재실행도 통과했습니다.

실제 서버 검사: https://github.com/herothgf-cell/Good/actions/runs/40435328843 (attempt 2).

`Verify deployed Supabase connection`은 비로그인 차단과 CORS를 검사하며 계정을 만들거나 칭찬 데이터를 작성하지 않습니다. 기존 v0.2의 PostgreSQL 테스트 DB 15개 시나리오 그룹 및 Chromium 13개 화면 검증도 실제 Supabase 로그인/기기 간 동시 거래를 대체하지 않습니다.

## 운영 유의

공개 키는 브라우저에 제공되는 값이며 비밀 키가 아닙니다. service_role/secret 키와 가족 데이터를 공개 저장소에 넣지 않습니다. 초대/가족 관리용 SECURITY DEFINER RPC에 대한 advisor 경고는 연결 문서에 기록했습니다. 가족용 시험운영 후 CAPTCHA/요청 제한과 백업 복원 기능을 보강해야 합니다.

서버 공통 모듈은 고정 소스 커밋으로 배포되어 main 수정만으로 갱신되지 않습니다. 서버 코드 변경 후 별도 Edge 재배포가 필요합니다. Pages의 cloud는 서버 공유이고 demo는 각 브라우저 저장입니다.
