# 가족 공유 연결 / 배포 안내

이 문서는 **작성된 코드를 실제 계정에 연결하는 절차**입니다. 전달 시점에는 아래 배포를 실행하지 않았습니다. 기존 업무용 DB와 섞지 말고 새 Supabase 프로젝트에서 시작하세요. 초기 SQL은 최초 1회 적용용이며 중복 실행용으로 작성되지 않았습니다.

## 1. Supabase 프로젝트와 성인 계정 준비

본인 계정으로 Supabase 프로젝트를 만듭니다. DB 비밀번호는 비밀 관리 도구에 보관하고 소스에 기록하지 않습니다.

Authentication 설정에서 이메일/비밀번호 로그인을 사용합니다. `Authentication → Users → Add user/Create user`에서 보호자 이메일과 충분히 강한 비밀번호로 계정을 만들고, 대시보드가 제공하는 계정 확인 옵션을 완료합니다. 이 앱은 공개 회원가입·이메일 초대·비밀번호 재설정 메일 UI를 구현하지 않았습니다. 기본 SMTP 발송에 의존하지 않는 초기 운영 방식입니다. 비밀번호 변경/계정 복구도 일단 대시보드에서 관리하세요.

아이 기기를 이메일 없이 연결하려면 **Anonymous sign-ins**를 활성화합니다. 익명 계정은 브라우저 저장 공간에 연결되므로 아이 기기의 로그아웃/데이터 삭제 후에는 다시 초대해야 합니다. 기존 가족의 별과 쿠폰은 서버에 남습니다.

**주의:** 현재 앱에는 CAPTCHA UI가 없습니다. 초대 코드 없는 사용자는 가족 데이터에 접근할 수 없지만, 익명 인증 엔드포인트에 대한 가입 남용 자체는 별개입니다. 가족 내 시험운영 이후 불특정 공개 서비스로 확장하기 전에 Supabase CAPTCHA(예: Turnstile) 연동과 가입/명령 요청 제한을 추가하세요. 서비스 설정에서 CAPTCHA를 켜기만 하면 현재 클라이언트는 토큰을 보내지 못하므로 익명 가입이 실패합니다.

## 2. 데이터베이스 적용

새 프로젝트의 SQL Editor에서 아래 파일 전체를 실행합니다.

```text
supabase/migrations/202610260001_praise_star.sql
```

생성 대상은 `families`, `family_members`, `family_events`, `family_invites`, 비공개 도우미 스키마와 가족 관리 함수입니다. 네 테이블에는 RLS가 켜져야 합니다.

적용 후 Table Editor에서 가족 테이블을 확인합니다. 아직 앱에서 가족을 만들기 전이라 비어 있는 것이 정상입니다. RLS를 끄거나 authenticated 역할에 테이블 쓰기 권한을 추가해서 오류를 우회하지 마세요.

**중요:** `family_commit` 함수는 `service_role`만 호출할 수 있어야 합니다. 일반 사용자에게 이 함수 권한을 주면 별 잔액을 조작할 수 있는 위험이 생깁니다.

## 3. Edge Function 배포

Supabase CLI 사용이 가능한 개발 PC에서 프로젝트 루트로 이동합니다. 아래의 `YOUR_PROJECT_REF`를 본인 프로젝트 참조 ID로 교체합니다. 명령 실행 시 본인 계정으로 로그인합니다.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy family-action
```

`supabase/config.toml`의 `verify_jwt = true`는 유지합니다. 함수 내부에서도 Auth `/user`로 사용자 토큰을 검증하고 가족 역할을 DB에서 다시 읽습니다. 클라이언트가 보낸 역할을 신뢰하지 않습니다.

v0.2 함수는 `SUPABASE_URL`과 신형 JSON 맵 `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`의 `default` 키를 우선 사용합니다. 단일 변수 `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, 레거시 `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`도 차례로 지원합니다. 신형 secret 키는 JWT가 아니므로 DB 요청의 apikey에만 넣습니다. 설정 누락 시 서버를 조용히 실행하지 않고 오류를 냅니다. 이 값들은 Edge 환경에만 있어야 합니다.

서버 비밀 키를 `.env.local`이나 웹 배포 환경 변수에 복사하지 않습니다. 이 앱의 Edge Function 코드는 정적 웹 배포 산출물에 포함되지 않습니다.

최종 웹 주소를 정한 뒤에는 요청 출처도 제한합니다.

```powershell
npx supabase secrets set APP_ORIGIN=https://YOUR_APP.vercel.app
```

APP_ORIGIN에 마지막 `/`를 붙이지 않습니다. 출처 제한은 추가 보호 수단이며 사용자 인증을 대체하지 않습니다. 로컬에서 클라우드 연결을 시험할 때는 별도의 시험 환경을 사용하거나 허용 출처를 해당 주소로 조정해야 합니다.

## 4. 웹앱 공개 설정

로컬에서 `.env.example`을 `.env.local`로 복사합니다. 값 두 개만 넣습니다.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_PUBLIC_KEY
REQUIRE_CLOUD_CONFIG=1
```

권장 이름은 `SUPABASE_PUBLISHABLE_KEY`이며 기존 `SUPABASE_ANON_KEY`도 호환됩니다. **`sb_secret_…` 키나 service_role JWT를 넣으면 안 됩니다.** 빌드와 실행 시에도 이를 검사합니다.

```powershell
npm ci
npm run check:deploy
npm run typecheck
npm test
npm run build
npm run preview
```

웹앱은 설정이 있으면 가족 로그인 화면으로, 설정이 없으면 명확히 표시된 체험 모드로 시작합니다. `preview.html`은 설정 유무와 관계없이 항상 체험판입니다. 실제 연결 확인은 개발 서버나 배포된 웹 주소로 하세요.

## 5. Vercel 배포

GitHub의 본인 저장소에 이 프로젝트를 올리고 Vercel에서 가져옵니다. 실제 가족 기록/환경 변수/백업 파일을 저장소에 넣지 마세요. `node_modules`, `.env.local`은 제외합니다.

빌드 설정은 동봉한 `vercel.json`을 사용합니다.

| 설정 | 값 |
|---|---|
| Framework preset | Other |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 해당 서비스가 지원하는 현재 LTS |

Vercel 프로젝트의 환경 변수에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`와 `REQUIRE_CLOUD_CONFIG=1`을 설정합니다. 환경 변수를 바꾸면 다시 빌드/배포해야 합니다. 이 프로젝트에는 유료 서비스를 자동 생성하거나 결제하는 코드는 없습니다. 실제 무료 플랜 적용·한도·휴면 정책은 사용 시점의 서비스 대시보드에서 확인하세요.

첫 배포 주소가 나온 뒤 Edge Function의 `APP_ORIGIN`과 Authentication의 Site URL을 해당 주소로 맞춥니다. 현재 앱은 리다이렉트 기반 OAuth나 이메일 링크를 사용하지 않지만 이후 인증 기능 추가 시 잘못된 주소가 남지 않도록 설정해 둡니다.

정적 배포 주소의 `/config.js`에는 공개 URL/공개 키만 있어야 합니다. 서버 비밀 키가 보이면 즉시 노출 키를 폐기·교체하고 재배포하세요.

## 6. 우리 가족 연결

첫 보호자가 이메일/비밀번호로 로그인 → `가족 만들기` → 가족명/아이 이름/본인 표시명 입력. 실제 별은 0개에서 시작합니다.

보호자 화면의 `우리 가족`에서 관리자/칭찬 가족/아이 권한을 골라 초대를 생성합니다. 초대는 **1회용·48시간 유효**입니다. 성인에게는 미리 대시보드에서 계정을 만들어 준 뒤 초대 코드를 전달합니다. 아이 기기에는 아이 권한의 초대만 전달합니다.

다른 기기의 브라우저에서 같은 웹 주소를 열어 해당 계정으로 로그인하고 초대 코드로 참여합니다. 아이 기기는 `아이 기기 연결`을 선택하고 초대 코드를 붙여 넣습니다. 아이용 초대를 부모 로그인용으로 사용하지 마세요.

인증 세션은 기기 브라우저에 저장됩니다. 아이 기기에 부모 계정 로그인을 남겨 두지 마세요. 사용하지 않는 연결은 관리자 화면에서 해제하고 미사용 초대도 취소할 수 있습니다.

## 7. 실사용 전 현장 확인 — 아직 수행하지 않은 항목

- [ ] 아빠와 엄마의 서로 다른 휴대폰에서 지급 후 상대 화면에 반영되는지 확인.
- [ ] 아이 계정으로 보상 설정/칭찬 지급/DB 직접 쓰기가 거절되는지 확인.
- [ ] 두 기기에서 잔액이 부족해지는 동시 교환을 시도해 음수 잔액이 생기지 않는지 확인.
- [ ] 뽑기 직후 네트워크를 끊고 같은 요청으로 재확인해 차감/쿠폰이 한 번뿐인지 확인.
- [ ] 한정 재고 마지막 1개를 두 기기에서 동시에 요청하고 1개만 지급되는지 확인.
- [ ] 초대 코드 재사용/만료/취소/삭제된 관리자 초대가 거절되는지 확인.
- [ ] 다른 가족 계정으로 가족 ID를 바꾼 조회/명령이 거절되는지 확인.
- [ ] 익명 아이 기기를 해제한 뒤 더는 읽기/쓰기 접근이 안 되는지 확인.
- [ ] 인증 토큰 만료 후 요청 재확인 흐름, 관리자 계정 복구 절차 확인.
- [ ] Android Chrome / iPhone Safari에서 홈 화면 추가와 재접속 확인.
- [ ] Supabase 보안 점검 결과, 서버 로그, 무료 사용량 대시보드 확인.

이 항목들이 통과하기 전에는 실제 가족 기록을 대량으로 쌓기보다 예시 가족으로 시험하세요.

## 8. 백업과 운영

정기적으로 보호자 화면에서 JSON과 CSV를 내려받아 안전한 곳에 보관하세요. 현재 JSON에는 인증 비밀번호나 토큰을 넣지 않지만 가족 표시명과 칭찬 내용이 들어 있습니다. 자동 복원 화면은 없으므로 JSON을 임의로 DB에 덮어쓰지 마세요.

DB 자체 백업/복구는 Supabase의 해당 플랜 기능과 별도 덤프 절차로 준비해야 합니다. JSON 내보내기는 인증 계정·초대·서버 요청 원장까지 포함하는 완전한 DB 백업이 아닙니다.

가족 상태는 최대 4 MB입니다. 기록을 계속 누적하는 소규모 MVP 구조이므로 장기 운영에서는 원장/칭찬/쿠폰 테이블 정규화와 페이지 조회를 추가할 계획입니다.

## 확인한 공식 문서

2026-10-26 확인. 아래 주소는 설정 변경 시 참고용입니다.

- Edge 환경 변수: `https://supabase.com/docs/guides/functions/secrets`
- Edge 인증 헤더/JWT: `https://supabase.com/docs/guides/functions/auth-headers`
- Auth JWT 검증: `https://supabase.com/docs/guides/auth/jwts`
- Anonymous sign-ins: `https://supabase.com/docs/guides/auth/auth-anonymous`
- RLS: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Vercel 프로젝트 설정: `https://vercel.com/docs/project-configuration`


## 9. Good 저장소에서 GitHub Pages 사용

Vercel 대신 Pages도 선택할 수 있습니다. 먼저 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 지정합니다. 이 설정은 파일을 커밋하는 것만으로 켜지지 않습니다.

Actions → **Deploy family web app to Pages** → Run workflow에서 `demo` 또는 `cloud`를 선택합니다. `cloud` 선택 시 Settings → Secrets and variables → Actions → Variables에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 등록합니다. 레거시 이름 `SUPABASE_ANON_KEY`도 지원합니다. 이 값은 공개 설정이며 서버 비밀 키를 넣으면 안 됩니다.

예상 배포 주소는 `https://herothgf-cell.github.io/Good/`이나 실제 Actions 배포 성공을 확인해야 합니다. Edge의 `APP_ORIGIN`은 경로 없는 **`https://herothgf-cell.github.io`**로 지정합니다. Site URL에는 전체 앱 주소를 사용합니다. Pages는 Vercel의 `vercel.json` 보안 헤더 설정을 적용하지 않습니다.

`Verify Praise Star` workflow는 main 커밋과 PR에서 빌드·자동 검사·브라우저 fixture·빈 PostgreSQL 통합 테스트를 실행합니다. PostgreSQL 테스트는 테스트용 Auth 스키마를 사용하므로 실제 Supabase Auth/REST/Edge 배포 검증과는 다릅니다. 운영 DB에서 실행하지 마세요.

Supabase/Vercel 플러그인 연결이나 계정 권한 부여, 유료 리소스 생성은 이 저장소의 코드가 자동으로 수행하지 않습니다.
