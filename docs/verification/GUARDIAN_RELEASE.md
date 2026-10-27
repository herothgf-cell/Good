# v0.3 보호자 기능 배포 검증 — 2026-10-27

## 배포된 소스

- 기능 커밋: `02943cbf348e6fe0f9fa77d23ab1ad9e4af4d060`
- 웹 배포 커밋: `b1da1694c8712e69f07974c9b1442353e4fd3291`
- Supabase family-action: v3 ACTIVE, verify_jwt=true. 공유 규칙은 기능 커밋에 고정.
- 이름 수정 RPC migration: `20261027022544_guardian_member_rename.sql` 적용.
- [기능·화면·DB CI](https://github.com/herothgf-cell/Good/actions/runs/40439992726): app/database 모두 success.
- [실제 서버 접근 검사](https://github.com/herothgf-cell/Good/actions/runs/40439992675): success.
- [GitHub Pages 배포](https://github.com/herothgf-cell/Good/actions/runs/40440056335): build/deploy 모두 success.
- 앱 주소: https://herothgf-cell.github.io/Good/

## 검사 범위

로컬 TypeScript 및 빌드 통과, Node 자동 검사 130개 통과. Chromium 화면 시나리오 기존 13개와 신규 9개 그룹 통과. 신규 흐름은 이름 저장·권한 보존, 수정 이름 HTML 이스케이프, 별 13개 확인 후 지급, 무료 선물 발급·재고 감소, 품절 차단, 비보호자 버튼 비노출, 360/390px 레이아웃, 런타임 오류 없음이다. 같은 코드의 GitHub CI도 통과했다.

DB 이름 수정 API는 운영 프로젝트의 롤백 트랜잭션으로 성공/동일 요청 재전송/내용 다른 재전송 거절/오래된 이름 거절/공백 거절/외부 구성원 거절을 검증했다. 테스트 변경은 남기지 않았다. CI는 별도의 빈 PostgreSQL 및 테스트용 Auth 스키마에서 전체 DB 시나리오를 실행했다.

사용자가 요청한 운영 데이터 정정과 초기 적립은 수행했고, 지급 영수증 1건과 잔액-원장 합계 일치를 재조회했다. 사용자의 UUID, 이메일, 실제 원장 내용은 공개 문서에 포함하지 않는다. 실제 보상 테스트 지급은 하지 않았다.

실제 사용자 비밀번호·인증 세션 없이 검사했다. 따라서 새 UI를 실제 사용자 휴대폰에서 조작하는 인증 거래와 두 실제 기기의 동기화까지 자동검증한 것은 아니다. 외부 페이지 조회 도구는 github.io 접속을 지원하지 않아 이번 웹 배포 증거는 GitHub Pages 성공 기록이며, 직접 배포 화면을 열었다고 주장하지 않는다.

## 보안 점검 참고

Supabase advisor가 경고 0건을 반환한 것은 아니다.

- [authenticated SECURITY DEFINER RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): 6개. 의도된 가족 관리 API이며 함수 내부에서 사용자·가족·역할·초대 또는 이전 이름을 확인한다. 새 이름 수정 API는 보호자만 가능하고 PUBLIC/anon 실행 권한이 없다.
- [익명 로그인 정책](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins): families/members/events. 아이 기기는 익명 인증 세션을 사용하지만, 가족 멤버로 초대되어야 같은 가족 데이터만 조회할 수 있다. 비로그인 공개 키만으로는 조회가 거절됨을 검사했다.
- [family_invites RLS 정책 없음](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): 직접 조회를 차단하기 위한 의도된 설정.
- [유출 비밀번호 보호 비활성](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): 기존 Auth 설정을 임의로 변경하지 않았다. 보호자는 다른 사이트와 중복되지 않는 강한 비밀번호를 사용하고 대시보드의 제공 범위를 확인한다.

RLS를 끄거나 클라이언트에 service_role/secret 키를 주지 않았다. 별/선물 직접 지급은 서버에서 관리자 역할을 확인하고 기존 CAS/요청 원장을 사용한다. 대외 공개 전 CAPTCHA/남용 요청 제한 보강은 기존 후속 과제로 남는다.
