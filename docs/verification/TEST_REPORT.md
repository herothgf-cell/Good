# v0.2 검증 보고서

2026-10-26 · 대상 herothgf-cell/Good

## 작업 환경에서 실제 수행

| 검사 | 결과 | 범위 |
|---|---|---|
| TypeScript 검사 | 통과 | 브라우저·공유 규칙·Edge 코드 |
| npm test | 83개 통과, 실패 0 | 기존 67개 + 배포/서버 설정 16개 |
| Chromium 화면 테스트 | 13개 통과 | PC 및 390/360px 화면, 저장소 fixture |
| npm run build | 통과 | dist 및 standalone preview.html 생성 |
| DB 테스트 Python 구문 | 통과 | py_compile, DB 실행과 다름 |

새 기능 테스트는 구현 전 15개 실패를 확인한 뒤 구현하여 전체 83개가 통과했습니다. 서버 모듈 제외 검사는 기존에도 통과하던 회귀 검사입니다.

작업 컨테이너에서 npm registry DNS 연결이 실패하여 `npm ci`는 완료하지 못했습니다. 사전 설치된 **동일 버전 TypeScript 5.8.3 / Node 22.16.0**으로 검사했습니다. 이후 GitHub Actions에서는 `npm ci`와 실제 PostgreSQL 검증까지 완료했습니다.

## GitHub에서 실제 수행한 검사

`.github/workflows/ci.yml`의 app/database 작업은 npm ci부터 다시 실행합니다. PostgreSQL 16 서비스에 빈 테스트용 Auth 스키마를 만들고 실제 마이그레이션을 적용합니다.

DB 시나리오: 가족 0개 별 시작, RLS 격리, 익명/무인증 제한, 브라우저 쓰기 차단, 초대 재사용·권한 상승·만료·취소 방지, 멤버 해제, commit 권한, 요청 중복, revision 충돌, 음수/원장 불일치, 동시 요청 경쟁.

[검증 실행 #40338145636](https://github.com/herothgf-cell/Good/actions/runs/40338145636)의 import job #121625157747은 **success**입니다. `npm ci`, 타입/83개 자동 검사, PostgreSQL 16 마이그레이션 및 **15개 DB 시나리오 그룹**, Playwright **13개 화면 시나리오**, 검증된 소스의 main 커밋 단계가 모두 성공했습니다.

DB는 실제 PostgreSQL 엔진을 사용했지만 Auth 스키마와 사용자 토큰 문맥은 테스트용입니다. 이 결과가 Supabase 호스팅 환경의 인증/Edge 호출 검증을 대신하지 않습니다. 생성된 결과는 해당 실행의 `source-import-verification` 아티팩트에 포함됩니다. 최초 실행은 브라우저 설치 지연으로 취소하고 기본 브라우저를 우선 사용하는 실행으로 대체했습니다.

임시 가져오기 워크플로는 정식 CI 반영 시 제거합니다. 이후 커밋은 `Verify Praise Star`의 app/database 작업으로 검사하며 최신 실행 상태를 확인해야 합니다.

## 한계 / 미검증

브라우저 테스트는 HTML 렌더링 + 메모리 저장소 fixture입니다. 실제 Supabase Auth/REST/Edge, 두 휴대폰 실동기화, 서버 재시도, 실기기 PWA 설치, CAPTCHA, 운영 백업/복원은 검증 전입니다. 테스트 성공을 실제 서비스 배포 완료로 표시하지 않습니다.
