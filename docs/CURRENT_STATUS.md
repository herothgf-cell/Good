# 현재 개발 상태 — v0.2 / Supabase 연결

2026-10-27. 저장소 **herothgf-cell/Good**, Supabase **good-praise**.

| 구분 | 상태 |
|---|---|
| 칭찬/확정 교환/뽑기/보상·쿠폰 관리 | 구현, 기존 자동 검사 83개 및 화면 13개 |
| Supabase 초기 DB | 실제 프로젝트에 적용, 네 테이블 RLS 및 commit 권한 확인 |
| family-action 서버 | 실제 Edge Function v1 ACTIVE, JWT 및 서버 내 사용자 검증 유지 |
| 서버 허용 출처 | https://herothgf-cell.github.io |
| GitHub Pages 연결 설정 | cloud 기본값에 good-praise 공개 URL/키 반영 |
| 웹사이트 공개 배포 | Pages 활성화 및 cloud workflow 실행 필요 |
| 보호자 로그인 계정 | 아직 생성하지 않음, 대시보드에서 사용자 생성 필요 |
| 아이 익명 인증 설정 | 대시보드에서 확인/활성화 필요 |
| 실제 가족 공유 검증 | 사용자 로그인과 두 기기 거래 검증 전 |

상세 연결 기록과 사용자 설정은 [GOOD_PRAISE_CONNECTION.md](technical/GOOD_PRAISE_CONNECTION.md)를 보세요.

## 검증

이번 연결 작업에서는 로컬 TypeScript 검사와 83개 자동 검사를 재실행했고, 실제 공개 URL/키를 넣은 cloud 빌드를 완료했습니다. `Verify deployed Supabase connection`은 실제 외부 API의 비로그인 차단과 CORS만 검사하며, 계정을 만들거나 칭찬 데이터를 작성하지 않습니다. 최신 성공 여부는 해당 Actions 실행 로그를 확인하세요.

기존 v0.2 검증: PostgreSQL 16 테스트 DB에서 15개 시나리오 그룹, Chromium 화면 시나리오 13개. 이 검증은 실제 Supabase 로그인/기기 간 동시 거래를 대체하지 않습니다.

## 운영 유의

공개 키는 브라우저에 제공되는 값이며 비밀 키가 아닙니다. service_role/secret 키와 가족 데이터를 공개 저장소에 넣지 않습니다. 초대/가족 관리용 SECURITY DEFINER RPC에 대한 advisor 경고는 연결 문서에 기록했습니다. 가족용 시험운영 후 CAPTCHA/요청 제한과 백업 복원 기능을 보강해야 합니다.

서버 코드는 고정 소스 커밋으로 배포되어 main 수정만으로 갱신되지 않습니다. 서버 코드 변경 후 별도 Edge 재배포가 필요합니다. Pages의 cloud는 서버 공유이고 demo는 각 브라우저 저장입니다.
