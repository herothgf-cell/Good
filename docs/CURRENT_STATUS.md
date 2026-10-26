# 현재 개발 상태 — v0.2.0

2026-10-26. 대상 저장소는 **herothgf-cell/Good**입니다.

| 구분 | 상태 |
|---|---|
| 칭찬/확정 교환/뽑기/보상·쿠폰 관리 | 구현, 자동 검사 및 화면 시나리오 통과 |
| 공개 설정 검사 / 신형·레거시 서버 키 지원 | 구현, 회귀 검사 추가 |
| 로그인/아이 연결/초대/권한/15초 갱신 | 코드 작성, 실제 Supabase 연결 전 |
| SQL RLS/초대/중복 commit/동시 revision | PostgreSQL 16 통합 테스트 15개 시나리오 그룹 통과 |
| GitHub 자동 검사 | .github/workflows/ci.yml |
| GitHub Pages 배포 | 선택 실행형 .github/workflows/pages.yml, Pages 설정 필요 |
| Vercel 배포 설정 | vercel.json 준비 |
| 실제 가족 공유 서비스 | 미배포, Supabase와 호스팅 계정 연결 필요 |

## 이번 추가 사항

Supabase 서버 키 JSON 맵(`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`), 단일 신형 변수, 기존 ANON/SERVICE_ROLE 변수를 지원합니다. 새 secret 키는 apikey 헤더로만 보내며 사용자 JWT 인증은 유지합니다. 서버 전용 모듈은 웹 빌드에서 제외합니다.

배포 전 `npm run check:deploy`, 빌드 시 `REQUIRE_CLOUD_CONFIG=1`로 누락·예시 값·서버 키 혼입을 검사합니다. 이 검사는 실제 서버 통신 검사가 아닙니다.

단위/서비스/보안/설정 **83개**, Chromium 화면 시나리오 **13개**를 작업 환경에서 재실행해 통과했습니다. GitHub Actions에서도 npm ci부터 재실행해 통과했으며, 실제 PostgreSQL 16에서 DB 시나리오 15개 그룹이 통과했습니다. [확인한 실행](https://github.com/herothgf-cell/Good/actions/runs/40338145636). 실제 Supabase Auth/Edge 연결과는 별개입니다.

## 다음 단계

1. Supabase 새 프로젝트에 SQL/Edge 배포, 성인 계정·익명 아이 인증 설정.
2. Vercel 또는 Pages에 공개 설정을 넣고 공유 주소 생성.
3. 두 실제 기기의 지급·차감·초대·권한·네트워크 재시도·재고 경쟁 테스트.
4. 가족 시범 운영 후 보상 가격·확률 조정, CAPTCHA/요청 제한, 백업 복원.

처음 기획 대비 변경: Next.js 대신 정적 TypeScript PWA, 정규화 테이블 대신 가족 상태 JSON + 요청 감사 원장, 즉시 동기화 대신 15초 갱신. 체험판은 가족 공유를 대체하지 않습니다.
