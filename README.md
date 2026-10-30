# 연준이의 칭찬 별나라 ✦

**v0.6.0 · 가족 공동 칭찬·확정 선물·꽝 없는 뽑기 웹앱**

소스 저장소: **herothgf-cell/Good**. TypeScript 정적 PWA + Supabase로 만들었습니다.

> **중요:** GitHub에 소스를 올리는 것과 가족 공유 서비스를 운영하는 것은 다릅니다. Supabase DB/함수와 웹 호스팅을 연결하기 전에는 **체험판**이며 기록이 기기마다 다릅니다. 실제 가족 기록, 비밀번호, `service_role` 및 `sb_secret_…` 키를 이 저장소에 올리지 마세요.

## 구현 기능

- 가족 칭찬: 1~3개 별, 사유·지급자 기록, 지급 오류 정정.
- 확정 상점: 원하는 선물 교환, 잔액·재고 검사, 목표 선물.
- 꽝 없는 뽑기: 아이 화면에서는 기본 숨김. 보호자 설정에서 공개/숨김 전환. 비용·일일 횟수·확률 편집, 결과 저장, 중복 요청 방지.
- 보관함: 사용 요청 → 보호자 승인 → 사용 완료, 취소·반려.
- 시간 쿠폰: TV 30분 이용권 등을 분 단위로 나눠 지급·사용. 남은 시간과 사용 이력 표시, 보호자 사용 완료 시에만 차감. [사용법](docs/technical/TIME_COUPONS.md).
- 가족 공유 코드: 성인 로그인, 아이 기기 연결, 1회용 초대, 역할별 권한, 15초 갱신.
- 보상 관리·칭찬 기록·JSON/CSV 내보내기, 모바일 화면, PWA 자산.

**v0.2 추가:** Supabase 신형/레거시 서버 키 지원, 공개 설정 사전 검사, GitHub 자동 검사, PostgreSQL 권한·동시 요청 테스트, 선택형 Pages 배포 워크플로.

## PC에서 실행

Node.js 22 이상과 npm을 설치한 뒤 이 저장소를 내려받고 프로젝트 폴더에서 실행합니다.

```powershell
npm ci
npm run dev
```

표시된 `http://localhost:3000`으로 접속합니다. Windows에서는 `start-dev.cmd`도 사용할 수 있습니다. 변경 후 다시 실행해야 하며 자동 핫 리로드는 없습니다.

```powershell
npm run typecheck
npm test
npm run build
```

`dist/`는 웹 서버 배포용입니다. 생성된 `preview.html`은 설치 없이 파일로 열 수 있는 **체험판**입니다. 체험판의 별 23개·쿠폰 1개는 샘플이며 실제 가족 생성 시 별은 0개입니다. 체험판 역할 전환은 보안 인증이 아닙니다.

## 가족 공유 연결

자세한 순서: **[배포 안내](docs/technical/DEPLOYMENT.md)**.

1. 새 Supabase 프로젝트에 `supabase/migrations/202610260001_praise_star.sql`을 적용하고 `family-action` 함수를 배포합니다.
2. `.env.example`을 참고해 공개 URL과 공개 키만 설정합니다.
3. `npm run check:deploy`로 설정을 확인하고 Vercel 또는 GitHub Pages에 배포합니다.
4. 보호자가 로그인해 가족을 만들고 다른 가족·아이 기기를 초대합니다.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

`SUPABASE_ANON_KEY`도 호환됩니다. `check:deploy`는 **설정 형식 검사**이며 실제 서버 접근 성공을 보증하지 않습니다. 공유 모드 배포의 프로세스 환경 변수에 `REQUIRE_CLOUD_CONFIG=1`을 설정하면 (`.env.local`에 적는 것만으로는 적용되지 않음) 설정 누락으로 체험판이 잘못 게시되는 것을 막습니다.

## GitHub에서 검사 / Pages 배포

- **Actions → Verify Praise Star:** 커밋마다 타입·도메인/동시성 자동 검사·기존 화면 및 시간 쿠폰 브라우저 시나리오·PostgreSQL 검사를 실행합니다. 결과와 체험판은 실행 상세의 Artifacts에서 받습니다.
- **Pages를 사용할 때:** Settings → Pages → Source를 **GitHub Actions**로 설정한 뒤 Actions → **Deploy family web app to Pages** → Run workflow를 실행합니다.
- `demo`는 서버 없는 체험판, `cloud`는 공유 서버 연결용입니다. `cloud`는 Settings → Secrets and variables → Actions → **Variables**에 공개 URL/공개 키가 있어야 합니다. 서버 비밀 키는 넣지 않습니다.
- Pages를 켠 경우 예상 주소는 `https://herothgf-cell.github.io/Good/`입니다. **실제 배포 성공 전에는 접속 가능한 주소라고 간주하지 마세요.**

Vercel은 `vercel.json`의 Other / `npm run build` / `dist` 설정을 사용합니다. 서비스 가입·연결·Pages 설정은 별도 단계입니다.

## 확인한 검증 결과

2026-10-26 [GitHub 실제 실행](https://github.com/herothgf-cell/Good/actions/runs/40338145636)에서 `npm ci`, 타입 검사, **83개 자동 검사·13개 브라우저 시나리오·15개 PostgreSQL 시나리오 그룹**이 통과했습니다. DB는 테스트 Auth 스키마를 사용하며 실제 Supabase 서비스 연결 검증과는 다릅니다. 이후 변경은 Actions의 최신 결과를 확인하세요.

## 문서

- [현재 개발 상태와 다음 작업](docs/CURRENT_STATUS.md)
- [구조와 보안 경계](docs/technical/ARCHITECTURE.md)
- [서버 연결과 배포](docs/technical/DEPLOYMENT.md)
- [검증 결과와 한계](docs/verification/TEST_REPORT.md)
- [이번 작업 계획](docs/superpowers/plans/2026-10-26-good-repository.md)

아직 포함하지 않은 기능: QR 초대, 보상 사진, 주간 사용 제한, 천장, 알림, 다자녀, JSON 복원 UI. 실제 기기 간 공유·동시 거래와 iPhone/Android 설치는 서버 배포 후 별도로 검증해야 합니다.
