# good-praise 연결 기록 — 2026-10-27

## 적용 완료

- 프로젝트: `good-praise` (`oqygpsltwyvwdfiyhzdw`), 서울 리전, Free 조직.
- 초기 DB migration `praise_star_initial_schema` 적용. 원본은 `supabase/migrations/202610260001_praise_star.sql`.
- `families`, `family_members`, `family_events`, `family_invites`에 RLS 적용 확인.
- anon 역할의 테이블 SELECT 없음. authenticated 직접 INSERT 없음. `family_commit`은 service_role만 실행 가능.
- `family-action` Edge Function **v2** 배포, ACTIVE 및 실제 HTTP 검사 통과. 플랫폼 JWT 검사와 Auth /user 검사 모두 유지.
- 배포 진입점은 `supabase/deploy/good-praise.ts`. 공통 모듈은 검토된 `0cefbebbe01c1da6d44faa00a260ddf4cd33ad2a` 소스를 고정해서 import합니다. CORS 출처는 `https://herothgf-cell.github.io`.
- 배포 파일은 `good-praise.ts`를 `index.ts` 이름으로 업로드하고 함께 보관한 `deno.json`을 import map으로 사용했습니다.
- Pages workflow의 cloud 모드에 이 프로젝트의 URL/publishable 공개 키를 기본값으로 지정. 별도 GitHub 변수 입력 불필요. 사용자 지정 변수가 있으면 우선 사용.
- 로컬 TypeScript 검사 및 **89개 자동 검사** 통과. 실제 공개 설정을 사용한 cloud 빌드도 성공했습니다.

## 사용자가 한 번 설정해야 하는 항목

연결 도구에 Pages 사이트 설정 변경과 Supabase Auth 설정 변경/계정 생성 액션이 없어 다음 항목은 대시보드에서 직접 설정합니다. 비밀 키나 비밀번호를 채팅에 전달할 필요가 없습니다.

### 1. GitHub Pages 활성화 및 배포

1. `https://github.com/herothgf-cell/Good/settings/pages`
2. Build and deployment → Source → GitHub Actions 선택.
3. `https://github.com/herothgf-cell/Good/actions/workflows/pages.yml`
4. Run workflow → main → mode `cloud` → Run workflow.
5. build/deploy가 모두 성공한 뒤 `https://herothgf-cell.github.io/Good/` 접속.

`demo`는 기기 간 공유되지 않습니다. Pages는 점검 시 활성화되지 않은 상태이며, 예상 주소가 배포 완료를 뜻하지 않습니다. 기본 공개 키는 브라우저용입니다. secret/service_role 키를 넣지 마세요.

### 2. 보호자 앱 계정 생성

`https://supabase.com/dashboard/project/oqygpsltwyvwdfiyhzdw/auth/users`

Authentication → Users → Add user/Create user에서 보호자 이메일과 강한 비밀번호로 계정을 생성합니다. Auto Confirm User 옵션이 있으면 보호자가 직접 관리하는 본인 계정에 대해 확인합니다. 이 계정은 Supabase 대시보드의 GitHub 로그인과 다릅니다. 앱에는 아직 회원가입/비밀번호 재설정 화면이 없습니다.

### 3. 아이 기기 인증 설정

Authentication → Sign In / Providers에서 Anonymous sign-ins를 활성화하고 저장합니다. 실제 Auth 설정에서 현재 false임을 확인했습니다. 이 기능은 아이 기기를 이메일 없이 연결하기 위한 것입니다. 초대 코드 없이 가족 기록에 접근하는 기능은 아닙니다. 현재 앱은 CAPTCHA UI가 없으므로 CAPTCHA 설정만 켜면 아이 로그인에 실패할 수 있습니다. 가족 전용 시험운영으로 시작하고 대외 공개 전에 CAPTCHA/요청 제한을 구현하세요.

### 4. 가족 생성

배포된 앱에 보호자 계정으로 로그인 → 가족 만들기 → 우리 가족에서 엄마/할머니/아이용 초대 발급. 첫 가족의 별은 0개입니다. 성인 계정은 각각 대시보드에서 만들어 주세요. 아이 기기에는 부모 로그인을 남겨두지 마세요.

## 검증과 수정 이력

초기 배포 v1은 `Deno.env.set`이 호스팅 런타임에서 지원되지 않아 시작에 실패했습니다. 실제 서버 로그의 `NotSupported`를 확인한 뒤 환경변수를 변경하지 않는 설정 주입 방식으로 수정하여 v2를 배포했습니다. 같은 실패를 재현하는 테스트 6개를 먼저 실패시킨 뒤 수정본에서 모두 통과시켰습니다.

실제 외부 API 검사: `https://github.com/herothgf-cell/Good/actions/runs/40435328843` 재실행(2번째 시도) 통과.

- Auth 설정 엔드포인트 응답 성공.
- 공개 키만으로 가족 테이블 접근 거절.
- 사용자 토큰 없는 서버 명령 401.
- 잘못된 사용자 토큰 401.
- GitHub Pages 출처의 OPTIONS/CORS 응답 성공.

검사는 사용자나 실제 가족·칭찬 데이터를 만들지 않았습니다. 보호자 실제 로그인, 아이 인증, 권한별 거래, 두 실제 기기의 동시 사용과 홈 화면 설치는 아직 별도 검증해야 합니다.

## 보안 점검 결과

Supabase advisor는 5개의 authenticated SECURITY DEFINER RPC 경고와 family_invites의 정책 없음 INFO를 보고했습니다. 전자는 내부에서 UID/역할/초대 토큰을 확인하는 의도된 가족 관리 API이며, 후자는 초대 테이블의 직접 접근을 차단하기 위한 설정입니다. 경고를 없애려고 권한을 넓히거나 RLS를 끄지 않습니다. 경고가 0개라는 뜻은 아닙니다.

- 참고: `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable`
- 참고: `https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy`

## 재배포 시 주의

현재 서버의 공통 모듈은 위 고정 커밋의 코드를 실행합니다. main의 서버 코드를 수정하는 것만으로 배포된 서버가 바뀌지 않습니다. 서버 변경 후 Edge Function을 다시 배포하고, 새 소스 커밋과 함수 버전을 기록하세요. CLI로 기본 `family-action/index.ts`를 배포할 때에는 APP_ORIGIN을 위 출처로 설정하세요. 유료 리소스나 별도 개발 브랜치는 생성하지 않았습니다.
